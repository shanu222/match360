import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Clock, MessageCircle, ShieldAlert } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import type { Profile, Relation } from '../lib/types';
import { ProfileView } from '../components/ProfileView';
import { ChallengeIntro } from '../components/ChallengeIntro';
import { SafetyModal } from '../components/SafetyMenu';
import { ErrorState, FullScreenLoader } from '../components/ui';

const MIN_READ_MS = 8_000;

/** Unlocks once the reader has reached the end of the profile and spent a few seconds on it. */
function useReadGate(enabled: boolean) {
  const end = useRef<HTMLDivElement>(null);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const started = Date.now();
    const t = setInterval(() => setElapsed(Date.now() - started), 250);
    return () => clearInterval(t);
  }, [enabled]);
  useEffect(() => {
    if (!enabled || !end.current) return;
    const io = new IntersectionObserver((e) => e.some((x) => x.isIntersecting) && setReachedEnd(true), { threshold: 0.5 });
    io.observe(end.current);
    return () => io.disconnect();
  });
  const timeOk = elapsed >= MIN_READ_MS;
  return { end, ready: reachedEnd && timeOk, reachedEnd, progress: Math.min(1, (reachedEnd ? 0.6 : 0) + Math.min(0.4, (elapsed / MIN_READ_MS) * 0.4)) };
}

export default function UserPage() {
  const { id = '' } = useParams();
  const [sp] = useSearchParams();
  const nav = useNavigate();
  const [intro, setIntro] = useState<null | 'request' | 'accept'>(null);
  const [safety, setSafety] = useState(false);
  const q = useQuery({ queryKey: ['user', id], queryFn: () => api.get<{ profile: Profile; relation: Relation }>(`/users/${id}`) });
  const r = q.data?.relation;
  const gated = Boolean(r && (r.type === 'none' || (r.type === 'received' && r.status === 'pending')));
  const gate = useReadGate(gated);

  useEffect(() => {
    if (sp.get('connect') || sp.get('accept')) window.scrollTo({ top: 0 });
  }, [sp]);

  if (q.isLoading) return <FullScreenLoader />;
  if (q.isError) return <ErrorState message={errMsg(q.error)} onRetry={() => q.refetch()} />;
  const p = q.data!.profile;
  const rel = q.data!.relation;

  const gatedButton = (purpose: 'request' | 'accept', label: string) => (
    <div>
      <button onClick={() => setIntro(purpose)} disabled={!gate.ready} className="btn btn-primary relative w-full overflow-hidden py-4 disabled:opacity-100">
        {!gate.ready && <span className="absolute inset-0 origin-left bg-cobalt-dark transition-transform duration-300" style={{ transform: `scaleX(${gate.progress})` }} />}
        <span className="relative">{gate.ready ? label : gate.reachedEnd ? 'Take a moment with the profile…' : `Read ${p.firstName}’s full profile to continue`}</span>
      </button>
    </div>
  );

  let cta: React.ReactNode;
  switch (rel.type) {
    case 'matched':
      cta = <Link to={`/chats/${rel.matchId}`} className="btn btn-primary w-full py-4"><MessageCircle size={19} /> Message {p.firstName}</Link>;
      break;
    case 'received':
      cta = rel.status === 'pending' ? gatedButton('accept', `Accept ${p.firstName}’s request`) : <div className="btn btn-ghost w-full cursor-default py-4">Request {rel.status}</div>;
      break;
    case 'sent':
      cta = <div className="btn btn-ghost w-full cursor-default py-4">{rel.status === 'pending' ? `Request sent. Waiting for ${p.firstName}.` : rel.status === 'declined' ? 'Not this time' : `Request ${rel.status}`}</div>;
      break;
    case 'ready_to_send':
      cta = <Link to={`/connect/${p.id}?purpose=request`} className="btn btn-primary w-full py-4">Finish sending your request</Link>;
      break;
    case 'in_progress':
      cta = <Link to={`/connect/${p.id}?purpose=request`} className="btn btn-primary w-full py-4">Continue where you left off</Link>;
      break;
    case 'cooldown':
      cta = <div className="btn btn-ghost w-full cursor-default py-4"><Clock size={18} /> You can try again {new Date(rel.retryAt).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</div>;
      break;
    default:
      cta = gatedButton('request', `Connect with ${p.firstName}`);
  }

  return (
    <div className="mx-auto max-w-xl pb-32 lg:pb-0">
      <div className="mb-4 flex items-center justify-between">
        <button onClick={() => nav(-1)} className="flex h-10 w-10 items-center justify-center rounded-xl border border-rule bg-card" aria-label="Back"><ArrowLeft size={19} /></button>
        <button onClick={() => setSafety(true)} className="btn btn-quiet px-3 py-2 text-sm"><ShieldAlert size={17} /> Report or block</button>
      </div>
      <div className="card overflow-hidden">
        <ProfileView p={p} heroClass="h-[min(70dvh,560px)]" />
        <div ref={gate.end} className="h-4" aria-hidden />
      </div>
      <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-20 border-t border-rule bg-paper/95 px-4 pb-3 pt-3 backdrop-blur lg:static lg:mt-5 lg:border-0 lg:bg-transparent lg:p-0">
        <div className="mx-auto max-w-xl">{cta}</div>
      </div>
      {intro && <ChallengeIntro open onClose={() => setIntro(null)} user={p} purpose={intro} theirScore={rel.type === 'received' ? rel.score : undefined} />}
      <SafetyModal open={safety} onClose={() => setSafety(false)} userId={p.id} name={p.firstName} />
    </div>
  );
}
