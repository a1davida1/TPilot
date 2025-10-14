#!/bin/bash

# Check if there are pending migrations that need to be run
# This does NOT run migrations, just warns you

echo "🔍 Checking for pending migrations..."

# Check if there are uncommitted migration files
if [ -d "drizzle" ]; then
    MIGRATION_COUNT=$(ls -1 drizzle/*.sql 2>/dev/null | wc -l)
    
    if [ "$MIGRATION_COUNT" -gt "0" ]; then
        echo ""
        echo "⚠️  Found $MIGRATION_COUNT migration file(s) in drizzle/"
        echo ""
        echo "📋 Migration files:"
        ls -1 drizzle/*.sql
        echo ""
        echo "⚠️  REMINDER: Run migrations on production BEFORE deploying!"
        echo ""
        echo "To apply migrations:"
        echo "  1. export DATABASE_URL='your_production_url'"
        echo "  2. npm run db:migrate"
        echo "  3. Then deploy your code"
        echo ""
        
        # Check if migrations are committed
        if git diff --cached --name-only | grep -q "drizzle/"; then
            echo "✅ Migration files are staged for commit"
        elif git diff --name-only | grep -q "drizzle/"; then
            echo "⚠️  Migration files are NOT committed yet!"
            echo "   Run: git add drizzle/ && git commit -m 'feat: database migration'"
        fi
        
        echo ""
        read -p "Continue with deployment? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo "❌ Deployment cancelled"
            exit 1
        fi
    else
        echo "✅ No pending migrations found"
    fi
else
    echo "✅ No drizzle directory found"
fi

exit 0
