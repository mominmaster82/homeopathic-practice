import { createContext, useContext, useState, useEffect, useRef } from 'react';
import { api } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const preloaded = useRef(false);

  useEffect(() => {
    const unsubscribe = api.subscribeAuth((u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // লগইনের পর সব ডেটা একবার লোকাল ক্যাশে নামিয়ে রাখি — পরে ইন্টারনেট না থাকলেও অ্যাপ চলবে
  useEffect(() => {
    if (user && !preloaded.current) {
      preloaded.current = true;
      api.preloadForOffline().catch(() => {});
    } else if (!user) {
      preloaded.current = false;
    }
  }, [user]);

  const login = (email, password) => api.login(email, password);

  const logout = () => api.logout();

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: !!user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
