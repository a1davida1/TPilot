# Migration 0017: Add Promotion URLs

**Created:** October 19, 2025  
**Status:** Ready to Apply  
**Type:** Schema Change (ALTER TABLE)

## Overview

Adds support for promotional URL fields in user preferences, enabling users to configure OnlyFans and Fansly URLs for use in AI-generated caption CTAs with explicit promotion mode.

## Schema Changes

### Tables Modified
- `user_preferences`

### Columns Added

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `only_fans_url` | varchar(255) | YES | NULL | User's OnlyFans profile URL |
| `fansly_url` | varchar(255) | YES | NULL | User's Fansly profile URL |

### Comments Added
- `only_fans_url`: "User OnlyFans URL for explicit promotional captions (format: onlyfans.com/username)"
- `fansly_url`: "User Fansly URL for explicit promotional captions (format: fansly.com/username)"

## Dependencies

### Backend Changes Required
✅ **Already Implemented:**
- Schema updated in `/shared/schema.ts`
- API routes updated (`/server/routes/caption.ts`)
- Pipeline updated (`/server/caption/openrouterPipeline.ts`)
- Prompts updated (`/prompts/nsfw-variants.txt`, `/prompts/variants.txt`)

### Frontend Changes Required
⚠️ **TODO:**
- Add settings page fields for OnlyFans/Fansly URLs
- Add promotion mode toggle to caption generator UI
- Wire up API calls with `promotionMode` parameter

## How to Apply

### Option 1: Using the Helper Script (Recommended)
```bash
./scripts/apply-0017-promotion-urls.sh
```

### Option 2: Manual psql
```bash
export DATABASE_URL="postgresql://user:pass@host:port/dbname"
psql "$DATABASE_URL" -f migrations/0017_add_promotion_urls.sql
```

### Option 3: Using Drizzle Kit
```bash
npm run db:push
```

## Verification

### Check if migration applied successfully:
```bash
psql "$DATABASE_URL" -f migrations/0017_verify.sql
```

### Expected Output:
```
 column_name    | data_type         | character_maximum_length | is_nullable | column_default 
----------------+-------------------+--------------------------+-------------+----------------
 fansly_url     | character varying | 255                      | YES         | 
 only_fans_url  | character varying | 255                      | YES         | 
```

## Rollback

If you need to revert this migration:

```bash
psql "$DATABASE_URL" -f migrations/0017_add_promotion_urls_rollback.sql
```

**Warning:** Rollback will delete any stored URLs. Backup data if needed.

## Testing

### 1. Database Level
```sql
-- Insert test data
UPDATE user_preferences 
SET only_fans_url = 'onlyfans.com/testuser'
WHERE user_id = 1;

-- Verify
SELECT user_id, only_fans_url, fansly_url 
FROM user_preferences 
WHERE only_fans_url IS NOT NULL;
```

### 2. API Level
```bash
# Test caption generation with explicit promotion
curl -X POST http://localhost:5000/api/caption/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "imageUrl": "https://example.com/image.jpg",
    "platform": "instagram",
    "voice": "seductive_goddess",
    "nsfw": true,
    "promotionMode": "explicit"
  }'
```

### 3. Expected Behavior

**promotionMode: "none"**
- CTA: "wanna see more?"

**promotionMode: "subtle"**
- CTA: "check my profile", "hit me up for more"

**promotionMode: "explicit"** (with URL set)
- CTA: "see more on my onlyfans: onlyfans.com/username"

## Feature Usage

Once migration is applied and frontend is implemented:

1. **User sets URL in Settings:**
   - Navigate to `/settings`
   - Add OnlyFans URL: `onlyfans.com/username`
   - Save preferences

2. **Generate caption with promotion:**
   - Go to caption generator
   - Select "Explicit Promotion" mode
   - Generate caption
   - AI includes URL in CTA

## Related Files

- Migration: `/migrations/0017_add_promotion_urls.sql`
- Rollback: `/migrations/0017_add_promotion_urls_rollback.sql`
- Verification: `/migrations/0017_verify.sql`
- Schema: `/shared/schema.ts`
- API Routes: `/server/routes/caption.ts`
- Pipeline: `/server/caption/openrouterPipeline.ts`
- Prompts: `/prompts/nsfw-variants.txt`, `/prompts/variants.txt`

## Notes

- URLs are stored as plain text (no encryption needed - public URLs)
- NULL values are allowed (optional feature)
- No indexes needed (low query frequency)
- API fetches URL from preferences when `promotionMode='explicit'`
- URL validation should be added in frontend/API layer
