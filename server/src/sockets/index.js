import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
let io;
export function initSockets(httpServer, origin) {
  io = new Server(httpServer, { cors: { origin, credentials: true } });
  io.use((socket, next) => {
    try {
      const c = (socket.handshake.headers.cookie || '').split(';').map((x) => x.trim()).find((x) => x.startsWith('token='));
      if (!c) return next(new Error('unauthorized'));
      socket.user = jwt.verify(c.slice(6), process.env.JWT_SECRET);
      next();
    } catch { next(new Error('unauthorized')); }
  });
  // Room comes from the verified token, never from client input.
  io.on('connection', (s) => s.join(`r:${s.user.restaurant}`));
}
export const emit = (restaurantId, event, payload) => io?.to(`r:${restaurantId}`).emit(event, payload);
