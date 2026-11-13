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
import { account, metaHandler } from './routes/account.js';
import { social } from './routes/social.js';

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
app.use('/api', requireAuth, account, social);
app.use('/api', (_req, res) => res.status(404).json({ error: 'Not found', code: 'not_found' }));
app.use(errorHandler);

async function main() {
  if (!config.databaseUrl) throw new Error('DATABASE_URL is not set');
  initFirebase();
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
