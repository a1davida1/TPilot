# ThottoPilot - Rolling TODO List

## Active Sprint - Beta Prep

### 🔴 Critical - Blocking Beta Launch
*Items that must be completed before beta*

- [ ] Complete remaining 25 lint warnings (see Lint Cleanup section below)
- [ ] Harden OAuth/Auth Flows (see BETA_READINESS.md #4)

### 🟡 High Priority - Post-Beta Quick Wins
*Should be tackled immediately after beta launch*

### 🟢 Medium Priority - Technical Debt
*Important but not blocking*

### ⚪ Low Priority - Nice to Have
*Improvements for future consideration*

---

## Incomplete Features Discovered During Lint Cleanup

### 1. Wire Up formatAllowance/formatBoolean Helpers
**File**: `client/src/components/reddit-communities.tsx`  
**Status**: Helpers defined but not used  
**Description**: Replace inline switch statements in expanded row details (lines 482-491) with the helper functions for consistency.
```typescript
// Current: inline switch in expanded rows
// Should use: _formatAllowance(community.rules?.sellingAllowed)
```
**Effort**: 30 min  
**Priority**: 🟢 Medium

### 2. Implement Pro Perks Commission Calculator
**File**: `server/routes.ts`  
**Status**: Complete function exists but never called  
**Description**: `_deriveSharePercentage` is a fully implemented helper that extracts and validates commission percentages from perk data. Need to integrate into pro perks endpoints.
```typescript
// Function exists at line 770
// Needs: Integration into /api/pro-perks routes
```
**Effort**: 1-2 hours  
**Priority**: 🟢 Medium

### 3. Complete Personalization Feature
**File**: `server/services/reddit-intelligence.ts`  
**Status**: Infrastructure exists, logic incomplete  
**Description**: 
- `_optInPersonalized` flag is calculated but not used
- `_userCommunities` parameters exist in `computeSubredditHealth` and `buildForecastingSignals` but aren't used for personalization
- Need to implement user-specific trending/health scoring
**Effort**: 4-6 hours  
**Priority**: 🟡 High

### 4. Perk-Specific Referral Codes
**File**: `server/pro-perks.ts`  
**Status**: Generic implementation, signature suggests specific  
**Description**: `generateReferralCode` accepts `perkId` parameter but generates generic user codes. Should generate perk-specific codes for tracking attribution.
```typescript
// Current: returns generic user referral code
// Should: generate unique code per user+perk combination
```
**Effort**: 2-3 hours  
**Priority**: 🟢 Medium

---

## Lint Cleanup Status

### Summary
- **Starting**: 55 warnings (1 error)
- **Current**: 25 warnings (0 errors)
- **Progress**: 54% reduction ✅

### Remaining 25 Warnings

#### Type Safety Issues (9 warnings)
**Need proper type definitions instead of `any`:**

1. `server/lib/gemini-client.ts` (5 warnings)
   - API response shapes need interfaces
   - Candidate/part iteration types

2. `server/lib/openrouter-client.ts` (1 warning)
   - Message array type at line 72

3. `server/lib/workers/metrics-worker.ts` (2 warnings)
   - Error object types at lines 117, 120

4. `server/routes.ts` (3 warnings)
   - Request body types at lines 738, 743, 1067

5. `server/social-auth-config.ts` (1 warning)
   - Profile object type at line 161

6. `server/storage.ts` (1 warning)
   - JSON column type at line 373

**Effort**: 4-6 hours total  
**Priority**: 🔴 Critical (TypeScript strict mode requirement)

#### Non-Null Assertions (11 warnings)
**Need guard clauses or defaults instead of `!`:**

1. `server/lib/pricing.ts` (3 warnings)
   - Stripe price IDs from env variables (lines 15-17)
   - **Fix**: Add env validation on startup

2. `server/lib/workers/dunning-worker.ts` (1 warning)
   - Line 150

3. `server/routes/webhooks.stripe.ts` (1 warning)
   - Stripe webhook secret (line 16)
   - **Fix**: Add env validation on startup

4. `server/scripts/sync-subreddit-rules.ts` (5 warnings)
   - Reddit credentials (lines 112, 138, 191-193)
   - **Fix**: Add proper error handling if creds missing

5. `server/services/analytics-service.ts` (1 warning)
   - Line 259

**Effort**: 2-3 hours total  
**Priority**: 🔴 Critical (Required for TypeScript strict mode)

#### Documentation Types (1 warning)
- `client/src/components/__tests__/image-gallery.test.tsx`
  - `FetchReturn` type defined but unused
  - **Action**: Keep for documentation (acceptable)

---

## Completed ✅

- [x] Update BETA_READINESS.md checklist owners to Dave
- [x] Investigate and categorize all 55 lint warnings
- [x] Fix all unused variable/caught error warnings
- [x] Remove genuinely dead code
- [x] Preserve incomplete features with `_` prefix

---

## Notes

### Security & Dependencies

**Snoowrap Vulnerabilities (13 warnings) - ACCEPTED RISK**
- **Status**: Keep snoowrap despite npm audit warnings
- **Rationale**: 
  - Most mature Reddit API client with comprehensive features
  - Vulnerabilities are in nested dependencies (`form-data`, `ws`, `tough-cookie` via deprecated `request` package)
  - Attack vector requires compromising Reddit's servers first
  - Not exploitable in our use case (server-side API calls only)
  - Alternatives (reddit-api-client, raw fetch) are significantly worse
- **Real risk**: Negligible - not user-facing, not directly exploitable
- **Action**: Monitor for maintained alternatives, but don't replace unless critical vulnerability discovered
- **Last reviewed**: 2025-10-07

**Node Version Requirement**
- **Required**: Node 20+ (multiple dependencies require it)
- **Current local**: v18.19.1 (needs upgrade)
- **Railway/Production**: Should use Node 20 LTS
- **Action**: Update local Node to v20 before next development session

### Lint Philosophy
- **Prefix with `_`**: Variables/functions that are intentionally unused (incomplete features, future use)
- **Remove entirely**: Truly dead code with no purpose
- **Keep as-is**: Type definitions, documentation

### Beta Launch Blockers
Per BETA_READINESS.md, focusing on:
1. OAuth/Auth hardening
2. Type safety completion
3. Environment variable validation

---

**Last Updated**: 2025-10-07  
**Next Review**: After beta launch
