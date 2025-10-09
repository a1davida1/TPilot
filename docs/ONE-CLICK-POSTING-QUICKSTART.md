# One-Click Posting Quick Start Guide

Get the complete ImageShield + Grok4 Caption + Reddit Posting workflow running in 10 minutes.

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL database
- OpenRouter API key
- Reddit OAuth app credentials
- (Optional) Imgur OAuth app credentials for scheduling

---

## 1. Environment Setup (2 minutes)

Add to your `.env` file:

```env
# OpenRouter (required for captions)
OPENROUTER_API_KEY=sk-or-v1-your_key_here
APP_BASE_URL=http://localhost:5000

# Reddit OAuth (should already exist)
REDDIT_CLIENT_ID=your_reddit_client_id
REDDIT_CLIENT_SECRET=your_reddit_secret
REDDIT_REDIRECT_URI=http://localhost:5000/auth/reddit/callback

# Imgur OAuth (optional; for scheduling only)
VITE_IMGUR_CLIENT_ID=your_imgur_client_id
```

### Get API Keys

**OpenRouter** (required):
1. Go to https://openrouter.ai
2. Sign up and navigate to Keys
3. Create new API key
4. Copy to `OPENROUTER_API_KEY`

**Imgur** (optional):
1. Go to https://api.imgur.com/oauth2/addclient
2. Register application (OAuth 2 without callback URL)
3. Copy Client ID to `VITE_IMGUR_CLIENT_ID`

---

## 2. Database Migration (1 minute)

Run the caption analytics migration:

```bash
# If using psql directly
psql -U your_user -d thottopilot < server/db/migrations/013_caption_analytics.sql

# Or if using your migration tool
npm run migrate
```

This creates 6 tables and 3 views for analytics.

---

## 3. Build & Start (2 minutes)

```bash
# Install dependencies (if not already done)
npm install

# Build client and server
npm run build

# Start development server
npm run dev
```

Server should start on `http://localhost:5000`

---

## 4. Connect Reddit Account (1 minute)

1. Navigate to `/settings` or wherever your Reddit OAuth is
2. Click "Connect Reddit"
3. Authorize the app
4. Confirm connection successful

---

## 5. Test One-Click Posting (2 minutes)

### Option A: Use the One-Click Wizard Component

Add to your posting page (e.g., `/reddit-posting`):

```tsx
import { OneClickPostWizard } from '@/components/one-click-post-wizard';

function RedditPostingPage() {
  return (
    <div className="container mx-auto py-8">
      <OneClickPostWizard />
    </div>
  );
}
```

### Option B: Test API Endpoints Directly

**Generate captions:**
```bash
# 1. Protect an image client-side, get base64 preview
# 2. Call caption API
curl -X POST http://localhost:5000/api/caption/one-click-captions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "image_base64": "BASE64_STRING_HERE"
  }'
```

**Get subreddit recommendations:**
```bash
curl -X POST http://localhost:5000/api/subreddit-recommender \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "category": "general",
    "tags": ["amateur"],
    "nsfw": true
  }'
```

**Lint a caption:**
```bash
curl -X POST http://localhost:5000/api/subreddit-lint \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "subreddit": "gonewild",
    "title": "Feeling cute today",
    "nsfw": true
  }'
```

---

## 6. Test the Complete Flow (2 minutes)

1. **Upload Image**
   - Go to your one-click posting page
   - Select an image (NSFW test image)
   - Click "Start One-Click Post"

2. **Watch Progress**
   - Protecting image... (2–3s)
   - Generating captions... (2–4s)
   - Choose your caption (6s auto-select or manual pick)

3. **Review Recommendations**
   - See recommended subreddit with reason
   - Note warnings if any rule violations

4. **Post**
   - Confirm caption selection
   - Wait for Reddit upload (2–4s)
   - Get success screen with post URL

**Total time: 8–12 seconds**

---

## Common Issues & Fixes

### "OPENROUTER_API_KEY not configured"
- Check `.env` file has the key
- Restart server after adding env vars
- Verify key starts with `sk-or-v1-`

### "Reddit not connected"
- Complete Reddit OAuth flow first
- Check `localStorage` has `reddit_access_token`
- Token may have expired; reconnect

### "Quality degraded below threshold"
- Original image may be corrupted
- Try different image format (prefer JPEG)
- Check browser console for WASM errors

### "Failed to generate captions"
- Verify OpenRouter API key is valid
- Check network request in browser DevTools
- Fallback to Claude should trigger automatically

### Caption generation is slow
- Grok4 Fast typically responds in 2–4s
- Slow network may delay response
- OpenRouter rate limits may apply

### Images not uploading to Reddit
- Verify Reddit OAuth scope includes `submit`
- Check Reddit API limits (posting frequency)
- Ensure subreddit allows image posts

---

## Testing Scheduled Posts (Optional)

If you want to test the scheduling feature:

### 1. Connect Imgur (1 minute)

```tsx
import { startImgurOAuth } from '@/lib/imgur-upload';

// Add button to trigger OAuth
<Button onClick={startImgurOAuth}>
  Connect Imgur
</Button>
```

### 2. Get Optimal Times

```bash
curl -X POST http://localhost:5000/api/scheduled-posts/optimal-times \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "subreddit": "gonewild",
    "daysAhead": 7
  }'
```

### 3. Schedule a Post

```bash
curl -X POST http://localhost:5000/api/scheduled-posts \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN" \
  -d '{
    "subreddit": "gonewild",
    "title": "Your caption here",
    "imageUrl": "https://i.imgur.com/abc123.jpg",
    "nsfw": true,
    "scheduledFor": "2025-10-09T20:00:00Z"
  }'
```

**Note**: Scheduled post *execution* requires a cron worker (Phase 4). For now, posts are stored but won't auto-post.

---

## Feature Checklist

After setup, verify these work:

- [ ] Upload image and see preview
- [ ] ImageShield protection completes (check metrics)
- [ ] Two captions generated (Flirty + Slutty)
- [ ] Subreddit recommendation shows
- [ ] Caption picker responds to keyboard (1/2/Enter)
- [ ] Edit caption inline
- [ ] Rule linting shows warnings
- [ ] Post uploads to Reddit successfully
- [ ] Success screen shows post URL
- [ ] Analytics events fire (check browser console)
- [ ] Imgur OAuth completes (if testing scheduling)
- [ ] Optimal times API returns 10 slots

---

## Performance Expectations

| Step | Expected Time | Acceptable Range |
|------|---------------|------------------|
| Image upload | <500ms | Instant |
| ImageShield (Medium, 1080p) | 2.0s | 1.5–3.0s |
| Caption generation | 3.0s | 2–4s |
| Subreddit recommendation | 50ms | <100ms |
| Rule linting | 20ms | <50ms |
| Reddit upload | 3.0s | 2–5s |
| **Total one-click** | **9s** | **8–12s** |

If any step exceeds the acceptable range:
- Check network latency
- Verify browser supports OffscreenCanvas
- Monitor OpenRouter API status
- Check Reddit API limits

---

## Next Steps

Once basic flow works:

1. **Add to existing posting page** - Import `OneClickPostWizard` component
2. **Customize styles** - Match your UI theme
3. **Add subreddit presets** - Popular subs for quick selection
4. **Enable analytics dashboard** - Visualize caption performance
5. **Implement cron worker** - Execute scheduled posts (Phase 4)
6. **Add multi-image support** - Gallery posts
7. **Enable personalization** - Learn user's preferred caption style

---

## Documentation

- **Research & Design**: `docs/imageshield-implementation-research.md`
- **Phase 1 Details**: `docs/PHASE1-IMPLEMENTATION-SUMMARY.md`
- **Phase 2 & 3 Details**: `docs/PHASE2-PHASE3-IMPLEMENTATION-SUMMARY.md`
- **Full Integration Guide**: `docs/one-click-posting-integration.md`

---

## Support

If you encounter issues:

1. Check browser console for errors
2. Verify all environment variables are set
3. Review server logs for API errors
4. Check OpenRouter dashboard for quota/limits
5. Test individual API endpoints with curl
6. Verify database migration ran successfully

---

**🎉 You're ready to go! Upload an image and try the one-click flow.**

**Estimated time from zero to first successful post: 10–15 minutes**
