# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

**⚠️ IMPORTANT**: This document is a supplementary guide. For complete platform context, read:
1. `/PLATFORM_MASTER_REFERENCE.md` - Full architecture and decisions
2. `/QUICK_REFERENCE.md` - Common questions and tasks

This file focuses on practical development workflows.

## Project Overview

ThottoPilot is a professional content management platform for adult content creators to manage their Reddit presence with legal compliance, content protection, and growth tools. Built with React 18 + Vite frontend, Express.js + TypeScript backend, and PostgreSQL database.

### Core Purpose
- **Primary Focus**: Reddit content management and posting automation
- **Target Users**: Adult content creators (OnlyFans, Fansly, etc.)
- **Key Differentiator**: Zero-storage architecture for legal compliance
- **Business Model**: Freemium SaaS with tier-based feature access

### Platform Pillars
1. **Legal Compliance** - No adult content storage, full 2257 compliance, DMCA protection
2. **Content Pipeline** - Imgur integration, AI caption generation, image protection (beta)
3. **Reddit Integration** - OAuth posting, subreddit rules, shadowban detection
4. **Growth Tools** - Analytics, scheduling, bulk operations, intelligence features

## Architecture

### Stack
- **Frontend**: React 18, TypeScript, Vite, Shadcn/UI, TailwindCSS, Wouter for routing
- **Backend**: Express.js, TypeScript (strict mode), ES modules
- **Database**: PostgreSQL with Drizzle ORM (schema in `shared/schema.ts`)
- **Queue System**: Abstracted interface supporting both PostgreSQL (PgQueue) and Redis (BullMQ)
- **AI Services**: Grok 4 Fast via OpenRouter (primary) with template system fallback

### Project Structure
```
├── client/src/          # React frontend
│   ├── components/      # Reusable UI components
│   ├── pages/          # Route pages
│   ├── lib/            # Client utilities
│   └── hooks/          # React hooks
├── server/             # Express backend
│   ├── lib/            # Core services (queue, AI, billing, storage)
│   ├── routes/         # API routes
│   ├── services/       # Business logic services
│   ├── middleware/     # Express middleware
│   ├── bootstrap/      # Initialization modules (logger, queue, session)
│   └── workers/        # Background job handlers
├── shared/             # Shared types & schema
│   └── schema.ts       # Drizzle database schema with Zod validation
├── migrations/         # Database migrations
└── prompts/            # AI generation prompt templates
```

### Key Architectural Patterns

**Queue System**: Universal queue interface (`server/lib/queue-interface.ts`) with Redis and PostgreSQL backends. Queue selection is automatic based on environment variables (REDIS_URL or DATABASE_URL). Factory pattern in `server/lib/queue-factory.ts` initializes the correct backend.

**AI Content Generation**: Multi-provider fallback system with cost prioritization:
1. Grok 4 Fast via OpenRouter (primary, fastest and cost-effective)
2. Template system (final fallback, always works)

The system automatically retries with the next provider on failure and gracefully degrades to demo content rather than hard failures.

**Quick Post Workflow**: The caption generation endpoint generates **5 variants** and returns the **best 2** to the user for selection. This approach:
- Provides user choice between top candidates
- Generates valuable testing data on user preferences
- Increases user engagement through active participation in content quality

**Database Schema**: Centralized in `shared/schema.ts` using Drizzle ORM. Includes:
- User management with 4-tier system (free, starter, pro, premium)
- Content generations with AI metadata
- Social media integrations (Reddit, Twitter, Instagram, OnlyFans)
- Billing, subscriptions, and referral tracking
- Analytics and engagement metrics
- Tax tracking and expense management
- Scheduled posts with timezone support

**Tier System**: Feature access controlled by `users.tier` column:
- **Free** ($0/mo): 3 posts/day, 1 subreddit, 5 AI generations/day, no scheduling
- **Starter** ($9/mo): Unlimited manual posts, 5 subreddits, 50 AI generations/day, **NO scheduling access**
- **Pro** ($29/mo): Unlimited posts, unlimited subreddits, **7-day scheduling**, basic analytics, 500 AI generations/day, bulk operations (10)
- **Premium** ($99/mo): **30-day scheduling**, max analytics with trends/forecasting, unlimited AI generations, API access, white-label options

**Scheduling Access**: Critical business rule - only Pro ($29+) and Premium ($99+) tiers have access to scheduled posting. Starter tier ($9) is manual posting only. This is enforced in:
- Frontend: Scheduling UI hidden for Free/Starter tiers
- Backend: `/api/scheduled-posts` endpoints check tier authorization
- Database: `scheduled_posts` table with userId validation against tier

**Authentication**: Session-based with Passport.js. Supports local auth and OAuth providers (Reddit, Google, Facebook). JWT tokens used for API authentication. CSRF protection via `csrf-csrf` with exemptions for Bearer tokens and webhooks.

**Image Protection**: Multi-layered client-side image processing using HTML5 Canvas:
- Light/Standard/Heavy preset configurations
- Gaussian blur, noise injection, intelligent resizing
- Metadata stripping, optional watermarking
- Interactive comparison slider component (`ComparisonSlider`)

**Rate Limiting**: Tier-based rate limiting middleware (`server/middleware/rate-limiter.ts`) with per-route configuration and Subreddit-specific rate limit tracking in database (`post_rate_limits` table).

**Imgur-Only Storage (Legal Compliance)**: CRITICAL REQUIREMENT - All images MUST use Imgur for legal compliance:
- **Why**: 2257 compliance for adult content, DMCA protection, zero local storage
- **Backend**: `server/lib/imgur-service.ts` handles Imgur API integration
- **Frontend**: `CatboxUploadPortal.tsx` component (reused for Imgur workflow)
- **Database**: URLs only stored in database, NEVER files
- **Environment**: Requires `IMGUR_CLIENT_ID`
- **Rate Limits**: ~1250 anonymous uploads/day per Client ID
- **Legal Compliance**: Zero adult content files on your infrastructure
- **Alternative**: Catbox tested but Imgur is PRIMARY for compliance

## Development Commands

### Essential Commands
```bash
npm run dev              # Start backend dev server (port 3005)
npm run dev:client       # Start Vite dev server (port 5173)
npm run dev:full         # Run both concurrently
npm run build            # Production build (runs build-production.sh)
npm start                # Start production server
npm run typecheck        # TypeScript validation (no emit)
npm test                 # Run all tests (unit + routes)
npm run test:unit        # Unit tests only
npm run test:routes      # Route tests only
npm run test:coverage    # Generate coverage report
```

### Database Commands
```bash
npm run db:push          # Push schema changes to database
npm run db:push -- --force  # Force push (production with data-loss warnings)
npm run db:generate      # Generate Drizzle migration files
npm run db:migrate       # Run pending migrations
npm run db:studio        # Open Drizzle Studio GUI
```

### Utility Commands
```bash
npm run ops:check-env              # Validate environment variables
npm run validate:env               # Production environment validation
npm run smoke:test                 # Run smoke tests
npm run db:backup                  # Validate database backup
npm run backfill:post-rate-limits  # Backfill rate limit data
```

## Key Environment Variables

### Required (Development)
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - JWT signing secret (auto-generated in dev, must set for production)
- `SESSION_SECRET` - Session cookie secret (auto-generated in dev)
- `OPENROUTER_API_KEY` - OpenRouter API key for Grok 4 Fast (primary AI provider)
- `APP_BASE_URL` - Base URL (http://localhost:5000 for dev)

### Optional (Production)
- `IMGUR_CLIENT_ID` - Imgur API client ID for zero-storage image uploads (highly recommended)
- `IMGUR_RATE_WARN_THRESHOLD` - Warning threshold for daily upload limit (default: 1000)
- `REDIS_URL` - Redis for high-performance queue (falls back to PostgreSQL)
- `STRIPE_SECRET_KEY` + `STRIPE_API_VERSION` - Payment processing
- `AWS_*` variables - S3 media storage (local storage fallback, rarely used with Imgur)
- `SENDGRID_API_KEY` or `RESEND_API_KEY` - Email services
- `TURNSTILE_SITE_KEY` + `TURNSTILE_SECRET_KEY` - Anti-bot protection
- `SENTRY_DSN` - Error tracking

**Queue Prerequisites**: Either `REDIS_URL` or `DATABASE_URL` must be set for background workers. Without these, the server boots in degraded mode with temporary auth secrets and no queue processing.

## Testing Approach

### Test Structure
- `tests/unit/` - Unit tests for utilities and helpers
- `tests/routes/` - API route tests
- `tests/auth/` - Authentication flow tests
- Coverage reports in `vitest.unit.config.ts`

### Running Single Tests
```bash
npx vitest tests/unit/specific-file.test.ts
npx vitest tests/routes/caption.test.ts
```

### Key Test Areas
- Authentication and authorization flows
- Content generation pipelines (AI service mocking)
- Image protection algorithms
- Billing and subscription management
- Rate limiting enforcement
- Upload persistence and quota checks
- Referral notification system
- Visitor analytics with conversion tracking

## Important Implementation Notes

### TypeScript Strict Mode
The project uses strict TypeScript settings:
- `strict: true`, `noImplicitAny: true`, `strictNullChecks: true`
- No `any` types without explicit justification
- No non-null assertions (`!`) unless verified safe
- Explicit type definitions for all public APIs

### Path Aliases
```typescript
"@/*"        → client/src/*
"@shared/*"  → shared/*
"@server/*"  → server/*
"@assets/*"  → attached_assets/*
```

### Module System
- ES modules throughout (type: "module" in package.json)
- All imports must include `.js` extension for TypeScript files
- Use `import.meta.url` instead of `__dirname`
- Node.js subpath imports in package.json: `#shared/*` and `#server/*`

### Queue Job Processing
To add a new background job:
1. Define job handler in `server/workers/`
2. Register handler via `queue.process('queue-name', handler)`
3. Enqueue jobs via `queue.enqueue('queue-name', payload, options)`
4. Queue system automatically retries failed jobs (configurable attempts)

### Database Migrations
When modifying `shared/schema.ts`:
1. Update schema definitions
2. Run `npm run db:generate` to create migration files
3. Run `npm run db:push` to apply changes (dev) or `npm run db:migrate` (production)
4. Test thoroughly - Drizzle can be destructive if not careful

### Session Management
- Session store uses PostgreSQL via `connect-pg-simple`
- Session table created by `migrations/001_create_session_table.sql`
- OAuth flows require session middleware configured before passport initialization
- Session IDs used for CSRF token generation

### Reddit Integration
- Reddit OAuth flow uses secure callback (`/api/reddit/callback`)
- Reddit posting requires valid access/refresh tokens in `users` table
- Subreddit rules cached in `reddit_communities` table
- Rate limiting per subreddit enforced via `post_rate_limits` table
- Post outcomes tracked in `reddit_post_outcomes` for analytics

### Payment Processing
- Stripe integration for subscriptions and one-time payments
- Multiple payment processors supported (CCBill, Paxum, Coinbase Commerce)
- Webhook handler at `/api/webhooks/stripe` with raw body parsing
- Subscription status synced to `users.subscriptionStatus` and `users.tier`

### Image Upload Flow

**Primary Method: Imgur Zero-Storage Integration**
1. User uploads image via `ImgurUploadPortal` component (drag & drop or URL paste)
2. Frontend sends image directly to Imgur API via `/api/uploads/imgur`
3. **No files touch your servers** - maintains legal compliance for adult content
4. Imgur returns URL and deleteHash
5. Metadata stored in `user_storage_assets` table (URL only, no file storage)
6. Daily usage tracked (1250 anonymous uploads/day per Client ID)
7. Users can paste existing image URLs (Imgur, Catbox, Discord, Reddit) as fallback

**Legacy Method: Direct Upload** (for S3/local storage when needed)
1. Upload via `/api/upload` route (uses Multer middleware)
2. MediaManager handles S3 or local storage persistence
3. Quota checks via `storage-quotas.ts` based on user tier
4. Metadata stored in `user_images` or `media_assets` tables

**Image Protection** (applies to both methods)
- Protected images processed client-side with comparison slider
- Multi-layered protection: blur, noise injection, resizing, metadata stripping
- Light/Standard/Heavy preset configurations

### AI Content Generation Flow
1. User submits generation request to `/api/caption`
2. System builds prompt using `server/services/prompt-builder.ts`
3. AI service (OpenRouter with Grok 4 Fast) generates **5 caption variants**
4. System evaluates and selects the **best 2 variants** to return to user
5. User selects their preferred caption (provides testing data + engagement)
6. Selected result stored in `content_generations` table with AI metadata
7. Daily generation limits enforced per tier

**Quick Post Workflow Notes**:
- Generates 5 variants internally for quality diversity
- Returns top 2 to balance choice without overwhelming user
- User selection tracked for preference learning and model improvement
- Fallback to template system if OpenRouter fails

### CSRF Protection
- Uses `csrf-csrf` library (csurf replacement)
- Token endpoint: `GET /api/csrf-token`
- Automatic exemptions for Bearer tokens, webhooks, OAuth callbacks
- Cookie name: `__Host-psifi.x-csrf-token` (production) or `psifi.x-csrf-token` (dev)

### Error Handling
- Sentry integration for production error tracking
- Winston logger with daily rotating file transport
- Request IDs via UUID for request correlation
- Unhandled rejections terminate process (fail-fast approach)

## Common Tasks

### Adding a New API Route
1. Create route file in `server/routes/` (e.g., `my-feature.ts`)
2. Export route function: `export function mountMyFeature(app: Express, apiPrefix: string)`
3. Import and call in `server/routes.ts` → `registerRoutes()`
4. Add authentication middleware where needed
5. Add rate limiting if required

### Adding a Database Table
1. Define table in `shared/schema.ts` using Drizzle syntax
2. Add insert schema: `export const insertMyTableSchema = createInsertSchema(myTable)`
3. Add types: `export type MyTable = typeof myTable.$inferSelect`
4. Run `npm run db:generate` and `npm run db:push`
5. Add relations if needed via `relations()` function

### Running Production Build Locally
```bash
npm run build                    # Build client and server
NODE_ENV=production npm start    # Start production server
```

### Debugging Queue Jobs
1. Check logs: `logs/` directory or console output
2. Monitor queue: Use queue-monitor utilities in `server/lib/queue-monitor.ts`
3. Retry failed: Call `queue.retryFailedJobs('queue-name')`
4. Inspect pending: `queue.getPendingCount('queue-name')`

### Working with React Components
- UI components in `client/src/components/ui/` use Shadcn conventions
- Page components in `client/src/pages/`
- Use Wouter for routing: `<Route path="/foo" component={FooPage} />`
- Toast notifications via Radix UI Toast primitive
- Form validation with React Hook Form + Zod

## Production Deployment Notes

### Pre-Deployment Checklist
- [ ] Run `npm run typecheck` - must pass with no errors
- [ ] Run `npm test` - all tests must pass
- [ ] Run `npm run test:coverage` - validate critical flows
- [ ] Set all required production env vars (see README.md)
- [ ] Run `npm run validate:env` - check environment configuration
- [ ] Run database migrations: `npm run db:push -- --force` (carefully!)
- [ ] Test build locally: `npm run build && NODE_ENV=production npm start`

### Performance Considerations
- Bundle analysis available in `bundle-report.html` after build
- Manual chunks configured in `vite.config.js` for vendor splitting
- Redis strongly recommended for production queue performance
- S3/CloudFront recommended for media delivery at scale

### Security Notes
- CSRF protection enabled by default for all state-changing routes
- Rate limiting per tier and per route
- Helmet.js configured via permissions policy middleware
- Session cookies use httpOnly, secure (prod), sameSite strict (prod)
- Never commit `.env` files or production secrets
- Use environment-specific secrets (rotate regularly)

## Known Issues & Quirks

- **Port Conflicts**: Dev server tries 3005 by default. Use `PORT=3006 npm run dev` if taken.
- **Session Persistence**: Sessions reset between restarts in dev unless `SESSION_SECRET` is set persistently.
- **Queue Initialization**: Queue skips initialization if neither `REDIS_URL` nor `DATABASE_URL` is set (logs warning).
- **Vite HMR**: Can conflict with backend routes. Use `npm run dev:full` or run frontend/backend separately.
- **TypeScript Imports**: Must use `.js` extension even for `.ts` files due to ES modules + TypeScript output.
- **Drizzle Schema Changes**: Can be destructive. Always backup before running `db:push --force` in production.
- **Reddit Token Refresh**: Tokens expire. Refresh logic in `server/lib/reddit.ts` handles automatic renewal.

## Imgur Integration (PRIMARY - Required)

**⚠️ CRITICAL**: Imgur is NOT optional - it's required for legal compliance with adult content regulations.

### Why Imgur Only
- **Legal Compliance**: 2257 record-keeping requirements
- **DMCA Protection**: Centralized takedown handling
- **Zero Storage**: No adult content files on your servers
- **Liability Reduction**: Third-party hosting shields platform

### Setup Process
1. **Get Imgur Client ID**: Register at https://api.imgur.com/oauth2/addclient
   - Application name: ThottoPilot
   - Authorization type: OAuth 2 authorization without a callback URL
   - Copy the Client ID

2. **Configure Environment**: Add to `.env`:
   ```env
   IMGUR_CLIENT_ID=your_client_id_here
   IMGUR_RATE_WARN_THRESHOLD=1000
   ```

3. **Run Migration**: Database table for tracking uploads
   ```bash
   npm run db:migrate
   # Or manually: psql $DATABASE_URL < migrations/0013_add_user_storage_assets.sql
   ```

4. **Test Integration**: Verify functionality
   ```bash
   node test-imgur-integration.js
   ```

### Technical Implementation

**Key Files**:
- `server/services/imgur-uploader.ts` - Core Imgur API client
- `server/routes/imgur-uploads.ts` - REST API endpoints
- `client/src/components/ImgurUploadPortal.tsx` - Upload UI component
- `shared/schema.ts` - `user_storage_assets` table definition
- `migrations/0013_add_user_storage_assets.sql` - Database schema

**Upload Flow**:
1. User drags image or pastes URL into `ImgurUploadPortal`
2. Frontend validates file type/size (15MB max, JPEG/PNG/GIF/WebP)
3. Image sent to `/api/uploads/imgur` endpoint (CSRF exempt)
4. Backend forwards to Imgur API with Client ID authentication
5. Imgur returns URL and deleteHash
6. Metadata saved to `user_storage_assets` table (provider='imgur-anon')
7. URL returned to frontend for immediate use in caption generation

**Rate Limit Management**:
- Tracks daily uploads in memory (resets at midnight UTC)
- Warning shown at threshold (default 1000/1250)
- Hard block at 1250 uploads
- Fallback to URL paste when limit reached
- Future: OAuth integration removes anonymous limits

**Supported URL Patterns** (paste fallback):
- Imgur: `https://i.imgur.com/*`, `https://imgur.com/*`
- Catbox: `https://files.catbox.moe/*`
- Discord CDN: `https://cdn.discordapp.com/*`
- Reddit: `https://i.redd.it/*`, `https://preview.redd.it/*`

### Troubleshooting

**Common Issues**:
- **"Upload limit reached"**: Daily limit exceeded, use URL paste or wait
- **"Failed to upload"**: Network error or Imgur API down, retry or use alternative
- **"Preview not loading"**: CORS issue, check browser console

**Debug Checklist**:
- [ ] `IMGUR_CLIENT_ID` environment variable set
- [ ] Server running (`npm run dev`)
- [ ] Database migration applied (`npm run db:migrate`)
- [ ] Network connectivity to api.imgur.com
- [ ] Check `/api/uploads/imgur/stats` for current usage

**Testing**:
```bash
# Automated test
node test-imgur-integration.js

# Manual test via curl
curl -X POST http://localhost:3005/api/uploads/imgur \
  -F "image=@/path/to/image.jpg" \
  -F "markSensitive=true"
```

### Future Enhancements
- **Phase 2**: OAuth integration for unlimited uploads via user's Imgur account
- **Phase 3**: Multi-provider support (Catbox, PostImages, S3 for power users)
- **Phase 4**: Bulk upload, album management, image optimization, CDN integration

## User Workflows

### Onboarding Flow
```
Sign Up → Email Verification → Connect Reddit → Select Subreddits → First Post
```

**Implementation**:
- Email verification via `verification_tokens` table
- Reddit OAuth in `server/social-auth.ts` with secure callback
- Subreddit selection from `reddit_communities` table
- Onboarding state tracked in `onboarding_states` table

### Daily Creator Workflow
```
Dashboard → Upload to Imgur → Generate Captions → Schedule/Post → Track Performance
```

**Key Pages**:
- Dashboard: `client/src/pages/Dashboard.tsx`
- Upload: `ImgurUploadPortal.tsx` component
- Caption Gen: `/api/caption` endpoint (returns best 2 of 5 variants)
- Scheduling: `client/src/pages/ScheduledPosts.tsx` (Pro+ only)
- Analytics: `client/src/pages/Analytics.tsx` (Pro+ only)

### Quick Post Flow (Starter+)
```
Quick Post → Upload Image → Select from 2 AI Captions → Auto-post
```

**Implementation**:
- Quick post button in navigation
- Imgur upload via `/api/uploads/imgur`
- AI generates 5 variants, returns best 2 for user selection
- User choice tracked for preference learning
- Immediate posting via `/api/reddit/post`

### Scheduled Campaign Flow (Pro+)
```
Scheduling Page → Bulk Upload → Select Images → Generate Captions → Set Times → Auto-post
```

**Implementation**:
- Tier check: requires Pro ($29) or Premium ($49)
- Bulk upload up to 10 images (Pro) or unlimited (Premium)
- Schedule up to 7 days (Pro) or 30 days (Premium)
- Cron job in `server/workers/scheduled-post-worker.ts` processes queue
- Posts stored in `scheduled_posts` table with status tracking

## Current Platform Status

### ✅ Working Features
- Authentication system (local + OAuth)
- Reddit OAuth integration with token refresh
- Imgur zero-storage uploads with rate limiting
- AI caption generation (Grok 4 Fast via OpenRouter)
- Quick post workflow (5 variants → best 2)
- Basic scheduling system (cron setup needed)
- Dashboard UI with tier-based feature visibility
- Referral system with commission tracking
- Tax tracker for expense management

### 🚧 In Development
- Analytics dashboard (Pro+ tier)
- Intelligence features (Premium tier)
- Bulk operations (Pro+ tier)
- Mobile responsive optimization
- Subreddit recommendation engine
- Shadowban detection improvements
- Promotional URL integration (OnlyFans/Fansly CTAs in captions)

### 📋 Planned for Beta
- **ImageShield re-enabling** (currently disabled for stability)
- Advanced scheduling automation
- A/B testing for captions
- Trending topics detection
- Competition analysis tools
- API access for Premium tier
- White-label solutions
- Mobile app (native or PWA)

### ⚠️ Known Issues & Limitations
1. **Scheduling Cron**: Requires cron job setup in production (`scheduled-post-worker.ts`)
2. **ImageShield**: Temporarily disabled until beta (components exist but hidden)
3. **Analytics Dashboard**: Incomplete implementation, tier restrictions partial
4. **Payment Enforcement**: Tier upgrades work, but some feature gates need verification
5. **Rate Limiting**: Imgur limits managed, Reddit rate limits need per-subreddit enforcement
6. **Scheduled Post Queue**: PostgreSQL queue works but Redis recommended for production scale

## Business Model & Monetization

### Revenue Streams
1. **Subscription Tiers**: Free → Starter ($9) → Pro ($29) → Premium ($99)
2. **Referral Commissions**: $5 per converted referral (tracked in `referral_rewards` table)
3. **API Access**: Premium tier feature (planned, not yet implemented)
4. **White-Label Solutions**: Enterprise offering (planned)

### Growth Strategy
1. **Free Tier**: Generous feature set for user acquisition (3 posts/day, basic AI)
2. **Value Ladder**: Clear upgrade path with scheduling as primary upsell
3. **Referral Incentives**: Built-in viral loop via referral system
4. **Community Building**: Reddit-focused features create network effects

### Tier Enforcement Checklist
- [ ] Frontend: Hide scheduling UI for Free/Starter (`ScheduledPosts.tsx`)
- [ ] Backend: Validate tier in `/api/scheduled-posts` endpoints
- [ ] Analytics: Restrict dashboard access to Pro+ (`Analytics.tsx`)
- [ ] AI Limits: Enforce daily generation limits (5/50/500/unlimited)
- [ ] Bulk Operations: Limit to 10 for Pro, unlimited for Premium
- [ ] Subreddit Access: 1 for Free, 5 for Starter, unlimited for Pro+

## Admin Portal Features

### User Management
- View all users with tier and subscription status
- Manual tier upgrades/downgrades
- Account suspension/bans
- User activity monitoring
- Support ticket system (planned)

### Content Moderation
- Flagged content review
- DMCA takedown tracking
- Compliance monitoring
- Subreddit violation alerts

### Platform Analytics
- User growth metrics
- Revenue tracking (MRR, churn, LTV)
- Feature usage statistics
- Conversion funnel analysis
- Referral performance

### System Health
- API uptime monitoring
- Queue job status
- Error rate tracking
- Database performance
- Third-party service status (Imgur, Reddit, OpenRouter)

**Admin Routes**: Mounted in `server/admin-routes.ts`, require `users.isAdmin = true`

## Support & Documentation

**⚠️ START HERE: Read these in order for complete platform context**

1. **`PLATFORM_MASTER_REFERENCE.md`** - Complete platform knowledge base (READ FIRST)
2. **`QUICK_REFERENCE.md`** - Fast answers and common tasks
3. **`README.md`** - Installation and getting started
4. **`docs/PLATFORM_OVERVIEW.md`** - High-level overview
5. **`DEPLOYMENT.md`** - Deployment guide
6. **`docs/tax-tracker-support.md`** - Tax tracker help
7. **`docs/REDDIT_INTEGRATION_SETUP.md`** - Reddit integration
8. **`docs/CRON_JOBS_IMPLEMENTATION.md`** - Scheduling system
