import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { api } from './api.js';
const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);
export function AuthProvider({ children }) {
  const [state, setState] = useState({ loading: true, user: null, restaurant: null });
  const refresh = useCallback(() => api.get('/auth/me').then((r) => setState({ loading: false, ...r.data })).catch(() => setState({ loading: false, user: null, restaurant: null })), []);
  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { // expired session -> back to login
    const id = api.interceptors.response.use((r) => r, (e) => { if (e.response?.status === 401 && !e.config.url.includes('/auth/')) setState((s) => ({ ...s, user: null })); return Promise.reject(e); });
    return () => api.interceptors.response.eject(id);
  }, []);
  const login = async (email, password) => { await api.post('/auth/login', { email, password }); await refresh(); };
  const logout = async () => { await api.post('/auth/logout'); setState({ loading: false, user: null, restaurant: null }); };
  const money = (n) => new Intl.NumberFormat('en-PK', { style: 'currency', currency: state.restaurant?.currency || 'PKR', maximumFractionDigits: 0 }).format(n || 0);
  return <Ctx.Provider value={{ ...state, login, logout, refresh, money }}>{children}</Ctx.Provider>;
}
