#!/bin/bash
# E2E Test Runner Script
# This script runs the E2E tests using the vendored Playwright stub

echo "Running E2E tests..."
tsx vendor/playwright-test/runner.ts