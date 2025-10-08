# Database Migration from Replit to Local/New Host

## Step 1: Export from Replit Database

### A. Using pg_dump (Recommended)

**In Replit Shell:**
```bash
# Get your DATABASE_URL from Replit secrets
# Format: postgresql://user:pass@host:port/database

# Full database dump (schema + data)
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d_%H%M%S).sql

# Download the file from Replit
# Option 1: Use the Files panel (right-click > Download)
# Option 2: Use curl to upload to temporary storage
```

### B. Alternative: Neon/Postgres.app Method

If you're using Neon on Replit:
```bash
# Neon provides a connection string, use it directly
pg_dump "postgresql://user:pass@ep-xxx.us-east-2.aws.neon.tech/neondb" > backup.sql
```

### C. Schema Only (if you want fresh data)
```bash
pg_dump --schema-only $DATABASE_URL > schema.sql
```

---

## Step 2: Set Up New Database

### Option A: Local PostgreSQL

**Install PostgreSQL:**
```bash
# Ubuntu/Debian
sudo apt update
sudo apt install postgresql postgresql-contrib

# macOS
brew install postgresql@15
brew services start postgresql@15

# Arch
sudo pacman -S postgresql
sudo systemctl start postgresql
```

**Create Database:**
```bash
# Switch to postgres user
sudo -u postgres psql

# In psql:
CREATE DATABASE thottopilot;
CREATE USER thottopilot_user WITH PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE thottopilot TO thottopilot_user;
\q
```

**Your DATABASE_URL:**
```
postgresql://thottopilot_user:your_secure_password@localhost:5432/thottopilot
```

### Option B: Neon (Serverless PostgreSQL - Recommended for Development)

1. Go to https://neon.tech
2. Sign up (free tier: 10GB storage)
3. Create new project "ThottoPilot"
4. Copy connection string: `postgresql://user:pass@ep-xxx.neon.tech/dbname`

**Advantages:**
- Free tier sufficient for development
- No local install needed
- Easy to share with team
- Automatic backups
- Good for Windsurf/cloud development

### Option C: Railway (If deploying there)

1. Go to https://railway.app
2. Create new project
3. Add PostgreSQL plugin
4. Copy connection string from variables

---

## Step 3: Import Data

### A. Restore Full Dump

```bash
# Set your new DATABASE_URL
export NEW_DATABASE_URL="postgresql://user:pass@host:port/database"

# Restore
psql $NEW_DATABASE_URL < backup_YYYYMMDD_HHMMSS.sql
```

### B. If You Get Errors

**Common issues:**
```bash
# Error: role "xxx" does not exist
# Fix: Create the role first
psql $NEW_DATABASE_URL -c "CREATE ROLE xxx;"

# Error: database "xxx" already exists
# This is fine, continue

# Error: permission denied
# Fix: Grant ownership
psql $NEW_DATABASE_URL -c "ALTER DATABASE thottopilot OWNER TO your_user;"
```

### C. Restore Schema Only (then run Drizzle push)

```bash
# Restore just the schema
psql $NEW_DATABASE_URL < schema.sql

# OR use Drizzle to create tables
npm run db:push
```

---

## Step 4: Verify Migration

```bash
# Connect to new database
psql $NEW_DATABASE_URL

# Check tables exist
\dt

# Check row counts
SELECT 'users' as table_name, COUNT(*) FROM users
UNION ALL
SELECT 'content_generations', COUNT(*) FROM content_generations
UNION ALL
SELECT 'creator_accounts', COUNT(*) FROM creator_accounts
UNION ALL
SELECT 'reddit_communities', COUNT(*) FROM reddit_communities;

# Exit
\q
```

---

## Step 5: Update Environment Variables

### Local Development (.env)

```bash
# Create .env file
cp .env.example .env

# Edit .env
DATABASE_URL=postgresql://user:pass@host:port/database

# Test connection
npm run db:studio
# Opens Drizzle Studio on http://localhost:4983
```

### Production Deployment

**Railway:**
```bash
# In Railway dashboard
# Environment > Add Variable
DATABASE_URL=${{ Postgres.DATABASE_URL }}
```

**Render:**
```bash
# In Render dashboard
# Environment > Add Variable
DATABASE_URL=[your connection string]
```

---

## Step 6: Data Validation

**Run this script to check data integrity:**

```typescript
// scripts/validate-migration.ts
import { db } from './server/db';
import { users, contentGenerations, creatorAccounts, redditCommunities } from '@shared/schema';
import { sql } from 'drizzle-orm';

async function validateMigration() {
  console.log('🔍 Validating database migration...\n');
  
  // Check users
  const userCount = await db.select({ count: sql<number>`count(*)` }).from(users);
  console.log(`✅ Users: ${userCount[0].count}`);
  
  // Check content generations
  const genCount = await db.select({ count: sql<number>`count(*)` }).from(contentGenerations);
  console.log(`✅ Content Generations: ${genCount[0].count}`);
  
  // Check Reddit accounts
  const accountCount = await db.select({ count: sql<number>`count(*)` }).from(creatorAccounts);
  console.log(`✅ Creator Accounts: ${accountCount[0].count}`);
  
  // Check Reddit communities
  const commCount = await db.select({ count: sql<number>`count(*)` }).from(redditCommunities);
  console.log(`✅ Reddit Communities: ${commCount[0].count}`);
  
  // Check for null/invalid data
  const usersWithoutEmail = await db.select({ count: sql<number>`count(*)` })
    .from(users)
    .where(sql`email IS NULL`);
  if (usersWithoutEmail[0].count > 0) {
    console.warn(`⚠️  ${usersWithoutEmail[0].count} users without email`);
  }
  
  console.log('\n✅ Migration validation complete!');
}

validateMigration().catch(console.error);
```

**Run it:**
```bash
npx tsx scripts/validate-migration.ts
```

---

## Troubleshooting

### Issue: "Connection refused"

**Check connection string format:**
```bash
# Should be:
postgresql://username:password@host:port/database

# NOT:
postgres://... (some tools use 'postgres' instead of 'postgresql')
```

### Issue: "SSL connection required"

**Add SSL parameters:**
```bash
# For Neon, Railway, etc.
DATABASE_URL=postgresql://user:pass@host:port/db?sslmode=require

# Or
DATABASE_URL=postgresql://user:pass@host:port/db?ssl=true
```

### Issue: "Too many connections"

**Use connection pooling:**
```typescript
// server/db.ts
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';

const sql = neon(process.env.DATABASE_URL!, {
  poolQueryViaFetch: true, // Connection pooling
});

export const db = drizzle(sql);
```

### Issue: Slow queries after migration

**Re-index database:**
```sql
-- Connect to database
psql $DATABASE_URL

-- Reindex all tables
REINDEX DATABASE thottopilot;

-- Analyze tables for query planner
ANALYZE;
```

---

## Migration Checklist

- [ ] Export Replit database (pg_dump)
- [ ] Set up new database (Neon/Local/Railway)
- [ ] Restore backup to new database
- [ ] Verify table counts match
- [ ] Update .env with new DATABASE_URL
- [ ] Run `npm run db:studio` to verify
- [ ] Run validation script
- [ ] Test application login/signup
- [ ] Test content generation
- [ ] Test Reddit OAuth flow
- [ ] Check uploaded media still accessible
- [ ] Update production environment variables
- [ ] Keep Replit backup for 30 days (safety)

---

## Pro Tips

### 1. Keep Replit as Staging

Don't delete your Replit deployment immediately:
- Use it as staging environment
- Test migrations there first
- Keep it running during transition

### 2. Incremental Migration

For large databases:
```bash
# Migrate in chunks
pg_dump --table=users $REPLIT_DB > users.sql
pg_dump --table=content_generations $REPLIT_DB > content.sql
# ... etc

# Restore separately
psql $NEW_DB < users.sql
psql $NEW_DB < content.sql
```

### 3. Zero-Downtime Migration

```bash
# 1. Set up new database
# 2. Restore backup to new database
# 3. Run both databases in parallel
# 4. Use read replica pattern:
#    - Reads from new database
#    - Writes to both databases
# 5. After 24h, switch fully to new database
# 6. Decomission old database after 7 days
```

### 4. Automated Backups

**Set up daily backups:**
```bash
# Create backup script
cat > backup.sh << 'EOF'
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
pg_dump $DATABASE_URL > backups/backup_$DATE.sql
# Keep last 7 days only
find backups/ -name "backup_*.sql" -mtime +7 -delete
EOF

chmod +x backup.sh

# Add to crontab (daily at 2am)
crontab -e
# Add line:
0 2 * * * /path/to/backup.sh
```

---

## Quick Start (TL;DR)

**Fastest path from Replit to Local:**

```bash
# 1. In Replit shell
pg_dump $DATABASE_URL > backup.sql
# Download backup.sql from Replit

# 2. On your machine
sudo apt install postgresql
sudo -u postgres createdb thottopilot
psql postgresql://postgres@localhost/thottopilot < backup.sql

# 3. Update .env
echo "DATABASE_URL=postgresql://postgres@localhost/thottopilot" >> .env

# 4. Test
npm run db:studio
```

Done! 🎉

---

*Migration guide generated: October 7, 2025*
