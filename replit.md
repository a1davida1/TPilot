# Overview

ThottoPilot is a social media content creation platform designed for adult content creators. Its primary purpose is to generate engaging Reddit posts, including personalized titles, content, and photo instructions, while offering intelligent promotion features and image protection capabilities. The platform adapts content based on subreddit promotion rules to streamline content monetization and protection for creators. Key capabilities include advanced AI content generation, multi-layered image protection, and a tiered access system. The project aims to provide a comprehensive solution for adult content creators to manage and promote their work effectively and safely across social media.

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
- **Theme System**: Token-based light/dark mode with WCAG AA compliance.
- **State Management**: TanStack Query (React Query).
- **Routing**: Wouter.
- **Form Handling**: React Hook Form with Zod validation.
- **UI/UX Decisions**: Bubblegum color scheme, ultra-polished interface with high-contrast text, glass morphism, dynamic gradients, premium CSS animations, and mobile-first design. Anti-hover visibility patterns. Three-tier portal views (Guest, Free, Starter, Pro) with upgrade prompts.
- **Accessibility**: WCAG AA compliance enforced.

## Backend Architecture
- **Server Framework**: Express.js with TypeScript on Node.js.
- **API Design**: RESTful API.
- **Data Storage**: PostgreSQL.
- **Content Generation**: Advanced template-based content generator for social media platforms and subreddit rules.
- **Session Management**: Express sessions with PostgreSQL-backed storage.
- **System Design Choices**: Smart 4090 architecture for batch processing (ImageShield preprocessing, Content Engine generation, Voice Clone library creation). Unified content creator with dual workflow (Text-First, Image-First) and tier-based access. Queue provider abstraction.

## Database Design
- **ORM**: Drizzle ORM for PostgreSQL.
- **Schema**: Users, Content generations, queue_jobs, post_rate_limits, post_duplicates tables.
- **Migrations**: Drizzle Kit.

## Authentication & Authorization
- **Authentication**: Username/password with session-based persistence. Social authentication (Facebook, Google, Reddit OAuth). Dual login method (email/username).
- **Session Storage**: PostgreSQL-backed sessions.
- **Authorization**: User-scoped content generation history and statistics. Admin portal.

## Content Generation System
- **Template Engine**: Predefined templates organized by platform, style, and theme, including 50+ promotional templates.
- **Photo Instructions**: Structured guidance for lighting, angles, composition, styling, and technical settings.
- **Platform Optimization**: Content tailored for social media requirements.
- **Promotion Intelligence**: Smart content adaptation based on subreddit rules.
- **Advanced Features**: Fine-tuning with sample library and personalization settings. One-click style presets. Tiered content system with varying generation capabilities. Dual AI providers (Gemini + OpenAI) with response caching.

## Image Protection System
- **Anti-Reverse Search**: Multi-layered image processing (Gaussian blur, subtle noise, intelligent resizing, metadata stripping).
- **Quality Preservation**: Maintains visual appeal post-processing.
- **Client-Side Processing**: Browser-based manipulation using HTML5 Canvas.
- **Preset Configurations**: Light, standard, and heavy protection levels.
- **Watermark System**: Tiered watermarking for free users.

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
- **BullMQ**: Background job processing.
- **ioredis**: Redis client.
- **CCBill**: Billing integration.
- **SegPay, Epoch, Paxum, Coinbase Commerce**: Multi-payment provider scaffolds.

## Recent Changes (September 22, 2025)

### Prompt Field Serialization for Hints (September 22, 2025)
- ✅ **Hint sanitization**: Applied `serializePromptField` with `{ block: true }` to both initial hints and retry hints in Gemini pipeline to prevent prompt corruption from quotes and control characters
- ✅ **Comprehensive serialization flow**: Updated `buildUserPrompt` function to serialize combined hints before interpolating them into the `HINT:` line
- ✅ **Enhanced test coverage**: Added unit tests verifying hints containing quotes and line breaks are properly sanitized and survive the retry flow
- ✅ **Prompt security**: Ensures malformed hints cannot corrupt Gemini prompts during initial generation or subsequent retry attempts

### Mandatory Token Enforcement in Pipeline Rewrite (September 22, 2025)
- ✅ **Enhanced token preservation**: Added `enforceMandatoryTokens()` function to pipeline rewrite system that triggers after every `rankAndSelect` and `runRewrite` call
- ✅ **Systematic enforcement flow**: Restructured rewrite pipeline to track ranked variants and enforce mandatory token retention immediately after initial selection and during subsequent retries
- ✅ **Intelligent retry messaging**: Token enforcement includes "ABSOLUTE RULE" hints specifying which tokens must be preserved and which were removed in previous attempts
- ✅ **Comprehensive test coverage**: Extended rewrite tests to verify required entities survive the Gemini path without relying on OpenAI fallback, confirming platform-compliant outputs
- ✅ **Error handling**: Throws explicit errors when mandatory tokens remain missing after retry attempts

### PDF Receipt Naming Convention Updated (September 22, 2025)
- ✅ **Consistent timestamped filenames**: Updated PDF receipt upload handler to use the same `protected_${Date.now()}-${filename}` naming convention as images for local storage
- ✅ **Unique filename generation**: All PDF receipts now receive timestamped prefixes to prevent filename conflicts during successive uploads
- ✅ **Enhanced test coverage**: Updated receipt upload tests to verify timestamped PDF naming and added test for unique filename generation across multiple uploads
- ✅ **Improved file management**: PDF and image receipts now follow the same consistent naming pattern for better organization and collision prevention

### Safe Caption Normalization Defaults Implemented (September 22, 2025)
- ✅ **Replaced banned word defaults**: Updated `dedupeVariants.ts` to use safe fallback constants (`SAFE_DEFAULT_CAPTION`, `SAFE_DEFAULT_ALT`, `REDDIT_FALLBACK_TAGS`) instead of defaults containing "content"
- ✅ **Platform-aware hashtag resolution**: Added `minimumHashtagCount()`, `resolveFallbackHashtags()`, and `sanitizeHashtagList()` helpers for context-aware safe defaults
- ✅ **Enhanced normalization logic**: Both `geminiPipeline.ts` and `textOnlyPipeline.ts` now use `ensureFallbackCompliance` helper to provide safe hashtags via `fallbackHashtags()` function
- ✅ **Comprehensive test coverage**: Added integration test proving Gemini pipeline handles missing hashtags gracefully by falling back to safe OpenAI defaults without banned tokens
- ✅ **Banned word elimination**: All normalization paths now avoid introducing "content", "creative", "amazing" and other sparkle-filler terms in generated hashtags and captions

### Enhanced Expense Management with Category Integration (September 22, 2025)
- ✅ **defaultBusinessPurpose field added**: Extended expenseCategories schema with defaultBusinessPurpose field for automated business purpose assignment
- ✅ **Enhanced validation and deduction logic**: Updated expense routes with comprehensive validation, automatic deduction percentage application from categories, and intelligent business purpose defaults
- ✅ **Storage optimization**: Refactored updateExpense to recalculate deduction percentages when category changes, with exported summarizeExpenseTotals helper for consistent calculations
- ✅ **Regression test coverage**: Added comprehensive unit tests verifying expense totals calculations with different deduction percentages and category-based logic
- ✅ **Database migration applied**: Successfully added default_business_purpose column to expense_categories table with proper schema synchronization

### JWT_SECRET Handling Fixed in Admin Routes
- ✅ **Lazy JWT secret resolution**: Admin routes now load without throwing when JWT_SECRET is undefined, resolving the secret lazily inside middleware
- ✅ **Test environment support**: Deterministic fallback ('test-jwt-secret') provided when NODE_ENV === 'test'