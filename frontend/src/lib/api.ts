import { auth, testAuthEnabled } from './firebase';

export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8080').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string, public data: any = {}) {
    super(message);
  }
}

export async function getToken(forceRefresh = false): Promise<string | null> {
  if (testAuthEnabled) {
    const t = localStorage.getItem('m360_test_token');
    if (t) return t;
  }
  const u = auth?.currentUser;
  if (!u) return null;
  return u.getIdToken(forceRefresh);
}

async function request<T>(method: string, path: string, body?: unknown, retried = false): Promise<T> {
  const token = await getToken();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
  let res: Response;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
  } catch (e: any) {
    throw new ApiError(0, e?.name === 'AbortError' ? 'The server took too long to respond. Please try again.' : 'Can’t reach Match360 right now. Check your connection.', 'network');
  } finally {
    clearTimeout(timer);
  }
  let data: any = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  if (res.status === 401 && !retried && auth?.currentUser) {
    await auth.currentUser.getIdToken(true).catch(() => null);
    return request<T>(method, path, body, true);
  }
  if (!res.ok) throw new ApiError(res.status, data?.error || 'Something went wrong. Please try again.', data?.code, data || {});
  return data as T;
}

export const api = {
  get: <T,>(p: string) => request<T>('GET', p),
  post: <T,>(p: string, b: unknown = {}) => request<T>('POST', p, b),
  put: <T,>(p: string, b: unknown) => request<T>('PUT', p, b),
  patch: <T,>(p: string, b: unknown) => request<T>('PATCH', p, b),
  del: <T,>(p: string) => request<T>('DELETE', p),
};

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong. Please try again.');
