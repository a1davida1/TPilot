# ThottoPilot Beta Launch Readiness Checklist
**Status**: In Progress  
**Target Launch**: TBD  
**Last Updated**: October 8, 2025

---

## 🎯 Executive Summary

12-step roadmap to production-ready beta launch. Prioritized by risk and user impact.

**Current Progress**: 6/12 Complete (50%)

---

## ✅ Phase 1: Core Infrastructure (Complete)

### 1. ✅ Security Hardening
**Status**: COMPLETE  
**Completed**: Oct 8, 2025

**What Was Done**:
- ✅ XSS vulnerability audit (0 critical issues)
- ✅ CSP hardening (removed 'unsafe-eval')
- ✅ JWT Bearer token implementation
- ✅ CSRF exemption for Bearer tokens
- ✅ Refresh token system with rotation
- ✅ Token versioning for instant revocation

**Evidence**: 
- `docs/SECURITY_AUDIT_2025-10-08.md`
- `docs/AUTH_MIGRATION_PLAN.md`

**Metrics**:
- Security Score: 11/12 (Strong)
- Auth latency: <5ms (was 10-50ms)
- XSS attack surface: Minimal

---

### 2. ✅ Authentication System
**Status**: COMPLETE  
**Completed**: Oct 8, 2025

**What Was Done**:
- ✅ JWT access tokens (1h expiry)
- ✅ Refresh tokens in httpOnly cookies (7d)
- ✅ Auto-refresh on token expiry
- ✅ Multi-tab logout sync
- ✅ OAuth flows (Google, Facebook, Reddit) validated

**Testing Needed**:
- [ ] Load test: 100 concurrent logins
- [ ] Stress test: Token refresh under load
- [ ] Security: Penetration test for auth bypass

**Acceptance Criteria**:
- Login success rate > 99%
- Token refresh < 200ms p95
- Zero session fixation vulnerabilities

---

## 🔄 Phase 2: Core Features Validation (In Progress)

### 3. ⚠️ Content Generation Pipeline
**Status**: NEEDS VALIDATION  
**Priority**: P0 (Blocking)

**Critical Path**:
- [ ] **Test AI caption generation** (OpenRouter/Gemini)
  - Verify API keys work in production
  - Test fallback when primary fails
  - Measure latency (target: <5s for captions)
  
- [ ] **Image processing pipeline**
  - Upload to S3/CDN working
  - Watermarking applies correctly
  - Thumbnails generate properly
  
- [ ] **Rate limiting enforcement**
  - Free tier: 5 generations/day
  - Starter: 50 generations/day
  - Pro: Unlimited

**How to Test**:
```bash
# Run end-to-end test
npm run test:e2e -- --grep "content generation"

# Manual test
1. Upload image
2. Generate caption
3. Verify watermark
4. Check rate limit enforcement
```

**Acceptance Criteria**:
- Caption generation success rate > 95%
- Fallback to secondary AI works
- Rate limits prevent abuse

**Estimated Time**: 2-3 hours

---

### 4. ⚠️ Reddit Integration
**Status**: NEEDS VALIDATION  
**Priority**: P0 (Blocking)

**Critical Features**:
- [ ] **OAuth flow** (connect Reddit account)
- [ ] **Posting to subreddits** (with rules validation)
- [ ] **Subreddit recommendations**
- [ ] **Post rate limiting** (1 post/subreddit/24h)

**Known Issues**:
- ⚠️ `snoowrap` dependency vulnerabilities (not blocking, see Phase 10)

**How to Test**:
```bash
# Integration test
npm run test -- reddit-routes.test.ts

# Manual test
1. Connect Reddit account
2. Select subreddit with posting rules
3. Generate content + schedule post
4. Verify post appears on Reddit
5. Test rate limit (try posting twice)
```

**Acceptance Criteria**:
- Reddit OAuth success rate > 98%
- Post delivery < 30s
- Rules validation prevents rejections
- Rate limits enforced server-side

**Estimated Time**: 3-4 hours

---

### 5. ⚠️ Payment Processing (Stripe)
**Status**: NEEDS CONFIGURATION  
**Priority**: P1 (High)

**Required Setup**:
- [ ] **Add to `.env`**: `STRIPE_API_VERSION=2024-06-20`
- [ ] **Test Stripe webhooks** in development
  - Use Stripe CLI: `stripe listen --forward-to localhost:5000/api/webhooks/stripe`
- [ ] **Verify subscription upgrades** (Free → Starter → Pro)
- [ ] **Test cancellation flow**

**Edge Cases to Test**:
- Failed payment (card declined)
- Subscription downgrade (Pro → Free)
- Expired card auto-retry
- Webhook replay attack prevention

**How to Test**:
```bash
# Use Stripe test cards
4242 4242 4242 4242 (success)
4000 0000 0000 0002 (decline)

# Test webhook
stripe trigger checkout.session.completed
```

**Acceptance Criteria**:
- Checkout success rate > 99%
- Webhooks processed < 5s
- Subscription state synced with database
- Cancellation refunds correctly

**Estimated Time**: 2 hours

---

### 6. ⚠️ Email Delivery
**Status**: NEEDS CONFIGURATION  
**Priority**: P1 (High)

**Critical Emails**:
- [ ] **Email verification** (signup)
- [ ] **Password reset**
- [ ] **Subscription confirmations**
- [ ] **Usage limit warnings** (80%, 100%)

**Required**:
- Set `RESEND_API_KEY` or `SENDGRID_API_KEY` in `.env`
- Configure `FROM_EMAIL` (e.g., `noreply@thottopilot.com`)
- Add SPF/DKIM records to DNS

**How to Test**:
```bash
# Test email verification
1. Sign up with real email
2. Check inbox for verification link
3. Click link, verify account activates

# Test password reset
1. Click "Forgot Password"
2. Enter email
3. Verify reset link works
```

**Acceptance Criteria**:
- Email delivery rate > 98%
- Delivery time < 30s
- No spam filter issues
- Links work reliably

**Estimated Time**: 1-2 hours

---

## 🚀 Phase 3: Performance & Scalability

### 7. ⚠️ Database Performance
**Status**: NEEDS OPTIMIZATION  
**Priority**: P2 (Medium)

**Tasks**:
- [ ] **Add missing indexes**
  ```sql
  -- Check slow queries
  SELECT * FROM pg_stat_statements 
  ORDER BY mean_exec_time DESC LIMIT 10;
  
  -- Add indexes if needed
  CREATE INDEX IF NOT EXISTS idx_posts_user_created 
    ON posts(user_id, created_at DESC);
  ```

- [ ] **Connection pooling** (already using Neon - verify config)
- [ ] **Query optimization** (N+1 prevention)
- [ ] **Caching strategy** (Redis for session + hot data)

**How to Test**:
```bash
# Load test
npm run test:load -- --users 50 --duration 60s

# Monitor slow queries in production
```

**Acceptance Criteria**:
- P95 query time < 100ms
- Connection pool never exhausts
- No N+1 query patterns

**Estimated Time**: 3-4 hours

---

### 8. ⚠️ CDN & Media Delivery
**Status**: NEEDS VALIDATION  
**Priority**: P2 (Medium)

**Tasks**:
- [ ] **Verify S3 bucket configuration**
  - Public read access for media
  - CORS configured for uploads
  - Lifecycle policy (delete after 30d for temp files)

- [ ] **CDN setup** (CloudFront or similar)
  - Cache images for 1 year
  - Signed URLs for watermarked content

- [ ] **Upload flow testing**
  - Test 10MB image upload
  - Verify watermark applies
  - Check CDN caching

**How to Test**:
```bash
# Upload test
1. Upload large image (5-10MB)
2. Verify upload completes < 30s
3. Check image loads from CDN
4. Verify cache headers (Cache-Control: max-age=31536000)
```

**Acceptance Criteria**:
- Upload success rate > 99%
- CDN cache hit rate > 90%
- Image load time < 500ms (global)

**Estimated Time**: 2 hours

---

## 🎨 Phase 4: User Experience

### 9. ⚠️ Error Handling & Recovery
**Status**: NEEDS IMPROVEMENT  
**Priority**: P1 (High)

**Tasks**:
- [ ] **Graceful degradation**
  - AI service down → show fallback message
  - Reddit down → queue posts for retry
  - Payment down → allow manual retry

- [ ] **User-friendly error messages**
  ```tsx
  // Bad:  "Error: ECONNREFUSED 127.0.0.1:5000"
  // Good: "We're having trouble connecting. Please try again."
  ```

- [ ] **Retry logic for transient failures**
  - Network errors: 3 retries with exponential backoff
  - Rate limits: Queue and retry after cooldown

- [ ] **Error logging & monitoring**
  - Set up Sentry (already installed, needs DSN)
  - Log critical errors to database
  - Alert on error rate spikes (>5%)

**How to Test**:
```bash
# Simulate failures
1. Kill AI service → verify graceful fallback
2. Exceed rate limit → verify clear message
3. Submit invalid form → verify field-level errors
```

**Acceptance Criteria**:
- No cryptic error messages visible to users
- Critical flows have retry logic
- Error rate < 1% in production

**Estimated Time**: 3-4 hours

---

### 10. ⚠️ Mobile Responsiveness
**Status**: NEEDS TESTING  
**Priority**: P2 (Medium)

**Devices to Test**:
- [ ] iPhone (Safari, Chrome)
- [ ] Android (Chrome)
- [ ] iPad (Safari)
- [ ] Small screens (320px width)

**Critical Flows**:
- [ ] Login/signup
- [ ] Upload image
- [ ] Generate caption
- [ ] Schedule post
- [ ] Payment checkout

**Common Issues**:
- Touch targets too small (<44px)
- Horizontal scroll on mobile
- Fixed positioning breaks keyboard
- Safari cookie issues (SameSite)

**How to Test**:
```bash
# Chrome DevTools
1. Open DevTools (F12)
2. Toggle device toolbar (Ctrl+Shift+M)
3. Test each viewport size
4. Check touch interactions
```

**Acceptance Criteria**:
- All features work on mobile
- No horizontal scroll
- Touch targets min 44px
- Lighthouse mobile score > 80

**Estimated Time**: 2-3 hours

---

## 🔒 Phase 5: Production Hardening

### 11. ⚠️ Monitoring & Alerting
**Status**: NEEDS SETUP  
**Priority**: P1 (High)

**Required Monitoring**:
- [ ] **Application metrics**
  - Request rate, error rate, latency
  - Auth success/failure rate
  - Content generation queue depth

- [ ] **Infrastructure metrics**
  - CPU, memory, disk usage
  - Database connections
  - Redis memory usage

- [ ] **Business metrics**
  - Signups/day
  - Conversion rate (free → paid)
  - Daily active users

**Tools to Set Up**:
- [ ] **Sentry** (error tracking)
  - Add `SENTRY_DSN` to `.env`
  - Configure error sampling (100% for beta)

- [ ] **Prometheus + Grafana** (metrics)
  - Or use Replit monitoring if available

- [ ] **Uptime monitoring**
  - UptimeRobot or similar
  - Alert if site down > 2 minutes

**Alerts to Configure**:
- 🚨 **Critical**: Site down, auth broken, payments failing
- ⚠️ **Warning**: Error rate >5%, slow responses >2s p95
- 📊 **Info**: Daily stats, weekly reports

**Acceptance Criteria**:
- All critical metrics tracked
- Alerts fire within 2 minutes
- Dashboard accessible 24/7

**Estimated Time**: 3-4 hours

---

### 12. ⚠️ Dependency Security
**Status**: NEEDS RESOLUTION  
**Priority**: P3 (Low - post-beta)

**Known Vulnerabilities** (from npm audit):
- `snoowrap` → `form-data` < 2.5.4 (Critical)
- `snoowrap` → `tough-cookie` < 4.1.3 (Moderate)
- `snoowrap` → `ws` 2.1.0-5.2.3 (High)

**Options**:
1. **Wait for upstream fix** (recommended for beta)
   - Monitor https://github.com/not-an-aardvark/snoowrap/issues
   - Set reminder to check monthly

2. **Migrate to different Reddit library**
   - Research alternatives (e.g., `snoots`, custom implementation)
   - Estimated: 8-10 hours

3. **Accept risk** (documented)
   - Vulnerabilities not in critical auth flow
   - Create security exception document

**Decision**: Wait for upstream fix, revisit post-beta

**Estimated Time**: 0 hours (monitor only)

---

## 📊 Beta Launch Checklist

### Pre-Launch (T-7 days)

- [ ] **Load testing**
  - 100 concurrent users
  - Peak: 500 requests/minute
  - Verify no crashes

- [ ] **Security audit**
  - Run OWASP ZAP scan
  - Verify no exposed secrets
  - Check auth bypass attempts

- [ ] **Backup strategy**
  - Database: Neon automatic backups (verify)
  - Media: S3 versioning enabled
  - Code: Git tags for rollback

### Launch Day (T-0)

- [ ] **Deploy to production**
  - Merge to `main` branch
  - Replit auto-deploys
  - Verify health checks pass

- [ ] **Smoke tests**
  - Test signup flow
  - Test content generation
  - Test payment checkout
  - Test Reddit posting

- [ ] **Monitoring dashboard**
  - Open dashboard
  - Watch for errors
  - Monitor response times

### Post-Launch (T+1 week)

- [ ] **User feedback collection**
  - Add feedback button
  - Monitor support emails
  - Track feature requests

- [ ] **Performance review**
  - Analyze slow queries
  - Check error patterns
  - Optimize hot paths

- [ ] **Iterate on issues**
  - Fix critical bugs within 24h
  - Address top 3 user complaints
  - Plan feature roadmap

---

## 🎯 Success Metrics

**Beta success criteria** (first 30 days):
- ✅ **Stability**: Uptime > 99.5%
- ✅ **Performance**: P95 response time < 2s
- ✅ **Security**: Zero security incidents
- ✅ **Growth**: 100+ signups
- ✅ **Engagement**: 50+ active users
- ✅ **Revenue**: 10+ paid conversions

**Red flags** (trigger investigation):
- 🚨 Uptime < 95%
- 🚨 Error rate > 5%
- 🚨 Zero signups in 48h
- 🚨 Payment failure rate > 10%
- 🚨 Security vulnerability disclosed

---

## 📋 Summary

| Phase | Tasks | Complete | Priority | Time Est. |
|-------|-------|----------|----------|-----------|
| 1. Infrastructure | 2 | 2/2 ✅ | P0 | 0h |
| 2. Features | 4 | 0/4 ⚠️ | P0-P1 | 9-11h |
| 3. Performance | 2 | 0/2 ⚠️ | P2 | 5-6h |
| 4. UX | 2 | 0/2 ⚠️ | P1-P2 | 5-7h |
| 5. Production | 2 | 0/2 ⚠️ | P1-P3 | 3-4h |
| **Total** | **12** | **2/12** | - | **22-28h** |

**Estimated time to beta-ready**: 3-4 days of focused work

---

## 🚀 Quick Start: Next Actions

**Today** (4-6 hours):
1. [ ] Test content generation pipeline (Step 3)
2. [ ] Test Reddit integration (Step 4)
3. [ ] Configure Stripe API version (Step 5)

**Tomorrow** (4-6 hours):
4. [ ] Set up email delivery (Step 6)
5. [ ] Test payment flows (Step 5)
6. [ ] Error handling improvements (Step 9)

**Day 3** (4-6 hours):
7. [ ] Database optimization (Step 7)
8. [ ] Mobile testing (Step 10)
9. [ ] Monitoring setup (Step 11)

**Day 4** (2-4 hours):
10. [ ] CDN validation (Step 8)
11. [ ] Final smoke tests
12. [ ] Launch! 🚀

---

## 📞 Support & Resources

**Documentation**:
- `docs/AUTH_MIGRATION_PLAN.md` - Auth system details
- `docs/SECURITY_AUDIT_2025-10-08.md` - Security review
- `README.md` - Setup instructions

**Key Commands**:
```bash
npm run dev:full        # Local development
npm run test            # Run tests
npm run typecheck       # TypeScript validation
npm run build           # Production build
```

**Emergency Contacts**:
- Production DB: Neon dashboard
- Hosting: Replit dashboard
- Payment issues: Stripe dashboard
- Email issues: Resend/SendGrid dashboard

---

**Last Updated**: October 8, 2025  
**Owner**: Development Team  
**Review Cadence**: Weekly until launch, then monthly
