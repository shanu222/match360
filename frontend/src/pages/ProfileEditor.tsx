import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { ArrowLeft, EyeOff, ImagePlus, Loader2, Star, Trash2 } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import { makeBlurred, prepareImage } from '../lib/image';
import { fetchOwnPhoto, uploadBlob } from '../lib/upload';
import type { Me, MeResponse, Meta, Prompt } from '../lib/types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/Toast';
import { Logo } from '../components/Logo';
import { FullScreenLoader, Spinner, Toggle } from '../components/ui';
import { LocationFields } from '../components/LocationFields';

interface Photo { url: string; blurUrl: string }
interface Form {
  name: string; dob: string; gender: string; interestedIn: string;
  country: string; city: string; hometown: string;
  job: string; company: string; industry: string; educationLevel: string; education: string; languages: string;
  intent: string; interests: string[]; bio: string; heightCm: string;
  maritalStatus: string; children: string; religion: string; smoking: string; drinking: string;
  prompts: Prompt[]; photos: Photo[]; photoBlur: boolean; threshold: number;
}

export const useMeta = () => useQuery({ queryKey: ['meta'], queryFn: () => api.get<Meta>('/meta'), staleTime: Infinity });

const STEPS = ['Basics', 'Location', 'Work and education', 'About you', 'In your words'];
function maxDob() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d.toISOString().slice(0, 10);
}

export default function ProfileEditor({ mode }: { mode: 'onboarding' | 'edit' }) {
  const { me, fbUser, signOut } = useAuth();
  const metaQ = useMeta();
  if (!me || !metaQ.data) {
    if (metaQ.isError) return <div className="p-10 text-center">Couldn’t reach the server. <button className="font-semibold text-cobalt underline" onClick={() => metaQ.refetch()}>Retry</button></div>;
    return <FullScreenLoader />;
  }
  return <Editor mode={mode} user={me.user} meta={metaQ.data} defaultName={fbUser?.displayName || ''} onSignOut={signOut} />;
}

function Select({ id, value, onChange, options, placeholder = 'Select' }: { id: string; value: string; onChange: (v: string) => void; options: string[]; placeholder?: string }) {
  return (
    <select id={id} className={clsx('input', !value && 'text-slate/70')} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {options.map((o) => <option key={o} value={o} className="text-ink">{o}</option>)}
    </select>
  );
}
const Req = () => <span className="text-wrong" aria-hidden> *</span>;
const Opt = () => <span className="font-normal text-slate"> (optional)</span>;

function Editor({ mode, user, meta, defaultName, onSignOut }: { mode: 'onboarding' | 'edit'; user: Me; meta: Meta; defaultName: string; onSignOut: () => void }) {
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(0);
  const top = useRef<HTMLDivElement>(null);

  const initial = useMemo<Form>(() => {
    const prompts = [0, 1, 2].map((i) => user.prompts[i] || { q: meta.prompts[i], a: '' });
    return {
      name: user.name || defaultName, dob: user.dob || '', gender: user.gender || '', interestedIn: user.interestedIn || 'Everyone',
      country: user.country || '', city: user.city || '', hometown: user.hometown || '',
      job: user.job || '', company: user.company || '', industry: user.industry || '', educationLevel: user.educationLevel || '', education: user.education || '',
      languages: user.languages || 'Urdu, English',
      intent: user.intent || '', interests: user.interests || [], bio: user.bio || '', heightCm: user.heightCm ? String(user.heightCm) : '',
      maritalStatus: user.maritalStatus || '', children: user.children || '', religion: user.religion || '', smoking: user.smoking || '', drinking: user.drinking || '',
      prompts, photos: (user.photos || []).map((url, i) => ({ url, blurUrl: user.photosBlur?.[i] && user.photosBlur[i] !== url ? user.photosBlur[i] : '' })), photoBlur: user.photoBlur, threshold: user.threshold ?? 60,
    };
  }, [user, meta, defaultName]);
  const [f, setF] = useState<Form>(initial);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    top.current?.scrollIntoView({ block: 'start' });
  }, [step]);

  // Older photos may not have a blurred copy yet; make one so blur always works.
  useEffect(() => {
    const missing = f.photos.filter((p) => !p.blurUrl);
    if (!missing.length) return;
    let cancelled = false;
    (async () => {
      for (const p of missing) {
        try {
          const up = await uploadBlob('photo', await makeBlurred(await fetchOwnPhoto(p.url)));
          if (!cancelled && up.publicUrl) setF((x) => ({ ...x, photos: x.photos.map((y) => (y.url === p.url ? { ...y, blurUrl: up.publicUrl! } : y)) }));
        } catch {
          /* leave it; the server never shows a clear photo in place of a blurred one */
        }
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const list = Array.from(files).slice(0, meta.maxPhotos - f.photos.length);
    for (const file of list) {
      setUploading((n) => n + 1);
      try {
        const clear = await prepareImage(file);
        const blurred = await makeBlurred(clear);
        const [a, b] = await Promise.all([uploadBlob('photo', clear), uploadBlob('photo', blurred)]);
        setF((x) => ({ ...x, photos: [...x.photos, { url: a.publicUrl!, blurUrl: b.publicUrl! }].slice(0, meta.maxPhotos) }));
      } catch (e) {
        toast({ title: 'Photo not uploaded', body: errMsg(e), tone: 'error' });
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };

  const validate = (s: number): string => {
    if (s === 0) {
      if (f.name.trim().length < 2) return 'Enter your full name.';
      if (!f.dob) return 'Add your date of birth.';
      if (f.dob > maxDob()) return 'You must be 18 or older to use Match360.';
      if (!f.gender) return 'Choose your gender.';
    }
    if (s === 1) {
      if (!f.country) return 'Choose your country.';
      if (!f.city) return 'Choose your city.';
    }
    if (s === 2) {
      if (f.job.trim().length < 2) return 'Enter your job title. Students can write “Student”.';
      if (f.company.trim().length < 2) return 'Enter where you work or study. Write “Self-employed” if that applies.';
      if (!f.industry) return 'Choose your industry.';
      if (!f.educationLevel) return 'Choose your education level.';
      if (f.education.trim().length < 2) return 'Enter your school or university.';
      if (f.languages.trim().length < 2) return 'Add the languages you speak.';
    }
    if (s === 3) {
      if (!f.intent) return 'Choose what you’re looking for.';
      if (f.interests.length < 5) return 'Pick at least 5 interests.';
      if (f.bio.trim().length < 80) return `Write at least 80 characters about yourself (${f.bio.trim().length} so far).`;
      if (f.heightCm && (Number(f.heightCm) < 120 || Number(f.heightCm) > 230)) return 'Enter a height between 120 and 230 cm, or leave it empty.';
    }
    if (s === 4) {
      if (f.prompts.some((p) => p.a.trim().length < 3)) return 'Answer all three prompts.';
      if (new Set(f.prompts.map((p) => p.q)).size !== 3) return 'Choose a different question for each prompt.';
    }
    return '';
  };

  const next = async () => {
    const e = validate(step);
    setErr(e);
    if (e) return;
    if (step < STEPS.length - 1) return setStep(step + 1);
    if (uploading) return setErr('Wait for photos to finish uploading.');
    setSaving(true);
    try {
      const res = await api.put<{ user: Me; missing: string[] }>('/me', {
        ...f,
        name: f.name.trim(),
        heightCm: f.heightCm ? Number(f.heightCm) : null,
        prompts: f.prompts.map((p) => ({ q: p.q, a: p.a.trim() })),
      });
      qc.setQueryData<MeResponse>(['me'], (old) => (old ? { ...old, user: res.user, missing: res.missing } : old));
      qc.invalidateQueries({ queryKey: ['me'] });
      qc.invalidateQueries({ queryKey: ['discover'] });
      if (mode === 'onboarding') {
        toast({ title: `Welcome, ${res.user.firstName}`, body: 'Your profile is live.', tone: 'success' });
        nav('/discover', { replace: true });
      } else {
        toast({ title: 'Profile saved', tone: 'success' });
        nav('/me');
      }
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const toggleInterest = (i: string) => set('interests', f.interests.includes(i) ? f.interests.filter((x) => x !== i) : f.interests.length >= 12 ? f.interests : [...f.interests, i]);

  return (
    <div className={clsx('mx-auto w-full max-w-2xl', mode === 'onboarding' ? 'px-4 pb-36 pt-6 sm:px-6' : 'pb-36')} ref={top}>
      {mode === 'onboarding' && (
        <div className="mb-8 flex items-center justify-between">
          <Logo size={28} />
          <button onClick={onSignOut} className="text-sm font-medium text-slate hover:text-ink">Sign out</button>
        </div>
      )}
      <div className="mb-8 flex items-center gap-3">
        {(step > 0 || mode === 'edit') && (
          <button aria-label="Back" onClick={() => (step > 0 ? setStep(step - 1) : nav(-1))} className="flex h-10 w-10 items-center justify-center rounded-xl border border-rule bg-card">
            <ArrowLeft size={19} />
          </button>
        )}
        <div className="flex flex-1 gap-1.5" aria-hidden>
          {STEPS.map((_, i) => <span key={i} className={clsx('h-1.5 flex-1 rounded-full transition-colors', i <= step ? 'bg-cobalt' : 'bg-rule')} />)}
        </div>
        <span className="text-sm text-slate">Step {step + 1} of {STEPS.length}</span>
      </div>

      <h1 className="text-[32px] font-bold leading-tight">{STEPS[step]}</h1>

      {step === 0 && (
        <div className="animate-rise">
          <p className="mt-2 text-slate">Photos are optional. You can blur them so people only see them clearly after you connect.</p>
          <div className="mt-6 grid grid-cols-3 gap-3">
            {Array.from({ length: meta.maxPhotos }).map((_, i) => {
              const ph = f.photos[i];
              if (ph)
                return (
                  <div key={ph.url} className="relative aspect-[3/4] overflow-hidden rounded-xl border border-rule bg-rule">
                    <img src={f.photoBlur && ph.blurUrl ? ph.blurUrl : ph.url} alt="" className={clsx('h-full w-full object-cover', f.photoBlur && 'scale-110 blur-xl')} />
                    {i === 0 && <span className="absolute left-2 top-2 rounded-md bg-white px-2 py-0.5 text-[11px] font-semibold">Main</span>}
                    <div className="absolute inset-x-2 bottom-2 flex justify-end gap-1.5">
                      {i > 0 && (
                        <button aria-label="Make main photo" onClick={() => set('photos', [ph, ...f.photos.filter((x) => x !== ph)])} className="rounded-lg bg-white p-1.5 shadow-pop"><Star size={14} /></button>
                      )}
                      <button aria-label="Remove photo" onClick={() => set('photos', f.photos.filter((x) => x !== ph))} className="rounded-lg bg-white p-1.5 shadow-pop"><Trash2 size={14} /></button>
                    </div>
                  </div>
                );
              const isNext = i === f.photos.length;
              return (
                <label
                  key={`e${i}`}
                  className={clsx(
                    'flex aspect-[3/4] flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed text-slate transition-colors',
                    meta.uploadsEnabled && isNext ? 'cursor-pointer border-rule bg-card hover:border-cobalt hover:text-cobalt' : 'border-rule/70 bg-paper',
                  )}
                >
                  {isNext && uploading ? <Loader2 className="animate-spin" /> : <ImagePlus size={22} />}
                  {isNext && <span className="text-xs font-medium">{uploading ? 'Uploading' : 'Add photo'}</span>}
                  {meta.uploadsEnabled && isNext && (
                    <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="hidden" onChange={(e) => { upload(e.target.files); e.target.value = ''; }} />
                  )}
                </label>
              );
            })}
          </div>
          <div className="mt-4 flex items-center gap-4 rounded-xl border border-rule bg-card p-4">
            <EyeOff size={20} className="shrink-0 text-cobalt" />
            <div className="flex-1">
              <div className="font-semibold">Blur my photos</div>
              <div className="text-sm text-slate">Others see a blurred version until you’re connected.</div>
            </div>
            <Toggle label="Blur my photos" on={f.photoBlur} onChange={(v) => set('photoBlur', v)} />
          </div>

          <label className="label" htmlFor="name">Full name<Req /></label>
          <input id="name" className="input" value={f.name} maxLength={60} onChange={(e) => set('name', e.target.value)} autoComplete="name" />
          <div className="grid gap-x-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="dob">Date of birth<Req /></label>
              <input id="dob" type="date" className="input" value={f.dob} max={maxDob()} min="1920-01-01" onChange={(e) => set('dob', e.target.value)} />
              <p className="mt-1.5 text-xs text-slate">Only your age is shown.</p>
            </div>
            <div>
              <label className="label" htmlFor="gender">Gender<Req /></label>
              <Select id="gender" value={f.gender} onChange={(v) => set('gender', v)} options={meta.genders} />
            </div>
          </div>
          <label className="label" htmlFor="ii">Show me</label>
          <Select id="ii" value={f.interestedIn} onChange={(v) => set('interestedIn', v || 'Everyone')} options={meta.interestedIn} placeholder="Everyone" />
        </div>
      )}

      {step === 1 && (
        <div className="animate-rise">
          <p className="mt-2 text-slate">Your city is shown on your profile. If you share your location, others see only an approximate distance.</p>
          <div className="mt-6">
            <LocationFields country={f.country} city={f.city} onChange={(v) => setF((x) => ({ ...x, ...v }))} />
          </div>
          <label className="label" htmlFor="hometown">Hometown<Opt /></label>
          <input id="hometown" className="input" value={f.hometown} maxLength={80} onChange={(e) => set('hometown', e.target.value)} placeholder="Where you grew up" />
        </div>
      )}

      {step === 2 && (
        <div className="animate-rise">
          <p className="mt-2 text-slate">Real work and education details are required. They help people take you seriously.</p>
          <div className="grid gap-x-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="job">Job title<Req /></label>
              <input id="job" className="input" value={f.job} maxLength={60} onChange={(e) => set('job', e.target.value)} placeholder="e.g. Civil Engineer, Student" />
            </div>
            <div>
              <label className="label" htmlFor="company">Workplace<Req /></label>
              <input id="company" className="input" value={f.company} maxLength={80} onChange={(e) => set('company', e.target.value)} placeholder="Company, university or Self-employed" />
            </div>
          </div>
          <label className="label" htmlFor="industry">Industry<Req /></label>
          <Select id="industry" value={f.industry} onChange={(v) => set('industry', v)} options={meta.industries} />
          <div className="grid gap-x-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="edl">Education level<Req /></label>
              <Select id="edl" value={f.educationLevel} onChange={(v) => set('educationLevel', v)} options={meta.educationLevels} />
            </div>
            <div>
              <label className="label" htmlFor="edu">School or university<Req /></label>
              <input id="edu" className="input" value={f.education} maxLength={100} onChange={(e) => set('education', e.target.value)} />
            </div>
          </div>
          <label className="label" htmlFor="lang">Languages you speak<Req /></label>
          <input id="lang" className="input" value={f.languages} maxLength={120} onChange={(e) => set('languages', e.target.value)} placeholder="Urdu, English" />
        </div>
      )}

      {step === 3 && (
        <div className="animate-rise">
          <label className="label">I’m looking for<Req /></label>
          <div className="flex flex-wrap gap-2">
            {meta.intents.map((i) => <button key={i} type="button" onClick={() => set('intent', i)} className={clsx('chip px-4 py-2', f.intent === i && 'chip-on')}>{i}</button>)}
          </div>
          <label className="label">Interests<Req /> <span className="font-normal text-slate">Pick 5 to 12. {f.interests.length} selected.</span></label>
          <div className="flex flex-wrap gap-2">
            {meta.interests.map((i) => <button key={i} type="button" onClick={() => toggleInterest(i)} className={clsx('chip px-3.5 py-2', f.interests.includes(i) && 'chip-on')}>{i}</button>)}
          </div>
          <label className="label" htmlFor="bio">About me<Req /></label>
          <textarea id="bio" className="input min-h-[140px] resize-y" maxLength={600} value={f.bio} onChange={(e) => set('bio', e.target.value)} placeholder="What you do, what you care about, and what a good week looks like for you." />
          <div className={clsx('mt-1 text-right text-xs', f.bio.trim().length < 80 ? 'text-slate' : 'text-right')}>{f.bio.trim().length} of at least 80 characters</div>
          <div className="mt-2 grid gap-x-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="h">Height in cm<Opt /></label>
              <input id="h" inputMode="numeric" className="input" value={f.heightCm} onChange={(e) => set('heightCm', e.target.value.replace(/\D/g, '').slice(0, 3))} placeholder="e.g. 170" />
            </div>
            <div>
              <label className="label" htmlFor="ms">Marital status<Opt /></label>
              <Select id="ms" value={f.maritalStatus} onChange={(v) => set('maritalStatus', v)} options={meta.marital} />
            </div>
            <div>
              <label className="label" htmlFor="ch">Children<Opt /></label>
              <Select id="ch" value={f.children} onChange={(v) => set('children', v)} options={meta.children} />
            </div>
            <div>
              <label className="label" htmlFor="rel">Religion<Opt /></label>
              <Select id="rel" value={f.religion} onChange={(v) => set('religion', v)} options={meta.religions} />
            </div>
            <div>
              <label className="label" htmlFor="sm">Smoking<Opt /></label>
              <Select id="sm" value={f.smoking} onChange={(v) => set('smoking', v)} options={meta.smoking} />
            </div>
            <div>
              <label className="label" htmlFor="dr">Drinking<Opt /></label>
              <Select id="dr" value={f.drinking} onChange={(v) => set('drinking', v)} options={meta.drinking} />
            </div>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="animate-rise">
          <p className="mt-2 text-slate">Pick three prompts and answer them in your own words. Specific answers tell people far more than general ones.</p>
          {f.prompts.map((p, i) => (
            <div key={i} className="mt-5 rounded-xl border border-rule bg-card p-4">
              <label className="sr-only" htmlFor={`pq${i}`}>Prompt {i + 1}</label>
              <select
                id={`pq${i}`}
                className="w-full bg-transparent text-sm font-semibold text-cobalt outline-none"
                value={p.q}
                onChange={(e) => set('prompts', f.prompts.map((x, k) => (k === i ? { ...x, q: e.target.value } : x)))}
              >
                {meta.prompts.map((q) => <option key={q} value={q} disabled={f.prompts.some((x, k) => k !== i && x.q === q)}>{q}</option>)}
              </select>
              <input
                className="input mt-2.5"
                maxLength={120}
                value={p.a}
                aria-label={`Answer to ${p.q}`}
                placeholder="Your answer"
                onChange={(e) => set('prompts', f.prompts.map((x, k) => (k === i ? { ...x, a: e.target.value } : x)))}
              />
            </div>
          ))}
          <div className="mt-6 rounded-xl border border-rule bg-card p-5">
            <div className="flex items-center justify-between font-semibold">
              <span>Score you hope for</span>
              <span className="font-display text-xl">{f.threshold}%</span>
            </div>
            <input type="range" min={0} max={100} step={5} value={f.threshold} onChange={(e) => set('threshold', Number(e.target.value))} className="mt-3 w-full" aria-label="Score you hope for" />
            <p className="mt-1 text-sm text-slate">Requests below this are flagged for you. You always decide.</p>
          </div>
        </div>
      )}

      {err && <p role="alert" className="mt-6 rounded-xl bg-wrong/10 px-4 py-3 text-sm text-wrong">{err}</p>}

      <div className={clsx('fixed inset-x-0 bottom-0 z-20 border-t border-rule bg-paper/95 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 backdrop-blur', mode === 'edit' && 'lg:left-72')}>
        <div className="mx-auto max-w-2xl">
          <button onClick={next} disabled={saving} className="btn btn-primary w-full py-3.5 text-base">
            {saving ? <Spinner className="text-white" size={20} /> : step < STEPS.length - 1 ? 'Continue' : mode === 'onboarding' ? 'Finish profile' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
