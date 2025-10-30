# ThottoPilot AI Assistant Guide

> Complete Reference for AI Code Assistants (Claude, GPT, etc.)
>
> Last Updated: October 29, 2025

---

## 🎯 **Platform Purpose**

ThottoPilot is a **professional content management platform** for adult content creators to manage their Reddit presence with:

- Legal compliance (2257, DMCA)
- AI-powered content generation (captions, titles)
- Scheduled posting automation
- Analytics and growth tools
- Media protection (ImageShield - in beta)

**Target Users:** Adult content creators, OnlyFans/Fansly creators, Reddit marketers

---

## 📋 **Table of Contents**

1. [Architecture Overview](#architecture-overview)
2. [Tech Stack](#tech-stack)
3. [Project Structure](#project-structure)
4. [Core Principles & Rules](#core-principles--rules)
5. [Database Schema](#database-schema)
6. [API Patterns](#api-patterns)
7. [Frontend Patterns](#frontend-patterns)
8. [Tier System](#tier-system)
9. [External Services](#external-services)
10. [Development Workflow](#development-workflow)
11. [Testing Strategy](#testing-strategy)
12. [Deployment](#deployment)
13. [Known Issues & TODOs](#known-issues--todos)
14. [Future Roadmap](#future-roadmap)

---

## 🏗️ **Architecture Overview**

### **Hybrid Full-Stack Application**

```text
┌─────────────────────────────────────────────┐
│           CLIENT (PORT 5173 DEV)            │
│  React + Wouter (SPA) + React Query         │
│  /client/src/*                              │
└─────────────────┬───────────────────────────┘
                  │ HTTP/API
┌─────────────────▼───────────────────────────┐
│          SERVER (PORT 5000/3000)            │
│  Express.js + REST API                      │
│  /server/*                                  │
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │  Queue System (Bull + Valkey)        │  │
│  │  - Scheduled posts                   │  │
│  │  - Caption generation                │  │
│  │  - Analytics processing              │  │
│  └──────────────────────────────────────┘  │
└─────────────────┬───────────────────────────┘
                  │
┌─────────────────▼───────────────────────────┐
│    PostgreSQL Database (Render/Local)       │
│    - Users, posts, captions, analytics      │
│    - Drizzle ORM for queries                │
└─────────────────────────────────────────────┘
```text

### **Why This Architecture?**

- **Express Backend:** Mature, stable, excellent for REST APIs
- **React Frontend:** Component-based, rich ecosystem
- **Wouter Routing:** Lightweight (1.2KB), fast client-side routing
- **Bull Queue:** Reliable job processing with Valkey (Redis-compatible)
- **Drizzle ORM:** Type-safe SQL with excellent TypeScript support

---

## 🛠️ **Tech Stack**

### **Frontend**

- **Framework:** React 18 + TypeScript
- **Routing:** Wouter (NOT React Router)
- **State Management:** React Query (TanStack Query v5)
- **UI Library:** shadcn/ui (Radix UI + Tailwind CSS)
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **Forms:** React Hook Form + Zod validation
- **Build Tool:** Vite

### **Backend**

- **Runtime:** Node.js 20+
- **Framework:** Express.js
- **Language:** TypeScript
- **Database:** PostgreSQL 15+
- **ORM:** Drizzle ORM
- **Queue:** Bull (Valkey - Redis-compatible)
- **Authentication:** JWT + Passport.js
- **Logging:** Winston
- **Validation:** Zod

### **External APIs**

- **AI Generation:** OpenRouter API (Grok-4-Fast primary)
- **Image Storage:** Imgur API (OAuth 2.0)
- **Reddit:** Reddit OAuth API
- **Payments:** Stripe (primary), CCBill (future)

### **DevOps**

- **Deployment:** Render.com
- **Database:** Render PostgreSQL
- **Redis:** Valkey (Render - Redis-compatible)
- **CI/CD:** GitHub Actions (optional)
- **Monitoring:** Sentry (configured, needs DSN)

---

## 📁 **Project Structure**

```text
TPilot/
├── client/              # Frontend React app
│   ├── src/
│   │   ├── components/  # Reusable React components
│   │   ├── pages/       # Route pages
│   │   ├── hooks/       # Custom React hooks
│   │   ├── lib/         # Utilities, API clients
│   │   ├── config/      # Frontend config
│   │   └── App.tsx      # Main app component
│   └── index.html
│
├── server/              # Backend Express server
│   ├── routes/          # API route handlers
│   ├── services/        # Business logic layer
│   ├── lib/             # Shared server utilities
│   ├── middleware/      # Express middleware
│   ├── jobs/            # Bull queue workers
│   ├── bootstrap/       # Server initialization
│   └── index.ts         # Server entry point
│
├── shared/              # Code shared between client/server
│   ├── schema.ts        # Drizzle database schema
│   └── types/           # TypeScript type definitions
│
├── docs/                # Documentation
│   ├── PLATFORM_OVERVIEW.md
│   ├── BETA_READY_STATUS.md
│   └── API_ENDPOINTS_STATUS.md
│
├── scripts/             # Utility scripts
│   ├── build-production.sh
│   └── init-communities.ts
│
└── prompts/             # AI system prompts
    ├── nsfw-system.txt  # NSFW caption generation
    └── sfw-system.txt   # SFW caption generation

```

---

## ⚡ **Core Principles & Rules**

### **🚨 CRITICAL - ALWAYS FOLLOW**

#### **1. TypeScript Strictness**

```typescript
// ✅ GOOD
interface User {
  id: number;
  email: string;
}

// ❌ BAD - Never use 'any'
const user: any = {};
```

#### **2. No Local Image Storage**

```typescript
// ❌ ILLEGAL - Never store images locally
fs.writeFile('uploads/image.jpg', buffer)

// ✅ LEGAL - Always use Imgur/Catbox
await uploadToImgur(imageUrl)
```

**Why:** Adult content legal compliance (2257 regulations)

#### **3. AI Model Usage**

```typescript
// ✅ PRIMARY - Always use OpenRouter first
import { pipeline } from './lib/openrouter-pipeline';

// ❌ DEPRECATED - Don't use Gemini unless OpenRouter fails
// Gemini censors adult content
```

**Primary Model:** `x-ai/grok-4-fast` (uncensored, fast)

#### **4. Database Migrations**

```bash
# ✅ CORRECT ORDER
1. Create migration SQL file
2. Run migration on database FIRST
3. Then update schema.ts
4. Then deploy code

# ❌ WRONG - Causes production outage
1. Update schema.ts
2. Deploy code
3. Database breaks - auth fails
```

#### **5. Environment Variables**

```bash
# REQUIRED for Render deployment
NODE_ENV=production
RENDER=true  # Forces production mode
DATABASE_URL=postgresql://...  # NO ?ssl=true suffix!
JWT_SECRET=random_string
SESSION_SECRET=random_string
OPENROUTER_API_KEY=sk-or-...
```

---

## 🗄️ **Database Schema**

### **Key Tables**

#### **users**

```typescript
{
  id: serial primary key
  email: string unique
  username: string
  tier: 'free' | 'starter' | 'pro' | 'premium'
  redditAccessToken: string?
  imgurAccessToken: string?
  catboxUserhash: string?
  createdAt: timestamp
}
```

#### **mediaAssets**

```typescript
{
  id: serial primary key
  userId: integer (FK users)
  url: string  // Imgur/Catbox URL
  protected: boolean
  viewCount: integer
  createdAt: timestamp
}
```

#### **redditPostOutcomes**

```typescript
{
  id: serial primary key
  userId: integer
  subreddit: string
  title: string
  upvotes: integer
  views: integer
  success: boolean
  occurredAt: timestamp
}
```

#### **scheduledPosts**

```typescript
{
  id: serial primary key
  userId: integer
  imageUrl: string
  caption: string
  subreddit: string
  scheduledFor: timestamp
  status: 'pending' | 'processing' | 'posted' | 'failed'
  jobId: string  // Bull queue job ID
}
```

### **Schema Location**

`/shared/schema.ts` - Drizzle ORM schema definitions

---

## 🔌 **API Patterns**

### **Standard API Response Format**

```typescript
// Success
{ data: T, success: true }

// Error
{ error: string, message?: string }
```

### **Authentication Middleware**

```typescript
import { authenticateToken } from '../middleware/auth';

// Require auth
router.get('/protected', authenticateToken(true), handler);

// Optional auth
router.get('/public', authenticateToken(false), handler);
```

### **API Route Structure**

```typescript
// /server/routes/example.ts
import { Router } from 'express';
import { authenticateToken, type AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/', authenticateToken(true), async (req: AuthRequest, res) => {
  try {
    const userId = req.user?.id;
    // ... business logic
    return res.json({ data: result });
  } catch (error) {
    logger.error('Route failed', { error });
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export { router as exampleRouter };
```

### **Registering Routes**

```typescript
// /server/routes.ts
import { exampleRouter } from './routes/example.js';
app.use('/api/example', exampleRouter);
```

---

## 🎨 **Frontend Patterns**

### **Page Component Template**

```typescript
// /client/src/pages/example.tsx
import { useQuery } from '@tanstack/react-query';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/hooks/useAuth';

export default function ExamplePage() {
  const { user, isAuthenticated } = useAuth();
  
  const { data, isLoading } = useQuery({
    queryKey: ['/api/example'],
    enabled: isAuthenticated,
  });

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      <Card>
        <h1>Example Page</h1>
        {data && <pre>{JSON.stringify(data, null, 2)}</pre>}
      </Card>
    </div>
  );
}
```

### **React Query Pattern**

```typescript
// Fetch data
const { data, isLoading, error } = useQuery({
  queryKey: ['/api/endpoint'],
  staleTime: 60000, // Cache for 1 minute
});

// Mutation (POST/PUT/DELETE)
const mutation = useMutation({
  mutationFn: async (data) => {
    return apiRequest('POST', '/api/endpoint', data);
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['/api/endpoint'] });
    toast({ title: 'Success!' });
  },
});
```

### **Routing with Wouter**

```typescript
import { useLocation } from 'wouter';

const [location, setLocation] = useLocation();

// Navigate programmatically
setLocation('/dashboard');

// Define routes in App.tsx
<Switch>
  <Route path="/" component={HomePage} />
  <Route path="/dashboard" component={Dashboard} />
  <Route path="/settings" component={Settings} />
</Switch>
```

---

## 💎 **Tier System**

### **Access Control Pattern**

```typescript
// Check tier
const hasPro = ['pro', 'premium'].includes(user?.tier);
const hasPremium = user?.tier === 'premium';

// Gate features
if (!hasPro && requestedScheduleDate > 7) {
  throw new Error('Pro tier required for 7+ day scheduling');
}
```

### **Tier Limits**

| Feature | Free | Starter | Pro | Premium |
|---------|------|---------|-----|---------|
| Posts/day | 3 | ∞ | ∞ | ∞ |
| Captions/day | 5 | 50 | 500 | ∞ |
| Scheduling | ❌ | ❌ | 7 days | 30 days |
| Analytics | ❌ | ❌ | Basic | Full |
| Bulk operations | ❌ | ❌ | 10 | ∞ |

### **Implementation**

```typescript
// /server/middleware/tier-check.ts
export function requireTier(minTier: Tier) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!hasAccess(req.user?.tier, minTier)) {
      return res.status(403).json({ error: 'Upgrade required' });
    }
    next();
  };
}

// Usage
router.post('/schedule', requireTier('pro'), handler);
```

---

## 🌐 **External Services**

### **OpenRouter (AI Generation)**

```typescript
// /server/lib/openrouter-pipeline.ts
import { pipeline } from './openrouter-pipeline';

const result = await pipeline({
  imageUrl: 'https://i.imgur.com/...',
  voice: 'bratty_tease',
  tone: 'flirty',
  nsfw: true,
});
```

**Models:**

- Primary: `x-ai/grok-4-fast`
- Vision fallback: `opengvlab/internvl3-78b`
- Last resort: `google/gemini-2.0-flash-exp` (censors NSFW)

### **Imgur (Image Storage)**

```typescript
// /client/src/lib/imgur-upload.ts
const { url, deleteHash } = await uploadToImgur(file);

// Token refresh is automatic
const creds = await getImgurCredentials();
```

**OAuth Flow:**

1. User clicks "Connect Imgur"
2. Redirects to Imgur auth
3. Callback receives access + refresh tokens
4. Tokens stored in localStorage
5. Auto-refresh on expiry

### **Reddit API**

```typescript
// /server/lib/reddit-api.ts
await postToReddit({
  subreddit: 'gonewild',
  title: 'My caption',
  imageUrl: 'https://i.imgur.com/...',
  nsfw: true,
});
```

**Rate Limits:**

- 60 requests per minute per OAuth token
- Handled automatically in rate limiter middleware

---

## 🔄 **Development Workflow**

### **Setup**

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Setup database
npx drizzle-kit push

# Seed communities
npm run seed:communities

# Start dev server
npm run dev
```

### **Development**

```bash
# Dev mode (hot reload)
npm run dev

# Client only (Vite port 5173)
cd client && npm run dev

# Server only (port 5000)
cd server && npm run dev
```

### **Before Committing**

```bash
# Run all checks
npx tsc --noEmit  # Must have 0 errors
npm run lint      # Must pass
npm test          # Run tests

# Build to verify
npm run build     # Must succeed
```

### **Common Commands**

```bash
# Database operations
npx drizzle-kit generate  # Create migration
npx drizzle-kit push      # Apply to DB
npx drizzle-kit studio    # Open DB GUI

# Queue monitoring
npm run queue:ui          # Bull dashboard

# Deployment
./scripts/build-production.sh
npm start                 # Production mode
```

---

## 🧪 **Testing Strategy**

### **Unit Tests**

```typescript
// vitest.config.ts configured
import { describe, it, expect } from 'vitest';

describe('Component', () => {
  it('renders correctly', () => {
    const { getByText } = render(<Component />);
    expect(getByText('Hello')).toBeInTheDocument();
  });
});
```

### **API Testing**

```bash
# Use Postman or curl
curl -X POST http://localhost:5000/api/caption/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"imageUrl": "https://...", "tone": "flirty"}'
```

### **E2E Tests**

Location: `/e2e/*.spec.ts` (Playwright)

```bash
npm run test:e2e
```

---

## 🚀 **Deployment**

### **Render Configuration**

**Build Command:**

```bash
npm ci && npm run build
```

**Start Command:**

```bash
npm start
```

**Environment Variables (CRITICAL):**

```bash
NODE_ENV=production
RENDER=true
DATABASE_URL=postgresql://...  # NO SSL params!
JWT_SECRET=...
SESSION_SECRET=...
OPENROUTER_API_KEY=...
IMGUR_CLIENT_ID=...
IMGUR_CLIENT_SECRET=...
REDDIT_CLIENT_ID=...
REDDIT_CLIENT_SECRET=...
STRIPE_SECRET_KEY=...
```

### **Database Migration on Render**

```bash
# 1. Run migration locally first
npx drizzle-kit generate
npx drizzle-kit push

# 2. Commit migration file
git add drizzle/migrations/*.sql
git commit -m "Add migration"

# 3. Deploy code
git push

# 4. Migration runs automatically in postinstall
```

### **Monitoring**

- Check Render logs: `https://dashboard.render.com`
- Health check: `GET /api/health`
- Queue dashboard: `/admin/queues` (requires admin)

---

## ⚠️ **Known Issues & TODOs**

### **Current Issues**

1. **ImageShield disabled** - Being developed for beta
2. **Console.log statements** - 449 instances need cleanup
3. **Sentry DSN missing** - Error tracking not active
4. **Test coverage low** - Many tests commented out

### **Quick Wins**

- [ ] Add Sentry DSN for error tracking
- [ ] Remove console.log statements
- [ ] Add loading skeletons to all pages
- [ ] Implement proper error boundaries

### **Medium Priority**

- [ ] Enable ImageShield protection
- [ ] Add PDF export for analytics
- [ ] Implement notification system
- [ ] Add affiliate links to Flight School

---

## 🗺️ **Future Roadmap**

### **Phase 1: Beta Launch (Current)**

- ✅ Core posting functionality
- ✅ Caption generation
- ✅ Post scheduling
- ✅ Basic analytics
- ⏳ ImageShield (in progress)

### **Phase 2: Growth Features (Q1 2025)**

- Advanced analytics (A/B testing)
- Subreddit intelligence (trend detection)
- Multi-account support
- Team collaboration features
- API access for Premium users

### **Phase 3: Platform Expansion (Q2 2025)**

- Instagram integration
- Twitter/X integration
- TikTok integration
- Cross-platform scheduling
- White-label options

### **Phase 4: Enterprise (Q3 2025)**

- Agency dashboard
- Client management
- Branded reporting
- Custom AI models
- Dedicated support

---

## 📝 **Best Practices for AI Assistants**

### **When Making Changes**

1. **Always read the file first** before editing
2. **Check /docs/PLATFORM_OVERVIEW.md** for architecture decisions
3. **Verify tier restrictions** before adding features
4. **Run TypeScript check** after changes: `npx tsc --noEmit`
5. **Test the build** before saying "done": `npm run build`
6. **Check for existing patterns** in the codebase
7. **Follow the file naming** conventions (kebab-case)
8. **Add proper error handling** - never leave try/catch empty
9. **Use logger.error()** instead of console.log
10. **Update this guide** when making architectural changes

### **When Stuck**

1. Check `/docs/` directory for documentation
2. Look for similar implementations in the codebase
3. Check `HIDDEN_GAPS_AUDIT.md` for known issues
4. Read `BETA_READY_STATUS.md` for current status
5. Search for TODO comments in relevant files

### **Communication Style**

- **Be direct** - No "I think" or "maybe", be confident
- **Show code** - Use code blocks, not descriptions
- **Verify first** - Read files before suggesting changes
- **Test thoroughly** - Run checks before claiming success
- **Document decisions** - Update docs when making architectural changes

---

## 🎯 **Quick Reference Commands**

```bash
# Development
npm run dev                    # Start dev server
npm run build                  # Production build
npm start                      # Run production build

# Database
npx drizzle-kit push          # Push schema to DB
npx drizzle-kit studio        # Open DB GUI
npm run seed:communities      # Seed subreddits

# Quality Checks
npx tsc --noEmit              # TypeScript check
npm run lint                  # ESLint check
npm test                      # Run tests

# Queue Management
npm run queue:ui              # Bull queue dashboard
npm run queue:clean           # Clean failed jobs

# Deployment
./scripts/build-production.sh # Build for production
./scripts/check-render-env.sh # Verify env vars
```

---

## 📞 **Need Help?**

### **Documentation Hierarchy**

1. **This file** - AI Assistant Guide (comprehensive)
2. `/docs/PLATFORM_OVERVIEW.md` - Platform architecture
3. `/docs/API_ENDPOINTS_STATUS.md` - API reference
4. `/docs/BETA_READY_STATUS.md` - Current status
5. Code comments - Inline documentation

### **Key Files to Know**

- `/server/routes.ts` - All API routes registered here
- `/client/src/App.tsx` - Main React app
- `/shared/schema.ts` - Database schema
- `/server/lib/openrouter-pipeline.ts` - AI generation
- `/server/jobs/scheduler.ts` - Queue worker

---

**Last Updated:** October 29, 2025  
**Version:** 1.0.0  
**Maintained By:** Development Team

---

*This guide is the single source of truth for AI assistants working on ThottoPilot. When in doubt, refer to this document and the /docs/ directory.*
