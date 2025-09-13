#!/bin/bash

echo "🔧 Applying TypeScript fixes..."

# Fix all Stripe API versions
find server -name "*.ts" -exec sed -i "s/'2023-10-16'/'2025-08-27.basil' as const/g" {} \;

# Fix boolean comparisons
find server -name "*.ts" -exec sed -i "s/includePromotion === true || includePromotion === 'true'/Boolean(includePromotion)/g" {} \;

# Fix watermark to addWatermark
find server -name "*.ts" -exec sed -i "s/validatedRequest\.watermark/validatedRequest.addWatermark/g" {} \;

echo "✅ Basic fixes applied. Now apply the manual diffs for complete resolution."