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

### Tax Tracker

ThottoPilot includes a comprehensive tax tracking system designed specifically for content creators to maximize their tax deductions and maintain IRS-compliant records.

#### Purpose and Features
- **Smart Expense Categorization**: Pre-configured categories optimized for adult content creators including Beauty & Wellness (100% deductible), Technology & Equipment, Wardrobe & Fashion, Travel & Entertainment, and Home Office expenses
- **Real-time Tax Calculations**: Automatic calculation of total expenses, deductible amounts, and category breakdowns
- **Receipt Management**: Upload and store receipt images/PDFs with automatic attachment to expenses
- **Calendar View**: Visual expense tracking with monthly/yearly views for better financial planning
- **Tax-Compliant Documentation**: Built-in legal explanations and IRS documentation requirements for each category
- **Quarterly/Annual Reporting**: Generate summary reports for tax preparation and accountant communication

#### User Workflow
1. **Add Expenses**: Users can quickly add business expenses with amount, category, date, and optional notes
2. **Upload Receipts**: Attach receipt images (JPEG, PNG) or PDFs to expenses for IRS compliance
3. **Track Totals**: Real-time dashboard shows total expenses, deductible amounts, and category breakdowns
4. **Calendar Review**: Monthly calendar view displays expenses by date with visual spending indicators
5. **Export Data**: Generate reports for tax preparation or accountant review

#### Access Requirements
- **Authentication**: Full tax tracker features require user authentication
- **User Tiers**: Available to all authenticated users (Free, Starter, Pro, Enterprise)
- **Route**: Accessible at `/tax-tracker` for logged-in users

#### Environment Variables
The tax tracker operates using the core application environment variables:
- **DATABASE_URL**: Required for storing expense and category data
- **JWT_SECRET**: Required for user authentication
- **AWS_S3 Keys**: Optional for receipt storage (local storage fallback available)

#### API Endpoints
- `GET /api/expense-categories` - Retrieve all active expense categories
- `GET /api/expenses` - Get user's expenses (optional taxYear filter)
- `POST /api/expenses` - Create new expense record
- `PUT /api/expenses/:id` - Update existing expense
- `DELETE /api/expenses/:id` - Delete expense record
- `GET /api/expenses/totals` - Calculate total and deductible amounts
- `GET /api/expenses/range` - Retrieve expenses within date range
- `POST /api/expenses/:id/receipt` - Upload receipt file for expense

#### Tax Categories and Deduction Information
The system includes comprehensive tax guidance with legal basis for deductions:
- **Beauty & Wellness**: 100% deductible as professional appearance costs
- **Wardrobe & Fashion**: 100% deductible for content-specific clothing
- **Technology & Equipment**: 100% deductible under IRS Section 179
- **Travel & Entertainment**: 100% deductible for business purposes
- **Home Office**: Percentage-based deduction following IRS home office rules
- **Marketing & Promotion**: 100% deductible advertising and promotion costs

For detailed troubleshooting and customer support, see `docs/tax-tracker-support.md`.

## Support

For technical issues and questions:
- Check the documentation in `replit.md` for architecture details
- Review the codebase structure and inline comments
- Refer to the test suite for usage examples

## Environment Variables

ThottoPilot uses environment variables for secure configuration of external services and platform features. Copy `.env.example` to `.env` and configure the following variables:

### Core Application Settings

**APP_BASE_URL** - The base URL where your application is hosted
- **Development**: `http://localhost:5000`
- **Production**: `https://your-domain.com`
- **Usage**: Used for OAuth redirects, webhook URLs, and email verification links

**NODE_ENV** - Application environment mode
- **Values**: `development` | `production`
- **Impact**: Affects logging, error handling, and feature availability

### Database Configuration

**DATABASE_URL** - PostgreSQL connection string
- **Format**: `postgresql://user:password@host:port/database`
- **Required**: Yes - Core data storage for users, content, and billing
- **Example**: `postgresql://user:pass@localhost:5432/thottopilot`

### AI Content Generation

**GOOGLE_GENAI_API_KEY** - Google Gemini API key (Primary AI provider)
- **Required**: Yes for AI content generation
- **Obtain**: Google AI Studio (https://makersuite.google.com/app/apikey)
- **Usage**: Primary AI provider for content generation and image analysis

**OPENAI_API_KEY** - OpenAI API key (Fallback AI provider)
- **Required**: Optional (fallback when Gemini unavailable)
- **Obtain**: OpenAI Platform (https://platform.openai.com/api-keys)
- **Usage**: Backup AI provider and specialized model access

### Payment Provider Integration

**PAXUM_API_KEY** - Paxum payment processor merchant ID
- **Required**: Optional (enables Paxum payment option)
- **Obtain**: Paxum merchant dashboard

**COINBASE_COMMERCE_KEY** - Coinbase Commerce API key
- **Required**: Optional (enables cryptocurrency payments)
- **Obtain**: Coinbase Commerce dashboard
- **Usage**: Crypto payment processing for subscriptions

### Authentication & Security

**JWT_SECRET** - Secret key for JSON Web Token signing
- **Required**: Yes - Used for secure API authentication
- **Format**: Random string (minimum 32 characters)
- **Generate**: `openssl rand -hex 32`

**SESSION_SECRET** - Secret key for session cookie signing
- **Required**: Yes - Protects user sessions
- **Format**: Random string (minimum 32 characters)
- **Generate**: `openssl rand -hex 32`

### External API Services

**STRIPE_SECRET_KEY** - Stripe payment processor secret key
- **Required**: Optional (enables Stripe billing)
- **Obtain**: Stripe Dashboard → Developers → API Keys
- **Format**: Starts with `sk_`

**REDDIT_CLIENT_ID** - Reddit OAuth application client ID
- **Required**: Optional (enables Reddit integration)
- **Obtain**: Reddit App Preferences (https://www.reddit.com/prefs/apps)

**REDDIT_CLIENT_SECRET** - Reddit OAuth application secret
- **Required**: Optional (with REDDIT_CLIENT_ID)
- **Usage**: Reddit post scheduling and subreddit integration

**REDDIT_REDIRECT_URI** - Reddit OAuth redirect URI
- **Required**: Optional (with Reddit OAuth)
- **Example**: `https://yourapp.com/auth/reddit/callback`

### Media & Storage

**AWS_ACCESS_KEY_ID** - AWS S3 access key
- **Required**: Optional (enables S3 media storage)
- **Usage**: Image uploads and CDN distribution

**AWS_SECRET_ACCESS_KEY** - AWS S3 secret key
- **Required**: With AWS_ACCESS_KEY_ID
- **Security**: Never commit to version control

**AWS_REGION** - AWS S3 bucket region
- **Required**: With S3 configuration
- **Example**: `us-east-1`

**S3_BUCKET_MEDIA** - S3 bucket name for media storage
- **Required**: With S3 configuration
- **Usage**: Stores user uploads and generated content

**S3_PUBLIC_CDN_DOMAIN** - CloudFront or CDN domain for S3
- **Required**: Optional (improves media delivery)
- **Example**: `https://cdn.yourdomain.com`

### Queue & Background Processing

**REDIS_URL** - Redis connection string for queue processing
- **Required**: Optional (PostgreSQL fallback available)
- **Example**: `redis://localhost:6379`
- **Usage**: High-performance job queue and caching

**USE_PG_QUEUE** - Force PostgreSQL queue backend
- **Default**: `false` (auto-enabled if no Redis)
- **Values**: `true` | `false`

### Email Services

**SENDGRID_API_KEY** - SendGrid email service API key
- **Required**: Optional (enables email notifications)
- **Obtain**: SendGrid Dashboard → Settings → API Keys

**RESEND_API_KEY** - Resend email service API key  
- **Required**: Optional (alternative to SendGrid)
- **Obtain**: Resend Dashboard (https://resend.com)

### Anti-Bot Protection

**TURNSTILE_SITE_KEY** - Cloudflare Turnstile site key (public)
- **Required**: Optional (enables CAPTCHA protection)
- **Obtain**: Cloudflare Dashboard → Turnstile

**TURNSTILE_SECRET_KEY** - Cloudflare Turnstile secret key
- **Required**: With TURNSTILE_SITE_KEY
- **Usage**: Server-side CAPTCHA verification

### Analytics & Monitoring

**ANALYTICS_WRITE_KEY** - Analytics service write key
- **Required**: Optional (enables usage analytics)
- **Usage**: Track user engagement and platform metrics

### Configuration Limits

**DAILY_GENERATIONS_FREE** - Daily AI generations for free tier
- **Default**: `5`
- **Usage**: Rate limiting for free users

**DAILY_GENERATIONS_STARTER** - Daily AI generations for starter tier
- **Default**: `50`  
- **Usage**: Rate limiting for starter subscription

**DAILY_GENERATIONS_PRO** - Daily AI generations for pro tier
- **Default**: `-1` (unlimited)
- **Usage**: Rate limiting for pro subscription

**MEDIA_MAX_BYTES_FREE** - Maximum media storage for free users
- **Default**: `524288000` (500MB)
- **Usage**: Storage quota enforcement

**MEDIA_MAX_BYTES_PRO** - Maximum media storage for pro users
- **Default**: `10737418240` (10GB)
- **Usage**: Storage quota for paid subscribers

### Watermarking Configuration

**WATERMARK_ENABLED** - Enable watermarks on free tier images
- **Default**: `true`
- **Values**: `true` | `false`

**WATERMARK_TEXT** - Watermark text overlay
- **Default**: `"ThottoPilot"`
- **Usage**: Branding on free tier protected images

**WATERMARK_OPACITY** - Watermark transparency level
- **Default**: `0.18` (18% opacity)
- **Range**: `0.0` to `1.0`

### Admin Configuration

**ADMIN_EMAIL_WHITELIST** - Comma-separated admin emails
- **Required**: Optional (restricts admin access)
- **Example**: `admin@yoursite.com,support@yoursite.com`
- **Usage**: Controls who can access admin portal

## Configuration Examples

### Minimum Development Setup
```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/thottopilot_dev
JWT_SECRET=your-super-secret-jwt-key-here-32-chars-min
SESSION_SECRET=your-session-secret-key-here-32-chars-min
GOOGLE_GENAI_API_KEY=your-gemini-api-key
APP_BASE_URL=http://localhost:5000
```

### Full Production Setup
```bash
# Core (Required)
DATABASE_URL=postgresql://user:pass@prod-db:5432/thottopilot
JWT_SECRET=your-production-jwt-secret
SESSION_SECRET=your-production-session-secret
APP_BASE_URL=https://yourapp.com

# AI Services
GOOGLE_GENAI_API_KEY=your-gemini-api-key
OPENAI_API_KEY=your-openai-api-key

# Payment Processing
STRIPE_SECRET_KEY=sk_live_your_stripe_secret
PAXUM_API_KEY=your-paxum-merchant-id
COINBASE_COMMERCE_KEY=your-coinbase-commerce-key

# Media Storage
AWS_ACCESS_KEY_ID=your-aws-access-key
AWS_SECRET_ACCESS_KEY=your-aws-secret-key
AWS_REGION=us-east-1
S3_BUCKET_MEDIA=your-media-bucket
S3_PUBLIC_CDN_DOMAIN=https://cdn.yourapp.com

# Performance & Queues
REDIS_URL=redis://your-redis-instance:6379

# Email & Notifications
SENDGRID_API_KEY=your-sendgrid-api-key

# Security & Anti-Bot
TURNSTILE_SITE_KEY=your-turnstile-site-key
TURNSTILE_SECRET_KEY=your-turnstile-secret-key

# Analytics
ANALYTICS_WRITE_KEY=your-analytics-key
```

### Environment Variable Security

⚠️ **Important Security Notes:**
- Never commit `.env` files to version control
- Use different keys for development and production
- Rotate secrets regularly, especially JWT and session secrets
- Store production secrets in secure secret management systems
- Validate all environment variables on application startup

**STRIPE_SECRET_KEY** - Stripe payment processor secret key
- **Required**: Optional (enables credit card payments)
- **Obtain**: Stripe Dashboard (https://dashboard.stripe.com/apikeys)
- **Usage**: Primary payment processing for subscriptions and one-time purchases
- **Security**: Critical - must be kept secret, starts with `sk_`

### CCBill Payment Processing

**CCBILL_CLIENT_ACCOUNT** - CCBill client account number
**CCBILL_SUBACCOUNT** - CCBill sub-account for payment routing
**CCBILL_FLEXFORM_ID** - CCBill form configuration ID
**CCBILL_SALT** - CCBill security salt for payment verification
- **Required**: Optional (enables CCBill payments for adult content)
- **Obtain**: CCBill merchant interface
- **Usage**: Adult-industry specialized payment processing

### Storage and Media

**AWS_ACCESS_KEY_ID** / **AWS_SECRET_ACCESS_KEY** - AWS credentials for S3 storage
**S3_BUCKET_MEDIA** - S3 bucket name for media file storage
**S3_PUBLIC_CDN_DOMAIN** - CloudFront distribution for media delivery
- **Required**: Optional (improves media performance and scalability)
- **Usage**: Stores user-uploaded images and generated content assets

### Queue and Performance

**REDIS_URL** - Redis connection string for enhanced queue performance
- **Format**: `redis://localhost:6379` or `redis://user:pass@host:port`
- **Required**: Optional (falls back to PostgreSQL queue)
- **Usage**: Improves background job processing for content generation

### Email Services

**SENDGRID_API_KEY** - SendGrid email service API key
**RESEND_API_KEY** - Resend email service API key
- **Required**: Choose one for email verification and notifications
- **Usage**: Sends account verification emails and system notifications

### Social Media Integration

**REDDIT_CLIENT_ID** / **REDDIT_CLIENT_SECRET** - Reddit OAuth application credentials
**REDDIT_REDIRECT_URI** - OAuth callback URL for Reddit authentication
- **Required**: Optional (enables Reddit posting features)
- **Obtain**: Reddit App Preferences (https://www.reddit.com/prefs/apps)
- **Usage**: Allows users to connect Reddit accounts for posting automation

### Analytics and Monitoring

**ANALYTICS_WRITE_KEY** - Analytics service API key for usage tracking
**SENTRY_DSN** - Sentry error tracking and monitoring
- **Required**: Optional (enables advanced monitoring and insights)
- **Usage**: Tracks feature usage, performance metrics, and error reporting

### Security and Rate Limiting

**TURNSTILE_SITE_KEY** / **TURNSTILE_SECRET_KEY** - Cloudflare Turnstile anti-bot protection
- **Required**: Optional (enhances registration security)
- **Usage**: Prevents automated abuse of registration and generation endpoints

### Feature Configuration

**DAILY_GENERATIONS_FREE** - Daily AI generation limit for free users (default: 5)
**DAILY_GENERATIONS_STARTER** - Daily limit for starter tier (default: 50)  
**DAILY_GENERATIONS_PRO** - Daily limit for pro tier (-1 = unlimited)

**MEDIA_MAX_BYTES_FREE** - Maximum media storage for free users (default: 500MB)
**MEDIA_MAX_BYTES_PRO** - Maximum media storage for pro users (default: 10GB)

**WATERMARK_ENABLED** - Enable automatic watermarking for free tier (default: true)
**WATERMARK_TEXT** - Watermark text overlay (default: "ThottoPilot")
**WATERMARK_OPACITY** - Watermark transparency level (default: 0.18)

### Development and Testing

**ADMIN_EMAIL_WHITELIST** - Comma-separated list of admin email addresses
**CRON_TZ** - Timezone for scheduled tasks (default: America/Chicago)
**USE_PG_QUEUE** - Force PostgreSQL queue instead of Redis (default: true)

## License

Proprietary - All rights reserved