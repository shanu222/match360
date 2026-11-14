import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Check, Copy, ExternalLink, ImagePlus, Smartphone } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import { useConfig } from '../lib/config';
import { prepareImage } from '../lib/image';
import { uploadBlob } from '../lib/upload';
import type { Payment, PaymentMethod, Plan } from '../lib/types';
import { useToast } from '../context/Toast';
import { useAuth } from '../context/AuthContext';
import { ErrorState, FullScreenLoader, Spinner } from '../components/ui';
import { isAndroidApp, openExternal } from '../lib/platform';
import { MANAGE_URL, PLAY_STORE_URL, listPremiumPlans, playBillingAvailable, purchasePremium, restorePremium, type PlayPlan } from '../native/billing';

const money = (n: number, c: string) => (c === 'USD' ? `$${n.toFixed(2)}` : `Rs ${Math.round(n).toLocaleString()}`);
const longDate = (d: string) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

/**
 * Android users buy Premium in the app through Google Play. Until the iOS app is out, iPhone and desktop users pay
 * directly on the website and the team confirms the slip. Either way Premium belongs to the account and works everywhere.
 */
export default function PremiumPage() {
  const cfg = useConfig();
  // Direct payments (website only) and their status.
  const payments = useQuery({ queryKey: ['payments'], queryFn: () => api.get<{ payments: Payment[] }>('/payments'), enabled: !isAndroidApp });

  if (cfg.isLoading) return <FullScreenLoader />;
  if (cfg.isError) return <ErrorState message={errMsg(cfg.error)} onRetry={() => cfg.refetch()} />;
  const c = cfg.data!;

  const perks = [
    'No ads anywhere in the app',
    `Connect with ${c.limits.premiumDailyChallenges} people a day instead of ${c.limits.freeDailyChallenges}`,
    `Try again after ${c.limits.premiumRetakeHours} hours instead of ${c.limits.freeRetakeHours}`,
    'Your profile is shown earlier in Discover',
    'See who viewed your profile',
    'A Premium label on your profile',
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-3xl font-bold">Match360 Premium</h1>
      {c.premium ? (
        <p className="mt-2 text-slate">Premium is active until <b className="text-ink">{longDate(c.premiumUntil!)}</b>. Thank you for supporting Match360.</p>
      ) : (
        <p className="mt-2 text-slate">Free accounts see ads and can connect with {c.limits.freeDailyChallenges} people a day. Premium removes the limits.</p>
      )}
      <ul className="mt-6 grid gap-2 sm:grid-cols-2">
        {perks.map((p) => <li key={p} className="flex items-start gap-2.5"><Check size={18} className="mt-0.5 shrink-0 text-right" />{p}</li>)}
      </ul>

      {isAndroidApp ? (
        playBillingAvailable ? (
          <PlayPurchase premium={c.premium} plans={c.plans} />
        ) : (
          !c.premium && <p className="mt-8 rounded-xl border border-rule bg-card p-4 text-sm text-slate">Premium can’t be purchased in the app yet. If your account already has Premium, it is active here automatically.</p>
        )
      ) : (
        <WebPremium premium={c.premium} plans={c.plans} methods={c.paymentMethods} pending={payments.data?.payments.filter((p) => p.status === 'pending').length || 0} />
      )}

      {!isAndroidApp && payments.data && payments.data.payments.length > 0 && (
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

      <p className="mt-8 text-sm text-slate">
        See our {!isAndroidApp && <><Link to="/refunds" className="text-cobalt underline">Refund policy</Link> and </>}<Link to="/terms" className="text-cobalt underline">Terms</Link>.
      </p>
    </div>
  );
}

const onApple = () => typeof navigator !== 'undefined' && /iphone|ipad|ipod|macintosh/i.test(navigator.userAgent);

/**
 * Website only. Members choose where they use Match360:
 *  - Android: Premium is bought in the app through Google Play.
 *  - iPhone: the iOS app is not out yet, so they pay directly (Easypaisa, JazzCash or bank transfer) and send the
 *    slip here. The team gets an email with the slip and confirms it; Premium then works with the same account.
 * None of this is ever shown inside the Android app (Google Play rule), where the page sells through Play only.
 */
function WebPremium({ premium, plans, methods, pending }: { premium: boolean; plans: Plan[]; methods: PaymentMethod[]; pending: number }) {
  const qc = useQueryClient();
  const toast = useToast();
  const [device, setDevice] = useState<'android' | 'ios'>(onApple() ? 'ios' : 'android');
  const [planId, setPlanId] = useState('');
  const [methodId, setMethodId] = useState('');
  const [reference, setReference] = useState('');
  const [sender, setSender] = useState('');
  const [slip, setSlip] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const plan = plans.find((p) => p.id === planId) || plans.find((p) => p.highlight) || plans[0];
  const method = methods.find((m) => m.id === methodId) || methods[0];
  const ios = device === 'ios';

  const copy = (v: string) => navigator.clipboard?.writeText(v).then(() => toast({ title: 'Copied', tone: 'success' })).catch(() => {});

  const submit = async () => {
    setErr('');
    if (!plan || !method) return;
    if (reference.trim().length < 4) return setErr('Enter the transaction ID from your payment receipt.');
    if (!slip) return setErr('Attach a screenshot or photo of the payment slip.');
    setBusy(true);
    try {
      const proofKey = (await uploadBlob('proof', await prepareImage(slip, 1600, 0.85))).key;
      await api.post('/payments', { planId: plan.id, methodId: method.id, reference: reference.trim(), sender: sender.trim(), proofKey });
      setReference('');
      setSender('');
      setSlip(null);
      qc.invalidateQueries({ queryKey: ['payments'] });
      toast({ title: 'Payment sent for confirmation', body: 'We’ll check it and switch Premium on, usually within a few hours. You’ll get an email and a notification here.', tone: 'success' });
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-10">
      <h2 className="text-xl font-bold">{premium ? 'Extend Premium' : 'Get Premium'}</h2>
      <p className="mt-1 text-slate">Where do you use Match360?</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {([['android', 'Android phone', 'Buy in the app with Google Play'], ['ios', 'iPhone or computer', 'iOS app coming soon. Pay by Easypaisa, JazzCash or bank']] as const).map(([id, title, sub]) => (
          <button key={id} onClick={() => setDevice(id)} aria-pressed={device === id} className={clsx('flex items-start gap-3 rounded-xl border-2 bg-card p-4 text-left transition-colors', device === id ? 'border-cobalt' : 'border-rule hover:border-slate/40')}>
            <Smartphone size={22} className="mt-0.5 shrink-0 text-cobalt" />
            <span><span className="block font-semibold">{title}</span><span className="block text-sm text-slate">{sub}</span></span>
          </button>
        ))}
      </div>

      <h3 className="mt-8 font-semibold">{ios ? '1. Choose a plan' : 'Plans'}</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {plans.map((p) => {
          const body = (
            <>
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold">{p.name}</span>
                {p.highlight && <span className="shrink-0 whitespace-nowrap rounded-md bg-marker px-2 py-0.5 text-xs font-semibold">Best value</span>}
              </div>
              <div className="mt-2 font-display text-2xl font-bold">{money(p.pricePKR, 'PKR')}</div>
              <div className="text-sm text-slate">about {money(p.priceUSD, 'USD')} outside Pakistan</div>
            </>
          );
          return ios ? (
            <button key={p.id} onClick={() => setPlanId(p.id)} aria-pressed={plan?.id === p.id} className={clsx('rounded-xl border-2 bg-card p-4 text-left transition-colors', plan?.id === p.id ? 'border-cobalt' : 'border-rule hover:border-slate/40')}>{body}</button>
          ) : (
            <div key={p.id} className={clsx('rounded-xl border-2 bg-card p-4', p.highlight ? 'border-cobalt' : 'border-rule')}>{body}</div>
          );
        })}
      </div>

      {!ios && (
        <div className="mt-6 rounded-xl border border-rule bg-card p-5">
          <h3 className="text-lg font-bold">Buy in the Android app</h3>
          <p className="mt-1 text-slate">Premium is bought through Google Play in the Match360 app, and works here on the website too with the same account. Google Play shows the exact price in your currency before you pay.</p>
          <ol className="mt-4 list-decimal space-y-1.5 pl-5 text-slate">
            <li>Install Match360 from Google Play on your Android phone.</li>
            <li>Sign in with the same account you use here.</li>
            <li>Open Settings, then Premium, and choose a plan.</li>
          </ol>
          <a href={PLAY_STORE_URL} target="_blank" rel="noreferrer" className="btn btn-primary mt-5 w-full sm:w-auto">Get Match360 on Google Play <ExternalLink size={16} /></a>
        </div>
      )}

      {ios && (
        <>
          <p className="mt-4 rounded-xl bg-cobalt-soft px-4 py-3 text-sm">The Match360 iPhone app is coming soon. Until then, pay directly below and use Premium on this website; it will carry over to the iPhone app with the same account.</p>
          {methods.length === 0 || !plan ? (
            <p className="mt-6 rounded-xl border border-rule bg-card p-4 text-sm text-slate">Direct payment isn’t available right now. Please contact support and we’ll help you get Premium.</p>
          ) : (
            <>
              <h3 className="mt-8 font-semibold">2. Pay</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {methods.map((m) => <button key={m.id} onClick={() => setMethodId(m.id)} className={clsx('chip px-4 py-2', method?.id === m.id && 'chip-on')}>{m.name}</button>)}
              </div>
              {method && (
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

              <h3 className="mt-8 font-semibold">3. Send us the slip</h3>
              <div className="mt-3 rounded-xl border border-rule bg-card p-5">
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
                <label className={clsx('mt-4 flex cursor-pointer items-center gap-3 rounded-xl border border-dashed p-3 text-sm hover:border-cobalt', slip ? 'border-cobalt' : 'border-rule')}>
                  <ImagePlus size={18} className="shrink-0 text-cobalt" />
                  <span className="min-w-0 truncate">{slip ? slip.name : 'Attach a screenshot or photo of the payment slip'}</span>
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => setSlip(e.target.files?.[0] || null)} />
                </label>
                {err && <p role="alert" className="mt-4 rounded-xl bg-wrong/10 px-4 py-3 text-sm text-wrong">{err}</p>}
                <button onClick={submit} disabled={busy} className="btn btn-primary mt-5 w-full sm:w-auto">{busy ? <Spinner size={18} className="text-white" /> : 'Send for confirmation'}</button>
                <p className="mt-3 text-sm text-slate">{pending > 0 ? 'Your payment is being checked. You’ll get an email and a notification here when Premium is on.' : 'We check each payment by hand, usually within a few hours.'}</p>
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

/**
 * Android app only: buy Premium with Google Play. Plans and prices come from Google Play through RevenueCat;
 * names and the "Best value" mark follow the same plan list the website shows, matched by length.
 * The backend turns Premium on after it has confirmed the purchase, so this waits for that before saying "active".
 */
function PlayPurchase({ premium, plans: catalog }: { premium: boolean; plans: Plan[] }) {
  const { me, refetchMe } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const uid = me?.user.id || '';
  const plans = useQuery({ queryKey: ['playPlans', uid], queryFn: () => listPremiumPlans(uid), enabled: Boolean(uid) && !premium, staleTime: 5 * 60_000, retry: 1 });
  const [picked, setPicked] = useState('');
  const [busy, setBusy] = useState<'' | 'buy' | 'restore'>('');
  const [err, setErr] = useState('');
  const list = (plans.data || []).map((p) => {
    const same = catalog.find((x) => x.months === p.months);
    return { ...p, name: same?.name || p.name, highlight: Boolean(same?.highlight) };
  });
  const plan: (PlayPlan & { highlight: boolean }) | undefined = list.find((p) => p.id === picked) || list.find((p) => p.highlight) || list[0];
  useEffect(() => setErr(''), [picked]);

  /** Asks the backend to confirm the purchase with RevenueCat; retries briefly because the store can lag a few seconds. */
  const activate = async () => {
    for (let i = 0; i < 8; i++) {
      const r = await api.post<{ premium: boolean }>('/billing/sync').catch(() => null);
      if (r?.premium) break;
      await new Promise((ok) => setTimeout(ok, 2500));
    }
    await qc.invalidateQueries({ queryKey: ['config'] });
    refetchMe();
    return Boolean(qc.getQueryData<{ premium: boolean }>(['config'])?.premium);
  };

  const run = async (kind: 'buy' | 'restore') => {
    if (!uid || busy) return;
    setErr('');
    setBusy(kind);
    try {
      if (kind === 'buy') {
        if (!plan || !(await purchasePremium(uid, plan.id))) return;
      } else if (!(await restorePremium(uid))) {
        return setErr('No Premium purchase was found for the Google account on this phone.');
      }
      if (await activate()) toast({ title: 'Premium is active', body: 'Thank you for supporting Match360.', tone: 'success' });
      else toast({ title: 'Payment received', body: 'Premium will switch on in a moment. If it doesn’t, tap Restore purchases.', tone: 'success' });
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy('');
    }
  };

  if (premium) {
    return (
      <div className="mt-8 rounded-xl border border-rule bg-card p-4 text-sm text-slate">
        Bought through Google Play? You can change or cancel your subscription in Google Play at any time.
        <button className="btn btn-ghost mt-3 w-full" onClick={() => openExternal(MANAGE_URL)}>Manage subscription <ExternalLink size={16} /></button>
      </div>
    );
  }
  return (
    <div className="mt-8">
      <h2 className="text-xl font-bold">Choose a plan</h2>
      {plans.isLoading && <div className="mt-4 flex justify-center py-6"><Spinner size={22} /></div>}
      {!plans.isLoading && list.length === 0 && (
        <p className="mt-4 rounded-xl border border-rule bg-card p-4 text-sm text-slate">
          Plans couldn’t be loaded from Google Play right now. Check your connection and that you’re signed in to Google Play, then{' '}
          <button className="text-cobalt underline" onClick={() => plans.refetch()}>try again</button>.
        </p>
      )}
      {list.length > 0 && (
        <>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            {list.map((p) => (
              <button key={p.id} onClick={() => setPicked(p.id)} aria-pressed={plan?.id === p.id} className={clsx('rounded-xl border-2 bg-card p-4 text-left transition-colors', plan?.id === p.id ? 'border-cobalt' : 'border-rule')}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold">{p.name}</span>
                  {p.highlight && <span className="shrink-0 whitespace-nowrap rounded-md bg-marker px-2 py-0.5 text-xs font-semibold">Best value</span>}
                </div>
                <div className="mt-2 font-display text-2xl font-bold">{p.price}</div>
                <div className="text-sm text-slate">{p.period ? `every ${p.period}` : 'one payment'}{p.perMonth ? `, ${p.perMonth} a month` : ''}</div>
              </button>
            ))}
          </div>
          <button onClick={() => run('buy')} disabled={Boolean(busy) || !plan} className="btn btn-primary mt-5 w-full">
            {busy === 'buy' ? <Spinner size={18} className="text-white" /> : 'Continue with Google Play'}
          </button>
          {plan?.recurring && (
            <p className="mt-3 text-sm text-slate">
              {plan.price} is charged to your Google Play account every {plan.period} until you cancel. Cancel any time in Google Play, under Payments and subscriptions.
            </p>
          )}
        </>
      )}
      {err && <p role="alert" className="mt-4 rounded-xl bg-wrong/10 px-4 py-3 text-sm text-wrong">{err}</p>}
      <button onClick={() => run('restore')} disabled={Boolean(busy)} className="btn btn-quiet mt-3 w-full text-sm">
        {busy === 'restore' ? <Spinner size={16} /> : 'Restore purchases'}
      </button>
    </div>
  );
}
