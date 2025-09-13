#!/bin/bash
set -e

echo "🔨 Building ThottoPilot for production..."

# Clean previous builds
echo "📦 Cleaning previous builds..."
rm -rf dist

echo "📂 Creating dist directory structure..."
mkdir -p dist/server

echo "⚙️ Compiling TypeScript..."
npx tsc -p tsconfig.server.json

echo "📝 Creating production server entry point..."
# Create package.json to ensure CommonJS mode in dist folder
cat > dist/package.json << 'EOF'
{
  "type": "commonjs",
  "description": "Production build output - ensures CommonJS module format"
}
EOF

# Create the production server entry point that spawns tsx
cat > dist/server/index.js << 'EOF'
#!/usr/bin/env node

/**
 * Production server entry point for Replit deployment
 * Spawns tsx to run the TypeScript server, avoiding module format issues
 */

const { spawn } = require('child_process');
const path = require('path');

// Ensure production environment
process.env.NODE_ENV = 'production';

// Path to the TypeScript server
const serverFile = path.resolve(__dirname, '../../server/index.ts');

console.log('Starting ThottoPilot production server...');

// Spawn tsx to run the TypeScript server
const tsxPath = require.resolve('tsx/cli');
const server = spawn('node', [tsxPath, serverFile], {
  stdio: 'inherit',
  env: process.env
});

// Handle errors
server.on('error', (err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

// Forward the exit code
server.on('exit', (code) => {
  process.exit(code || 0);
});

// Handle termination signals
process.on('SIGTERM', () => {
  server.kill('SIGTERM');
});

process.on('SIGINT', () => {
  server.kill('SIGINT');
});
EOF

echo "  ✅ Created dist/server/index.js production entry point"

# Apply path mappings
echo "🔗 Resolving path mappings..."
tsc-alias -p tsconfig.json

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
npm run build:client && npm run build:server
find dist/client -name "*.js" -o -name "*.css" | xargs gzip -9 --keep

echo "✅ Production build complete!"
echo ""
echo "To run in production:"
echo "  NODE_ENV=production node dist/server/index.js"
echo ""
echo "Or for deployment:"
echo "  Use the dist/ directory as your deployment artifact"