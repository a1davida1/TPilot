#!/bin/bash
# Fix all imports to have .js extension

# Check if dist directory exists
if [ ! -d "dist" ]; then
    echo "⚠️  dist directory not found. Run this script as part of the build process."
    echo "   To run full build: bash build-production.sh"
    exit 0
fi

# Add .js to all relative imports that don't have it
find dist -name '*.js' -exec sed -i -E "s/from '(\\.\\/.+)'/from '\\1.js'/g" {} + 2>/dev/null
find dist -name '*.js' -exec sed -i -E "s/from \"(\\.\\/.+)\"/from \"\\1.js\"/g" {} + 2>/dev/null

# Add .js to parent directory imports
find dist -name '*.js' -exec sed -i -E "s/from '(\\.\\.\/.+)'/from '\\1.js'/g" {} + 2>/dev/null
find dist -name '*.js' -exec sed -i -E "s/from \"(\\.\\.\/.+)\"/from \"\\1.js\"/g" {} + 2>/dev/null

# Fix any double .js extensions
find dist -name '*.js' -exec sed -i 's/\.js\.js/\.js/g' {} + 2>/dev/null

# Don't add .js to imports that already have it or are packages
find dist -name '*.js' -exec sed -i -E "s/from '([^.'\\/]+\\.js)\\.js'/from '\\1'/g" {} + 2>/dev/null
find dist -name '*.js' -exec sed -i -E "s/from \"([^.\"\\/]+\\.js)\\.js\"/from \"\\1\"/g" {} + 2>/dev/null

echo "Fixed all import extensions"