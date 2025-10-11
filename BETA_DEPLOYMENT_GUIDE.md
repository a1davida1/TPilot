# 🚀 Beta Deployment Guide

## Pre-Deployment Checklist

### 1️⃣ Environment Setup
```bash
# 1. Copy and configure environment
cp .env.example.complete .env
# Edit .env with your production values

# 2. Validate environment configuration
npm run validate:env

# 3. Run database migrations
npm run db:migrate:prod
```

### 2️⃣ Required Services Setup

#### Sentry (Error Tracking) - CRITICAL
1. Sign up at https://sentry.io (free tier: 5K errors/month)
2. Create new project: "ThottoPilot Beta"
3. Get DSN from Settings > Client Keys
4. Set `SENTRY_DSN` in .env

#### Imgur (Image Storage) - REQUIRED
1. Register app at https://api.imgur.com/oauth2/addclient
2. Get Client ID and Secret
3. Set `IMGUR_CLIENT_ID` and `IMGUR_CLIENT_SECRET`

#### Reddit API - REQUIRED
1. Create app at https://www.reddit.com/prefs/apps
2. Type: "web app"
3. Redirect URI: `https://yourdomain.com/api/reddit/callback`
4. Set `REDDIT_CLIENT_ID` and `REDDIT_CLIENT_SECRET`

#### Stripe (Payments) - REQUIRED
1. Get test keys from https://dashboard.stripe.com/test/apikeys
2. Create products and prices
3. Set webhook endpoint: `https://yourdomain.com/webhook/stripe`
4. Set all `STRIPE_*` variables

#### OpenRouter (AI) - REQUIRED
1. Get API key from https://openrouter.ai/keys
2. Set `OPENROUTER_API_KEY`

### 3️⃣ Deployment Steps

#### Option A: Deploy to Render.com (Recommended)
```bash
# 1. Build the application
npm run build

# 2. Create render.yaml (if not exists)
cat > render.yaml << EOF
services:
  - type: web
    name: thottopilot-beta
    runtime: node
    buildCommand: npm install && npm run build
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: DATABASE_URL
        fromDatabase:
          name: thottopilot-db
          property: connectionString
    healthCheckPath: /health

databases:
  - name: thottopilot-db
    plan: starter
    ipAllowList: []
EOF

# 3. Deploy
# Connect GitHub repo to Render
# Render will auto-deploy on push
```

#### Option B: Deploy to Railway (Alternative)
```bash
# 1. Install Railway CLI
npm install -g @railway/cli

# 2. Login and init
railway login
railway init

# 3. Add PostgreSQL
railway add postgresql

# 4. Deploy
railway up
```

#### Option C: VPS Deployment (Advanced)
```bash
# On your VPS (Ubuntu/Debian)
# 1. Install dependencies
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs postgresql nginx certbot

# 2. Clone and setup
git clone https://github.com/yourusername/thottopilot.git
cd thottopilot
npm install
npm run build

# 3. Setup PostgreSQL
sudo -u postgres createdb thottopilot
sudo -u postgres psql -c "CREATE USER thottopilot WITH PASSWORD 'your-password';"
sudo -u postgres psql -c "GRANT ALL ON DATABASE thottopilot TO thottopilot;"

# 4. Run migrations
DATABASE_URL=postgresql://thottopilot:your-password@localhost/thottopilot npm run db:migrate:prod

# 5. Setup PM2
npm install -g pm2
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# 6. Setup Nginx
sudo nano /etc/nginx/sites-available/thottopilot
# Add configuration (see below)
sudo ln -s /etc/nginx/sites-available/thottopilot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# 7. Setup SSL
sudo certbot --nginx -d yourdomain.com
```

### 4️⃣ Post-Deployment Validation

```bash
# 1. Run smoke tests
npm run smoke:test

# 2. Check health endpoints
curl https://yourdomain.com/health
curl https://yourdomain.com/health/ready
curl https://yourdomain.com/health/detailed

# 3. Test critical flows
# - User registration
# - Login/logout
# - Caption generation
# - Image upload to Imgur
# - Scheduled post creation
# - Feedback submission

# 4. Monitor logs
pm2 logs # if using PM2
# or check your hosting provider's logs
```

### 5️⃣ Monitoring Setup

#### Application Monitoring
1. **Sentry** - Errors tracked automatically
2. **Health Checks** - Monitor `/health/detailed`
3. **Metrics** - Prometheus-compatible at `/metrics`

#### Setup Uptime Monitoring
- UptimeRobot: https://uptimerobot.com (free)
- Better Uptime: https://betteruptime.com
- Pingdom: https://www.pingdom.com

Configure monitors for:
- `https://yourdomain.com/health` (1 min interval)
- `https://yourdomain.com/api/health/ready` (5 min interval)

#### Database Backup
```bash
# Setup daily automated backups
npm run db:backup

# Or use managed database backups from your provider
```

### 6️⃣ Beta User Onboarding

#### Create Admin Account
```bash
# Set admin credentials in .env
ADMIN_EMAIL=admin@yourdomain.com
ADMIN_PASSWORD=secure-admin-password

# The admin account will be created automatically on first run
```

#### Beta Access Control
1. Set up invite codes (optional)
2. Manually approve beta users
3. Monitor usage via admin panel at `/admin`

### 7️⃣ Common Issues & Solutions

#### Issue: "Cannot connect to database"
```bash
# Check DATABASE_URL format
# Should be: postgresql://user:pass@host:5432/dbname

# Test connection
psql $DATABASE_URL -c "SELECT 1"
```

#### Issue: "Sentry not receiving errors"
```bash
# Verify DSN is set
echo $SENTRY_DSN

# Test Sentry
npm run test:sentry
```

#### Issue: "Imgur uploads failing"
```bash
# Check rate limits
curl -H "Authorization: Client-ID $IMGUR_CLIENT_ID" \
  https://api.imgur.com/3/credits
```

#### Issue: "Scheduled posts not running"
```bash
# Check cron manager status
curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://yourdomain.com/api/admin/cron-status

# Restart workers
pm2 restart all
```

### 8️⃣ Performance Optimization

```bash
# 1. Enable Redis for sessions/caching
apt-get install redis
# Set REDIS_URL in .env

# 2. Enable CDN for static assets
# Use Cloudflare or similar

# 3. Database indexes (already included in migrations)
npm run db:optimize

# 4. Monitor performance
# Check response times in /metrics endpoint
```

### 9️⃣ Security Checklist

- [ ] All secrets are 32+ characters
- [ ] HTTPS enabled with valid SSL cert
- [ ] Rate limiting configured
- [ ] CORS properly restricted
- [ ] Database using SSL connection
- [ ] Admin panel protected
- [ ] Backups automated
- [ ] Monitoring alerts configured

### 🎯 Launch Checklist

Before inviting beta users:
1. ✅ All environment variables set
2. ✅ Smoke tests passing
3. ✅ Health checks green
4. ✅ Sentry receiving test error
5. ✅ Database backed up
6. ✅ Admin account works
7. ✅ Test user can complete full flow
8. ✅ Monitoring configured
9. ✅ Support email ready
10. ✅ Terms of Service and Privacy Policy live

## Support

For deployment issues:
- Check logs: `pm2 logs` or hosting provider logs
- Run diagnostics: `npm run smoke:test`
- Validate environment: `npm run validate:env`

## Rollback Plan

If issues arise:
```bash
# 1. Backup current database
npm run db:backup

# 2. Revert to previous version
git checkout <previous-tag>
npm install
npm run build

# 3. Restore database if needed
psql $DATABASE_URL < backup.sql

# 4. Restart services
pm2 restart all
```

---

**Ready to launch?** Run `npm run smoke:test` one final time! 🚀
