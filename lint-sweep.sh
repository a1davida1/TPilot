#!/bin/bash
set -e

echo "=== Pass 1: ESLint auto-fix ==="
npx eslint . --fix || true

echo "=== Pass 2: replace ': unknown' with ': unknown' ==="
rg ": unknown" -l | xargs sed -i "s/: unknown/: unknown/g"

echo "=== Pass 3: remove unused imports/vars ==="
# run ESLint repeatedly to shake loose new unused warnings
for i in {1..3}; do
  npx eslint . --fix || true
done

echo "=== Pass 4: surface remaining issues ==="
npx eslint . > lint-report.log || true
echo "Lint summary stored in lint-report.log"

echo "=== Pass 5: run unit tests (non-blocking) ==="
npm test > test-report.log || true
echo "Test summary stored in test-report.log"

echo "=== Completed at $(date) ==="