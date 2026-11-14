import 'dotenv/config';

const list = (v?: string) =>
  (v || '')
    .split(',')
    .map((s) => s.trim().replace(/\/$/, ''))
    .filter(Boolean);

export const config = {
  port: Number(process.env.PORT) || 8080,
  isProd: process.env.NODE_ENV === 'production',
  // Test-only auth shortcut. Requires BOTH flags and is refused in production.
  testAuth: process.env.NODE_ENV === 'test' && process.env.ALLOW_TEST_AUTH === '1',
  databaseUrl: process.env.DATABASE_URL || '',
  origins: list(process.env.FRONTEND_ORIGIN || 'http://localhost:5173'),
  appUrl: (process.env.APP_URL || list(process.env.FRONTEND_ORIGIN)[0] || 'http://localhost:5173').replace(/\/$/, ''),
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID || '',
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL || '',
    privateKey: (process.env.FIREBASE_PRIVATE_KEY || '').replace(/^"|"$/g, '').replace(/\\n/g, '\n'),
  },
  r2: {
    accountId: process.env.R2_ACCOUNT_ID || '',
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
    bucket: process.env.R2_BUCKET || '',
    publicUrl: (process.env.R2_PUBLIC_URL || '').replace(/\/$/, ''),
  },
  admin: {
    email: (process.env.ADMIN_EMAIL || '').trim().toLowerCase(),
    password: process.env.ADMIN_PASSWORD || '',
    // Signs admin sessions and encrypts stored API keys. Falls back to a value derived from other secrets.
    secret: process.env.ADMIN_SECRET || '',
  },
  ai: {
    openai: process.env.OPENAI_API_KEY || '',
    gemini: process.env.GEMINI_API_KEY || '',
    anthropic: process.env.ANTHROPIC_API_KEY || '',
    groq: process.env.GROQ_API_KEY || '',
    openrouter: process.env.OPENROUTER_API_KEY || '',
  },
  aiEnv: {
    order: (process.env.AI_PROVIDER_ORDER || '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
    // Model lists: primary first, then fallbacks.
    openai: [process.env.OPENAI_MODEL, process.env.OPENAI_FALLBACK_MODEL].filter(Boolean).join(','),
    gemini: [process.env.GEMINI_MODEL, process.env.GEMINI_FALLBACK_MODEL].filter(Boolean).join(','),
    anthropic: [process.env.ANTHROPIC_MODEL, process.env.ANTHROPIC_FALLBACK_MODEL].filter(Boolean).join(','),
    groq: [process.env.GROQ_MODEL, process.env.GROQ_FALLBACK_MODEL].filter(Boolean).join(','),
    openrouter: process.env.OPENROUTER_MODELS || '',
    timeoutMs: Number(process.env.AI_TIMEOUT_MS) || 12_000,
    logging: process.env.AI_LOGGING !== 'false',
  },
  r2Private: process.env.R2_PRIVATE_BUCKET || '',
  revenuecat: {
    // Google Play purchases made in the Android app (see routes/billing.ts).
    webhookAuth: (process.env.REVENUECAT_WEBHOOK_AUTH || '').trim(),
    secretKey: (process.env.REVENUECAT_SECRET_KEY || '').trim(),
    entitlement: (process.env.REVENUECAT_ENTITLEMENT || 'premium').trim(),
  },
  resend: {
    apiKey: process.env.RESEND_API_KEY || '',
    from: process.env.RESEND_FROM || 'Match360 <onboarding@resend.dev>',
  },
};

export const r2Enabled = () =>
  Boolean(config.r2.accountId && config.r2.accessKeyId && config.r2.secretAccessKey && config.r2.bucket && config.r2.publicUrl);
