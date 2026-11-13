import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  updateProfile,
} from 'firebase/auth';
import { Eye, EyeOff, MailCheck } from 'lucide-react';
import { auth, firebaseConfigured, friendlyAuthError, googleProvider, preferRedirect, testAuthEnabled } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { Logo } from '../components/Logo';
import { Spinner } from '../components/ui';

type Mode = 'login' | 'signup' | 'reset';

function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export default function Auth({ mode }: { mode: Mode }) {
  const nav = useNavigate();
  const { testSignIn, redirectError } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [sent, setSent] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr('');
    if (testAuthEnabled && mode !== 'reset') {
      testSignIn(email);
      nav('/discover');
      return;
    }
    if (!auth) return setErr('Sign-in is not configured yet.');
    if (mode === 'signup' && password.length < 8) return setErr('Password must be at least 8 characters.');
    setBusy(true);
    try {
      if (mode === 'login') {
        await signInWithEmailAndPassword(auth, email.trim(), password);
        nav('/discover');
      } else if (mode === 'signup') {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (name.trim()) await updateProfile(cred.user, { displayName: name.trim() }).catch(() => {});
        sendEmailVerification(cred.user).catch(() => {});
        nav('/onboarding');
      } else {
        await sendPasswordResetEmail(auth, email.trim());
        setSent(true);
      }
    } catch (e: any) {
      setErr(friendlyAuthError(e?.code));
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    if (!auth) return;
    setErr('');
    setBusy(true);
    try {
      if (preferRedirect()) {
        await signInWithRedirect(auth, googleProvider);
        return;
      }
      await signInWithPopup(auth, googleProvider);
      nav('/discover');
    } catch (e: any) {
      // Popup blocked or unsupported → fall back to a full-page redirect.
      if (['auth/popup-blocked', 'auth/operation-not-supported-in-this-environment', 'auth/web-storage-unsupported'].includes(e?.code)) {
        try {
          await signInWithRedirect(auth, googleProvider);
          return;
        } catch (e2: any) {
          setErr(friendlyAuthError(e2?.code));
        }
      } else if (e?.code !== 'auth/popup-closed-by-user' && e?.code !== 'auth/cancelled-popup-request') {
        setErr(friendlyAuthError(e?.code));
      }
    } finally {
      setBusy(false);
    }
  };

  const shownErr = err || (redirectError ? friendlyAuthError(redirectError) : '');
  const title = mode === 'login' ? 'Sign in' : mode === 'signup' ? 'Create your account' : 'Reset your password';
  const sub =
    mode === 'login' ? 'Welcome back. Your challenges and chats are waiting.' : mode === 'signup' ? 'It takes about two minutes to set up your profile.' : 'Enter your email and we’ll send you a link to set a new password.';

  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <header className="px-5 pt-[calc(1.25rem+env(safe-area-inset-top))] sm:px-8">
        <Link to="/" aria-label="Match360 home"><Logo /></Link>
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pb-12 pt-10 sm:items-center sm:pt-0">
        <div className="w-full max-w-[420px] animate-rise">
          <h1 className="text-[34px] font-bold leading-tight">{title}</h1>
          <p className="mt-2 text-slate">{sub}</p>

          <div className="mt-7 rounded-2xl border border-rule bg-card p-6 shadow-pop sm:p-7">
            {!firebaseConfigured && !testAuthEnabled ? (
              <div className="rounded-xl border border-marker bg-marker/30 p-4 text-sm">
                Sign-in isn’t configured. Add the <code>VITE_FIREBASE_*</code> variables in Vercel and redeploy.
              </div>
            ) : sent ? (
              <div className="flex items-start gap-3 rounded-xl border border-right/40 bg-right/10 p-4 text-sm">
                <MailCheck className="shrink-0 text-right" size={20} />
                If an account exists for {email}, a reset link is on its way. Check your inbox and spam folder.
              </div>
            ) : (
              <>
                {mode !== 'reset' && !testAuthEnabled && (
                  <>
                    <button onClick={google} disabled={busy} className="btn btn-ghost w-full">
                      <GoogleIcon /> Continue with Google
                    </button>
                    <div className="my-5 flex items-center gap-3 text-xs text-slate">
                      <span className="h-px flex-1 bg-rule" /> or with email <span className="h-px flex-1 bg-rule" />
                    </div>
                  </>
                )}
                <form onSubmit={submit} noValidate>
                  {mode === 'signup' && (
                    <>
                      <label className="label mt-0" htmlFor="name">Full name</label>
                      <input id="name" className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
                    </>
                  )}
                  <label className={`label ${mode === 'signup' ? '' : 'mt-0'}`} htmlFor="email">Email</label>
                  <input id="email" className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
                  {mode !== 'reset' && !testAuthEnabled && (
                    <>
                      <div className="flex items-baseline justify-between">
                        <label className="label" htmlFor="pw">Password</label>
                        {mode === 'login' && <Link to="/reset" className="text-sm font-medium text-cobalt hover:underline">Forgot password?</Link>}
                      </div>
                      <div className="relative">
                        <input
                          id="pw"
                          className="input pr-12"
                          type={show ? 'text' : 'password'}
                          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder={mode === 'signup' ? 'At least 8 characters' : ''}
                        />
                        <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate hover:text-ink">
                          {show ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                    </>
                  )}
                  {shownErr && <p role="alert" className="mt-4 rounded-xl bg-wrong/10 px-3.5 py-2.5 text-sm text-wrong">{shownErr}</p>}
                  <button type="submit" disabled={busy || !email} className="btn btn-primary mt-6 w-full">
                    {busy ? <Spinner size={20} className="text-white" /> : mode === 'login' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
                  </button>
                </form>
              </>
            )}
          </div>

          <p className="mt-6 text-center text-sm text-slate">
            {mode === 'login' ? (
              <>New to Match360? <Link to="/signup" className="font-semibold text-cobalt hover:underline">Create an account</Link></>
            ) : mode === 'signup' ? (
              <>Already have an account? <Link to="/login" className="font-semibold text-cobalt hover:underline">Sign in</Link></>
            ) : (
              <Link to="/login" className="font-semibold text-cobalt hover:underline">Back to sign in</Link>
            )}
          </p>
          {mode === 'signup' && (
            <p className="mt-4 text-center text-xs leading-relaxed text-slate">
              By creating an account you confirm you’re 18 or older and agree to the <Link to="/terms" className="underline">Terms</Link> and <Link to="/privacy" className="underline">Privacy Policy</Link>.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
