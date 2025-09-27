#!/bin/bash

echo "Building frontend assets..."
npx vite build

echo "Frontend build complete!"

# Create dist directories
mkdir -p dist/server dist/shared

echo "Building shared TypeScript files..."
# Create a temporary tsconfig for shared files
cat > temp-shared-tsconfig.json << EOF
{
  "compilerOptions": {
    "module": "ESNext",
    "target": "ES2022",
    "moduleResolution": "Node",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "outDir": "dist/shared",
    "declaration": false,
    "sourceMap": false
  },
  "include": ["shared/**/*"]
}
EOF

# Compile shared files
npx tsc --project temp-shared-tsconfig.json

# Clean up temporary config
rm temp-shared-tsconfig.json

echo "Building server TypeScript files..."
# Compile server TypeScript files with shared dependencies
cd server
npx tsc --project tsconfig.json
cd ..

echo "Resolving path mappings in compiled server files..."
# Use tsc-alias to resolve @shared/* imports to proper relative paths
npx tsc-alias -p server/tsconfig.json

echo "Copying prompt templates..."
mkdir -p dist/prompts
cp -R prompts/. dist/prompts/
echo "Prompt templates copied to dist/prompts/"

echo "Build complete!"