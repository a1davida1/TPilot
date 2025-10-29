# Technology Stack

## Core Technologies

- **Runtime**: Node.js 20+ with ES Modules
- **Language**: TypeScript 5.6.3 (strict mode enabled)
- **Frontend**: React 18 + Vite 7
- **Backend**: Express.js 4.21
- **Database**: PostgreSQL with Drizzle ORM
- **Queue System**: Bull (Redis-based) for scheduled posts and async jobs
- **Routing**: Wouter (client-side) + Next.js App Router (hybrid for specific features)

## Key Libraries & Frameworks

### Frontend
- **UI Components**: Shadcn/ui (Radix UI primitives)
- **Styling**: Tailwind CSS 3.4
- **State Management**: TanStack Query (React Query)
- **Forms**: React Hook Form + Zod validation
- **Icons**: Lucide React
- **Animation**: Framer Motion

### Backend
- **ORM**: Drizzle ORM with drizzle-zod
- **Validation**: Zod schemas
- **Authentication**: Passport.js (local, Reddit OAuth)
- **Sessions**: express-session with PostgreSQL store
- **Security**: Helmet, CORS, CSRF protection (csrf-csrf)
- **Rate Limiting**: express-rate-limit with Redis
- **Logging**: Winston with daily rotate files

### External Services
- **AI**: OpenRouter API (Grok-4-Fast model, InternVL3-78B for vision)
- **Image Hosting**: Reddit i.redd.it CDN (primary), Imgbox (fallback)
- **Payments**: Stripe
- **Email**: SendGrid or Resend
- **Social**: Reddit API (snoowrap)

## TypeScript Standards

**Strict Mode Enabled** - All code must follow these rules:

- ❌ **NO `any` types** - Use explicit interfaces or `unknown`
- ❌ **NO non-null assertions (`!`)** - Use optional chaining or `??` with defaults
- ✅ **Explicit type definitions** - All functions, parameters, and returns must be typed
- ✅ **Strict generics** - Default to `unknown` for generic type parameters
- ✅ **Interface mocking** - Test mocks must match real interfaces

## Common Commands

### Development
```bash
npm run dev              # Start dev server (backend + frontend)
npm run dev:client       # Start Vite dev server only
npm run dev:full         # Start both with concurrently
```

### Building
```bash
npm run build            # Full production build (client + server)
npm run build:client     # Build Vite frontend only
npm run build:server     # Build TypeScript server only
```

### Database
```bash
npm run db:push          # Push schema changes to database
npm run db:generate      # Generate migration files
npm run db:migrate       # Run migrations
npm run db:studio        # Open Drizzle Studio GUI
```

### Testing
```bash
npm test                 # Run all tests (unit + routes + jest)
npm run test:unit        # Run unit tests only
npm run test:routes      # Run route tests only
npm run test:coverage    # Generate coverage report
npm run test:e2e         # Run Playwright E2E tests
```

### Code Quality
```bash
npm run typecheck        # TypeScript validation (no emit)
npm run lint             # ESLint check
npm run fix-imports      # Auto-fix import issues
```

### Deployment
```bash
npm run predeploy        # Full pre-deploy check (typecheck + lint + test + build)
npm start                # Start production server
```

## Build System

- **Vite** for frontend bundling with React plugin
- **TSC** for server TypeScript compilation
- **Path Aliases**: `@/` (client), `@shared/` (shared types), `@server/` (server)
- **Manual Chunks**: Vendor splitting for React, Radix UI, Stripe
- **Bundle Analysis**: `rollup-plugin-visualizer` generates `bundle-report.html`

## Environment Configuration

Critical environment variables (see `.env.example`):
- `DATABASE_URL` - PostgreSQL connection string (required)
- `OPENAI_API_KEY` - OpenRouter API key (required for AI)
- `REDDIT_CLIENT_ID` / `REDDIT_CLIENT_SECRET` - Reddit OAuth
- `STRIPE_SECRET_KEY` / `STRIPE_API_VERSION` - Payment processing
- `JWT_SECRET` / `SESSION_SECRET` - Authentication secrets
- `REDIS_URL` - Redis for queues (optional, falls back to PostgreSQL)
- `APP_BASE_URL` - Base URL for OAuth redirects

## Deployment Target

- **Platform**: Render.com (primary)
- **Database**: Render PostgreSQL with SSL required
- **Node Version**: 20.x
- **Build Command**: `npm run build`
- **Start Command**: `npm start`
