import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { ArrowLeft, ImagePlus, Loader2, Star, Trash2 } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import { prepareImage } from '../lib/image';
import type { Me, MeResponse, Meta, Prompt } from '../lib/types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/Toast';
import { Logo } from '../components/Logo';
import { FullScreenLoader, Spinner } from '../components/ui';

interface Form {
  name: string;
  dob: string;
  city: string;
  job: string;
  education: string;
  languages: string;
  intent: string;
  interests: string[];
  bio: string;
  prompts: Prompt[];
  photos: string[];
  threshold: number;
}

export const useMeta = () => useQuery({ queryKey: ['meta'], queryFn: () => api.get<Meta>('/meta'), staleTime: Infinity });

function maxDob() {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 18);
  return d.toISOString().slice(0, 10);
}

export default function ProfileEditor({ mode }: { mode: 'onboarding' | 'edit' }) {
  const { me, fbUser, signOut } = useAuth();
  const metaQ = useMeta();
  if (!me || !metaQ.data) {
    if (metaQ.isError) return <div className="p-10 text-center text-slate">Couldn’t reach the server. <button className="underline" onClick={() => metaQ.refetch()}>Retry</button></div>;
    return <FullScreenLoader />;
  }
  return <Editor mode={mode} user={me.user} meta={metaQ.data} defaultName={fbUser?.displayName || ''} onSignOut={signOut} />;
}

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
    const prompts = meta.prompts.slice(0, 3).map((q, i) => user.prompts[i] || { q, a: '' });
    return {
      name: user.name || defaultName,
      dob: user.dob || '',
      city: user.city || '',
      job: user.job || '',
      education: user.education || '',
      languages: user.languages || 'Urdu, English',
      intent: user.intent || meta.intents[0],
      interests: user.interests || [],
      bio: user.bio || '',
      prompts,
      photos: user.photos || [],
      threshold: user.threshold ?? 60,
    };
  }, [user, meta, defaultName]);
  const [f, setF] = useState<Form>(initial);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setF((x) => ({ ...x, [k]: v }));

  useEffect(() => {
    top.current?.scrollIntoView({ block: 'start' });
  }, [step]);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    const room = meta.maxPhotos - f.photos.length;
    const list = Array.from(files).slice(0, room);
    for (const file of list) {
      setUploading((n) => n + 1);
      try {
        const blob = await prepareImage(file);
        const s = await api.post<{ uploadUrl: string; publicUrl: string }>('/uploads/sign', { contentType: 'image/jpeg', size: blob.size });
        const put = await fetch(s.uploadUrl, { method: 'PUT', headers: { 'Content-Type': 'image/jpeg' }, body: blob });
        if (!put.ok) throw new Error('Upload failed. Please try again.');
        setF((x) => ({ ...x, photos: [...x.photos, s.publicUrl].slice(0, meta.maxPhotos) }));
      } catch (e) {
        toast({ title: 'Photo not uploaded', body: errMsg(e), tone: 'error' });
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };

  const validate = (s: number) => {
    if (s === 0) {
      if (f.name.trim().length < 2) return 'Please enter your name.';
      if (!f.dob) return 'Please add your date of birth.';
      if (f.dob > maxDob()) return 'You must be 18 or older to use Match360.';
      if (!f.city.trim()) return 'Please choose your city.';
      if (f.job.trim().length < 2) return 'Tell people what you do.';
    }
    if (s === 1 && f.interests.length < 3) return 'Pick at least 3 interests.';
    if (s === 2) {
      if (f.prompts.filter((p) => p.a.trim()).length < 2) return 'Answer at least two prompts. They become your challenge questions.';
      const qs = f.prompts.map((p) => p.q);
      if (new Set(qs).size !== qs.length) return 'Choose a different question for each prompt.';
    }
    return '';
  };

  const next = async () => {
    const e = validate(step);
    setErr(e);
    if (e) return;
    if (step < 2) return setStep(step + 1);
    if (uploading) return setErr('Please wait for photos to finish uploading.');
    setSaving(true);
    try {
      const res = await api.put<{ user: Me }>('/me', {
        ...f,
        name: f.name.trim(),
        prompts: f.prompts.filter((p) => p.a.trim()).map((p) => ({ q: p.q, a: p.a.trim() })),
      });
      qc.setQueryData<MeResponse>(['me'], (old) => (old ? { ...old, user: res.user } : old));
      qc.invalidateQueries({ queryKey: ['me'] });
      qc.invalidateQueries({ queryKey: ['discover'] });
      if (mode === 'onboarding') {
        toast({ title: `Welcome, ${res.user.firstName}`, body: 'Your profile is live.', tone: 'success' });
        nav('/discover', { replace: true });
      } else {
        toast({ title: 'Profile saved', body: 'New challenges will use your latest answers.', tone: 'success' });
        nav('/me');
      }
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const toggleInterest = (i: string) =>
    set('interests', f.interests.includes(i) ? f.interests.filter((x) => x !== i) : f.interests.length >= 10 ? f.interests : [...f.interests, i]);

  return (
    <div className={clsx('mx-auto w-full max-w-2xl', mode === 'onboarding' ? 'px-4 pb-32 pt-6 sm:px-6' : 'pb-32')} ref={top}>
      {mode === 'onboarding' && (
        <div className="mb-6 flex items-center justify-between">
          <Logo size={30} />
          <button onClick={onSignOut} className="text-sm font-semibold text-slate hover:text-ink">Sign out</button>
        </div>
      )}
      <div className="mb-6 flex items-center gap-3">
        {(step > 0 || mode === 'edit') && (
          <button aria-label="Back" onClick={() => (step > 0 ? setStep(step - 1) : nav(-1))} className="flex h-10 w-10 items-center justify-center rounded-2xl border border-rule bg-card">
            <ArrowLeft size={19} />
          </button>
        )}
        <div className="flex flex-1 gap-2">
          {[0, 1, 2].map((i) => (
            <span key={i} className={clsx('h-1.5 flex-1 rounded-full transition', i <= step ? 'bg-cobalt' : 'bg-rule')} />
          ))}
        </div>
        <span className="text-xs font-bold text-slate">{step + 1}/3</span>
      </div>

      {step === 0 && (
        <div className="animate-rise">
          <h1 className="text-3xl font-bold tracking-tight">{mode === 'onboarding' ? 'Let’s set up your profile' : 'Edit your profile'}</h1>
          <p className="mt-2 text-slate">Clear, recent photos get far more challenge requests.</p>

          <div className="mt-6 grid grid-cols-3 gap-3">
            {Array.from({ length: meta.maxPhotos }).map((_, i) => {
              const url = f.photos[i];
              if (url)
                return (
                  <div key={url} className="group relative aspect-[3/4] overflow-hidden rounded-2xl border border-rule bg-paper">
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    {i === 0 && <span className="absolute left-2 top-2 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-bold backdrop-blur">Main</span>}
                    <div className="absolute inset-x-2 bottom-2 flex justify-end gap-1.5">
                      {i > 0 && (
                        <button aria-label="Make main photo" onClick={() => set('photos', [url, ...f.photos.filter((x) => x !== url)])} className="rounded-lg bg-black/60 p-1.5 backdrop-blur">
                          <Star size={14} />
                        </button>
                      )}
                      <button aria-label="Remove photo" onClick={() => set('photos', f.photos.filter((x) => x !== url))} className="rounded-lg bg-black/60 p-1.5 backdrop-blur">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                );
              const isNext = i === f.photos.length;
              return (
                <label
                  key={`e${i}`}
                  className={clsx(
                    'flex aspect-[3/4] flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed text-slate transition',
                    meta.uploadsEnabled && isNext ? 'cursor-pointer border-rule bg-card hover:border-cobalt/40 hover:text-ink' : 'border-rule bg-card opacity-60',
                  )}
                >
                  {isNext && uploading ? <Loader2 className="animate-spin" /> : <ImagePlus size={22} />}
                  {isNext && <span className="text-[11px] font-semibold">{uploading ? 'Uploading' : 'Add photo'}</span>}
                  {meta.uploadsEnabled && isNext && (
                    <input type="file" accept="image/jpeg,image/png,image/webp,image/heic" multiple className="hidden" onChange={(e) => { upload(e.target.files); e.target.value = ''; }} />
                  )}
                </label>
              );
            })}
          </div>
          {!meta.uploadsEnabled && <p className="mt-3 text-xs text-slate">Photo uploads will be available once storage is configured. Your initials are used for now.</p>}

          <label className="label" htmlFor="name">Full name</label>
          <input id="name" className="input" value={f.name} maxLength={60} onChange={(e) => set('name', e.target.value)} placeholder="Your name" autoComplete="name" />
          <div className="grid gap-x-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="dob">Date of birth</label>
              <input id="dob" type="date" className="input" value={f.dob} max={maxDob()} min="1920-01-01" onChange={(e) => set('dob', e.target.value)} />
              <p className="mt-1.5 text-xs text-slate">Only your age is shown.</p>
            </div>
            <div>
              <label className="label" htmlFor="city">City</label>
              <select id="city" className="input" value={f.city} onChange={(e) => set('city', e.target.value)}>
                <option value="">Select city</option>
                {meta.cities.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <label className="label" htmlFor="job">What do you do?</label>
          <input id="job" className="input" value={f.job} maxLength={60} onChange={(e) => set('job', e.target.value)} placeholder="e.g. Software Engineer, Student, Doctor" />
          <div className="grid gap-x-3 sm:grid-cols-2">
            <div>
              <label className="label" htmlFor="edu">Education <span className="font-normal text-slate">(optional)</span></label>
              <input id="edu" className="input" value={f.education} maxLength={80} onChange={(e) => set('education', e.target.value)} placeholder="University or school" />
            </div>
            <div>
              <label className="label" htmlFor="lang">Languages</label>
              <input id="lang" className="input" value={f.languages} maxLength={100} onChange={(e) => set('languages', e.target.value)} placeholder="Urdu, English" />
            </div>
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="animate-rise">
          <h1 className="text-3xl font-bold tracking-tight">What brings you here?</h1>
          <p className="mt-2 text-slate">This shapes who you see and what your challenge asks.</p>
          <label className="label">I’m looking for</label>
          <div className="flex flex-wrap gap-2">
            {meta.intents.map((i) => (
              <button key={i} onClick={() => set('intent', i)} className={clsx('chip px-4 py-2', f.intent === i && 'chip-on')}>{i}</button>
            ))}
          </div>
          <label className="label">Interests <span className="font-normal text-slate">· pick 3–10 ({f.interests.length} selected)</span></label>
          <div className="flex flex-wrap gap-2">
            {meta.interests.map((i) => (
              <button key={i} onClick={() => toggleInterest(i)} className={clsx('chip px-4 py-2', f.interests.includes(i) && 'chip-on')}>{i}</button>
            ))}
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="animate-rise">
          <h1 className="text-3xl font-bold tracking-tight">Your story</h1>
          <p className="mt-2 text-slate">Your answers become the questions people must answer to reach you. Be specific and genuine.</p>
          {f.prompts.map((p, i) => (
            <div key={i} className="mt-5 rounded-2xl border border-rule bg-card p-4">
              <select
                aria-label={`Prompt ${i + 1}`}
                className="w-full bg-transparent text-sm font-bold text-slate outline-none"
                value={p.q}
                onChange={(e) => set('prompts', f.prompts.map((x, k) => (k === i ? { ...x, q: e.target.value } : x)))}
              >
                {meta.prompts.map((q) => <option key={q} value={q} className="bg-card">{q}</option>)}
              </select>
              <input
                className="input mt-2.5"
                maxLength={100}
                value={p.a}
                placeholder={i < 2 ? 'Your answer' : 'Your answer (optional)'}
                onChange={(e) => set('prompts', f.prompts.map((x, k) => (k === i ? { ...x, a: e.target.value } : x)))}
              />
            </div>
          ))}
          <label className="label" htmlFor="bio">Short bio <span className="font-normal text-slate">(optional)</span></label>
          <textarea id="bio" className="input min-h-[96px] resize-none" maxLength={300} value={f.bio} onChange={(e) => set('bio', e.target.value)} placeholder="A line or two that sums you up" />
          <div className="mt-1 text-right text-xs text-slate">{f.bio.length}/300</div>
          <div className="mt-4 rounded-2xl border border-rule bg-card p-5">
            <div className="flex items-center justify-between font-bold">
              <span>Your challenge bar</span>
              <span className="text-cobalt text-lg">{f.threshold}%</span>
            </div>
            <input type="range" min={0} max={100} step={5} value={f.threshold} onChange={(e) => set('threshold', Number(e.target.value))} className="mt-3 w-full" aria-label="Challenge bar" />
            <p className="mt-1 text-xs leading-relaxed text-slate">People see the score you hope for. Requests below it are flagged, but you always decide.</p>
          </div>
        </div>
      )}

      {err && <p role="alert" className="mt-6 rounded-2xl bg-wrong/10 px-4 py-3 text-sm text-wrong">{err}</p>}

      <div className={`fixed inset-x-0 bottom-0 z-20 border-t border-rule bg-paper/90 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4 backdrop-blur ${mode === 'edit' ? 'lg:left-72' : ''}`}>
        <div className="mx-auto max-w-2xl">
          <button onClick={next} disabled={saving} className="btn btn-primary w-full py-4 text-base">
            {saving ? <Spinner className="text-white" size={20} /> : step < 2 ? 'Continue' : mode === 'onboarding' ? 'Finish profile' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
