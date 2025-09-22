#!/usr/bin/env bash
set -euo pipefail

echo ">>> Running canonical DB resolvers..."
node scripts/resolve-feature-flags.js || true
node scripts/resolve-legacy-saved-content.js || true

echo ">>> Running drizzle push..."
npx drizzle-kit push --verbose || true

echo ">>> Running post rate limits backfill..."
npx tsx scripts/backfill-post-rate-limits.ts || true