#!/bin/bash
# Quick Render environment check script

echo "🔍 Render Environment Check"
echo "==========================="
echo ""

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running on Render
if [ "$RENDER" = "true" ]; then
  echo -e "${GREEN}✓${NC} Running on Render (RENDER=true)"
else
  echo -e "${RED}✗${NC} Not detected as Render deployment"
  echo "  Set RENDER=true in environment variables!"
fi

# Check NODE_ENV
if [ "$NODE_ENV" = "production" ]; then
  echo -e "${GREEN}✓${NC} Production mode (NODE_ENV=production)"
else
  echo -e "${YELLOW}⚠${NC} NODE_ENV is: ${NODE_ENV:-not set}"
  echo "  Should be 'production' for Render"
fi

# Check DATABASE_URL
if [ -n "$DATABASE_URL" ]; then
  if [[ "$DATABASE_URL" == *"?ssl="* ]] || [[ "$DATABASE_URL" == *"?sslmode="* ]]; then
    echo -e "${YELLOW}⚠${NC} DATABASE_URL has SSL parameters"
    echo "  Remove '?ssl=true' or '?sslmode=require' - code handles it automatically"
  else
    echo -e "${GREEN}✓${NC} DATABASE_URL configured correctly"
  fi
else
  echo -e "${RED}✗${NC} DATABASE_URL not set"
fi

# Check required secrets
for var in JWT_SECRET SESSION_SECRET; do
  if [ -n "${!var}" ]; then
    echo -e "${GREEN}✓${NC} $var is set"
  else
    echo -e "${RED}✗${NC} $var is NOT set"
  fi
done

# Check if build exists
if [ -f "dist/server/index.js" ] && [ -f "dist/client/index.html" ]; then
  echo -e "${GREEN}✓${NC} Build artifacts exist"
else
  echo -e "${RED}✗${NC} Build incomplete - run: npm ci && npm run build"
fi

echo ""
echo "📝 Required Render Environment Variables:"
echo "  - NODE_ENV=production"
echo "  - RENDER=true" 
echo "  - DATABASE_URL (without ?ssl parameters)"
echo "  - JWT_SECRET"
echo "  - SESSION_SECRET"
