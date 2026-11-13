import { aiKey, getSetting, type Provider } from './settings.js';
import type { StoredQuestion } from './quiz.js';

/**
 * Generates quiz questions from a member's full profile using the configured AI providers, in order.
 * Every question is validated against the profile text; anything that can't be verified is dropped.
 * Returns [] if no provider is configured or every provider fails — the caller then uses the rule-based generator.
 */

const TIMEOUT_MS = 9_000;
const TOTAL_BUDGET_MS = 14_000;

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

async function withTimeout(url: string, init: RequestInit) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { ...init, signal: ctrl.signal });
    const text = await r.text();
    if (!r.ok) throw new Error(`HTTP ${r.status}: ${text.slice(0, 200)}`);
    return JSON.parse(text);
  } finally {
    clearTimeout(t);
  }
}

async function callProvider(p: Provider, key: string, model: string, prompt: string, baseUrl: string): Promise<string> {
  switch (p) {
    case 'openai':
    case 'groq':
    case 'custom': {
      const url =
        p === 'openai' ? 'https://api.openai.com/v1/chat/completions' : p === 'groq' ? 'https://api.groq.com/openai/v1/chat/completions' : `${baseUrl.replace(/\/$/, '')}/chat/completions`;
      const j = await withTimeout(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ model, temperature: 0.9, response_format: { type: 'json_object' }, messages: [{ role: 'user', content: prompt }] }),
      });
      return j?.choices?.[0]?.message?.content || '';
    }
    case 'gemini': {
      const j = await withTimeout(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.9, responseMimeType: 'application/json' },
        }),
      });
      return j?.candidates?.[0]?.content?.parts?.map((x: any) => x.text).join('') || '';
    }
    case 'anthropic': {
      const j = await withTimeout('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model, max_tokens: 1500, temperature: 0.9, messages: [{ role: 'user', content: prompt }] }),
      });
      return j?.content?.map((x: any) => x.text || '').join('') || '';
    }
  }
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
    if (Date.now() - started > TOTAL_BUDGET_MS) break;
    const key = await aiKey(p);
    const model = ai.models?.[p];
    if (!key || !model || (p === 'custom' && !ai.customBaseUrl)) continue;
    try {
      const raw = await callProvider(p, key, model, prompt, ai.customBaseUrl);
      const qs = validate(parseQuestions(raw), profileText, age);
      if (qs.length >= 3) return { questions: qs.slice(0, count), provider: p, errors };
      errors.push(`${p}: only ${qs.length} usable questions`);
    } catch (e: any) {
      errors.push(`${p}: ${e?.name === 'AbortError' ? 'timed out' : e?.message || 'failed'}`);
    }
  }
  return { questions: [], provider: null, errors };
}
