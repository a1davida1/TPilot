-- Migration: Add recurring commission support to referral_rewards table
-- Description: Updates referral_rewards to track monthly recurring commissions for up to 9 months

-- Add new columns for recurring commission tracking
ALTER TABLE referral_rewards
ADD COLUMN IF NOT EXISTS type varchar(20),
ADD COLUMN IF NOT EXISTS month integer,
ADD COLUMN IF NOT EXISTS status varchar(20) DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS paid_at timestamp,
ADD COLUMN IF NOT EXISTS subscription_id varchar(255),
ADD COLUMN IF NOT EXISTS billing_period_start timestamp,
ADD COLUMN IF NOT EXISTS billing_period_end timestamp;

-- Update existing records to have default values
UPDATE referral_rewards
SET
  type = 'first_month_bonus',
  month = 1,
  status = 'paid',
  paid_at = created_at,
  billing_period_start = created_at,
  billing_period_end = created_at + INTERVAL '1 month'
WHERE type IS NULL;

-- Make required columns NOT NULL after populating defaults
ALTER TABLE referral_rewards
ALTER COLUMN type SET NOT NULL,
ALTER COLUMN month SET NOT NULL,
ALTER COLUMN status SET NOT NULL,
ALTER COLUMN billing_period_start SET NOT NULL,
ALTER COLUMN billing_period_end SET NOT NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS referral_rewards_referrer_idx ON referral_rewards(referrer_id);
CREATE INDEX IF NOT EXISTS referral_rewards_referred_idx ON referral_rewards(referred_id);
CREATE INDEX IF NOT EXISTS referral_rewards_status_idx ON referral_rewards(status);
CREATE INDEX IF NOT EXISTS referral_rewards_subscription_idx ON referral_rewards(subscription_id);

-- Add comment describing the new commission model
COMMENT ON TABLE referral_rewards IS 'Tracks referral rewards: $15 bonus after month 1, 30% recurring commission for months 2-9';
COMMENT ON COLUMN referral_rewards.type IS 'Type of reward: first_month_bonus or recurring_commission';
COMMENT ON COLUMN referral_rewards.month IS 'Subscription month (1-9)';
COMMENT ON COLUMN referral_rewards.status IS 'Payment status: pending, paid, or failed';
