import { aiKey, getSetting, PROVIDERS, type Provider } from './settings.js';
import { config } from './config.js';
import type { StoredQuestion } from './quiz.js';

/**
 * Generates quiz questions from a member's full profile using the configured AI providers, in order.
 * Every question is validated against the profile text; anything that can't be verified is dropped.
 * Returns [] if no provider is configured or every provider fails — the caller then uses the rule-based generator.
 */

// A member is waiting on screen, so each call is capped even if AI_TIMEOUT_MS is set higher.
const TIMEOUT_MS = Math.min(Math.max(config.aiEnv.timeoutMs, 4_000), 15_000);
const TOTAL_BUDGET_MS = 25_000;

export const modelList = (v: string | undefined) => (v || '').split(',').map((m) => m.trim()).filter(Boolean);

export class ProviderError extends Error {
  constructor(public status: number, public body: string) {
    super(`HTTP ${status}: ${body.slice(0, 200)}`);
  }
}

function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}
const norm = (s: string) =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();

function buildPrompt(facts: Record<string, unknown>, count: number, seed: string) {
  return `You write a short multiple-choice quiz that checks whether someone read another person's dating/friendship profile carefully.

Rules:
- Write exactly ${count} questions. Each must be answerable ONLY from the profile below.
- Every correct answer must be copied from the profile (exact wording or the exact number). Never invent facts.
- Each question has exactly 4 options: 1 correct, 3 plausible but clearly wrong distractors of the same kind and length.
- Vary the topics: work, education, places, lifestyle, interests, their own written answers and bio. Do not ask two questions about the same fact.
- Refer to the person by first name. Keep each question under 110 characters and each option under 70.
- Be respectful. No questions about religion, health or anything sensitive unless phrased neutrally from the profile.
- Variation seed: ${seed}. Use it to pick a different mix of facts than you might otherwise.

Return ONLY JSON in this shape:
{"questions":[{"question":"...","options":["...","...","...","..."],"answer":"<the correct option text exactly>"}]}

Profile (JSON):
${JSON.stringify(facts, null, 1)}`;
}

async function withTimeout(url: string, init: RequestInit, ms = TIMEOUT_MS) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { ...init, signal: ctrl.signal });
    const text = await r.text();
    if (!r.ok) throw new ProviderError(r.status, text);
    return JSON.parse(text);
  } finally {
    clearTimeout(t);
  }
}

const OPENAI_COMPAT: Partial<Record<Provider, string>> = {
  openai: 'https://api.openai.com/v1',
  groq: 'https://api.groq.com/openai/v1',
  openrouter: 'https://openrouter.ai/api/v1',
};
function compatHeaders(p: Provider, key: string) {
  const h: Record<string, string> = { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` };
  if (p === 'openrouter') {
    h['HTTP-Referer'] = config.appUrl;
    h['X-Title'] = 'Match360';
  }
  return h;
}
/** Gemini API keys go in x-goog-api-key; OAuth-style tokens (not starting with AIza) are retried as a bearer token. */
const geminiKeyHeaders = (key: string): Record<string, string> => ({ 'Content-Type': 'application/json', 'x-goog-api-key': key });
const geminiBearerHeaders = (key: string): Record<string, string> => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${key}` });

async function callProvider(p: Provider, key: string, model: string, prompt: string, baseUrl: string, opts: { maxTokens?: number; json?: boolean; timeout?: number } = {}): Promise<string> {
  const json = opts.json !== false;
  const maxTokens = opts.maxTokens || 1500;
  switch (p) {
    case 'openai':
    case 'groq':
    case 'openrouter':
    case 'custom': {
      const base = p === 'custom' ? baseUrl.replace(/\/$/, '') : OPENAI_COMPAT[p]!;
      const body: Record<string, unknown> = { model, messages: [{ role: 'user', content: prompt }] };
      // Reasoning models (o-series, gpt-5) only accept the default temperature.
      if (!/^(o\d|gpt-5)/.test(model)) body.temperature = 0.9;
      // Newer OpenAI models reject max_tokens; the others still use it.
      if (p === 'openai') body.max_completion_tokens = maxTokens;
      else body.max_tokens = maxTokens;
      if (json && p !== 'openrouter') body.response_format = { type: 'json_object' };
      const j = await withTimeout(`${base}/chat/completions`, { method: 'POST', headers: compatHeaders(p, key), body: JSON.stringify(body) }, opts.timeout);
      return j?.choices?.[0]?.message?.content || '';
    }
    case 'gemini': {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
      const body = JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.9,
          maxOutputTokens: maxTokens,
          ...(json ? { responseMimeType: 'application/json' } : {}),
          // Flash models: skip "thinking" so answers come back fast.
          ...(/flash/.test(model) && /2\.5|3/.test(model) ? { thinkingConfig: { thinkingBudget: 0 } } : {}),
        },
      });
      let j: any;
      try {
        j = await withTimeout(url, { method: 'POST', headers: geminiKeyHeaders(key), body }, opts.timeout);
      } catch (e) {
        if (!key.startsWith('AIza') && e instanceof ProviderError && (e.status === 400 || e.status === 401 || e.status === 403)) {
          j = await withTimeout(url, { method: 'POST', headers: geminiBearerHeaders(key), body }, opts.timeout);
        } else throw e;
      }
      return j?.candidates?.[0]?.content?.parts?.map((x: any) => x.text).join('') || '';
    }
    case 'anthropic': {
      const j = await withTimeout(
        'https://api.anthropic.com/v1/messages',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model, max_tokens: maxTokens, temperature: 0.9, messages: [{ role: 'user', content: prompt }] }),
        },
        opts.timeout,
      );
      return j?.content?.map((x: any) => x.text || '').join('') || '';
    }
  }
}

/** Plain-language reason for a failed call, used in logs and the admin key checker. */
export function explain(e: any): { state: 'invalid' | 'no_credit' | 'rate_limited' | 'model_missing' | 'timeout' | 'provider_error' | 'network'; message: string } {
  if (e?.name === 'AbortError') return { state: 'timeout', message: 'Timed out' };
  if (e instanceof ProviderError) {
    const b = e.body.toLowerCase();
    if (e.status === 401 || (e.status === 403 && !b.includes('region'))) return { state: 'invalid', message: 'Key is invalid, expired or revoked' };
    if (e.status === 402 || b.includes('insufficient_quota') || b.includes('credit') || b.includes('billing')) return { state: 'no_credit', message: 'No credit or billing not set up' };
    if (e.status === 429) return { state: 'rate_limited', message: b.includes('quota') ? 'Quota used up for now' : 'Rate limited, try again shortly' };
    if (e.status === 404 || b.includes('model_not_found') || b.includes('does not exist') || b.includes('not found')) return { state: 'model_missing', message: 'Model not found or not available to this key' };
    if (e.status === 400 && (b.includes('api key') || b.includes('api_key'))) return { state: 'invalid', message: 'Key is invalid' };
    if (e.status === 400 && b.includes('model')) return { state: 'model_missing', message: 'Model name not accepted' };
    return { state: 'provider_error', message: `Provider error (HTTP ${e.status})` };
  }
  return { state: 'network', message: e?.message || 'Network error' };
}

function parseQuestions(raw: string): { question: string; options: string[]; answer: string }[] {
  const m = raw.match(/\{[\s\S]*\}/);
  if (!m) return [];
  try {
    const j = JSON.parse(m[0]);
    return Array.isArray(j?.questions) ? j.questions : [];
  } catch {
    return [];
  }
}

/** Keep only questions whose correct answer is genuinely present in the profile. */
function validate(list: ReturnType<typeof parseQuestions>, profileText: string, age: number | null): StoredQuestion[] {
  const hay = norm(profileText);
  const out: StoredQuestion[] = [];
  const seenQ = new Set<string>();
  for (const x of list) {
    if (!x || typeof x.question !== 'string' || !Array.isArray(x.options) || typeof x.answer !== 'string') continue;
    const options = x.options.map((o: unknown) => String(o ?? '').trim()).filter(Boolean);
    const uniq = new Set(options.map(norm));
    if (options.length !== 4 || uniq.size !== 4) continue;
    if (x.question.length > 160 || options.some((o: string) => o.length > 90)) continue;
    const correct = options.find((o: string) => norm(o) === norm(x.answer));
    if (!correct) continue;
    const c = norm(correct);
    const grounded = (c.length >= 2 && hay.includes(c)) || (age !== null && c === String(age));
    if (!grounded) continue;
    // Distractors must not also be true facts from the profile.
    if (options.filter((o: string) => o !== correct).some((o: string) => norm(o).length > 3 && hay.includes(norm(o)))) continue;
    const qn = norm(x.question);
    if (seenQ.has(qn)) continue;
    seenQ.add(qn);
    const shuffled = shuffle(options);
    out.push({ q: x.question.trim(), options: shuffled, answer: shuffled.indexOf(correct) });
  }
  return out;
}

export async function generateAIQuiz(facts: Record<string, unknown>, count: number, age: number | null): Promise<{ questions: StoredQuestion[]; provider: string | null; errors: string[] }> {
  const ai = await getSetting('ai');
  const errors: string[] = [];
  if (!ai.enabled) return { questions: [], provider: null, errors: ['AI disabled'] };
  const started = Date.now();
  // Shuffle the profile's keys so each attempt emphasises different facts.
  const shuffledFacts = Object.fromEntries(shuffle(Object.entries(facts)));
  const prompt = buildPrompt(shuffledFacts, count + 2, Math.random().toString(36).slice(2, 8));
  const profileText = JSON.stringify(facts);

  for (const p of ai.order) {
    const key = await aiKey(p);
    if (!key || (p === 'custom' && !ai.customBaseUrl)) continue;
    for (const model of modelList(ai.models?.[p])) {
      if (Date.now() - started > TOTAL_BUDGET_MS) return { questions: [], provider: null, errors: [...errors, 'time budget used up'] };
      try {
        const raw = await callProvider(p, key, model, prompt, ai.customBaseUrl);
        const qs = validate(parseQuestions(raw), profileText, age);
        if (qs.length >= 3) {
          if (config.aiEnv.logging) console.log(`[ai] ${p}/${model} wrote ${qs.length} questions in ${Date.now() - started} ms`);
          return { questions: qs.slice(0, count), provider: `${p}:${model}`, errors };
        }
        errors.push(`${p}/${model}: only ${qs.length} usable questions`);
      } catch (e: any) {
        const x = explain(e);
        errors.push(`${p}/${model}: ${x.message}`);
        if (x.state === 'invalid' || x.state === 'no_credit') break; // other models on the same key will fail too
      }
    }
  }
  return { questions: [], provider: null, errors };
}

/* ---------------- Admin key checker ---------------- */
export interface CheckResult { provider: Provider; model: string; source: 'admin' | 'env' | 'none'; state: 'ok' | ReturnType<typeof explain>['state'] | 'missing'; message: string; ms: number }

export async function checkProviders(): Promise<CheckResult[]> {
  const ai = await getSetting('ai');
  const jobs: Promise<CheckResult>[] = [];
  for (const p of PROVIDERS) {
    const key = await aiKey(p);
    const source: CheckResult['source'] = ai.keys?.[p] ? 'admin' : key ? 'env' : 'none';
    const models = modelList(ai.models?.[p]);
    if (!key) {
      if (p !== 'custom' || ai.customBaseUrl) jobs.push(Promise.resolve({ provider: p, model: models.join(', ') || '—', source, state: 'missing', message: 'No key set', ms: 0 }));
      continue;
    }
    if (p === 'custom' && !ai.customBaseUrl) continue;
    for (const model of models.length ? models : ['(no model set)']) {
      jobs.push(
        (async () => {
          const t = Date.now();
          try {
            const out = await callProvider(p, key, model, 'Reply with the single word OK.', ai.customBaseUrl, { maxTokens: 20, json: false, timeout: 20_000 });
            return { provider: p, model, source, state: 'ok', message: out.trim() ? 'Working' : 'Responded with an empty answer', ms: Date.now() - t } as CheckResult;
          } catch (e) {
            const x = explain(e);
            return { provider: p, model, source, state: x.state, message: x.message, ms: Date.now() - t };
          }
        })(),
      );
    }
  }
  return Promise.all(jobs);
}
