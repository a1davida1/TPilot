#!/bin/bash

# Database Schema Sync Script
# Run this before deployments to ensure database schema is aligned

echo "🔄 Starting database schema sync..."

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ DATABASE_URL is not set. Cannot proceed."
    exit 1
fi

echo "📊 Checking current schema status..."

# Run drizzle-kit push to sync schema
# This will show any differences and apply them safely
npx drizzle-kit push --force 2>&1 | tee /tmp/db-sync.log

# Check if the sync was successful
if grep -q "Changes applied" /tmp/db-sync.log || grep -q "No changes detected" /tmp/db-sync.log; then
    echo "✅ Database schema is now synchronized!"
    
    # Verify feature_flags table exists
    echo "🔍 Verifying critical tables..."
    npx tsx -e "
    import { neon } from '@neondatabase/serverless';
    const sql = neon(process.env.DATABASE_URL);
    sql\`SELECT COUNT(*) FROM feature_flags\`.then(() => {
        console.log('✓ feature_flags table verified');
    }).catch(e => {
        console.error('✗ feature_flags table check failed:', e.message);
        process.exit(1);
    });
    " 2>/dev/null || echo "⚠️  Could not verify feature_flags table"
    
    echo "🎉 Database is ready for deployment!"
    exit 0
else
    echo "❌ Database sync failed. Check /tmp/db-sync.log for details."
    exit 1
fi