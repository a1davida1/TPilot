#!/bin/bash
set -e

echo "🔨 Building ThottoPilot for production..."
echo "📦 Cleaning previous builds..."
rm -rf dist
mkdir -p dist/server

echo "⚙️ Compiling server TypeScript..."
# Clear TypeScript incremental cache to force fresh compilation
rm -f ./node_modules/typescript/tsbuildinfo
npx tsc -p tsconfig.server.json

# Verify the build succeeded and the expected output exists
if [ ! -f dist/server/index.js ]; then
  echo "❌ Server build failed: dist/server/index.js not found"
  exit 1
fi
echo "✅ Server build verified: dist/server/index.js exists"

echo "🔗 Resolving path mappings..."
tsc-alias -p tsconfig.server.json

echo "🔄 Fixing import extensions..."
bash fix-all-imports.sh
find dist -name '*.js' -exec sed -i -E "s/from '(\\.\\/.+)'/from '\\1.js'/g" {} + 2>/dev/null || true
find dist -name '*.js' -exec sed -i -E "s/from \"(\\.\\/.+)\"/from \"\\1.js\"/g" {} + 2>/dev/null || true
find dist -name '*.js' -exec sed -i -E "s/from '(\\.\\.\/.+)'/from '\\1.js'/g" {} + 2>/dev/null || true
find dist -name '*.js' -exec sed -i -E "s/from \"(\\.\\.\/.+)\"/from \"\\1.js\"/g" {} + 2>/dev/null || true

echo "🎨 Building client..."
npm run build:client
mkdir -p dist/client
cp -r client/dist/* dist/client/
find dist/client -name "*.js" -o -name "*.css" | xargs gzip -9 --keep

echo "✅ Production build complete!"