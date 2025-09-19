# Full Journey E2E Smoke Runbook

This runbook documents the automated creator-to-admin smoke test that protects core monetization flows. The suite exercises a complete journey:

1. Sign up a new creator account.
2. Complete onboarding preferences.
3. Generate AI-assisted content.
4. Schedule a social post.
5. Kick off an upgrade to paid billing.
6. Log in as an administrator to validate analytics visibility and moderation tooling.

The implementation uses a lightweight Playwright-compatible harness (`vendor/playwright-test`) so the suite can run in constrained environments while still supporting the familiar `test`/`expect` API. You can swap in the official Playwright package later without changing test code.

## Prerequisites

* Node.js 20+
* npm 10+
* Environment able to reach the deployed ThottoPilot instance (staging or production).
* Administrative credentials for the deployment you are testing.

## Required environment variables

Set the following variables before running the suite:

| Variable | Purpose |
| --- | --- |
| `E2E_BASE_URL` | Root URL of the deployment to exercise. Defaults to `http://localhost:5000` for local API smoke checks. |
| `E2E_ADMIN_EMAIL` | Admin username/email used to verify analytics and moderation flows. |
| `E2E_ADMIN_PASSWORD` | Plaintext admin password that matches the deployed `ADMIN_PASSWORD_HASH`. |
| `E2E_BILLING_PLAN` | Billing plan identifier to request during the upgrade step (default: `pro`). |

You can export them locally or define encrypted GitHub Action secrets for CI:

```bash
export E2E_BASE_URL="https://staging.thottopilot.app"
export E2E_ADMIN_EMAIL="admin@thottopilot.com"
export E2E_ADMIN_PASSWORD="s3cr3t"
export E2E_BILLING_PLAN="pro"
```

## Running locally

1. Install dependencies (this repo vendors the Playwright stub, so no network download is required):
   ```bash
   npm install
   ```
2. Run the smoke test:
   ```bash
   npm run test:e2e
   ```
3. Review the console output. A non-zero exit code indicates at least one regression.

### Switching to upstream Playwright (optional)

If you want to run against the official Playwright runner locally:

1. Install it alongside the stub:
   ```bash
   npm install --save-dev @playwright/test playwright
   ```
2. Update `package.json` script `test:e2e` back to `playwright test`.
3. Remove/ignore `vendor/playwright-test` once you no longer need the stub.

## CI/CD integration

The GitHub Action workflow `.github/workflows/ci.yml` now includes an `e2e-smoke` job that runs after a successful build (and the staging deploy on `main`). The job:

* Uses the same `npm run test:e2e` command as local runs.
* Fails the workflow—and therefore blocks release promotion—if any stage of the journey regresses.
* Reads its credentials from repository/environment secrets (`E2E_BASE_URL`, `E2E_ADMIN_EMAIL`, `E2E_ADMIN_PASSWORD`, `E2E_BILLING_PLAN`).

Ensure those secrets are configured in your GitHub repository or organization settings before relying on the gate.

## Troubleshooting

### Signup failures (HTTP 4xx/5xx)
* Confirm the target deployment has a reachable database and that rate limiting has not blocked the runner IP.
* Validate `JWT_SECRET` and `SESSION_SECRET` are set with non-placeholder values.
* Inspect server logs for validation schema errors.

### Login or onboarding failures
* Check that email verification is either disabled in the target environment or that the login endpoint allows unverified accounts (staging usually does).
* Verify Redis/queue backends are available if onboarding writes to them.

### AI content generation failures
* The template-based `/api/generate-content` route should succeed without external AI keys. If you see 500s, verify database connectivity (it persists generations) and queue health.

### Scheduling failures
* Ensure queue workers are configured, but note that the smoke test only verifies the schedule was accepted—it does not wait for execution. A 400 often indicates the user lacks a Reddit connection; staging should allow scheduling without linking.

### Billing link errors (503)
* Missing payment provider configuration triggers 503 responses. Configure Stripe/CCBill environment variables or adjust the smoke test plan via `E2E_BILLING_PLAN` to a plan supported in that environment.

### Admin login failures
* Confirm `ADMIN_EMAIL` and `ADMIN_PASSWORD_HASH` in the deployment match the credentials supplied via `E2E_ADMIN_EMAIL`/`E2E_ADMIN_PASSWORD`.
* If the admin user uses MFA, provision a dedicated automation credential instead.

### Moderation endpoint failures
* The API currently returns a stubbed response. A 401 indicates the admin session cookie was not set—double-check the login step.

### General debugging tips
* Re-run the suite with `DEBUG=e2e` (the stub runner respects the env var and logs additional request metadata).
* Capture HAR/network logs by wrapping the API calls inside `test.step` (already done) and adding console logging for response bodies when debugging locally.
* Review the staging logs for the correlated `x-e2e-suite` header emitted by the runner.

## Rollback plan

If a regression is detected, deployment promotion is blocked automatically. Investigate the failing stage, fix the underlying issue, and re-run the workflow. If you need to bypass the gate temporarily (e.g., staging outage), you can disable the `e2e-smoke` job in `.github/workflows/ci.yml`, but document the exception and re-enable it as soon as possible.