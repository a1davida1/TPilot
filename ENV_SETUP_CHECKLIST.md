# Environment Variables Setup Checklist
**Priority: P0 - CRITICAL**  
**Time: 30 minutes**  
**Status**: 🔴 IN PROGRESS

---

## 🎯 Quick Start - Add These NOW

### **1. AI Generation (CRITICAL - Captions Won't Work)** ⚠️

```bash
# Primary AI Provider
OPENROUTER_API_KEY=sk-or-v1-...  # Get from https://openrouter.ai/
OPENROUTER_MODEL=opengvlab/internvl2_5-78b
OPENROUTER_SITE_URL=https://thottopilot.com
OPENROUTER_APP_NAME=ThottoPilot

# Fallback #1 - Gemini
GOOGLE_GENAI_API_KEY=...  # Get from https://aistudio.google.com/
GEMINI_API_KEY=...        # (same as above)
GEMINI_TEXT_MODEL=gemini-2.0-flash-exp
GEMINI_VISION_MODEL=gemini-2.0-flash-exp

# Fallback #2 - OpenAI (Optional)
OPENAI_API_KEY=sk-...  # Get from https://platform.openai.com/
```

**Why Critical**: Without these, AI caption generation returns errors. Users can't use core feature.

---

### **2. Rate Limits (CRITICAL - Defaults to 0!)** ⚠️

```bash
DAILY_GENERATIONS_FREE=5
DAILY_GENERATIONS_STARTER=50
DAILY_GENERATIONS_PRO=-1  # -1 = unlimited
```

**Why Critical**: If missing, free users get 0 generations. Nobody can use the app!

---

### **3. Email (HIGH - Password Reset Broken)** 🔴

```bash
FROM_EMAIL=noreply@thottopilot.com

# Choose ONE:
RESEND_API_KEY=re_...  # Get from https://resend.com/ (RECOMMENDED - Free 100/day)
# OR
SENDGRID_API_KEY=SG...  # Get from https://sendgrid.com/ (100/day free)
```

**Why Critical**: 
- Can't send email verification
- Can't reset passwords
- Users get locked out permanently

---

### **4. Error Tracking (HIGH - Flying Blind)** 🔴

```bash
SENTRY_DSN=https://abc123@o123456.ingest.sentry.io/789012
```

**Why Critical**: Production errors vanish. You won't know what's breaking.

**Setup Steps**:
1. Go to https://sentry.io/signup/
2. Create free account (5K errors/month free)
3. Create new project → Select "Node.js"
4. Copy DSN → Add to env vars
5. **Test it works**: Trigger an error, check Sentry dashboard

---

### **5. Storage Quotas (MEDIUM - Defaults May Be Wrong)** 🟡

```bash
PLAN_STORAGE_BYTES_FREE=2147483648      # 2GB
PLAN_STORAGE_BYTES_STARTER=10737418240  # 10GB  
PLAN_STORAGE_BYTES_PRO=53687091200      # 50GB

MEDIA_MAX_BYTES_FREE=524288000      # 500MB per upload
MEDIA_MAX_BYTES_PRO=10737418240     # 10GB per upload
```

**Why Important**: Controls upload limits per plan tier.

---

### **6. Security (Already Set, But Verify)** ✅

```bash
JWT_SECRET=...         # 32+ chars (already set?)
SESSION_SECRET=...     # 32+ chars (already set?)
```

**Action**: Verify these exist in production. If not, app won't start.

---

## 📋 Already Set (Don't Touch)

These are likely already configured:

- ✅ `DATABASE_URL` (Neon connection)
- ✅ `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` (Reddit OAuth working)
- ✅ `STRIPE_SECRET_KEY` (Payments work)
- ✅ `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` (S3 working)
- ✅ `PORT` (Replit sets this)
- ✅ `NODE_ENV=production` (Replit sets this)

---

## 🚀 How to Add to Replit Production

### **Option 1: Replit Dashboard (Recommended)**

1. Go to your Replit project
2. Click "Secrets" (🔒 lock icon in left sidebar)
3. Click "+ New Secret"
4. Add each variable:
   - Key: `OPENROUTER_API_KEY`
   - Value: `sk-or-v1-...`
5. Click "Add Secret"
6. Repeat for all critical vars
7. **Replit auto-redeploys** when you add secrets

### **Option 2: Replit CLI (Faster for Bulk)**

```bash
# Install Replit CLI
npm install -g replit-cli

# Login
replit login

# Set secrets in bulk
replit secrets set OPENROUTER_API_KEY sk-or-v1-...
replit secrets set DAILY_GENERATIONS_FREE 5
replit secrets set DAILY_GENERATIONS_STARTER 50
replit secrets set DAILY_GENERATIONS_PRO -1
replit secrets set FROM_EMAIL noreply@thottopilot.com
replit secrets set RESEND_API_KEY re_...
replit secrets set SENTRY_DSN https://...
```

---

## ✅ Verification Steps

After adding env vars:

```bash
# 1. Check app starts without errors
curl https://thottopilot.com/api/health

# 2. Test AI generation
# - Login to app
# - Upload image
# - Generate caption
# - Should work (not error)

# 3. Test rate limits
# - Check free user has 5 generations/day
# - Check pro user has unlimited

# 4. Test email
# - Sign up new account
# - Should receive verification email

# 5. Test error tracking
# - Trigger a test error
# - Check Sentry dashboard for event
```

---

## 🎯 Priority Order

**Do in this order** (30 min total):

1. ✅ **Rate limits** (5 min) - Copy/paste from .env.example
2. ✅ **Sentry** (10 min) - Sign up, get DSN
3. ✅ **Email** (10 min) - Sign up Resend, get API key
4. ✅ **OpenRouter** (5 min) - Sign up, get API key
5. ⚠️ **Gemini** (Optional) - Fallback if OpenRouter fails

---

## 📊 Quick Reference - Get API Keys Here

| Service | URL | Free Tier | Notes |
|---------|-----|-----------|-------|
| **OpenRouter** | https://openrouter.ai/ | $5 credit | Primary AI |
| **Gemini** | https://aistudio.google.com/ | Free | Fallback AI |
| **Resend** | https://resend.com/ | 100 emails/day | Email (recommended) |
| **Sentry** | https://sentry.io/ | 5K events/month | Error tracking |
| **OpenAI** | https://platform.openai.com/ | $5 credit | Optional fallback |

---

## 🔥 After You Add These

**Mark this item complete**:
- [x] Add missing environment variables (30 min)

**Move to next item**:
- [ ] Set up Sentry error tracking (2h) ← **Partly done above!**
- [ ] Set up basic uptime monitoring (30 min)

---

## 💡 Pro Tips

1. **Never commit .env files** (already gitignored ✅)
2. **Use .env.example as template** (keep it updated)
3. **Document any new env vars** in .env.example
4. **Restart app after adding secrets** (Replit should auto-restart)
5. **Test in dev first** if possible (set in local .env)

---

**Last Updated**: October 9, 2025, 4:01 PM  
**Status**: Ready to execute  
**Next Step**: Add rate limits → Sentry → Email → OpenRouter
