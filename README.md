# ThottoPilot

A comprehensive social media content creation platform for adult content creators, featuring AI-powered caption generation, image protection, post scheduling, and multi-platform management across Reddit, Twitter, Instagram, and OnlyFans.

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL database (Neon Database recommended)
- Google Gemini API key (primary) or OpenAI API key (fallback)
- Optional: Redis for enhanced queue performance
- Optional: AWS S3 for media storage

## Installation

1. **Clone and Install Dependencies**
   ```bash
   git clone <repository-url>
   cd thottopilot
   npm install
   ```

2. **Environment Setup**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration values
   ```

3. **Database Setup**
   ```bash
   # Push schema to database (creates tables)
   npm run db:push
   
   # For production with data-loss warnings, use:
   npm run db:push --force
   ```

4. **Development Server**
   ```bash
   npm run dev
   ```
   
   The application will be available at `http://localhost:5000`

## Local Development

### Development Workflow

- **Frontend**: React 18 + Vite for hot reloading
- **Backend**: Express.js with TypeScript 
- **Database**: Drizzle ORM with PostgreSQL
- **Queue System**: PostgreSQL-backed with Redis fallback
- **AI Services**: Google Gemini (primary) + OpenAI (fallback)

### Key Commands

```bash
# Development
npm run dev              # Start dev server
npm run typecheck        # TypeScript validation
npm test                 # Run test suite

# Database
npm run db:push          # Push schema changes
npm run db:studio        # Open Drizzle Studio

# Production
npm run build            # Build for production
npm start               # Start production server
```

### Project Structure

```
├── client/             # React frontend
│   ├── src/
│   │   ├── components/ # UI components
│   │   ├── pages/      # Route pages
│   │   └── lib/        # Client utilities
├── server/             # Express backend
│   ├── lib/            # Core services
│   ├── routes/         # API routes
│   ├── caption/        # AI content generation
│   └── workers/        # Background jobs
├── shared/             # Shared types & schema
└── prompts/            # AI generation prompts
```

## Testing

Run the full test suite:

```bash
npm test
```

Key test areas:
- Authentication and authorization
- Content generation pipelines  
- Image protection algorithms
- Billing and subscription management
- Rate limiting and safety systems

## Deployment

### Production Deployment

1. **Environment Variables**: Ensure all required variables in `.env.example` are configured
2. **Database**: Run `npm run db:push` to sync schema
3. **Build**: Run `npm run build` to create production assets
4. **Start**: Run `npm start` to launch the production server

### Key Production Considerations

- Configure proper `DATABASE_URL` for production PostgreSQL
- Set `NODE_ENV=production`
- Configure `APP_BASE_URL` for your domain
- Enable Redis with `REDIS_URL` for optimal performance
- Set up monitoring with `SENTRY_DSN`
- Configure email services (`SENDGRID_API_KEY` or `RESEND_API_KEY`)

For detailed deployment instructions, see `DEPLOYMENT.md` and `replit.md`.

## Architecture

- **Frontend**: React with TypeScript, Shadcn/UI components, TailwindCSS
- **Backend**: Express.js with comprehensive middleware stack
- **Database**: PostgreSQL with Drizzle ORM
- **Queue System**: Abstracted queue interface (PostgreSQL/Redis)
- **AI Pipeline**: Multi-provider content generation with safety validation
- **Image Protection**: Multi-layered processing for reverse-search prevention
- **Authentication**: Session-based with social OAuth options

## Features

### Core Features
- AI-powered content generation (text + image analysis)
- Advanced image protection and watermarking
- Multi-platform posting (Reddit, Twitter, Instagram, OnlyFans)
- Smart subreddit promotion rules and rate limiting
- User tier management (Guest, Free, Starter, Pro)

### Enterprise Features  
- Batch posting campaigns
- Advanced analytics and metrics collection
- Custom content templates and fine-tuning
- Priority queue processing
- Enhanced storage quotas

## Support

For technical issues and questions:
- Check the documentation in `replit.md` for architecture details
- Review the codebase structure and inline comments
- Refer to the test suite for usage examples

## License

Proprietary - All rights reserved