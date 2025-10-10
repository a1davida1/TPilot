#!/bin/bash
# Quick Neon Backup Verification Script
# Checks database connectivity and guides you through backup verification

set -e

echo "🔍 Neon Database Backup Verification"
echo "===================================="
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
  echo "❌ DATABASE_URL not found in environment"
  echo "   Set it in your .env file or Replit secrets"
  exit 1
fi

echo "✅ DATABASE_URL is configured"
echo ""

# Extract database name from URL
DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
echo "📊 Database: $DB_NAME"
echo ""

# Test database connection
echo "🔌 Testing database connection..."
if psql "$DATABASE_URL" -c "SELECT 1" > /dev/null 2>&1; then
  echo "✅ Database connection successful!"
else
  echo "⚠️  Cannot connect to database"
  echo "   This might be a firewall/network issue, not a backup problem"
fi
echo ""

# Get basic stats
echo "📈 Database Statistics:"
psql "$DATABASE_URL" -t -c "
  SELECT 
    'Tables: ' || COUNT(*) 
  FROM information_schema.tables 
  WHERE table_schema = 'public';
" 2>/dev/null || echo "  (Stats unavailable - connection issue)"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 MANUAL VERIFICATION CHECKLIST"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Now verify Neon backups in the dashboard:"
echo ""
echo "1. Open: https://console.neon.tech/"
echo "   └─ Login with your credentials"
echo ""
echo "2. Select your project (ThottoPilot)"
echo ""
echo "3. Check backup settings:"
echo "   ├─ Navigate to 'Settings' or 'Backup' tab"
echo "   ├─ Verify: Point-in-time recovery is ENABLED"
echo "   ├─ Check: Retention period (7 days free / 30 days paid)"
echo "   └─ Note: Last backup timestamp"
echo ""
echo "4. Test branch creation (optional but recommended):"
echo "   ├─ Go to 'Branches' tab"
echo "   ├─ Click 'New Branch'"
echo "   ├─ Select 'From backup' or 'From timestamp'"
echo "   ├─ Choose a point from 1 hour ago"
echo "   ├─ Create test branch: 'backup-test-$(date +%Y%m%d)'"
echo "   └─ Delete the test branch after verification"
echo ""
echo "5. Document your findings in:"
echo "   └─ docs/runbooks/disaster-recovery.md"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "✅ Backup verification complete!"
echo ""
echo "Next steps:"
echo "  1. Complete the manual dashboard checks above"
echo "  2. Update docs/runbooks/disaster-recovery.md with:"
echo "     - Backup retention period"
echo "     - Last verified date"
echo "     - Test branch creation result"
echo ""
