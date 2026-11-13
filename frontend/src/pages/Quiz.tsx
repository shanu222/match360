import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Check, ChevronDown, Clock, Send, X } from 'lucide-react';
import { api, ApiError, errMsg } from '../lib/api';
import type { Profile, QuizResult, QuizStart } from '../lib/types';
import { useToast } from '../context/Toast';
import { Avatar, Modal, ScoreStamp, Spinner } from '../components/ui';
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
            title: 'Try again later',
            text: `You can try again ${new Date(e.data.retryAt).toLocaleString([], { weekday: 'long', hour: 'numeric', minute: '2-digit' })}.`,
            action: { label: 'Keep exploring', to: '/discover' },
          });
        if (e.code === 'daily_limit')
          return setPhase({ k: 'blocked', title: 'Daily limit reached', text: e.message, action: e.data?.premium ? { label: 'Back to Discover', to: '/discover' } : { label: 'See Premium', to: '/premium' } });
        if (e.code === 'they_requested_you')
          return setPhase({ k: 'blocked', title: 'They already want to connect with you', text: e.message, action: { label: 'Open requests', to: '/requests' } });
        return setPhase({ k: 'blocked', title: 'Can’t continue right now', text: e.message, action: { label: 'Back to Discover', to: '/discover' } });
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
    <div className="relative min-h-dvh bg-paper">
      <div className="relative mx-auto flex min-h-dvh max-w-xl flex-col px-4 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-[calc(1rem+env(safe-area-inset-top))] sm:px-6">
        {phase.k === 'loading' && (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 text-slate">
            <LogoMark size={48} className="animate-pulse" />
            Writing your questions…
          </div>
        )}
        {phase.k === 'blocked' && (
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <Clock size={40} className="text-cobalt" />
            <h1 className="mt-4 text-2xl font-bold">{phase.title}</h1>
            <p className="mt-2 max-w-sm text-slate">{phase.text}</p>
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
                <p className="max-w-sm">{phase.failed}</p>
                <p className="text-sm text-slate">Your answers are saved on this device.</p>
                <button className="btn btn-primary" onClick={() => submit(phase.quiz, store.get(phase.quiz.attemptId)?.answers || [])}>Retry submitting</button>
              </>
            ) : (
              <>
                <Spinner size={30} />
                <span className="text-slate">Scoring your answers…</span>
              </>
            )}
          </div>
        )}
        {phase.k === 'result' && <Result res={phase.res} target={phase.target} targetId={id} onSent={(score, name) => setPhase({ k: 'sent', score, name })} />}
        {phase.k === 'sent' && (
          <div className="flex flex-1 animate-rise flex-col items-center justify-center text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-cobalt text-white"><Send size={28} /></div>
            <h1 className="mt-6 text-3xl font-bold">Request sent</h1>
            <p className="mt-2 max-w-sm text-slate">
              {phase.name} will see your score of <b className="text-ink">{phase.score}%</b>. To accept, they’ll answer questions about you, and we’ll let you know when they do.
            </p>
            <div className="mt-8 flex gap-3">
              <Link to="/requests" className="btn btn-ghost">View sent</Link>
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
        <button onClick={() => setLeave(true)} aria-label="Leave" className="flex h-10 w-10 items-center justify-center rounded-xl border border-rule bg-card text-slate hover:text-ink"><X size={19} /></button>
        <Avatar src={quiz.target.photo} name={quiz.target.firstName} className="h-10 w-10" rounded="rounded-xl" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold">{quiz.purpose === 'accept' ? `How well do you know ${quiz.target.firstName}?` : `How well do you know ${quiz.target.firstName}?`}</div>
          <div className="text-sm text-slate">Question {i + 1} of {total}</div>
        </div>
        <div className={clsx('font-display text-2xl font-bold tabular-nums', pct > 0.25 ? 'text-ink' : 'text-wrong')} aria-label={`${left} seconds left`}>
          0:{String(left).padStart(2, '0')}
        </div>
      </div>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-rule" role="progressbar" aria-valuemin={0} aria-valuemax={quiz.secondsPerQuestion} aria-valuenow={left}>
        <div className={clsx('h-full origin-left transition-transform duration-1000 ease-linear', pct > 0.25 ? 'bg-cobalt' : 'bg-wrong')} style={{ transform: `scaleX(${pct})` }} />
      </div>

      <div key={i} className="flex flex-1 animate-rise flex-col justify-center py-10">
        <h1 className="text-[28px] font-semibold leading-snug sm:text-[32px]">{q.q}</h1>
        <div className="mt-8 space-y-2.5">
          {q.options.map((o, k) => (
            <button
              key={k}
              onClick={() => choose(k)}
              disabled={picked !== null}
              className={clsx(
                'flex w-full items-center gap-4 rounded-xl border px-4 py-4 text-left text-base font-medium transition-colors',
                picked === k ? 'border-cobalt bg-cobalt-soft' : 'border-rule bg-card hover:border-cobalt/50',
              )}
            >
              <span className={clsx('flex h-7 w-7 shrink-0 items-center justify-center rounded-md border text-xs font-semibold', picked === k ? 'border-cobalt bg-cobalt text-white' : 'border-rule bg-paper text-slate')}>
                {'ABCD'[k]}
              </span>
              {o}
            </button>
          ))}
        </div>
      </div>
      <p className="text-center text-sm text-slate">On a keyboard, press A to D. Answers are scored when you finish.</p>

      <Modal open={leave} onClose={() => setLeave(false)} title="Leave now?">
        <p className="text-slate">Your answers so far will be submitted and unanswered questions count as wrong.</p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button className="btn btn-ghost" onClick={() => setLeave(false)}>Keep going</button>
          <button className="btn btn-primary" onClick={() => { setLeave(false); finish(answers); }}>Submit now</button>
        </div>
      </Modal>
    </>
  );
}

function Result({ res, target, targetId, onSent }: { res: QuizResult; target: QuizStart['target'] | null; targetId: string; onSent: (score: number, name: string) => void }) {
  const [liked, setLiked] = useState('');
  const other = useQuery({ queryKey: ['user', targetId], queryFn: () => api.get<{ profile: Profile }>(`/users/${targetId}`), enabled: res.purpose === 'request' });
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [review, setReview] = useState(false);
  const name = target?.firstName || 'them';
  const msg = res.score === 100 ? 'A perfect score' : res.score >= 80 ? 'You were paying attention' : res.score >= 60 ? 'A solid result' : res.score >= 40 ? 'Some of it stuck' : 'A hard set of questions';

  const send = async () => {
    setBusy(true);
    try {
      await api.post('/requests', { attemptId: res.attemptId, note: note.trim(), likedPrompt: liked });
      ['requests', 'discover', 'user', 'me'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      onSent(res.score, name);
    } catch (e) {
      toast({ title: 'Request not sent', body: errMsg(e), tone: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-1 animate-rise flex-col items-center pt-10">
      {res.purpose === 'accept' && res.matchId ? (
        <div className="mb-6 rounded-full bg-right/10 px-4 py-1.5 text-sm font-semibold text-right">You’re connected with {name}</div>
      ) : null}
      <ScoreStamp score={res.score} label={`${res.correct} of ${res.total} correct`} />
      <h1 className="mt-6 text-center text-3xl font-bold">{msg}</h1>
      {res.purpose === 'request' && (
        <p className="mt-3 max-w-sm text-center text-slate">
          {res.meetsThreshold ? `${name} hoped for ${res.threshold}% or more. You cleared it.` : `${name} hoped for ${res.threshold}% or more. You can still send your request, and a thoughtful note helps.`}
        </p>
      )}

      <button onClick={() => setReview(!review)} className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-cobalt hover:underline">
        Review answers <ChevronDown size={16} className={clsx('transition', review && 'rotate-180')} />
      </button>
      {review && (
        <div className="mt-3 w-full space-y-3">
          {res.review.map((r, k) => (
            <div key={k} className="rounded-xl border border-rule bg-card p-4">
              <div className="text-sm font-semibold">{r.q}</div>
              <div className="mt-2 flex items-center gap-2 text-sm text-right"><Check size={15} /> {r.options[r.correctIndex]}</div>
              {r.yourIndex !== r.correctIndex && (
                <div className="mt-1 flex items-center gap-2 text-sm text-wrong"><X size={15} /> {r.yourIndex >= 0 ? r.options[r.yourIndex] : 'No answer'}</div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="mt-auto w-full pt-8">
        {res.purpose === 'request' ? (
          <>
            {other.data && other.data.profile.prompts.length > 0 && (
              <>
                <div className="label">Which of {name}’s answers did you like most? <span className="font-normal text-slate">(optional)</span></div>
                <div className="space-y-2">
                  {other.data.profile.prompts.map((p) => (
                    <button
                      key={p.q}
                      type="button"
                      onClick={() => setLiked(liked === p.q ? '' : p.q)}
                      className={clsx('w-full rounded-xl border p-3 text-left transition-colors', liked === p.q ? 'border-cobalt bg-cobalt-soft' : 'border-rule bg-card hover:border-cobalt/50')}
                    >
                      <div className="text-xs text-slate">{p.q}</div>
                      <div className="font-semibold">{p.a}</div>
                    </button>
                  ))}
                </div>
              </>
            )}
            <label className="label" htmlFor="note">Add a note <span className="font-normal text-slate">(optional)</span></label>
            <textarea id="note" className="input min-h-[90px] resize-none" maxLength={250} value={note} onChange={(e) => setNote(e.target.value)} placeholder={`Mention something from ${name}’s profile`} />
            <button className="btn btn-primary mt-4 w-full py-4 text-base" onClick={send} disabled={busy}>
              {busy ? <Spinner className="text-white" size={20} /> : <><Send size={18} /> Send request with {res.score}%</>}
            </button>
            <button className="btn btn-quiet mt-2 w-full" onClick={() => nav('/discover')}>Don’t send</button>
          </>
        ) : res.matchId ? (
          <button className="btn btn-primary w-full py-4 text-base" onClick={() => nav(`/chats/${res.matchId}`, { replace: true })}>Open chat</button>
        ) : (
          <button className="btn btn-ghost w-full" onClick={() => nav('/requests')}>Back to requests</button>
        )}
      </div>
    </div>
  );
}
