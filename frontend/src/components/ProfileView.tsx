import { useState } from 'react';
import clsx from 'clsx';
import { Briefcase, ChevronLeft, ChevronRight, GraduationCap, Languages, MapPin, Zap } from 'lucide-react';
import type { Profile } from '../lib/types';
import { Avatar, Verified } from './ui';

export function PhotoCarousel({ p, className }: { p: Profile; className?: string }) {
  const [i, setI] = useState(0);
  const n = p.photos.length;
  return (
    <div className={clsx('relative overflow-hidden bg-ink-800', className)}>
      {n ? (
        <img src={p.photos[Math.min(i, n - 1)]} alt={p.name} className="h-full w-full object-cover" draggable={false} />
      ) : (
        <Avatar name={p.name} className="h-full w-full" rounded="rounded-none" />
      )}
      {n > 1 && (
        <>
          <div className="absolute inset-x-3 top-3 flex gap-1.5">
            {p.photos.map((_, k) => (
              <span key={k} className={clsx('h-1 flex-1 rounded-full', k === i ? 'bg-white' : 'bg-white/35')} />
            ))}
          </div>
          <button aria-label="Previous photo" onClick={() => setI((i - 1 + n) % n)} className="absolute inset-y-0 left-0 flex w-1/3 items-center pl-2 opacity-0 transition hover:opacity-100">
            <ChevronLeft className="rounded-full bg-black/40 p-1" size={30} />
          </button>
          <button aria-label="Next photo" onClick={() => setI((i + 1) % n)} className="absolute inset-y-0 right-0 flex w-1/3 items-center justify-end pr-2 opacity-0 transition hover:opacity-100">
            <ChevronRight className="rounded-full bg-black/40 p-1" size={30} />
          </button>
        </>
      )}
    </div>
  );
}

export function ProfileView({ p, self = false, heroClass = 'h-[420px]' }: { p: Profile; self?: boolean; heroClass?: string }) {
  return (
    <div>
      <div className="relative">
        <PhotoCarousel p={p} className={heroClass} />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-ink-850" />
        <span className="absolute left-4 top-7 rounded-full bg-brand px-3 py-1 text-xs font-bold shadow-glow">{p.intent}</span>
        {!self && (
          <div className="absolute right-4 top-6 rounded-2xl border border-white/10 bg-ink-950/70 px-3 py-2 text-center backdrop-blur">
            <div className="text-base font-extrabold leading-none">{p.compatibility}%</div>
            <div className="mt-0.5 text-[10px] font-semibold text-ink-300">match</div>
          </div>
        )}
        <div className="absolute inset-x-5 bottom-4">
          <div className="flex items-center gap-2 text-[28px] font-extrabold leading-tight tracking-tight">
            <span className="truncate">{p.firstName}{p.age ? `, ${p.age}` : ''}</span>
            {p.verified && <Verified size={22} />}
            {p.activeRecently && !self && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-400 ring-4 ring-emerald-400/20" title="Active now" />}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-300">
            <span className="inline-flex items-center gap-1.5"><Briefcase size={14} />{p.job}</span>
            <span className="inline-flex items-center gap-1.5"><MapPin size={14} />{p.city}</span>
          </div>
        </div>
      </div>
      <div className="space-y-0 divide-y divide-ink-700">
        {p.bio && (
          <Section title="About">
            <p className="text-[15px] leading-relaxed text-ink-300">{p.bio}</p>
          </Section>
        )}
        {!self && (
          <Section>
            <div className="flex items-start gap-3 rounded-2xl border border-violet/35 bg-violet/10 p-3.5 text-[13px] leading-relaxed text-violet-100">
              <Zap size={18} className="mt-0.5 shrink-0 fill-violet-400 text-violet-400" />
              <span>
                To connect, take a 5-question challenge about {p.firstName}. {p.firstName} hopes for <b className="text-white">{p.threshold}%+</b>. The profile is hidden while you answer — read carefully.
              </span>
            </div>
          </Section>
        )}
        <Section title={`Interests${p.sharedInterests.length ? ` · ${p.sharedInterests.length} in common` : ''}`}>
          <div className="flex flex-wrap gap-2">
            {p.interests.map((i) => (
              <span key={i} className={clsx('chip', p.sharedInterests.includes(i) && 'chip-shared')}>{i}</span>
            ))}
          </div>
        </Section>
        {p.prompts.length > 0 && (
          <Section title="In their words">
            <div className="space-y-2.5">
              {p.prompts.map((x) => (
                <div key={x.q} className="rounded-2xl bg-ink-800 p-4">
                  <div className="text-xs font-semibold text-ink-400">{x.q}</div>
                  <div className="mt-1 text-[17px] font-semibold leading-snug">{x.a}</div>
                </div>
              ))}
            </div>
          </Section>
        )}
        {(p.education || p.languages) && (
          <Section title="Details">
            <div className="space-y-2 text-[15px] text-ink-300">
              {p.education && <div className="flex items-center gap-2.5"><GraduationCap size={17} className="text-ink-400" />{p.education}</div>}
              {p.languages && <div className="flex items-center gap-2.5"><Languages size={17} className="text-ink-400" />{p.languages}</div>}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}

function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="px-5 py-5">
      {title && <h4 className="mb-3 text-[11px] font-bold uppercase tracking-[.12em] text-ink-400">{title}</h4>}
      {children}
    </div>
  );
}
