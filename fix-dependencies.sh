#!/bin/bash
# Fix NPM dependency installation issues

echo "🔧 Fixing NPM dependency issues..."

# Clean npm cache
echo "📦 Cleaning npm cache..."
npm cache clean --force

# Remove problematic directories
echo "🗑️ Removing node_modules and lock file..."
rm -rf node_modules
rm -f package-lock.json

# Clear any npm temp directories
echo "🧹 Clearing temp directories..."
rm -rf /tmp/npm-*

# Reinstall dependencies
echo "📥 Reinstalling dependencies..."
npm install

# Verify installation
echo "✅ Verifying installation..."
npm ls --depth=0

echo "
✨ Dependency fix complete!

If you still see 403 errors:
1. Check if you're behind a proxy or firewall
2. Try: npm config set registry https://registry.npmjs.org/
3. Try: npm install --legacy-peer-deps

To run the app:
npm run dev
"
