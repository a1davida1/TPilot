# Deployment Checklist - Preventing Database Errors

## Why Database Errors Happen
The "is feature_flags created or renamed" error occurs when:
1. **Schema Drift**: Your code schema (shared/schema.ts) doesn't match the actual database
2. **Incomplete Migrations**: Previous deployments didn't fully sync the schema
3. **Manual Database Changes**: Someone modified the database directly without updating code

## Pre-Deployment Database Checklist

### 1. Before ANY Deployment
Run the database sync script:
```bash
./scripts/db-sync.sh
```

### 2. Critical Rules for feature_flags Table
- **Primary Key**: Uses `varchar("key")` NOT `serial("id")` - NEVER change this
- **Required Columns**: key, enabled, threshold, meta, updatedAt
- **No Manual SQL**: Never run ALTER TABLE commands directly

### 3. Safe Schema Change Process
When modifying any table:
```bash
# 1. Edit schema in shared/schema.ts
# 2. Run sync to apply changes
npx drizzle-kit push --force

# 3. Verify changes applied
npx tsx -e "
import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
sql\`SELECT * FROM feature_flags LIMIT 1\`.then(console.log);
"
```

### 4. Emergency Recovery
If deployment fails with database errors:
```bash
# Force sync to fix schema mismatches
npx drizzle-kit push --force

# Verify all tables exist
npx tsx -e "
import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.DATABASE_URL);
Promise.all([
  sql\`SELECT COUNT(*) as count FROM feature_flags\`,
  sql\`SELECT COUNT(*) as count FROM users\`,
  sql\`SELECT COUNT(*) as count FROM queue_jobs\`
]).then(results => {
  console.log('Table checks:', results);
});
"
```

## Prevention Strategies

### 1. Always Use Drizzle Commands
- ✅ `npx drizzle-kit push` - Safe schema sync
- ✅ `npx drizzle-kit push --force` - Force sync when needed
- ❌ Never use raw SQL for schema changes

### 2. Schema Definition Best Practices
```typescript
// CORRECT - feature_flags table
export const featureFlags = pgTable("feature_flags", {
  key: varchar("key", { length: 100 }).primaryKey(), // String primary key
  enabled: boolean("enabled").default(true).notNull(),
  threshold: integer("threshold"),
  meta: jsonb("meta"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// NEVER change primary key types!
// If it's varchar, keep it varchar
// If it's serial, keep it serial
```

### 3. Deployment Order
1. **Local Testing**: Test schema changes locally first
2. **Sync Script**: Run `./scripts/db-sync.sh` before deploying
3. **Deploy**: Only deploy after successful sync
4. **Verify**: Check application logs for database errors

## Common Pitfalls to Avoid

### ❌ DON'T
- Change primary key types (serial ↔ varchar)
- Run manual ALTER TABLE commands
- Deploy without checking schema sync
- Ignore migration warnings

### ✅ DO
- Keep primary key types consistent
- Use Drizzle Kit for all schema changes
- Run sync script before deployments
- Test schema changes locally first

## Quick Reference Commands

```bash
# Check current schema
npx drizzle-kit studio

# Sync schema (safe)
npx drizzle-kit push

# Force sync (when safe fails)
npx drizzle-kit push --force

# Run sync script
./scripts/db-sync.sh

# Verify specific table
npx tsx -e "import {neon} from '@neondatabase/serverless'; const sql=neon(process.env.DATABASE_URL); sql\`SELECT * FROM feature_flags\`.then(console.log);"
```

## When to Use Force Sync
Use `--force` flag ONLY when:
1. You're certain the schema in code is correct
2. Regular push fails with conflicts
3. You've backed up any important data
4. You understand data loss risks

Remember: The feature_flags table stores configuration - losing data here can affect feature availability!