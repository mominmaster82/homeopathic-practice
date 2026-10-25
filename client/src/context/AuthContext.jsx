import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { api } from '../services/api.js';

const AuthContext = createContext(null);

// Firestore Timestamp / Date / সংখ্যা — সব ফরম্যাট থেকে মিলিসেকেন্ড
function toMillis(value) {
  if (!value) return null;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return value;
  const t = new Date(value).getTime();
  return Number.isFinite(t) ? t : null;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState('');
  const [clock, setClock] = useState(() => Date.now());
  const preloaded = useRef(false);

  useEffect(() => {
    let alive = true;
    let seq = 0;

    const unsubscribe = api.subscribeAuth(async (u) => {
      const requestId = ++seq;

      if (!u) {
        if (!alive) return;
        setUser(null);
        setProfile(null);
        setProfileError('');
        setLoading(false);
        return;
      }

      setUser(u);
      setLoading(true);
      setProfileError('');

      try {
        const p = await api.getUserProfile(u.uid);
        if (!alive || requestId !== seq) return;
        setProfile(p);
        if (!p) setProfileError('এই অ্যাকাউন্টের জন্য কোনো প্রোফাইল পাওয়া যায়নি');
      } catch {
        if (!alive || requestId !== seq) return;
        setProfile(null);
        setProfileError('প্রোফাইল লোড করা যায়নি');
      } finally {
        if (alive && requestId === seq) setLoading(false);
      }
    });

    return () => {
      alive = false;
      unsubscribe();
    };
  }, []);

  const expiresAtMs = toMillis(profile?.expires_at);
  const isSubscriber = profile?.role === 'subscriber';
  // সাবস্ক্রাইবারের মেয়াদ না থাকলে বা পার হলে অ্যাক্সেস বন্ধ
  const isExpired =
    !!isSubscriber && (expiresAtMs == null || expiresAtMs <= clock);
  const isActive = !!profile && profile.status === 'active' && !isExpired;
  const isAdmin = isActive && profile.role === 'super_admin';
  const expiresAt = expiresAtMs == null ? null : new Date(expiresAtMs);

  // পেজ খোলা থাকলেও মেয়াদ শেষ হওয়ার সাথে সাথে UI আপডেট হয়
  useEffect(() => {
    const now = Date.now();
    // প্রোফাইল দেরিতে এলেও মেয়াদ ইতিমধ্যে শেষ হলে সাথে সাথে ধরা পড়বে
    setClock(now);
    if (expiresAtMs == null) return;
    const delay = expiresAtMs - now;
    if (delay <= 0 || delay > 2147483647) return;
    const t = setTimeout(() => setClock(Date.now()), delay + 1000);
    return () => clearTimeout(t);
  }, [expiresAtMs]);

  // রেফারেন্স ডেটা সবাই ক্যাশে রাখে; রোগী/কেস শুধু অ্যাডমিন
  useEffect(() => {
    if (!user) {
      preloaded.current = false;
      return;
    }
    if (isActive && !preloaded.current) {
      preloaded.current = true;
      api.preloadForOffline({ includePrivate: isAdmin }).catch(() => {});
    }
  }, [user, isActive, isAdmin]);

  const login = (email, password) => api.login(email, password);
  const logout = () => api.logout();

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        role: profile?.role || null,
        status: profile?.status || null,
        isAuthenticated: !!user,
        isActive,
        isAdmin,
        isExpired,
        expiresAt,
        profileError,
        loading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
