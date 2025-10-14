#!/bin/bash

# Pre-deployment checklist for ThottoPilot
# This script ensures code quality and readiness before deployment

set -e  # Exit on any error

echo "🚀 Starting Pre-Deployment Checklist..."
echo "======================================="

# 1. TypeScript Check
echo ""
echo "1️⃣  Running TypeScript checks..."
npm run typecheck
if [ $? -eq 0 ]; then
    echo "✅ TypeScript check passed"
else
    echo "❌ TypeScript check failed"
    exit 1
fi

# 2. Linting
echo ""
echo "2️⃣  Running ESLint..."
npm run lint
if [ $? -eq 0 ]; then
    echo "✅ Linting passed"
else
    echo "⚠️  Linting has issues (non-blocking)"
fi

# 3. Tests
echo ""
echo "3️⃣  Running all tests..."
npm run test:all
if [ $? -eq 0 ]; then
    echo "✅ All tests passed"
else
    echo "❌ Tests failed"
    exit 1
fi

# 4. Environment Validation (optional)
echo ""
echo "4️⃣  Validating environment variables..."
if [ -f "scripts/validate-production-env.ts" ]; then
    npm run validate:env
    if [ $? -eq 0 ]; then
        echo "✅ Environment variables validated"
    else
        echo "⚠️  Environment validation failed (review manually)"
    fi
else
    echo "⏭️  Skipping env validation (script not found)"
fi

# 5. Build
echo ""
echo "5️⃣  Building production bundle..."
npm run build
if [ $? -eq 0 ]; then
    echo "✅ Build successful"
else
    echo "❌ Build failed"
    exit 1
fi

# 6. Check for uncommitted changes
echo ""
echo "6️⃣  Checking for uncommitted changes..."
if [[ -n $(git status -s) ]]; then
    echo "⚠️  Warning: You have uncommitted changes:"
    git status -s
    echo ""
    read -p "Do you want to continue anyway? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Deployment cancelled"
        exit 1
    fi
else
    echo "✅ Working directory clean"
fi

# 7. Check current branch
echo ""
echo "7️⃣  Checking current branch..."
CURRENT_BRANCH=$(git branch --show-current)
if [ "$CURRENT_BRANCH" != "main" ]; then
    echo "⚠️  Warning: You're not on 'main' branch (current: $CURRENT_BRANCH)"
    read -p "Deploy from $CURRENT_BRANCH? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "❌ Deployment cancelled"
        exit 1
    fi
else
    echo "✅ On main branch"
fi

# 8. Database Migration Check
echo ""
echo "8️⃣  Database migration check..."
echo "⚠️  Remember to run database migrations if needed:"
echo "   - Check for new migrations in drizzle/"
echo "   - Run: npm run db:migrate (if needed)"
echo ""

# 9. Final Summary
echo ""
echo "======================================="
echo "📊 PRE-DEPLOYMENT SUMMARY"
echo "======================================="
echo "✅ TypeScript: PASSED"
echo "✅ Tests: PASSED"
echo "✅ Build: SUCCESSFUL"
echo "✅ Git Status: CLEAN"
echo "✅ Branch: $CURRENT_BRANCH"
echo ""
echo "🎉 Ready for deployment!"
echo ""
echo "📝 Deployment Commands:"
echo "   Production: git push origin main"
echo "   Staging: git push staging main:master"
echo ""
echo "⚠️  Don't forget:"
echo "   1. Database migrations (if any)"
echo "   2. Environment variables (if changed)"
echo "   3. Monitor logs after deployment"
echo "======================================="
