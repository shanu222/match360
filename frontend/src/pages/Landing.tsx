import { Link } from 'react-router';
import { Brain, HeartHandshake, Lock, MessageCircle, ShieldCheck, Sparkles, Target, Zap } from 'lucide-react';
import { Logo, LogoMark } from '../components/Logo';

const steps = [
  { n: 1, t: 'Build a profile worth knowing', d: 'Photos, interests and a few honest answers about you. Your answers become your challenge.' },
  { n: 2, t: 'Take their challenge', d: 'Found someone interesting? Answer 5 quick questions about their profile. Your score is sent with your request.' },
  { n: 3, t: 'They quiz you back', d: 'To accept, they answer questions about you. Their score comes back with the yes — then chat unlocks.' },
];
const features = [
  { i: Brain, t: 'Effort over swipes', d: 'Every request proves someone actually read your profile — no more low-effort “hey”.' },
  { i: Target, t: 'Your bar, your rules', d: 'Set the score you hope for. Requests below it are flagged so you can decide fast.' },
  { i: Sparkles, t: 'Smart compatibility', d: 'Shared interests, goals and city shape who you see first.' },
  { i: MessageCircle, t: 'Real-time chat', d: 'Instant messages, typing indicators, read receipts and icebreakers drawn from their profile.' },
  { i: ShieldCheck, t: 'Safety built in', d: 'One-tap report and block, 18+ only, incognito mode and verified emails.' },
  { i: Lock, t: 'Private by design', d: 'Your email and birthday are never shown. Photos are stripped of location data.' },
];

export default function Landing() {
  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div className="pointer-events-none absolute -left-40 -top-40 h-[520px] w-[520px] rounded-full bg-coral/25 blur-[120px]" />
      <div className="pointer-events-none absolute -right-40 top-40 h-[520px] w-[520px] rounded-full bg-violet/30 blur-[120px]" />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 pt-[calc(1.25rem+env(safe-area-inset-top))] sm:px-8">
        <Logo />
        <div className="flex items-center gap-2">
          <Link to="/login" className="btn btn-quiet px-4 py-2.5">Sign in</Link>
          <Link to="/signup" className="btn btn-primary hidden px-4 py-2.5 sm:inline-flex">Get started</Link>
        </div>
      </header>

      <section className="relative z-10 mx-auto grid max-w-6xl items-center gap-12 px-5 pb-16 pt-14 sm:px-8 lg:grid-cols-[1.1fr_.9fr] lg:pt-24">
        <div className="animate-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full border border-ink-600 bg-ink-850/80 px-3.5 py-1.5 text-xs font-bold text-ink-300">
            <Zap size={14} className="fill-coral text-coral" /> The challenge-first way to meet people
          </span>
          <h1 className="mt-6 text-[44px] font-extrabold leading-[1.02] tracking-[-0.04em] sm:text-6xl lg:text-7xl">
            Don’t just swipe.
            <br />
            <span className="text-brand">Earn the connection.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-300">
            Match360 is where people prove they actually know you before they can message you. Friends, partners, co-founders or study buddies — every connection here was earned.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link to="/signup" className="btn btn-primary px-7 py-4 text-base">Create your free profile</Link>
            <Link to="/login" className="btn btn-ghost px-7 py-4 text-base">I already have an account</Link>
          </div>
          <p className="mt-5 text-sm text-ink-400">Free · 18+ only · Takes 2 minutes</p>
        </div>

        <div className="relative mx-auto w-full max-w-sm animate-pop">
          <div className="card overflow-hidden shadow-card">
            <div className="relative flex h-64 items-center justify-center bg-gradient-to-br from-coral/80 via-fuchsia-600/70 to-violet">
              <LogoMark size={96} className="drop-shadow-2xl" />
              <span className="absolute left-4 top-4 rounded-full bg-black/30 px-3 py-1 text-xs font-bold backdrop-blur">Challenge</span>
            </div>
            <div className="p-5">
              <div className="text-xs font-bold uppercase tracking-widest text-ink-400">Question 3 of 5</div>
              <div className="mt-2 text-lg font-bold">What is their perfect weekend?</div>
              <div className="mt-4 space-y-2">
                {['A road trip up north', 'Sunrise hike, then chai', 'Gaming all night'].map((o, i) => (
                  <div key={o} className={`rounded-2xl border px-4 py-3 text-sm font-semibold ${i === 1 ? 'border-emerald-400/70 bg-emerald-500/15' : 'border-ink-600 bg-ink-800'}`}>{o}</div>
                ))}
              </div>
            </div>
          </div>
          <div className="absolute -bottom-6 -left-6 flex items-center gap-3 rounded-2xl border border-ink-600 bg-ink-850/95 px-4 py-3 shadow-card backdrop-blur">
            <HeartHandshake className="text-coral" />
            <div>
              <div className="text-sm font-bold">You scored 100%</div>
              <div className="text-xs text-ink-400">Request sent with your score</div>
            </div>
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-5 py-16 sm:px-8">
        <h2 className="text-center text-3xl font-extrabold tracking-tight sm:text-4xl">How it works</h2>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {steps.map((s) => (
            <div key={s.n} className="card p-6">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand text-lg font-extrabold shadow-glow">{s.n}</div>
              <h3 className="mt-5 text-lg font-bold">{s.t}</h3>
              <p className="mt-2 leading-relaxed text-ink-400">{s.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-5 py-16 sm:px-8">
        <h2 className="text-center text-3xl font-extrabold tracking-tight sm:text-4xl">Built for meaningful connections</h2>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map(({ i: Icon, t, d }) => (
            <div key={t} className="card p-6 transition hover:border-ink-600">
              <Icon className="text-coral" size={26} />
              <h3 className="mt-4 font-bold">{t}</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-ink-400">{d}</p>
            </div>
          ))}
        </div>
        <div className="mt-14 flex flex-col items-center gap-4 rounded-[32px] border border-ink-700 bg-gradient-to-br from-coral/15 to-violet/20 px-6 py-12 text-center">
          <h3 className="text-2xl font-extrabold sm:text-3xl">Ready to be known for real?</h3>
          <Link to="/signup" className="btn btn-primary px-8 py-4 text-base">Join Match360</Link>
        </div>
      </section>

      <footer className="relative z-10 mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 border-t border-ink-700/60 px-5 py-8 text-sm text-ink-400 sm:flex-row sm:px-8">
        <Logo size={26} />
        <div className="flex gap-6">
          <Link to="/privacy" className="hover:text-white">Privacy</Link>
          <Link to="/terms" className="hover:text-white">Terms</Link>
          <a href="mailto:shahnawaz@sustainablesolution360.com" className="hover:text-white">Contact</a>
        </div>
        <div>© {new Date().getFullYear()} Match360 · Sustainable Solution 360</div>
      </footer>
    </div>
  );
}
