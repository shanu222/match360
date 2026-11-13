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
  resend: {
    apiKey: process.env.RESEND_API_KEY || '',
    from: process.env.RESEND_FROM || 'Match360 <onboarding@resend.dev>',
  },
};

export const r2Enabled = () =>
  Boolean(config.r2.accountId && config.r2.accessKeyId && config.r2.secretAccessKey && config.r2.bucket && config.r2.publicUrl);
