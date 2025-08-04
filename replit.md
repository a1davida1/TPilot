# Overview

ContentCraft is a social media content generation platform that helps users create engaging posts with personalized titles, content, and photo instructions for different social media platforms (Reddit, Twitter, Instagram). The application uses AI-powered content generation to produce platform-specific content in various styles (playful, mysterious, bold, elegant) and themes (lifestyle, fashion, artistic), complete with detailed photography guidance for optimal visual content creation.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React 18 with TypeScript using Vite as the build tool
- **UI Components**: Shadcn/ui component library with Radix UI primitives for accessible, unstyled components
- **Styling**: Tailwind CSS with CSS variables for theming and dark mode support
- **State Management**: TanStack Query (React Query) for server state management and caching
- **Routing**: Wouter for lightweight client-side routing
- **Form Handling**: React Hook Form with Zod validation via @hookform/resolvers

## Backend Architecture  
- **Server Framework**: Express.js with TypeScript running on Node.js
- **API Design**: RESTful API with structured error handling and request logging middleware
- **Data Storage**: In-memory storage implementation with interface abstraction for future database integration
- **Content Generation**: Template-based content generator with predefined content patterns for different platform/style/theme combinations
- **Session Management**: Express sessions with connect-pg-simple for PostgreSQL session storage

## Database Design
- **ORM**: Drizzle ORM configured for PostgreSQL with type-safe schema definitions
- **Schema**: 
  - Users table with username/password authentication
  - Content generations table storing platform, style, theme, generated titles, content, and detailed photo instructions
  - JSON fields for storing complex data structures (titles array, photo instructions object)
- **Migrations**: Drizzle Kit for schema migrations and database synchronization

## Authentication & Authorization
- **Authentication**: Basic username/password authentication with session-based persistence
- **Session Storage**: PostgreSQL-backed sessions using connect-pg-simple
- **Authorization**: User-scoped content generation history and statistics

## Content Generation System
- **Template Engine**: Predefined content templates organized by platform, style, and theme combinations
- **Photo Instructions**: Structured guidance covering lighting, camera angles, composition, styling, and technical settings
- **Platform Optimization**: Content tailored for specific social media platform requirements and audience expectations

# External Dependencies

## Database
- **PostgreSQL**: Primary database via Neon Database serverless PostgreSQL
- **Connection**: @neondatabase/serverless for serverless-optimized database connections

## UI Framework
- **Radix UI**: Comprehensive collection of unstyled, accessible React components
- **Embla Carousel**: Touch-friendly carousel component for interactive content display
- **Lucide React**: Feather-inspired icon library for consistent iconography

## Development Tools
- **Vite**: Fast build tool with HMR and optimized production builds
- **ESBuild**: JavaScript bundler for server-side code compilation
- **TypeScript**: Static type checking across the entire application stack

## Validation & Forms
- **Zod**: Runtime type validation and schema definition
- **Drizzle-Zod**: Integration between Drizzle ORM and Zod for type-safe database operations

## Utility Libraries
- **Date-fns**: Modern date utility library for date manipulation and formatting
- **Class Variance Authority**: Type-safe variant API for component styling
- **Clsx & Tailwind Merge**: Utility functions for conditional CSS class composition