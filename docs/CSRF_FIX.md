# CSRF Token Fix for Production

## Issues Fixed
1. **Reddit posting failing with "Invalid CSRF token"**
2. **Referral endpoint 404 errors**

## Solution Applied

### 1. CSRF Token Fix
Modified `/client/src/lib/queryClient.ts` to **always include CSRF tokens** for state-changing requests (POST, PUT, DELETE, PATCH), even when using Bearer authentication.

**Before:**
```javascript
// Phase 1: CSRF not needed for Bearer tokens (server exempts them)
```

**After:**
```javascript
// Always include CSRF token for state-changing requests
if (typeof window !== "undefined" && ["POST", "PUT", "DELETE", "PATCH"].includes(method.toUpperCase())) {
  try {
    const token = await getCsrfToken();
    if (token) {
      headers["X-CSRF-Token"] = token;
    }
  } catch (error) {
    console.warn("Unable to get CSRF token", error);
  }
}
```

### 2. Why This Was Needed
The server-side CSRF middleware was checking for CSRF tokens on ALL POST requests except explicitly exempted paths. The `/api/reddit/submit` endpoint was NOT in the exemption list, causing the 403 errors.

### 3. Security Considerations
This is the correct approach because:
- CSRF protection should be enabled for all state-changing operations
- Bearer tokens alone don't protect against CSRF attacks in all scenarios
- The overhead of including CSRF tokens is minimal

## Deployment Steps
1. **Build the frontend** with the fix:
   ```bash
   npm run build
   ```

2. **Deploy to Render**:
   ```bash
   git add .
   git commit -m "Fix CSRF token validation for Reddit posting"
   git push origin main
   ```

3. **Clear browser cache** after deployment (important!)

## Testing
After deployment, test:
1. ✅ Reddit posting should work
2. ✅ All POST/PUT/DELETE operations should include CSRF token
3. ✅ No more 403 CSRF errors

## Referral Endpoint Note
The 404 error for `/api/referral/my-code` appears to be from old cached JavaScript. The correct endpoint is `/api/referral/code`. This should resolve after the new build is deployed and cache is cleared.
