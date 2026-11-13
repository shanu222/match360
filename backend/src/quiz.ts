import { CITIES, EDU_POOL, INTENTS, INTERESTS, JOB_POOL, LANG_POOL, PROMPTS } from './catalog.js';

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

export interface QuizProfile {
  name: string;
  age: number | null;
  city: string;
  job: string;
  education: string;
  languages: string;
  intent: string;
  interests: string[];
  prompts: { q: string; a: string }[];
}

export function generateQuiz(p: QuizProfile): StoredQuestion[] {
  const n = p.name.split(' ')[0] || 'them';
  const facts: (StoredQuestion | null)[] = [];
  facts.push(build(`What does ${n} do?`, p.job, distractors(JOB_POOL, [p.job])));
  facts.push(build(`Which city is ${n} based in?`, p.city, distractors(CITIES, [p.city])));
  facts.push(build(`What is ${n} looking for on Match360?`, p.intent, distractors(INTENTS, [p.intent])));
  if (p.interests.length) {
    const yes = shuffle(p.interests)[0];
    facts.push(build(`Which of these is one of ${n}'s interests?`, yes, distractors(INTERESTS, p.interests)));
  }
  if (p.interests.length >= 3) {
    const no = distractors(INTERESTS, p.interests, 1)[0];
    facts.push(build(`Which of these is NOT one of ${n}'s interests?`, no, shuffle(p.interests).slice(0, 3)));
  }
  if (p.education) facts.push(build(`Where did ${n} study?`, p.education, distractors(EDU_POOL, [p.education])));
  if (p.age) {
    const a = p.age;
    facts.push(build(`How old is ${n}?`, String(a), shuffle([a - 3, a - 1, a + 2, a + 4].filter((x) => x >= 18)).map(String)));
  }
  const langs = p.languages.split(',').map((s) => s.trim()).filter(Boolean);
  if (langs.length) {
    const l = shuffle(langs)[0];
    facts.push(build(`Which language does ${n} speak?`, l, distractors(LANG_POOL, langs)));
  }

  const promptQs = shuffle(
    p.prompts
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
