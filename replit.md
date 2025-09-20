# Overview

ThottoPilot is a social media content creation platform for adult content creators, generating engaging Reddit posts with personalized titles, content, and photo instructions. It offers intelligent promotion features, image protection capabilities, and adapts content based on subreddit promotion rules. The platform aims to streamline content monetization and protection for creators.

## Recent Changes (September 20, 2025)

### Caption Pipeline Tone Parameter Forwarding
- ✅ **Tone persistence across retries**: Implemented comprehensive tone parameter forwarding system for all caption generation pipelines
- ✅ **ToneOptions helper created**: Centralized type-safe extraction of tone parameters (style, mood) from request parameters
- ✅ **Pipeline consistency maintained**: All three pipelines (Gemini, rewrite, text-only) now preserve caller's tone preferences during platform validation retries
- ✅ **Regression test coverage**: Added comprehensive unit tests verifying tone parameter extraction and preservation logic
- ✅ **Type safety enhanced**: Updated pipeline type definitions to properly handle tone parameters with intersection types

### Pricing Structure Updated
- ✅ **Updated subscription tiers**: New pricing structure with Starter ($13.99/month) and Pro ($24.99/month) plans
- ✅ **Removed Premium tier**: Simplified to two paid tiers, Enterprise/Agency tier planned for future
- ✅ **Updated feature allocation**: Free (5 generations/day, 2GB storage), Starter (50 generations/day, 10GB storage), Pro (unlimited generations, 50GB storage, API access)
- ✅ **Frontend pricing updates**: All checkout flows, billing dashboard, and feature comparison tables updated
- ✅ **Backend billing configuration**: Updated Stripe price labels and billing API responses

## Recent Changes (September 17, 2025)

### Test Stabilization Completed
- ✅ **Email verification tests stabilized**: Fixed request type detection using req.accepts(['html','json']), added missing sendWelcomeEmail call
- ✅ **Policy linter database normalization fixed**: Subreddit names now preserve underscores for correct database lookups
- ✅ Authentication flow tests now 4/4 passing with consistent JSON vs redirect behavior
- ✅ Content moderation system stabilized with proper subreddit rule matching

### TypeScript Deployment Fixes Applied (August 19, 2025)
- ✅ Fixed duplicate property names in server/lib/config.ts (APP_BASE_URL, CCBILL_*, WATERMARK_*, etc.)
- ✅ Added missing database schema properties (MEDIA_MAX_BYTES_FREE, MEDIA_MAX_BYTES_PRO)
- ✅ Fixed TypeScript strict type checking with proper null checks and type assertions
- ✅ Added downlevelIteration: true and target: "ES2015" to tsconfig.json for Set iteration support
- ✅ Fixed database query type mismatches with proper type conversions for user IDs
- ✅ Resolved React component type issues (analytics dashboard, media library, enterprise components)
- ✅ Fixed API request parameter mismatches throughout the codebase
- ✅ Reduced TypeScript compilation errors from 300+ to 122 (61% reduction)

### Production Deployment Status (August 19, 2025)
- ✅ **Gemini API Configured**: Google Gemini now primary AI provider with GOOGLE_GENAI_API_KEY
- ✅ OpenAI configured as fallback (currently quota exceeded but available as backup)
- ✅ TypeScript errors being fixed (reduced from 300+ to ~100)
- ✅ Enhanced AI content generation with automatic fallback system
- ✅ Safety systems (rate limiting, duplicate detection) fully operational
- ✅ Database schema alignment completed for critical tables
- ✅ Server running successfully with graceful error handling
- ✅ API endpoints working with Gemini primary, OpenAI fallback, template as last resort

# User Preferences

Preferred communication style: Simple, everyday language.
Authentication: Landing page first, registration form only shows when "Register" clicked, guest mode available for trial
UI/UX: Ultra-polished dark interface with neon accents, glass morphism, and dynamic gradients
Navigation: Left sidebar with collapsible sections (cleaner and more user-friendly than tabs)
Future features: Payment system integration planned
Design: Live app interface demonstration instead of traditional landing page, showing actual functionality
Interface: Bubblegum color scheme with high-contrast text for optimal readability, animated backgrounds, and premium visual effects
Content: Remove "AI" terminology from user-facing interface to make it feel more natural and accessible
RTX 4090 Strategy: Use for helper AI training, image protection algorithms, and model fine-tuning - not core live functionality
Compliance: Phased approach - base features without ID verification, gate advanced content features behind age verification

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript using Vite.
- **UI Components**: Shadcn/ui built on Radix UI.
- **Styling**: Tailwind CSS with comprehensive token-based theming system.
- **Theme System**: Token-based light/dark mode with WCAG AA compliance, SSR-safe persistence, and comprehensive CSS variables.
- **State Management**: TanStack Query (React Query).
- **Routing**: Wouter.
- **Form Handling**: React Hook Form with Zod validation.
- **UI/UX Decisions**: Bubblegum color scheme (vibrant pink/rose with yellow accents), ultra-polished interface with guaranteed high-contrast text for permanent readability, glass morphism, dynamic gradients, premium CSS animations, and mobile-first design. Anti-hover visibility patterns implemented. Three-tier portal views (Guest, Free, Starter $13.99/mo, Pro $24.99/mo) with upgrade prompts.
- **Accessibility**: WCAG AA compliance enforced via ESLint/Stylelint rules, comprehensive test suite, high contrast and reduced motion support.

## Backend Architecture
- **Server Framework**: Express.js with TypeScript on Node.js.
- **API Design**: RESTful API.
- **Data Storage**: PostgreSQL.
- **Content Generation**: Advanced template-based content generator adapting content for specific social media platforms and subreddit promotion rules.
- **Session Management**: Express sessions with PostgreSQL-backed storage.
- **System Design Choices**: Smart 4090 architecture for batch processing (ImageShield preprocessing, Content Engine generation, Voice Clone library creation) to optimize costs. Unified content creator with dual workflow (Text-First, Image-First) and tier-based access. Queue provider abstraction with Redis/PostgreSQL fallback.

## Database Design
- **ORM**: Drizzle ORM for PostgreSQL.
- **Schema**: Users, Content generations, queue_jobs, post_rate_limits, post_duplicates tables.
- **Migrations**: Drizzle Kit.

## Authentication & Authorization
- **Authentication**: Username/password with session-based persistence. Social authentication (Facebook, Google, Reddit OAuth). Dual login method (email/username).
- **Session Storage**: PostgreSQL-backed sessions.
- **Authorization**: User-scoped content generation history and statistics. Admin portal.

## Content Generation System
- **Template Engine**: Predefined templates organized by platform, style, and theme. Includes 50+ promotional templates.
- **Photo Instructions**: Structured guidance for lighting, angles, composition, styling, and technical settings.
- **Platform Optimization**: Content tailored for social media requirements and audience expectations.
- **Promotion Intelligence**: Smart content adaptation based on subreddit rules.
- **Advanced Features**: Fine-tuning with sample library and personalization settings. One-click style presets. Tiered content system with pre-generated templates for free users (5 generations/day), enhanced capabilities for Starter users (50 generations/day), and unlimited AI generation for Pro users. Advanced content generation engine producing outputs based on photo type, text tone, promotion settings, and hashtag selection. Dual AI providers (Gemini + OpenAI) with response caching.

## Image Protection System
- **Anti-Reverse Search**: Multi-layered image processing (Gaussian blur, subtle noise, intelligent resizing, metadata stripping).
- **Quality Preservation**: Maintains visual appeal post-processing.
- **Client-Side Processing**: Browser-based manipulation using HTML5 Canvas.
- **Preset Configurations**: Light, standard, and heavy protection levels.
- **Watermark System**: Tiered watermarking for free users ("Protected by ThottoPilot™").

# External Dependencies

## Database
- **PostgreSQL**: Primary database via Neon Database serverless PostgreSQL.

## UI Framework
- **Radix UI**: Unstyled, accessible React components.
- **Embla Carousel**: Touch-friendly carousel.
- **Lucide React**: Icon library.

## Development Tools
- **Vite**: Fast build tool.
- **ESBuild**: JavaScript bundler for server-side code.
- **TypeScript**: Static type checking.

## Validation & Forms
- **Zod**: Runtime type validation and schema definition.
- **Drizzle-Zod**: Drizzle ORM and Zod integration.

## Utility Libraries
- **Date-fns**: Date manipulation.
- **Class Variance Authority**: Type-safe variant API for styling.
- **Clsx & Tailwind Merge**: Utility for conditional CSS class composition.

## Other Libraries/Services
- **AWS SDK**: For S3 media management.
- **sharp**: Image processing.
- **crypto-js**: Cryptographic functions.
- **snoowrap**: Reddit API wrapper.
- **Google GenAI**: AI content generation.
- **OpenAI**: AI content generation (GPT-4o).
- **BullMQ**: Background job processing (legacy, now abstracted).
- **ioredis**: Redis client (legacy, now abstracted).
- **CCBill**: Billing integration.
- **SegPay, Epoch, Paxum, Coinbase Commerce**: Multi-payment provider scaffolds.