import jwt from 'jsonwebtoken';
import { User } from '../models.js';
export const httpError = (status, message) => Object.assign(new Error(message), { status });
export async function auth(req, res, next) {
  try {
    const token = req.cookies?.token;
    if (!token) return res.status(401).json({ error: 'Not authenticated' });
    const p = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(p.id).lean();
    if (!user || !user.active) return res.status(401).json({ error: 'Account inactive' });
    req.user = user; next();
  } catch { res.status(401).json({ error: 'Session expired' }); }
}
export const allow = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : res.status(403).json({ error: 'Forbidden' });
export const errorHandler = (err, req, res, next) => {
  if (err.name === 'ZodError') return res.status(400).json({ error: 'Validation failed', details: err.issues });
  if (err.status) return res.status(err.status).json({ error: err.message });
  console.error(err); res.status(500).json({ error: 'Server error' });
};
