#!/bin/bash

# Production migration runner for ThottoPilot
set -e

echo "🗄️  ThottoPilot Database Migration Runner"
echo "=========================================="
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL is not set!"
    echo ""
    echo "Please set DATABASE_URL:"
    echo "export DATABASE_URL='postgresql://user:pass@host:port/dbname'"
    exit 1
fi

# Parse database URL to show connection info (without password)
DB_HOST=$(echo $DATABASE_URL | sed -E 's/.*@([^:\/]+).*/\1/')
DB_NAME=$(echo $DATABASE_URL | sed -E 's/.*\/([^?]+).*/\1/')

echo "📍 Database: $DB_NAME @ $DB_HOST"
echo ""

# 1. Generate migrations
echo "1️⃣  Generating migrations from schema..."
npm run db:generate

# Check if new migrations were created
MIGRATION_COUNT=$(ls -1 drizzle/*.sql 2>/dev/null | wc -l)
if [ "$MIGRATION_COUNT" -eq "0" ]; then
    echo "❌ No migrations found in drizzle/"
    exit 1
fi

echo "✅ Found $MIGRATION_COUNT migration file(s)"
echo ""

# Show latest migration
LATEST_MIGRATION=$(ls -t drizzle/*.sql | head -1)
if [ ! -z "$LATEST_MIGRATION" ]; then
    echo "📄 Latest migration: $(basename $LATEST_MIGRATION)"
    echo "---"
    head -20 "$LATEST_MIGRATION"
    echo "..."
    echo "---"
    echo ""
fi

# 2. Confirm before applying
read -p "⚠️  Apply migrations to $DB_NAME? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Migration cancelled"
    exit 1
fi

# 3. Run migrations
echo ""
echo "2️⃣  Applying migrations..."
npm run db:migrate

echo ""
echo "✅ Migrations completed successfully!"
echo ""
echo "📝 Post-migration checklist:"
echo "   - Test the application"
echo "   - Check for any errors in logs"
echo "   - Verify data integrity"
echo ""
