# Replit Deployment Guide for ThottoPilot

## ⚠️ CRITICAL: Database Setup

### You CANNOT use local PostgreSQL on Replit
- **Why:** Replit can't access your local machine's database
- **Solution:** Keep using Neon database on Replit

## Pre-Deployment Checklist

### 1. Environment Variables on Replit
Make sure your Replit `.env` has:
```env
# Database (Keep your Neon URL!)
DATABASE_URL=postgresql://[your-neon-connection-string]

# Queue System (IMPORTANT!)
USE_PG_QUEUE=true

# OpenRouter
OPENROUTER_API_KEY=your_key
OPENROUTER_MODEL=x-ai/grok-4-fast

# Session
SESSION_SECRET=your_32_char_secret

# Imgur
IMGUR_CLIENT_ID=your_imgur_id
IMGUR_CLIENT_SECRET=your_imgur_secret

# Admin Account
ADMIN_EMAIL=admin@thottopilot.com
ADMIN_PASSWORD_HASH=your_bcrypt_hash
```

### 2. Run Database Migrations on Replit

**In Replit Shell:**
```bash
# Generate migration files
npm run db:generate

# Run migrations
npm run db:migrate

# Verify tables exist
npm run db:check
```

### 3. Update package.json start script
```json
{
  "scripts": {
    "start": "npm run db:migrate && NODE_ENV=production tsx server/index.ts"
  }
}
```

### 4. Verify Deployment
```bash
# Check health endpoint
curl https://your-replit-url.repl.co/api/health

# Check ready status
curl https://your-replit-url.repl.co/api/ready
```

## Common Issues & Solutions

### Issue: "Database connection failed"
**Solution:** Check DATABASE_URL is correct Neon URL

### Issue: "Table does not exist"
**Solution:** Run `npm run db:migrate` in Replit shell

### Issue: "Redis connection failed"
**Solution:** Ensure `USE_PG_QUEUE=true` is set

### Issue: "CSRF token invalid"
**Solution:** Already fixed - Imgur uploads exempt from CSRF

## Deployment Steps

1. **Commit your changes locally**
```bash
git add .
git commit -m "Fix CSRF and Redis issues"
git push origin main
```

2. **Pull changes on Replit**
```bash
git pull origin main
```

3. **Install dependencies**
```bash
npm install
```

4. **Run migrations**
```bash
npm run db:migrate
```

5. **Restart the Replit**
Click the "Stop" then "Run" button

## Post-Deployment Verification

1. **Check logs**
   - Should see: `[OpenRouter] Default model: x-ai/grok-4-fast`
   - Should see: `Using PostgreSQL queue backend`
   - Should NOT see Redis connection errors

2. **Test upload**
   - Go to `/caption-generator`
   - Try uploading an image
   - Should work without CSRF errors

3. **Test login**
   - Use admin credentials
   - Should login successfully

## DO NOT FORGET

⚠️ **Your local database and Replit database are SEPARATE!**
- Changes to local DB don't sync to Replit
- Always run migrations on both
- Keep Neon for Replit, local for development
