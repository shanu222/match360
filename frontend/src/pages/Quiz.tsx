import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Check, ChevronDown, Clock, PartyPopper, Send, X } from 'lucide-react';
import { api, ApiError, errMsg } from '../lib/api';
import type { QuizResult, QuizStart } from '../lib/types';
import { useToast } from '../context/Toast';
import { Avatar, Modal, ScoreRing, Spinner } from '../components/ui';
import { LogoMark } from '../components/Logo';

type Phase =
  | { k: 'loading' }
  | { k: 'blocked'; title: string; text: string; action?: { label: string; to: string } }
  | { k: 'quiz'; quiz: QuizStart }
  | { k: 'submitting'; quiz: QuizStart; failed?: string }
  | { k: 'result'; res: QuizResult; target: QuizStart['target'] | null }
  | { k: 'sent'; score: number; name: string };

const store = {
  get: (id: string) => {
    try {
      return JSON.parse(sessionStorage.getItem(`quiz:${id}`) || 'null') as { i: number; answers: number[] } | null;
    } catch {
      return null;
    }
  },
  set: (id: string, v: { i: number; answers: number[] }) => {
    try {
      sessionStorage.setItem(`quiz:${id}`, JSON.stringify(v));
    } catch {
      /* ignore */
    }
  },
  clear: (id: string) => {
    try {
      sessionStorage.removeItem(`quiz:${id}`);
    } catch {
      /* ignore */
    }
  },
};

export default function Quiz() {
  const { id = '' } = useParams();
  const [sp] = useSearchParams();
  const purpose = sp.get('purpose') === 'accept' ? 'accept' : 'request';
  const nav = useNavigate();
  const qc = useQueryClient();
  const [phase, setPhase] = useState<Phase>({ k: 'loading' });
  const started = useRef(false);

  const fetchResult = useCallback(async (attemptId: string, answers: number[], target: QuizStart['target'] | null) => {
    const res = await api.post<QuizResult>(`/quiz/${attemptId}/submit`, { answers });
    store.clear(attemptId);
    ['me', 'requests', 'matches', 'counts', 'discover', 'user'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
    setPhase({ k: 'result', res, target });
  }, [qc]);

  const start = useCallback(async () => {
    setPhase({ k: 'loading' });
    try {
      const quiz = await api.post<QuizStart>('/quiz/start', { targetId: id, purpose });
      setPhase({ k: 'quiz', quiz });
    } catch (e) {
      if (e instanceof ApiError) {
        if (e.code === 'ready_to_send' && e.data?.attemptId) {
          try {
            await fetchResult(e.data.attemptId, [], null);
          } catch (e2) {
            setPhase({ k: 'blocked', title: 'Couldn’t load your result', text: errMsg(e2) });
          }
          return;
        }
        if (e.code === 'cooldown')
          return setPhase({
            k: 'blocked',
            title: 'Challenge on cooldown',
            text: `You can retake this challenge ${new Date(e.data.retryAt).toLocaleString([], { weekday: 'long', hour: 'numeric', minute: '2-digit' })}.`,
            action: { label: 'Keep exploring', to: '/discover' },
          });
        if (e.code === 'they_requested_you')
          return setPhase({ k: 'blocked', title: 'They already challenged you!', text: e.message, action: { label: 'Open Challenges', to: '/challenges' } });
        return setPhase({ k: 'blocked', title: 'Can’t start this challenge', text: e.message, action: { label: 'Back to Discover', to: '/discover' } });
      }
      setPhase({ k: 'blocked', title: 'Something went wrong', text: errMsg(e) });
    }
  }, [id, purpose, fetchResult]);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    start();
  }, [start]);

  const submit = useCallback(
    async (quiz: QuizStart, answers: number[]) => {
      setPhase({ k: 'submitting', quiz });
      try {
        await fetchResult(quiz.attemptId, answers, quiz.target);
      } catch (e) {
        setPhase({ k: 'submitting', quiz, failed: errMsg(e) });
      }
    },
    [fetchResult],
  );

  return (
    <div className="relative min-h-dvh overflow-hidden">
      <div className="pointer-events-none absolute -left-40 -top-40 h-96 w-96 rounded-full bg-coral/15 blur-[110px]" />
      <div className="pointer-events-none absolute -right-40 bottom-0 h-96 w-96 rounded-full bg-violet/20 blur-[110px]" />
      <div className="relative mx-auto flex min-h-dvh max-w-xl flex-col px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] sm:px-6">
        {phase.k === 'loading' && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-ink-400">
            <LogoMark size={56} className="animate-pulse" />
            Preparing your challenge…
          </div>
        )}
        {phase.k === 'blocked' && (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <Clock size={40} className="text-coral" />
            <h1 className="mt-4 text-2xl font-extrabold">{phase.title}</h1>
            <p className="mt-2 max-w-sm text-ink-300">{phase.text}</p>
            <div className="mt-7 flex gap-3">
              <button className="btn btn-ghost" onClick={() => nav(-1)}>Go back</button>
              {phase.action ? <Link className="btn btn-primary" to={phase.action.to}>{phase.action.label}</Link> : <button className="btn btn-primary" onClick={start}>Try again</button>}
            </div>
          </div>
        )}
        {phase.k === 'quiz' && <Runner quiz={phase.quiz} onDone={(a) => submit(phase.quiz, a)} />}
        {phase.k === 'submitting' && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
            {phase.failed ? (
              <>
                <p className="max-w-sm text-ink-300">{phase.failed}</p>
                <p className="text-sm text-ink-400">Your answers are saved on this device.</p>
                <button className="btn btn-primary" onClick={() => submit(phase.quiz, store.get(phase.quiz.attemptId)?.answers || [])}>Retry submitting</button>
              </>
            ) : (
              <>
                <Spinner size={30} />
                <span className="text-ink-400">Scoring your answers…</span>
              </>
            )}
          </div>
        )}
        {phase.k === 'result' && <Result res={phase.res} target={phase.target} onSent={(score, name) => setPhase({ k: 'sent', score, name })} />}
        {phase.k === 'sent' && (
          <div className="flex flex-1 animate-pop flex-col items-center justify-center text-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-brand shadow-glow"><Send size={34} /></div>
            <h1 className="mt-6 text-3xl font-extrabold">Request sent!</h1>
            <p className="mt-2 max-w-sm text-ink-300">
              {phase.name} will see your <b className="text-white">{phase.score}%</b>. To accept, they’ll take a quiz about you — we’ll notify you the moment they do.
            </p>
            <div className="mt-8 flex gap-3">
              <Link to="/challenges" className="btn btn-ghost">View sent</Link>
              <Link to="/discover" className="btn btn-primary">Keep exploring</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Runner({ quiz, onDone }: { quiz: QuizStart; onDone: (answers: number[]) => void }) {
  const saved = store.get(quiz.attemptId);
  const total = quiz.questions.length;
  const [i, setI] = useState(Math.min(saved?.i ?? 0, total - 1));
  const [answers, setAnswers] = useState<number[]>(saved?.answers ?? Array(total).fill(-1));
  const [picked, setPicked] = useState<number | null>(null);
  const [left, setLeft] = useState(quiz.secondsPerQuestion);
  const [leave, setLeave] = useState(false);
  const done = useRef(false);
  const offset = useRef(new Date(quiz.serverNow).getTime() - Date.now());
  const deadline = new Date(quiz.expiresAt).getTime() - 3000;

  const finish = useCallback(
    (a: number[]) => {
      if (done.current) return;
      done.current = true;
      onDone(a);
    },
    [onDone],
  );

  const advance = useCallback(
    (choice: number) => {
      if (done.current) return;
      const a = [...answers];
      a[i] = choice;
      const ni = i + 1;
      setAnswers(a);
      store.set(quiz.attemptId, { i: ni, answers: a });
      if (ni >= total) finish(a);
      else {
        setI(ni);
        setPicked(null);
        setLeft(quiz.secondsPerQuestion);
      }
    },
    [answers, i, total, quiz, finish],
  );

  useEffect(() => {
    if (picked !== null) return;
    const t = setInterval(() => {
      if (Date.now() + offset.current > deadline) {
        clearInterval(t);
        finish(answers);
        return;
      }
      setLeft((l) => Math.max(0, l - 1));
    }, 1000);
    return () => clearInterval(t);
  }, [i, picked, finish, answers, deadline]);

  useEffect(() => {
    if (left === 0 && picked === null) advance(-1);
  }, [left, picked, advance]);

  const choose = (k: number) => {
    if (picked !== null) return;
    setPicked(k);
    setTimeout(() => advance(k), 380);
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const n = ['1', '2', '3', '4'].indexOf(e.key);
      const a = ['a', 'b', 'c', 'd'].indexOf(e.key.toLowerCase());
      const k = n >= 0 ? n : a;
      if (k >= 0 && k < quiz.questions[i].options.length) choose(k);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  });

  const q = quiz.questions[i];
  const pct = left / quiz.secondsPerQuestion;
  return (
    <>
      <div className="flex items-center gap-3">
        <button onClick={() => setLeave(true)} aria-label="Leave challenge" className="flex h-10 w-10 items-center justify-center rounded-2xl border border-ink-700 bg-ink-850"><X size={19} /></button>
        <div className="flex-1">
          <div className="font-bold">{quiz.purpose === 'accept' ? `Know ${quiz.target.firstName} to accept` : `${quiz.target.firstName}’s challenge`}</div>
          <div className="text-xs text-ink-400">Question {i + 1} of {total}</div>
        </div>
        <Avatar src={quiz.target.photo} name={quiz.target.firstName} className="h-10 w-10" rounded="rounded-xl" />
      </div>
      <div className="mt-4 flex gap-1.5">
        {quiz.questions.map((_, k) => (
          <span key={k} className={clsx('h-1.5 flex-1 rounded-full', k < i ? 'bg-brand' : k === i ? 'bg-ink-400' : 'bg-ink-700')} />
        ))}
      </div>

      <div key={i} className="flex flex-1 animate-fade-up flex-col justify-center py-8">
        <div className="mx-auto mb-7 flex h-16 w-16 items-center justify-center rounded-full border-4 text-xl font-extrabold" style={{ borderColor: pct > 0.5 ? '#8b5cf6' : pct > 0.25 ? '#fbbf24' : '#f43f5e' }}>
          {left}
        </div>
        <h1 className="text-center text-2xl font-bold leading-snug sm:text-[26px]">{q.q}</h1>
        <div className="mt-8 space-y-3">
          {q.options.map((o, k) => (
            <button
              key={k}
              onClick={() => choose(k)}
              disabled={picked !== null}
              className={clsx(
                'flex w-full items-center gap-4 rounded-2xl border-2 px-4 py-4 text-left text-[15px] font-semibold transition',
                picked === k ? 'scale-[.99] border-violet bg-violet/15' : 'border-ink-700 bg-ink-850 hover:border-ink-600 hover:bg-ink-800',
              )}
            >
              <span className={clsx('flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-xs font-extrabold', picked === k ? 'bg-violet text-white' : 'bg-ink-700 text-ink-300')}>
                {'ABCD'[k]}
              </span>
              {o}
            </button>
          ))}
        </div>
      </div>
      <p className="text-center text-xs text-ink-400">Answers are scored when you finish. No peeking — the clock keeps running.</p>

      <Modal open={leave} onClose={() => setLeave(false)} title="Leave the challenge?">
        <p className="text-ink-300">Your answers so far will be submitted and unanswered questions count as wrong.</p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button className="btn btn-ghost" onClick={() => setLeave(false)}>Keep going</button>
          <button className="btn btn-primary" onClick={() => { setLeave(false); finish(answers); }}>Submit now</button>
        </div>
      </Modal>
    </>
  );
}

function Result({ res, target, onSent }: { res: QuizResult; target: QuizStart['target'] | null; onSent: (score: number, name: string) => void }) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState(false);
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setShown(res.score), 120);
    return () => clearTimeout(t);
  }, [res.score]);
  const name = target?.firstName || 'them';
  const msg = res.score === 100 ? 'Perfect score! 🧠' : res.score >= 80 ? 'Impressive!' : res.score >= 60 ? 'Nicely done' : res.score >= 40 ? 'Not bad' : 'A tough one';

  const send = async () => {
    setBusy(true);
    try {
      await api.post('/requests', { attemptId: res.attemptId, note: note.trim() });
      ['requests', 'discover', 'user', 'me'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      onSent(res.score, name);
    } catch (e) {
      toast({ title: 'Request not sent', body: errMsg(e), tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-1 animate-fade-up flex-col items-center pt-6">
      {res.purpose === 'accept' && res.matchId ? (
        <div className="mb-2 flex items-center gap-2 rounded-full bg-emerald-500/15 px-4 py-1.5 text-sm font-bold text-emerald-300"><PartyPopper size={16} /> You’re connected!</div>
      ) : null}
      <ScoreRing score={shown} label={`${res.correct}/${res.total} correct`} />
      <h1 className="mt-5 text-3xl font-extrabold">{msg}</h1>
      {res.purpose === 'request' && (
        <p className={clsx('mt-3 rounded-2xl px-4 py-2.5 text-center text-sm', res.meetsThreshold ? 'bg-emerald-500/10 text-emerald-200' : 'bg-amber-400/10 text-amber-100')}>
          {res.meetsThreshold ? `You beat ${name}’s ${res.threshold}% bar.` : `${name} hoped for ${res.threshold}%+. You can still send it — sincerity counts.`}
        </p>
      )}

      <button onClick={() => setReview(!review)} className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-ink-300 hover:text-white">
        Review answers <ChevronDown size={16} className={clsx('transition', review && 'rotate-180')} />
      </button>
      {review && (
        <div className="mt-3 w-full space-y-3">
          {res.review.map((r, k) => (
            <div key={k} className="rounded-2xl border border-ink-700 bg-ink-850 p-4">
              <div className="text-sm font-bold">{r.q}</div>
              <div className="mt-2 flex items-center gap-2 text-sm text-emerald-300"><Check size={15} /> {r.options[r.correctIndex]}</div>
              {r.yourIndex !== r.correctIndex && (
                <div className="mt-1 flex items-center gap-2 text-sm text-rose-300"><X size={15} /> {r.yourIndex >= 0 ? r.options[r.yourIndex] : 'No answer'}</div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-auto w-full pt-8">
        {res.purpose === 'request' ? (
          <>
            <label className="label" htmlFor="note">Add a personal note <span className="font-normal text-ink-400">(optional)</span></label>
            <textarea id="note" className="input min-h-[90px] resize-none" maxLength={250} value={note} onChange={(e) => setNote(e.target.value)} placeholder={`Hi ${name}! I loved your answer about…`} />
            <button className="btn btn-primary mt-4 w-full py-4 text-base" onClick={send} disabled={busy}>
              {busy ? <Spinner className="text-white" size={20} /> : <><Send size={18} /> Send request with my {res.score}%</>}
            </button>
            <button className="btn btn-quiet mt-2 w-full" onClick={() => nav('/discover')}>Don’t send</button>
          </>
        ) : res.matchId ? (
          <button className="btn btn-primary w-full py-4 text-base" onClick={() => nav(`/chats/${res.matchId}`, { replace: true })}>Say hello 👋</button>
        ) : (
          <button className="btn btn-ghost w-full" onClick={() => nav('/challenges')}>Back to Challenges</button>
        )}
      </div>
    </div>
  );
}
