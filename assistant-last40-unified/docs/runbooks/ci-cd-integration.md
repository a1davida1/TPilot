
# CI/CD Integration Guide

This guide shows how to integrate ThottoPilot's production readiness checks into your CI/CD pipeline.

## Pre-Deployment Validation

Add these commands to your deployment pipeline **before** the build/deploy stage:

### GitHub Actions Example

```yaml
name: Deploy to Production
on:
  push:
    branches: [main]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
          cache: 'npm'
      
      - name: Install dependencies
        run: npm ci
      
      - name: Validate environment configuration
        run: npm run validate:env
        env:
          NODE_ENV: production
          # Add your production secrets here via GitHub Secrets
          JWT_SECRET: ${{ secrets.JWT_SECRET }}
          SESSION_SECRET: ${{ secrets.SESSION_SECRET }}
          DATABASE_URL: ${{ secrets.DATABASE_URL }}
          # ... other required secrets
      
      - name: Audit environment completeness  
        run: npm run env:audit
      
      - name: Run linting
        run: npm run lint
      
      - name: Run tests
        run: npm test
      
      - name: Build production bundle
        run: npm run build

  deploy:
    needs: validate
    runs-on: ubuntu-latest
    steps:
      # Deploy to your production environment
      - name: Deploy to production
        run: echo "Deploy to production server"
```

### Required Secrets in CI/CD

Configure these secrets in your CI/CD environment (GitHub Secrets, GitLab Variables, etc.):

#### Core Runtime
- `JWT_SECRET` - High-entropy JWT signing key (≥32 chars)
- `SESSION_SECRET` - Session cookie encryption key (≥32 chars)  
- `DATABASE_URL` - Production Postgres connection string
- `APP_BASE_URL` - Public API base URL
- `FRONTEND_URL` - Public frontend domain
- `ALLOWED_ORIGINS` - Comma-separated trusted origins

#### Infrastructure Backends  
- `REDIS_URL` - Managed Redis instance for sessions/queues
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` - S3 credentials
- `S3_BUCKET_MEDIA` - Media storage bucket name

#### Third-party Services
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` - Payment processing
- `GOOGLE_GENAI_API_KEY`, `OPENAI_API_KEY` - AI content generation
- `RESEND_API_KEY` or `SENDGRID_API_KEY` - Transactional email
- `TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY` - Anti-bot protection

## Replit Deployment

For Replit deployment, use the Secrets tab to configure production environment variables:

1. Open your Repl's Secrets panel
2. Add each required environment variable from the checklist above
3. Run the validation locally: `npm run validate:env`
4. Deploy using Replit's deployment system

## Manual Validation

Before any production deployment, run these commands locally with production secrets loaded:

```bash
# Validate all environment requirements
npm run validate:env

# Ensure documentation is complete
npm run env:audit  

# Run quality checks
npm run lint
npm test

# Build production assets
npm run build
```

## Troubleshooting Validation Failures

### Common Issues

**JWT_SECRET too short**: Generate a secure 32+ character secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Missing DATABASE_URL**: Ensure your managed Postgres instance is provisioned and the connection string includes credentials.

**CORS origins contains wildcard**: Replace `*` with explicit domain list:
```
ALLOWED_ORIGINS=https://yourdomain.com,https://www.yourdomain.com
```

**Session storage not durable**: Either provide `REDIS_URL` for Redis sessions or ensure `DATABASE_URL` is configured for Postgres session storage.

Run `npm run validate:env` after fixing each issue to confirm resolution.
