import { useState } from 'react';
import { PLAY_STORE_URL } from '../native/billing';
import { Link } from 'react-router';
import clsx from 'clsx';
import { Check, Eye, Lock, MessageCircle, ShieldCheck, SlidersHorizontal, X, Smartphone } from 'lucide-react';
import { Logo } from '../components/Logo';

/* A sample question so visitors feel the product in five seconds. The person is fictional. */
const SAMPLE = {
  name: 'Hira',
  question: 'What is Hira’s perfect weekend?',
  options: ['A road trip up north', 'Library till Asr, then poetry at home', 'Gaming all night', 'A long brunch with friends'],
  answer: 1,
};

function QuestionCard() {
  const [picked, setPicked] = useState<number | null>(null);
  const done = picked !== null;
  const correct = picked === SAMPLE.answer;
  return (
    <div className="relative mx-auto w-full max-w-[420px]">
      {/* stacked cards behind: the rest of the questions */}
      <div className="absolute inset-x-6 -bottom-3 top-3 rounded-2xl border border-rule bg-card" aria-hidden />
      <div className="absolute inset-x-3 -bottom-1.5 top-1.5 rounded-2xl border border-rule bg-card" aria-hidden />
      <div className="relative rounded-2xl border border-rule bg-card p-6 shadow-lift sm:p-7">
        <div className="flex items-center justify-between text-sm text-slate">
          <span>Question 3 of 5</span>
          <span className="tabular-nums">{done ? 'Answered' : '0:14'}</span>
        </div>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-rule">
          <div className={clsx('h-full origin-left bg-cobalt transition-transform duration-700', done ? 'scale-x-0' : 'scale-x-[.7]')} />
        </div>
        <h3 className="mt-6 text-[22px] font-semibold leading-snug">{SAMPLE.question}</h3>
        <div className="mt-5 space-y-2.5">
          {SAMPLE.options.map((o, i) => {
            const isAnswer = i === SAMPLE.answer;
            const isPicked = i === picked;
            return (
              <button
                key={o}
                disabled={done}
                onClick={() => setPicked(i)}
                className={clsx(
                  'flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-[15px] font-medium transition-colors',
                  !done && 'border-rule hover:border-cobalt hover:bg-cobalt-soft',
                  done && isAnswer && 'border-right bg-right/10',
                  done && isPicked && !isAnswer && 'border-wrong bg-wrong/10',
                  done && !isAnswer && !isPicked && 'border-rule opacity-50',
                )}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-rule bg-paper text-xs font-semibold text-slate">
                  {done && isAnswer ? <Check size={14} className="text-right" /> : done && isPicked ? <X size={14} className="text-wrong" /> : 'ABCD'[i]}
                </span>
                {o}
              </button>
            );
          })}
        </div>
        <p className="mt-5 min-h-[44px] text-sm leading-relaxed text-slate" aria-live="polite">
          {!done
            ? 'Try it. This is what connecting on Match360 feels like.'
            : correct
              ? 'Right. Hira wrote that in her profile, and you noticed. That attention is what your score shows her.'
              : 'Not quite. On Match360, your score tells people how closely you read about them.'}
        </p>
      </div>
    </div>
  );
}

const steps = [
  ['Write a profile people can learn from', 'Photos, interests and three short answers in your own words. Those answers become the questions people must get right.'],
  ['Answer five questions about them', 'Each question is built from their profile and timed. Your score is attached to your request.'],
  ['They answer five about you', 'To accept, they answer questions about you. You both see how well the other listened, and only then can you message each other.'],
];

const details = [
  { i: SlidersHorizontal, t: 'You set the bar', d: 'Choose the score you hope for. Requests under it are flagged, and the decision is always yours.' },
  { i: Eye, t: 'Questions stay fair', d: 'Questions are generated and graded on our servers. Answers never reach the browser.' },
  { i: MessageCircle, t: 'Chat that opens with context', d: 'Every conversation starts with two scores and suggestions drawn from what you both wrote.' },
  { i: ShieldCheck, t: 'Safety in one tap', d: 'Report or block from any profile or chat. Members are 18+.' },
  { i: Lock, t: 'Private details stay private', d: 'Your email and birthday are never shown. Photos are stripped of location data before upload.' },
];

export default function Landing() {
  return (
    <div className="min-h-dvh bg-paper">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-5 pt-[calc(1.25rem+env(safe-area-inset-top))] sm:px-8">
        <Logo />
        <nav className="flex items-center gap-1">
          <Link to="/login" className="btn btn-quiet hidden px-4 py-2 sm:inline-flex">Sign in</Link>
          <Link to="/signup" className="btn btn-primary whitespace-nowrap px-4 py-2">Create account</Link>
        </nav>
      </header>

      <section className="mx-auto grid max-w-6xl items-center gap-14 px-5 pb-20 pt-14 sm:px-8 lg:grid-cols-[1.05fr_.95fr] lg:gap-10 lg:pb-28 lg:pt-24">
        <div>
          <h1 className="max-w-[13ch] text-[46px] font-bold leading-[1.02] sm:text-[64px] lg:text-[76px]">
            Know them before you say hello.
          </h1>
          <p className="mt-6 max-w-[46ch] text-lg leading-relaxed text-slate">
            On Match360 you can’t message someone until you’ve answered questions about their profile, and they’ve answered questions about yours.
            Friends, partners, co-founders, study partners: every connection starts with attention.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link to="/signup" className="btn btn-primary px-6 py-3.5 text-base">Create your profile</Link>
            <Link to="/login" className="btn btn-ghost px-6 py-3.5 text-base">Sign in</Link>
          </div>
          <p className="mt-4 text-sm text-slate">Free to join. For adults 18 and over.</p>
          <div className="mt-7 flex flex-wrap items-center gap-x-4 gap-y-2">
            <a href={PLAY_STORE_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2.5 rounded-xl bg-ink px-5 py-3 font-semibold text-white hover:opacity-90">
              <Smartphone size={18} /> Get the Android app on Google Play
            </a>
            <span className="text-sm text-slate">iPhone app coming soon. Use the website on iPhone for now.</span>
          </div>
        </div>
        <QuestionCard />
      </section>

      <section className="border-y border-rule bg-card">
        <div className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[.8fr_1.2fr] lg:py-24">
          <h2 className="text-3xl font-bold leading-tight sm:text-[40px]">How a connection is made</h2>
          <ol className="space-y-8">
            {steps.map(([t, d], i) => (
              <li key={t} className="grid grid-cols-[44px_1fr] gap-4">
                <span className="font-display text-[28px] font-bold leading-none text-cobalt">{i + 1}</span>
                <div>
                  <h3 className="text-xl font-semibold">{t}</h3>
                  <p className="mt-1.5 max-w-[56ch] leading-relaxed text-slate">{d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[.8fr_1.2fr] lg:py-24">
        <h2 className="text-3xl font-bold leading-tight sm:text-[40px]">Designed for people who mean it</h2>
        <dl className="grid gap-x-10 gap-y-8 sm:grid-cols-2">
          {details.map(({ i: Icon, t, d }) => (
            <div key={t}>
              <dt className="flex items-center gap-2.5 font-semibold">
                <Icon size={19} className="text-cobalt" /> {t}
              </dt>
              <dd className="mt-1.5 leading-relaxed text-slate">{d}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mx-auto max-w-6xl px-5 pb-20 sm:px-8">
        <div className="flex flex-col items-start justify-between gap-6 rounded-2xl bg-ink px-7 py-10 text-white sm:flex-row sm:items-center sm:px-10">
          <h2 className="max-w-[20ch] text-3xl font-bold leading-tight">Be known before you say hello.</h2>
          <div className="flex shrink-0 flex-col gap-3 sm:items-end">
            <Link to="/signup" className="btn bg-marker px-6 py-3.5 text-base text-ink hover:brightness-95">Create your profile</Link>
            <a href={PLAY_STORE_URL} target="_blank" rel="noreferrer" className="text-sm font-medium text-white/80 underline hover:text-white">Download the Android app. iPhone app coming soon.</a>
          </div>
        </div>
      </section>

      <footer className="border-t border-rule">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-8 text-sm text-slate sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <Logo size={24} />
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            <Link to="/privacy" className="hover:text-ink">Privacy</Link>
            <Link to="/terms" className="hover:text-ink">Terms</Link>
            <Link to="/guidelines" className="hover:text-ink">Guidelines</Link>
            <Link to="/safety" className="hover:text-ink">Safety</Link>
            <a href="mailto:shahnawaz@sustainablesolution360.com" className="hover:text-ink">Contact</a>
          </div>
          <div>© {new Date().getFullYear()} Sustainable Solution 360</div>
        </div>
      </footer>
    </div>
  );
}
