import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Clock, MessageCircle, ShieldAlert, Zap } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import type { Profile, Relation } from '../lib/types';
import { ProfileView } from '../components/ProfileView';
import { ChallengeIntro } from '../components/ChallengeIntro';
import { SafetyModal } from '../components/SafetyMenu';
import { ErrorState, FullScreenLoader } from '../components/ui';

export default function UserPage() {
  const { id = '' } = useParams();
  const nav = useNavigate();
  const [intro, setIntro] = useState<null | 'request' | 'accept'>(null);
  const [safety, setSafety] = useState(false);
  const q = useQuery({ queryKey: ['user', id], queryFn: () => api.get<{ profile: Profile; relation: Relation }>(`/users/${id}`) });

  if (q.isLoading) return <FullScreenLoader />;
  if (q.isError) return <ErrorState message={errMsg(q.error)} onRetry={() => q.refetch()} />;
  const { profile: p, relation: r } = q.data!;

  let cta: React.ReactNode;
  switch (r.type) {
    case 'matched':
      cta = <Link to={`/chats/${r.matchId}`} className="btn btn-primary w-full py-4"><MessageCircle size={19} /> Message {p.firstName}</Link>;
      break;
    case 'received':
      cta =
        r.status === 'pending' ? (
          <button onClick={() => setIntro('accept')} className="btn btn-primary w-full py-4"><Zap size={19} className="fill-white" /> Accept via challenge</button>
        ) : (
          <div className="btn btn-ghost w-full cursor-default py-4">Request {r.status}</div>
        );
      break;
    case 'sent':
      cta = <div className="btn btn-ghost w-full cursor-default py-4">{r.status === 'pending' ? `Request sent with ${r.score}%. Waiting for ${p.firstName}.` : `Request ${r.status}`}</div>;
      break;
    case 'ready_to_send':
      cta = <Link to={`/challenge/${p.id}?purpose=request`} className="btn btn-primary w-full py-4">Send your request with {r.score}%</Link>;
      break;
    case 'in_progress':
      cta = <Link to={`/challenge/${p.id}?purpose=request`} className="btn btn-primary w-full py-4">Resume challenge</Link>;
      break;
    case 'cooldown':
      cta = <div className="btn btn-ghost w-full cursor-default py-4"><Clock size={18} /> Retake available {new Date(r.retryAt).toLocaleString([], { weekday: 'short', hour: 'numeric', minute: '2-digit' })}</div>;
      break;
    default:
      cta = <button onClick={() => setIntro('request')} className="btn btn-primary w-full py-4"><Zap size={19} className="fill-white" /> Take {p.firstName}’s challenge</button>;
  }

  return (
    <div className="mx-auto max-w-xl pb-24 lg:pb-0">
      <div className="mb-4 flex items-center justify-between">
        <button onClick={() => nav(-1)} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-rule bg-card" aria-label="Back"><ArrowLeft size={19} /></button>
        <button onClick={() => setSafety(true)} className="btn btn-quiet px-3 py-2 text-sm"><ShieldAlert size={17} /> Report or block</button>
      </div>
      <div className="card overflow-hidden">
        <ProfileView p={p} heroClass="h-[min(70dvh,560px)]" />
      </div>
      <div className="fixed inset-x-0 bottom-[calc(64px+env(safe-area-inset-bottom))] z-20 bg-gradient-to-t from-paper via-paper/95 to-transparent px-4 pb-3 pt-6 lg:static lg:mt-5 lg:bg-none lg:p-0">
        <div className="mx-auto max-w-xl">{cta}</div>
      </div>
      {intro && <ChallengeIntro open onClose={() => setIntro(null)} user={p} purpose={intro} theirScore={r.type === 'received' ? r.score : undefined} />}
      <SafetyModal open={safety} onClose={() => setSafety(false)} userId={p.id} name={p.firstName} />
    </div>
  );
}
