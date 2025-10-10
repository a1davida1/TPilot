#!/bin/bash
# Simple console.log → logger migration
# Strategy: Just replace console.X( with logger.X( 
# Don't try to add formatLogArgs - keep it simple

set -e

echo "🔧 Starting console.log migration..."
echo ""

# Find all .ts files in server/ (excluding tests)
FILES=$(find server -name "*.ts" ! -name "*.test.ts" ! -name "*.spec.ts" ! -path "*/node_modules/*")

TOTAL=0
MODIFIED=0

for file in $FILES; do
  # Count console.* in this file
  COUNT=$(grep -c "console\.\(error\|warn\|log\)" "$file" 2>/dev/null || echo "0")
  
  if [ "$COUNT" -gt 0 ]; then
    echo "📝 $file: $COUNT occurrences"
    
    # Simple replacements:
    # console.error → logger.error
    # console.warn → logger.warn  
    # console.log → logger.info
    
    sed -i.bak \
      -e 's/console\.error(/logger.error(/g' \
      -e 's/console\.warn(/logger.warn(/g' \
      -e 's/console\.log(/logger.info(/g' \
      "$file"
    
    # Check if we need to add imports
    if ! grep -q "from.*logger.*bootstrap/logger" "$file"; then
      # Find the last import line
      LAST_IMPORT=$(grep -n "^import " "$file" | tail -1 | cut -d: -f1)
      
      if [ -n "$LAST_IMPORT" ]; then
        # Add logger import after last import
        sed -i "${LAST_IMPORT}a\\
import { logger } from './bootstrap/logger.js';
" "$file"
      fi
    fi
    
    rm "$file.bak"
    MODIFIED=$((MODIFIED + 1))
  fi
  
  TOTAL=$((TOTAL + COUNT))
done

echo ""
echo "✅ Migration complete!"
echo "   Files modified: $MODIFIED"
echo "   Total replacements: $TOTAL"
echo ""
echo "🔍 Verifying with TypeScript..."
npm run typecheck

if [ $? -eq 0 ]; then
  echo "✅ TypeScript compilation successful!"
else
  echo "❌ TypeScript errors found - review needed"
  exit 1
fi
