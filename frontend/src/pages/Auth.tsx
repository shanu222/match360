import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import { Eye, EyeOff, MailCheck } from 'lucide-react';
import { auth, firebaseConfigured, friendlyAuthError, googleProvider, testAuthEnabled } from '../lib/firebase';
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
  const { testSignIn } = useAuth();
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
      await signInWithPopup(auth, googleProvider);
      nav('/discover');
    } catch (e: any) {
      setErr(friendlyAuthError(e?.code));
    } finally {
      setBusy(false);
    }
  };

  const title = mode === 'login' ? 'Welcome back' : mode === 'signup' ? 'Create your account' : 'Reset your password';
  const sub =
    mode === 'login' ? 'Sign in to see your challenges and chats.' : mode === 'signup' ? 'Join the people who connect with intention.' : 'We’ll email you a secure link to set a new password.';

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden px-4 py-10">
      <div className="pointer-events-none absolute -left-32 top-0 h-96 w-96 rounded-full bg-coral/20 blur-[110px]" />
      <div className="pointer-events-none absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-violet/25 blur-[110px]" />
      <div className="relative w-full max-w-md animate-fade-up">
        <Link to="/" className="mb-8 flex justify-center"><Logo size={40} /></Link>
        <div className="card p-6 shadow-card sm:p-8">
          <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
          <p className="mt-1.5 text-ink-400">{sub}</p>

          {!firebaseConfigured && !testAuthEnabled ? (
            <div className="mt-6 rounded-2xl border border-amber-400/40 bg-amber-400/10 p-4 text-sm text-amber-100">
              Firebase is not configured. Add the <code>VITE_FIREBASE_*</code> variables in Vercel and redeploy.
            </div>
          ) : sent ? (
            <div className="mt-6 flex items-start gap-3 rounded-2xl border border-emerald-400/40 bg-emerald-500/10 p-4 text-sm text-emerald-100">
              <MailCheck className="shrink-0" size={20} />
              If an account exists for {email}, a reset link is on its way. Check your inbox and spam folder.
            </div>
          ) : (
            <>
              {mode !== 'reset' && !testAuthEnabled && (
                <>
                  <button onClick={google} disabled={busy} className="btn btn-ghost mt-6 w-full bg-white/95 text-ink-950 hover:bg-white">
                    <GoogleIcon /> Continue with Google
                  </button>
                  <div className="my-5 flex items-center gap-3 text-xs font-semibold text-ink-400">
                    <span className="h-px flex-1 bg-ink-700" /> or use email <span className="h-px flex-1 bg-ink-700" />
                  </div>
                </>
              )}
              <form onSubmit={submit} className={mode === 'reset' || testAuthEnabled ? 'mt-6' : ''} noValidate>
                {mode === 'signup' && (
                  <>
                    <label className="label mt-0" htmlFor="name">Your name</label>
                    <input id="name" className="input" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
                  </>
                )}
                <label className={`label ${mode === 'signup' ? '' : 'mt-0'}`} htmlFor="email">Email</label>
                <input id="email" className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
                {mode !== 'reset' && !testAuthEnabled && (
                  <>
                    <div className="flex items-center justify-between">
                      <label className="label" htmlFor="pw">Password</label>
                      {mode === 'login' && <Link to="/reset" className="mt-3 text-[13px] font-semibold text-violet-400 hover:text-violet-300">Forgot password?</Link>}
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
                        placeholder={mode === 'signup' ? 'At least 8 characters' : 'Your password'}
                      />
                      <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-ink-400 hover:text-white">
                        {show ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                  </>
                )}
                {err && <p role="alert" className="mt-4 rounded-xl bg-rose-500/10 px-3 py-2.5 text-sm text-rose-200">{err}</p>}
                <button type="submit" disabled={busy || !email} className="btn btn-primary mt-6 w-full py-3.5">
                  {busy ? <Spinner size={20} className="text-white" /> : mode === 'login' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
                </button>
              </form>
            </>
          )}

          <p className="mt-6 text-center text-sm text-ink-400">
            {mode === 'login' ? (
              <>New to Match360? <Link to="/signup" className="font-bold text-white hover:underline">Create an account</Link></>
            ) : mode === 'signup' ? (
              <>Already have an account? <Link to="/login" className="font-bold text-white hover:underline">Sign in</Link></>
            ) : (
              <Link to="/login" className="font-bold text-white hover:underline">Back to sign in</Link>
            )}
          </p>
        </div>
        {mode === 'signup' && (
          <p className="mt-5 text-center text-xs leading-relaxed text-ink-400">
            By creating an account you confirm you are 18+ and agree to our <Link to="/terms" className="underline">Terms</Link> and <Link to="/privacy" className="underline">Privacy Policy</Link>.
          </p>
        )}
      </div>
    </div>
  );
}
