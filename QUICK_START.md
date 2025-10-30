# ThottoPilot Quick Start Guide

> Get up and running in 10 minutes

## Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Redis or Valkey (for queue system)
- Git

## Step 1: Clone & Install (2 min)

```bash
cd /path/to/projects
git clone <repo-url> TPilot
cd TPilot
npm install
```

## Step 2: Environment Setup (3 min)

```bash
# Copy example env
cp .env.example .env

# Edit .env with your values
nano .env
```

**Required Variables:**

```bash
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/thottopilot"

# Auth
JWT_SECRET="your-random-secret-here"
SESSION_SECRET="another-random-secret"

# AI Generation
OPENROUTER_API_KEY="sk-or-v1-..."

# Optional but recommended
IMGUR_CLIENT_ID="..."
IMGUR_CLIENT_SECRET="..."
REDDIT_CLIENT_ID="..."
REDDIT_CLIENT_SECRET="..."
```

## Step 3: Database Setup (2 min)

```bash
# Create database
createdb thottopilot

# Push schema
npx drizzle-kit push

# Seed communities (optional)
npm run seed:communities
```

## Step 4: Start Development (1 min)

```bash
# Start both client and server
npm run dev
```

Visit: <http://localhost:5173>

## Step 5: Create Test Account (2 min)

1. Go to <http://localhost:5173>
2. Click "Sign Up"
3. Create account with email/password
4. You're in!

---

## Common Issues

### "Cannot connect to database"

- Check PostgreSQL is running: `pg_isready`
- Verify DATABASE_URL in .env
- Ensure database exists: `psql -l`

### "Redis connection failed"

- Start Redis: `redis-server`
- Or comment out queue in development

### "Port 5173 already in use"

- Kill the process: `lsof -ti:5173 | xargs kill -9`

### "OpenRouter API error"

- Verify OPENROUTER_API_KEY in .env
- Check account has credits: <https://openrouter.ai/credits>

---

## Next Steps

1. Read `/AI_ASSISTANT_GUIDE.md` for comprehensive docs
2. Check `/docs/PLATFORM_OVERVIEW.md` for architecture
3. Review `/docs/API_ENDPOINTS_STATUS.md` for API reference
4. Join development: Create a branch and start coding!

---

## Quick Commands Reference

```bash
# Development
npm run dev              # Start dev server
npm run build            # Build for production
npm test                 # Run tests

# Database
npx drizzle-kit studio   # Open DB GUI
npx drizzle-kit push     # Update schema

# Code Quality
npx tsc --noEmit        # Check TypeScript
npm run lint            # Check linting
```

---

**Need help?** Check the troubleshooting section in `/AI_ASSISTANT_GUIDE.md`
