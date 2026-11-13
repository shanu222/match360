import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Inbox, MessageCircle, Send, Zap } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import { scoreTone, timeAgo } from '../lib/format';
import type { RequestItem } from '../lib/types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/Toast';
import { ChallengeIntro } from '../components/ChallengeIntro';
import { Avatar, EmptyState, ErrorState, Modal, Spinner, Verified } from '../components/ui';

export default function Challenges() {
  const [tab, setTab] = useState<'received' | 'sent'>('received');
  const q = useQuery({ queryKey: ['requests'], queryFn: () => api.get<{ received: RequestItem[]; sent: RequestItem[] }>('/requests'), refetchInterval: 60_000 });
  const pending = q.data?.received.filter((r) => r.status === 'pending').length || 0;

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="text-3xl font-extrabold tracking-tight">Challenges</h1>
      <p className="mt-1 text-ink-400">Every connection here was earned with a score.</p>
      <div className="mt-6 grid grid-cols-2 rounded-2xl border border-ink-700 bg-ink-850 p-1">
        {(['received', 'sent'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)} className={clsx('rounded-xl py-2.5 text-sm font-bold capitalize transition', tab === t ? 'bg-brand text-white' : 'text-ink-400 hover:text-white')}>
            {t}
            {t === 'received' && pending ? ` (${pending})` : t === 'sent' && q.data ? ` (${q.data.sent.length})` : ''}
          </button>
        ))}
      </div>
      <div className="mt-5">
        {q.isLoading ? (
          <div className="flex justify-center py-16"><Spinner size={28} /></div>
        ) : q.isError ? (
          <ErrorState message={errMsg(q.error)} onRetry={() => q.refetch()} />
        ) : tab === 'received' ? (
          q.data!.received.length ? (
            <div className="space-y-3">{q.data!.received.map((r) => <Received key={r.id} r={r} />)}</div>
          ) : (
            <EmptyState icon={<Inbox size={32} />} title="No requests yet" text="When someone takes your challenge, their score and request appear here. A complete profile with great prompts attracts more." action={<Link to="/me" className="btn btn-ghost">Improve my profile</Link>} />
          )
        ) : q.data!.sent.length ? (
          <div className="space-y-3">{q.data!.sent.map((r) => <Sent key={r.id} r={r} />)}</div>
        ) : (
          <EmptyState icon={<Send size={30} />} title="No challenges sent" text="Find someone interesting and prove you paid attention." action={<Link to="/discover" className="btn btn-primary">Discover people</Link>} />
        )}
      </div>
    </div>
  );
}

function Received({ r }: { r: RequestItem }) {
  const { me } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const nav = useNavigate();
  const [intro, setIntro] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const decline = useMutation({
    mutationFn: () => api.post(`/requests/${r.id}/decline`),
    onSuccess: () => {
      setConfirm(false);
      qc.invalidateQueries({ queryKey: ['requests'] });
      qc.invalidateQueries({ queryKey: ['counts'] });
    },
    onError: (e) => toast({ title: 'Couldn’t decline', body: errMsg(e), tone: 'error' }),
  });
  const bar = me?.user.threshold ?? 0;
  const u = r.user;
  return (
    <div className={clsx('card p-4 sm:p-5', r.status !== 'pending' && 'opacity-80')}>
      <div className="flex items-center gap-4">
        <button onClick={() => nav(`/u/${u.id}`)} className="shrink-0"><Avatar src={u.photos[0]} name={u.name} className="h-14 w-14" /></button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 font-bold">
            <span className="truncate">{u.firstName}{u.age ? `, ${u.age}` : ''}</span>
            {u.verified && <Verified size={16} />}
          </div>
          <div className="truncate text-sm text-ink-400">{u.job} · {u.city}</div>
        </div>
        <span className={clsx('rounded-full px-3 py-1.5 text-sm font-extrabold', scoreTone(r.senderScore))}>⚡ {r.senderScore}%</span>
      </div>
      <p className="mt-3 text-sm text-ink-400">
        Scored <b className="text-white">{r.senderScore}%</b> on your challenge {r.senderScore >= bar ? `— above your ${bar}% bar ✅` : `— below your ${bar}% bar`} · {timeAgo(r.createdAt)}
      </p>
      {r.note && <p className="mt-3 rounded-2xl bg-ink-800 px-4 py-3 text-[15px] leading-relaxed text-ink-300">“{r.note}”</p>}
      {r.status === 'pending' ? (
        <div className="mt-4 grid grid-cols-[1fr_1.6fr] gap-2.5">
          <button className="btn btn-ghost py-3" onClick={() => setConfirm(true)}>Decline</button>
          <button className="btn btn-primary py-3" onClick={() => setIntro(true)}><Zap size={17} className="fill-white" /> Accept via quiz</button>
        </div>
      ) : r.status === 'accepted' ? (
        <div className="mt-4 flex items-center justify-between">
          <span className="text-sm font-semibold text-emerald-300">Connected · you scored {r.receiverScore}%</span>
          <Link to="/chats" className="btn btn-ghost px-4 py-2 text-sm"><MessageCircle size={16} /> Chats</Link>
        </div>
      ) : (
        <div className="mt-4 text-sm font-semibold capitalize text-ink-400">{r.status}</div>
      )}
      {intro && <ChallengeIntro open onClose={() => setIntro(false)} user={u} purpose="accept" theirScore={r.senderScore} />}
      <Modal open={confirm} onClose={() => setConfirm(false)} title={`Decline ${u.firstName}?`}>
        <p className="text-ink-300">They won’t be notified directly — their request will simply show as not accepted.</p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button className="btn btn-ghost" onClick={() => setConfirm(false)}>Cancel</button>
          <button className="btn btn-danger" disabled={decline.isPending} onClick={() => decline.mutate()}>{decline.isPending ? <Spinner size={18} /> : 'Decline'}</button>
        </div>
      </Modal>
    </div>
  );
}

function Sent({ r }: { r: RequestItem }) {
  const qc = useQueryClient();
  const toast = useToast();
  const nav = useNavigate();
  const cancel = useMutation({
    mutationFn: () => api.post(`/requests/${r.id}/cancel`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['requests'] }),
    onError: (e) => toast({ title: 'Couldn’t cancel', body: errMsg(e), tone: 'error' }),
  });
  const u = r.user;
  const label =
    r.status === 'pending'
      ? `Waiting for ${u.firstName} to take your quiz`
      : r.status === 'accepted'
        ? `${u.firstName} scored ${r.receiverScore}% on you — connected!`
        : r.status === 'declined'
          ? 'Not this time'
          : r.status === 'cancelled'
            ? 'You cancelled this request'
            : 'Connection ended';
  return (
    <div className="card flex items-center gap-4 p-4">
      <button onClick={() => nav(`/u/${u.id}`)} className="shrink-0"><Avatar src={u.photos[0]} name={u.name} className="h-14 w-14" /></button>
      <div className="min-w-0 flex-1">
        <div className="truncate font-bold">{u.name}</div>
        <div className="truncate text-sm text-ink-400">{label}</div>
        {r.status === 'pending' && (
          <button onClick={() => cancel.mutate()} disabled={cancel.isPending} className="mt-1 text-xs font-semibold text-ink-400 hover:text-rose-300">Cancel request</button>
        )}
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <span className={clsx('rounded-full px-2.5 py-1 text-xs font-extrabold', scoreTone(r.senderScore))}>{r.senderScore}%</span>
        <span className={clsx('rounded-full px-2.5 py-1 text-[11px] font-bold capitalize', r.status === 'accepted' ? 'bg-emerald-500/15 text-emerald-300' : r.status === 'pending' ? 'bg-amber-400/15 text-amber-200' : 'bg-ink-700 text-ink-400')}>{r.status}</span>
      </div>
    </div>
  );
}
