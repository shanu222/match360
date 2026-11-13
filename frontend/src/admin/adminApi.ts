import { API_URL, ApiError } from '../lib/api';

const KEY = 'm360_admin';
export const adminToken = {
  get: () => {
    try {
      const v = JSON.parse(sessionStorage.getItem(KEY) || 'null');
      return v && v.exp > Date.now() ? (v.token as string) : null;
    } catch {
      return null;
    }
  },
  set: (token: string, ttl: number) => sessionStorage.setItem(KEY, JSON.stringify({ token, exp: Date.now() + ttl - 60_000 })),
  clear: () => sessionStorage.removeItem(KEY),
};

let onExpired: () => void = () => {};
export const setOnExpired = (f: () => void) => (onExpired = f);

async function req<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = adminToken.get();
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 30_000);
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api/admin${path}`, {
      method,
      headers: { ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
  } catch {
    throw new ApiError(0, 'Can’t reach the server.', 'network');
  } finally {
    clearTimeout(t);
  }
  const data = await res.json().catch(() => null);
  if (res.status === 401 && path !== '/login') {
    adminToken.clear();
    onExpired();
  }
  if (!res.ok) throw new ApiError(res.status, data?.error || 'Request failed', data?.code, data || {});
  return data as T;
}
export const adminApi = {
  get: <T,>(p: string) => req<T>('GET', p),
  post: <T,>(p: string, b: unknown = {}) => req<T>('POST', p, b),
  put: <T,>(p: string, b: unknown) => req<T>('PUT', p, b),
  patch: <T,>(p: string, b: unknown) => req<T>('PATCH', p, b),
  del: <T,>(p: string) => req<T>('DELETE', p),
};
