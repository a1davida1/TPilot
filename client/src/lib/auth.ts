// Phase 3: In-memory token storage for XSS protection
// Access tokens stored in memory (lost on refresh - that's OK, we have refresh tokens)
// Refresh tokens stored in httpOnly cookies (XSS-resistant)

let accessToken: string | null = null;
let tokenExpiry: number | null = null;
let hadToken = false;

/**
 * Set the access token in memory
 * @param token JWT access token from server
 */
export function setAccessToken(token: string): void {
  accessToken = token;
  hadToken = true;
  
  // Decode to get expiry (don't verify signature client-side)
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    tokenExpiry = payload.exp * 1000; // Convert to ms
  } catch (err) {
    console.warn('Failed to decode token expiry:', err);
    tokenExpiry = null;
  }
}

/**
 * Get the current access token
 * @returns Access token or null if expired/missing
 */
export function getAccessToken(): string | null {
  // Check if token expired
  if (tokenExpiry && Date.now() >= tokenExpiry) {
    // Access token expired, clearing
    accessToken = null;
    // Preserve hadToken flag so we can attempt refresh
    return null;
  }
  
  return accessToken;
}

/**
 * Clear the access token from memory
 */
export function clearAccessToken(): void {
  accessToken = null;
  tokenExpiry = null;
  hadToken = false;
}

/**
 * Check if we have a valid access token
 */
export function hasValidToken(): boolean {
  if (!accessToken) {
    return false;
  }

  if (tokenExpiry && Date.now() >= tokenExpiry) {
    return false;
  }

  return true;
}

/**
 * Check if we previously obtained a token (even if it expired)
 * Useful to decide whether we should attempt a refresh.
 */
export function hasRefreshableToken(): boolean {
  return hadToken;
}

/**
 * Refresh the access token using httpOnly cookie
 * @returns New access token or null if refresh failed
 */
export async function refreshAccessToken(): Promise<string | null> {
  try {
    const res = await fetch('/api/auth/refresh', {
      method: 'POST',
      credentials: 'include' // Send httpOnly cookie
    });
    
    if (!res.ok) {
      return null;
    }
    
    const { accessToken: newToken } = await res.json();
    setAccessToken(newToken);
    return newToken;
  } catch (err) {
    // Refresh failed - clear token and return null
    clearAccessToken();
    return null;
  }
}

// Multi-tab logout sync via localStorage events
window.addEventListener('storage', (e) => {
  if (e.key === 'logout-event') {
    clearAccessToken();
    window.location.href = '/login?logged_out=true';
  }
});

/**
 * Broadcast logout to all tabs
 */
export function broadcastLogout(): void {
  localStorage.setItem('logout-event', Date.now().toString());
  localStorage.removeItem('logout-event'); // Trigger event
}
