/**
 * Who is connected right now. A member counts as online while at least one of their devices
 * (website tab or Android app) holds a live connection. Kept in memory: it resets when the server restarts
 * and members reconnect within seconds.
 */
const connections = new Map<string, number>();

export const presence = {
  add(uid: string) {
    connections.set(uid, (connections.get(uid) || 0) + 1);
  },
  remove(uid: string) {
    const n = (connections.get(uid) || 1) - 1;
    if (n <= 0) connections.delete(uid);
    else connections.set(uid, n);
  },
  isOnline: (uid: string) => (connections.get(uid) || 0) > 0,
  ids: () => [...connections.keys()],
};
