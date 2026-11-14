import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { BadgeCheck, BookOpen, Compass, LocateFixed, RotateCcw, SlidersHorizontal, X } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import type { Profile } from '../lib/types';
import { useAuth } from '../context/AuthContext';
import { useMeta } from './ProfileEditor';
import { ProfileView } from '../components/ProfileView';
import { ChallengeIntro } from '../components/ChallengeIntro';
import { Avatar, EmptyState, ErrorState, Modal, Spinner } from '../components/ui';
import { Combobox } from '../components/LocationFields';
import { AdSlot } from '../components/AdSlot';
import { countryLabel as withFlag, flagOf, getPosition, useCities, useCountries } from '../lib/geo';
import { useToast } from '../context/Toast';

function CityPicker({ country, value, onChange }: { country: string; value: string; onChange: (v: string) => void }) {
  const [term, setTerm] = useState('');
  const cities = useCities(country, term);
  const opts = [{ value: '', label: 'Any city' }, ...(cities.data?.cities || []).map((c) => ({ value: c, label: c }))];
  return <Combobox value={value} onChange={onChange} options={opts} onSearch={setTerm} loading={cities.isFetching} placeholder="Any city" />;
}

const DISTANCES = [10, 25, 50, 100, 250, 500];

export default function Discover() {
  const { me, refetchMe } = useAuth();
  const meta = useMeta();
  const countries = useCountries();
  const qc = useQueryClient();
  const nav = useNavigate();
  const toast = useToast();
  const [intent, setIntent] = useState('All');
  const [country, setCountry] = useState(me?.user.country || '');
  const [city, setCity] = useState('');
  const [km, setKm] = useState(0);
  const [verified, setVerified] = useState(false);
  const [online, setOnline] = useState(false);
  const [gone, setGone] = useState<string[]>([]);
  const [intro, setIntro] = useState<Profile | null>(null);
  const [filters, setFilters] = useState(false);
  const [locating, setLocating] = useState(false);

  const params = new URLSearchParams();
  if (intent !== 'All') params.set('intent', intent);
  if (km) params.set('km', String(km));
  else {
    if (country) params.set('country', country);
    if (country && city) params.set('city', city);
  }
  if (verified) params.set('verified', '1');
  if (online) params.set('online', '1');
  const key = ['discover', intent, country, city, km, verified, online];
  const q = useQuery({ queryKey: key, queryFn: () => api.get<{ profiles: Profile[]; onlineCount?: number }>(`/discover?${params}`), staleTime: 60_000 });

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

  const nearMe = async () => {
    if (km) return setKm(0);
    if (!me?.user.hasLocation) {
      setLocating(true);
      try {
        const pos = await getPosition();
        await api.post('/me/location', pos);
        refetchMe();
      } catch (e) {
        toast({ title: 'Location not shared', body: errMsg(e), tone: 'error' });
        return;
      } finally {
        setLocating(false);
      }
    }
    setKm(50);
  };
  const countryLabel = km ? `Within ${km} km` : country ? `${flagOf(countries.data, country)} ${countries.data?.find((c) => c.code === country)?.name || country}${city ? `, ${city}` : ''}`.trim() : 'Anywhere';
  const onlineCount = q.data?.onlineCount || 0;

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,460px)_1fr]">
      <div className="min-w-0">
        {/* Filters wrap onto more lines on narrow screens, so nothing is ever cut off or needs sideways scrolling. */}
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button onClick={() => setFilters(true)} className="chip max-w-full"><SlidersHorizontal size={14} className="shrink-0" /><span className="truncate">{countryLabel}</span></button>
          <button onClick={nearMe} disabled={locating} className={clsx('chip', km > 0 && 'chip-on')}>{locating ? <Spinner size={14} /> : <LocateFixed size={14} />}Near me</button>
          <button onClick={() => setVerified(!verified)} aria-pressed={verified} className={clsx('chip', verified && 'chip-on')}><BadgeCheck size={14} />Verified</button>
          <button onClick={() => setOnline(!online)} aria-pressed={online} className={clsx('chip', online && 'chip-on')}><span className="h-2 w-2 rounded-full bg-right" />Online</button>
          <select aria-label="Looking for" value={intent} onChange={(e) => setIntent(e.target.value)} className={clsx('chip max-w-full cursor-pointer py-[7px] pr-2 outline-none', intent !== 'All' && 'chip-on')}>
            <option value="All">Looking for: anything</option>
            {(meta.data?.intents || []).map((i) => <option key={i} value={i}>{i}</option>)}
          </select>
        </div>
        {onlineCount > 0 && (
          <p className="mb-3 flex items-center gap-2 text-sm text-slate"><span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-right opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-right" /></span>{onlineCount === 1 ? '1 person is online now' : `${onlineCount.toLocaleString()} people are online now`}</p>
        )}

        <Modal open={filters} onClose={() => setFilters(false)} title="Filters">
          <label className="label">Where</label>
          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setKm(0)} className={clsx('chip justify-center py-2', !km && 'chip-on')}>Country or city</button>
            <button onClick={() => (me?.user.hasLocation ? setKm(km || 50) : nearMe())} className={clsx('chip justify-center py-2', km > 0 && 'chip-on')}>Distance from me</button>
          </div>
          {km > 0 ? (
            <>
              <label className="label">Maximum distance</label>
              <div className="flex flex-wrap gap-2">
                {DISTANCES.map((d) => <button key={d} onClick={() => setKm(d)} className={clsx('chip', km === d && 'chip-on')}>{d} km</button>)}
              </div>
            </>
          ) : (
            <>
              <label className="label">Country</label>
              <Combobox value={country} onChange={(v) => { setCountry(v); setCity(''); }} options={[{ value: '', label: 'Anywhere' }, ...(countries.data || []).map((c) => ({ value: c.code, label: withFlag(c) }))]} placeholder="Anywhere" />
              {country && (
                <>
                  <label className="label">City <span className="font-normal text-slate">(optional)</span></label>
                  <CityPicker country={country} value={city} onChange={setCity} />
                </>
              )}
            </>
          )}
          <button className="btn btn-primary mt-6 w-full" onClick={() => setFilters(false)}>Show people</button>
        </Modal>

        {q.isLoading ? (
          <div className="card flex h-[60dvh] items-center justify-center"><Spinner size={28} /></div>
        ) : q.isError ? (
          <ErrorState message={errMsg(q.error)} onRetry={() => q.refetch()} />
        ) : !cur ? (
          <EmptyState
            icon={<Compass size={34} />}
            title="You’re all caught up"
            text="New people join every day. Try a wider area or a different filter, or look again at profiles you passed."
            action={
              <button className="btn btn-ghost" onClick={() => reset.mutate()} disabled={reset.isPending}>
                <RotateCcw size={17} /> Show passed profiles
              </button>
            }
          />
        ) : (
          <>
            <div className="relative h-[calc(100dvh-340px-var(--ad-h,0px))] min-h-[380px] lg:h-[calc(100dvh-230px)]">
              {nextP && (
                <div className="card absolute inset-0 translate-y-3 scale-[.96] overflow-hidden opacity-50" aria-hidden>
                  <ProfileView p={nextP} heroClass="h-[62%]" />
                </div>
              )}
              <SwipeCard key={cur.id} p={cur} onPass={() => doPass(cur.id)} onChallenge={() => nav(`/u/${cur.id}?connect=1`)} />
            </div>
            <div className="mt-5 flex items-center justify-center gap-5">
              <button aria-label="Pass" onClick={() => doPass(cur.id)} className="flex h-16 w-16 items-center justify-center rounded-full border border-rule bg-card shadow-lift transition hover:border-wrong/40 active:scale-95">
                <X size={28} className="text-wrong" />
              </button>
              <button aria-label={`Read ${cur.firstName}’s profile and connect`} onClick={() => nav(`/u/${cur.id}?connect=1`)} className="flex h-16 items-center justify-center gap-2 rounded-full bg-cobalt px-7 font-semibold text-white transition hover:bg-cobalt-dark active:scale-95">
                <BookOpen size={20} /> Read and connect
              </button>
              
            </div>
          </>
        )}
      </div>

      <aside className="hidden lg:block">
        <div className="sticky top-10 space-y-4">
          <AdSlot slot="slotDiscover" />
          <div className="card p-6">
            <h3 className="text-lg font-bold">How to stand out</h3>
            <ol className="mt-4 space-y-3 text-[15px] leading-relaxed text-slate">
              <li><b className="text-ink">1.</b> Read the whole profile carefully. Questions can come from any part of it.</li>
              <li><b className="text-ink">2.</b> Answer a few quick questions about them. They see how well you listened.</li>
              <li><b className="text-ink">3.</b> Add a note that mentions something specific about them.</li>
            </ol>
            <p className="mt-4 text-xs text-slate">Use the left arrow to pass and the right arrow to open a profile.</p>
          </div>
          {list.length > 1 && (
            <div className="card p-5">
              <h3 className="mb-3 text-sm font-semibold text-slate">Today’s picks for you</h3>
              <div className="space-y-2">
                {[...list].sort((a, b) => b.compatibility - a.compatibility).slice(0, 5).map((p) => (
                  <button key={p.id} onClick={() => nav(`/u/${p.id}`)} className="flex w-full items-center gap-3 rounded-2xl p-2 text-left hover:bg-paper">
                    <Avatar src={p.photos[0]} name={p.name} className="h-11 w-11" />
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-bold">{p.firstName}{p.age ? `, ${p.age}` : ''}</div>
                      <div className="truncate text-xs text-slate">{p.job}, {p.city}</div>
                    </div>
                    <span className="text-xs font-bold text-slate">{p.compatibility}%</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </aside>

      {intro && <ChallengeIntro open onClose={() => setIntro(null)} user={intro} purpose="request" />}
      <KeyNav enabled={Boolean(cur) && !intro} onLeft={() => cur && doPass(cur.id)} onRight={() => cur && nav(`/u/${cur.id}?connect=1`)} />
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
      className="card absolute inset-0 overflow-hidden shadow-lift"
      style={{ transform: `translateX(${x}px) rotate(${x / 22}deg)`, transition: st.current.drag ? 'none' : 'transform .3s cubic-bezier(.2,.8,.2,1)', touchAction: 'pan-y' }}
    >
      <span className="pointer-events-none absolute right-6 top-24 z-10 rotate-12 rounded-xl border-4 border-wrong/40 px-3 py-1 text-2xl font-bold tracking-widest text-wrong" style={{ opacity: Math.max(0, -dx / 100) }}>PASS</span>
      <span className="pointer-events-none absolute left-6 top-24 z-10 -rotate-12 rounded-xl border-4 border-right px-3 py-1 text-2xl font-bold tracking-widest text-right" style={{ opacity: Math.max(0, dx / 100) }}>CONNECT</span>
      <div className="scroll-none h-full overflow-y-auto">
        <ProfileView p={p} heroClass="h-[62dvh] max-h-[520px] min-h-[340px]" />
      </div>
    </div>
  );
}
