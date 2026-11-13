import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { getRedirectResult, onIdTokenChanged, signOut as fbSignOut, type User } from 'firebase/auth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { auth, testAuthEnabled } from '../lib/firebase';
import { api, ApiError } from '../lib/api';
import { connectSocket, disconnectSocket } from '../lib/socket';
import type { MeResponse } from '../lib/types';

type Status = 'loading' | 'signedOut' | 'signedIn';
interface Ctx {
  status: Status;
  fbUser: User | null;
  me: MeResponse | undefined;
  meLoading: boolean;
  meError: unknown;
  redirectError: string;
  refreshEmailStatus: () => Promise<boolean>;
  refetchMe: () => void;
  signOut: () => Promise<void>;
  testSignIn: (email: string) => void;
}
const AuthCtx = createContext<Ctx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<Status>('loading');
  const [fbUser, setFbUser] = useState<User | null>(null);
  const [redirectError, setRedirectError] = useState('');

  // Completes a Google sign-in that used the redirect flow.
  useEffect(() => {
    if (!auth) return;
    getRedirectResult(auth).catch((e) => setRedirectError(e?.code || 'auth/unknown'));
  }, []);

  useEffect(() => {
    if (testAuthEnabled && localStorage.getItem('m360_test_token')) {
      setStatus('signedIn');
      return;
    }
    if (!auth) {
      setStatus('signedOut');
      return;
    }
    return onIdTokenChanged(auth, (u) => {
      setFbUser(u);
      setStatus(u ? 'signedIn' : 'signedOut');
    });
  }, []);

  useEffect(() => {
    if (status === 'signedIn') connectSocket();
    else disconnectSocket();
  }, [status]);

  /** Firebase only reports a confirmed email after the user record is reloaded and a fresh token is issued. */
  const refreshEmailStatus = async () => {
    const u = auth?.currentUser;
    if (!u) return false;
    try {
      await u.reload();
      if (u.emailVerified) {
        await u.getIdToken(true);
        await qc.invalidateQueries({ queryKey: ['me'] });
      }
      return u.emailVerified;
    } catch {
      return false;
    }
  };
  useEffect(() => {
    if (status !== 'signedIn') return;
    const check = () => {
      if (document.visibilityState === 'visible' && auth?.currentUser && !auth.currentUser.emailVerified) void refreshEmailStatus();
    };
    check();
    window.addEventListener('focus', check);
    document.addEventListener('visibilitychange', check);
    return () => {
      window.removeEventListener('focus', check);
      document.removeEventListener('visibilitychange', check);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const meQ = useQuery({
    queryKey: ['me'],
    queryFn: () => api.get<MeResponse>('/me'),
    enabled: status === 'signedIn',
    staleTime: 30_000,
    retry: (n, e) => !(e instanceof ApiError && (e.status === 401 || e.status === 403)) && n < 3,
  });

  const value = useMemo<Ctx>(
    () => ({
      status,
      fbUser,
      me: meQ.data,
      meLoading: meQ.isLoading,
      meError: meQ.error,
      redirectError,
      refreshEmailStatus,
      refetchMe: () => void meQ.refetch(),
      signOut: async () => {
        disconnectSocket();
        localStorage.removeItem('m360_test_token');
        if (auth) await fbSignOut(auth).catch(() => {});
        qc.clear();
        setStatus('signedOut');
      },
      testSignIn: (email: string) => {
        const id = email.split('@')[0].replace(/[^a-z0-9]/gi, '') || 'tester';
        localStorage.setItem('m360_test_token', `test:${id}:${email}`);
        setStatus('signedIn');
      },
    }),
    [status, fbUser, meQ.data, meQ.isLoading, meQ.error, redirectError, qc],
  );
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function useAuth() {
  const c = useContext(AuthCtx);
  if (!c) throw new Error('useAuth outside provider');
  return c;
}
