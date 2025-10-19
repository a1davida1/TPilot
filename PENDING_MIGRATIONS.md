# Pending Database Migrations

## Status
**Date:** 2025-10-19
**Last Applied Migration:** 0014_yellow_green_goblin
**Pending Migrations:** 2

## Migrations Prepared

### 1. Migration 0015: Recurring Commissions
**File:** `migrations/0015_recurring_commissions.sql`
**Status:** ✅ Ready to apply
**Purpose:** Adds recurring commission tracking to referral_rewards table

**Columns Added:**
- `type` (varchar) - 'first_month_bonus' | 'recurring_commission'
- `month` (integer) - Subscription month (1-9)
- `status` (varchar) - 'pending' | 'paid' | 'failed'
- `paid_at` (timestamp) - Payment timestamp
- `subscription_id` (varchar) - Stripe subscription ID
- `billing_period_start` (timestamp)
- `billing_period_end` (timestamp)

**Indexes Created:**
- `referral_rewards_referrer_idx` (referrer_id)
- `referral_rewards_referred_idx` (referred_id)
- `referral_rewards_status_idx` (status)
- `referral_rewards_subscription_idx` (subscription_id)

**Critical:** Your code in `shared/schema.ts` expects these columns. Without this migration, referral tracking will fail.

---

### 2. Migration 0016: Reddit Accounts Vault
**File:** `migrations/0016_reddit_accounts_vault.sql`
**Status:** ✅ Ready to apply
**Purpose:** Separates Reddit OAuth credentials into secure vault tables

**Tables Created:**
1. **reddit_accounts** - Encrypted credential storage
   - Encrypted refresh tokens (AES-256-GCM)
   - Access token hash (SHA-256 for leak detection)
   - OAuth metadata and lifecycle tracking
   - One Reddit account per user constraint

2. **reddit_account_audit_log** - Security audit trail
   - Tracks link/refresh/revoke/unlink actions
   - IP address and user agent logging
   - JSONB metadata for extensibility

**Benefit:** Improves security by isolating OAuth credentials from main users table.

---

## How to Apply Migrations

### Option 1: Via Drizzle (Recommended but currently hanging)
```bash
npm run db:push
```
**Issue:** Currently timing out when pulling schema from Render database. May work better with faster connection or local database.

---

### Option 2: Manual SQL via Render Dashboard (SAFE & RELIABLE)

1. **Go to Render Dashboard:**
   - https://dashboard.render.com
   - Navigate to your PostgreSQL database
   - Click "Connect" → "External Connection"

2. **Connect via psql:**
   ```bash
   psql postgresql://[connection-string-from-render]
   ```

3. **Verify Current State:**
   ```sql
   -- Check if columns already exist
   SELECT column_name
   FROM information_schema.columns
   WHERE table_name = 'referral_rewards'
   AND column_name IN ('type', 'month', 'status');

   -- Check if tables exist
   SELECT table_name
   FROM information_schema.tables
   WHERE table_name IN ('reddit_accounts', 'reddit_account_audit_log');
   ```

4. **Apply Migration 0015 (if columns don't exist):**
   ```bash
   psql [connection-string] < migrations/0015_recurring_commissions.sql
   ```

5. **Apply Migration 0016 (if tables don't exist):**
   ```bash
   psql [connection-string] < migrations/0016_reddit_accounts_vault.sql
   ```

6. **Verify:**
   ```sql
   -- Verify referral_rewards columns
   \d referral_rewards

   -- Verify new tables
   \d reddit_accounts
   \d reddit_account_audit_log
   ```

---

### Option 3: Manual SQL via Render Web Console

1. Go to your Postgres database in Render Dashboard
2. Click "Connect" → "Web Shell"
3. Copy contents of `migrations/0015_recurring_commissions.sql` and paste
4. Execute
5. Copy contents of `migrations/0016_reddit_accounts_vault.sql` and paste
6. Execute

---

## Migration History Updated

The following files have been updated:

✅ **migrations/meta/_journal.json** - Added entries for 0015 and 0016
✅ **migrations/0015_recurring_commissions.sql** - Renamed from 0014 (was conflicting)
✅ **migrations/0016_reddit_accounts_vault.sql** - Renamed from 0020 (was out of sequence)

---

## What Happens If You Don't Apply These?

### Without 0015 (Recurring Commissions):
- ❌ Referral commission tracking will fail
- ❌ Any code attempting to access `referral_rewards.type`, `referral_rewards.month`, etc. will crash
- ❌ Stripe webhook handlers for recurring payments won't work

### Without 0016 (Reddit Vault):
- ⚠️ Reddit OAuth will continue working via `users` table
- ⚠️ But credentials won't be separated/encrypted
- ⚠️ Future Reddit multi-account features won't work
- ⚠️ Security audit trail won't exist

**Recommendation:** Apply 0015 immediately (critical), 0016 when convenient (nice-to-have security improvement).

---

## Verification After Applying

Run this query to confirm successful application:

```sql
-- Check 0015 columns
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'referral_rewards'
AND column_name IN ('type', 'month', 'status', 'paid_at', 'subscription_id', 'billing_period_start', 'billing_period_end')
ORDER BY column_name;

-- Check 0016 tables
SELECT table_name,
       (SELECT count(*) FROM information_schema.columns WHERE table_name = t.table_name) as column_count
FROM information_schema.tables t
WHERE table_name IN ('reddit_accounts', 'reddit_account_audit_log');
```

Expected output:
- 7 rows for referral_rewards columns
- 2 rows for Reddit vault tables with proper column counts

---

## Generated
Date: 2025-10-19
By: Claude Code
