# Beta Readiness Checklist (Living Doc)

This is a living checklist to track all work items required to enter and run a controlled beta.

Update each item with Owner, Status, Due, Links, and Notes. Mark checkbox when acceptance criteria (Gate) is met.

Last updated: 2025-10-07

## How to use
- Update Owner to a single DRI (directly responsible individual).
- Keep Status concise: Not started, In progress, Blocked, Done.
- Add Links to PRs, dashboards, runbooks.
- Do not remove items; append Notes for context.

## Status Summary
- Gates green: 1 / 20
- Items in progress: 1
- Target beta invite: 2025-10-21 (Proposed)
- Known risks: OAuth redirects, test suite reliability

---

- [ ] 1. Define Beta Scope and Exit Criteria
  - Owner: Dave
  - Status: Not started
  - Percent: 0%
  - Due: 
  - Gate: Feature list finalized, out-of-scope documented, success metrics (activation, retention, posting success rate), error budgets defined.
  - Links: 
  - Notes:

- [ ] 2. Freeze Critical Interfaces
  - Owner: Dave
  - Status: Not started
  - Percent: 0%
  - Due: 
  - Gate: API contracts for auth, Reddit posting, communities, ImageShield are locked; schema tests in `@shared/schema` protect BC.
  - Links: 
  - Notes:

- [x] 3. Complete TypeScript Strict Mode
  - Owner: Dave
  - Status: Done (2025-10-07)
  - Percent: 100%
  - Due: 
  - Gate: `npm run typecheck` clean for server and client; no `any`, no non-null assertions.
  - Links: CI typecheck job
  - Notes: Addressed server and client strict-mode defects.

- [ ] 4. Harden OAuth/Auth Flows
  - Owner: Dave
  - Status: In progress
  - Percent: 40%
  - Due: 
  - Gate: All callback permutations redirect correctly; state anti-forgery checks; secure cookie flags; login telemetry.
  - Links: `server/reddit-routes.ts`, `server/social-auth.ts`, dashboards
  - Notes: Standardized client path to `/api/reddit/connect`.

- [ ] 5. Fix Failing Tests and Raise Coverage
  - Owner: Dave
  - Status: Not started
  - Percent: 0%
  - Due: 
  - Gate: `npm test` green; ≥70% coverage for auth, posting, ImageShield, communities.
  - Links: Test reports, coverage dashboards
  - Notes: Prioritize shadowban, Gemini adapter, Reddit intelligence tests.

- [ ] 6. ImageShield V2: Design and MVP
  - Owner: Dave
  - Status: Not started
  - Percent: 0%
  - Due: 
  - Gate: Architecture doc; MVP path in `server/routes/upload.ts`; latency < 500ms per image; perceptual hash disruption validated.
  - Links: Design doc, benchmarks
  - Notes: Use micro-perturbations, watermark variants, metadata hardening.

- [ ] 7. Staging Environment Parity
  - Owner: Dave
  - Status: Not started
  - Percent: 0%
  - Due: 
  - Gate: Env vars, migrations, storage providers match prod; seeds load; smoke suite passes.
  - Links: Staging runbook, seed scripts
  - Notes:

- [ ] 8. Observability and Alerting
  - Owner: Dave
  - Status: Not started
  - Percent: 0%
  - Due: 
  - Gate: Structured logs with correlation IDs; health endpoints; dashboards (auth errors, Reddit failures, queue backlogs, posting success %, latency); alerts on SLOs.
  - Links: Grafana/Cloud dashboards, alert policies
  - Notes:

- [ ] 9. Rate Limiting and Abuse Controls
  - Owner: Dave
  - Status: Not started
  - Percent: 0%
  - Due: 
  - Gate: Limits on Reddit endpoints; duplicate detection; synthetic load shows graceful degradation.
  - Links: `SafetyManager`, rate-limit configs
  - Notes:

- [ ] 10. Data Integrity and Migrations
  - Owner: Dave
  - Status: Not started
  - Percent: 0%
  - Due: 
  - Gate: Drizzle migrations validated; zero-downtime migration dry-run; backup/restore rehearsed.
  - Links: Migration scripts, backup playbook
  - Notes:

- [ ] 11. Security Review
  - Owner: Dave
  - Status: Not started
  - Percent: 0%
  - Due: 
  - Gate: Secrets handling, cookie flags, CSRF coverage, SSRF protections; dependency audit clean or waivers.
  - Links: Dependency audit, security checklist
  - Notes:

- [ ] 12. Performance Baselines
  - Owner: Dave
  - Status: Not started
  - Percent: 0%
  - Due: 
  - Gate: P75/P95 targets set and met for TTFB, dashboard interactions, upload+shield, posting end-to-end.
  - Links: Perf dashboards
  - Notes:

- [ ] 13. Error Handling and User Messaging
  - Owner: Dave
  - Status: Not started
  - Percent: 0%
  - Due: 
  - Gate: Normalized client errors; toasts for OAuth, posting, uploads; dead-ends removed.
  - Links: UX spec, error map
  - Notes:

- [ ] 14. Feature Flags and Kill Switches
  - Owner: Dave
  - Status: Not started
  - Percent: 0%
  - Due: 
  - Gate: Risky features behind flags; toggles require no redeploy; defaults per environment documented.
  - Links: Flag config, docs
  - Notes:

- [ ] 15. Content Policy and Compliance
  - Owner: Dave
  - Status: Not started
  - Percent: 0%
  - Due: 
  - Gate: `policy-linter` integrated; NSFW/watermark rules enforced; violations logged with telemetry.
  - Links: Linter rules, telemetry
  - Notes:

- [ ] 16. Beta Access and Onboarding
  - Owner: Dave
  - Status: Not started
  - Percent: 0%
  - Due: 
  - Gate: Invite system ready; gating by email/domain/code; walkthrough tracking.
  - Links: Onboarding flows, metrics
  - Notes:

- [ ] 17. User Feedback Loop
  - Owner: Dave
  - Status: Not started
  - Percent: 0%
  - Due: 
  - Gate: In-app feedback with context; weekly triage; categories routed to owners.
  - Links: Feedback board
  - Notes:

- [ ] 18. Docs and Runbooks
  - Owner: Dave
  - Status: Not started
  - Percent: 0%
  - Due: 
  - Gate: Dev README (setup, envs, deploy), API docs, ImageShield notes; ops runbooks for OAuth, Reddit rate limits, queues, DB incidents.
  - Links: Docs/ runbooks
  - Notes:

- [ ] 19. Canary Rollout Plan
  - Owner: Dave
  - Status: Not started
  - Percent: 0%
  - Due: 
  - Gate: Small cohort rollout; rollback plan tested; smoke tests auto-run on canary.
  - Links: Rollout plan, smoke suite
  - Notes:

- [ ] 20. Go/No-Go Checklist
  - Owner: Dave
  - Status: Not started
  - Percent: 0%
  - Due: 
  - Gate: CI green; tests, alerts, dashboards, staging drills complete; docs updated; sign-offs from eng/product/ops.
  - Links: Sign-off doc
  - Notes:

---

## Stretch Goals
- [ ] S1. Automated Regression Visual Testing Suite
  - Owner: Dave
  - Status: Not started
  - Percent: 0%
  - Gate: Percy/Chromatic (or equivalent) hooked into CI for critical flows.
  - Notes:

- [ ] S2. Self-Serve Analytics Dashboard for Beta Users
  - Owner: Dave
  - Status: Not started
  - Percent: 0%
  - Gate: Beta users can view their community insights and posting performance in-app.
  - Notes:

- [ ] S3. Advanced ImageShield Batch API
  - Owner: Dave
  - Status: Not started
  - Percent: 0%
  - Gate: Async batch endpoint with queueing, status polling, and documentation.
  - Notes:

- [ ] S4. Mobile-Optimized Dashboard Experience
  - Owner: Dave
  - Status: Not started
  - Percent: 0%
  - Gate: Responsive layout audited on iOS/Android; key workflows hit Lighthouse ≥ 90 mobile.
  - Notes:

- [ ] S5. Community Recommendation Engine v1
  - Owner: Dave
  - Status: Not started
  - Percent: 0%
  - Gate: Personalized subreddit recommendations with evaluation metrics (CTR, acceptance).
  - Notes:

---

## Change Log
- 2025-10-07: Initial checklist created.
