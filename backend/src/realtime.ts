import type { Server as HttpServer } from 'node:http';
import { Server } from 'socket.io';
import { config } from './config.js';
import { verifyToken } from './auth.js';
import { q } from './db.js';
import { presence } from './presence.js';

let io: Server | null = null;

export function initRealtime(server: HttpServer) {
  io = new Server(server, {
    cors: { origin: config.origins, credentials: true },
    pingInterval: 25_000,
    pingTimeout: 20_000,
  });

  io.use(async (socket, next) => {
    try {
      const token = String(socket.handshake.auth?.token || '');
      const u = await verifyToken(token);
      socket.data.uid = u.uid;
      next();
    } catch {
      next(new Error('unauthenticated'));
    }
  });

  io.on('connection', (socket) => {
    const uid: string = socket.data.uid;
    socket.join(`user:${uid}`);
    presence.add(uid);
    q('UPDATE users SET last_seen=now() WHERE id=$1', [uid]).catch(() => {});

    socket.on('typing', (p: { matchId?: string; to?: string }) => {
      if (p && typeof p.to === 'string' && typeof p.matchId === 'string') {
        io?.to(`user:${p.to}`).emit('typing', { matchId: p.matchId, from: uid });
      }
    });

    socket.on('disconnect', () => {
      presence.remove(uid);
      q('UPDATE users SET last_seen=now() WHERE id=$1', [uid]).catch(() => {});
    });
  });
}

export const isOnline = (uid: string) => presence.isOnline(uid);

export function emit(uid: string, event: string, payload: unknown) {
  io?.to(`user:${uid}`).emit(event, payload);
}

export async function notify(userId: string, type: string, body: string, actorId?: string, refId?: string) {
  try {
    const r = await q(
      `INSERT INTO notifications (user_id, type, body, actor_id, ref_id) VALUES ($1,$2,$3,$4,$5)
       RETURNING id, type, body, actor_id, ref_id, read, created_at`,
      [userId, type, body, actorId || null, refId || null],
    );
    emit(userId, 'notification', r.rows[0]);
  } catch (e: any) {
    console.warn('[notify] failed', e?.message);
  }
}
