import { useState } from 'react';
import clsx from 'clsx';
import {
  Baby, Briefcase, Building2, ChevronLeft, ChevronRight, Cigarette, EyeOff, GlassWater, GraduationCap, Heart, Home, Languages, MapPin, Navigation, Ruler, School, Sparkles,
} from 'lucide-react';
import type { Profile } from '../lib/types';
import { Avatar, Verified } from './ui';

export function PhotoCarousel({ p, className }: { p: Profile; className?: string }) {
  const [i, setI] = useState(0);
  const n = p.photos.length;
  return (
    <div className={clsx('relative overflow-hidden bg-rule', className)}>
      {n ? (
        <img
          src={p.photos[Math.min(i, n - 1)]}
          alt={p.photosBlurred ? `${p.firstName}’s photo, blurred` : p.name}
          className={clsx('h-full w-full object-cover', p.photosBlurred && 'scale-110 blur-2xl')}
          draggable={false}
          onContextMenu={(e) => p.photosBlurred && e.preventDefault()}
        />
      ) : (
        <Avatar name={p.name} className="h-full w-full" rounded="rounded-none" />
      )}
      {p.photosBlurred && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3.5 py-1.5 text-sm font-medium text-ink shadow-pop">
            <EyeOff size={15} /> Photos unblur when you connect
          </span>
        </div>
      )}
      {n > 1 && (
        <>
          <div className="absolute inset-x-3 top-3 flex gap-1.5">
            {p.photos.map((_, k) => <span key={k} className={clsx('h-1 flex-1 rounded-full', k === i ? 'bg-white' : 'bg-white/40')} />)}
          </div>
          <button aria-label="Previous photo" onClick={() => setI((i - 1 + n) % n)} className="absolute inset-y-0 left-0 flex w-1/3 items-center pl-2 opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100">
            <ChevronLeft className="rounded-full bg-white/90 p-1 text-ink" size={30} />
          </button>
          <button aria-label="Next photo" onClick={() => setI((i + 1) % n)} className="absolute inset-y-0 right-0 flex w-1/3 items-center justify-end pr-2 opacity-0 transition-opacity hover:opacity-100 focus-visible:opacity-100">
            <ChevronRight className="rounded-full bg-white/90 p-1 text-ink" size={30} />
          </button>
        </>
      )}
    </div>
  );
}

function Fact({ icon: Icon, children }: { icon: React.ComponentType<{ size?: number; className?: string }>; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-1.5">
      <Icon size={18} className="mt-0.5 shrink-0 text-slate" />
      <span>{children}</span>
    </div>
  );
}

function Section({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <div className="px-5 py-5">
      {title && <h4 className="mb-3 font-display text-lg font-semibold">{title}</h4>}
      {children}
    </div>
  );
}

const heightText = (cm: number) => {
  const inches = Math.round(cm / 2.54);
  return `${cm} cm (${Math.floor(inches / 12)}′${inches % 12}″)`;
};

export function ProfileView({ p, self = false, heroClass = 'h-[420px]' }: { p: Profile; self?: boolean; heroClass?: string }) {
  const lifestyle = [
    p.heightCm ? { icon: Ruler, text: heightText(p.heightCm) } : null,
    p.maritalStatus ? { icon: Heart, text: p.maritalStatus } : null,
    p.children ? { icon: Baby, text: p.children } : null,
    p.religion ? { icon: Sparkles, text: p.religion } : null,
    p.smoking ? { icon: Cigarette, text: `Smoking: ${p.smoking.toLowerCase()}` } : null,
    p.drinking ? { icon: GlassWater, text: `Drinking: ${p.drinking.toLowerCase()}` } : null,
  ].filter(Boolean) as { icon: any; text: string }[];

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
            <span className="inline-flex items-center gap-1.5"><MapPin size={14} />{p.city}{p.countryName ? `, ${p.countryName}` : ''}</span>
            {p.distanceKm != null && <span className="inline-flex items-center gap-1.5"><Navigation size={14} />About {p.distanceKm} km away</span>}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 px-5 pt-4">
        <span className="inline-flex rounded-full bg-cobalt-soft px-3 py-1 text-[13px] font-semibold text-cobalt">Looking for {p.intent.toLowerCase()}</span>
        {p.gender && <span className="inline-flex rounded-full border border-rule px-3 py-1 text-[13px] font-medium">{p.gender}</span>}
        {p.premium && <span className="inline-flex rounded-full bg-marker px-3 py-1 text-[13px] font-semibold">Premium</span>}
      </div>

      <div className="divide-y divide-rule">
        {p.bio && (
          <Section title="About">
            <p className="whitespace-pre-line leading-relaxed">{p.bio}</p>
          </Section>
        )}

        <Section title="Work and education">
          <Fact icon={Briefcase}>{p.job}</Fact>
          {p.company && <Fact icon={Building2}>{p.company}{p.industry ? `, ${p.industry}` : ''}</Fact>}
          {p.educationLevel && <Fact icon={GraduationCap}>{p.educationLevel}</Fact>}
          {p.education && <Fact icon={School}>{p.education}</Fact>}
        </Section>

        {p.prompts.length > 0 && (
          <Section title="In their own words">
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

        <Section title={`Interests${p.sharedInterests.length && !self ? ` (${p.sharedInterests.length} shared)` : ''}`}>
          <div className="flex flex-wrap gap-2">
            {p.interests.map((i) => <span key={i} className={clsx('chip', p.sharedInterests.includes(i) && 'chip-shared')}>{i}</span>)}
          </div>
        </Section>

        <Section title="Background">
          <Fact icon={MapPin}>Lives in {p.city}{p.countryName ? `, ${p.countryName}` : ''}</Fact>
          {p.hometown && <Fact icon={Home}>From {p.hometown}</Fact>}
          {p.languages && <Fact icon={Languages}>Speaks {p.languages}</Fact>}
        </Section>

        {lifestyle.length > 0 && (
          <Section title="Lifestyle">
            <div className="grid gap-x-6 sm:grid-cols-2">
              {lifestyle.map((x) => <Fact key={x.text} icon={x.icon}>{x.text}</Fact>)}
            </div>
          </Section>
        )}
      </div>
    </div>
  );
}
