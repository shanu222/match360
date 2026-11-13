import { io, type Socket } from 'socket.io-client';
import { API_URL, getToken } from './api';

let socket: Socket | null = null;
type Handler = (...args: any[]) => void;
const listeners = new Map<string, Set<Handler>>();

export function connectSocket() {
  if (socket) return socket;
  socket = io(API_URL, {
    transports: ['websocket', 'polling'],
    auth: (cb) => {
      getToken()
        .then((token) => cb({ token }))
        .catch(() => cb({ token: '' }));
    },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
  });
  socket.on('connect_error', async (err) => {
    // Token may have expired: refresh it, the next reconnect attempt picks it up.
    if (err?.message === 'unauthenticated') await getToken(true).catch(() => null);
  });
  for (const [ev, set] of listeners) for (const h of set) socket.on(ev, h);
  return socket;
}

export function disconnectSocket() {
  socket?.removeAllListeners();
  socket?.disconnect();
  socket = null;
}

export function onSocket(event: string, handler: Handler) {
  if (!listeners.has(event)) listeners.set(event, new Set());
  listeners.get(event)!.add(handler);
  socket?.on(event, handler);
  return () => {
    listeners.get(event)?.delete(handler);
    socket?.off(event, handler);
  };
}

export function emitSocket(event: string, payload: unknown) {
  if (socket?.connected) socket.emit(event, payload);
}
