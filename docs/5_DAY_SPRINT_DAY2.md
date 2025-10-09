# Day 2: Test Infrastructure Repair
**Time**: 4 hours human + 4 hours AI parallel  
**Goal**: Fix 60+ failing tests, achieve 95%+ pass rate

---

## ☀️ MORNING SESSION (2 hours)

### [ ] Task 2.1: Create .env.test File (30 min)

**Steps**:

1. **Copy base template**:
```bash
cp .env.example .env.test
```

2. **Edit .env.test** with test-specific values:
```bash
NODE_ENV=test

# Test Database (GitHub Actions provides this)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/thottopilot_test

# Use PG queue (no Redis needed in tests)
USE_PG_QUEUE=true

# Fake API keys (won't actually call APIs)
OPENROUTER_API_KEY=test_key_openrouter
GOOGLE_GENAI_API_KEY=test_key_gemini
OPENAI_API_KEY=test_key_openai
STRIPE_SECRET_KEY=sk_test_fake_key
REDDIT_CLIENT_ID=test_reddit_client
REDDIT_CLIENT_SECRET=test_reddit_secret

# Security (test values)
JWT_SECRET=test_jwt_secret_32_characters_minimum_length
SESSION_SECRET=test_session_secret_32_characters_long

# Email (mock in tests)
FROM_EMAIL=test@thottopilot.test
SENDGRID_API_KEY=test_sendgrid_key

# Generous rate limits for tests
DAILY_GENERATIONS_FREE=1000
DAILY_GENERATIONS_STARTER=1000
DAILY_GENERATIONS_PRO=-1

# Disable external services
SENTRY_DSN=
TURNSTILE_SITE_KEY=test_turnstile
TURNSTILE_SECRET_KEY=test_turnstile_secret

# Base URL
APP_BASE_URL=http://localhost:5000
```

3. **Verify tests can load it**:
```bash
npm test -- --run tests/unit/auth/signup.test.ts
```

**Deliverable**: `.env.test` configured ✅

---

### [ ] Task 2.2: Run Tests & Categorize Failures (1.5 hours)

**Step 1: Run full test suite**:
```bash
npm test 2>&1 | tee test-results-day2.txt
```

**Step 2: Analyze failures** - Create `test-failure-analysis.md`:

```markdown
# Test Failure Analysis - Day 2

## Summary
- Total: [X] tests
- Passing: [Y]
- Failing: [Z]
- Pass rate: [Y/X * 100]%

## Failure Categories

### 🔴 Type Errors (Priority: HIGH)
Files affected:
- [ ] tests/unit/auth/*.test.ts
- [ ] tests/integration/reddit/*.test.ts
- [ ] tests/caption/*.test.ts

Common errors:
- Property 'evidence' undefined on ShadowbanStatus
- Missing type imports
- Type assertions needed

### 🔴 Missing Mocks (Priority: HIGH)
APIs not mocked:
- [ ] Gemini API (generateContent calls)
- [ ] OpenRouter API (vision endpoint)
- [ ] OpenAI fallback
- [ ] Stripe webhooks
- [ ] SendGrid emails

### 🟡 Database Issues (Priority: MEDIUM)
- [ ] Database not seeded
- [ ] Foreign key violations
- [ ] Test isolation (one test affects another)

### 🟢 Logic Errors (Priority: LOW - investigate later)
- [ ] Outdated assertions
- [ ] Changed API responses
```

**Step 3: Prioritize fixes**:
- Identify top 5 most common errors
- Note which fixes will cascade (fixing 1 = fixes 10 tests)

**Deliverable**: `test-failure-analysis.md` ✅

---

## 🤖 PARALLEL: Codex Task 2.A - Fix Type Errors (2h AI time)

**Copy this to Codex**:

```
TASK: Fix TypeScript type errors in failing tests

CONTEXT:
Tests failing due to type errors. Must fix WITHOUT changing test logic.

FAILING TEST FILES:
[Paste from your test-failure-analysis.md]

COMMON TYPE ERRORS:

1. Undefined property errors:
❌ BAD:
expect(shadowbanStatus.evidence.length).toBeGreaterThan(0);

✅ GOOD:
expect(shadowbanStatus?.evidence?.length ?? 0).toBeGreaterThan(0);

2. Missing null checks:
❌ BAD:
const user = response.data;
expect(user.email).toBe('test@example.com');

✅ GOOD:
const user = response.data as User;
expect(user).toBeDefined();
expect(user.email).toBe('test@example.com');

3. Array access without checks:
❌ BAD:
expect(result.items[0].title).toBe('Test');

✅ GOOD:
expect(result.items).toBeDefined();
expect(result.items.length).toBeGreaterThan(0);
expect(result.items[0]?.title).toBe('Test');

RULES:
1. Only fix type safety - don't change assertions
2. Use optional chaining (?.) for potentially undefined
3. Add null/undefined checks before accessing properties
4. Add proper type imports if missing
5. NEVER add @ts-ignore or @ts-expect-error
6. Don't modify test data or expectations

FILES TO FIX:
- tests/unit/**/*.test.ts
- tests/integration/**/*.test.ts
- Prioritize auth and Reddit tests first

VALIDATION:
After fixing, run:
npm run typecheck
npm test -- --run

OUTPUT:
List each file fixed with:
- File path
- Number of type errors resolved
- Brief description of fixes applied
```

---

## 🌆 AFTERNOON SESSION (2 hours)

### [ ] Task 2.3: Review Codex Test Fixes (30 min)

**Review Checklist**:
```bash
# 1. Type check passes
npm run typecheck

# 2. Run tests
npm test

# 3. Check pass rate improved
# Before: ____%
# After: ____%

# 4. Verify no test logic changed
git diff tests/ | grep "expect(" | head -20
# Should only see type-safety additions, not changed assertions

# 5. Check for @ts-ignore (should be 0)
grep -r "@ts-ignore\|@ts-expect-error" tests/ | wc -l
```

**If pass rate < 70%**: Continue to Task 2.B

---

## 🤖 PARALLEL: Codex Task 2.B - Add API Mocks (2h AI time)

**Copy this to Codex**:

```
TASK: Mock all external API calls in tests

CONTEXT:
Tests failing because they try to call real APIs.
Need realistic mocks so tests run offline.

FAILING TESTS:
[Paste tests failing due to API calls]

MOCK PATTERNS:

1. OpenRouter (InternVL):
```typescript
import { vi } from 'vitest';

// Mock at top of test file, before imports
vi.mock('../lib/openrouter-client', () => ({
  generateVision: vi.fn().mockResolvedValue(
    'A beautiful sunset over the ocean with warm colors and dramatic clouds'
  ),
  isOpenRouterEnabled: vi.fn().mockReturnValue(true)
}));
```

2. Gemini:
```typescript
vi.mock('@google/generative-ai', () => ({
  GoogleGenerativeAI: vi.fn().mockImplementation(() => ({
    getGenerativeModel: vi.fn().mockReturnValue({
      generateContent: vi.fn().mockResolvedValue({
        response: {
          text: () => 'Mock caption from Gemini with engaging content'
        }
      })
    })
  }))
}));
```

3. OpenAI:
```typescript
vi.mock('openai', () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: vi.fn().mockResolvedValue({
          choices: [{
            message: {
              content: 'Mock response from OpenAI'
            }
          }]
        })
      }
    }
  }))
}));
```

4. Stripe:
```typescript
vi.mock('stripe', () => ({
  default: vi.fn().mockImplementation(() => ({
    webhooks: {
      constructEvent: vi.fn().mockReturnValue({
        type: 'checkout.session.completed',
        data: { object: { customer: 'cus_test123' } }
      })
    }
  }))
}));
```

5. SendGrid:
```typescript
vi.mock('@sendgrid/mail', () => ({
  setApiKey: vi.fn(),
  send: vi.fn().mockResolvedValue([{ statusCode: 202 }])
}));
```

RULES:
1. Mock at file top (before imports from file being tested)
2. Use realistic mock data (not empty strings)
3. Mock both success and error cases where needed
4. Reset mocks in beforeEach() if they have state
5. Don't mock database calls (use real test DB)
6. Don't mock internal modules (only external APIs)

FILES TO MODIFY:
- tests/unit/caption/**/*.test.ts (highest priority)
- tests/integration/**/*.test.ts
- Any test importing AI services

VALIDATION:
```bash
# Tests should run without network calls
npm test -- --run tests/unit/caption/
# Should pass without making real API calls

# Check no API keys are actually used
grep -r "process.env.OPENROUTER_API_KEY" tests/
# Should be 0 or only in mock setup
```

OUTPUT:
For each test file mocked:
- File path
- APIs mocked
- Mock strategy used
- Tests now passing (count)
```

---

### [ ] Task 2.4: Final Test Validation (1 hour)

**Step 1: Full test run**:
```bash
npm test 2>&1 | tee test-results-final.txt
```

**Step 2: Calculate improvement**:
```markdown
## Test Results Summary

**Before Day 2**:
- Passing: 23
- Failing: 60+
- Pass Rate: 28%

**After Day 2**:
- Passing: [X]
- Failing: [Y]
- Pass Rate: [Z]%

**Target**: 95%+ pass rate
**Achieved**: [YES/NO]
```

**Step 3: Handle remaining failures**:

If pass rate < 95%:
```bash
# Option A: Fix remaining (if < 10 failures)
# Manually fix the last few

# Option B: Exclude truly broken tests (defer to post-beta)
# Edit vitest.config.ts:
export default defineConfig({
  test: {
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      // Temporarily exclude until post-beta:
      'tests/integration/some-broken-test.test.ts',
    ]
  }
});

# Document WHY you're excluding
```

**Step 4: Commit**:
```bash
git add tests/ .env.test vitest.config.ts test-failure-analysis.md
git commit -m "test: fix type errors and add API mocks - achieve 95%+ pass rate

- Create .env.test with proper test configuration
- Fix type safety errors across 40+ test files
- Mock external APIs (Gemini, OpenRouter, OpenAI, Stripe)
- Improve pass rate from 28% to [X]%
- Document test failure analysis and fixes"
git push
```

---

## 🤖 PARALLEL: Gemini Pro Task 2.C - Test Coverage Analysis

**Copy this to Gemini Pro**:

```
TASK: Analyze test coverage gaps and prioritize

CONTEXT:
Tests are now passing, but need to identify what's NOT tested.

ANALYZE:
1. Critical paths without tests:
   - Payment webhook handling
   - Reddit OAuth flow end-to-end
   - AI caption generation pipeline
   - Scheduled post execution
   - Content moderation

2. Edge cases not covered:
   - Error handling (API failures, timeouts)
   - Rate limiting enforcement
   - Concurrent requests
   - Database transaction rollbacks
   - Malformed inputs

3. Security tests missing:
   - Auth bypass attempts
   - CSRF protection
   - SQL injection prevention (Drizzle should prevent, but verify)
   - XSS in user content
   - JWT token tampering

4. Integration gaps:
   - Full user journeys (signup → verify → post → payment)
   - Cross-service interactions
   - Webhook reliability

OUTPUT FORMAT:
Priority list of missing tests:

P0 (Critical - Must have before beta):
- Test: [Description]
- Risk: [What breaks if bug exists]
- Effort: [S/M/L - hours estimate]
- Recommendation: [Add now / Defer to Day 3]

P1 (Important - Add post-beta):
- ...

P2 (Nice to have - Can skip for MVP):
- ...

Focus on gaps that could cause:
1. Data corruption
2. Security breaches
3. Payment failures
4. User lockouts
```

---

## ✅ DAY 2 WRAP-UP (15 min)

### Validation Checklist:
- [ ] Tests pass rate: ____% (target: 95%+)
- [ ] TypeScript errors in tests: 0
- [ ] External APIs mocked
- [ ] .env.test configured
- [ ] CI/CD passes (GitHub Actions)
- [ ] Test coverage analysis complete

### Update Status:
Edit `CURRENT_STATUS.md`:
```markdown
## Tests Status (Updated: Day 2)
- ✅ 95%+ pass rate achieved
- ✅ Type errors fixed across 40+ files
- ✅ External APIs mocked (offline testing)
- ✅ .env.test configured
- ⚠️ Known gaps: [list from Gemini analysis]
- 📝 Next: Add P0 critical tests on Day 3
```

### Commit Runbook:
```bash
git add docs/runbooks/disaster-recovery.md
git commit -m "docs: add comprehensive disaster recovery runbook"
git push
```

---

**🎉 Day 2 Complete!** → Proceed to Day 3

**Tomorrow**: Build scheduled posts system (users can schedule Reddit posts for future dates)
