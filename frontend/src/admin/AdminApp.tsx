import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { NavLink, Navigate, Route, Routes, useNavigate, useParams } from 'react-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import {
  BadgeCheck, BarChart3, Bot, CreditCard, Flag, LogOut, Megaphone, Search, Settings2, ShieldAlert, ScrollText, Users,
} from 'lucide-react';
import { errMsg } from '../lib/api';
import { adminApi, adminToken, setOnExpired } from './adminApi';
import { LogoMark } from '../components/Logo';
import { Avatar, Modal, Spinner, Toggle } from '../components/ui';
import { useToast } from '../context/Toast';

/* ------------------------------------------------------------------ */
/*  Shell + login                                                       */
/* ------------------------------------------------------------------ */

export default function AdminApp({ base }: { base: string }) {
  const [authed, setAuthed] = useState(Boolean(adminToken.get()));
  useEffect(() => {
    document.title = 'Match360 admin';
    const meta = document.createElement('meta');
    meta.name = 'robots';
    meta.content = 'noindex, nofollow';
    document.head.appendChild(meta);
    setOnExpired(() => setAuthed(false));
    return () => meta.remove();
  }, []);
  if (!authed) return <Login onDone={() => setAuthed(true)} />;
  const nav = [
    ['', 'Overview', BarChart3],
    ['users', 'Users', Users],
    ['reports', 'Reports', Flag],
    ['verifications', 'Verifications', BadgeCheck],
    ['payments', 'Payments', CreditCard],
    ['settings', 'Settings', Settings2],
    ['audit', 'Activity log', ScrollText],
  ] as const;
  return (
    <div className="min-h-dvh bg-paper lg:pl-60">
      <aside className="flex items-center gap-1 overflow-x-auto border-b border-rule bg-ink px-3 py-2 text-white lg:fixed lg:inset-y-0 lg:left-0 lg:w-60 lg:flex-col lg:items-stretch lg:gap-1 lg:overflow-visible lg:border-0 lg:px-4 lg:py-6">
        <div className="mr-2 flex shrink-0 items-center gap-2 px-2 lg:mb-8 lg:mr-0">
          <LogoMark size={26} />
          <span className="font-display font-bold">Admin</span>
        </div>
        {nav.map(([to, label, Icon]) => (
          <NavLink key={to} end={to === ''} to={`${base}/${to}`} className={({ isActive }) => clsx('flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium', isActive ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white')}>
            <Icon size={17} /> {label}
          </NavLink>
        ))}
        <button onClick={() => { adminToken.clear(); setAuthed(false); }} className="flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-white/70 hover:bg-white/10 hover:text-white lg:mt-auto">
          <LogOut size={17} /> Sign out
        </button>
      </aside>
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-10 lg:py-10">
        <Routes>
          <Route index element={<Overview base={base} />} />
          <Route path="users" element={<UsersPage base={base} />} />
          <Route path="users/:id" element={<UserDetail base={base} />} />
          <Route path="reports" element={<ReportsPage base={base} />} />
          <Route path="verifications" element={<VerificationsPage base={base} />} />
          <Route path="payments" element={<PaymentsPage base={base} />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="audit" element={<AuditPage />} />
          <Route path="*" element={<Navigate to={base} replace />} />
        </Routes>
      </main>
    </div>
  );
}

function Login({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const r = await adminApi.post<{ token: string; expiresIn: number }>('/login', { email, password });
      adminToken.set(r.token, r.expiresIn);
      onDone();
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="flex min-h-dvh items-center justify-center bg-paper px-4">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-rule bg-card p-7 shadow-pop">
        <LogoMark size={36} />
        <h1 className="mt-5 text-2xl font-bold">Admin sign in</h1>
        <label className="label" htmlFor="ae">Email</label>
        <input id="ae" className="input" type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} />
        <label className="label" htmlFor="ap">Password</label>
        <input id="ap" className="input" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {err && <p role="alert" className="mt-4 rounded-xl bg-wrong/10 px-3 py-2.5 text-sm text-wrong">{err}</p>}
        <button className="btn btn-primary mt-6 w-full" disabled={busy || !email || !password}>{busy ? <Spinner size={18} className="text-white" /> : 'Sign in'}</button>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Shared bits                                                         */
/* ------------------------------------------------------------------ */

function Header({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <h1 className="text-3xl font-bold">{title}</h1>
      {children}
    </div>
  );
}
function Tabs<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: T[] }) {
  return (
    <div className="inline-flex rounded-xl border border-rule bg-card p-1">
      {options.map((o) => <button key={o} onClick={() => onChange(o)} className={clsx('rounded-lg px-3.5 py-1.5 text-sm font-medium', o === 'ai' ? '' : 'capitalize', value === o ? 'bg-ink text-white' : 'text-slate hover:text-ink')}>{o === 'ai' ? 'AI' : o}</button>)}
    </div>
  );
}
function Loading({ q }: { q: { isLoading: boolean; isError: boolean; error: unknown; refetch: () => void } }) {
  if (q.isLoading) return <div className="flex justify-center py-16"><Spinner size={26} /></div>;
  if (q.isError) return <div className="py-12 text-center text-slate">{errMsg(q.error)} <button className="font-semibold text-cobalt underline" onClick={() => q.refetch()}>Retry</button></div>;
  return null;
}
const date = (s: string | null) => (s ? new Date(s).toLocaleString(undefined, { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—');
const Badge = ({ tone, children }: { tone: 'ok' | 'bad' | 'warn' | 'plain'; children: ReactNode }) => (
  <span className={clsx('inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold', tone === 'ok' ? 'bg-right/10 text-right' : tone === 'bad' ? 'bg-wrong/10 text-wrong' : tone === 'warn' ? 'bg-marker/60 text-ink' : 'bg-rule text-slate')}>{children}</span>
);

function ReviewDialog({ open, title, onClose, onConfirm, busy, confirmLabel, danger }: { open: boolean; title: string; onClose: () => void; onConfirm: (note: string) => void; busy: boolean; confirmLabel: string; danger?: boolean }) {
  const [note, setNote] = useState('');
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <label className="label" htmlFor="note">Note {danger ? '(sent to the user)' : '(optional)'}</label>
      <textarea id="note" className="input min-h-[90px]" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
      <div className="mt-5 grid grid-cols-2 gap-3">
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className={danger ? 'btn btn-danger' : 'btn btn-primary'} disabled={busy} onClick={() => onConfirm(note)}>{busy ? <Spinner size={18} /> : confirmLabel}</button>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------------------ */
/*  Overview                                                            */
/* ------------------------------------------------------------------ */

function Overview({ base }: { base: string }) {
  const q = useQuery({ queryKey: ['admin', 'stats'], queryFn: () => adminApi.get<any>('/stats'), refetchInterval: 60_000 });
  const nav = useNavigate();
  if (!q.data) return <Loading q={q} />;
  const s = q.data;
  const max = Math.max(1, ...s.daily.map((d: any) => Math.max(d.signups, d.requests)));
  const tiles = [
    ['Members', s.users, `${s.profiles} with complete profiles`],
    ['New in 24 hours', s.signups_24h, `${s.signups_7d} in 7 days`],
    ['Active in 24 hours', s.active_24h, ''],
    ['Connections', s.connections, `${s.requests} requests sent`],
    ['Verified', s.verified, ''],
    ['Premium', s.premium, `Rs ${Math.round(s.revenue_pkr).toLocaleString()} and $${s.revenue_usd.toFixed(2)} confirmed`],
    ['Challenges taken', s.challenges, `${s.ai_quizzes_7d} AI-written this week`],
    ['Messages', s.messages, ''],
  ];
  const queues = [
    ['Open reports', s.open_reports, 'reports', ShieldAlert],
    ['Verifications to review', s.pending_verifications, 'verifications', BadgeCheck],
    ['Payments to confirm', s.pending_payments, 'payments', CreditCard],
  ] as const;
  return (
    <>
      <Header title="Overview" />
      <div className="grid gap-3 sm:grid-cols-3">
        {queues.map(([l, n, to, Icon]) => (
          <button key={to} onClick={() => nav(`${base}/${to}`)} className={clsx('flex items-center gap-4 rounded-xl border p-4 text-left', n ? 'border-cobalt bg-cobalt-soft' : 'border-rule bg-card')}>
            <Icon size={22} className="text-cobalt" />
            <div><div className="font-display text-2xl font-bold">{n}</div><div className="text-sm text-slate">{l}</div></div>
          </button>
        ))}
      </div>
      <SystemStatus />
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map(([l, v, sub]) => (
          <div key={l as string} className="rounded-xl border border-rule bg-card p-4">
            <div className="text-sm text-slate">{l}</div>
            <div className="mt-1 font-display text-3xl font-bold">{Number(v).toLocaleString()}</div>
            {sub && <div className="mt-1 text-xs text-slate">{sub}</div>}
          </div>
        ))}
      </div>
      <div className="mt-6 rounded-xl border border-rule bg-card p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">Last 14 days</h2>
          <div className="flex gap-4 text-xs text-slate">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-cobalt" />Sign-ups</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-marker" />Requests</span>
          </div>
        </div>
        <div className="mt-4 flex h-40 items-end gap-1.5">
          {s.daily.map((d: any) => (
            <div key={d.day} className="flex flex-1 flex-col items-center gap-1" title={`${d.day}: ${d.signups} sign-ups, ${d.requests} requests, ${d.connections} connections`}>
              <div className="flex w-full flex-1 items-end gap-0.5">
                <div className="flex-1 rounded-t bg-cobalt" style={{ height: `${(d.signups / max) * 100}%`, minHeight: d.signups ? 3 : 0 }} />
                <div className="flex-1 rounded-t bg-marker" style={{ height: `${(d.requests / max) * 100}%`, minHeight: d.requests ? 3 : 0 }} />
              </div>
              <span className="text-[10px] text-slate">{d.day.slice(8)}</span>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function SystemStatus() {
  const q = useQuery({ queryKey: ['admin', 'health'], queryFn: () => adminApi.get<any>('/health'), staleTime: 5 * 60_000 });
  if (!q.data) return null;
  const rows: [string, string][] = [
    ['Photo storage', q.data.storage.publicBucket],
    ['Private storage (IDs, receipts)', q.data.storage.privateBucket],
    ['Email', q.data.email],
    ['Sign-in', q.data.firebase],
    ['AI questions', q.data.ai],
  ];
  const good = (v: string) => /working|configured|enabled|using main/i.test(v);
  return (
    <div className="mt-6 rounded-xl border border-rule bg-card p-4">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">System status</h2>
        <button className="text-sm font-medium text-cobalt hover:underline" onClick={() => q.refetch()}>{q.isFetching ? 'Checking…' : 'Check again'}</button>
      </div>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-start gap-2">
            <span className={clsx('mt-1.5 h-2 w-2 shrink-0 rounded-full', good(v) ? 'bg-right' : 'bg-wrong')} />
            <dt className="text-slate">{k}:</dt>
            <dd className="break-all">{v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Users                                                               */
/* ------------------------------------------------------------------ */

function statusTone(s: string) {
  return s === 'active' ? 'ok' : s === 'suspended' ? 'warn' : 'bad';
}

function UsersPage({ base }: { base: string }) {
  const [term, setTerm] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'premium' | 'verified' | 'incomplete' | 'suspended' | 'banned'>('all');
  const [page, setPage] = useState(0);
  const nav = useNavigate();
  const params = new URLSearchParams({ q: search, page: String(page) });
  if (['premium', 'verified', 'incomplete'].includes(filter)) params.set('filter', filter);
  if (['suspended', 'banned'].includes(filter)) params.set('status', filter);
  const q = useQuery({ queryKey: ['admin', 'users', search, filter, page], queryFn: () => adminApi.get<{ users: any[]; total: number }>(`/users?${params}`) });
  return (
    <>
      <Header title="Users">
        <form onSubmit={(e) => { e.preventDefault(); setPage(0); setSearch(term.trim()); }} className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate" />
          <input className="input pl-10" placeholder="Name, email, city or user ID" value={term} onChange={(e) => setTerm(e.target.value)} />
        </form>
      </Header>
      <Tabs value={filter} onChange={(v) => { setFilter(v); setPage(0); }} options={['all', 'premium', 'verified', 'incomplete', 'suspended', 'banned']} />
      <div className="mt-4">
        <Loading q={q} />
        {q.data && (
          <>
            <div className="overflow-x-auto rounded-xl border border-rule bg-card">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead className="border-b border-rule text-slate"><tr><th className="px-4 py-3 font-medium">Member</th><th className="px-4 py-3 font-medium">Location</th><th className="px-4 py-3 font-medium">Work</th><th className="px-4 py-3 font-medium">Status</th><th className="px-4 py-3 font-medium">Joined</th></tr></thead>
                <tbody className="divide-y divide-rule">
                  {q.data.users.map((u) => (
                    <tr key={u.id} onClick={() => nav(`${base}/users/${u.id}`)} className="cursor-pointer hover:bg-paper">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar src={u.photos[0]} name={u.name || u.email} className="h-9 w-9" rounded="rounded-lg" />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5 font-semibold">{u.name || 'No name yet'}{u.idVerified && <BadgeCheck size={14} className="text-cobalt" />}{u.premium && <Badge tone="warn">Premium</Badge>}</div>
                            <div className="truncate text-slate">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">{u.city ? `${u.city}, ${u.countryName}` : '—'}</td>
                      <td className="px-4 py-3">{u.job || '—'}</td>
                      <td className="px-4 py-3"><Badge tone={statusTone(u.status)}>{u.status}</Badge> {!u.onboarded && <Badge tone="plain">incomplete</Badge>}</td>
                      <td className="px-4 py-3 text-slate">{date(u.createdAt)}</td>
                    </tr>
                  ))}
                  {!q.data.users.length && <tr><td colSpan={5} className="px-4 py-10 text-center text-slate">No users found.</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="mt-4 flex items-center justify-between text-sm text-slate">
              <span>{q.data.total.toLocaleString()} users</span>
              <div className="flex gap-2">
                <button className="btn btn-ghost px-3 py-1.5 text-sm" disabled={page === 0} onClick={() => setPage(page - 1)}>Previous</button>
                <button className="btn btn-ghost px-3 py-1.5 text-sm" disabled={(page + 1) * 50 >= q.data.total} onClick={() => setPage(page + 1)}>Next</button>
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}

function UserDetail({ base }: { base: string }) {
  const { id = '' } = useParams();
  const qc = useQueryClient();
  const toast = useToast();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ['admin', 'user', id], queryFn: () => adminApi.get<any>(`/users/${encodeURIComponent(id)}`) });
  const [dialog, setDialog] = useState<null | 'suspend' | 'ban' | 'delete'>(null);
  const patch = useMutation({
    mutationFn: (body: any) => adminApi.patch(`/users/${encodeURIComponent(id)}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin'] }); toast({ title: 'Saved', tone: 'success' }); setDialog(null); },
    onError: (e) => toast({ title: 'Failed', body: errMsg(e), tone: 'error' }),
  });
  const del = useMutation({
    mutationFn: () => adminApi.del(`/users/${encodeURIComponent(id)}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin'] }); toast({ title: 'User deleted', tone: 'success' }); nav(`${base}/users`); },
    onError: (e) => toast({ title: 'Failed', body: errMsg(e), tone: 'error' }),
  });
  if (!q.data) return <Loading q={q} />;
  const { user: u, reportsAgainst, payments, verifications, counts } = q.data;
  const facts: [string, ReactNode][] = [
    ['Email', <>{u.email} {u.emailVerified ? <Badge tone="ok">confirmed</Badge> : <Badge tone="plain">unconfirmed</Badge>}</>],
    ['Age and gender', `${u.age ?? '—'}, ${u.gender || '—'}`],
    ['Location', u.city ? `${u.city}, ${u.countryName}${u.hometown ? ` (from ${u.hometown})` : ''}` : '—'],
    ['Work', [u.job, u.company, u.industry].filter(Boolean).join(', ') || '—'],
    ['Education', [u.educationLevel, u.education].filter(Boolean).join(', ') || '—'],
    ['Looking for', u.intent || '—'],
    ['Premium', u.premium ? `Until ${date(u.premiumUntil)}` : 'No'],
    ['Activity', `${counts.sent} requests sent, ${counts.received} received, ${counts.connections} connections, ${counts.messages} messages, blocked by ${counts.blocked_by}`],
    ['Joined', date(u.createdAt)],
    ['User ID', <code className="text-xs">{u.id}</code>],
  ];
  return (
    <>
      <button onClick={() => nav(-1)} className="mb-4 text-sm font-medium text-cobalt hover:underline">Back</button>
      <div className="flex flex-wrap items-start gap-5">
        <Avatar src={u.photos[0]} name={u.name || u.email} className="h-20 w-20" />
        <div className="flex-1">
          <h1 className="flex items-center gap-2 text-3xl font-bold">{u.name || 'No name yet'}{u.idVerified && <BadgeCheck className="text-cobalt" />}</h1>
          <div className="mt-1 flex flex-wrap gap-2"><Badge tone={statusTone(u.status)}>{u.status}</Badge>{u.statusReason && <span className="text-sm text-slate">{u.statusReason}</span>}</div>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap gap-2">
        {u.status === 'active' ? (
          <>
            <button className="btn btn-ghost px-3 py-2 text-sm" onClick={() => setDialog('suspend')}>Suspend</button>
            <button className="btn btn-danger px-3 py-2 text-sm" onClick={() => setDialog('ban')}>Ban</button>
          </>
        ) : (
          <button className="btn btn-ghost px-3 py-2 text-sm" onClick={() => patch.mutate({ status: 'active', statusReason: '' })}>Restore account</button>
        )}
        <button className="btn btn-ghost px-3 py-2 text-sm" onClick={() => patch.mutate({ idVerified: !u.idVerified })}>{u.idVerified ? 'Remove verified badge' : 'Mark verified'}</button>
        <button className="btn btn-ghost px-3 py-2 text-sm" onClick={() => patch.mutate({ premiumDays: 30 })}>Give 30 days Premium</button>
        {u.premium && <button className="btn btn-ghost px-3 py-2 text-sm" onClick={() => patch.mutate({ removePremium: true })}>Remove Premium</button>}
        {u.photos.length > 0 && <button className="btn btn-ghost px-3 py-2 text-sm" onClick={() => patch.mutate({ hidePhotos: true })}>Remove photos</button>}
        <button className="btn btn-danger px-3 py-2 text-sm" onClick={() => setDialog('delete')}>Delete account</button>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-xl border border-rule bg-card">
          <dl className="divide-y divide-rule">
            {facts.map(([k, v]) => <div key={k} className="grid grid-cols-[140px_1fr] gap-3 px-4 py-2.5 text-sm"><dt className="text-slate">{k}</dt><dd>{v}</dd></div>)}
          </dl>
          {u.bio && <div className="border-t border-rule px-4 py-3 text-sm"><div className="text-slate">About</div><p className="mt-1 whitespace-pre-line">{u.bio}</p></div>}
          {u.prompts?.length > 0 && <div className="border-t border-rule px-4 py-3 text-sm">{u.prompts.map((p: any) => <p key={p.q} className="mt-1"><span className="text-slate">{p.q}:</span> {p.a}</p>)}</div>}
          {u.photos.length > 0 && <div className="flex flex-wrap gap-2 border-t border-rule p-4">{u.photos.map((p: string) => <a key={p} href={p} target="_blank" rel="noreferrer"><img src={p} alt="" className="h-24 w-20 rounded-lg object-cover" /></a>)}</div>}
        </div>
        <div className="space-y-5">
          <div className="rounded-xl border border-rule bg-card p-4">
            <h2 className="font-semibold">Reports against this user ({reportsAgainst.length})</h2>
            <div className="mt-2 divide-y divide-rule text-sm">
              {reportsAgainst.map((r: any) => <div key={r.id} className="py-2"><div className="font-medium">{r.reason} <Badge tone={r.status === 'open' ? 'warn' : 'plain'}>{r.status}</Badge></div><div className="text-slate">by {r.reporter_name || 'deleted user'}, {date(r.created_at)}</div>{r.details && <div>{r.details}</div>}</div>)}
              {!reportsAgainst.length && <p className="py-2 text-slate">None</p>}
            </div>
          </div>
          <div className="rounded-xl border border-rule bg-card p-4">
            <h2 className="font-semibold">Payments</h2>
            <div className="mt-2 divide-y divide-rule text-sm">
              {payments.map((p: any) => <div key={p.id} className="py-2">{p.plan}, {p.currency} {Number(p.amount).toLocaleString()} via {p.method} <Badge tone={p.status === 'approved' ? 'ok' : p.status === 'rejected' ? 'bad' : 'warn'}>{p.status}</Badge></div>)}
              {!payments.length && <p className="py-2 text-slate">None</p>}
            </div>
          </div>
          <div className="rounded-xl border border-rule bg-card p-4">
            <h2 className="font-semibold">Verification</h2>
            <div className="mt-2 divide-y divide-rule text-sm">
              {verifications.map((v: any) => <div key={v.id} className="py-2">{v.doc_type} <Badge tone={v.status === 'approved' ? 'ok' : v.status === 'rejected' ? 'bad' : 'warn'}>{v.status}</Badge> <span className="text-slate">{date(v.created_at)}</span></div>)}
              {!verifications.length && <p className="py-2 text-slate">Not submitted</p>}
            </div>
          </div>
        </div>
      </div>

      <ReviewDialog open={dialog === 'suspend'} title="Suspend this account?" confirmLabel="Suspend" danger busy={patch.isPending} onClose={() => setDialog(null)} onConfirm={(note) => patch.mutate({ status: 'suspended', statusReason: note })} />
      <ReviewDialog open={dialog === 'ban'} title="Ban this account?" confirmLabel="Ban" danger busy={patch.isPending} onClose={() => setDialog(null)} onConfirm={(note) => patch.mutate({ status: 'banned', statusReason: note })} />
      <Modal open={dialog === 'delete'} onClose={() => setDialog(null)} title="Delete this account permanently?">
        <p className="text-slate">This removes the profile, photos, messages and sign-in. It can’t be undone. For rule-breakers, banning keeps them from signing up again with the same account.</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <button className="btn btn-ghost" onClick={() => setDialog(null)}>Cancel</button>
          <button className="btn btn-danger" disabled={del.isPending} onClick={() => del.mutate()}>Delete</button>
        </div>
      </Modal>
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Reports, verifications, payments                                    */
/* ------------------------------------------------------------------ */

function ReportsPage({ base }: { base: string }) {
  const [status, setStatus] = useState<'open' | 'resolved' | 'dismissed'>('open');
  const qc = useQueryClient();
  const toast = useToast();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ['admin', 'reports', status], queryFn: () => adminApi.get<{ reports: any[] }>(`/reports?status=${status}`) });
  const upd = useMutation({
    mutationFn: ({ id, s }: { id: number; s: string }) => adminApi.patch(`/reports/${id}`, { status: s }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin'] }); toast({ title: 'Report updated', tone: 'success' }); },
  });
  return (
    <>
      <Header title="Reports"><Tabs value={status} onChange={setStatus} options={['open', 'resolved', 'dismissed']} /></Header>
      <Loading q={q} />
      <div className="space-y-3">
        {q.data?.reports.map((r) => (
          <div key={r.id} className="rounded-xl border border-rule bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="font-semibold">{r.reason}</div>
                <div className="mt-1 text-sm text-slate">
                  <button className="font-medium text-cobalt hover:underline" onClick={() => nav(`${base}/users/${r.reported_id}`)}>{r.reported_name || 'Deleted user'}</button>
                  {' '}reported by{' '}
                  <button className="font-medium text-cobalt hover:underline" onClick={() => nav(`${base}/users/${r.reporter_id}`)}>{r.reporter_name || 'deleted user'}</button>, {date(r.created_at)}
                </div>
                {r.details && <p className="mt-2 text-sm">{r.details}</p>}
                <div className="mt-2 flex gap-2"><Badge tone={statusTone(r.reported_status || 'active')}>{r.reported_status || 'deleted'}</Badge>{r.total_reports > 1 && <Badge tone="bad">{r.total_reports} reports in total</Badge>}</div>
              </div>
              {status === 'open' && (
                <div className="flex gap-2">
                  <button className="btn btn-ghost px-3 py-1.5 text-sm" onClick={() => upd.mutate({ id: r.id, s: 'dismissed' })}>Dismiss</button>
                  <button className="btn btn-primary px-3 py-1.5 text-sm" onClick={() => upd.mutate({ id: r.id, s: 'resolved' })}>Mark resolved</button>
                </div>
              )}
            </div>
          </div>
        ))}
        {q.data && !q.data.reports.length && <p className="py-12 text-center text-slate">No {status} reports.</p>}
      </div>
    </>
  );
}

function VerificationsPage({ base }: { base: string }) {
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [reject, setReject] = useState<string | null>(null);
  const qc = useQueryClient();
  const toast = useToast();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ['admin', 'verifications', status], queryFn: () => adminApi.get<{ verifications: any[] }>(`/verifications?status=${status}`) });
  const decide = useMutation({
    mutationFn: ({ id, d, note }: { id: string; d: 'approve' | 'reject'; note?: string }) => adminApi.post(`/verifications/${id}/${d}`, { note: note || '' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin'] }); setReject(null); toast({ title: 'Done', tone: 'success' }); },
    onError: (e) => toast({ title: 'Failed', body: errMsg(e), tone: 'error' }),
  });
  return (
    <>
      <Header title="Verifications"><Tabs value={status} onChange={setStatus} options={['pending', 'approved', 'rejected']} /></Header>
      <Loading q={q} />
      <div className="space-y-4">
        {q.data?.verifications.map((v) => (
          <div key={v.id} className="rounded-xl border border-rule bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button className="text-left" onClick={() => nav(`${base}/users/${v.userId}`)}>
                <div className="font-semibold text-cobalt hover:underline">{v.name}</div>
                <div className="text-sm text-slate">{v.age}, {v.gender}, {v.city}, {v.country}. {v.docType}. Submitted {date(v.createdAt)}</div>
              </button>
              {status === 'pending' && (
                <div className="flex gap-2">
                  <button className="btn btn-danger px-3 py-1.5 text-sm" onClick={() => setReject(v.id)}>Reject</button>
                  <button className="btn btn-primary px-3 py-1.5 text-sm" disabled={decide.isPending} onClick={() => decide.mutate({ id: v.id, d: 'approve' })}>Approve</button>
                </div>
              )}
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              {[['Profile photo', v.profilePhoto], ['Document', v.docUrl], ['Selfie with document', v.selfieUrl]].map(([l, src]) => (
                <figure key={l}>
                  {src ? <a href={src} target="_blank" rel="noreferrer"><img src={src} alt={l} className="h-48 w-full rounded-lg bg-paper object-contain" /></a> : <div className="flex h-48 items-center justify-center rounded-lg bg-paper text-sm text-slate">Not available</div>}
                  <figcaption className="mt-1 text-xs text-slate">{l}</figcaption>
                </figure>
              ))}
            </div>
            {v.note && <p className="mt-3 text-sm text-slate">Note: {v.note}</p>}
          </div>
        ))}
        {q.data && !q.data.verifications.length && <p className="py-12 text-center text-slate">Nothing {status}.</p>}
      </div>
      <ReviewDialog open={Boolean(reject)} title="Reject verification" confirmLabel="Reject" danger busy={decide.isPending} onClose={() => setReject(null)} onConfirm={(note) => reject && decide.mutate({ id: reject, d: 'reject', note })} />
    </>
  );
}

function PaymentsPage({ base }: { base: string }) {
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [reject, setReject] = useState<string | null>(null);
  const qc = useQueryClient();
  const toast = useToast();
  const nav = useNavigate();
  const q = useQuery({ queryKey: ['admin', 'payments', status], queryFn: () => adminApi.get<{ payments: any[] }>(`/payments?status=${status}`) });
  const decide = useMutation({
    mutationFn: ({ id, d, note }: { id: string; d: 'approve' | 'reject'; note?: string }) => adminApi.post(`/payments/${id}/${d}`, { note: note || '' }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin'] }); setReject(null); toast({ title: 'Done', tone: 'success' }); },
    onError: (e) => toast({ title: 'Failed', body: errMsg(e), tone: 'error' }),
  });
  return (
    <>
      <Header title="Payments"><Tabs value={status} onChange={setStatus} options={['pending', 'approved', 'rejected']} /></Header>
      <p className="-mt-3 mb-5 text-sm text-slate">Check each transaction ID against your Easypaisa, JazzCash or bank statement before approving. Approving adds the plan’s months to the member’s Premium.</p>
      <Loading q={q} />
      <div className="space-y-3">
        {q.data?.payments.map((p) => (
          <div key={p.id} className="flex flex-wrap items-start gap-4 rounded-xl border border-rule bg-card p-4">
            {p.proofUrl ? <a href={p.proofUrl} target="_blank" rel="noreferrer"><img src={p.proofUrl} alt="Receipt" className="h-28 w-24 rounded-lg bg-paper object-cover" /></a> : <div className="flex h-28 w-24 items-center justify-center rounded-lg bg-paper text-center text-xs text-slate">No receipt</div>}
            <div className="min-w-0 flex-1 text-sm">
              <div className="font-display text-xl font-bold">{p.currency === 'USD' ? `$${p.amount.toFixed(2)}` : `Rs ${p.amount.toLocaleString()}`} <span className="font-sans text-sm font-normal text-slate">via {p.method}</span></div>
              <div className="mt-1">Transaction ID <b className="font-mono">{p.reference}</b>{p.sender && <>, from {p.sender}</>}</div>
              <div className="mt-1 text-slate">{p.plan} for <button className="font-medium text-cobalt hover:underline" onClick={() => nav(`${base}/users/${p.user_id}`)}>{p.name || 'deleted user'}</button> ({p.email}), {date(p.created_at)}</div>
              {p.note && <div className="mt-1 text-slate">Note: {p.note}</div>}
            </div>
            {status === 'pending' && (
              <div className="flex gap-2">
                <button className="btn btn-danger px-3 py-1.5 text-sm" onClick={() => setReject(p.id)}>Reject</button>
                <button className="btn btn-primary px-3 py-1.5 text-sm" disabled={decide.isPending} onClick={() => decide.mutate({ id: p.id, d: 'approve' })}>Approve</button>
              </div>
            )}
          </div>
        ))}
        {q.data && !q.data.payments.length && <p className="py-12 text-center text-slate">No {status} payments.</p>}
      </div>
      <ReviewDialog open={Boolean(reject)} title="Reject payment" confirmLabel="Reject" danger busy={decide.isPending} onClose={() => setReject(null)} onConfirm={(note) => reject && decide.mutate({ id: reject, d: 'reject', note })} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/*  Settings                                                            */
/* ------------------------------------------------------------------ */

const PROVIDER_LABEL: Record<string, string> = { openai: 'OpenAI', gemini: 'Google Gemini', openrouter: 'OpenRouter', anthropic: 'Anthropic Claude', groq: 'Groq', custom: 'Other (OpenAI-compatible)' };
const ENV_NAME: Record<string, string> = { openai: 'OPENAI_API_KEY', gemini: 'GEMINI_API_KEY', openrouter: 'OPENROUTER_API_KEY', anthropic: 'ANTHROPIC_API_KEY', groq: 'GROQ_API_KEY', custom: '—' };
const STATE_LABEL: Record<string, [string, 'ok' | 'bad' | 'warn' | 'plain']> = {
  ok: ['Working', 'ok'], invalid: ['Invalid or expired', 'bad'], no_credit: ['No credit', 'bad'], rate_limited: ['Rate limited', 'warn'], model_missing: ['Model not available', 'warn'],
  timeout: ['Timed out', 'warn'], provider_error: ['Provider error', 'warn'], network: ['Network error', 'warn'], missing: ['No key', 'plain'],
};

function SettingsPage() {
  const [tab, setTab] = useState<'ai' | 'plans' | 'payments' | 'ads' | 'limits'>('ai');
  const q = useQuery({ queryKey: ['admin', 'settings'], queryFn: () => adminApi.get<any>('/settings') });
  return (
    <>
      <Header title="Settings"><Tabs value={tab} onChange={setTab} options={['ai', 'plans', 'payments', 'ads', 'limits']} /></Header>
      <Loading q={q} />
      {q.data && tab === 'ai' && <AiSettings data={q.data.ai} />}
      {q.data && tab === 'plans' && <JsonList section="plans" initial={q.data.plans} />}
      {q.data && tab === 'payments' && <JsonList section="paymentMethods" initial={q.data.paymentMethods} />}
      {q.data && tab === 'ads' && <AdsSettings initial={q.data.ads} />}
      {q.data && tab === 'limits' && <LimitsSettings initial={q.data.limits} />}
    </>
  );
}

function useSave(section: string) {
  const qc = useQueryClient();
  const toast = useToast();
  return useMutation({
    mutationFn: (body: unknown) => adminApi.put(`/settings/${section}`, body),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'settings'] }); toast({ title: 'Settings saved', tone: 'success' }); },
    onError: (e) => toast({ title: 'Not saved', body: errMsg(e), tone: 'error' }),
  });
}

function AiSettings({ data }: { data: any }) {
  const [enabled, setEnabled] = useState<boolean>(data.enabled);
  const [order, setOrder] = useState<string[]>(data.order);
  const [models, setModels] = useState<Record<string, string>>(data.models);
  const [baseUrl, setBaseUrl] = useState<string>(data.customBaseUrl || '');
  const [keys, setKeys] = useState<Record<string, string>>({});
  const save = useSave('ai');
  const test = useMutation({ mutationFn: () => adminApi.post<any>('/ai/test', {}) });
  const all = ['openai', 'gemini', 'openrouter', 'anthropic', 'groq', 'custom'];
  const check = useMutation({ mutationFn: () => adminApi.post<{ results: any[] }>('/ai/check', {}) });
  const move = (p: string, dir: -1 | 1) => {
    const i = order.indexOf(p);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= order.length) return;
    const n = [...order];
    [n[i], n[j]] = [n[j], n[i]];
    setOrder(n);
  };
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-4 rounded-xl border border-rule bg-card p-4">
        <Bot className="text-cobalt" />
        <div className="flex-1">
          <div className="font-semibold">AI-written challenge questions</div>
          <div className="text-sm text-slate">Providers are tried in order. If none respond, the built-in question generator is used, so challenges never stop working.</div>
        </div>
        <Toggle label="Enable AI" on={enabled} onChange={setEnabled} />
      </div>
      <div className="space-y-3">
        {all.map((p) => {
          const active = order.includes(p);
          const k = data.keys[p];
          return (
            <div key={p} className={clsx('rounded-xl border bg-card p-4', active ? 'border-rule' : 'border-dashed border-rule opacity-80')}>
              <div className="flex flex-wrap items-center gap-3">
                <Toggle label={`Use ${PROVIDER_LABEL[p]}`} on={active} onChange={(v) => setOrder(v ? [...order, p] : order.filter((x) => x !== p))} />
                <div className="flex-1 font-semibold">{active ? `${order.indexOf(p) + 1}. ` : ''}{PROVIDER_LABEL[p]}</div>
                {active && (
                  <div className="flex gap-1">
                    <button className="btn btn-ghost px-2.5 py-1 text-xs" onClick={() => move(p, -1)}>Up</button>
                    <button className="btn btn-ghost px-2.5 py-1 text-xs" onClick={() => move(p, 1)}>Down</button>
                  </div>
                )}
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate">Models, in order (comma-separated; later ones are fallbacks)</label>
                  <input className="input py-2" value={models[p] || ''} onChange={(e) => setModels({ ...models, [p]: e.target.value })} />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate">
                    API key {k.source === 'env' ? `(using Railway variable ${ENV_NAME[p]}: ${k.preview})` : k.source === 'admin' ? `(set here: ${k.preview})` : '(not set)'}
                  </label>
                  <div className="flex gap-2">
                    <input className="input py-2" type="password" autoComplete="off" placeholder={k.source === 'none' ? 'Paste key' : 'Leave empty to keep current key'} value={keys[p] || ''} onChange={(e) => setKeys({ ...keys, [p]: e.target.value })} />
                    {k.source === 'admin' && <button className="btn btn-ghost px-3 py-2 text-xs" title="Remove the key saved here and fall back to the Railway variable" onClick={() => setKeys({ ...keys, [p]: '__clear__' })}>Clear</button>}
                  </div>
                </div>
                {p === 'custom' && (
                  <div className="sm:col-span-2">
                    <label className="mb-1 block text-xs font-medium text-slate">Base URL (e.g. https://api.deepseek.com/v1)</label>
                    <input className="input py-2" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-wrap gap-3">
        <button className="btn btn-primary" disabled={save.isPending} onClick={() => save.mutate({ enabled, order, models, customBaseUrl: baseUrl, keys }, { onSuccess: () => setKeys({}) })}>Save AI settings</button>
        <button className="btn btn-ghost" disabled={check.isPending} onClick={() => check.mutate()}>{check.isPending ? <Spinner size={18} /> : 'Check all keys and models'}</button>
        <button className="btn btn-ghost" disabled={test.isPending} onClick={() => test.mutate()}>{test.isPending ? <Spinner size={18} /> : 'Test with a real profile'}</button>
      </div>
      <p className="-mt-2 text-xs text-slate">Save first if you changed anything. Checks use the saved settings and make one tiny request per model.</p>
      {check.isError && <p className="text-sm text-wrong">{errMsg(check.error)}</p>}
      {check.data && (
        <div className="overflow-x-auto rounded-xl border border-rule bg-card">
          <table className="w-full min-w-[620px] text-left text-sm">
            <thead className="border-b border-rule text-slate"><tr><th className="px-4 py-2.5 font-medium">Provider</th><th className="px-4 py-2.5 font-medium">Model</th><th className="px-4 py-2.5 font-medium">Key from</th><th className="px-4 py-2.5 font-medium">Result</th><th className="px-4 py-2.5 font-medium">Time</th></tr></thead>
            <tbody className="divide-y divide-rule">
              {check.data.results.map((r) => {
                const [label, tone] = STATE_LABEL[r.state] || [r.state, 'plain'];
                return (
                  <tr key={r.provider + r.model}>
                    <td className="px-4 py-2.5 font-medium">{PROVIDER_LABEL[r.provider]}</td>
                    <td className="px-4 py-2.5"><code className="text-xs">{r.model}</code></td>
                    <td className="px-4 py-2.5 text-slate">{r.source === 'env' ? 'Railway variable' : r.source === 'admin' ? 'Admin panel' : '—'}</td>
                    <td className="px-4 py-2.5"><Badge tone={tone}>{label}</Badge> <span className="text-slate">{r.state !== 'ok' && r.state !== 'missing' ? r.message : ''}</span></td>
                    <td className="px-4 py-2.5 text-slate">{r.ms ? `${(r.ms / 1000).toFixed(1)} s` : ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {test.data && (
        <div className="rounded-xl border border-rule bg-card p-4 text-sm">
          <div className="font-semibold">{test.data.provider ? `Worked with ${PROVIDER_LABEL[test.data.provider]} in ${(test.data.ms / 1000).toFixed(1)} s` : 'No provider produced usable questions, so members would get built-in questions.'} <span className="font-normal text-slate">Profile: {test.data.profile}</span></div>
          {test.data.errors.length > 0 && <ul className="mt-2 list-disc pl-5 text-wrong">{test.data.errors.map((e: string) => <li key={e}>{e}</li>)}</ul>}
          <ol className="mt-3 list-decimal space-y-2 pl-5">{test.data.questions.map((x: any) => <li key={x.q}>{x.q} <span className="text-slate">({x.options.join(' / ')})</span> <b className="text-right">{x.answer}</b></li>)}</ol>
        </div>
      )}
      {test.isError && <p className="text-sm text-wrong">{errMsg(test.error)}</p>}
    </div>
  );
}

/** Plans and payment methods are edited as structured JSON with validation on the server. */
function JsonList({ section, initial }: { section: 'plans' | 'paymentMethods'; initial: unknown }) {
  const [text, setText] = useState(JSON.stringify(initial, null, 2));
  const [err, setErr] = useState('');
  const save = useSave(section);
  const help =
    section === 'plans'
      ? 'Each plan: id (lowercase), name, months, pricePKR, priceUSD, and optional "highlight": true for the recommended plan.'
      : 'Each method: id, name, enabled, currency ("PKR" or "USD"), details (label and value pairs shown to members), optional link (card payment page, e.g. a Stripe, Payoneer or Lemon Squeezy link), and instructions.';
  return (
    <div>
      <p className="mb-3 text-sm text-slate">{help}</p>
      <textarea className="input min-h-[420px] font-mono text-[13px]" spellCheck={false} value={text} onChange={(e) => setText(e.target.value)} />
      {err && <p className="mt-2 text-sm text-wrong">{err}</p>}
      <button
        className="btn btn-primary mt-4"
        disabled={save.isPending}
        onClick={() => {
          setErr('');
          try {
            save.mutate(JSON.parse(text));
          } catch {
            setErr('That isn’t valid JSON. Check for missing commas or quotes.');
          }
        }}
      >
        Save
      </button>
    </div>
  );
}

function AdsSettings({ initial }: { initial: any }) {
  const [a, setA] = useState(initial);
  const save = useSave('ads');
  const field = (k: string, label: string, hint: string) => (
    <div>
      <label className="label" htmlFor={k}>{label}</label>
      <input id={k} className="input" value={a[k]} onChange={(e) => setA({ ...a, [k]: e.target.value })} />
      <p className="mt-1 text-xs text-slate">{hint}</p>
    </div>
  );
  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-4 rounded-xl border border-rule bg-card p-4">
        <Megaphone className="text-cobalt" />
        <div className="flex-1"><div className="font-semibold">Show ads to free members</div><div className="text-sm text-slate">Premium members never see ads.</div></div>
        <Toggle label="Show ads" on={a.enabled} onChange={(v) => setA({ ...a, enabled: v })} />
      </div>
      {field('adsenseClient', 'AdSense publisher ID (website)', 'Looks like ca-pub-1234567890123456')}
      {field('slotDiscover', 'Ad unit ID for Discover', 'From AdSense → Ads → By ad unit')}
      {field('slotChats', 'Ad unit ID for Chats', '')}
      {field('admobAppId', 'AdMob app ID (Android app, for later)', 'Looks like ca-app-pub-…~…')}
      <button className="btn btn-primary mt-6" disabled={save.isPending} onClick={() => save.mutate(a)}>Save</button>
    </div>
  );
}

function LimitsSettings({ initial }: { initial: any }) {
  const [l, setL] = useState(initial);
  const save = useSave('limits');
  const num = (k: string, label: string) => (
    <div>
      <label className="label" htmlFor={k}>{label}</label>
      <input id={k} type="number" min={0} className="input" value={l[k]} onChange={(e) => setL({ ...l, [k]: Number(e.target.value) })} />
    </div>
  );
  return (
    <div className="grid max-w-xl gap-x-4 sm:grid-cols-2">
      {num('freeDailyChallenges', 'Challenges per day, free')}
      {num('premiumDailyChallenges', 'Challenges per day, Premium')}
      {num('freeRetakeHours', 'Hours before retaking, free')}
      {num('premiumRetakeHours', 'Hours before retaking, Premium')}
      <div className="sm:col-span-2"><button className="btn btn-primary mt-6" disabled={save.isPending} onClick={() => save.mutate(l)}>Save</button></div>
    </div>
  );
}

function AuditPage() {
  const q = useQuery({ queryKey: ['admin', 'audit'], queryFn: () => adminApi.get<{ audit: any[] }>('/audit') });
  return (
    <>
      <Header title="Activity log" />
      <Loading q={q} />
      <div className="overflow-x-auto rounded-xl border border-rule bg-card">
        <table className="w-full min-w-[600px] text-left text-sm">
          <thead className="border-b border-rule text-slate"><tr><th className="px-4 py-2.5 font-medium">When</th><th className="px-4 py-2.5 font-medium">Action</th><th className="px-4 py-2.5 font-medium">Target</th><th className="px-4 py-2.5 font-medium">IP</th></tr></thead>
          <tbody className="divide-y divide-rule">
            {q.data?.audit.map((a) => (
              <tr key={a.id}><td className="px-4 py-2.5 text-slate">{date(a.created_at)}</td><td className="px-4 py-2.5">{a.action.replace(/_/g, ' ')}</td><td className="px-4 py-2.5"><code className="text-xs">{a.target || ''}</code></td><td className="px-4 py-2.5 text-slate">{a.ip}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

