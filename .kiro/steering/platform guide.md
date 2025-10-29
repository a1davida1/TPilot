---
inclusion: always
---

# ThottoPilot Platform Guide

## Platform Purpose

ThottoPilot is a professional content management platform for adult content creators managing Reddit presence with AI-powered captions, scheduled posting, and analytics.

**Target Users:** Adult content creators, OnlyFans/Fansly creators, Reddit marketers

**Legal Context:** Adult content platform requiring strict 2257/DMCA compliance



## Architecture

**Hybrid Stack:** React (Vite) + Next.js App Router + Express + PostgreSQL + Bull Queue (Valkey)

**Key Decisions:**
- **Dual routing:** Wouter for main SPA (`client/src`) + Next.js App Router for specific features (`app/`)
- React Query (TanStack Query v5) for state management
- Drizzle ORM for type-safe database queries
- Bull + Valkey for job queues (scheduled posts, AI generation)
- Express REST API (primary) + Next.js API routes (secondary) - no GraphQL, no tRPC

**Why Hybrid?**
- Vite/Wouter for fast SPA experience
- Next.js App Router for server-side features (gallery, posting workflows)
- Both systems coexist - Express handles most API routes

## Tech Stack

**Frontend:** React 18 + TypeScript + Vite + Wouter + Next.js App Router + shadcn/ui + Tailwind CSS  
**Backend:** Node.js 20+ + Express + TypeScript + Drizzle ORM + Winston  
**Database:** PostgreSQL 15+ (Render)  
**Queue:** Bull + Valkey (Redis-compatible)  
**External APIs:** OpenRouter (AI), Reddit i.redd.it CDN (primary storage), Imgbox (fallback), Reddit OAuth, Stripe  
**Deployment:** Render.com

## Project Structure

```
client/src/          # React frontend (Vite + Wouter)
  components/        # Reusable UI components
  pages/             # Route pages (Wouter)
  hooks/             # Custom React hooks
  lib/               # API client, utilities

app/                 # Next.js App Router (hybrid features)
  (dashboard)/       # Dashboard routes (gallery, posting, schedule)
  api/               # Next.js API routes (coexists with Express)
  lib/               # Next.js utilities

server/              # Express backend
  routes/            # API route handlers
  services/          # Business logic (RedditNativeUploadService, etc.)
  lib/               # Server utilities (openrouter-client, reddit, media)
  middleware/        # Express middleware
  jobs/              # Bull queue workers
  caption/           # AI caption generation pipelines

shared/              # Shared code
  schema.ts          # Drizzle database schema (single source of truth)
  types/             # TypeScript definitions

prompts/             # AI system prompts
  nsfw-system.txt    # NSFW caption generation
  sfw-system.txt     # SFW caption generation
```

## Critical Rules

### 1. TypeScript Strict Mode
- **NO `any` types** - Use explicit interfaces or `unknown`
- **NO non-null assertions (`!`)** - Use optional chaining or `??`
- All functions must have explicit return types
- All parameters must be typed

### 2. No Local Image Storage (LEGAL REQUIREMENT)
```typescript
// ❌ ILLEGAL - Never store images locally
fs.writeFile('uploads/image.jpg', buffer)

// ✅ LEGAL - Reddit native upload (primary)
await RedditNativeUploadService.uploadAndPost({
  userId, subreddit, imageUrl, title
})

// ✅ LEGAL - Imgbox fallback (when Reddit CDN fails)
await ImgboxService.upload({ buffer, filename })
```
**Why:** Adult content 2257 compliance - no local file storage allowed

**Image Upload Flow:**
1. **Primary:** Reddit i.redd.it CDN (via `RedditNativeUploadService`)
2. **Fallback:** Imgbox (when Reddit rejects upload)
3. **Never:** Local filesystem, S3, or database storage

### 3. AI Model Usage
- **Primary:** OpenRouter with `x-ai/grok-4-fast` (uncensored, fast, text generation)
- **Vision:** `opengvlab/internvl3-78b` (image analysis)
- **Last resort:** `google/gemini-2.0-flash-exp` (censors NSFW - avoid)
- **DO NOT use Gemini as primary** - Censors adult content
- Location: `/server/lib/openrouter-client.ts` and `/server/caption/openrouterPipeline.ts`

### 4. Database Migration Order
```bash
# ✅ CORRECT - Prevents production outages
1. Create migration SQL file
2. Run migration on database FIRST
3. Update schema.ts
4. Deploy code

# ❌ WRONG - Breaks production
1. Update schema.ts
2. Deploy code (auth breaks immediately)
```

### 5. Environment Variables
```bash
# REQUIRED for Render deployment
NODE_ENV=production
RENDER=true                    # Forces production mode
DATABASE_URL=postgresql://...  # NO ?ssl=true suffix!
JWT_SECRET=...
SESSION_SECRET=...
OPENROUTER_API_KEY=sk-or-...
```

## Database Schema

### Key Tables

#### users
```typescript
{
  id: serial primary key
  email: string unique
  username: string
  tier: 'free' | 'starter' | 'pro' | 'premium'
  redditAccessToken: string?
  imgurAccessToken: string?
  imgboxUserhash: string?
  createdAt: timestamp
}
```

#### mediaAssets
```typescript
{
  id: serial primary key
  userId: integer (FK users)
  url: string  // Imgur (primary) or Imgbox (fallback) URL
  protected: boolean
  viewCount: integer
  createdAt: timestamp
}
```

#### redditPostOutcomes
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

#### scheduledPosts
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

**Schema Location:** `/shared/schema.ts` - Drizzle ORM schema definitions (single source of truth)

## API Patterns

### Standard API Response Format
```typescript
// Success
{ data: T, success: true }

// Error
{ error: string, message?: string }
```

### Authentication Middleware
```typescript
import { authenticateToken } from '../middleware/auth';

// Require auth
router.get('/protected', authenticateToken(true), handler);

// Optional auth
router.get('/public', authenticateToken(false), handler);
```

### API Route Structure
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

### Registering Routes
```typescript
// /server/routes.ts
import { exampleRouter } from './routes/example.js';
app.use('/api/example', exampleRouter);
```

**Note:** Both Express (`/server/routes/`) and Next.js (`/app/api/`) API routes coexist. Express is primary.

## Frontend Patterns

### Page Component Template
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

### React Query Pattern
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

### Routing with Wouter
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

**Note:** Use Wouter for main SPA routes. Next.js App Router handles `/app/(dashboard)/*` routes.

## Tier System

### Access Control Pattern
```typescript
// Check tier
const hasPro = ['pro', 'premium'].includes(user?.tier);
const hasPremium = user?.tier === 'premium';

// Gate features
if (!hasPro && requestedScheduleDate > 7) {
  throw new Error('Pro tier required for 7+ day scheduling');
}
```

### Tier Limits
| Feature | Free | Starter | Pro | Premium |
|---------|------|---------|-----|---------|
| Posts/day | 3 | ∞ | ∞ | ∞ |
| Captions/day | 5 | 50 | 500 | ∞ |
| Scheduling | ❌ | ❌ | 7 days | 30 days |
| Analytics | ❌ | ❌ | Basic | Full |
| Bulk operations | ❌ | ❌ | 10 | ∞ |

### Implementation
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

## External Services

### OpenRouter (AI Generation)
```typescript
// /server/caption/openrouterPipeline.ts
import { generateVision, generateText, GROK_4_FAST } from '../lib/openrouter-client';

const result = await generateVision({
  imageUrl: 'https://i.imgur.com/...',
  prompt: 'Describe this image',
  model: GROK_4_FAST
});
```

**Models:**
- Text: `x-ai/grok-4-fast` (primary)
- Vision: `opengvlab/internvl3-78b`
- Fallback: `google/gemini-2.0-flash-exp` (censors NSFW - avoid)

### Reddit Native Upload (Primary Image Storage)
```typescript
// /server/services/reddit-native-upload.ts
const result = await RedditNativeUploadService.uploadAndPost({
  userId,
  subreddit: 'gonewild',
  imageUrl: 'https://i.imgur.com/...',
  title: 'My caption',
  nsfw: true,
  allowImgboxFallback: true
});

// Returns: { success, postId, url, redditImageUrl: 'https://i.redd.it/...' }
```

**Storage Priority:**
1. **Primary:** Reddit i.redd.it CDN (native upload, no external dependencies)
2. **Fallback:** Imgbox (when Reddit CDN rejects upload)
3. **Never:** Local filesystem, S3, or database storage

### Imgbox (Fallback Image Storage)
```typescript
// /server/lib/imgbox-service.ts
const result = await ImgboxService.upload({
  buffer: imageBuffer,
  filename: 'image.jpg'
});

// Returns: { success, url: 'https://images.imgbox.com/...' }
```

**When Used:** Only when Reddit CDN upload fails

### Reddit API
```typescript
// /server/lib/reddit.ts
await postToReddit({
  subreddit: 'gonewild',
  title: 'My caption',
  imageUrl: 'https://i.redd.it/...',
  nsfw: true,
});
```

**Rate Limits:**
- 60 requests per minute per OAuth token
- Handled automatically in rate limiter middleware

## Development Workflow

### Setup
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

### Development
```bash
# Dev mode (hot reload)
npm run dev

# Client only (Vite port 5173)
cd client && npm run dev

# Server only (port 5000)
cd server && npm run dev
```

### Before Committing
```bash
# Run all checks
npx tsc --noEmit  # Must have 0 errors
npm run lint      # Must pass
npm test          # Run tests

# Build to verify
npm run build     # Must succeed
```

### Common Commands
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

## Testing Strategy

### Unit Tests
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

### API Testing
```bash
# Use Postman or curl
curl -X POST http://localhost:5000/api/caption/generate \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"imageUrl": "https://...", "tone": "flirty"}'
```

### E2E Tests
Location: `/e2e/*.spec.ts` (Playwright)

```bash
npm run test:e2e
```

## Deployment

### Render Configuration

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

### Database Migration on Render
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

### Monitoring
- Check Render logs: `https://dashboard.render.com`
- Health check: `GET /api/health`
- Queue dashboard: `/admin/queues` (requires admin)

## Known Issues

### Current Issues
1. **ImageShield disabled** - Being developed for beta
2. **Console.log statements** - 449 instances need cleanup
3. **Sentry DSN missing** - Error tracking not active
4. **Test coverage low** - Many tests commented out

### Quick Wins
- [ ] Add Sentry DSN for error tracking
- [ ] Remove console.log statements
- [ ] Add loading skeletons to all pages
- [ ] Implement proper error boundaries

### Medium Priority
- [ ] Enable ImageShield protection
- [ ] Add PDF export for analytics
- [ ] Implement notification system
- [ ] Add affiliate links to Flight School

## Best Practices for AI Assistants

### When Making Changes
1. **Always read files first** before editing
2. **Check /docs/PLATFORM_OVERVIEW.md** for architecture decisions
3. **Verify tier restrictions** before adding features
4. **Run TypeScript check** after changes: `npx tsc --noEmit`
5. **Test the build** before saying "done": `npm run build`
6. **Check for existing patterns** in the codebase
7. **Follow the file naming** conventions (kebab-case)
8. **Add proper error handling** - never leave try/catch empty
9. **Use logger.error()** instead of console.log
10. **Update this guide** when making architectural changes

### When Stuck

1. Check `/docs/` directory for documentation
2. Look for similar implementations in the codebase
3. Check `HIDDEN_GAPS_AUDIT.md` for known issues
4. Read `BETA_READY_STATUS.md` for current status
5. Search for TODO comments in relevant files

## Quick Reference Commands

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

## Key Files Reference
- `/server/routes.ts` - All Express API routes registered here
- `/app/api/` - Next.js API routes (secondary)
- `/client/src/App.tsx` - Main React SPA
- `/shared/schema.ts` - Database schema (single source of truth)
- `/server/lib/openrouter-client.ts` - AI client
- `/server/caption/openrouterPipeline.ts` - Caption generation
- `/server/services/reddit-native-upload.ts` - Reddit CDN upload service
- `/server/lib/imgbox-service.ts` - Imgbox fallback service
- `/server/jobs/` - Bull queue workers