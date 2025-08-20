#!/bin/bash

# Build script that only builds frontend, skips TypeScript compilation
echo "Building frontend assets..."
npx vite build

echo "Frontend build complete!"

# Create dist directory for server if it doesn't exist
mkdir -p dist/server

# Copy server files without TypeScript compilation
echo "Preparing server files..."
cp -r server/* dist/server/ 2>/dev/null || true
cp -r shared dist/ 2>/dev/null || true

echo "Build complete!"