#!/bin/bash
set -e

echo "🔨 Building ThottoPilot for production..."

# Clean previous builds
echo "📦 Cleaning previous builds..."
rm -rf dist

echo "📂 Creating dist directory structure..."
mkdir -p dist/server

echo "⚙️ Compiling server TypeScript..."
REPLIT_DISABLE_PACKAGE_LAYER=1 npm run build:server

# Check if the compiled server file exists
if [ ! -f dist/server/server/index.js ]; then
  echo "❌ Server build failed: dist/server/server/index.js missing"
  echo "Checking build output..."
  ls -la dist/server/ || echo "No dist/server directory found"
  if [ -d dist/server ]; then
    echo "Contents of dist/server:"
    find dist/server -name "*.js" -type f | head -10
  fi
  echo "TypeScript compilation may have failed or output to wrong directory"
  exit 1
fi

# Set executable permissions only if file exists
if [ -f dist/server/server/index.js ]; then
  chmod +x dist/server/server/index.js
  echo "✅ Set executable permissions on dist/server/server/index.js"
else
  echo "❌ Skipping chmod - dist/server/server/index.js not found"
  exit 1
fi
echo "✅ Server TypeScript compiled to dist/"

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
echo "  NODE_ENV=production node dist/server/server/index.js"
echo ""
echo "Or for deployment:"
echo "  Use the dist/ directory as your deployment artifact"