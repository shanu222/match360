import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createServer } from 'node:http';
import { config } from './config.js';
import { migrate, pool } from './db.js';
import { initFirebase, requireAuth } from './auth.js';
import { errorHandler } from './http.js';
import { initRealtime } from './realtime.js';
import { account, citiesHandler, countriesHandler, metaHandler, resetHandler, resetLimiter } from './routes/account.js';
import { admin, adminEnabled } from './routes/admin.js';
import { social } from './routes/social.js';
import { billing, revenuecatWebhook } from './routes/billing.js';
import { review } from './routes/review.js';

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(
  cors({
    origin: (origin, cb) => cb(null, !origin || config.origins.includes(origin.replace(/\/$/, ''))),
    credentials: true,
    maxAge: 86400,
  }),
);
app.use(compression());
app.use(express.json({ limit: '100kb' }));

app.get('/', (_req, res) => res.json({ name: 'Match360 API', status: 'ok' }));
app.get('/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch {
    res.status(503).json({ ok: false });
  }
});

app.use(
  '/api',
  rateLimit({ windowMs: 60_000, limit: 300, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many requests, slow down a little.' } }),
);
app.get('/api/meta', metaHandler);
app.get('/api/geo/countries', countriesHandler);
app.get('/api/geo/cities', citiesHandler);
app.post('/api/auth/reset', resetLimiter, resetHandler);
// Admin API — separate credentials, never linked from the app. Responds 404 when not configured.
app.use('/api/admin', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  res.set('X-Robots-Tag', 'noindex');
  next();
}, admin);
// Review page for a direct payment, opened from the team's notification email (signed link, see routes/review.ts).
app.use('/api', review);
// Called by RevenueCat (Google Play purchases); authenticated by its own shared secret, not a user token.
app.post('/api/webhooks/revenuecat', revenuecatWebhook);
app.use('/api', requireAuth, account, social, billing);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found', code: 'not_found' }));
app.use(errorHandler);

async function main() {
  if (!config.databaseUrl) throw new Error('DATABASE_URL is not set');
  initFirebase();
  console.log(`[admin] ${adminEnabled() ? 'enabled' : 'disabled (set ADMIN_EMAIL and ADMIN_PASSWORD to enable)'}`);
  await migrate();
  const server = createServer(app);
  initRealtime(server);
  server.keepAliveTimeout = 65_000;
  server.listen(config.port, () => console.log(`[api] listening on :${config.port}`));

  const shutdown = (sig: string) => {
    console.log(`[api] ${sig} received, shutting down`);
    server.close(() => pool.end().finally(() => process.exit(0)));
    setTimeout(() => process.exit(0), 10_000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

process.on('unhandledRejection', (e) => console.error('[api] unhandledRejection', e));
process.on('uncaughtException', (e) => console.error('[api] uncaughtException', e));

main().catch((e) => {
  console.error('[api] failed to start', e);
  process.exit(1);
});
