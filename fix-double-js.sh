#!/bin/bash
# Fix double .js extensions that result from tsc-alias already adding .js
find dist -name '*.js' -exec sed -i 's/\.js\.js/\.js/g' {} +
echo "Fixed double .js extensions"