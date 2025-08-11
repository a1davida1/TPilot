# Overview

ThottoPilot is a comprehensive social media content creation platform for adult content creators. It generates engaging Reddit posts with personalized titles, content, and photo instructions, while providing intelligent promotion features and image protection capabilities. The application adapts content based on subreddit promotion rules and includes advanced image processing tools to prevent reverse image searches while maintaining visual quality. ThottoPilot aims to be a leading platform by offering a streamlined workflow and advanced tools for content monetization and protection.

## Recent Changes (August 11, 2025)

**AI GENERATION SYSTEM FULLY OPERATIONAL:**
- Created unified AI service (`unified-ai-service.ts`) that handles both text and image-based content generation
- **DUAL WORKFLOW SUPPORT:** Text-first and Image-first content generation both fully functional
- **NEW UNIFIED ENDPOINT:** `/api/generate-unified` handles both text prompts and image uploads seamlessly
- **OPENAI INTEGRATION:** Using GPT-4o model for enhanced content generation and image analysis
- **IMAGE ANALYSIS:** Can analyze uploaded images and generate contextual social media content
- **CONTENT TYPES:** Generates titles, content, photo instructions, hashtags, and captions
- **PLATFORM OPTIMIZATION:** Content tailored for Reddit, Twitter, Instagram, and TikTok
- **STYLE SUPPORT:** Multiple content styles (playful, mysterious, bold, elegant, confident, authentic, sassy)
- Fixed image workflow accessibility in UnifiedContentCreator component
- Updated frontend to properly use FormData for image uploads
- **Status:** Complete AI integration with both text and image generation workflows operational

## Previous Changes (August 10, 2025)

**AUTHENTICATION SYSTEM FULLY OPERATIONAL:**
- Fixed route conflict between social-auth.ts and routes.ts that was causing auth failures
- **DUAL LOGIN METHOD SUPPORT:** Backend accepts BOTH email AND username for login
- **ADMIN ACCESS:** admin@thottopilot.com / admin123 works via frontend shortcut AND backend validation
- **SECURITY:** All authentication routes through secure JWT backend with proper token validation
- **USER MANAGEMENT:** Password reset, settings, account management all functional
- **UI/UX:** Forgot password links, dual login support, high contrast dark mode
- Fixed authentication persistence issues (users stay authenticated across sessions)
- Comprehensive password reset system with backend endpoint and UI modal
- All user management endpoints operational (settings, subscription, export, delete account)
- **Status:** Complete authentication system with admin convenience and security

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
- **UI Components**: Shadcn/ui built on Radix UI for accessible, unstyled components.
- **Styling**: Tailwind CSS with CSS variables for theming and dark mode.
- **State Management**: TanStack Query (React Query) for server state management and caching.
- **Routing**: Wouter for lightweight client-side routing.
- **Form Handling**: React Hook Form with Zod validation.
- **UI/UX Decisions**: Feminine color scheme (pink/purple/light blue), ultra-polished dark interface with neon accents, glass morphism, dynamic gradients, premium CSS animations, and mobile-first design. Both landing page and dashboard feature consistent preset style functionality. Three-tier portal views (Guest, Free/Basic, Pro/Premium) implemented with strategic upgrade prompts.

## Backend Architecture
- **Server Framework**: Express.js with TypeScript on Node.js.
- **API Design**: RESTful API with structured error handling.
- **Data Storage**: In-memory storage with interface abstraction, moving towards PostgreSQL.
- **Content Generation**: Advanced template-based content generator with predefined patterns that produces authentically different outputs based on all user parameters (photoType, textTone, promotion settings, hashtags), adapting content for specific social media platforms and subreddit promotion rules.
- **Session Management**: Express sessions with PostgreSQL-backed storage.
- **System Design Choices**: Smart 4090 architecture for batch processing (ImageShield preprocessing, Content Engine generation, Voice Clone library creation) to optimize costs. Dual workflow feature (Text-First, Image-First) merged into a unified content creator with tier-based access.

## Database Design
- **ORM**: Drizzle ORM configured for PostgreSQL with type-safe schema definitions.
- **Schema**: Users table for authentication, Content generations table (platform, style, theme, titles, content, photo instructions), and JSON fields for complex data.
- **Migrations**: Drizzle Kit for schema migrations.

## Authentication & Authorization
- **Authentication**: Username/password with session-based persistence. Social authentication (Facebook, Google, Reddit OAuth) integrated.
- **Session Storage**: PostgreSQL-backed sessions.
- **Authorization**: User-scoped content generation history and statistics. Admin portal for system metrics and user management.

## Content Generation System
- **Template Engine**: Predefined templates organized by platform, style, and theme. Includes 50+ promotional templates system with intelligent style and promotion matching across 7 subcategories.
- **Photo Instructions**: Structured guidance for lighting, angles, composition, styling, and technical settings.
- **Platform Optimization**: Content tailored for social media requirements and audience expectations.
- **Promotion Intelligence**: Smart content adaptation based on subreddit rules.
- **Advanced Features**: Integrated fine-tuning combining sample library with personalization settings. One-click style presets with 8 clickable buttons for instant content generation. Tiered content system with pre-generated templates for free/basic users and AI generation for Pro/Premium. Advanced content generation engine that produces genuinely different outputs based on photo type (casual, workout, shower, showing-skin, spicy, very-spicy, all-xs), text tone (confident, playful, mysterious, authentic, sassy), promotion settings, and hashtag selection.

## Image Protection System
- **Anti-Reverse Search**: Multi-layered image processing (Gaussian blur, subtle noise, intelligent resizing, metadata stripping).
- **Quality Preservation**: Maintains visual appeal post-processing.
- **Client-Side Processing**: Browser-based manipulation using HTML5 Canvas for privacy and speed.
- **Preset Configurations**: Light, standard, and heavy protection levels.

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