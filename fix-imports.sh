#!/bin/bash

# Fix all .js extensions
find dist -name "*.js" -type f -exec sed -i -E \
  "s|from '(\\.+/[^']+)'|from '\\1.js'|g; s|from \"(\\.+/[^\"]+)\"|from \"\\1.js\"|g" {} \;

# Remove double .js.js
find dist -name "*.js" -type f -exec sed -i 's/\.js\.js/.js/g' {} \;

# Fix @shared imports based on directory depth
# Root level (dist/server/*.js)
find dist/server -maxdepth 1 -name "*.js" -type f -exec sed -i \
  -e 's|from "@shared/|from "../shared/|g' \
  -e "s|from '@shared/|from '../shared/|g" \
  -e 's|import("@shared/|import("../shared/|g' \
  -e "s|import('@shared/|import('../shared/|g" {} \;

# First-level subdirs (dist/server/*/
find dist/server -mindepth 2 -maxdepth 2 -name "*.js" -type f -exec sed -i \
  -e 's|from "@shared/|from "../../shared/|g' \
  -e "s|from '@shared/|from '../../shared/|g" \
  -e 's|import("@shared/|import("../../shared/|g' \
  -e "s|import('@shared/|import('../../shared/|g" {} \;

# Second-level subdirs (dist/server/*/*/*.js)
find dist/server -mindepth 3 -maxdepth 3 -name "*.js" -type f -exec sed -i \
  -e 's|from "@shared/|from "../../../shared/|g' \
  -e "s|from '@shared/|from '../../../shared/|g" \
  -e 's|import("@shared/|import("../../../shared/|g' \
  -e "s|import('@shared/|import('../../../shared/|g" {} \;

echo "Import paths fixed successfully"
