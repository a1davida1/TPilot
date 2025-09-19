#!/bin/bash

# Production start script
echo "Starting production server..."

# Build the latest production bundle so dist/ is ready
echo "Building production bundle..."
bash build-production.sh

# Ensure database is synced
echo "Syncing database..."
npx drizzle-kit push --force

# Start server using compiled JS for production
echo "Starting application..."
NODE_ENV=production node dist/server/index.js