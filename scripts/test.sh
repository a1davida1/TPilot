#!/bin/bash

# ==========================================
# ThottoPilot Test Runner Script
# ==========================================

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[TEST] $1${NC}"
}

error() {
    echo -e "${RED}[TEST ERROR] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[TEST WARN] $1${NC}"
}

log "Running ThottoPilot test suite..."

# Check if test files exist
if find . -name "*.test.ts" -o -name "*.test.js" -o -name "*.spec.ts" -o -name "*.spec.js" | grep -q .; then
    # Run tests with vitest if available
    if command -v npx >/dev/null 2>&1; then
        log "Running tests with vitest..."
        npx vitest run --reporter=verbose
    else
        error "npx not available, cannot run tests"
        exit 1
    fi
else
    warn "No test files found (*.test.ts, *.test.js, *.spec.ts, *.spec.js)"
    warn "Test suite passed (no tests to run)"
fi

log "Test suite completed successfully!"