# ThottoPilot Troubleshooting Guide
*Common issues and solutions*

## 🔴 Critical Issues

### Production: "Cannot find module 'vite'"

**Symptoms:**
- Render deployment fails
- Error: "Cannot find module 'vite'"
- Build succeeds but app won't start

**Cause:** App tries to load Vite in production mode

**Solution:**
```bash
# Add to Render environment variables:
RENDER=true
NODE_ENV=production
```

### Database: Authentication Failed (Error 28000)

**Symptoms:**
- PostgreSQL connection fails
- Error code 28000
- Direct psql works but Node.js app fails

**Cause:** Missing SSL configuration for Render database

**Solution:**
- Remove `?ssl=true` from DATABASE_URL
- Code auto-detects Render and adds SSL
- Correct format: `postgresql://user:pass@host.render.com/db`

### Auth: All Users Logged Out / Can't Login

**Symptoms:**
- Authentication completely broken
- Even admin can't login
- No error in logs

**Cause:** Database schema change without migration

**Solution:**
```bash
# Emergency fix:
1. Rollback code to last working version
2. Create proper migration: npx drizzle-kit generate
3. Run migration: npx drizzle-kit push
4. Deploy code with migration
```

**Prevention:**
Always run migrations BEFORE deploying schema changes!

---

## 🟡 Common Issues

### TypeScript: "Property does not exist"

**Example:**
```typescript
Property 'imgurUploads' does not exist on type 'schema'
```

**Solution:**
Check if table exists in `/shared/schema.ts`. If not, either:
1. Create the table definition
2. Remove references to non-existent table

### React Query: "Query key must be an array"

**Bad:**
```typescript
useQuery('/api/endpoint')
```

**Good:**
```typescript
useQuery({ queryKey: ['/api/endpoint'] })
```

### Wouter: Route not working

**Check:**
1. Is route defined in `/client/src/App.tsx`?
2. Using `<Route path="/exact-path" component={Component} />`?
3. Not using React Router syntax by mistake?

### Bull Queue: Jobs stuck in "active"

**Solution:**
```bash
# Open queue dashboard
npm run queue:ui

# Navigate to http://localhost:3000/admin/queues
# Click "Clean" to remove stuck jobs
```

### Imgur: Token expired error

**Symptoms:**
- "Imgur token expired. Please reconnect"
- Upload fails

**Solution (Auto-fix):**
- Token refresh is now automatic
- Just retry the upload
- If still fails: Reconnect Imgur account in settings

**Manual fix:**
```typescript
// Token refresh implemented in /client/src/lib/imgur-upload.ts
// Auto-refreshes on expiry using refresh token
```

---

## 🟢 Development Issues

### Hot Reload Not Working

**Solutions:**
```bash
# Kill all node processes
pkill -f node

# Clear cache
rm -rf node_modules/.vite
rm -rf dist

# Restart
npm run dev
```

### ESLint Errors After Pull

**Solution:**
```bash
# Re-install dependencies
rm -rf node_modules package-lock.json
npm install

# Run lint fix
npm run lint -- --fix
```

### Build Succeeds but Runtime Errors

**Check:**
1. All environment variables set?
2. Database migrations applied?
3. Redis/Valkey running for queue?
4. Check browser console for errors

### TypeScript Errors in IDE but Build Works

**Solution:**
```bash
# Restart TypeScript server in VS Code
CMD/CTRL + Shift + P -> "TypeScript: Restart TS Server"

# Or restart IDE
```

---

## 🔧 Specific Feature Issues

### Caption Generation Not Working

**Check:**
1. `OPENROUTER_API_KEY` set in .env?
2. Account has credits? Visit https://openrouter.ai/credits
3. Check server logs for API errors
4. Try different model in settings

**Debug:**
```bash
# Server logs show:
tail -f logs/app.log | grep openrouter
```

### Reddit Posting Fails

**Common causes:**
1. **Rate limit** - Wait 10 minutes between posts
2. **No Reddit auth** - Connect Reddit account first
3. **Subreddit rules** - Check if you're allowed to post
4. **Image not on Imgur** - Must use Reddit-compatible host

**Debug:**
```typescript
// Check Reddit token in DB
SELECT reddit_access_token FROM users WHERE id = YOUR_USER_ID;

// Refresh Reddit auth if token expired
```

### Scheduled Posts Not Posting

**Check:**
1. Redis/Valkey running? `redis-cli ping` should return "PONG"
2. Queue worker running? Check logs for "Scheduler worker started"
3. Job in database? Check `scheduled_posts` table
4. Future time? Can't schedule in the past

**Debug:**
```bash
# Check Redis/Valkey
redis-cli
> KEYS *

# Check Bull queue
npm run queue:ui
```

### Analytics Not Loading

**Check:**
1. User tier has analytics access? (Pro/Premium only)
2. Has user posted anything? Need data to show
3. Check API endpoint: `GET /api/analytics?days=7`

**Debug:**
```bash
# Check if data exists
psql $DATABASE_URL
SELECT COUNT(*) FROM reddit_post_outcomes WHERE user_id = YOUR_ID;
```

---

## 🐛 Debugging Techniques

### Enable Debug Logging

```typescript
// In any file
import { logger } from '@/bootstrap/logger';
logger.debug('Debug info', { data: value });
```

### Check API Responses

```bash
# Use curl with auth
curl -H "Authorization: Bearer $TOKEN" \
  http://localhost:5000/api/endpoint
```

### Database Queries

```bash
# Open Drizzle Studio
npx drizzle-kit studio

# Or use psql
psql $DATABASE_URL
```

### Network Tab

Open browser DevTools -> Network tab
- Check API calls
- Look for 401 (auth), 403 (tier), 500 (server) errors
- Inspect request/response payloads

---

## 📊 Performance Issues

### Slow API Responses

**Check:**
1. Database indexes exist?
2. N+1 query problem?
3. Missing pagination?
4. Redis/Valkey cache being used?

**Solution:**
```sql
-- Add index
CREATE INDEX idx_posts_user_id ON reddit_post_outcomes(user_id);

-- Check slow queries
SELECT * FROM pg_stat_statements ORDER BY mean_exec_time DESC;
```

### High Memory Usage

**Check:**
1. Memory leaks in queue workers?
2. Too many concurrent jobs?
3. Large image uploads?

**Solution:**
```bash
# Limit queue concurrency
# In /server/jobs/scheduler.ts
queue.process('schedule-post', 5, processJob); // Max 5 concurrent
```

### Frontend Slow to Load

**Check:**
1. Bundle size too large? Run `npm run build` and check dist/
2. Too many re-renders?
3. Missing React.memo() on expensive components?

**Solution:**
```bash
# Analyze bundle
npx vite-bundle-visualizer

# Check for large dependencies
npm ls --depth=0 | sort
```

---

## 🔐 Security Issues

### CORS Errors

**Symptoms:**
- "CORS policy blocked"
- API calls fail from frontend

**Solution:**
Already configured in `/server/routes.ts`:
```typescript
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true
}));
```

Check CLIENT_URL environment variable is set correctly.

### JWT Token Invalid

**Symptoms:**
- "Invalid token" errors
- User logged out unexpectedly

**Solutions:**
1. Check `JWT_SECRET` hasn't changed
2. Verify token not expired (24h default)
3. Clear localStorage and re-login

### Rate Limiting

**Symptoms:**
- "Too many requests" error
- 429 status code

**Solution:**
Rate limits are per-tier:
- Free: 100 requests/15min
- Starter: 500 requests/15min  
- Pro+: 2000 requests/15min

Wait or upgrade tier.

---

## 📝 Data Issues

### Duplicate Posts in Database

**Cause:** Queue job retried after failure

**Solution:**
```sql
-- Find duplicates
SELECT subreddit, title, COUNT(*) 
FROM reddit_post_outcomes 
GROUP BY subreddit, title 
HAVING COUNT(*) > 1;

-- Delete duplicates (keep newest)
DELETE FROM reddit_post_outcomes 
WHERE id NOT IN (
  SELECT MAX(id) FROM reddit_post_outcomes 
  GROUP BY subreddit, title
);
```

### Missing User Data After Upgrade

**Cause:** Migration didn't backfill data

**Solution:**
```sql
-- Backfill default values
UPDATE users SET tier = 'free' WHERE tier IS NULL;
UPDATE users SET created_at = NOW() WHERE created_at IS NULL;
```

---

## 🆘 Emergency Procedures

### Production Down - Quick Recovery

```bash
# 1. Check Render logs
# Visit: https://dashboard.render.com

# 2. Rollback deployment
git revert HEAD
git push

# 3. Check database connectivity
psql $DATABASE_URL -c "SELECT 1"

# 4. Restart services
# Click "Manual Deploy" in Render dashboard
```

### Database Corruption

```bash
# 1. Stop all connections
# 2. Restore from latest backup
pg_restore -d thottopilot latest.dump

# 3. Verify data
psql thottopilot -c "SELECT COUNT(*) FROM users"

# 4. Restart app
```

### Queue System Down

```bash
# 1. Check Redis/Valkey
redis-cli ping

# 2. Clear failed jobs
redis-cli FLUSHDB

# 3. Restart queue worker
# Will auto-restart on next deploy
```

---

## 📞 Getting Help

1. **Check logs first:**
   - Server: `tail -f logs/app.log`
   - Render: Dashboard -> Logs tab
   - Browser: DevTools Console

2. **Search documentation:**
   - `/AI_ASSISTANT_GUIDE.md`
   - `/docs/PLATFORM_OVERVIEW.md`
   - This file

3. **Check existing issues:**
   - `/docs/HIDDEN_GAPS_AUDIT.md`
   - Search codebase for TODO comments

4. **Still stuck?**
   - Document the issue clearly
   - Include error messages
   - List steps to reproduce
   - Note environment (dev/prod)

---

**Last Updated:** October 29, 2025  
**Maintained By:** Development Team
