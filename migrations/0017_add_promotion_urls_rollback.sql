-- ROLLBACK: Remove OnlyFans and Fansly URL fields from user_preferences
-- Use this to revert migration 0017_add_promotion_urls.sql

ALTER TABLE "user_preferences" DROP COLUMN IF EXISTS "only_fans_url";
ALTER TABLE "user_preferences" DROP COLUMN IF EXISTS "fansly_url";
