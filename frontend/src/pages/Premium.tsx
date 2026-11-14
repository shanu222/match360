import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import clsx from 'clsx';
import { Check, ExternalLink, Smartphone } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import { useConfig } from '../lib/config';
import type { Payment, Plan } from '../lib/types';
import { useToast } from '../context/Toast';
import { useAuth } from '../context/AuthContext';
import { ErrorState, FullScreenLoader, Spinner } from '../components/ui';
import { isAndroidApp, openExternal } from '../lib/platform';
import { MANAGE_URL, PLAY_STORE_URL, listPremiumPlans, playBillingAvailable, purchasePremium, restorePremium, type PlayPlan } from '../native/billing';

const money = (n: number, c: string) => (c === 'USD' ? `$${n.toFixed(2)}` : `Rs ${Math.round(n).toLocaleString()}`);
const longDate = (d: string) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

/**
 * Premium is sold in one place only: the Android app, through Google Play. The website shows the same plans
 * and sends people to the app; Premium bought there (or given by an admin) works everywhere with the same account.
 */
export default function PremiumPage() {
  const cfg = useConfig();
  // Payments made directly before Premium moved to Google Play are still listed on the website.
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
        <GetTheApp premium={c.premium} plans={c.plans} />
      )}

      {!isAndroidApp && payments.data && payments.data.payments.length > 0 && (
        <>
          <h2 className="mt-10 text-xl font-bold">Your earlier payments</h2>
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

/** Website: the same plans as the app, and the way to get them. Nothing is sold on the website itself. */
function GetTheApp({ premium, plans }: { premium: boolean; plans: Plan[] }) {
  return (
    <div className="mt-10">
      <h2 className="text-xl font-bold">Plans</h2>
      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {plans.map((p) => (
          <div key={p.id} className={clsx('rounded-xl border-2 bg-card p-4', p.highlight ? 'border-cobalt' : 'border-rule')}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">{p.name}</span>
              {p.highlight && <span className="shrink-0 whitespace-nowrap rounded-md bg-marker px-2 py-0.5 text-xs font-semibold">Best value</span>}
            </div>
            <div className="mt-2 font-display text-2xl font-bold">{money(p.pricePKR, 'PKR')}</div>
            <div className="text-sm text-slate">about {money(p.priceUSD, 'USD')} outside Pakistan</div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-sm text-slate">Google Play shows the exact price in your currency before you pay, and it can differ slightly from the prices here.</p>

      <div className="mt-8 rounded-xl border border-rule bg-card p-5">
        <div className="flex items-start gap-3">
          <Smartphone size={22} className="mt-0.5 shrink-0 text-cobalt" />
          <div>
            <h2 className="text-lg font-bold">{premium ? 'Manage Premium in the Android app' : 'Get Premium in the Android app'}</h2>
            <p className="mt-1 text-slate">Premium is bought through Google Play in the Match360 app. It then works here on the website too, with the same account.</p>
          </div>
        </div>
        <ol className="mt-4 list-decimal space-y-1.5 pl-5 text-slate">
          <li>Install Match360 from Google Play on your Android phone.</li>
          <li>Sign in with the same account you use here.</li>
          <li>Open Settings, then Premium, and choose a plan.</li>
        </ol>
        <a href={PLAY_STORE_URL} target="_blank" rel="noreferrer" className="btn btn-primary mt-5 w-full sm:w-auto">Get Match360 on Google Play <ExternalLink size={16} /></a>
      </div>
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
