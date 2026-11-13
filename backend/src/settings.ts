import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { config } from './config.js';
import { q } from './db.js';

/* ---------- secret handling ---------- */
export function serverSecret() {
  return (
    config.admin.secret ||
    createHash('sha256')
      .update(`m360|${config.admin.password}|${config.firebase.privateKey}|${config.databaseUrl}`)
      .digest('hex')
  );
}
const encKey = () => createHash('sha256').update(`enc|${serverSecret()}`).digest();

export function encrypt(plain: string) {
  if (!plain) return '';
  const iv = randomBytes(12);
  const c = createCipheriv('aes-256-gcm', encKey(), iv);
  const data = Buffer.concat([c.update(plain, 'utf8'), c.final()]);
  return `v1:${iv.toString('base64')}:${c.getAuthTag().toString('base64')}:${data.toString('base64')}`;
}
export function decrypt(blob: string) {
  try {
    if (!blob?.startsWith('v1:')) return '';
    const [, iv, tag, data] = blob.split(':');
    const d = createDecipheriv('aes-256-gcm', encKey(), Buffer.from(iv, 'base64'));
    d.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([d.update(Buffer.from(data, 'base64')), d.final()]).toString('utf8');
  } catch {
    return '';
  }
}
export const mask = (k: string) => (k ? `${k.slice(0, 4)}…${k.slice(-4)}` : '');

/* ---------- typed settings with defaults ---------- */
export interface Plan { id: string; name: string; months: number; pricePKR: number; priceUSD: number; highlight?: boolean }
export interface PaymentMethod { id: string; name: string; enabled: boolean; currency: 'PKR' | 'USD'; details: { label: string; value: string }[]; link?: string; instructions: string }
export type Provider = 'openai' | 'gemini' | 'anthropic' | 'groq' | 'openrouter' | 'custom';
export const PROVIDERS: Provider[] = ['openai', 'gemini', 'openrouter', 'anthropic', 'groq', 'custom'];
export interface AiSettings {
  enabled: boolean;
  order: Provider[];
  models: Record<Provider, string>;
  keys: Partial<Record<Provider, string>>; // encrypted overrides set from the admin panel
  customBaseUrl: string;
}

export const DEFAULTS = {
  plans: [
    { id: 'monthly', name: 'Premium monthly', months: 1, pricePKR: 999, priceUSD: 4.99 },
    { id: 'halfyear', name: 'Premium 6 months', months: 6, pricePKR: 4499, priceUSD: 22.99, highlight: true },
    { id: 'yearly', name: 'Premium yearly', months: 12, pricePKR: 7999, priceUSD: 39.99 },
  ] as Plan[],
  paymentMethods: [
    { id: 'easypaisa', name: 'Easypaisa', enabled: true, currency: 'PKR', details: [{ label: 'Easypaisa number', value: '03403318127' }, { label: 'Account title', value: 'Shahnawaz' }], instructions: 'Send the exact amount to this Easypaisa account, then enter the transaction ID (TID) below.' },
    { id: 'jazzcash', name: 'JazzCash', enabled: true, currency: 'PKR', details: [{ label: 'JazzCash number', value: '03403318127' }, { label: 'Account title', value: 'Shahnawaz' }], instructions: 'Send the exact amount to this JazzCash account, then enter the transaction ID below.' },
    { id: 'bank', name: 'Bank transfer', enabled: true, currency: 'PKR', details: [{ label: 'Bank', value: 'HBL (Habib Bank Limited)' }, { label: 'Account title', value: 'Shahnawaz' }, { label: 'Account number', value: '24897000279603' }, { label: 'IBAN', value: 'PK43HABB0024897000279603' }, { label: 'Branch', value: 'Karsaz, Karachi' }], instructions: 'Transfer the exact amount from any Pakistani bank or app, then enter the transaction reference below.' },
    { id: 'card', name: 'International card', enabled: false, currency: 'USD', details: [], link: '', instructions: 'Pay securely by card using the payment link, then enter the receipt or order number below.' },
  ] as PaymentMethod[],
  ads: { enabled: false, adsenseClient: '', slotDiscover: '', slotChats: '', admobAppId: '' },
  limits: { freeDailyChallenges: 10, premiumDailyChallenges: 50, freeRetakeHours: 24, premiumRetakeHours: 6 },
  ai: {
    enabled: true,
    // Defaults come from Railway variables when set (AI_PROVIDER_ORDER, OPENAI_MODEL, GEMINI_MODEL, OPENROUTER_MODELS, …).
    order: ((): Provider[] => {
      const fromEnv = config.aiEnv.order.filter((p): p is Provider => ['openai', 'gemini', 'anthropic', 'groq', 'openrouter', 'custom'].includes(p));
      return fromEnv.length ? fromEnv : ['openai', 'gemini', 'openrouter', 'anthropic', 'groq'];
    })(),
    // Each value is a comma-separated list: the first model is tried first, the rest are fallbacks.
    models: {
      openai: config.aiEnv.openai || 'gpt-4.1-mini,gpt-4o-mini',
      gemini: config.aiEnv.gemini || 'gemini-2.5-flash,gemini-2.0-flash',
      openrouter: config.aiEnv.openrouter || 'meta-llama/llama-3.3-70b-instruct:free',
      anthropic: config.aiEnv.anthropic || 'claude-haiku-5-5',
      groq: config.aiEnv.groq || 'llama-3.3-70b-versatile',
      custom: '',
    },
    keys: {},
    customBaseUrl: '',
  } as AiSettings,
};
export type SettingKey = keyof typeof DEFAULTS;

const cache = new Map<string, { v: any; at: number }>();
export async function getSetting<K extends SettingKey>(key: K): Promise<(typeof DEFAULTS)[K]> {
  const c = cache.get(key);
  if (c && Date.now() - c.at < 30_000) return c.v;
  let v: any = DEFAULTS[key];
  try {
    const r = await q('SELECT value FROM settings WHERE key=$1', [key]);
    if (r.rows[0]) {
      const stored = r.rows[0].value;
      v = Array.isArray(DEFAULTS[key]) ? stored : { ...(DEFAULTS[key] as object), ...stored };
    }
  } catch (e: any) {
    console.warn('[settings] read failed', e?.message);
  }
  cache.set(key, { v, at: Date.now() });
  return v;
}
export async function setSetting(key: SettingKey, value: unknown) {
  await q(
    `INSERT INTO settings (key, value, updated_at) VALUES ($1,$2,now())
     ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value, updated_at=now()`,
    [key, JSON.stringify(value)],
  );
  cache.delete(key);
}

/** Effective API key for a provider: admin override first, then the environment variable. */
export async function aiKey(p: Provider) {
  const ai = await getSetting('ai');
  const override = ai.keys?.[p] ? decrypt(ai.keys[p]!) : '';
  if (override) return override;
  return p === 'custom' ? '' : (config.ai as Record<string, string>)[p] || '';
}
