import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { BadgeCheck, Compass, Info, MapPin, RotateCcw, X, Zap } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import type { Profile } from '../lib/types';
import { useAuth } from '../context/AuthContext';
import { useMeta } from './ProfileEditor';
import { ProfileView } from '../components/ProfileView';
import { ChallengeIntro } from '../components/ChallengeIntro';
import { Avatar, EmptyState, ErrorState, Spinner } from '../components/ui';

export default function Discover() {
  const { me } = useAuth();
  const meta = useMeta();
  const qc = useQueryClient();
  const nav = useNavigate();
  const [intent, setIntent] = useState('All');
  const [nearby, setNearby] = useState(false);
  const [verified, setVerified] = useState(false);
  const [gone, setGone] = useState<string[]>([]);
  const [intro, setIntro] = useState<Profile | null>(null);

  const params = new URLSearchParams();
  if (intent !== 'All') params.set('intent', intent);
  if (nearby && me) params.set('city', me.user.city);
  if (verified) params.set('verified', '1');
  const key = ['discover', intent, nearby, verified];
  const q = useQuery({ queryKey: key, queryFn: () => api.get<{ profiles: Profile[] }>(`/discover?${params}`), staleTime: 60_000 });

  const list = (q.data?.profiles || []).filter((p) => !gone.includes(p.id));
  const cur = list[0];
  const nextP = list[1];

  const pass = useMutation({ mutationFn: (id: string) => api.post('/passes', { userId: id }) });
  const reset = useMutation({
    mutationFn: () => api.del('/passes'),
    onSuccess: () => {
      setGone([]);
      qc.invalidateQueries({ queryKey: ['discover'] });
    },
  });
  const doPass = (id: string) => {
    setGone((g) => [...g, id]);
    pass.mutate(id);
  };

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,460px)_1fr]">
      <div className="min-w-0">
        <div className="scroll-none -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <button onClick={() => setNearby(!nearby)} className={clsx('chip', nearby && 'chip-on')}><MapPin size={14} />Near me</button>
          <button onClick={() => setVerified(!verified)} className={clsx('chip', verified && 'chip-on')}><BadgeCheck size={14} />Verified</button>
          {['All', ...(meta.data?.intents || [])].map((i) => (
            <button key={i} onClick={() => setIntent(i)} className={clsx('chip', intent === i && 'chip-on')}>{i}</button>
          ))}
        </div>

        {q.isLoading ? (
          <div className="card flex h-[60dvh] items-center justify-center"><Spinner size={28} /></div>
        ) : q.isError ? (
          <ErrorState message={errMsg(q.error)} onRetry={() => q.refetch()} />
        ) : !cur ? (
          <EmptyState
            icon={<Compass size={34} />}
            title="You’re all caught up"
            text="New people join every day. Try a different filter, or take another look at profiles you passed."
            action={
              <button className="btn btn-ghost" onClick={() => reset.mutate()} disabled={reset.isPending}>
                <RotateCcw size={17} /> Show passed profiles
              </button>
            }
          />
        ) : (
          <>
            <div className="relative h-[calc(100dvh-340px)] min-h-[380px] lg:h-[calc(100dvh-230px)]">
              {nextP && (
                <div className="card absolute inset-0 translate-y-3 scale-[.96] overflow-hidden opacity-50" aria-hidden>
                  <ProfileView p={nextP} heroClass="h-[62%]" />
                </div>
              )}
              <SwipeCard key={cur.id} p={cur} onPass={() => doPass(cur.id)} onChallenge={() => setIntro(cur)} />
            </div>
            <div className="mt-5 flex items-center justify-center gap-5">
              <button aria-label="Pass" onClick={() => doPass(cur.id)} className="flex h-16 w-16 items-center justify-center rounded-full border border-ink-600 bg-ink-850 shadow-card transition hover:border-rose-400/60 active:scale-95">
                <X size={28} className="text-rose-400" />
              </button>
              <button aria-label="Take challenge" onClick={() => setIntro(cur)} className="flex h-20 w-20 items-center justify-center rounded-full bg-brand shadow-glow transition hover:brightness-110 active:scale-95">
                <Zap size={32} className="fill-white text-white" />
              </button>
              <button aria-label="View full profile" onClick={() => nav(`/u/${cur.id}`)} className="flex h-16 w-16 items-center justify-center rounded-full border border-ink-600 bg-ink-850 shadow-card transition hover:border-violet/60 active:scale-95">
                <Info size={26} className="text-violet-400" />
              </button>
            </div>
          </>
        )}
      </div>

      <aside className="hidden lg:block">
        <div className="sticky top-10 space-y-4">
          <div className="card p-6">
            <h3 className="text-lg font-extrabold">How to stand out</h3>
            <ol className="mt-4 space-y-3 text-[15px] leading-relaxed text-ink-300">
              <li><b className="text-white">1.</b> Read the whole profile — prompts are the trickiest questions.</li>
              <li><b className="text-white">2.</b> Take the challenge. Your score travels with your request.</li>
              <li><b className="text-white">3.</b> Add a personal note that references something specific.</li>
            </ol>
            <p className="mt-4 text-xs text-ink-400">Keyboard: ← pass · → challenge</p>
          </div>
          {list.length > 1 && (
            <div className="card p-5">
              <h3 className="mb-3 text-sm font-bold text-ink-300">Up next</h3>
              <div className="space-y-2">
                {list.slice(1, 6).map((p) => (
                  <button key={p.id} onClick={() => nav(`/u/${p.id}`)} className="flex w-full items-center gap-3 rounded-2xl p-2 text-left hover:bg-ink-800">
                    <Avatar src={p.photos[0]} name={p.name} className="h-11 w-11" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-bold">{p.firstName}{p.age ? `, ${p.age}` : ''}</div>
                      <div className="truncate text-xs text-ink-400">{p.job} · {p.city}</div>
                    </div>
                    <span className="text-xs font-bold text-ink-300">{p.compatibility}%</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>

      {intro && <ChallengeIntro open onClose={() => setIntro(null)} user={intro} purpose="request" />}
      <KeyNav enabled={Boolean(cur) && !intro} onLeft={() => cur && doPass(cur.id)} onRight={() => cur && setIntro(cur)} />
    </div>
  );
}

function KeyNav({ enabled, onLeft, onRight }: { enabled: boolean; onLeft: () => void; onRight: () => void }) {
  const ref = useRef({ onLeft, onRight });
  ref.current = { onLeft, onRight };
  useEffect(() => {
    if (!enabled) return;
    const h = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input,textarea,select')) return;
      if (e.key === 'ArrowLeft') ref.current.onLeft();
      if (e.key === 'ArrowRight') ref.current.onRight();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [enabled]);
  return null;
}

function SwipeCard({ p, onPass, onChallenge }: { p: Profile; onPass: () => void; onChallenge: () => void }) {
  const el = useRef<HTMLDivElement>(null);
  const st = useRef({ x: 0, y: 0, dx: 0, drag: false, horizontal: false });
  const [dx, setDx] = useState(0);
  const [leaving, setLeaving] = useState<0 | -1>(0);

  const down = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    st.current = { x: e.clientX, y: e.clientY, dx: 0, drag: true, horizontal: false };
  };
  const move = (e: React.PointerEvent) => {
    const s = st.current;
    if (!s.drag) return;
    const mx = e.clientX - s.x;
    const my = e.clientY - s.y;
    if (!s.horizontal) {
      if (Math.abs(mx) > 10 && Math.abs(mx) > Math.abs(my) * 1.3) {
        s.horizontal = true;
        el.current?.setPointerCapture(e.pointerId);
      } else if (Math.abs(my) > 10) {
        s.drag = false;
        return;
      } else return;
    }
    s.dx = mx;
    setDx(mx);
  };
  const up = () => {
    const s = st.current;
    if (!s.drag) return;
    s.drag = false;
    if (s.dx < -110) {
      setLeaving(-1);
      setTimeout(onPass, 220);
    } else {
      if (s.dx > 110) onChallenge();
      setDx(0);
    }
  };

  const x = leaving ? -window.innerWidth : dx;
  return (
    <div
      ref={el}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      className="card absolute inset-0 overflow-hidden shadow-card"
      style={{ transform: `translateX(${x}px) rotate(${x / 22}deg)`, transition: st.current.drag ? 'none' : 'transform .3s cubic-bezier(.2,.8,.2,1)', touchAction: 'pan-y' }}
    >
      <span className="pointer-events-none absolute right-6 top-24 z-10 rotate-12 rounded-xl border-4 border-rose-400 px-3 py-1 text-2xl font-extrabold tracking-widest text-rose-400" style={{ opacity: Math.max(0, -dx / 100) }}>PASS</span>
      <span className="pointer-events-none absolute left-6 top-24 z-10 -rotate-12 rounded-xl border-4 border-emerald-400 px-3 py-1 text-2xl font-extrabold tracking-widest text-emerald-400" style={{ opacity: Math.max(0, dx / 100) }}>CHALLENGE</span>
      <div className="scroll-none h-full overflow-y-auto">
        <ProfileView p={p} heroClass="h-[62dvh] max-h-[520px] min-h-[340px]" />
      </div>
    </div>
  );
}
