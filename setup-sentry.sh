#!/bin/bash

# Quick Sentry Setup Script for ThottoPilot
# Run this to set up error tracking in 5 minutes

echo "🚨 Setting up Sentry Error Tracking..."
echo ""
echo "Step 1: Sign up for Sentry (FREE)"
echo "======================================="
echo "1. Go to: https://sentry.io/signup/"
echo "2. Create account (use GitHub for quick signup)"
echo "3. Create organization name (e.g., 'thottopilot')"
echo "4. Create project:"
echo "   - Platform: Node.js"
echo "   - Alert frequency: 'Alert me on every new issue'"
echo "   - Project name: 'thottopilot-backend'"
echo ""
echo "Press ENTER when you've created your Sentry account..."
read

echo ""
echo "Step 2: Get your DSN"
echo "======================================="
echo "1. In Sentry, go to: Settings > Projects > thottopilot-backend"
echo "2. Click 'Client Keys (DSN)'"
echo "3. Copy the DSN (looks like: https://abc123@o12345.ingest.sentry.io/67890)"
echo ""
echo "Paste your Sentry DSN here and press ENTER:"
read SENTRY_DSN

if [ -z "$SENTRY_DSN" ]; then
    echo "❌ No DSN provided. Exiting..."
    exit 1
fi

echo ""
echo "Step 3: Adding to .env file"
echo "======================================="

# Check if .env exists
if [ ! -f .env ]; then
    echo "Creating .env file..."
    cp .env.example.complete .env
fi

# Check if SENTRY_DSN already exists
if grep -q "SENTRY_DSN=" .env; then
    echo "Updating existing SENTRY_DSN..."
    sed -i.bak "s|SENTRY_DSN=.*|SENTRY_DSN=$SENTRY_DSN|" .env
else
    echo "Adding SENTRY_DSN to .env..."
    echo "" >> .env
    echo "# Sentry Error Tracking (Added $(date))" >> .env
    echo "SENTRY_DSN=$SENTRY_DSN" >> .env
fi

echo "✅ Sentry DSN added to .env!"
echo ""

echo "Step 4: Test Sentry Integration"
echo "======================================="
echo "Creating test endpoint at /api/test-sentry..."

cat > test-sentry.js << 'EOF'
// Temporary test file - delete after testing
import fetch from 'node-fetch';

const testSentry = async () => {
  try {
    const response = await fetch('http://localhost:3005/api/test-sentry', {
      method: 'GET'
    });
    const data = await response.text();
    console.log('Response:', data);
  } catch (error) {
    console.error('Error:', error);
  }
};

testSentry();
EOF

echo ""
echo "Step 5: Verify in Sentry Dashboard"
echo "======================================="
echo "1. Start your server: npm run dev"
echo "2. Visit: http://localhost:3005/api/test-sentry"
echo "3. Check Sentry dashboard: https://sentry.io/organizations/YOUR_ORG/issues/"
echo "4. You should see a test error appear!"
echo ""
echo "✅ Sentry setup complete!"
echo ""
echo "Optional: Set up alerts"
echo "======================================="
echo "1. Go to: Alerts > Create Alert Rule"
echo "2. Choose: 'Issues' alert"
echo "3. Set conditions:"
echo "   - When: 'A new issue is created'"
echo "   - Action: 'Send email to team'"
echo "4. Save rule"
echo ""
echo "🎉 Your app now has production-grade error tracking!"
echo ""
echo "Quick Commands:"
echo "- View errors: https://sentry.io/"
echo "- Test error: curl http://localhost:3005/api/test-sentry"
echo "- Check integration: grep SENTRY_DSN .env"
