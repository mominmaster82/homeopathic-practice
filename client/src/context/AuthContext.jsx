import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { api } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [profileError, setProfileError] = useState('');
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

  const isActive = !!profile && profile.status === 'active';
  const isAdmin = isActive && profile.role === 'super_admin';

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
