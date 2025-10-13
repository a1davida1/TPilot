#!/bin/bash

# Render deployment fix script

echo "🔧 Fixing common Render deployment issues..."

# 1. Ensure production dependencies are installed
echo "📦 Installing production dependencies..."
npm ci --production

# 2. Build the application
echo "🔨 Building application..."
npm run build

# 3. Run database migrations (with proper SSL)
echo "🗄️ Pushing database schema..."
npm run db:push || echo "⚠️ Database push failed - check DATABASE_URL"

# 4. Start the server
echo "🚀 Starting server..."
npm start
