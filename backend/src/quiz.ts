import { CITY_POOL, COMPANY_POOL, DRINKING, EDU_POOL, EDUCATION_LEVELS, INDUSTRIES, INTENTS, INTERESTS, JOB_POOL, LANG_POOL, PROMPTS, SMOKING } from './catalog.js';
import { generateAIQuiz } from './ai.js';
import { ageFrom, type UserRow } from './profiles.js';
import { countryName, countries } from './geo.js';

export interface StoredQuestion {
  q: string;
  options: string[];
  answer: number; // index into options — never sent to the client
}

export const QUESTION_COUNT = 5;
export const SECONDS_PER_QUESTION = 20;

const norm = (s: string) => s.trim().toLowerCase();
function shuffle<T>(a: T[]): T[] {
  const b = [...a];
  for (let i = b.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [b[i], b[j]] = [b[j], b[i]];
  }
  return b;
}
function distractors(pool: string[], exclude: string[], n = 3): string[] {
  const ex = new Set(exclude.map(norm));
  const out: string[] = [];
  for (const x of shuffle(pool)) {
    if (!ex.has(norm(x))) {
      out.push(x);
      ex.add(norm(x));
    }
    if (out.length === n) break;
  }
  return out;
}
function build(q: string, correct: string, wrong: string[]): StoredQuestion | null {
  if (!correct || wrong.length < 3) return null;
  const options = shuffle([correct, ...wrong.slice(0, 3)]);
  return { q, options, answer: options.indexOf(correct) };
}

/** Everything a quiz may ask about. Never includes email, exact birthday or location coordinates. */
export function quizFacts(u: UserRow) {
  const facts: Record<string, unknown> = {
    firstName: u.name.split(' ')[0],
    age: ageFrom(u.dob),
    gender: u.gender,
    lookingFor: u.intent,
    city: u.city,
    country: countryName(u.country),
    hometown: u.hometown || undefined,
    jobTitle: u.job,
    company: u.company || undefined,
    industry: u.industry || undefined,
    educationLevel: u.education_level || undefined,
    school: u.education || undefined,
    languages: u.languages || undefined,
    interests: u.interests,
    bio: u.bio || undefined,
    heightCm: u.height_cm || undefined,
    smoking: u.smoking || undefined,
    drinking: u.drinking || undefined,
    children: u.children || undefined,
    ownWords: (u.prompts || []).filter((p) => p.a).map((p) => ({ prompt: p.q, answer: p.a })),
  };
  return Object.fromEntries(Object.entries(facts).filter(([, v]) => v !== undefined && v !== '' && v !== null));
}

/** Deterministic fallback used when AI is unavailable. */
export function generateRuleQuiz(u: UserRow): StoredQuestion[] {
  const n = u.name.split(' ')[0] || 'them';
  const facts: (StoredQuestion | null)[] = [];
  facts.push(build(`What does ${n} do for work?`, u.job, distractors(JOB_POOL, [u.job])));
  if (u.company) facts.push(build(`Where does ${n} work?`, u.company, distractors(COMPANY_POOL, [u.company])));
  if (u.industry) facts.push(build(`Which field does ${n} work in?`, u.industry, distractors(INDUSTRIES, [u.industry])));
  facts.push(build(`Which city does ${n} live in?`, u.city, distractors(CITY_POOL, [u.city])));
  if (u.hometown && norm(u.hometown) !== norm(u.city)) facts.push(build(`Where is ${n} originally from?`, u.hometown, distractors(CITY_POOL, [u.hometown, u.city])));
  const cn = countryName(u.country);
  if (cn) facts.push(build(`Which country does ${n} live in?`, cn, distractors(countries.slice(0, 120).map((c) => c.name), [cn])));
  facts.push(build(`What is ${n} looking for on Match360?`, u.intent, distractors(INTENTS, [u.intent])));
  if (u.interests.length) facts.push(build(`Which of these is one of ${n}'s interests?`, shuffle(u.interests)[0], distractors(INTERESTS, u.interests)));
  if (u.interests.length >= 3) facts.push(build(`Which of these is NOT one of ${n}'s interests?`, distractors(INTERESTS, u.interests, 1)[0], shuffle(u.interests).slice(0, 3)));
  if (u.education) facts.push(build(`Where did ${n} study?`, u.education, distractors(EDU_POOL, [u.education])));
  if (u.education_level) facts.push(build(`What is ${n}'s highest level of education?`, u.education_level, distractors(EDUCATION_LEVELS, [u.education_level])));
  if (u.smoking) facts.push(build(`How often does ${n} smoke?`, u.smoking, distractors(SMOKING, [u.smoking])));
  if (u.drinking) facts.push(build(`How often does ${n} drink?`, u.drinking, distractors(DRINKING, [u.drinking])));
  const age = ageFrom(u.dob);
  if (age) facts.push(build(`How old is ${n}?`, String(age), shuffle([age - 3, age - 1, age + 2, age + 4].filter((x) => x >= 18)).map(String)));
  const langs = u.languages.split(',').map((s) => s.trim()).filter(Boolean);
  if (langs.length) facts.push(build(`Which language does ${n} speak?`, shuffle(langs)[0], distractors(LANG_POOL, langs)));

  const promptQs = shuffle(
    (u.prompts || [])
      .filter((x) => x.a && x.a.trim())
      .map((x) => build(`${n}'s answer to “${x.q}”`, x.a.trim(), distractors(PROMPTS[x.q] || Object.values(PROMPTS).flat(), [x.a]))),
  ).filter(Boolean) as StoredQuestion[];
  const factQs = shuffle(facts.filter(Boolean) as StoredQuestion[]);
  const chosen = [...promptQs.slice(0, 2)];
  for (const f of factQs) {
    if (chosen.length >= QUESTION_COUNT) break;
    chosen.push(f);
  }
  for (const pq of promptQs.slice(2)) {
    if (chosen.length >= QUESTION_COUNT) break;
    chosen.push(pq);
  }
  return shuffle(chosen);
}

/** AI first (random every time), topped up / replaced by rule-based questions when needed. */
export async function buildQuiz(u: UserRow): Promise<{ questions: StoredQuestion[]; source: string }> {
  let ai: StoredQuestion[] = [];
  let provider: string | null = null;
  try {
    const r = await generateAIQuiz(quizFacts(u), QUESTION_COUNT, ageFrom(u.dob));
    ai = r.questions;
    provider = r.provider;
    if (r.errors.length) console.warn('[quiz] AI issues:', r.errors.join(' | '));
  } catch (e: any) {
    console.warn('[quiz] AI failed', e?.message);
  }
  if (ai.length >= QUESTION_COUNT) return { questions: ai.slice(0, QUESTION_COUNT), source: provider || 'ai' };
  const rules = generateRuleQuiz(u).filter((r) => !ai.some((a) => norm(a.q) === norm(r.q)));
  const merged = shuffle([...ai, ...rules.slice(0, QUESTION_COUNT - ai.length)]);
  return { questions: merged, source: ai.length ? `${provider}+rules` : 'rules' };
}
