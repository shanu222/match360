import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { sendEmailVerification } from 'firebase/auth';
import { BadgeCheck, ChevronRight, Crown, LocateFixed, LogOut, Mail, Trash2 } from 'lucide-react';
import { getPosition } from '../lib/geo';
import { useConfig } from '../lib/config';
import { api, errMsg } from '../lib/api';
import type { Me, MeResponse } from '../lib/types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/Toast';
import { Avatar, FullScreenLoader, Modal, Spinner, Toggle } from '../components/ui';
import { Link } from 'react-router';

export default function SettingsPage() {
  const { me, fbUser, signOut, refetchMe, refreshEmailStatus } = useAuth();
  const cfg = useConfig();
  const [locBusy, setLocBusy] = useState(false);
  const qc = useQueryClient();
  const toast = useToast();
  const [del, setDel] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [threshold, setThreshold] = useState<number | null>(null);

  const blocks = useQuery({ queryKey: ['blocks'], queryFn: () => api.get<{ blocked: { id: string; name: string; photo: string | null }[] }>('/blocks') });
  const save = useMutation({
    mutationFn: (s: Partial<{ incognito: boolean; emailNotifications: boolean; threshold: number; photoBlur: boolean; interestedIn: string }>) => api.patch<{ user: Me }>('/me/settings', s),
    onSuccess: (r) => qc.setQueryData<MeResponse>(['me'], (o) => (o ? { ...o, user: r.user } : o)),
    onError: (e) => toast({ title: 'Couldn’t save', body: errMsg(e), tone: 'error' }),
  });
  const unblock = useMutation({
    mutationFn: (id: string) => api.del(`/blocks/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['blocks'] }),
  });
  const remove = useMutation({
    mutationFn: () => api.del('/me'),
    onSuccess: async () => {
      await signOut();
      window.location.href = '/';
    },
    onError: (e) => toast({ title: 'Couldn’t delete account', body: errMsg(e), tone: 'error' }),
  });

  if (!me) return <FullScreenLoader />;
  const u = me.user;
  const bar = threshold ?? u.threshold;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-3xl font-bold tracking-tight">Settings</h1>

      <section className="card flex items-center gap-4 p-5">
        <Avatar src={u.photos[0]} name={u.name} className="h-14 w-14" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold">{u.name}</div>
          <div className="flex items-center gap-1.5 truncate text-sm text-slate">
            <Mail size={14} /> {u.email}
            {u.verified && <BadgeCheck size={15} className="fill-cobalt text-white" />}
          </div>
        </div>
        <Link to="/me/edit" className="btn btn-ghost px-4 py-2 text-sm">Edit</Link>
      </section>

      {fbUser && (
        <section className="card flex flex-col gap-3 p-5 sm:flex-row sm:items-center">
          <Mail size={20} className={u.emailVerified ? 'text-right' : 'text-cobalt'} />
          <div className="flex-1 text-sm">
            {u.emailVerified ? (
              <><b>Email confirmed.</b> <span className="text-slate">{u.email}</span></>
            ) : (
              <><b>Confirm your email.</b> <span className="text-slate">We sent a link to {u.email}. Check your inbox and spam folder. If it’s in spam, mark it “Not spam” so you get future messages.</span></>
            )}
          </div>
          {!u.emailVerified && (
            <div className="flex gap-2">
              <button
                className="btn btn-ghost px-4 py-2 text-sm"
                onClick={async () => {
                  const ok = await refreshEmailStatus();
                  toast(ok ? { title: 'Email confirmed', tone: 'success' } : { title: 'Not confirmed yet', body: 'Open the link in the email first, then try again.', tone: 'error' });
                }}
              >
                I’ve confirmed it
              </button>
              <button
                className="btn btn-ghost px-4 py-2 text-sm"
                onClick={() =>
                  api
                    .post('/me/verify-email')
                    .catch(() => sendEmailVerification(fbUser))
                    .then(() => toast({ title: 'Email sent', body: `Check ${u.email}, including spam.`, tone: 'success' }))
                    .catch(() => toast({ title: 'Please wait a few minutes before asking again', tone: 'error' }))
                }
              >
                Send again
              </button>
            </div>
          )}
        </section>
      )}


      <section className="card divide-y divide-rule px-5">
        <Link to="/verify" className="flex items-center gap-4 py-4">
          <BadgeCheck size={20} className={u.verified ? 'text-right' : 'text-cobalt'} />
          <div className="flex-1">
            <div className="font-semibold">Identity verification</div>
            <div className="text-sm text-slate">{u.verified ? 'Verified' : me.verification === 'pending' ? 'Under review' : 'Get a verified badge by confirming your ID'}</div>
          </div>
          <ChevronRight size={18} className="text-slate" />
        </Link>
        <Link to="/premium" className="flex items-center gap-4 py-4">
          <Crown size={20} className="text-cobalt" />
          <div className="flex-1">
            <div className="font-semibold">Premium</div>
            <div className="text-sm text-slate">{cfg.data?.premium ? `Active until ${new Date(cfg.data.premiumUntil!).toLocaleDateString()}` : 'Remove ads and connect with more people'}</div>
          </div>
          <ChevronRight size={18} className="text-slate" />
        </Link>
      </section>

      <section className="card divide-y divide-rule px-5">
        <Row title="Blur my photos" text="Others see blurred photos until you’re connected.">
          <Toggle label="Blur my photos" on={u.photoBlur} onChange={(v) => save.mutate({ photoBlur: v })} />
        </Row>
        <div className="flex items-center gap-4 py-5">
          <div className="flex-1">
            <div className="font-semibold">Show me</div>
            <div className="mt-0.5 text-sm text-slate">Who appears in Discover.</div>
          </div>
          <select className="input w-40" value={u.interestedIn} onChange={(e) => save.mutate({ interestedIn: e.target.value })} aria-label="Show me">
            {['Everyone', 'Women', 'Men'].map((o) => <option key={o}>{o}</option>)}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-4 py-5">
          <div className="min-w-0 flex-1">
            <div className="font-semibold">Location</div>
            <div className="mt-0.5 text-sm text-slate">{u.hasLocation ? 'Shared. Others see only an approximate distance.' : 'Not shared. Share it to use “Near me”.'}</div>
          </div>
          <button
            className="btn btn-ghost px-4 py-2 text-sm"
            disabled={locBusy}
            onClick={async () => {
              setLocBusy(true);
              try {
                await api.post('/me/location', await getPosition());
                refetchMe();
                toast({ title: 'Location updated', tone: 'success' });
              } catch (e) {
                toast({ title: 'Location not updated', body: errMsg(e), tone: 'error' });
              } finally {
                setLocBusy(false);
              }
            }}
          >
            <LocateFixed size={16} /> {u.hasLocation ? 'Update' : 'Share'}
          </button>
          {u.hasLocation && (
            <button className="btn btn-quiet px-3 py-2 text-sm" onClick={() => api.del('/me/location').then(() => { refetchMe(); toast({ title: 'Location removed', tone: 'success' }); })}>Remove</button>
          )}
        </div>
        <Row title="Email notifications" text="Only for connection requests, new matches and messages while you’re away.">
          <Toggle label="Email notifications" on={u.emailNotifications} onChange={(v) => save.mutate({ emailNotifications: v })} />
        </Row>
        <Row title="Incognito mode" text="Hide from Discover. Only people you reach out to can see you.">
          <Toggle label="Incognito mode" on={u.incognito} onChange={(v) => save.mutate({ incognito: v })} />
        </Row>
        <div className="py-5">
          <div className="flex items-center justify-between font-bold"><span>Score you hope for</span><span className="text-cobalt">{bar}%</span></div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={bar}
            aria-label="Score you hope for"
            onChange={(e) => setThreshold(Number(e.target.value))}
            onPointerUp={() => threshold !== null && save.mutate({ threshold })}
            onKeyUp={() => threshold !== null && save.mutate({ threshold })}
            className="mt-3 w-full"
          />
          <p className="mt-1 text-sm text-slate">The score you hope people reach. Lower scores are flagged but never blocked.</p>
        </div>
      </section>

      <section className="card p-5">
        <div className="font-bold">Blocked people</div>
        {blocks.isLoading ? (
          <div className="py-4"><Spinner /></div>
        ) : !blocks.data?.blocked.length ? (
          <p className="mt-1 text-sm text-slate">You haven’t blocked anyone.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {blocks.data.blocked.map((b) => (
              <div key={b.id} className="flex items-center gap-3">
                <Avatar src={b.photo} name={b.name} className="h-10 w-10" rounded="rounded-xl" />
                <span className="flex-1 truncate font-semibold">{b.name}</span>
                <button className="btn btn-ghost px-3 py-1.5 text-sm" disabled={unblock.isPending} onClick={() => unblock.mutate(b.id)}>Unblock</button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="card divide-y divide-rule px-5">
        <button onClick={signOut} className="flex w-full items-center gap-3 py-4 font-semibold hover:text-ink"><LogOut size={18} /> Sign out</button>
        <button onClick={() => setDel(true)} className="flex w-full items-center gap-3 py-4 font-semibold text-wrong"><Trash2 size={18} /> Delete account</button>
      </section>
      <p className="pb-6 text-center text-xs leading-relaxed text-slate">
        <Link to="/guidelines" className="hover:text-ink">Community guidelines</Link> · <Link to="/safety" className="hover:text-ink">Safety</Link> · <Link to="/refunds" className="hover:text-ink">Refunds</Link> ·{' '}
        <Link to="/privacy" className="hover:text-ink">Privacy</Link> · <Link to="/terms" className="hover:text-ink">Terms</Link> · Match360 v1.0
      </p>

      <Modal open={del} onClose={() => setDel(false)} title="Delete your account?">
        <p className="text-slate">This permanently deletes your profile, photos, requests, connections and messages. This can’t be undone.</p>
        <label className="label">Type <b className="text-ink">DELETE</b> to confirm</label>
        <input className="input" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} autoComplete="off" />
        <div className="mt-6 grid grid-cols-2 gap-3">
          <button className="btn btn-ghost" onClick={() => setDel(false)}>Cancel</button>
          <button className="btn btn-danger" disabled={confirmText !== 'DELETE' || remove.isPending} onClick={() => remove.mutate()}>
            {remove.isPending ? <Spinner size={18} /> : 'Delete forever'}
          </button>
        </div>
      </Modal>
    </div>
  );
}

function Row({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4 py-5">
      <div className="flex-1">
        <div className="font-bold">{title}</div>
        <div className="mt-0.5 text-sm text-slate">{text}</div>
      </div>
      {children}
    </div>
  );
}
