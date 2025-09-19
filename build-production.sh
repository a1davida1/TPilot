#!/bin/bash
set -euo pipefail

LOG_DIR="logs"
TS_SERVER_FILE_LOG="$LOG_DIR/tsc-server-files.log"

mkdir -p "$LOG_DIR"

echo "🔨 Building ThottoPilot for production..."

# Clean previous builds
echo "📦 Cleaning previous builds..."
rm -rf dist

echo "📂 Creating dist directory structure..."
mkdir -p dist/server

echo "⚙️ Compiling server TypeScript..."
echo "Current directory: $(pwd)"
echo "TSConfig file exists: $(test -f tsconfig.server.json && echo 'yes' || echo 'no')"
echo "📄 Saving TypeScript file list to $TS_SERVER_FILE_LOG"
npx tsc -p tsconfig.server.json --listFiles > "$TS_SERVER_FILE_LOG"
if [ -s "$TS_SERVER_FILE_LOG" ]; then
  echo "First TypeScript files included in build:"
  head -n 3 "$TS_SERVER_FILE_LOG" | sed 's/^/  /'
  line_count=$(wc -l < "$TS_SERVER_FILE_LOG")
  if [ "$line_count" -gt 3 ]; then
    echo "  ... (full list written to $TS_SERVER_FILE_LOG)"
  else
    echo "  (complete list above)"
  fi
else
  echo "⚠️ No TypeScript files listed; check $TS_SERVER_FILE_LOG for details."
fi
echo "Compilation finished, checking output..."

# Check if the compiled server file exists
if [ ! -f dist/server/index.js ]; then
  echo "❌ Server build failed: dist/server/index.js missing"
  echo "Checking build output..."
  ls -la dist/server/ || echo "No dist/server directory found"
  if [ -d dist/server ]; then
    echo "Contents of dist/server:"
    find dist/server -name "*.js" -type f | head -10
  fi
  echo "TypeScript compilation may have failed or output to wrong directory"
  exit 1
fi

chmod +x dist/server/index.js
echo "✅ Set executable permissions on dist/server/index.js"
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

# Ensure client entry point exists
echo "📋 Checking client entry point..."
if [ ! -f client/index.html ]; then
  echo "⚠️ client/index.html not found"
  if [ -f client/index.html.dev ]; then
    echo "📄 Creating client/index.html from client/index.html.dev..."
    # Copy dev file to production and remove dev-only scripts
    cp client/index.html.dev client/index.html
    # Remove the dev-only Replit banner script line
    sed -i '/load-replit-banner\.js/d' client/index.html 2>/dev/null || true
    echo "✅ Created production client/index.html"
  else
    echo "❌ Neither client/index.html nor client/index.html.dev found!"
    echo "❌ Cannot proceed with client build"
    exit 1
  fi
else
  echo "✅ client/index.html found"
fi

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