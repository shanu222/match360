import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import clsx from 'clsx';
import { AlertCircle, ArrowLeft, Check, CheckCheck, MessageCircle, MoreVertical, Search, SendHorizontal, ShieldAlert, UserRound, UserX } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import { clock, dayLabel, timeAgo, uid } from '../lib/format';
import { emitSocket, onSocket } from '../lib/socket';
import type { MatchItem, Message, Profile } from '../lib/types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/Toast';
import { SafetyModal } from '../components/SafetyMenu';
import { Avatar, EmptyState, ErrorState, Modal, Spinner, Verified } from '../components/ui';

type Pages = InfiniteData<{ messages: Message[]; hasMore: boolean }, number | null>;

export default function Chats() {
  const { id } = useParams();
  return (
    <div className={clsx('lg:grid lg:h-[calc(100dvh-5.5rem)] lg:grid-cols-[340px_1fr] lg:gap-5', id ? 'h-dvh' : '')}>
      <div className={clsx('min-h-0', id && 'hidden lg:block')}>
        <ChatList activeId={id} />
      </div>
      <div className={clsx('h-full min-h-0', !id && 'hidden lg:block')}>
        {id ? (
          <Conversation key={id} matchId={id} />
        ) : (
          <div className="card hidden h-full items-center justify-center lg:flex">
            <EmptyState icon={<MessageCircle size={32} />} title="Your conversations" text="Pick a chat on the left. Only people who passed each other’s challenge can message here." />
          </div>
        )}
      </div>
    </div>
  );
}

function ChatList({ activeId }: { activeId?: string }) {
  const [term, setTerm] = useState('');
  const q = useQuery({ queryKey: ['matches'], queryFn: () => api.get<{ matches: MatchItem[] }>('/matches'), refetchInterval: 60_000 });
  const list = (q.data?.matches || []).filter((m) => m.user.name.toLowerCase().includes(term.trim().toLowerCase()));

  return (
    <div className="flex h-full flex-col">
      <h1 className="text-3xl font-extrabold tracking-tight">Chats</h1>
      <p className="mt-1 text-ink-400">People you’ve connected with.</p>
      {q.isLoading ? (
        <div className="flex justify-center py-16"><Spinner size={28} /></div>
      ) : q.isError ? (
        <ErrorState message={errMsg(q.error)} onRetry={() => q.refetch()} />
      ) : !q.data!.matches.length ? (
        <EmptyState icon={<MessageCircle size={32} />} title="No connections yet" text="Chats unlock once you and someone else pass each other’s challenge." action={<Link to="/discover" className="btn btn-primary">Find people</Link>} />
      ) : (
        <>
          <div className="relative mt-5">
            <Search size={17} className="absolute left-4 top-1/2 -translate-y-1/2 text-ink-400" />
            <input className="input pl-11" placeholder="Search connections" value={term} onChange={(e) => setTerm(e.target.value)} />
          </div>
          <div className="scroll-none mt-4 flex gap-4 overflow-x-auto pb-2 lg:hidden">
            {q.data!.matches.filter((m) => !m.lastMessage).map((m) => (
              <Link key={m.id} to={`/chats/${m.id}`} className="w-16 shrink-0 text-center">
                <Avatar src={m.user.photos[0]} name={m.user.name} className="mx-auto h-16 w-16 ring-2 ring-coral ring-offset-2 ring-offset-ink-950" rounded="rounded-full" />
                <div className="mt-1.5 truncate text-xs font-semibold">{m.user.firstName}</div>
              </Link>
            ))}
          </div>
          <div className="scroll-none mt-2 min-h-0 flex-1 space-y-1.5 overflow-y-auto pb-4">
            {list.map((m) => (
              <Link
                key={m.id}
                to={`/chats/${m.id}`}
                className={clsx('flex items-center gap-3.5 rounded-2xl p-3 transition', activeId === m.id ? 'bg-ink-800' : 'hover:bg-ink-850')}
              >
                <div className="relative">
                  <Avatar src={m.user.photos[0]} name={m.user.name} className="h-14 w-14" />
                  {m.user.activeRecently && <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-ink-950 bg-emerald-400" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate font-bold">{m.user.name}</span>
                    <span className="shrink-0 text-xs text-ink-400">{timeAgo(m.lastMessage?.at || m.connectedAt)}</span>
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-2">
                    <span className={clsx('truncate text-sm', m.unread ? 'font-semibold text-white' : 'text-ink-400')}>
                      {m.lastMessage ? `${m.lastMessage.fromMe ? 'You: ' : ''}${m.lastMessage.body}` : 'New connection — say hi 👋'}
                    </span>
                    {m.unread > 0 && <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-coral px-1.5 text-[11px] font-bold">{m.unread}</span>}
                  </div>
                </div>
              </Link>
            ))}
            {!list.length && <p className="py-8 text-center text-sm text-ink-400">No matches for “{term}”.</p>}
          </div>
        </>
      )}
    </div>
  );
}

function icebreakers(p: Profile) {
  const out: string[] = [];
  if (p.sharedInterests[0]) out.push(`We both love ${p.sharedInterests[0].toLowerCase()} — how did you get into it?`);
  if (p.prompts[0]) out.push(`“${p.prompts[0].a}” sounds great. Tell me more!`);
  if (p.prompts[1]) out.push(`I’m curious about ${p.prompts[1].q.toLowerCase()}: ${p.prompts[1].a}. Why that?`);
  out.push('Which question in my challenge was the hardest for you?');
  return out.slice(0, 4);
}

function Conversation({ matchId }: { matchId: string }) {
  const { me } = useAuth();
  const myId = me!.user.id;
  const qc = useQueryClient();
  const nav = useNavigate();
  const toast = useToast();
  const [text, setText] = useState('');
  const [typing, setTyping] = useState(false);
  const [menu, setMenu] = useState(false);
  const [unmatch, setUnmatch] = useState(false);
  const [safety, setSafety] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const atBottom = useRef(true);
  const lastTypingSent = useRef(0);

  const info = useQuery({
    queryKey: ['match', matchId],
    queryFn: () => api.get<{ id: string; user: Profile; scores: { mine: number | null; theirs: number | null }; online: boolean }>(`/matches/${matchId}`),
  });
  const msgs = useInfiniteQuery({
    queryKey: ['messages', matchId],
    initialPageParam: null as number | null,
    queryFn: ({ pageParam }) => api.get<{ messages: Message[]; hasMore: boolean }>(`/matches/${matchId}/messages${pageParam ? `?before=${pageParam}` : ''}`),
    getNextPageParam: () => undefined,
    getPreviousPageParam: (first) => (first.hasMore && first.messages[0] ? first.messages[0].id : undefined),
    enabled: info.isSuccess,
    refetchOnWindowFocus: false,
  });
  const all = useMemo(() => msgs.data?.pages.flatMap((p) => p.messages) || [], [msgs.data]);
  const other = info.data?.user;

  // Mark as read whenever new incoming messages are visible.
  const lastIncoming = [...all].reverse().find((m) => m.sender_id !== myId && !m.read_at)?.id;
  useEffect(() => {
    if (!lastIncoming || document.hidden) return;
    api
      .post(`/matches/${matchId}/read`)
      .then(() => {
        qc.invalidateQueries({ queryKey: ['counts'] });
        qc.invalidateQueries({ queryKey: ['matches'] });
      })
      .catch(() => {});
  }, [lastIncoming, matchId, qc]);

  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const off = onSocket('typing', (p: { matchId: string }) => {
      if (p.matchId !== matchId) return;
      setTyping(true);
      clearTimeout(t);
      t = setTimeout(() => setTyping(false), 3500);
    });
    const offMsg = onSocket('message', (m: Message & { match_id: string }) => {
      if (m.match_id === matchId && m.sender_id !== myId) setTyping(false);
    });
    return () => {
      off();
      offMsg();
      clearTimeout(t);
    };
  }, [matchId, myId]);

  // Scroll handling: stick to bottom for new messages, preserve position when loading older.
  const prevHeight = useRef(0);
  const prevFirst = useRef<number | undefined>(undefined);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const first = all[0]?.id;
    if (prevFirst.current !== undefined && first !== prevFirst.current && prevHeight.current) {
      el.scrollTop = el.scrollHeight - prevHeight.current + el.scrollTop;
    } else if (atBottom.current) {
      el.scrollTop = el.scrollHeight;
    }
    prevFirst.current = first;
    prevHeight.current = el.scrollHeight;
  }, [all, typing]);

  const onScroll = () => {
    const el = box.current;
    if (!el) return;
    atBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    prevHeight.current = el.scrollHeight;
    if (el.scrollTop < 60 && msgs.hasPreviousPage && !msgs.isFetchingPreviousPage) msgs.fetchPreviousPage();
  };

  const patch = (fn: (m: Message) => Message) =>
    qc.setQueryData<Pages>(['messages', matchId], (old) => (old ? { ...old, pages: old.pages.map((p) => ({ ...p, messages: p.messages.map(fn) })) } : old));

  const deliver = async (body: string, clientId: string) => {
    try {
      const r = await api.post<{ message: Message }>(`/matches/${matchId}/messages`, { body, clientId });
      patch((m) => (m.client_id === clientId ? { ...r.message, pending: false, failed: false } : m));
      qc.invalidateQueries({ queryKey: ['matches'] });
    } catch (e) {
      patch((m) => (m.client_id === clientId ? { ...m, pending: false, failed: true } : m));
      toast({ title: 'Message not sent', body: errMsg(e), tone: 'error' });
    }
  };

  const send = (raw?: string) => {
    const body = (raw ?? text).trim();
    if (!body || body.length > 2000) return;
    const clientId = uid();
    const temp: Message = { id: -Date.now(), sender_id: myId, body, client_id: clientId, created_at: new Date().toISOString(), read_at: null, pending: true };
    qc.setQueryData<Pages>(['messages', matchId], (old) => {
      if (!old) return old;
      const pages = [...old.pages];
      const last = pages[pages.length - 1];
      pages[pages.length - 1] = { ...last, messages: [...last.messages, temp] };
      return { ...old, pages };
    });
    atBottom.current = true;
    if (raw === undefined) setText('');
    input.current?.focus();
    deliver(body, clientId);
  };

  const retry = (m: Message) => {
    patch((x) => (x.client_id === m.client_id ? { ...x, failed: false, pending: true } : x));
    deliver(m.body, m.client_id!);
  };

  const onType = (v: string) => {
    setText(v);
    if (other && Date.now() - lastTypingSent.current > 2500) {
      lastTypingSent.current = Date.now();
      emitSocket('typing', { matchId, to: other.id });
    }
  };

  const doUnmatch = useMutation({
    mutationFn: () => api.post(`/matches/${matchId}/unmatch`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['matches'] });
      toast({ title: 'Unmatched', tone: 'success' });
      nav('/chats', { replace: true });
    },
    onError: (e) => toast({ title: 'Couldn’t unmatch', body: errMsg(e), tone: 'error' }),
  });

  if (info.isError)
    return (
      <div className="flex h-full flex-col items-center justify-center p-6">
        <ErrorState message={errMsg(info.error)} />
        <Link to="/chats" className="btn btn-ghost">Back to chats</Link>
      </div>
    );

  const myCount = all.filter((m) => m.sender_id === myId).length;
  const lastMine = [...all].reverse().find((m) => m.sender_id === myId);

  return (
    <div className="flex h-full flex-col bg-ink-950 lg:card lg:overflow-hidden">
      <header className="flex items-center gap-3 border-b border-ink-700/70 px-3 pb-3 pt-[calc(.75rem+env(safe-area-inset-top))] lg:px-5 lg:pt-4">
        <Link to="/chats" aria-label="Back" className="flex h-10 w-10 items-center justify-center rounded-2xl text-ink-300 hover:bg-ink-800 lg:hidden"><ArrowLeft size={20} /></Link>
        {other ? (
          <Link to={`/u/${other.id}`} className="flex min-w-0 flex-1 items-center gap-3">
            <Avatar src={other.photos[0]} name={other.name} className="h-11 w-11" />
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 font-bold"><span className="truncate">{other.name}</span>{other.verified && <Verified size={16} />}</div>
              <div className={clsx('text-xs', typing ? 'text-violet-300' : info.data?.online || other.activeRecently ? 'text-emerald-300' : 'text-ink-400')}>
                {typing ? 'typing…' : info.data?.online || other.activeRecently ? 'Active now' : `Active ${timeAgo(other.lastSeen)} ago`}
              </div>
            </div>
          </Link>
        ) : (
          <div className="flex-1"><Spinner /></div>
        )}
        <div className="relative">
          <button aria-label="Conversation options" onClick={() => setMenu(!menu)} className="flex h-10 w-10 items-center justify-center rounded-2xl text-ink-300 hover:bg-ink-800"><MoreVertical size={20} /></button>
          {menu && other && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setMenu(false)} />
              <div className="absolute right-0 top-12 z-40 w-56 animate-pop overflow-hidden rounded-2xl border border-ink-700 bg-ink-850 py-1.5 shadow-card">
                <button onClick={() => nav(`/u/${other.id}`)} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold hover:bg-ink-800"><UserRound size={17} /> View profile</button>
                <button onClick={() => { setMenu(false); setUnmatch(true); }} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold hover:bg-ink-800"><UserX size={17} /> Unmatch</button>
                <button onClick={() => { setMenu(false); setSafety(true); }} className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-semibold text-rose-300 hover:bg-ink-800"><ShieldAlert size={17} /> Report or block</button>
              </div>
            </>
          )}
        </div>
      </header>

      {info.data && (
        <div className="grid grid-cols-2 gap-2 border-b border-ink-700/70 px-3 py-2.5 text-center text-xs text-ink-400 lg:px-5">
          <div className="rounded-xl bg-ink-850 py-1.5"><b className="text-base text-white">{info.data.scores.mine ?? '–'}%</b> you on {other?.firstName}</div>
          <div className="rounded-xl bg-ink-850 py-1.5"><b className="text-base text-white">{info.data.scores.theirs ?? '–'}%</b> {other?.firstName} on you</div>
        </div>
      )}

      <div ref={box} onScroll={onScroll} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4 lg:px-5">
        {msgs.isFetchingPreviousPage && <div className="flex justify-center py-2"><Spinner size={18} /></div>}
        {msgs.isLoading || info.isLoading ? (
          <div className="flex h-full items-center justify-center"><Spinner size={26} /></div>
        ) : msgs.isError ? (
          <ErrorState message={errMsg(msgs.error)} onRetry={() => msgs.refetch()} />
        ) : (
          <>
            {!msgs.hasPreviousPage && other && (
              <div className="mx-auto mb-6 mt-2 max-w-xs text-center">
                <Avatar src={other.photos[0]} name={other.name} className="mx-auto h-20 w-20" rounded="rounded-full" />
                <div className="mt-3 font-bold">You and {other.firstName} are connected 🎉</div>
                <div className="mt-1 text-sm text-ink-400">You both passed each other’s challenge. Be kind and be yourself.</div>
              </div>
            )}
            {all.map((m, k) => {
              const mine = m.sender_id === myId;
              const prev = all[k - 1];
              const newDay = !prev || new Date(prev.created_at).toDateString() !== new Date(m.created_at).toDateString();
              const grouped = prev && prev.sender_id === m.sender_id && !newDay && new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 120_000;
              return (
                <Fragment key={m.client_id || m.id}>
                  {newDay && <div className="my-4 text-center text-xs font-semibold text-ink-400">{dayLabel(m.created_at)}</div>}
                  <div className={clsx('flex', mine ? 'justify-end' : 'justify-start', grouped ? 'mt-1' : 'mt-3')}>
                    <div
                      className={clsx(
                        'max-w-[80%] whitespace-pre-wrap break-words rounded-3xl px-4 py-2.5 text-[15px] leading-relaxed sm:max-w-[70%]',
                        mine ? 'rounded-br-lg bg-brand text-white' : 'rounded-bl-lg border border-ink-700 bg-ink-850',
                        m.failed && 'opacity-60',
                      )}
                    >
                      {m.body}
                      <div className={clsx('mt-1 flex items-center justify-end gap-1 text-[10px]', mine ? 'text-white/75' : 'text-ink-400')}>
                        {clock(m.created_at)}
                        {mine && (m.pending ? <Spinner size={10} className="text-white/75" /> : m.read_at ? <CheckCheck size={13} /> : !m.failed && <Check size={13} />)}
                      </div>
                    </div>
                  </div>
                  {m.failed && (
                    <button onClick={() => retry(m)} className="ml-auto mt-1 flex items-center gap-1 text-xs font-semibold text-rose-300">
                      <AlertCircle size={13} /> Not sent · tap to retry
                    </button>
                  )}
                </Fragment>
              );
            })}
            {lastMine?.read_at && all[all.length - 1]?.id === lastMine.id && <div className="mt-1 text-right text-[11px] text-ink-400">Seen</div>}
            {typing && (
              <div className="mt-3 flex w-fit gap-1 rounded-3xl rounded-bl-lg border border-ink-700 bg-ink-850 px-4 py-3.5">
                {[0, 1, 2].map((d) => <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-ink-400" style={{ animationDelay: `${d * 0.15}s` }} />)}
              </div>
            )}
          </>
        )}
      </div>

      {other && myCount < 2 && msgs.isSuccess && (
        <div className="scroll-none flex gap-2 overflow-x-auto px-3 pb-1 lg:px-5">
          {icebreakers(other).map((t) => (
            <button key={t} onClick={() => send(t)} className="max-w-[260px] shrink-0 rounded-2xl border border-violet/35 bg-violet/10 px-3.5 py-2 text-left text-[13px] font-semibold text-violet-100 hover:bg-violet/20">
              {t}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="flex items-end gap-2.5 px-3 pb-[calc(.75rem+env(safe-area-inset-bottom))] pt-2.5 lg:px-5 lg:pb-4"
      >
        <textarea
          ref={input}
          rows={1}
          value={text}
          maxLength={2000}
          onChange={(e) => onType(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              send();
            }
          }}
          placeholder={other ? `Message ${other.firstName}…` : 'Message…'}
          className="input max-h-36 min-h-[48px] flex-1 resize-none rounded-3xl py-3"
          style={{ fieldSizing: 'content' } as React.CSSProperties}
        />
        <button type="submit" disabled={!text.trim()} aria-label="Send" className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand shadow-glow transition disabled:opacity-40">
          <SendHorizontal size={20} />
        </button>
      </form>

      <Modal open={unmatch} onClose={() => setUnmatch(false)} title={`Unmatch ${other?.firstName}?`}>
        <p className="text-ink-300">This ends the conversation for both of you. It can’t be undone.</p>
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button className="btn btn-ghost" onClick={() => setUnmatch(false)}>Cancel</button>
          <button className="btn btn-danger" disabled={doUnmatch.isPending} onClick={() => doUnmatch.mutate()}>Unmatch</button>
        </div>
      </Modal>
      {other && <SafetyModal open={safety} onClose={() => setSafety(false)} userId={other.id} name={other.firstName} />}
    </div>
  );
}
