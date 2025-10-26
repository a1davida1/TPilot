# ThottoPilot - Master Platform Reference

**Version:** 2.0  
**Last Updated:** October 19, 2025  
**Status:** Production Active

This is the **single source of truth** for ThottoPilot's architecture, decisions, constraints, and context. Read this first before making changes or asking questions.

---

## 🎯 Platform Mission & Goals

### Primary Mission
Adult content creator management platform focused on Reddit automation, AI caption generation, and compliance-first operations.

### Core Goals
1. **Legal Compliance First** - 2257 compliance, no local image storage, DMCA tracking
2. **Creator Empowerment** - Tools to scale content posting across Reddit efficiently
3. **AI-Powered Quality** - Natural, non-AI-sounding captions using uncensored models
4. **Monetization Support** - Subtle and explicit promotional tools (OnlyFans/Fansly)
5. **Tier-Based Access** - Free → Starter → Pro → Premium progression

---

## 🏗️ Technology Stack

### Frontend
- **Framework:** React 18 + TypeScript
- **Routing:** Wouter (lightweight)
- **Styling:** TailwindCSS + shadcn/ui components
- **State Management:** TanStack Query (React Query)
- **Build Tool:** Vite
- **Icons:** Lucide React

### Backend
- **Runtime:** Node.js + Express
- **Language:** TypeScript
- **Database:** PostgreSQL (Render hosted)
- **ORM:** Drizzle ORM
- **Auth:** JWT tokens
- **Queue System:** BullMQ + Redis
- **Cron Jobs:** node-cron

### External Services
- **AI Models:** OpenRouter (Grok-4-Fast primary)
- **Image Hosting:** Imgur API (compliance requirement)
- **Reddit API:** Snoowrap + Official Reddit API
- **Payments:** Stripe (primary), CCBill (backend ready)
- **Analytics:** Custom PostgreSQL-based

---

## 🚨 Critical Architecture Decisions

### 1. **Reddit Native Upload with Imgbox Fallback**
**Why:** Direct Reddit uploads provide best performance and legal compliance
- Zero local file system storage (legal requirement)
- Primary: Direct upload to Reddit CDN (i.redd.it) via `submitImage()` API
- Fallback: Imgbox rehosting when Reddit CDN rejects upload
- Database stores URLs ONLY, never files

**Implementation:**
- `/server/services/reddit-native-upload.ts` - Main upload service
- `/server/lib/reddit.ts` - `submitImagePost()` method for direct Reddit uploads
- `/server/lib/imgbox-service.ts` - Automatic fallback when Reddit fails
- Allowed image hosts for security: i.redd.it, images.imgbox.com, thumbs.imgbox.com, i.imgbox.com, files.catbox.moe, imgur.com, etc.

**Upload Flow:**
1. Image optimized for Reddit (max 20MB, 10000px dimensions)
2. Direct upload to Reddit CDN → i.redd.it URL (primary path)
3. If Reddit rejects: Imgbox upload → images.imgbox.com URL → Reddit link post (fallback)
4. Success with optional warning if fallback was used

### 2. **OpenRouter AI with Grok-4-Fast (NOT Gemini)**
**Why:** Gemini censors adult content, Grok is uncensored and faster

**LEGACY SYSTEM:**
- ❌ Old Gemini pipeline (`/server/lib/gemini-client.ts`) - **DEPRECATED**
- ❌ `generateCaptionsWithFallback()` - **DO NOT USE**

**CURRENT SYSTEM:**
- ✅ OpenRouter pipeline (`/server/caption/openrouterPipeline.ts`)
- ✅ Model: `x-ai/grok-4-fast`
- ✅ Vision model: `opengvlab/internvl3-78b` (NSFW specialized)
- ✅ Fallback: Gemini 2.5 Flash (only if OpenRouter fails)

**Settings:**
```typescript
temperature: 1.4
frequency_penalty: 0.7
presence_penalty: 1.5
```

### 3. **Snoowrap Vulnerabilities Are Unavoidable**
**Context:** 5 known vulnerabilities in dependency chain

**Why We Can't Fix Them:**
- Snoowrap is unmaintained (last update 2019)
- No viable Reddit API alternative for OAuth2 flows
- Vulnerabilities are in sub-dependencies (mostly dev-time)
- Risk accepted for production use

**Alternative Considered:**
- Official Reddit API - doesn't support full OAuth2 flow
- PRAW (Python) - not viable for Node.js stack
- Custom implementation - would take months

**Mitigation:**
- Rate limiting on all Reddit endpoints
- Input validation and sanitization
- Monitor for security patches in sub-deps
- Plan to fork Snoowrap if critical vulnerability emerges

### 4. **Render Deployment Constraints**

**SSL Handling:**
```typescript
// server/db.ts - Auto-detects Render and enables SSL
const needsSSL = connectionString.includes('render.com');
```

**Environment Variables (Required):**
```bash
NODE_ENV=production
RENDER=true  # Auto-set by Render
DATABASE_URL=postgresql://...  # NO ?ssl=true params
JWT_SECRET=...
SESSION_SECRET=...
IMGUR_CLIENT_ID=...
OPENROUTER_API_KEY=...
REDIS_URL=...
```

**Build Commands:**
```bash
Build: npm install && npm run build
Start: node dist/server/index.js
```

---

## 💰 Tier System & Restrictions

### FREE Tier
- 3 posts/day
- 5 captions/day
- NO scheduling
- NO analytics
- Basic features only

### STARTER ($12.99/month)
- 10 posts/day
- 50 captions/day
- NO scheduling (same as free)
- Basic features

### PRO ($24.99/month)
- 50 posts/day
- 500 captions/day
- **7-day scheduling**
- Basic analytics
- Priority support

### PREMIUM ($49.99/month)
- Unlimited posts
- Unlimited captions
- **30-day scheduling**
- Full analytics dashboard
- AI model selection
- Dedicated support

**Pricing:**
- FREE: $0/month
- STARTER: $12.99/month
- PRO: $24.99/month
- PREMIUM: $49.99/month

**Enforcement:**
- `/server/lib/tier-limits.ts` - Rate limiting logic
- `/server/middleware/tier-check.ts` - Route protection
- Database: `user_tier` and `subscription_status` fields

---

## 🎨 Caption Generation System

### Pipeline Architecture
```
User Request → API Route → OpenRouter Pipeline → Prompt Assembly → AI Generation → 
Variant Ranking → Fact Coverage Check → Platform Compliance → Response
```

### Key Components

**1. Pipeline Function** (`/server/caption/openrouterPipeline.ts`)
- Main orchestrator: `pipeline()`
- Variant generation: `generateVariants()`
- Ranking: `rankAndSelect()`
- Fact coverage: `ensureFactCoverage()`

**2. Prompt System**
- `/prompts/nsfw-variants.txt` - NSFW caption rules
- `/prompts/variants.txt` - SFW caption rules
- `/prompts/nsfw-system.txt` - System prompt
- `/prompts/guard.txt` - Anti-AI detection rules

**3. Voice Personas**

**SFW Voices:**
- flirty_playful
- gamer_nerdy
- luxury_minimal
- arts_muse
- gym_energy
- cozy_girl

**NSFW Voices:**
- seductive_goddess
- intimate_girlfriend
- bratty_tease
- submissive_kitten

**4. Promotion Modes (NEW)**
- **None:** Generic engagement CTAs
- **Subtle:** "Check my profile", "DM for more"
- **Explicit:** "See more at onlyfans.com/username"

---

## 📊 Database Schema Overview

### Core Tables
- `users` - User accounts and auth
- `user_preferences` - Settings (theme, promo URLs, defaults)
- `subscriptions` - Stripe subscription data
- `content_generations` - Caption history
- `scheduled_posts` - Post scheduling queue
- `reddit_accounts` - OAuth credentials (encrypted)
- `reddit_communities` - Subreddit metadata
- `reddit_post_outcomes` - Post analytics
- `catbox_uploads` - Upload tracking (legacy)

### Key Fields Added Recently
- `user_preferences.only_fans_url` - OnlyFans promotional URL
- `user_preferences.fansly_url` - Fansly promotional URL
- `users.catbox_userhash` - Catbox authentication (unused)

---

## 🔐 Security & Compliance

### Image Storage Compliance
1. **No local files** - All images on Imgur
2. **URL-only storage** - Database stores URLs, not files
3. **2257 compliance** - Age verification at upload
4. **DMCA tracking** - Metadata for takedown requests

### Authentication
- JWT tokens (httpOnly cookies in production)
- Session management via PostgreSQL
- Rate limiting on auth endpoints
- Password hashing with bcrypt

### API Security
- CORS configured for production domain
- CSRF protection via csrf-csrf
- Input validation with Zod schemas
- SQL injection protection (Drizzle ORM)

---

## 🚀 API Endpoints Reference

### Caption Generation
```
POST /api/caption/generate         - Image → Caption
POST /api/caption/generate-text    - Text → Caption  
POST /api/caption/rewrite          - Rewrite existing caption
POST /api/one-click-captions       - Quick 2-variant generation
```

**Shared Parameters:**
```typescript
{
  platform: 'reddit' | 'instagram' | 'x' | 'tiktok'
  voice: string           // SFW or NSFW voice
  style?: string          // 'explicit', 'poetic', 'chill', etc.
  mood?: string           // 'seductive', 'romantic', etc.
  nsfw: boolean           // Enables NSFW voices & prompts
  includeHashtags: boolean
  promotionMode: 'none' | 'subtle' | 'explicit'  // NEW
}
```

### Reddit Integration
```
GET  /api/reddit/auth              - OAuth redirect
GET  /api/reddit/callback          - OAuth callback
POST /api/reddit/post              - Submit post
GET  /api/reddit/communities       - List subreddits
POST /api/reddit/validate-post     - Check subreddit rules
```

### Scheduling
```
GET  /api/scheduled-posts          - List scheduled posts
POST /api/scheduled-posts          - Create scheduled post
DELETE /api/scheduled-posts/:id    - Cancel scheduled post
```

### User Management
```
GET   /api/user/settings           - Get preferences
PATCH /api/user/settings           - Update preferences
GET   /api/user/export             - Export user data
DELETE /api/user/account           - Delete account
```

---

## 🎨 Frontend Coding Standards

### TypeScript Rules
```typescript
// ✅ DO: Explicit types
interface UserSettings {
  theme: string;
  notifications: boolean;
}

// ❌ DON'T: Use 'any'
const data: any = await fetch(); // FORBIDDEN

// ✅ DO: Use 'unknown' and type guards
const data: unknown = await fetch();
if (isUserSettings(data)) { /* ... */ }
```

### Component Structure
```tsx
// Imports
import { useState } from 'react';
import { Button } from '@/components/ui/button';

// Types
interface Props {
  title: string;
  onSave: () => void;
}

// Component
export function MyComponent({ title, onSave }: Props) {
  const [state, setState] = useState('');
  
  return (
    <div>
      {/* JSX */}
    </div>
  );
}
```

### State Management
- Use TanStack Query for server state
- Use useState for local UI state
- Use useQuery for GET requests
- Use useMutation for POST/PATCH/DELETE

---

## 🔧 Development Workflow

### Local Development
```bash
# Start dev servers
npm run dev              # Both client & server
npm run dev:client       # Vite only
npm run dev:server       # Express only

# Database
npm run db:generate      # Generate migrations from schema
npm run db:migrate       # Apply migrations
npm run db:push          # Push schema changes (dev only)
npm run db:studio        # Open Drizzle Studio

# Testing
npm test                 # Run tests
npm run lint             # ESLint check
npm run typecheck        # TypeScript check
```

### Migration Process
1. Update `/shared/schema.ts`
2. Run `npm run db:generate` (creates migration)
3. Review SQL in `/migrations/`
4. Run `npm run db:migrate` (apply to local DB)
5. Test locally
6. Commit migration files
7. Deploy to production
8. Run migration script on production DB

### Code Quality Checks
**Before Every Commit:**
```bash
npx tsc --noEmit         # MUST pass (zero errors)
npm run lint             # MUST pass (zero errors)
npm run lint -- --fix    # Auto-fix if possible
```

**Pre-existing warnings are OK, but:**
- Never introduce NEW TypeScript errors
- Never introduce NEW ESLint errors
- Fix errors you create immediately

---

## 📝 Common Patterns & Conventions

### Error Handling
```typescript
// API Routes
try {
  const result = await someOperation();
  res.json({ success: true, data: result });
} catch (error) {
  logger.error('Operation failed:', error);
  if (options?.sentry) {
    options.sentry.captureException(error);
  }
  res.status(500).json({ message: 'Operation failed' });
}
```

### Database Queries
```typescript
// Use Drizzle ORM
import { db } from '@/db';
import { users } from '@shared/schema';

// Select
const user = await db.select().from(users).where(eq(users.id, userId));

// Insert
await db.insert(users).values({ email, username });

// Update
await db.update(users).set({ theme: 'dark' }).where(eq(users.id, userId));
```

### API Client (Frontend)
```typescript
import { apiRequest } from '@/lib/queryClient';

// Use helper function (handles auth, errors)
const response = await apiRequest('POST', '/api/caption/generate', {
  imageUrl,
  platform: 'reddit',
  nsfw: true
});

const result = await response.json();
```

---

## 🐛 Known Issues & Trade-offs

### 1. Snoowrap Vulnerabilities
- **Status:** Accepted risk
- **Count:** 5 vulnerabilities (1 critical, 4 moderate)
- **Reason:** No alternative Reddit OAuth library
- **Mitigation:** Input validation, rate limiting

### 2. Legacy Gemini Code
- **Location:** `/server/lib/gemini-client.ts`
- **Status:** Keep for reference, DO NOT USE
- **Reason:** Kept in case OpenRouter fails long-term
- **Action:** Use OpenRouter pipeline exclusively

### 3. Catbox Integration
- **Status:** Implemented but not primary
- **Reason:** Imgur is compliance requirement
- **Usage:** Optional alternative, not enforced

### 4. Reddit API Rate Limits
- **Limit:** 60 requests/minute per OAuth token
- **Handling:** Queue system with BullMQ
- **Retry:** Exponential backoff on 429 errors

### 5. Imgur Anonymous Uploads
- **Limit:** ~1250 uploads/day per IP
- **Solution:** Use authenticated uploads (CLIENT_ID)
- **Fallback:** Spread across multiple IPs if needed

---

## 🚀 Deployment Checklist

### Pre-Deployment
- [ ] All tests pass (`npm test`)
- [ ] TypeScript compiles (`npx tsc --noEmit`)
- [ ] ESLint passes (`npm run lint`)
- [ ] Migrations tested locally
- [ ] Environment variables documented

### Production Deployment
1. **Database Migration**
   ```bash
   export DATABASE_URL="production_url"
   ./scripts/apply-0017-promotion-urls.sh  # Example
   ```

2. **Code Deployment**
   ```bash
   git pull origin main
   npm install --production
   npm run build
   pm2 restart thottopilot  # Or equivalent
   ```

3. **Verification**
   - [ ] Health check endpoint responds
   - [ ] Database connection works
   - [ ] Redis connection works
   - [ ] Cron jobs running
   - [ ] Queue workers active

### Environment Variables (Production)
```bash
NODE_ENV=production
RENDER=true
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_SECRET=...
SESSION_SECRET=...
IMGUR_CLIENT_ID=...
OPENROUTER_API_KEY=...
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
SENTRY_DSN=...  # Optional
```

---

## 📚 Additional Documentation

### Key Files to Reference
- `/docs/PLATFORM_OVERVIEW.md` - High-level platform docs
- `/docs/CRON_JOBS_IMPLEMENTATION.md` - Scheduling system
- `/PAYMENT_STRATEGY_BETA.md` - Payment integration
- `/migrations/0017_README.md` - Latest migration example
- `/prompts/nsfw-variants.txt` - Caption generation rules

### Critical Files (Don't Modify Without Review)
- `/server/caption/openrouterPipeline.ts` - AI pipeline
- `/server/lib/tier-limits.ts` - Business logic enforcement
- `/server/middleware/auth.ts` - Authentication
- `/shared/schema.ts` - Database schema
- `/server/db.ts` - Database connection

---

## 🎯 Current Priorities (October 2025)

1. **Stability First** - No breaking changes to core features
2. **Performance** - Optimize AI pipeline response times
3. **Analytics** - Build out Pro/Premium analytics dashboard
4. **Reddit Integration** - Improve subreddit rule validation
5. **Mobile UI** - Responsive design improvements

---

## ❓ FAQ for AI Assistants

**Q: Should I mention Imgur/Catbox uploads?**
A: No - users paste URLs from wherever they host. Platform doesn't upload or host anything (legal liability).

**Q: Can I use Gemini for caption generation?**  
A: No - use OpenRouter pipeline exclusively. Gemini is legacy/deprecated.

**Q: Why do we have npm vulnerabilities?**  
A: Snoowrap (Reddit library) has unavoidable dep vulnerabilities. It's an accepted risk.

**Q: Can users store images locally?**
**NEVER** - Legal compliance requires zero storage AND no API connections to hosting services.

**Q: Should I add a new AI provider?**  
A: Only if OpenRouter fails long-term. Current system works well.

**Q: Can I refactor the tier system?**  
A: No - it's tightly integrated with business logic. Discuss with user first.

**Q: Should I add new migrations?**  
A: Yes, follow the established pattern in `/migrations/0017_README.md`

**Q: Can I remove old code?**  
A: Check with user first. Some "legacy" code is kept intentionally.

---

## 📞 Contact & Support

**Project Owner:** Dave (a1davida1)  
**Repository:** github.com/a1davida1/TPilot  
**Production URL:** [To be configured]  
**Status Page:** [To be configured]

---

**Last Updated:** October 19, 2025  
**Document Version:** 2.0  
**Next Review:** January 2026
