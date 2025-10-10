# Disaster Recovery Runbook
**Last Updated**: October 9, 2025  
**Owner**: Development Team  
**Verified**: [VERIFY: Run `bash scripts/verify-database-backup.sh`]

---

## ⚡ Quick Reference

**Verify Backups**: `bash scripts/verify-database-backup.sh`  
**Neon Console**: https://console.neon.tech/  
**Create Recovery Branch**: Neon Console → Branches → New Branch → From Timestamp  
**Expected Recovery Time**: <1 hour  
**Expected Data Loss**: <7 days (typically <24 hours)

---

## 🚨 Emergency Contacts

- **Database**: Neon PostgreSQL (https://console.neon.tech/)
- **Storage**: AWS S3
- **Email**: SendGrid
- **Payments**: Stripe
- **Hosting**: Replit

---

## 📊 Backup Status

### **Database (Neon PostgreSQL)**
- **Provider**: Neon (https://console.neon.tech/)
- **Automatic Backups**: ✅ Yes (Point-in-Time Recovery)
- **Frequency**: Continuous (WAL archiving + periodic snapshots)
- **Retention**: 7 days (Free tier) / 30 days (Paid tier)
- **Last Verified**: [VERIFY NOW: Run `bash scripts/verify-database-backup.sh`]
- **Storage**: Neon's encrypted backup infrastructure
- **Recovery Method**: Branch-based restoration or point-in-time recovery

### **Application Files (Git)**
- **Provider**: GitHub
- **Repository**: https://github.com/a1davida1/TPilot
- **Latest Commit**: Check `git log -1`
- **Branches**: `main` (production)

### **Environment Variables**
- **Backup Location**: [FILL IN: 1Password/Bitwarden/etc]
- **Last Updated**: [FILL IN: Date]
- **Files**: `.env` (production secrets)

### **Media Files (S3)**
- **Provider**: AWS S3
- **Bucket**: [FILL IN: Your bucket name]
- **Versioning**: [FILL IN: Enabled/Disabled]
- **Lifecycle Policy**: [FILL IN: If configured]

---

## 🔄 Recovery Procedures

### **Scenario 1: Database Corruption/Loss**

**Recovery Time Objective (RTO)**: <1 hour  
**Recovery Point Objective (RPO)**: <24 hours (based on backup frequency)

#### **Steps to Restore Database:**

1. **Access Neon Console**:
   ```bash
   # Navigate to: https://console.neon.tech/
   # Login with your credentials
   ```

2. **Locate Backup**:
   ```
   - Go to your project
   - Navigate to "Backups" or "Branches" tab
   - Find the most recent backup before corruption
   - Note the timestamp
   ```

3. **Restore Options**:

   **Option A: Point-in-Time Recovery (Neon)**
   ```
   1. In Neon console, select "Restore" or "Create Branch from backup"
   2. Choose restore point (timestamp)
   3. Create new branch or restore to main
   4. Update DATABASE_URL in Replit secrets
   5. Restart application
   ```

   **Option B: Branch-Based Recovery**
   ```
   1. Create new branch from last known good backup
   2. Get connection string for new branch
   3. Update DATABASE_URL in production .env
   4. Deploy application
   5. Verify data integrity
   ```

4. **Verify Restoration**:
   ```sql
   -- Connect to restored database
   -- Verify critical tables
   SELECT COUNT(*) FROM users;
   SELECT COUNT(*) FROM creator_accounts;
   SELECT COUNT(*) FROM content_generations;
   
   -- Check recent data
   SELECT * FROM users ORDER BY created_at DESC LIMIT 10;
   ```

5. **Update Application**:
   ```bash
   # If using new database branch/instance:
   # 1. Update DATABASE_URL in Replit secrets
   # 2. Restart application
   # 3. Test core functionality
   ```

#### **Data Loss Assessment:**
- **Expected Loss**: Up to [BACKUP_FREQUENCY] of data
- **Critical Data**: User accounts, content generations, payments
- **Acceptable Loss**: Non-critical analytics, logs

---

### **Scenario 2: Complete Infrastructure Loss**

**What if**: Replit account compromised, GitHub access lost, etc.

#### **Recovery Steps:**

1. **Recover Source Code**:
   ```bash
   # If GitHub access intact:
   git clone https://github.com/a1davida1/TPilot.git
   
   # If GitHub lost:
   # - Restore from local dev machine
   # - Or recover from Replit workspace backup
   ```

2. **Recover Environment Variables**:
   ```bash
   # Retrieve from secure storage:
   # [FILL IN: Where you store .env backup]
   # 1Password, Bitwarden, encrypted USB drive, etc.
   
   # Required variables:
   DATABASE_URL=postgresql://...
   JWT_SECRET=...
   SESSION_SECRET=...
   STRIPE_SECRET_KEY=...
   SENDGRID_API_KEY=...
   # ... (see .env.example for full list)
   ```

3. **Restore Database** (see Scenario 1)

4. **Restore Media Files**:
   ```bash
   # S3 files should be intact
   # Verify S3 bucket access
   # Update AWS credentials if needed
   ```

5. **Redeploy Application**:
   ```bash
   # Choose new hosting provider if needed
   # Replit, Railway, Render, etc.
   
   # Deploy steps:
   1. Create new project
   2. Connect to GitHub repo
   3. Set all environment variables
   4. Deploy
   5. Test thoroughly
   ```

---

### **Scenario 3: Accidental Data Deletion**

**What if**: Ran DELETE query without WHERE clause, etc.

#### **Immediate Response:**

1. **STOP** - Don't run any more queries
2. **Isolate** - Disconnect application from database if possible
3. **Document** - Write down what was deleted and when
4. **Restore** - Follow Scenario 1 procedure

#### **Prevention:**
```sql
-- Always use transactions for destructive operations
BEGIN;
DELETE FROM users WHERE id = 123;
-- Check results first
SELECT * FROM users WHERE id = 123;
-- If correct, commit. If wrong, rollback.
COMMIT; -- or ROLLBACK;
```

---

## ✅ **Testing Protocol**

### **Quarterly Backup Test (Every 3 Months)**

**Test Date**: [FILL IN: Next test date]

**Steps:**
1. Create test branch from latest backup
2. Verify data integrity
3. Test restoration process
4. Document time taken
5. Update this runbook if process changed

**Test Checklist:**
- [ ] Can access Neon console
- [ ] Can create branch from backup
- [ ] Data integrity verified (spot checks)
- [ ] Connection strings work
- [ ] Application connects successfully
- [ ] Time to restore: __________ (target: <1 hour)

---

## 📋 **Recovery Checklist**

When disaster strikes, follow this checklist:

### **Phase 1: Assess** (5 minutes)
- [ ] Identify the problem (database, app, infrastructure?)
- [ ] Determine scope (partial or complete failure?)
- [ ] Check if data is still accessible (read-only mode?)
- [ ] Document timestamp of issue

### **Phase 2: Contain** (10 minutes)
- [ ] Disable user access if data integrity at risk
- [ ] Stop background jobs/workers
- [ ] Document current state
- [ ] Take snapshots/backups of current state (even if corrupted)

### **Phase 3: Restore** (30-45 minutes)
- [ ] Access backup systems (Neon console, S3, etc.)
- [ ] Identify restore point
- [ ] Execute restoration procedure
- [ ] Verify data integrity

### **Phase 4: Verify** (15 minutes)
- [ ] Test core user flows (signup, login, caption generation)
- [ ] Verify payment system working
- [ ] Check recent data present
- [ ] Test Reddit OAuth flow

### **Phase 5: Resume** (5 minutes)
- [ ] Re-enable user access
- [ ] Restart background workers
- [ ] Monitor for issues
- [ ] Notify users if downtime >15 minutes

### **Phase 6: Post-Mortem** (Next day)
- [ ] Document what happened
- [ ] Calculate data loss (how much, what data)
- [ ] Identify prevention measures
- [ ] Update runbook with lessons learned
- [ ] Consider increasing backup frequency

---

## 🔐 **Secrets Backup**

### **Critical Secrets to Backup:**

Create encrypted backup of `.env` file containing:
- Database connection strings
- JWT secrets
- API keys (Stripe, SendGrid, OpenRouter, etc.)
- OAuth credentials (Reddit, Google, Facebook)
- AWS credentials

### **Backup Location:**
**Primary**: [FILL IN: e.g., "1Password vault: 'ThottoPilot Production Secrets'"]  
**Secondary**: [FILL IN: e.g., "Encrypted USB drive in safe"]  
**Last Updated**: [FILL IN: Date]

### **Update Schedule:**
- After any environment variable change
- Monthly verification that backup is accessible
- When rotating secrets/keys

---

## 📞 **Emergency Decision Tree**

```
Is the database accessible?
├─ YES → Data corruption? → Use branch/PITR restore
├─ NO → Check Neon status page
    ├─ Neon outage? → Wait for resolution + monitor
    └─ Credentials issue? → Restore from secrets backup

Is the application running?
├─ YES → Database issue (see above)
├─ NO → Deployment failed?
    ├─ Recent deploy? → Rollback: git revert + redeploy
    └─ Infrastructure? → Check Replit status

Can users access the site?
├─ YES → Everything OK (monitor logs)
├─ NO → DNS issue? Hosting issue?
    └─ Check: curl https://thottopilot.com/api/health
```

---

## 🎯 **Success Criteria**

A successful disaster recovery means:
- ✅ Database restored with <24h data loss
- ✅ Application accessible within 1 hour
- ✅ All core functionality working (auth, payments, Reddit)
- ✅ User data intact (accounts, subscriptions, posts)
- ✅ No data corruption or integrity issues

---

## 📝 **Maintenance**

### **Update This Runbook When:**
- Changing database provider
- Adding new critical services
- Changing backup procedures
- After actual recovery (lessons learned)
- Quarterly review (next: [FILL IN: Date])

### **Quarterly Review Checklist:**
- [ ] Test backup restoration procedure
- [ ] Verify all secrets backups are current
- [ ] Update contact information if changed
- [ ] Review and update time estimates (RTO/RPO)
- [ ] Add any new services or dependencies

---

**Next Quarterly Review**: [FILL IN: Date 3 months from now]  
**Last Actual Recovery**: [FILL IN: None yet, or date if happened]  
**Confidence Level**: [FILL IN after testing: High/Medium/Low]
