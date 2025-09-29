#!/bin/bash

# ==========================================
# ThottoPilot Production Build Script
# ==========================================
# This script creates a portable production build of the ThottoPilot application
# It can be run in any CI/CD environment or locally for deployment preparation

set -e  # Exit on any error
set -u  # Exit on undefined variables

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log() {
    echo -e "${BLUE}[$(date +'%Y-%m-%d %H:%M:%S')] INFO: $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARN: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
}

success() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] SUCCESS: $1${NC}"
}

# Configuration
BUILD_DIR="dist"
CLIENT_BUILD_DIR="client/dist"
SERVER_BUILD_DIR="server/dist"
NODE_VERSION_REQUIRED="18"

# Command line options
SKIP_TESTS=${SKIP_TESTS:-false}
SKIP_LINT=${SKIP_LINT:-false}
SKIP_TYPE_CHECK=${SKIP_TYPE_CHECK:-false}
BUILD_ENV=${BUILD_ENV:-production}
VERBOSE=${VERBOSE:-false}

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --skip-tests)
            SKIP_TESTS=true
            shift
            ;;
        --skip-lint)
            SKIP_LINT=true
            shift
            ;;
        --skip-type-check)
            SKIP_TYPE_CHECK=true
            shift
            ;;
        --env)
            BUILD_ENV="$2"
            shift 2
            ;;
        --verbose|-v)
            VERBOSE=true
            shift
            ;;
        --help|-h)
            echo "Usage: $0 [OPTIONS]"
            echo ""
            echo "Options:"
            echo "  --skip-tests       Skip running tests"
            echo "  --skip-lint        Skip linting"
            echo "  --skip-type-check  Skip TypeScript type checking"
            echo "  --env ENV          Set build environment (default: production)"
            echo "  --verbose, -v      Enable verbose output"
            echo "  --help, -h         Show this help message"
            exit 0
            ;;
        *)
            error "Unknown option $1"
            exit 1
            ;;
    esac
done

# Environment detection
if [ "$VERBOSE" = true ]; then
    log "Detected environment variables:"
    log "  NODE_ENV: ${NODE_ENV:-not set}"
    log "  CI: ${CI:-not set}"
    log "  REPLIT: ${REPLIT:-not set}"
    log "  BUILD_ENV: $BUILD_ENV"
fi

# Start build process
log "Starting ThottoPilot production build..."
log "Build configuration:"
log "  Environment: $BUILD_ENV"
log "  Skip tests: $SKIP_TESTS"
log "  Skip lint: $SKIP_LINT"
log "  Skip type check: $SKIP_TYPE_CHECK"

# ==========================================
# ENVIRONMENT CHECKS
# ==========================================

log "Checking build environment..."

# Check Node.js version
if command -v node >/dev/null 2>&1; then
    NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
    if [ "$NODE_VERSION" -lt "$NODE_VERSION_REQUIRED" ]; then
        error "Node.js version $NODE_VERSION_REQUIRED or higher is required. Found: v$(node --version)"
        exit 1
    fi
    log "Node.js version: v$(node --version)"
else
    error "Node.js is not installed"
    exit 1
fi

# Check npm
if ! command -v npm >/dev/null 2>&1; then
    error "npm is not installed"
    exit 1
fi

# Check if package.json exists
if [ ! -f "package.json" ]; then
    error "package.json not found. Are you in the project root directory?"
    exit 1
fi

# ==========================================
# DEPENDENCY INSTALLATION
# ==========================================

log "Installing dependencies..."
if [ "$VERBOSE" = true ]; then
    npm ci --production=false
else
    npm ci --production=false --silent
fi

success "Dependencies installed successfully"

# ==========================================
# CODE QUALITY CHECKS
# ==========================================

if [ "$SKIP_LINT" = false ]; then
    log "Running linting..."
    # Check if lint script exists
    if npm run lint --dry-run >/dev/null 2>&1; then
        npm run lint
        success "Linting passed"
    else
        warn "Lint script not found in package.json, skipping..."
    fi
else
    warn "Skipping linting (--skip-lint flag set)"
fi

if [ "$SKIP_TYPE_CHECK" = false ]; then
    log "Running TypeScript type checking..."
    if command -v tsc >/dev/null 2>&1; then
        npx tsc --noEmit
        success "Type checking passed"
    else
        warn "TypeScript compiler not found, skipping type check..."
    fi
else
    warn "Skipping type checking (--skip-type-check flag set)"
fi

# ==========================================
# TESTING
# ==========================================

if [ "$SKIP_TESTS" = false ]; then
    log "Running tests..."
    # Check if test script exists
    if npm run test --dry-run >/dev/null 2>&1; then
        if [ "$VERBOSE" = true ]; then
            npm test
        else
            npm test -- --reporter=dot
        fi
        success "All tests passed"
    else
        warn "Test script not found in package.json, skipping..."
    fi
else
    warn "Skipping tests (--skip-tests flag set)"
fi

# ==========================================
# CLEAN PREVIOUS BUILDS
# ==========================================

log "Cleaning previous builds..."

# Remove existing build directories
if [ -d "$BUILD_DIR" ]; then
    rm -rf "$BUILD_DIR"
    log "Removed existing $BUILD_DIR directory"
fi

if [ -d "$CLIENT_BUILD_DIR" ]; then
    rm -rf "$CLIENT_BUILD_DIR"
    log "Removed existing $CLIENT_BUILD_DIR directory"
fi

if [ -d "$SERVER_BUILD_DIR" ]; then
    rm -rf "$SERVER_BUILD_DIR"
    log "Removed existing $SERVER_BUILD_DIR directory"
fi

# ==========================================
# CLIENT BUILD
# ==========================================

log "Building client application..."

# Set environment for client build
export NODE_ENV=$BUILD_ENV

if [ "$VERBOSE" = true ]; then
    npm run build:client
else
    npm run build:client >/dev/null
fi

# Verify client build
if [ ! -d "$CLIENT_BUILD_DIR" ]; then
    error "Client build failed - $CLIENT_BUILD_DIR directory not created"
    exit 1
fi

if [ ! -f "$CLIENT_BUILD_DIR/index.html" ]; then
    error "Client build failed - index.html not found in $CLIENT_BUILD_DIR"
    exit 1
fi

success "Client build completed successfully"

# ==========================================
# SERVER BUILD
# ==========================================

log "Building server application..."

if [ "$VERBOSE" = true ]; then
    npm run build:server
else
    npm run build:server >/dev/null
fi

# Normalize import specifiers for Node's ESM resolver. TypeScript leaves
# extensionless relative imports, so we post-process to append the .js suffix.
log "Rewriting relative import extensions for server bundle compatibility..."
if [ "$VERBOSE" = true ]; then
    npm run fix-imports
else
    npm run fix-imports >/dev/null
fi

# Verify server build
if [ ! -d "$SERVER_BUILD_DIR" ]; then
    error "Server build failed - $SERVER_BUILD_DIR directory not created"
    exit 1
fi

success "Server build completed successfully"

# ==========================================
# CREATE PRODUCTION BUNDLE
# ==========================================

log "Creating production bundle..."

# Create main build directory
mkdir -p "$BUILD_DIR"

# Copy client build
cp -r "$CLIENT_BUILD_DIR" "$BUILD_DIR/client"
log "Client assets copied to $BUILD_DIR/client"

# Copy server build
cp -r "$SERVER_BUILD_DIR" "$BUILD_DIR/server"
log "Server build copied to $BUILD_DIR/server"

# Copy prompt templates for runtime usage
if [ -d "prompts" ]; then
    cp -r prompts "$BUILD_DIR/prompts"
    log "Prompts copied to $BUILD_DIR/prompts"
else
    warn "prompts directory not found, skipping copy"
fi

# Copy essential files
cp package.json "$BUILD_DIR/"
cp package-lock.json "$BUILD_DIR/" 2>/dev/null || warn "package-lock.json not found"

# Copy configuration files
if [ -f "drizzle.config.ts" ]; then
    cp drizzle.config.ts "$BUILD_DIR/"
fi

# Copy migrations if they exist
if [ -d "drizzle" ]; then
    cp -r drizzle "$BUILD_DIR/"
    log "Database migrations copied"
fi

# Copy shared directory if it exists
if [ -d "shared" ]; then
    cp -r shared "$BUILD_DIR/"
    log "Shared directory copied"
fi

# Create production package.json with only production dependencies
log "Creating production package.json..."
node -e "
const pkg = require('./package.json');
const prodPkg = {
  name: pkg.name,
  version: pkg.version,
  description: pkg.description,
  main: pkg.main || 'server/index.js',
  scripts: {
    start: 'node server/index.js',
    'db:push': pkg.scripts['db:push'],
    'db:studio': pkg.scripts['db:studio']
  },
  dependencies: pkg.dependencies,
  engines: pkg.engines
};
require('fs').writeFileSync('$BUILD_DIR/package.json', JSON.stringify(prodPkg, null, 2));
"

# ==========================================
# BUILD OPTIMIZATION
# ==========================================

log "Optimizing production bundle..."

# Calculate build size
BUILD_SIZE=$(du -sh "$BUILD_DIR" | cut -f1)
CLIENT_SIZE=$(du -sh "$BUILD_DIR/client" | cut -f1)
SERVER_SIZE=$(du -sh "$BUILD_DIR/server" | cut -f1)

log "Build size analysis:"
log "  Total: $BUILD_SIZE"
log "  Client: $CLIENT_SIZE"
log "  Server: $SERVER_SIZE"

# ==========================================
# BUILD VERIFICATION
# ==========================================

log "Verifying production build..."

# Check critical files exist
CRITICAL_FILES=(
    "$BUILD_DIR/package.json"
    "$BUILD_DIR/client/index.html"
    "$BUILD_DIR/server/index.js"
)

for file in "${CRITICAL_FILES[@]}"; do
    if [ ! -f "$file" ]; then
        error "Critical file missing: $file"
        exit 1
    fi
done

# ==========================================
# DEPLOYMENT PREPARATION
# ==========================================

log "Preparing deployment artifacts..."

# Create deployment script
cat > "$BUILD_DIR/deploy.sh" << 'EOF'
#!/bin/bash
# Deployment script for ThottoPilot

set -e

echo "Installing production dependencies..."
npm ci --only=production

echo "Running database migrations..."
npm run db:push

echo "Starting application..."
npm start
EOF

chmod +x "$BUILD_DIR/deploy.sh"

# Create environment template
cat > "$BUILD_DIR/.env.example" << 'EOF'
# Production Environment Configuration
NODE_ENV=production
PORT=5000

# Security
JWT_SECRET=your_jwt_secret_here
SESSION_SECRET=your_session_secret_here

# Database
DATABASE_URL=postgresql://user:password@host:port/database

# AI Services (choose one or both)
GOOGLE_GENAI_API_KEY=your_google_ai_key
OPENAI_API_KEY=your_openai_key

# Email Service
SENDGRID_API_KEY=your_sendgrid_key
FROM_EMAIL=noreply@yourdomain.com

# Error Tracking (optional)
SENTRY_DSN=https://your-sentry-dsn

# Social Auth (optional)
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
FACEBOOK_APP_ID=your_facebook_app_id
FACEBOOK_APP_SECRET=your_facebook_app_secret
REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_CLIENT_SECRET=your_reddit_client_secret

# Payment Processing (optional)
STRIPE_SECRET_KEY=sk_live_your_stripe_secret
STRIPE_PUBLISHABLE_KEY=pk_live_your_stripe_publishable
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
EOF

# Create README for deployment
cat > "$BUILD_DIR/README.md" << 'EOF'
# ThottoPilot Production Deployment

This is a production-ready build of ThottoPilot.

## Quick Start

1. Copy `.env.example` to `.env` and configure your environment variables
2. Run the deployment script: `./deploy.sh`

## Manual Deployment

1. Install dependencies: `npm ci --only=production`
2. Configure environment variables
3. Run database migrations: `npm run db:push`
4. Start the application: `npm start`

## Environment Variables

See `.env.example` for required and optional environment variables.

## Support

For deployment support, please refer to the main project documentation.
EOF

# ==========================================
# FINAL STEPS
# ==========================================

# Create build info
BUILD_TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
BUILD_COMMIT=$(git rev-parse HEAD 2>/dev/null || echo "unknown")
BUILD_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")

cat > "$BUILD_DIR/build-info.json" << EOF
{
  "timestamp": "$BUILD_TIMESTAMP",
  "commit": "$BUILD_COMMIT",
  "branch": "$BUILD_BRANCH",
  "environment": "$BUILD_ENV",
  "nodeVersion": "$(node --version)",
  "npmVersion": "$(npm --version)"
}
EOF

# Success message
success "Production build completed successfully!"
echo ""
echo "=================================="
echo "Build Summary:"
echo "  Build directory: $BUILD_DIR"
echo "  Total size: $BUILD_SIZE"
echo "  Timestamp: $BUILD_TIMESTAMP"
echo "  Commit: $BUILD_COMMIT"
echo "=================================="
echo ""
log "Next steps:"
log "1. Copy the '$BUILD_DIR' directory to your production server"
log "2. Configure environment variables using '.env.example' as a template"
log "3. Run './deploy.sh' on the production server"
echo ""
success "Ready for deployment! 🚀"