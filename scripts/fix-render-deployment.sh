#!/bin/bash
set -euo pipefail

echo "🚀 Fixing Render Deployment Issues"
echo "=================================="

# Check critical environment variables
check_env() {
  local var_name=$1
  if [ -z "${!var_name:-}" ]; then
    echo "❌ Missing required env var: $var_name"
    return 1
  else
    echo "✓ $var_name is set"
    return 0
  fi
}

echo ""
echo "📋 Checking Environment Variables:"
echo "----------------------------------"

MISSING_VARS=0

# Core required variables
for var in DATABASE_URL JWT_SECRET SESSION_SECRET NODE_ENV; do
  if ! check_env "$var"; then
    MISSING_VARS=$((MISSING_VARS + 1))
  fi
done

# Check optional but important variables
echo ""
echo "📋 Optional Variables:"
for var in REDIS_URL OPENROUTER_API_KEY REDDIT_CLIENT_ID REDDIT_CLIENT_SECRET; do
  if [ -z "${!var:-}" ]; then
    echo "⚠️  $var not set (app may have limited functionality)"
  else
    echo "✓ $var is set"
  fi
done

if [ $MISSING_VARS -gt 0 ]; then
  echo ""
  echo "❌ CRITICAL: $MISSING_VARS required environment variables are missing!"
  echo "Please set them in the Render Dashboard under Environment Variables."
  exit 1
fi

echo ""
echo "🔨 Building Application..."
echo "------------------------"

# Clean and rebuild
rm -rf dist
npm ci --production=false  # Need dev dependencies for build

# Run the production build
npm run build

echo ""
echo "📦 Checking Build Output..."
echo "-------------------------"

if [ ! -f dist/server/index.js ]; then
  echo "❌ Server build failed: dist/server/index.js not found"
  exit 1
fi
echo "✓ Server build successful"

if [ ! -d dist/client ] || [ ! -f dist/client/index.html ]; then
  echo "❌ Client build failed: dist/client/index.html not found"
  exit 1
fi
echo "✓ Client build successful"

echo ""
echo "🗄️ Database Setup..."
echo "-------------------"

# Database URL processing for Render
DB_URL="${DATABASE_URL}"

# Check if it's a Render database (needs SSL)
if [[ "$DB_URL" == *"render.com"* ]]; then
  echo "✓ Detected Render database, SSL will be configured"
  
  # Ensure SSL is properly configured
  if [[ "$DB_URL" != *"sslmode="* ]]; then
    export DATABASE_URL="${DB_URL}?sslmode=require"
    echo "✓ Added SSL mode to DATABASE_URL"
  fi
fi

# Run database migrations
echo "Running database schema push..."
npm run db:push || {
  echo "⚠️ Database push failed. This might be okay if schema is already up to date."
  echo "Continuing with deployment..."
}

echo ""
echo "✅ Deployment preparation complete!"
echo ""
echo "🚀 Starting production server..."
echo "================================"

# Start the production server
exec npm start
