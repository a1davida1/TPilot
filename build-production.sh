#!/bin/bash
set -e

echo "🔨 Building ThottoPilot for production..."
echo "📦 Cleaning previous builds..."
rm -rf dist
mkdir -p dist/server

echo "⚙️ Compiling server TypeScript..."
if ! npm run build:server; then
  echo "TypeScript build failed, trying fallback compilation..."
  npx tsx server/index.ts --outDir dist/server
fi
chmod +x dist/server/server/index.js

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