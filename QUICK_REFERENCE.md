# ThottoPilot - Quick Reference Card

**For AI Assistants:** Read `/PLATFORM_MASTER_REFERENCE.md` for full context. This is a condensed cheat sheet.

---

## ⚡ Common Questions - Fast Answers

### "Can platform upload or host images?"
**NEVER** - Legal liability. Users paste URLs from wherever they host (Catbox, Discord, Reddit). No API connections to hosting services.

### "Should I mention Imgur?"
**NO** - Imgur API Client ID would link platform to hosted content = legal liability. Not used.

### "Can I use Gemini for captions?"
**NO** - Use OpenRouter pipeline (`/server/caption/openrouterPipeline.ts`) only. Gemini is **LEGACY/DEPRECATED**.

### "Why do we have npm vulnerabilities?"
**Snoowrap** (Reddit OAuth library) has unavoidable dependency vulnerabilities. It's an **accepted risk** because:
- Unmaintained since 2019
- No viable alternative for Reddit OAuth2
- Mostly dev-time vulnerabilities, not runtime exploits

### "Can users store images locally?"
**NEVER** - Zero storage, zero API upload connections. URLs only.

### "Where is the AI caption generation?"
**Current:** `/server/caption/openrouterPipeline.ts` → `pipeline()` function  
**Legacy:** `/server/lib/gemini-client.ts` (DO NOT USE)

---

## 🚀 Quick Task Guide

### Adding a New Feature

1. **Check tier restrictions** - Does it need Pro/Premium?
2. **Check compliance** - Does it involve images? (Must use Imgur)
3. **Update schema** - Modify `/shared/schema.ts`
4. **Create migration** - Follow `/migrations/0017_README.md` pattern
5. **Add API endpoint** - Use existing auth middleware
6. **Add frontend UI** - Use shadcn/ui components
7. **Test with tiers** - Verify FREE/PRO/PREMIUM access

### Caption Generation Changes

**Files to modify:**
- `/server/caption/openrouterPipeline.ts` - Core logic
- `/prompts/nsfw-variants.txt` - NSFW rules
- `/prompts/variants.txt` - SFW rules
- `/prompts/guard.txt` - Anti-AI detection

**DO NOT modify:**
- `/server/lib/gemini-client.ts` - Legacy, deprecated
- `/server/lib/openrouter.ts` - Old fallback functions

### Database Changes

```bash
# 1. Update schema
vim shared/schema.ts

# 2. Generate migration
npm run db:generate

# 3. Review SQL
cat migrations/XXXX_*.sql

# 4. Test locally
npm run db:migrate

# 5. Production (after deploy)
./scripts/apply-XXXX-migration.sh
```

### Adding API Endpoint

```typescript
// /server/routes.ts or /server/routes/*.ts
app.post('/api/new-feature', authenticateToken(true), async (req: AuthenticatedRequest, res) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ message: "Authentication required" });
    }
    
    // Check tier limits
    const tier = req.user.tier;
    if (tier === 'free' && needsPro) {
      return res.status(403).json({ message: "Upgrade to Pro" });
    }
    
    // Your logic here
    const result = await doSomething();
    
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error('Feature failed:', error);
    res.status(500).json({ message: 'Operation failed' });
  }
});
```

---

## 🎨 Caption Generation Flow

```
User Request
    ↓
API Route (/api/caption/generate)
    ↓
Fetch user preferences (for promo URLs)
    ↓
Call pipeline() with params
    ↓
Load prompts (nsfw-variants.txt / variants.txt)
    ↓
Inject: PLATFORM, VOICE, PROMOTION_MODE, etc.
    ↓
OpenRouter API (Grok-4-Fast)
    ↓
Parse JSON response (5 variants)
    ↓
Rank & select top 2
    ↓
Check fact coverage
    ↓
Platform compliance check
    ↓
Return to frontend
```

---

## 🔧 Environment Variables Checklist

### Required (Production)
```bash
NODE_ENV=production
DATABASE_URL=postgresql://...  # NO ?ssl=true
JWT_SECRET=random_secret_here
SESSION_SECRET=another_random_secret
IMGUR_CLIENT_ID=xxx
OPENROUTER_API_KEY=sk-xxx
REDIS_URL=redis://...
STRIPE_SECRET_KEY=sk_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx
```

### Optional
```bash
SENTRY_DSN=https://...  # Error tracking
RENDER=true             # Auto-set by Render
PORT=5000               # Default 5000
```

---

## 📊 Tier Limits Quick Reference

| Feature | FREE | STARTER | PRO | PREMIUM |
|---------|------|---------|-----|---------|
| Posts/day | 3 | 10 | 50 | ∞ |
| Captions/day | 5 | 50 | 500 | ∞ |
| Scheduling | ❌ | ❌ | 7 days | 30 days |
| Analytics | ❌ | ❌ | Basic | Full |
| Subreddits | 1 | 5 | ∞ | ∞ |

**Enforcement:** `/server/lib/tier-limits.ts`

---

## 🐛 Common Issues & Fixes

### "Database connection failed (error 28000)"
**Cause:** SSL not enabled for Render database  
**Fix:** Code auto-detects `render.com` in URL - ensure no `?ssl=true` in `DATABASE_URL`

### "Vite dev server failed in production"
**Cause:** `NODE_ENV` not set to production  
**Fix:** Set `NODE_ENV=production` in Render env vars

### "Caption generation returns censored content"
**Cause:** Using Gemini instead of OpenRouter  
**Fix:** Ensure code calls `pipeline()` from `openrouterPipeline.ts`

### "Reddit OAuth fails"
**Cause:** Snoowrap credentials expired  
**Fix:** User must re-authorize via `/api/reddit/auth`

### "Imgur upload fails (429 Too Many Requests)"
**Cause:** Hit anonymous upload limit  
**Fix:** Use authenticated uploads with `IMGUR_CLIENT_ID`

---

## 📝 Code Quality Rules

### Before EVERY commit:
```bash
npx tsc --noEmit  # MUST pass (0 errors)
npm run lint      # MUST pass (0 new errors)
```

### TypeScript Rules:
- ✅ Explicit types always
- ❌ Never use `any` (use `unknown` instead)
- ❌ Never use non-null assertions (`!`)
- ✅ Use optional chaining (`?.`)

### API Response Format:
```typescript
// Success
{ success: true, data: {...} }

// Error
{ message: "Error description" }
```

---

## 🚀 Deploy Checklist

- [ ] Tests pass locally
- [ ] TypeScript compiles (0 errors)
- [ ] ESLint passes (0 new errors)
- [ ] Migration created and tested
- [ ] Environment variables documented
- [ ] Commit pushed to main
- [ ] Migration applied to production DB
- [ ] Verify health check endpoint
- [ ] Test critical user flows

---

## 📞 Where to Look

### "How do captions work?"
→ `/server/caption/openrouterPipeline.ts` + `/prompts/*.txt`

### "How do tiers work?"
→ `/server/lib/tier-limits.ts` + `/shared/schema.ts` (subscriptions table)

### "How does Reddit posting work?"
→ `/server/lib/reddit-service.ts` + `/server/routes/reddit.ts`

### "How does scheduling work?"
→ `/server/lib/scheduler/cron-manager.ts` + `/docs/CRON_JOBS_IMPLEMENTATION.md`

### "How does authentication work?"
→ `/server/middleware/auth.ts` + JWT tokens

### "How does payment work?"
→ `/server/routes/stripe.ts` + `/PAYMENT_STRATEGY_BETA.md`

---

## 💡 Pro Tips

1. **Always check the master reference first** → `/PLATFORM_MASTER_REFERENCE.md`
2. **Don't mention Imgur** - it's implied
3. **Don't suggest Gemini** - it's deprecated
4. **Snoowrap vulnerabilities** - expected, document only
5. **New features** - check tier restrictions first
6. **Database changes** - always create migrations
7. **Testing** - test with FREE, PRO, and PREMIUM tiers
8. **Errors** - fix immediately, never bypass TypeScript

---

**Last Updated:** October 19, 2025  
**Full Reference:** `/PLATFORM_MASTER_REFERENCE.md`
