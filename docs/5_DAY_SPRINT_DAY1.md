# Day 1: Foundation & Quick Wins
**Time**: 4 hours human + 4 hours AI parallel  
**Goal**: Environment setup, monitoring active, mechanical cleanup

---

## ☀️ MORNING SESSION (2 hours)

### [ ] Task 1.1: Sign Up for Services (45 min)

**Sentry** (Error Tracking):
1. Go to https://sentry.io/signup/
2. Create account (free: 5K errors/month)
3. Create project → Select "Node.js"
4. Copy DSN: `https://abc@o123.ingest.sentry.io/456`
5. Set alert: Email when >10 errors/hour

**SendGrid** (Email) - Already configured ✅:
- You're already using SendGrid
- Verify: `SENDGRID_API_KEY` exists in Replit secrets
- If missing, get from: https://app.sendgrid.com/settings/api_keys
- Free tier: 100 emails/day

**OpenRouter** (AI Captions):
1. Go to https://openrouter.ai/signup/
2. Create account
3. Add $5-10 credit (InternVL: ~$0.001/image)
4. Copy API key

---

### [ ] Task 1.2: Add Env Vars to Production (30 min)

**Replit Dashboard → Secrets** (Add these ONLY if missing):
```
# NEW - Add these:
SENTRY_DSN=[from above]
OPENROUTER_API_KEY=[from above]
OPENROUTER_MODEL=opengvlab/internvl2_5-78b
OPENROUTER_SITE_URL=https://thottopilot.com
OPENROUTER_APP_NAME=ThottoPilot

# Rate limits (ADD if missing):
DAILY_GENERATIONS_FREE=5
DAILY_GENERATIONS_STARTER=50
DAILY_GENERATIONS_PRO=-1

# Email (VERIFY exists, don't overwrite):
FROM_EMAIL=noreply@thottopilot.com
SENDGRID_API_KEY=[should already exist]
```

**Don't touch existing vars like**:
- DATABASE_URL ✅
- REDIS_URL ✅
- STRIPE_SECRET_KEY ✅
- REDDIT_CLIENT_ID/SECRET ✅
- AWS keys ✅

**Verify**:
```bash
curl https://thottopilot.com/api/health
# Should return 200 OK
```

---

### [ ] Task 1.3: Set Up UptimeRobot (15 min)

1. Go to https://uptimerobot.com/signUp
2. Add monitor:
   - Type: HTTP(s)
   - URL: `https://thottopilot.com/api/health`
   - Interval: 5 minutes
3. Add email alert
4. Test: Pause monitor, verify email received

---

## 🤖 PARALLEL: Codex Task 1.A - Console.log Cleanup

**Copy this to Codex**:

```
TASK: Replace console.log with Winston logger in server/ directory

FILES: server/**/*.ts (exclude tests)

PATTERN:
❌ console.log('User logged in:', userId);
✅ logger.info('User logged in', { userId });

RULES:
1. Import: import { logger } from './bootstrap/logger.js';
2. Use structured logging (objects, not strings)
3. NEVER log passwords, tokens, full user objects
4. Levels: debug/info/warn/error (choose appropriately)
5. Redact sensitive data:
   - Emails: dave***@example.com
   - Tokens: '[REDACTED]'
   - URLs: Remove query params

PRIORITY FILES:
1. server/routes.ts
2. server/reddit-routes.ts
3. server/auth.ts
4. server/lib/reddit.ts
5. server/caption/**/*.ts

VALIDATION:
grep -r "console\." server/ --include="*.ts" | grep -v test | wc -l
# Should be ~0
```

---

## 🌆 AFTERNOON SESSION (2 hours)

### [ ] Task 1.4: Review Codex Changes (45 min)

**Checklist**:
- [ ] Imports correct (`from './bootstrap/logger.js'`)
- [ ] Structured logging (objects, not concatenation)
- [ ] No sensitive data (tokens, passwords, full users)
- [ ] App still builds: `npm run build`
- [ ] Logs being written: `tail -f logs/combined-*.log`

**Commit**:
```bash
git add server/
git commit -m "refactor: replace console.* with logger (449 fixes)"
git push
```

---

### [ ] Task 1.5: Test Database Backup/Restore (2 hours) 🔥 CRITICAL

**Step 1: Verify Neon Backups (30 min)**
1. Log into https://console.neon.tech/
2. Check "Backups" tab
3. Note: Backup frequency, retention period
4. Verify last backup timestamp

**Step 2: Test Restore (1h)**
1. Create test data:
```sql
INSERT INTO users (username, email) 
VALUES ('backup_test', 'test@backup.test');
```
2. Use Neon "Branch" feature (simulates restore)
3. Verify test data exists in branch
4. Document procedure in `docs/runbooks/disaster-recovery.md`

**Step 3: Backup .env File (30 min)**
1. Copy production .env
2. Store in 1Password/Bitwarden
3. Label: "ThottoPilot Prod ENV - Oct 9"
4. Test: Can you read it back?

**Deliverable**: Recovery procedure documented ✅

---

## 🤖 PARALLEL: Gemini Pro Task 1.B - Security Review

**Copy this to Gemini Pro**:

```
TASK: Security audit of logger refactoring

FILES: [Paste files Codex modified]

REVIEW FOR:
1. Sensitive data leaks:
   - Passwords/tokens logged?
   - Full user objects with PII?
   - API keys in errors?

2. Log injection:
   - User input sanitized?
   - Newline injection possible?

3. Performance:
   - Large objects in hot paths?
   - Logging in loops?

OUTPUT:
For each issue:
- File + line
- Severity: CRITICAL/HIGH/MEDIUM/LOW
- Issue description
- Fix recommendation

If clean: "APPROVED - No issues found"
```

---

## ✅ DAY 1 WRAP-UP (15 min)

### Validation:
- [ ] Sentry configured (test: trigger error, check dashboard)
- [ ] Email working (test: password reset)
- [ ] UptimeRobot monitoring active
- [ ] Console.log → logger (grep ~0 results)
- [ ] Database backups verified
- [ ] .env backed up
- [ ] App works (test: login, generate caption)

### Commit & Deploy:
```bash
git add .
git commit -m "chore: Day 1 complete - monitoring + backup verified"
git push
```

**🎉 Day 1 Complete!** → Proceed to Day 2
