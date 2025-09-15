#!/bin/bash
set -e

echo "🔨 Building ThottoPilot for production..."

# Clean previous builds
echo "📦 Cleaning previous builds..."
rm -rf dist

echo "📂 Creating dist directory structure..."
mkdir -p dist/server

echo "⚙️ Compiling TypeScript..."
npx tsc -p tsconfig.server.json || { echo "TypeScript compilation failed"; exit 1; }

echo "✅ TypeScript compiled to dist/"
chmod +x dist/server/index.js

# Apply path mappings
echo "🔗 Resolving path mappings..."
tsc-alias -p tsconfig.server.json

# Fix imports - add .js extensions
echo "🔄 Fixing import extensions..."
bash fix-all-imports.sh

# Fix all relative imports that need .js
echo "✨ Finalizing imports..."
find dist -name '*.js' -exec sed -i -E "s/from '(\\.\\/.+)'/from '\\1.js'/g" {} + 2>/dev/null || true
find dist -name '*.js' -exec sed -i -E "s/from \"(\\.\\/.+)\"/from \"\\1.js\"/g" {} + 2>/dev/null || true
find dist -name '*.js' -exec sed -i -E "s/from '(\\.\\.\/.+)'/from '\\1.js'/g" {} + 2>/dev/null || true
find dist -name '*.js' -exec sed -i -E "s/from \"(\\.\\.\/.+)\"/from \"\\1.js\"/g" {} + 2>/dev/null || true

# Fix any double .js extensions (critical for deployment)
echo "🔧 Fixing double extensions..."
find dist -name '*.js' -exec sed -i 's/\.js\.js/\.js/g' {} + 2>/dev/null || true
find dist -name '*.js' -exec sed -i 's/\.js\.js/\.js/g' {} + 2>/dev/null || true

# Build client for production
echo "🎨 Building client..."
npm run build:client
mkdir -p dist/client
cp -r client/dist/* dist/client/
find dist/client -name "*.js" -o -name "*.css" | xargs gzip -9 --keep

echo "✅ Production build complete!"
echo ""
echo "To run in production:"
echo "  NODE_ENV=production node dist/server/index.js"
echo ""
echo "Or for deployment:"
echo "  Use the dist/ directory as your deployment artifact"