#!/bin/bash

# Apply migration 0017_add_promotion_urls
# Adds OnlyFans and Fansly URL fields to user_preferences

set -e

echo "🗄️  Applying Migration 0017: Add Promotion URLs"
echo "================================================"
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

echo "📄 Migration Details:"
echo "   - Adds only_fans_url column to user_preferences"
echo "   - Adds fansly_url column to user_preferences"
echo "   - Both columns are VARCHAR(255) and nullable"
echo ""

# Show migration SQL
echo "📝 Migration SQL:"
echo "---"
cat migrations/0017_add_promotion_urls.sql
echo "---"
echo ""

# Confirm before applying
read -p "⚠️  Apply migration to $DB_NAME? (y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "❌ Migration cancelled"
    exit 1
fi

# Apply migration
echo ""
echo "🔄 Applying migration..."
psql "$DATABASE_URL" -f migrations/0017_add_promotion_urls.sql

echo ""
echo "✅ Migration 0017 applied successfully!"
echo ""
echo "📝 Verification steps:"
echo "   1. Check that columns exist:"
echo "      psql \"\$DATABASE_URL\" -c '\\d user_preferences'"
echo ""
echo "   2. Test the feature:"
echo "      - Go to Settings and add OnlyFans/Fansly URLs"
echo "      - Generate captions with promotionMode='explicit'"
echo "      - Verify URLs appear in generated CTAs"
echo ""
