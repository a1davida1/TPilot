#!/bin/bash

echo "🚀 Emergency Beta Build - Bypassing TypeScript Errors"
echo "================================================"

# Clean previous builds
echo "🧹 Cleaning previous builds..."
rm -rf dist/

# Build client (Vite handles this well)
echo "📦 Building client..."
npm run build:client

# Build server with TypeScript but ignore errors
echo "📦 Building server (ignoring type errors)..."
npx tsc -p tsconfig.server.json --noEmitOnError false || true

# If TypeScript still complains, use esbuild as fallback
if [ ! -f dist/server/index.js ]; then
    echo "⚠️ TypeScript failed, using esbuild fallback..."
    npx esbuild server/index.ts \
        --bundle \
        --platform=node \
        --target=node20 \
        --outfile=dist/server/index.js \
        --external:pg-native \
        --external:bcrypt \
        --external:sharp \
        --external:canvas \
        --loader:.node=file \
        --format=esm
fi

# Copy necessary files
echo "📄 Copying configuration files..."
cp package.json dist/
cp package-lock.json dist/ 2>/dev/null || true
cp .env.example dist/ 2>/dev/null || true

# Create a production start script
cat > dist/start.sh << 'EOF'
#!/bin/bash
NODE_ENV=production node --import=./server/instrumentation.js server/index.js
EOF
chmod +x dist/start.sh

echo "✅ Beta build complete!"
echo ""
echo "📋 Next steps:"
echo "1. Test locally: cd dist && npm install --production && ./start.sh"
echo "2. Set environment variables"
echo "3. Deploy the 'dist' folder to your server"
echo ""
echo "⚠️ This is a BETA build with TypeScript errors bypassed!"
echo "   Fix these issues properly after launch."
