#!/bin/bash

# Production startup script - skips build if dist exists
if [ ! -d "dist" ]; then
  echo "📦 Building application for first time..."
  npm run build
else
  echo "✅ Using existing build from dist/"
fi

echo "🚀 Starting production server..."
NODE_ENV=production node dist/server/index.js
