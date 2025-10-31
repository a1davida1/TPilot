# Project Structure

## Root Organization

```
├── client/              # React frontend (Vite)
├── server/              # Express backend
├── shared/              # Shared types and schemas
├── app/                 # Next.js App Router (hybrid features)
├── tests/               # Test suites
├── docs/                # Documentation
├── scripts/             # Utility scripts
├── drizzle/             # Database migrations
└── prompts/             # AI prompt templates
```

## Frontend Structure (`client/src/`)

```
client/src/
├── App.tsx              # Main app component
├── main.tsx             # Entry point
├── components/          # Reusable UI components
│   ├── ui/              # Shadcn/ui primitives
│   ├── auth/            # Authentication components
│   ├── dashboard/       # Dashboard widgets
│   └── tests/           # Component tests
├── pages/               # Route pages (Wouter)
│   ├── dashboard.tsx
│   ├── quick-post.tsx
│   ├── bulk-caption.tsx
│   ├── scheduling.tsx
│   ├── analytics.tsx
│   ├── analytics-insights.tsx    # Advanced analytics (QW-6: Health scores, removals)
│   ├── subreddit-discovery.tsx   # Subreddit discovery (QW-8: Recommendations)
│   ├── performance-analytics.tsx
│   ├── intelligence-insights.tsx
│   └── tax-tracker.tsx
├── hooks/               # Custom React hooks
│   ├── useAuth.ts
│   ├── useReddit.ts
│   └── useQuery.ts
├── lib/                 # Client utilities
│   ├── api.ts           # API client
│   ├── queryClient.ts   # TanStack Query config
│   └── utils.ts         # Helper functions
├── types/               # TypeScript types
└── styles/              # Global styles
```

## Backend Structure (`server/`)

```
server/
├── index.ts             # Server entry point
├── app.ts               # Express app setup
├── routes.ts            # Main route definitions
├── auth.ts              # Authentication logic
├── storage.ts           # File storage abstraction
├── routes/              # API route handlers
│   ├── reddit.ts
│   ├── caption.ts
│   ├── scheduling.ts
│   └── analytics.ts
├── caption/             # AI caption generation
│   ├── openrouterPipeline.ts  # Primary AI pipeline
│   ├── textOnlyPipeline.ts    # Text-to-caption
│   └── rewritePipeline.ts     # Caption rewrite
├── lib/                 # Core services
│   ├── config.ts        # Environment config
│   ├── gemini.ts        # Legacy (not used)
│   ├── openrouter-client.ts   # OpenRouter API
│   └── queue.ts         # Job queue abstraction
├── services/            # Business logic
│   ├── reddit-service.ts
│   ├── caption-service.ts
│   └── analytics-service.ts
├── middleware/          # Express middleware
│   ├── auth.ts          # Auth middleware
│   ├── rate-limit.ts    # Rate limiting
│   └── validation.ts    # Request validation
├── jobs/                # Background jobs
│   ├── scheduled-posts.ts
│   └── analytics-aggregation.ts
├── db/                  # Database utilities
│   └── index.ts
└── types/               # Server-side types
```

## Shared Code (`shared/`)

```
shared/
├── schema.ts            # Drizzle database schema
├── types.ts             # Shared TypeScript types
└── validation.ts        # Zod validation schemas
```

## Hybrid Next.js (`app/`)

```
app/
├── (dashboard)/         # Dashboard routes
│   ├── gallery/         # Gallery feature
│   └── posting/         # Posting pages
├── api/                 # Next.js API routes
│   ├── uploads/
│   └── reddit/
└── lib/                 # Next.js utilities
```

## Testing Structure (`tests/`)

```
tests/
├── unit/                # Unit tests
│   ├── caption/
│   ├── server/
│   └── lib/
├── routes/              # API route tests
│   ├── auth.test.ts
│   └── reddit.test.ts
├── integration/         # Integration tests
└── e2e/                 # End-to-end tests (Playwright)
```

## Key Conventions

### Import Paths
- `@/` → `client/src/` (frontend code)
- `@shared/` → `shared/` (shared types/schemas)
- `@server/` → `server/` (backend code)
- `#shared/` → `shared/` (Node.js imports)
- `#server/` → `server/` (Node.js imports)

### File Naming
- **Components**: PascalCase (`UserProfile.tsx`)
- **Utilities**: camelCase (`formatDate.ts`)
- **Routes**: kebab-case (`reddit-routes.ts`)
- **Tests**: `*.test.ts` or `*.test.tsx`
- **Types**: `types.ts` or `*.types.ts`

### Code Organization
- **One component per file** (except small related components)
- **Co-locate tests** with source files when appropriate
- **Barrel exports** for public APIs (`index.ts`)
- **Separate concerns**: UI, logic, data access

### API Routes
- **Express routes**: `/api/*` (handled by `server/routes/`)
- **Next.js routes**: `/api/*` (handled by `app/api/`)
- Both systems coexist - Express is primary

### Database
- **Schema**: `shared/schema.ts` (single source of truth)
- **Migrations**: `drizzle/` (auto-generated)
- **Queries**: Use Drizzle ORM, no raw SQL unless necessary

### AI Prompts
- **Location**: `prompts/` directory
- **Voices**: `prompts/voices.json` (personality definitions)
- **System prompts**: `prompts/nsfw-system.txt`, `prompts/sfw-system.txt`
- **Variants**: `prompts/nsfw-variants.txt`, `prompts/sfw-variants.txt`

## Critical Architecture Rules

### Image Storage
- ❌ **NO local file storage** - Legal compliance
- ✅ **Reddit i.redd.it CDN** - Primary upload target
- ✅ **Imgbox fallback** - Only when Reddit rejects
- ❌ **NO S3, NO database storage** - URLs only

### AI Generation
- ✅ **OpenRouter ONLY** - `openrouterPipeline.ts`
- ❌ **NO Gemini** - Legacy code, not used
- ✅ **Three modes**: Image, Text, Rewrite (all use OpenRouter)

### Authentication
- **Sessions**: PostgreSQL-backed express-session
- **JWT**: For API authentication
- **OAuth**: Reddit integration via Passport.js

### Queue System
- **Primary**: Bull with Redis
- **Fallback**: PostgreSQL-based queue
- **Jobs**: Scheduled posts, analytics aggregation

## Documentation
- **Main docs**: `docs/` directory
- **Platform overview**: `docs/PLATFORM_OVERVIEW.md`
- **Master reference**: `PLATFORM_MASTER_REFERENCE.md`
- **Quick reference**: `QUICK_REFERENCE.md`
- **Agent rules**: `AGENTS.md` (TypeScript standards)
