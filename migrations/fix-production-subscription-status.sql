-- Safe migration to fix subscription_status constraint issues in production
-- This uses a 4-step approach to avoid constraint violations on existing data

-- STEP 1: Inspect unexpected statuses (for logging/debugging)
-- Run this first to see what values need fixing
SELECT DISTINCT subscription_status, COUNT(*) as count
FROM users
WHERE subscription_status IS NULL
   OR subscription_status NOT IN ('active','inactive','cancelled','past_due')
GROUP BY subscription_status;

-- STEP 2: Normalize bad rows to 'inactive'
-- This fixes all invalid values before adding constraints
UPDATE users
SET subscription_status = 'inactive'
WHERE subscription_status IS NULL
   OR subscription_status NOT IN ('active','inactive','cancelled','past_due');

-- STEP 3: Add constraint WITHOUT validation (NOT VALID)
-- This adds the constraint for new rows only, doesn't check existing data
ALTER TABLE users
    ADD CONSTRAINT valid_subscription_status
    CHECK (subscription_status IN ('active','inactive','cancelled','past_due'))
    NOT VALID;

-- STEP 4: Validate the constraint
-- After data is clean, validate to enforce for all existing rows
ALTER TABLE users
    VALIDATE CONSTRAINT valid_subscription_status;

-- Log the final state
SELECT 'Migration complete. Subscription status values:' as status;
SELECT subscription_status, COUNT(*) as count
FROM users
GROUP BY subscription_status
ORDER BY count DESC;