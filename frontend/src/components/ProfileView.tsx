import { useState } from 'react';
import clsx from 'clsx';
import { Briefcase, ChevronLeft, ChevronRight, GraduationCap, Languages, MapPin, Zap } from 'lucide-react';
import type { Profile } from '../lib/types';
import { Avatar, Verified } from './ui';

export function PhotoCarousel({ p, className }: { p: Profile; className?: string }) {
  const [i, setI] = useState(0);
  const n = p.photos.length;
  return (
    <div className={clsx('relative overflow-hidden bg-paper', className)}>
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
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/70 to-transparent" />
        {!self && (
          <div className="absolute right-4 top-6 rounded-xl bg-white px-3 py-2 text-center shadow-pop">
            <div className="font-display text-lg font-bold leading-none text-ink">{p.compatibility}%</div>
            <div className="mt-0.5 text-[11px] font-medium text-slate">in common</div>
          </div>
        )}
        <div className="absolute inset-x-5 bottom-4 text-white">
          <div className="flex items-center gap-2 font-display text-[30px] font-bold leading-tight">
            <span className="truncate">{p.firstName}{p.age ? `, ${p.age}` : ''}</span>
            {p.verified && <Verified size={22} />}
            {p.activeRecently && !self && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-right ring-4 ring-white/25" title="Active now" />}
          </div>
          <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-white/90">
            <span className="inline-flex items-center gap-1.5"><Briefcase size={14} />{p.job}</span>
            <span className="inline-flex items-center gap-1.5"><MapPin size={14} />{p.city}</span>
          </div>
        </div>
      </div>
      <div className="px-5 pt-4">
        <span className="inline-flex rounded-full bg-cobalt-soft px-3 py-1 text-[13px] font-semibold text-cobalt">Looking for {p.intent.toLowerCase()}</span>
      </div>
      <div className="space-y-0 divide-y divide-rule">
        {p.bio && (
          <Section title="About">
            <p className="leading-relaxed">{p.bio}</p>
          </Section>
        )}
        {!self && (
          <Section>
            <div className="flex items-start gap-3 rounded-xl border border-marker bg-marker/25 p-3.5 text-sm leading-relaxed">
              <Zap size={18} className="mt-0.5 shrink-0 fill-ink" />
              <span>
                To connect, answer five questions about {p.firstName}. {p.firstName} hopes for <b>{p.threshold}% or more</b>. The profile is hidden while you answer.
              </span>
            </div>
          </Section>
        )}
        <Section title={`Interests${p.sharedInterests.length ? ` (${p.sharedInterests.length} shared)` : ''}`}>
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
                <div key={x.q} className="rounded-xl border border-rule p-4">
                  <div className="text-sm text-slate">{x.q}</div>
                  <div className="mt-1 font-display text-xl font-semibold leading-snug">{x.a}</div>
                </div>
              ))}
            </div>
          </Section>
        )}
        {(p.education || p.languages) && (
          <Section title="Details">
            <div className="space-y-2 text-[15px] text-slate">
              {p.education && <div className="flex items-center gap-2.5"><GraduationCap size={17} className="text-slate" />{p.education}</div>}
              {p.languages && <div className="flex items-center gap-2.5"><Languages size={17} className="text-slate" />{p.languages}</div>}
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
      {title && <h4 className="mb-3 text-sm font-semibold text-slate">{title}</h4>}
      {children}
    </div>
  );
}
