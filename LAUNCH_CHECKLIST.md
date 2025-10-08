# Launch Checklist - From Replit to Production

**Target Launch:** November 4, 2025 (4 weeks)  
**Current Date:** October 7, 2025

---

## Phase 1: Local Development Setup (TODAY - 2 hours)

### Step 1: Database Export from Replit (30 min)

**In Replit Shell:**
```bash
# Get your DATABASE_URL from Replit Secrets
# It should look like: postgresql://user:pass@host:port/database

# Export full database
pg_dump $DATABASE_URL > thottopilot_backup_$(date +%Y%m%d).sql

# Download the file:
# - Click Files panel in Replit
# - Right-click the .sql file
# - Select "Download"
```

**Alternative: Direct export to local machine**
```bash
# On your LOCAL machine (not Replit):
pg_dump "postgresql://user:pass@replit-host:port/db" > replit_backup.sql
```

**What you're exporting:**
- All user accounts
- Content generations history
- Reddit accounts/tokens
- Communities database (180+ subreddits)
- Expenses/tax data
- All your data!

---

### Step 2: Set Up Local PostgreSQL (30 min)

**Install PostgreSQL:**
```bash
# Ubuntu/Debian/Windsurf
sudo apt update
sudo apt install postgresql postgresql-contrib

# Start PostgreSQL
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

**Create Database:**
```bash
# Switch to postgres user
sudo -u postgres psql

# In PostgreSQL shell:
CREATE DATABASE thottopilot;
CREATE USER thottopilot_user WITH PASSWORD 'your_secure_local_password';
GRANT ALL PRIVILEGES ON DATABASE thottopilot TO thottopilot_user;
\q
```

**Restore your data:**
```bash
# Restore from backup
psql postgresql://thottopilot_user:your_secure_local_password@localhost:5432/thottopilot < replit_backup.sql

# Verify it worked
psql postgresql://thottopilot_user:your_secure_local_password@localhost:5432/thottopilot

# In psql:
\dt  # List tables (should see users, content_generations, etc.)
SELECT COUNT(*) FROM users;  # Check your data is there
\q
```

---

### Step 3: Update .env File (15 min)

**Create .env from .env.example:**
```bash
cp .env.example .env
```

**Edit .env with your values:**
```bash
# Critical - Update these:
NODE_ENV=development
DATABASE_URL=postgresql://thottopilot_user:your_secure_local_password@localhost:5432/thottopilot

# Keep these from Replit:
JWT_SECRET=your_jwt_secret_from_replit
SESSION_SECRET=your_session_secret_from_replit
REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_CLIENT_SECRET=your_reddit_client_secret
GOOGLE_GENAI_API_KEY=your_gemini_key
OPENAI_API_KEY=your_openai_key
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
STRIPE_SECRET_KEY=your_stripe_key
```

---

### Step 4: Test Local Development (15 min)

**Run the app locally:**
```bash
npm install  # If you haven't already
npm run dev  # Start development server
```

**Open browser:**
```
http://localhost:5000
```

**Test these:**
- [ ] Can log in with existing account
- [ ] Can generate a caption
- [ ] Can see Reddit communities
- [ ] Can connect Reddit account
- [ ] Dashboard loads properly

**If everything works: YOU'RE READY TO BUILD! 🎉**

---

## Phase 2: Where to Deploy (Choose ONE)

### Option A: Railway (RECOMMENDED - Easiest)

**Why Railway:**
- ✅ Dead simple deployment
- ✅ Free $5/month credit (enough for testing)
- ✅ PostgreSQL included
- ✅ Automatic deploys from GitHub
- ✅ Great for Node.js apps

**Setup (20 minutes):**
1. Go to https://railway.app
2. Sign up with GitHub
3. "New Project" → "Deploy from GitHub repo"
4. Select your repo
5. Add PostgreSQL database (click "New" → "Database" → "PostgreSQL")
6. Add environment variables (copy from .env)
7. Deploy!

**Cost:**
- Hobby: $5/month
- Pro: $20/month (when you have users)

---

### Option B: Render (Also Good)

**Why Render:**
- ✅ Similar to Railway
- ✅ Free tier available
- ✅ PostgreSQL included
- ✅ Good documentation

**Setup (25 minutes):**
1. Go to https://render.com
2. Sign up with GitHub
3. "New" → "Web Service"
4. Connect your repo
5. Add PostgreSQL (separate service)
6. Link database to web service
7. Add environment variables
8. Deploy!

**Cost:**
- Free tier: $0 (but database spins down after inactivity)
- Starter: $7/month web service + $7/month database = $14/month

---

### Option C: Neon + Vercel/Netlify (Modern Stack)

**Why this combo:**
- ✅ Neon = Serverless PostgreSQL (free tier is generous)
- ✅ Vercel = Best for Node.js + TypeScript
- ✅ Scales automatically
- ✅ Great DX

**Setup (30 minutes):**

**Neon Database:**
1. Go to https://neon.tech
2. Sign up
3. Create project "ThottoPilot"
4. Copy connection string

**Vercel Deployment:**
1. Go to https://vercel.com
2. Sign up with GitHub
3. Import your repo
4. Add DATABASE_URL (from Neon)
5. Add all other env vars
6. Deploy!

**Cost:**
- Neon: $0 (free tier: 10GB, enough for beta)
- Vercel: $20/month (Pro plan needed for env vars)

---

### Option D: Traditional VPS (Most Control, Most Work)

**Options:**
- DigitalOcean Droplet: $6/month
- Linode: $5/month
- Vultr: $6/month
- AWS EC2: Variable

**Only choose this if you:**
- Want full control
- Don't mind DevOps work
- Need custom configurations

**Setup: 2-3 hours** (install Node, PostgreSQL, Nginx, SSL, PM2, etc.)

---

## Phase 3: Pre-Launch Prep (Week 3)

### Infrastructure Checklist

- [ ] Domain name purchased (thottopilot.com)
- [ ] DNS pointed to hosting
- [ ] SSL certificate (automatic on Railway/Render/Vercel)
- [ ] Environment variables configured
- [ ] Database backed up
- [ ] Stripe production keys added
- [ ] Reddit OAuth production redirect URLs updated

### Application Checklist

- [ ] TypeScript strict mode (0 errors)
- [ ] All console.log removed
- [ ] Critical tests passing
- [ ] Error handling for edge cases
- [ ] Loading states on all API calls
- [ ] User-friendly error messages

### Legal Checklist

- [ ] Terms of Service reviewed
- [ ] Privacy Policy reviewed
- [ ] Cookie consent if needed
- [ ] DMCA policy if needed

---

## Phase 4: Beta Launch (Week 4)

### Soft Launch (Nov 1-3)
- [ ] Invite 10 beta users
- [ ] Monitor for errors (Sentry/logging)
- [ ] Fix critical bugs immediately
- [ ] Collect feedback

### Public Launch (Nov 4)
- [ ] Announce in Reddit communities
- [ ] Post on Twitter/X
- [ ] Email beta users
- [ ] Open signups

---

## What You Need RIGHT NOW

### To Continue Building (Today)
1. ✅ Export database from Replit
2. ✅ Set up local PostgreSQL
3. ✅ Update .env file
4. ✅ Test locally
5. ✅ Start building features

**Time: 2 hours**

### To Deploy (Week 3)
1. ⏳ Choose hosting (Railway recommended)
2. ⏳ Set up production database
3. ⏳ Deploy application
4. ⏳ Test in production
5. ⏳ Invite beta users

**Time: 1 day**

---

## Quick Reference: Connection Strings

### Replit (Current)
```
postgresql://user:pass@host.postgres.database.replit.com:5432/database
```

### Local Development
```
postgresql://thottopilot_user:password@localhost:5432/thottopilot
```

### Railway (Production)
```
postgresql://user:pass@containers-us-west-123.railway.app:5432/railway
# Railway provides this automatically
```

### Neon (Production Alternative)
```
postgresql://user:pass@ep-xyz-123.us-east-2.aws.neon.tech/neondb
```

---

## Emergency Rollback Plan

**If production breaks:**
1. Revert to Replit (keep it running until fully migrated)
2. Update DNS back to Replit
3. Debug locally
4. Redeploy when fixed

**Keep Replit active for 30 days after production launch as backup.**

---

## Cost Summary

### Minimum Monthly Cost (Beta)
- **Railway:** $5-20/month
- **Render:** $0-14/month (free tier possible)
- **Neon + Vercel:** $20/month
- **VPS:** $6+/month

### After Launch (With Users)
- Hosting: $20-50/month
- Database: Included or $10-20/month
- Domain: $12/year
- **Total: ~$30-70/month**

### Break-even
- 2-3 paying users at $20/month
- 5-10 users to cover costs + modest profit

---

## TL;DR - What to Do RIGHT NOW

1. **Export database from Replit** (30 min)
2. **Set up local PostgreSQL** (30 min)
3. **Test locally** (15 min)
4. **Keep building features** (rest of today)

**Deployment: Worry about in Week 3**

**You're ready to work locally NOW.** 🚀

---

*Updated: October 7, 2025*
