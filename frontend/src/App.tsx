import { lazy, Suspense, type ReactNode } from 'react';
import { Link, Navigate, Route, Routes, useLocation } from 'react-router';
import { useAuth } from './context/AuthContext';
import { ApiError } from './lib/api';
import { AppShell } from './components/AppShell';
import { FullScreenLoader } from './components/ui';
import { LogoMark } from './components/Logo';
import { isAndroidApp } from './lib/platform';
import Landing from './pages/Landing';
import Auth from './pages/Auth';

const Discover = lazy(() => import('./pages/Discover'));
const Challenges = lazy(() => import('./pages/Challenges'));
const Chats = lazy(() => import('./pages/Chats'));
const UserPage = lazy(() => import('./pages/UserPage'));
const Quiz = lazy(() => import('./pages/Quiz'));
const ProfileEditor = lazy(() => import('./pages/ProfileEditor'));
const MyProfile = lazy(() => import('./pages/MyProfile'));
const PreviewSelf = lazy(() => import('./pages/MyProfile').then((m) => ({ default: m.PreviewSelf })));
const SettingsPage = lazy(() => import('./pages/Settings'));
const Legal = lazy(() => import('./pages/Legal'));
const VerifyPage = lazy(() => import('./pages/Verify'));
const PremiumPage = lazy(() => import('./pages/Premium'));
// The admin panel is web-only: in the Android build this branch is removed at compile time, so no admin code ships in the app.
const AdminApp = isAndroidApp ? null : lazy(() => import('./admin/AdminApp'));
const ADMIN_PATH = isAndroidApp ? '' : (import.meta.env.VITE_ADMIN_PATH || '').replace(/^\/+|\/+$/g, '');

function Splash() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <LogoMark size={64} className="animate-pulse" />
    </div>
  );
}

/** Signed-in + loaded profile. Redirects to onboarding when the profile is incomplete. */
function Private({ children, allowIncomplete = false }: { children: ReactNode; allowIncomplete?: boolean }) {
  const { status, me, meError, refetchMe, signOut } = useAuth();
  const loc = useLocation();
  if (status === 'loading') return <Splash />;
  if (status === 'signedOut') return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  if (meError && !me) {
    const e = meError as ApiError;
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <LogoMark size={56} />
        <h1 className="text-xl font-bold">{e?.status === 503 ? 'Server setup incomplete' : 'Can’t connect right now'}</h1>
        <p className="max-w-sm text-slate">{e?.message || 'Please check your connection.'}</p>
        <div className="flex gap-3">
          <button className="btn btn-primary" onClick={refetchMe}>Try again</button>
          <button className="btn btn-ghost" onClick={signOut}>Sign out</button>
        </div>
      </div>
    );
  }
  if (!me) return <Splash />;
  if (!me.user.onboarded && !allowIncomplete) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === 'loading') return <Splash />;
  if (status === 'signedIn') return <Navigate to="/discover" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Suspense fallback={<FullScreenLoader />}>
      <Routes>
        <Route path="/" element={<PublicOnly>{isAndroidApp ? <Navigate to="/login" replace /> : <Landing />}</PublicOnly>} />
        <Route path="/login" element={<PublicOnly><Auth mode="login" /></PublicOnly>} />
        <Route path="/signup" element={<PublicOnly><Auth mode="signup" /></PublicOnly>} />
        <Route path="/reset" element={<Auth mode="reset" />} />
        <Route path="/privacy" element={<Legal kind="privacy" />} />
        <Route path="/terms" element={<Legal kind="terms" />} />
        <Route path="/guidelines" element={<Legal kind="guidelines" />} />
        <Route path="/safety" element={<Legal kind="safety" />} />
        <Route path="/child-safety" element={<Legal kind="child-safety" />} />
        <Route path="/refunds" element={<Legal kind="refunds" />} />
        <Route path="/delete-account" element={<Legal kind="delete-account" />} />
        {AdminApp && ADMIN_PATH.length >= 6 && <Route path={`/${ADMIN_PATH}/*`} element={<AdminApp base={`/${ADMIN_PATH}`} />} />}
        <Route path="/onboarding" element={<Private allowIncomplete><OnboardingGate /></Private>} />
        <Route path="/connect/:id" element={<Private><Quiz /></Private>} />
        <Route path="/challenge/:id" element={<Private><Quiz /></Private>} />
        <Route element={<Private><AppShell /></Private>}>
          <Route path="/discover" element={<Discover />} />
          <Route path="/requests" element={<Challenges />} />
          <Route path="/challenges" element={<Navigate to="/requests" replace />} />
          <Route path="/chats" element={<Chats />} />
          <Route path="/chats/:id" element={<Chats />} />
          <Route path="/u/:id" element={<UserPage />} />
          <Route path="/me" element={<MyProfile />} />
          <Route path="/me/edit" element={<ProfileEditor mode="edit" />} />
          <Route path="/me/preview" element={<PreviewSelf />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/verify" element={<VerifyPage />} />
          <Route path="/premium" element={<PremiumPage />} />
        </Route>
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}

function OnboardingGate() {
  const { me } = useAuth();
  if (me?.user.onboarded) return <Navigate to="/discover" replace />;
  return <ProfileEditor mode="onboarding" />;
}

function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <LogoMark size={56} />
      <h1 className="text-2xl font-bold">Page not found</h1>
      <Link to="/" className="btn btn-primary">Go home</Link>
    </div>
  );
}
