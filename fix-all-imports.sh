#!/bin/bash
# Fix all imports to have .js extension

# Add .js to all relative imports that don't have it
find dist -name '*.js' -exec sed -i -E "s/from '(\\.\\/.+)'/from '\\1.js'/g" {} +
find dist -name '*.js' -exec sed -i -E "s/from \"(\\.\\/.+)\"/from \"\\1.js\"/g" {} +

# Add .js to parent directory imports
find dist -name '*.js' -exec sed -i -E "s/from '(\\.\\.\/.+)'/from '\\1.js'/g" {} +
find dist -name '*.js' -exec sed -i -E "s/from \"(\\.\\.\/.+)\"/from \"\\1.js\"/g" {} +

# Fix any double .js extensions
find dist -name '*.js' -exec sed -i 's/\.js\.js/\.js/g' {} +

# Don't add .js to imports that already have it or are packages
find dist -name '*.js' -exec sed -i -E "s/from '([^.'\\/]+\\.js)\\.js'/from '\\1'/g" {} +
find dist -name '*.js' -exec sed -i -E "s/from \"([^.\"\\/]+\\.js)\\.js\"/from \"\\1\"/g" {} +

echo "Fixed all import extensions"