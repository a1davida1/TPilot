# Reddit OAuth Production Fix

## Problem
After clicking "Connect Reddit" and authorizing on reddit.com, users are redirected to a 404 page, even though the account shows as connected.

## Root Causes Identified

### 1. CSRF Protection Blocking `/api/reddit/callback`
**Fixed in:** `server/app.ts` line 313

The CSRF middleware was only exempting the old passport flow callback (`/api/auth/reddit/callback`) but not the new secure callback (`/api/reddit/callback`).

### 2. Production Environment Variable Mismatch
Your production environment needs the correct `REDDIT_REDIRECT_URI` setting.

## Fixes Applied

### ✅ Fix #1: CSRF Exemption (Code Fixed)
Added `/api/reddit/callback` to the CSRF exemption list in `server/app.ts`.

### 🔧 Fix #2: Production Environment Configuration

#### Step 1: Check Your Reddit App Settings
1. Go to https://www.reddit.com/prefs/apps
2. Find your ThottoPilot app
3. Verify the **redirect URI** shows:
   ```
   https://YOUR-PRODUCTION-DOMAIN.com/api/reddit/callback
   ```
4. If it shows anything else (like `/auth/reddit/callback`), **update it** to the correct path

#### Step 2: Update Production Environment Variables

On your production hosting platform (Replit/Railway/Vercel/etc), ensure:

```bash
# Production .env (REQUIRED)
REDDIT_REDIRECT_URI=https://YOUR-PRODUCTION-DOMAIN.com/api/reddit/callback

# Example for thottopilot.com:
REDDIT_REDIRECT_URI=https://thottopilot.com/api/reddit/callback
```

**IMPORTANT:** 
- The domain in `REDDIT_REDIRECT_URI` MUST match your actual production domain
- It MUST match EXACTLY what's configured in your Reddit app settings
- It MUST use `https://` (not `http://`) in production
- It MUST use `/api/reddit/callback` (not `/auth/reddit/callback`)

#### Step 3: Restart Production Server
After updating environment variables, restart your production server for changes to take effect.

### 🔍 For Local Development Testing

If you want to test Reddit OAuth locally:

1. Add to your local `.env`:
   ```bash
   REDDIT_REDIRECT_URI=http://localhost:5000/api/reddit/callback
   ```

2. Update your Reddit app on reddit.com to include BOTH:
   - `https://thottopilot.com/api/reddit/callback` (production)
   - `http://localhost:5000/api/reddit/callback` (development)

3. Restart your local server

## Verification

### Run the Diagnostic Script
```bash
node scripts/check-reddit-config.js
```

This will show:
- Current `REDDIT_REDIRECT_URI` setting
- Fallback configuration
- What should be configured

### Test the Flow
1. Click "Connect Reddit" in your app
2. Authorize on reddit.com
3. You should be redirected back to:
   - `/dashboard?reddit=connected&username=...` (for account-link intent)
   - `/reddit?reddit=connected&username=...` (for posting intent)
   - `/phase4?reddit=connected&username=...` (for intelligence intent)
4. Account should show as connected

## Architecture Overview

### Current Flow (Correct)
```
Frontend → /api/reddit/connect?intent=posting
         ← { authUrl: "https://reddit.com/authorize?redirect_uri=..." }

User → reddit.com (authorizes)
     ← reddit.com redirects to: /api/reddit/callback?code=...&state=...

Backend → Validates state, exchanges code for tokens
        → Stores encrypted tokens in database
        ← Redirects to: /dashboard or /reddit (with success params)
```

### Old Flow (Legacy, Still Supported)
```
Frontend → /api/auth/reddit
User → reddit.com (authorizes)
     ← reddit.com redirects to: /api/auth/reddit/callback

Backend → Passport.js handles authentication
        ← Sets session cookie and redirects to /dashboard
```

## Key Files Modified
- ✅ `server/app.ts` - Added CSRF exemption for `/api/reddit/callback`
- ✅ `scripts/check-reddit-config.js` - Created diagnostic tool

## Troubleshooting

### Still Getting 404?
1. Check browser console for errors
2. Check server logs: `tail -f logs/combined-*.log | grep -i reddit`
3. Verify the exact 404 URL in your browser address bar
4. Check production logs for the `Reddit OAuth redirect URI` message

### Account Shows Connected But Got 404?
This is the symptom described - it means:
- The callback route WAS reached and processed successfully
- Tokens were saved to the database
- But the final redirect to `/dashboard` or `/reddit` showed 404

**Possible causes:**
- Frontend routing issue (unlikely - routes exist in App.tsx)
- Query parameters causing routing confusion
- Server restart needed after env var change

### Common Mistakes
❌ Using `http://` in production redirect URI
❌ Using `/auth/reddit/callback` instead of `/api/reddit/callback`
❌ Mismatch between Reddit app settings and REDDIT_REDIRECT_URI
❌ Forgetting to restart server after changing .env

## Security Notes
- State tokens are stored in Redis (if available) or PostgreSQL
- State tokens expire after 10 minutes
- State tokens can only be used once (deleted after use)
- Access and refresh tokens are encrypted before storage
- IP addresses are logged for security auditing

## Need Help?
Run the diagnostic: `node scripts/check-reddit-config.js`
Check logs: `tail -f logs/combined-*.log | grep -i reddit`
