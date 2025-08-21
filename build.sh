#!/bin/bash

echo "Building frontend assets..."
npx vite build

echo "Frontend build complete!"

# Create dist directories
mkdir -p dist/server dist/shared

echo "Building server TypeScript files..."
# Compile server TypeScript files to JavaScript with ES modules
npx tsc --project server/tsconfig.json

echo "Building shared TypeScript files..."
# Compile shared files
npx tsc --project tsconfig.json --outDir dist/shared shared/**/*.ts

echo "Build complete!"