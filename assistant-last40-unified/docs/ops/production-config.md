
# Production Configuration & Secret Rotation

This guide documents the required production environment for ThottoPilot, how to validate the deployment secrets, and the rotation policies for each sensitive integration. Use it alongside the updated `.env.production.example` template and the `npm run ops:check-env` audit command.

## 1. Environment Audit Checklist

Run the automated audit in the production shell (where secrets are injected) before each deploy:

```bash
npm run ops:check-env
```

The script verifies all mandatory variables for the categories below and aborts with exit code `1` if anything is missing or contains placeholder values when `NODE_ENV=production`:

| Category  | Required Variables | Current Status* |
|-----------|--------------------|-----------------|
| Core      | `NODE_ENV`, `APP_BASE_URL`, `PORT`, `CRON_TZ` | ❌ Not validated – no production secrets present in repo |
| Security  | `JWT_SECRET`, `SESSION_SECRET`, optional Turnstile keys | ❌ Not validated |
| Database  | `DATABASE_URL`, `DATABASE_SSL` | ❌ Not validated |
| Queue     | `REDIS_URL` **or** `USE_PG_QUEUE`, `SESSION_TTL_SECONDS` | ❌ Not validated |
| AI        | One of `GOOGLE_GENAI_API_KEY`, `GEMINI_API_KEY`, `OPENAI_API_KEY` | ❌ Not validated |
| Payments  | `STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET` (plus optional alt processors) | ❌ Not validated |
| Media     | `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET_MEDIA`, `S3_PUBLIC_CDN_DOMAIN` | ❌ Not validated |
| Email     | `FROM_EMAIL`, optional provider keys | ❌ Not validated |
| Analytics | `SENTRY_DSN`, `ANALYTICS_WRITE_KEY` | ❌ Not validated |

\*The working tree does not include production secrets. Populate them in your secret manager and re-run the audit in the target environment to confirm every row shows `OK`.

### Additional automated guards

* `server/middleware/security.ts` now blocks production boot when neither `REDIS_URL` nor `USE_PG_QUEUE=true` is set.
* `server/bootstrap/session.ts` configures sessions to use Redis when available or PostgreSQL as the fallback; it logs and refuses to start with a MemoryStore in production.

## 2. Session, Cache, and Queue Configuration

The Express app now uses `server/bootstrap/session.ts` to create a hardened session middleware:

* **Primary backend:** Redis via `REDIS_URL`. Sessions share the same instance as caching/queue operations and use the `tpilot:sess:` prefix.
* **Fallback backend:** PostgreSQL when `USE_PG_QUEUE=true` or when Redis is absent in production. Sessions persist in the `user_sessions` table.
* **Development fallback:** `memorystore` remains available but emits a warning and should never be relied on in production.

Relevant environment knobs:

| Variable | Purpose |
|----------|---------|
| `REDIS_URL` | Enables Redis-backed BullMQ and session storage. |
| `USE_PG_QUEUE` | Forces PostgreSQL queues/sessions when Redis is unavailable. |
| `SESSION_COOKIE_NAME`, `SESSION_COOKIE_DOMAIN`, `SESSION_MAX_AGE_MS` | Customize cookie behaviour to match your domain. |
| `SESSION_TTL_SECONDS`, `SESSION_PRUNE_INTERVAL` | Tune Redis/PG TTL and pruning cadence. |

Ensure the queue workers point at the same Redis instance to avoid cross-environment leaks.

## 3. Monitoring & Analytics Verification

### Sentry self-test

1. Export the production `SENTRY_DSN` in your shell.
2. Run the snippet below once (it uses the bootstrapped Sentry initializer and flushes the event):

   ```bash
   node -e "(async () => { const { initializeSentry } = await import('./server/bootstrap/logger.js'); const S = await initializeSentry(); if (!S) { throw new Error('Sentry not configured'); } S.captureException(new Error('Sentry production self-test')); await S.flush(5000); console.log('Sent self-test to Sentry'); process.exit(0); })();"
   ```
3. Confirm the event titled **"Sentry production self-test"** appears in the project dashboard.

After deploying, provoke a handled server error (e.g. temporarily hitting `/api/nonexistent-route?forceError=true` with a crafted test endpoint) to verify HTTP context is captured.

### Analytics self-test

1. Ensure `ANALYTICS_WRITE_KEY` matches the provider's production key.
2. Open the app in a production browser session and navigate to a few screens; the client-side tracker posts batches to `/api/analytics/events`.
3. Validate that the events appear in your analytics provider. For Segment-like APIs you can also manually send a test payload:

   ```bash
   curl -X POST "https://api.segment.io/v1/track" \
     -u "$ANALYTICS_WRITE_KEY:" \
     -H "Content-Type: application/json" \
     -d '{"event":"production_self_test","userId":"ops-check","properties":{"source":"self-test"}}'
   ```

4. Check `logs/metrics-current.log` for the proxy confirmation and confirm the provider dashboard records the page views.

## 4. Secret Rotation Policies

| Secret | Rotation Frequency | Rotation Method |
|--------|--------------------|-----------------|
| `JWT_SECRET`, `SESSION_SECRET` | 90 days (or immediately after a suspected compromise) | Generate 256-bit values, deploy via secret manager, recycle user sessions during maintenance window. |
| `DATABASE_URL` credentials | 180 days | Rotate PostgreSQL user passwords; update connection strings in secret manager. Verify queue workers reconnect. |
| `REDIS_URL` credentials | 90 days | Issue new Redis auth token and redeploy app/workers concurrently. |
| `STRIPE_*` keys | As per Stripe policy (recommended 90 days) | Create new restricted keys, update webhook secret, re-sign endpoints. |
| `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` | 90 days | Use IAM access key rotation; verify S3 upload health immediately after rotation. |
| Email provider keys (`SENDGRID_API_KEY`, `RESEND_API_KEY`) | 90 days | Regenerate API tokens; send transactional email smoke tests. |
| `SENTRY_DSN` / `ANALYTICS_WRITE_KEY` | 180 days or on team changes | Issue new credentials from respective dashboards and update secret manager. |
| Optional payment providers (Segpay, Epoch, Paxum, Coinbase) | Per vendor contract | Follow vendor rotation workflow; confirm callback URLs remain authorized. |

Document each rotation in the internal runbook and ensure all stale secrets are revoked from the providers once replaced.

## 5. Secret Management Process

1. Store all secrets in your production secret manager (AWS Secrets Manager, Doppler, Replit Secrets, etc.).
2. Grant access only to the deployment service account and CI runners.
3. Run `npm run ops:check-env` after loading the secrets to verify compliance.
4. Commit no plaintext secrets to the repository—use `.env.production.example` as the canonical template.

## 6. Incident Response

If the audit script or monitoring self-tests fail:

1. **Stop the deployment** and remediate missing secrets immediately.
2. Review Sentry for the self-test event. If absent, validate DNS firewalls and DSN correctness.
3. For analytics, ensure outbound requests to the provider are allowed and no CSP restrictions block the tracker.
4. Once fixed, rerun the checks above and capture evidence in the deployment log.

Keeping this checklist updated ensures the platform remains production-ready with traceable monitoring and hardened session handling.
