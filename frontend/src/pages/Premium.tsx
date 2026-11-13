import { useState } from 'react';
import { Link } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Check, Copy, ExternalLink, ImagePlus } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import { useConfig } from '../lib/config';
import { prepareImage } from '../lib/image';
import { uploadBlob } from '../lib/upload';
import type { Payment } from '../lib/types';
import { useToast } from '../context/Toast';
import { ErrorState, FullScreenLoader, Spinner } from '../components/ui';

const money = (n: number, c: string) => (c === 'USD' ? `$${n.toFixed(2)}` : `Rs ${Math.round(n).toLocaleString()}`);

export default function PremiumPage() {
  const cfg = useConfig();
  const qc = useQueryClient();
  const toast = useToast();
  const payments = useQuery({ queryKey: ['payments'], queryFn: () => api.get<{ payments: Payment[] }>('/payments') });
  const [planId, setPlanId] = useState('');
  const [methodId, setMethodId] = useState('');
  const [reference, setReference] = useState('');
  const [sender, setSender] = useState('');
  const [proof, setProof] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  if (cfg.isLoading) return <FullScreenLoader />;
  if (cfg.isError) return <ErrorState message={errMsg(cfg.error)} onRetry={() => cfg.refetch()} />;
  const c = cfg.data!;
  const plan = c.plans.find((p) => p.id === (planId || c.plans.find((x) => x.highlight)?.id || c.plans[0]?.id));
  const method = c.paymentMethods.find((m) => m.id === (methodId || c.paymentMethods[0]?.id));
  const pending = payments.data?.payments.filter((p) => p.status === 'pending') || [];

  const copy = (v: string) => navigator.clipboard?.writeText(v).then(() => toast({ title: 'Copied', tone: 'success' })).catch(() => {});

  const submit = async () => {
    setErr('');
    if (!plan || !method) return;
    if (reference.trim().length < 4) return setErr('Enter the transaction ID from your payment receipt.');
    setBusy(true);
    try {
      let proofKey: string | undefined;
      if (proof) proofKey = (await uploadBlob('proof', await prepareImage(proof, 1600, 0.85))).key;
      await api.post('/payments', { planId: plan.id, methodId: method.id, reference: reference.trim(), sender: sender.trim(), proofKey });
      setReference('');
      setSender('');
      setProof(null);
      qc.invalidateQueries({ queryKey: ['payments'] });
      toast({ title: 'Payment submitted', body: 'We’ll activate Premium as soon as we confirm it, usually within a few hours.', tone: 'success' });
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const perks = [
    'No ads anywhere in the app',
    `${c.limits.premiumDailyChallenges} challenges a day instead of ${c.limits.freeDailyChallenges}`,
    `Retake a challenge after ${c.limits.premiumRetakeHours} hours instead of ${c.limits.freeRetakeHours}`,
    'Your profile is shown earlier in Discover',
    'A Premium label on your profile',
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-bold">Match360 Premium</h1>
      {c.premium ? (
        <p className="mt-2 text-slate">Premium is active until <b className="text-ink">{new Date(c.premiumUntil!).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' })}</b>. You can extend it below.</p>
      ) : (
        <p className="mt-2 text-slate">Free accounts see ads and can take {c.limits.freeDailyChallenges} challenges a day. Premium removes the limits.</p>
      )}

      <ul className="mt-6 grid gap-2 sm:grid-cols-2">
        {perks.map((p) => <li key={p} className="flex items-start gap-2.5"><Check size={18} className="mt-0.5 shrink-0 text-right" />{p}</li>)}
      </ul>

      <h2 className="mt-10 text-xl font-bold">1. Choose a plan</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {c.plans.map((p) => (
          <button key={p.id} onClick={() => setPlanId(p.id)} className={clsx('rounded-xl border-2 bg-card p-4 text-left transition-colors', plan?.id === p.id ? 'border-cobalt' : 'border-rule hover:border-slate/40')}>
            <div className="flex items-center justify-between">
              <span className="font-semibold">{p.name}</span>
              {p.highlight && <span className="rounded-md bg-marker px-2 py-0.5 text-xs font-semibold">Best value</span>}
            </div>
            <div className="mt-2 font-display text-2xl font-bold">{money(p.pricePKR, 'PKR')}</div>
            <div className="text-sm text-slate">or {money(p.priceUSD, 'USD')} by card</div>
          </button>
        ))}
      </div>

      <h2 className="mt-10 text-xl font-bold">2. Pay</h2>
      <div className="mt-4 flex flex-wrap gap-2">
        {c.paymentMethods.map((m) => <button key={m.id} onClick={() => setMethodId(m.id)} className={clsx('chip px-4 py-2', method?.id === m.id && 'chip-on')}>{m.name}</button>)}
      </div>
      {method && plan && (
        <div className="mt-4 rounded-xl border border-rule bg-card p-5">
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-slate">Amount to pay</span>
            <span className="font-display text-2xl font-bold">{money(method.currency === 'USD' ? plan.priceUSD : plan.pricePKR, method.currency)}</span>
          </div>
          <p className="mt-3 text-sm text-slate">{method.instructions}</p>
          {method.details.length > 0 && (
            <dl className="mt-4 divide-y divide-rule rounded-lg border border-rule">
              {method.details.map((d) => (
                <div key={d.label} className="flex items-center justify-between gap-3 px-4 py-2.5">
                  <dt className="text-sm text-slate">{d.label}</dt>
                  <dd className="flex items-center gap-2 font-semibold">
                    {d.value}
                    <button onClick={() => copy(d.value)} aria-label={`Copy ${d.label}`} className="rounded-md p-1 text-slate hover:bg-paper hover:text-ink"><Copy size={14} /></button>
                  </dd>
                </div>
              ))}
            </dl>
          )}
          {method.link && <a href={method.link} target="_blank" rel="noreferrer" className="btn btn-primary mt-4">Open payment page <ExternalLink size={16} /></a>}
        </div>
      )}

      <h2 className="mt-10 text-xl font-bold">3. Confirm your payment</h2>
      <div className="mt-4 rounded-xl border border-rule bg-card p-5">
        <div className="grid gap-x-3 sm:grid-cols-2">
          <div>
            <label className="label mt-0" htmlFor="ref">Transaction ID</label>
            <input id="ref" className="input" value={reference} onChange={(e) => setReference(e.target.value)} maxLength={80} placeholder="From your receipt or SMS" />
          </div>
          <div>
            <label className="label mt-5 sm:mt-0" htmlFor="sender">Sender name or number <span className="font-normal text-slate">(optional)</span></label>
            <input id="sender" className="input" value={sender} onChange={(e) => setSender(e.target.value)} maxLength={80} />
          </div>
        </div>
        <label className="mt-4 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-rule p-3 text-sm hover:border-cobalt">
          <ImagePlus size={18} className="text-cobalt" />
          {proof ? proof.name : 'Attach a screenshot of the receipt (optional, speeds up review)'}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => setProof(e.target.files?.[0] || null)} />
        </label>
        {err && <p role="alert" className="mt-4 rounded-xl bg-wrong/10 px-4 py-3 text-sm text-wrong">{err}</p>}
        <button onClick={submit} disabled={busy || !plan || !method} className="btn btn-primary mt-5 w-full sm:w-auto">{busy ? <Spinner size={18} className="text-white" /> : 'Submit payment'}</button>
      </div>

      {payments.data && payments.data.payments.length > 0 && (
        <>
          <h2 className="mt-10 text-xl font-bold">Your payments</h2>
          <div className="mt-4 divide-y divide-rule rounded-xl border border-rule bg-card">
            {payments.data.payments.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
                <div>
                  <div className="font-semibold">{p.plan}</div>
                  <div className="text-slate">{p.method}, {money(Number(p.amount), p.currency)}, ref {p.reference}</div>
                  {p.note && <div className="text-slate">Note: {p.note}</div>}
                </div>
                <span className={clsx('rounded-full px-2.5 py-1 text-xs font-semibold capitalize', p.status === 'approved' ? 'bg-right/10 text-right' : p.status === 'rejected' ? 'bg-wrong/10 text-wrong' : 'bg-marker/50')}>{p.status === 'pending' ? 'Under review' : p.status}</span>
              </div>
            ))}
          </div>
        </>
      )}
      {pending.length > 0 && <p className="mt-3 text-sm text-slate">Payments are usually confirmed within a few hours. You’ll get an email when it’s done.</p>}
      <p className="mt-8 text-sm text-slate">See our <Link to="/refunds" className="text-cobalt underline">Refund policy</Link> and <Link to="/terms" className="text-cobalt underline">Terms</Link>.</p>
    </div>
  );
}
