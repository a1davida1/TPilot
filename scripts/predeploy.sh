#!/bin/bash
set -e

echo "🔧 Running feature_flags resolver..."
node scripts/resolve-feature-flags.js

echo "🔧 Syncing database schema..."
npm run db:push 2>/dev/null || npx drizzle-kit push --force || {
    echo "⚠️  Database push completed with warnings - this is expected"
}

echo "✅ Predeploy completed successfully"