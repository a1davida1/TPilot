#!/bin/bash

# ==========================================
# ThottoPilot Linting Script
# ==========================================

set -e

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "${GREEN}[LINT] $1${NC}"
}

error() {
    echo -e "${RED}[LINT ERROR] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[LINT WARN] $1${NC}"
}

FIX_MODE=${1:-false}

if [ "$FIX_MODE" = "--fix" ]; then
    log "Running ESLint with auto-fix..."
    FIX_FLAG="--fix"
else
    log "Running ESLint..."
    FIX_FLAG=""
fi

# Check if ESLint config exists
if [ ! -f "eslint.config.js" ] && [ ! -f ".eslintrc.js" ] && [ ! -f ".eslintrc.json" ]; then
    warn "No ESLint configuration found, skipping linting"
    exit 0
fi

# Run ESLint
if command -v npx >/dev/null 2>&1; then
    npx eslint . --ext .ts,.tsx,.js,.jsx $FIX_FLAG
    log "Linting completed successfully!"
else
    error "npx not available, cannot run linting"
    exit 1
fi