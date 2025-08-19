# Overview

ThottoPilot is a social media content creation platform for adult content creators, generating engaging Reddit posts with personalized titles, content, and photo instructions. It offers intelligent promotion features, image protection capabilities, and adapts content based on subreddit promotion rules. The platform aims to streamline content monetization and protection for creators.

# User Preferences

Preferred communication style: Simple, everyday language.
Authentication: Landing page first, registration form only shows when "Register" clicked, guest mode available for trial
UI/UX: Ultra-polished dark interface with neon accents, glass morphism, and dynamic gradients
Navigation: Left sidebar with collapsible sections (cleaner and more user-friendly than tabs)
Future features: Payment system integration planned
Design: Live app interface demonstration instead of traditional landing page, showing actual functionality
Interface: Dark theme with purple/pink gradients, animated backgrounds, and premium visual effects
Content: Remove "AI" terminology from user-facing interface to make it feel more natural and accessible
RTX 4090 Strategy: Use for helper AI training, image protection algorithms, and model fine-tuning - not core live functionality
Compliance: Phased approach - base features without ID verification, gate advanced content features behind age verification

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript using Vite.
- **UI Components**: Shadcn/ui built on Radix UI.
- **Styling**: Tailwind CSS with CSS variables for theming.
- **State Management**: TanStack Query (React Query).
- **Routing**: Wouter.
- **Form Handling**: React Hook Form with Zod validation.
- **UI/UX Decisions**: Feminine color scheme (pink/purple/light blue), ultra-polished dark interface with neon accents, glass morphism, dynamic gradients, premium CSS animations, and mobile-first design. Consistent preset style functionality across landing page and dashboard. Three-tier portal views (Guest, Free/Basic, Pro/Premium) with upgrade prompts.

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
- **Advanced Features**: Fine-tuning with sample library and personalization settings. One-click style presets. Tiered content system with pre-generated templates for free/basic users and AI generation for Pro/Premium. Advanced content generation engine producing outputs based on photo type, text tone, promotion settings, and hashtag selection. Dual AI providers (Gemini + OpenAI) with response caching.

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