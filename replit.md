# Overview

ThottoPilot is a social media content creation platform designed for adult content creators. Its primary purpose is to generate engaging Reddit posts, including personalized titles, content, and photo instructions, while offering intelligent promotion features and image protection capabilities. The platform adapts content based on subreddit promotion rules to streamline content monetization and protection for creators. Key capabilities include advanced AI content generation, multi-layered image protection, and a tiered access system. The project aims to provide a comprehensive solution for adult content creators to manage and promote their work effectively and safely across social media.

# User Preferences

Preferred communication style: Simple, everyday language.
Development workflow: Always prioritize production/deployment fixes - test and deploy changes to live environment immediately
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
- **Testing**: Vanilla Vitest pattern with react-dom/client and act() - NOT @testing-library/react. All components using react-query hooks must be wrapped with QueryClientProvider in tests.
- **Landing Page**: Parallax scrollY effects with framer-motion, skeleton loading states for metrics with Skeleton component UI, expandable Getting Started accordion with Radix UI Accordion components. Real-time metrics display with loading states for creators, posts, and engagement statistics via `/api/metrics` endpoint.
- **Onboarding**: Comprehensive onboarding system with multiple features:
  - **UserOnboarding Component**: Interactive tutorial system with reset, skip, and complete handlers. Toast notifications for user feedback. LocalStorage persistence for progress tracking.
  - **Onboarding Walkthrough**: User-specific progress persistence using database-backed state via `useOnboardingState` hook and `/api/onboarding/state` endpoint. Automatic position restoration based on completed steps. Accessible navigation with keyboard support and focus management.
  - **Walkthrough Replay**: Available in header dropdown menu for authenticated users on dashboard and settings pages.

## Backend Architecture
- **Server Framework**: Express.js with TypeScript on Node.js.
- **API Design**: RESTful API.
- **Data Storage**: PostgreSQL.
- **AI Models**: 
  - **Primary**: OpenRouter Grok-2-Fast (x-ai/grok-2-fast) - fast, uncensored model
  - **Alternative Vision**: OpenRouter InternVL3-78B (opengvlab/internvl3-78b) - specialized NSFW vision model
  - **Fallback**: Google Gemini 2.5 Flash via v1 API
  - **Text Generation**: Grok-2-Fast with Gemini fallback
  - **Model Settings**: temp=1.4, frequency_penalty=0.7, presence_penalty=1.5, unrestricted system prompts
- **Content Generation**: Advanced template-based content generator with enhanced features:
  - Timing-based optimization (morning, evening, late) with sessionStorage persistence
  - Copy counter with feedback tracking
  - Platform, style, and theme selection
  - Subreddit promotion rule compliance
- **Session Management**: Express sessions with PostgreSQL-backed storage.
- **System Design Choices**: Smart 4090 architecture for batch processing (ImageShield preprocessing, Content Engine generation, Voice Clone library creation). Unified content creator with dual workflow (Text-First, Image-First) and tier-based access. Queue provider abstraction.

## Database Design
- **ORM**: Drizzle ORM for PostgreSQL.
- **Schema**: Users, Content generations, queue_jobs, post_rate_limits, post_duplicates, onboardingStates tables.
- **Migrations**: Drizzle Kit.
- **Onboarding Persistence**: User-specific onboarding state tracked in `onboardingStates` table with completedSteps (text[]) and isMinimized (boolean). API routes at GET/PATCH `/api/onboarding/state`.

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
- **Fine-Tuning Preferences**: API-backed hydration from `/api/user-preferences` endpoint with automatic persistence on updates. Sample photos, personal details, and style notes stored per user.
- **Copy Feedback System**: Visual confirmation with Check icon, 2-second highlight duration, and aria-live screen reader support for accessibility.
- **Tier-Based Quota System**: Strongly typed TierConfig with per-tier daily limits (guest: 3, free: 10, pro: 100, premium: 1000). Real-time quota tracking via `/api/stats/daily-usage` endpoint with visual quota display on Generate button.

## Image Protection System
- **Anti-Reverse Search**: Multi-layered image processing (Gaussian blur, subtle noise, intelligent resizing, metadata stripping).
- **Quality Preservation**: Maintains visual appeal post-processing.
- **Client-Side Processing**: Browser-based manipulation using HTML5 Canvas.
- **Preset Configurations**: Light, standard, and heavy protection levels.
- **Watermark System**: Tiered watermarking for free users.
- **Comparison Slider**: Interactive before/after image comparison with draggable divider for visual quality verification.
- **Components**: ComparisonSlider (reusable component), ImageShield, ImageProtector, and ImageShieldUnified with gallery view for Pro users.

## Community Management
- **Engagement Tracking**: Toggle-based engagement monitoring with 7-day metrics visualization
- **Advanced Filtering**: Multi-dimensional filtering by sentiment (positive, neutral, negative) and priority (high, medium, low)
- **Real-time Metrics**: Visual bar charts showing daily engagement trends
- **Smart Responses**: Auto-reply system with sentiment analysis

## Modern Dashboard Enhancements
- **Mobile Detection**: Automatic layout adaptation based on viewport width (<768px)
- **File Upload**: Secure image upload with validation (type checking, 10MB size limit, progress feedback)
- **Responsive Design**: Optimized for both mobile and desktop experiences

## Pro Resources & Referral System
- **Referral Code Generation**: Pro users can generate unique referral codes for each perk via POST /api/pro-resources/:id/referral-code.
- **Per-Perk Caching**: Efficient code retrieval with TanStack Query cache invalidation.
- **Copy-to-Clipboard**: One-click code copying with toast notifications.
- **Authentication & Tier Validation**: Endpoint includes authentication middleware and tier checking.

## Reddit Admin Routes
- **Admin Communities Management**: Fully implemented admin routes at `/api/admin/communities` for managing Reddit communities.
- **Available Operations**: GET (list all), POST (create), PUT (update), DELETE (remove) communities.
- **Storage Layer**: Complete storage methods in `reddit-communities.ts`: listCommunities, createCommunity, updateCommunity, deleteCommunity, getCommunityInsights.
- **Authentication**: Protected by admin authentication middleware with JWT and session support.

## Imgur Integration (Zero-Storage Solution)
- **Upload Portal**: Complete drag-and-drop UI component at `ImgurUploadPortal.tsx` with progress tracking and URL paste fallback.
- **API Endpoints**: `/api/uploads/imgur` for upload, `/api/uploads/imgur/stats` for usage monitoring, delete capability.
- **Rate Limit Management**: Tracks daily usage (1250/day limit) with warnings and graceful fallbacks.
- **Database Tracking**: `user_storage_assets` table stores metadata only (URLs, delete hashes) - no actual files.
- **Legal Compliance**: Images hosted on Imgur, never touching your servers - maintains 2257 compliance.
- **Integration**: Seamlessly integrated into `GeminiCaptionGeneratorTabs` for one-click experience.
- **Test Suite**: Run `node test-imgur-integration.js` to verify setup.

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
- **OpenRouter**: InternVL3-78B vision model API for NSFW image analysis.
- **Google GenAI**: Gemini 2.5 Flash for text and vision (fallback).
- **OpenAI**: GPT-4o for content generation fallback.
- **BullMQ**: Background job processing.
- **ioredis**: Redis client.
- **CCBill**: Billing integration.
- **SegPay, Epoch, Paxum, Coinbase Commerce**: Multi-payment provider scaffolds.