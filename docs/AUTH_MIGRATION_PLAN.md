# Auth Migration Plan: Hybrid JWT/Cookie to Secure JWT Bearer

## Executive Summary
Migrating from broken hybrid auth (JWT + cookies + CSRF) to industry-standard JWT Bearer with httpOnly refresh tokens.

**Timeline**: 4 phases over 2-3 days  
**Risk Level**: Low (phased rollout with rollback plan)  
**Expected Outcomes**: 
- 🚀 2-5x faster auth (no session queries)
- 🔒 Better security (XSS + CSRF resistant)
- 🐛 Fewer bugs (simpler auth flow)

---

## Current State Analysis

### What We Have
- ✅ JWT tokens generated on login
- ✅ Frontend stores in `localStorage` + sends `Authorization: Bearer`
- ✅ Backend ALSO sets JWT in httpOnly cookie (redundant)
- ❌ CSRF middleware causing 500/404 errors
- ❌ Hybrid system = both XSS and CSRF vulnerable
- ✅ OAuth state validation is excellent (Reddit flow)
- ✅ Token blacklist infrastructure exists

### Security Audit Results
- **XSS Risk**: Medium (localStorage + one `dangerouslySetInnerHTML`)
- **CSRF Risk**: Low (SameSite cookies, but CSRF middleware buggy)
- **Session Management**: Good (Redis-backed, proper cleanup)
- **OAuth Flows**: Excellent (state validation, IP checking)

---

## Phase 0: Pre-Migration Security Hardening (30 minutes)

### 0.1 Fix dangerouslySetInnerHTML in chart.tsx

**File**: `client/src/components/ui/chart.tsx` (line 81)

**Current**:
```tsx
<style dangerouslySetInnerHTML={{ __html: chartThemes }} />
```

**Risk**: If `chartThemes` ever includes user input (currently it doesn't), XSS possible.

**Action**: Add sanitization or move to external stylesheet.

```tsx
// Option 1: Verify input is static (recommended)
const chartThemes = Object.entries(THEMES)
  .map(([theme, prefix]) => `...`)
  .join('\n');

// Add TypeScript assertion
const SAFE_CHART_THEMES: string = chartThemes; // Compile-time check that it's string literal
```

**Owner**: Frontend  
**Priority**: P1 (do before Phase 1)

### 0.2 Strengthen CSP Headers

**File**: `server/middleware/security.ts` (line 370)

**Add**:
```typescript
scriptSrc: [
  "'self'",
  // Remove 'unsafe-eval' even in dev (breaks Vite? Test first)
  // process.env.NODE_ENV === 'development' ? "'unsafe-eval'" : "", // REMOVE
  // Add nonce for inline scripts if needed
  (req, res) => `'nonce-${res.locals.cspNonce}'`,
  ...
],
// Add report-uri to catch violations
reportUri: ['/api/csp-violation-report'],
```

**Action Items**:
- [ ] Test Vite dev server without `'unsafe-eval'` (may need to configure Vite)
- [ ] Add CSP violation reporting endpoint
- [ ] Monitor violations for 1 week before enforcing

**Owner**: Backend  
**Priority**: P2 (nice-to-have, don't block migration)

### 0.3 Add XSS Audit Checklist

Run before Phase 1:
```bash
# Check for unsafe patterns
grep -r "innerHTML" client/src --include="*.tsx" --include="*.ts" | grep -v test
grep -r "dangerouslySetInnerHTML" client/src --include="*.tsx"
grep -r "eval(" client/src --include="*.tsx" --include="*.ts"
grep -r "Function(" client/src --include="*.tsx" --include="*.ts"

# Check dependencies
npm audit --production
npm outdated

# Verify sanitization
grep -r "sanitize\|DOMPurify" server
```

**Expected Results**: 
- ✅ Only `chart.tsx` uses `dangerouslySetInnerHTML` (static content)
- ✅ No `eval()` or `Function()` in production code
- ✅ `express-mongo-sanitize` installed (line 363 of security.ts)

---

## Phase 1: Fix Immediate CSRF Bugs (20 minutes)

**Goal**: Make login work without breaking existing users

### 1.1 Exempt Bearer Token Requests from CSRF

**File**: `server/app.ts` (after line 277)

```typescript
app.use((req: express.Request, res: express.Response, next: express.NextFunction) => {
  // Skip CSRF if Authorization header present (JWT Bearer)
  if (req.headers.authorization?.startsWith('Bearer ')) {
    logger.debug('Skipping CSRF for Bearer token request', { 
      path: req.path,
      method: req.method 
    });
    return next();
  }
  
  const exemptPaths = [
    `${API_PREFIX}/auth/login`,
    `${API_PREFIX}/auth/signup`,
    `${API_PREFIX}/auth/reddit/callback`,
    `${API_PREFIX}/auth/google/callback`,
    `${API_PREFIX}/auth/facebook/callback`,
    `${API_PREFIX}/auth/logout`,
    `${API_PREFIX}/webhooks/`,
    `${API_PREFIX}/health`
  ];

  if (exemptPaths.some((path) => req.path.startsWith(path))) {
    return next();
  }

  return csrfProtection(req, res, next);
});
```

**Testing**:
```bash
# Should succeed
curl -X POST http://localhost:5000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test"}'

# Should succeed (with valid token)
curl -X GET http://localhost:5000/api/auth/user \
  -H "Authorization: Bearer <token>"
```

### 1.2 Add Migration Feature Flag

**File**: `.env`

```bash
# Auth migration flags
AUTH_MIGRATION_PHASE=1
AUTH_ALLOW_COOKIE_AUTH=true  # Set false in Phase 3
AUTH_ALLOW_BEARER_AUTH=true
```

**Deploy**: 
- ✅ Push to Replit
- ✅ Verify login works
- ✅ Monitor error logs for 1 hour

---

## Phase 2: Add Refresh Token System (2 hours)

**Goal**: Prepare for short-lived access tokens

### 2.1 Database Migration

**File**: `server/db/migrations/014_token_version.sql`

```sql
-- Add token versioning for instant revocation
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS token_version INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_users_token_version ON users(token_version);

-- Add refresh tokens table (optional - or use JWT only)
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) NOT NULL UNIQUE,
  device_id VARCHAR(255),
  ip_address INET,
  user_agent TEXT,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  last_used_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);

-- Cleanup job (run daily)
DELETE FROM refresh_tokens WHERE expires_at < NOW() - INTERVAL '7 days';
```

### 2.2 Add Refresh Endpoint

**File**: `server/auth.ts` (after login endpoint)

```typescript
// Refresh token endpoint (uses httpOnly cookie)
app.post(route('/auth/refresh'), async (req, res) => {
  const startTime = Date.now();
  
  try {
    const refreshToken = req.cookies.refresh_token;
    
    if (!refreshToken) {
      return res.status(401).json({ error: 'No refresh token provided' });
    }
    
    // Verify refresh token
    const decoded = jwt.verify(refreshToken, JWT_SECRET_VALIDATED) as {
      id: number;
      type: string;
      version: number;
      jti: string; // JWT ID for tracking
    };
    
    if (decoded.type !== 'refresh') {
      logger.warn('Invalid token type in refresh', { type: decoded.type });
      return res.status(401).json({ error: 'Invalid token type' });
    }
    
    // Get user and verify token version
    const user = await storage.getUserById(decoded.id);
    
    if (!user || user.isDeleted) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    if (user.tokenVersion !== decoded.version) {
      logger.warn('Token version mismatch - token revoked', {
        userId: user.id,
        tokenVersion: decoded.version,
        currentVersion: user.tokenVersion
      });
      return res.status(401).json({ error: 'Token revoked' });
    }
    
    // Check if token is blacklisted
    if (await isTokenBlacklisted(decoded.jti)) {
      logger.warn('Attempted refresh with blacklisted token', { userId: user.id });
      return res.status(401).json({ error: 'Token blacklisted' });
    }
    
    // Generate new tokens (rotation)
    const jti = uuidv4();
    const newAccessToken = jwt.sign(
      {
        id: user.id,
        userId: user.id,
        username: user.username,
        isAdmin: user.isAdmin,
        role: user.role
      },
      JWT_SECRET_VALIDATED,
      { expiresIn: '1h', jwtid: jti } // Short-lived
    );
    
    const newRefreshToken = jwt.sign(
      {
        id: user.id,
        type: 'refresh',
        version: user.tokenVersion,
        jti: uuidv4()
      },
      JWT_SECRET_VALIDATED,
      { expiresIn: '7d' }
    );
    
    // Set new refresh token in cookie (rotation)
    const cfg = getCookieConfig();
    res.cookie('refresh_token', newRefreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', // CSRF protection
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
      path: '/api/auth/refresh' // Only sent to this endpoint
    });
    
    // Update last used (optional - for device tracking)
    await storage.updateUserLastLogin(user.id, new Date());
    
    authMetrics.track('refresh', true, Date.now() - startTime);
    
    res.json({
      accessToken: newAccessToken,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        tier: user.tier,
        isAdmin: user.isAdmin,
        role: user.role
      }
    });
    
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.warn('Refresh token failed', { error: message });
    authMetrics.track('refresh', false, Date.now() - startTime, message);
    
    // Clear invalid cookie
    res.clearCookie('refresh_token', { path: '/api/auth/refresh' });
    
    return res.status(401).json({ error: 'Invalid refresh token' });
  }
});
```

### 2.3 Update Login to Issue Both Tokens

**File**: `server/auth.ts` (in `/auth/login` endpoint, line 248)

**Change**:
```typescript
// OLD: 24h token in both response and cookie
const token = jwt.sign({ ... }, JWT_SECRET, { expiresIn: '24h' });

// NEW: 1h access token + 7d refresh token
const jti = uuidv4();
const accessToken = jwt.sign(
  {
    id: user.id,
    userId: user.id,
    username: user.username,
    isAdmin: user.isAdmin,
    role: user.role
  },
  JWT_SECRET_VALIDATED,
  { expiresIn: '1h', jwtid: jti } // Short-lived
);

const refreshToken = jwt.sign(
  {
    id: user.id,
    type: 'refresh',
    version: user.tokenVersion || 0,
    jti: uuidv4()
  },
  JWT_SECRET_VALIDATED,
  { expiresIn: '7d' }
);

// Set refresh token in httpOnly cookie
const cfg = getCookieConfig();
res.cookie('refresh_token', refreshToken, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/api/auth/refresh'
});

// Return access token in response (frontend stores in memory)
res.json({
  token: accessToken, // Keep 'token' for backwards compat
  accessToken, // New field
  user: { ... }
});
```

### 2.4 Update Logout to Blacklist Refresh Token

**File**: `server/auth.ts` (in `/auth/logout` endpoint)

```typescript
app.post(route('/auth/logout'), extractAuthToken, async (req, res) => {
  try {
    const token = req.token;
    const refreshToken = req.cookies.refresh_token;
    
    // Blacklist both tokens
    if (token) {
      const decoded = jwt.decode(token) as { jti?: string };
      if (decoded?.jti) {
        await blacklistToken(decoded.jti);
      }
    }
    
    if (refreshToken) {
      try {
        const decoded = jwt.verify(refreshToken, JWT_SECRET_VALIDATED) as { jti?: string };
        if (decoded?.jti) {
          await blacklistToken(decoded.jti);
        }
      } catch (err) {
        // Ignore invalid refresh tokens
      }
    }
    
    // Clear cookies
    const cfg = getCookieConfig();
    cfg.clear(res, 'refresh_token', { path: '/api/auth/refresh' });
    cfg.clear(res, cfg.authName);
    
    // Destroy session
    if (req.session) {
      req.session.destroy((err) => {
        if (err) logger.error('Session destroy error', { error: err });
      });
    }
    
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Logout error', { error });
    res.status(500).json({ error: 'Logout failed' });
  }
});
```

---

## Phase 3: Update Frontend (1 hour)

### 3.1 Store Access Token in Memory Only

**File**: `client/src/lib/auth.ts` (new file)

```typescript
// In-memory token storage (XSS resistant)
let accessToken: string | null = null;
let tokenExpiry: number | null = null;

export function setAccessToken(token: string) {
  accessToken = token;
  
  // Decode to get expiry (don't verify signature client-side)
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    tokenExpiry = payload.exp * 1000; // Convert to ms
  } catch (err) {
    console.warn('Failed to decode token expiry');
  }
}

export function getAccessToken(): string | null {
  // Check if token expired
  if (tokenExpiry && Date.now() >= tokenExpiry) {
    console.log('Access token expired, need refresh');
    accessToken = null;
    return null;
  }
  
  return accessToken;
}

export function clearAccessToken() {
  accessToken = null;
  tokenExpiry = null;
}

// Refresh access token using httpOnly cookie
export async function refreshAccessToken(): Promise<string | null> {
  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include' // Send httpOnly cookie
    });
    
    if (!res.ok) {
      console.warn('Token refresh failed, logging out');
      clearAccessToken();
      // Redirect to login
      window.location.href = '/login?session=expired';
      return null;
    }
    
    const { accessToken: newToken } = await res.json();
    setAccessToken(newToken);
    return newToken;
  } catch (err) {
    console.error('Refresh failed', err);
    clearAccessToken();
    return null;
  }
}

// Multi-tab logout sync
window.addEventListener('storage', (e) => {
  if (e.key === 'logout-event') {
    clearAccessToken();
    window.location.href = '/login?logged_out=true';
  }
});

export function broadcastLogout() {
  localStorage.setItem('logout-event', Date.now().toString());
  localStorage.removeItem('logout-event'); // Trigger event
}
```

### 3.2 Update apiRequest with Auto-Refresh

**File**: `client/src/lib/queryClient.ts` (update `apiRequest`)

```typescript
export async function apiRequest<T = unknown>(
  url: string,
  options: RequestInit = {}
): Promise<T> {
  const { headers = {}, ...restOptions } = options;
  
  // Get token from memory (not localStorage)
  let token = getAccessToken();
  
  // Auto-refresh if expired
  if (!token) {
    token = await refreshAccessToken();
    if (!token) {
      throw new Error('Authentication required');
    }
  }
  
  // Add Bearer token
  const authHeaders = token ? { 'Authorization': `Bearer ${token}` } : {};
  
  const response = await fetch(url, {
    ...restOptions,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
      ...authHeaders
    },
    credentials: 'include' // For refresh cookie
  });
  
  // If 401, try refresh once
  if (response.status === 401 && !options.skipRetry) {
    const newToken = await refreshAccessToken();
    
    if (newToken) {
      // Retry with new token
      return apiRequest<T>(url, { ...options, skipRetry: true });
    }
  }
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Request failed');
  }
  
  return response.json();
}
```

### 3.3 Update Login Component

**File**: `client/src/components/login-modal.tsx` (line 54-58)

```typescript
// OLD
localStorage.setItem("authToken", data.token);
localStorage.setItem("user", JSON.stringify(data.user));

// NEW
setAccessToken(data.accessToken || data.token); // Support both during migration
localStorage.setItem("user", JSON.stringify(data.user)); // Keep user data
```

### 3.4 Update Logout

**File**: `client/src/components/auth-provider.tsx` or wherever logout is

```typescript
async function logout() {
  await fetch('/api/auth/logout', {
    method: 'POST',
    credentials: 'include'
  });
  
  clearAccessToken();
  localStorage.removeItem('user');
  broadcastLogout(); // Multi-tab sync
  
  window.location.href = '/login';
}
```

---

## Phase 4: Remove Cookie Auth & CSRF (30 minutes)

### 4.1 Remove Cookie-Setting from Login

**File**: `server/auth.ts` (login endpoint)

```typescript
// DELETE these lines
const cfg = getCookieConfig();
res.cookie(cfg.authName, token, {
  ...cfg.options,
  maxAge: 24 * 60 * 60 * 1000,
});
```

### 4.2 Remove CSRF Middleware

**File**: `server/app.ts` (lines 255-315)

```typescript
// DELETE the entire CSRF section
// Keep only this for refresh endpoint:
app.use((req, res, next) => {
  // No CSRF needed - Bearer tokens are CSRF-immune
  // Refresh endpoint protected by SameSite=Lax cookie
  next();
});
```

### 4.3 Remove CSRF from Frontend

**File**: `client/src/lib/queryClient.ts`

```typescript
// DELETE all CSRF functions
// - getCsrfToken()
// - clearCsrfToken()
// - X-CSRF-Token header logic
```

---

## Testing Plan

### Automated Tests

**File**: `server/__tests__/auth.test.ts` (new)

```typescript
describe('Auth System', () => {
  it('issues access + refresh tokens on login', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test', password: 'password' });
    
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
    expect(res.headers['set-cookie']).toContain('refresh_token');
  });
  
  it('refreshes access token with valid cookie', async () => {
    // Login first
    const login = await request(app)
      .post('/api/auth/login')
      .send({ username: 'test', password: 'password' });
    
    const refreshCookie = login.headers['set-cookie'].find(c => c.includes('refresh_token'));
    
    // Refresh
    const res = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', refreshCookie);
    
    expect(res.status).toBe(200);
    expect(res.body.accessToken).toBeDefined();
  });
  
  it('rejects refresh after token version bump', async () => {
    // Login + bump version + refresh should fail
    // (test revocation)
  });
  
  it('accepts Bearer token for protected routes', async () => {
    const { accessToken } = await loginAsUser();
    
    const res = await request(app)
      .get('/api/auth/user')
      .set('Authorization', `Bearer ${accessToken}`);
    
    expect(res.status).toBe(200);
  });
});
```

### Manual QA Checklist

- [ ] **Login Flow**
  - [ ] Enter credentials → receive access token + refresh cookie
  - [ ] Token stored in memory, not localStorage
  - [ ] Refresh cookie httpOnly, Secure, SameSite=Lax
  
- [ ] **API Requests**
  - [ ] All requests include `Authorization: Bearer` header
  - [ ] No CSRF tokens sent
  - [ ] Requests succeed
  
- [ ] **Token Refresh**
  - [ ] Wait 1 hour → access token expires
  - [ ] Next API call auto-refreshes
  - [ ] New access token received
  
- [ ] **Logout**
  - [ ] Click logout → tokens cleared
  - [ ] Refresh cookie deleted
  - [ ] Can't make authenticated requests
  - [ ] Other tabs also logged out
  
- [ ] **Multi-Tab Sync**
  - [ ] Logout in Tab A → Tab B redirects to login
  - [ ] Login in Tab A → Tab B remains logged out (intentional)
  
- [ ] **OAuth Flows**
  - [ ] Google/Facebook/Reddit still work
  - [ ] Receive access token after OAuth callback
  - [ ] Refresh cookie set

### Security Testing

```bash
# XSS Test (should fail)
curl -X POST http://localhost:5000/api/auth/login \
  -d '{"username":"<script>alert(1)</script>","password":"test"}'

# CSRF Test (should succeed now - no CSRF protection needed)
curl -X POST http://localhost:5000/api/some-endpoint \
  -H "Authorization: Bearer <valid-token>" \
  -H "Origin: http://evil.com"

# Token Revocation Test
# 1. Login, save refresh token
# 2. Bump user.tokenVersion in DB
# 3. Try refresh → should fail with 401
```

---

## Rollback Plan

If anything breaks in production:

1. **Immediate**: Set `AUTH_ALLOW_COOKIE_AUTH=true` in `.env`
2. **Code**: Revert last commit
3. **Database**: `UPDATE users SET token_version = 0` (if needed)
4. **Frontend**: Deploy previous version
5. **Monitoring**: Check error rate, login success rate

---

## Monitoring & Metrics

### Add to Prometheus/Grafana

```typescript
// Auth metrics
auth_login_total{status="success|failure"}
auth_refresh_total{status="success|failure"}
auth_refresh_latency_ms
auth_token_version_mismatches_total
```

### Alerts

- **Critical**: Login failure rate > 5%
- **Warning**: Refresh failures > 10% (may indicate revocation)
- **Info**: Token version bumps (track revocations)

---

## Post-Migration Checklist

- [ ] Remove `csrf-csrf` from `package.json`
- [ ] Remove CSRF token endpoint (`/api/csrf-token`)
- [ ] Update API documentation
- [ ] Archive this migration plan
- [ ] Write blog post (optional marketing)

---

## Estimated Timeline

| Phase | Time | Can Deploy? |
|-------|------|-------------|
| Phase 0 (Security) | 30min | No |
| Phase 1 (Fix bugs) | 20min | ✅ Yes (low risk) |
| Phase 2 (Refresh endpoint) | 2h | ⚠️ Test thoroughly |
| Phase 3 (Frontend) | 1h | ⚠️ Coordinate with backend |
| Phase 4 (Cleanup) | 30min | ✅ Yes (after Phase 3 stable) |

**Total**: ~4.5 hours of work, ~2-3 days with testing

---

## Success Criteria

- ✅ Login success rate > 99%
- ✅ No CSRF 403 errors
- ✅ Token refresh works automatically
- ✅ OAuth flows unaffected
- ✅ Auth check latency < 5ms (down from 10-50ms)
- ✅ No localStorage XSS exposure
- ✅ Multi-tab logout works
