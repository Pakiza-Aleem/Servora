import axios from 'axios';
import { io } from 'socket.io-client';
const base = import.meta.env.VITE_API_URL || '';
export const api = axios.create({ baseURL: base + '/api', withCredentials: true });
export const connectSocket = () => io(base || undefined, { withCredentials: true });
export const errMsg = (e) => e?.response?.data?.error || e.message;
export const imgUrl = (p) => (p ? (p.startsWith('http') ? p : base + p) : null);