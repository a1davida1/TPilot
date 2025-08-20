#!/bin/bash

# Production start script
echo "Starting production server..."

# Ensure database is synced
echo "Syncing database..."
npx drizzle-kit push --force

# Start server using tsx directly
echo "Starting application..."
NODE_ENV=production npx tsx server/index.ts