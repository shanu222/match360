# Match360 — Earn your connection

Match360 is a people-matching web app where every connection is earned:

1. **Create a profile**: photos, basics, interests, what you're looking for, and short written answers ("prompts").
2. **Take their challenge**: 5 timed questions generated from the other person's profile. Your score is sent with your request.
3. **They quiz you back**: to accept, they answer questions about *your* profile, and their score is sent back with the acceptance.
4. **Chat unlocks**: real-time messaging with typing indicators, read receipts and suggested opening lines.

Extra features: compatibility %, a minimum score each person sets for requests, filters (near me / verified / intent), incognito mode, report & block, achievements, profile strength, email notifications, account deletion.

```
frontend/  React + Vite + Tailwind (deploy to Vercel)
backend/   Node + Express + Socket.IO + PostgreSQL (deploy to Railway)
```

| Concern | Service |
|---|---|
| Login (email/password + Google, password reset, email verification) | Firebase Authentication |
| API, realtime chat | Railway (Node) |
| Database | Railway PostgreSQL (tables are created automatically on first boot) |
| Photo storage | Cloudflare R2 (direct browser uploads via pre-signed URLs) |
| Email notifications | Resend |

Quiz answers never leave the server. The browser receives only questions and options, and the server grades the answers, enforces the time limit, and allows one attempt per person per 24 hours.

---

## 1. Firebase (login)

1. Create a project at <https://console.firebase.google.com>.
2. **Authentication → Sign-in method**: enable **Email/Password** and **Google**.
3. **Authentication → Settings → Authorised domains**: add your Vercel domain (e.g. `match360.vercel.app`) and any custom domain.
4. **Project settings → General → Your apps → Web app**: copy the config values into the frontend env vars (below).
5. **Project settings → Service accounts → Generate new private key**: use `project_id`, `client_email` and `private_key` from the JSON for the backend env vars.

## 2. Cloudflare R2 (photos)

1. R2 → **Create bucket** (e.g. `match360-photos`).
2. Bucket → Settings → **Public access**: enable the `r2.dev` URL, or connect a custom domain. That URL is `R2_PUBLIC_URL`.
3. Bucket → Settings → **CORS policy**:
   ```json
   [
     {
       "AllowedOrigins": ["https://match360.vercel.app", "http://localhost:5173"],
       "AllowedMethods": ["PUT", "GET"],
       "AllowedHeaders": ["Content-Type"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```
4. R2 → **Manage API tokens** → create a token with *Object Read & Write* on the bucket. Use the Access Key ID / Secret plus your Account ID.

If R2 isn't configured, the app still works and shows initials instead of photos.

## 3. Resend (emails)

1. Create an API key at <https://resend.com>.
2. Verify your sending domain (e.g. `sustainablesolution360.com`) and set `RESEND_FROM="Match360 <notifications@sustainablesolution360.com>"`.

Emails are only sent when needed:
- a new challenge request
- a request was accepted (new connection)
- a new message **while the person is offline**, at most once per conversation every 6 hours

Users can switch emails off in Settings.

## 4. Backend on Railway

1. New project → **Deploy from GitHub repo** → pick this repo → set **Root Directory** to `backend`.
2. Add a **PostgreSQL** database to the project. Railway injects `DATABASE_URL` (reference it in the service variables: `DATABASE_URL=${{Postgres.DATABASE_URL}}`).
3. Set the variables from `backend/.env.example`:
   - `NODE_ENV=production`
   - `FRONTEND_ORIGIN=https://your-app.vercel.app` (comma-separate multiple origins)
   - `APP_URL=https://your-app.vercel.app`
   - `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY`
   - `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_PUBLIC_URL`
   - `RESEND_API_KEY`, `RESEND_FROM`
4. Settings → Networking → **Generate domain**. The health check is `GET /health`.

`railway.json` already sets the build (`npm ci && npm run build`), the start command, the health check and restart-on-failure.

## 5. Frontend on Vercel

1. **Add New → Project** → import this repo → **Root Directory**: `frontend` (framework: Vite, auto-detected).
2. Environment variables (from `frontend/.env.example`):
   - `VITE_API_URL=https://<your-railway-domain>`
   - `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`, `VITE_FIREBASE_STORAGE_BUCKET`, `VITE_FIREBASE_MESSAGING_SENDER_ID`
3. Deploy. `vercel.json` handles page routing (so refreshing any page works), asset caching and security headers.
4. Add the Vercel URL to Railway `FRONTEND_ORIGIN`, to the Firebase authorised domains, and to the R2 CORS policy.

## Admin panel

The admin panel lives at a secret address on your site, for example `https://your-app.vercel.app/ops-7k2m9q4x`. It is never linked from the app.

- **Frontend (Vercel):** set `VITE_ADMIN_PATH` to a hard-to-guess path (at least 6 characters).
- **Backend (Railway):** set `ADMIN_EMAIL`, `ADMIN_PASSWORD` and `ADMIN_SECRET` (a long random string).

Security: the admin API checks credentials on the server, uses signed sessions that expire after 8 hours, allows 6 login attempts per 15 minutes per IP, locks sign-in for 30 minutes after repeated failures, and records every action in the activity log. The admin password never appears in the code.

From the panel you can review reports, approve identity verifications (with private, short-lived document links), confirm Easypaisa, JazzCash, bank and card payments, suspend, ban or delete members, grant Premium, and change plans, prices, payment details, ad settings, daily limits and AI providers and keys.

## AI challenge questions

Questions are written from the member's full profile, differently each time. Providers are tried in the order set in the admin panel (OpenAI, Gemini, Anthropic, Groq, or any OpenAI-compatible API). Each answer is checked against the profile and any question that can't be verified is dropped. If no provider works, the built-in generator is used, so challenges never stop. Keys can come from Railway variables (`OPENAI_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`, `ANTHROPIC_API_KEY`, `GROQ_API_KEY`, with `OPENAI_MODEL`/`OPENAI_FALLBACK_MODEL`, `GEMINI_MODEL`/`GEMINI_FALLBACK_MODEL`, `OPENROUTER_MODELS` and `AI_PROVIDER_ORDER`) or be saved, encrypted, from the admin panel. Admin → Settings → AI → “Check all keys and models” tests every key and model and shows whether it works, is invalid or expired, has no credit, is rate limited, or names a model that doesn’t exist.

## Payments and ads

- Easypaisa, JazzCash, bank transfer and a card payment link are configured in the admin panel. Members submit the transaction ID (and optionally a receipt); you approve it in the admin panel and Premium is activated automatically.
- Ads: add your AdSense publisher ID and ad unit IDs in the admin panel. Premium members never see ads.
- Google Play rule: if you publish an Android app on Google Play, Premium sold inside that app must use Google Play Billing. The payment methods above are for the website.

## Local development

```bash
# backend
cd backend && cp .env.example .env   # fill in values; DATABASE_URL can point to a local Postgres
npm install && npm run dev            # http://localhost:8080

# frontend
cd frontend && cp .env.example .env   # VITE_API_URL=http://localhost:8080
npm install && npm run dev            # http://localhost:5173
```

## Reliability notes

- Every API error returns a clear message. The UI shows retry buttons instead of crashing, and an error boundary catches anything unexpected.
- Requests time out after 20 seconds; expired login tokens refresh automatically and the request is retried.
- Chat messages show instantly and carry a client id, so retries never create duplicates. A failed message shows "tap to retry".
- If the realtime connection drops, it reconnects automatically and refreshes chats and counts. Counts are also polled as a fallback.
- Quiz progress is saved in the browser tab, so a page refresh resumes the same questions. If submitting fails, the answers are kept and can be resubmitted.
- The server validates every input, rate-limits requests (especially quizzes and messages), creates the database tables on boot, and shuts down cleanly.
