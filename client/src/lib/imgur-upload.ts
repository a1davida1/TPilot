/**
 * Imgur upload helper for scheduled posts
 * Stores protected images on creator's Imgur account (URLs only in DB)
 */

export interface ImgurCredentials {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
}

export interface ImgurUploadResult {
  id: string;
  link: string;
  deletehash: string;
  title?: string;
  description?: string;
}

/**
 * Upload blob to Imgur
 * @param blob Protected image blob
 * @param credentials Imgur OAuth credentials
 * @param options Upload options
 * @returns Imgur link and metadata
 */
export async function uploadToImgur(
  blob: Blob,
  credentials: ImgurCredentials,
  options?: {
    title?: string;
    description?: string;
    album?: string;
  }
): Promise<ImgurUploadResult> {
  const formData = new FormData();
  formData.append('image', blob);
  
  if (options?.title) {
    formData.append('title', options.title);
  }
  
  if (options?.description) {
    formData.append('description', options.description);
  }
  
  if (options?.album) {
    formData.append('album', options.album);
  }

  const response = await fetch('https://api.imgur.com/3/image', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${credentials.accessToken}`
    },
    body: formData
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Imgur upload failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(`Imgur API error: ${data.data?.error ?? 'unknown error'}`);
  }

  return {
    id: data.data.id,
    link: data.data.link,
    deletehash: data.data.deletehash,
    title: data.data.title,
    description: data.data.description
  };
}

/**
 * Delete image from Imgur
 * @param deletehash Imgur deletehash
 * @param credentials Imgur OAuth credentials
 */
export async function deleteFromImgur(
  deletehash: string,
  credentials: ImgurCredentials
): Promise<void> {
  const response = await fetch(`https://api.imgur.com/3/image/${deletehash}`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Bearer ${credentials.accessToken}`
    }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Imgur delete failed: ${response.status} ${errorText}`);
  }
}

/**
 * Get Imgur OAuth credentials from storage
 */
export async function getImgurCredentials(): Promise<ImgurCredentials> {
  const accessToken = localStorage.getItem('imgur_access_token');
  const refreshToken = localStorage.getItem('imgur_refresh_token');
  const expiresAt = localStorage.getItem('imgur_expires_at');

  if (!accessToken) {
    throw new Error('Imgur not connected. Please connect your Imgur account first.');
  }

  // Check if token is expired
  if (expiresAt && Date.now() >= parseInt(expiresAt, 10)) {
    // Try to refresh the token
    if (refreshToken) {
      try {
        const newTokens = await refreshImgurToken(refreshToken);
        return {
          accessToken: newTokens.accessToken,
          refreshToken: newTokens.refreshToken,
          expiresAt: newTokens.expiresAt
        };
      } catch {
        // Token refresh failed - user needs to reconnect
        throw new Error('Imgur token expired. Please reconnect your account.');
      }
    } else {
      throw new Error('Imgur token expired. Please reconnect your account.');
    }
  }

  return {
    accessToken,
    refreshToken: refreshToken ?? undefined,
    expiresAt: expiresAt ? parseInt(expiresAt, 10) : undefined
  };
}

/**
 * Refresh Imgur access token using refresh token
 */
async function refreshImgurToken(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}> {
  const clientId = import.meta.env.VITE_IMGUR_CLIENT_ID;
  const clientSecret = import.meta.env.VITE_IMGUR_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('Imgur OAuth credentials not configured');
  }

  const formData = new URLSearchParams();
  formData.append('refresh_token', refreshToken);
  formData.append('client_id', clientId);
  formData.append('client_secret', clientSecret);
  formData.append('grant_type', 'refresh_token');

  const response = await fetch('https://api.imgur.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: formData.toString()
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(`Failed to refresh token: ${error.error || response.statusText}`);
  }

  const data = await response.json();
  
  // Save new tokens
  const expiresAt = Date.now() + (data.expires_in * 1000);
  localStorage.setItem('imgur_access_token', data.access_token);
  localStorage.setItem('imgur_refresh_token', data.refresh_token);
  localStorage.setItem('imgur_expires_at', expiresAt.toString());

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt
  };
}

/**
 * Check if Imgur credentials are available and valid
 */
export function hasImgurCredentials(): boolean {
  const accessToken = localStorage.getItem('imgur_access_token');
  const expiresAt = localStorage.getItem('imgur_expires_at');

  if (!accessToken) return false;
  if (expiresAt && Date.now() >= parseInt(expiresAt, 10)) return false;

  return true;
}

/**
 * Start Imgur OAuth flow
 * Redirects user to Imgur authorization page
 */
export function startImgurOAuth(): void {
  const clientId = import.meta.env.VITE_IMGUR_CLIENT_ID;
  if (!clientId) {
    throw new Error('Imgur client ID not configured');
  }

  const _redirectUri = `${window.location.origin}/oauth/imgur/callback`;
  const state = generateRandomState();
  
  // Store state for verification
  sessionStorage.setItem('imgur_oauth_state', state);

  const authUrl = new URL('https://api.imgur.com/oauth2/authorize');
  authUrl.searchParams.set('client_id', clientId);
  authUrl.searchParams.set('response_type', 'token');
  authUrl.searchParams.set('state', state);

  window.location.href = authUrl.toString();
}

/**
 * Handle Imgur OAuth callback
 * Extracts access token from URL hash and stores credentials
 */
export function handleImgurOAuthCallback(): ImgurCredentials | null {
  const hash = window.location.hash.substring(1);
  const params = new URLSearchParams(hash);

  const accessToken = params.get('access_token');
  const refreshToken = params.get('refresh_token');
  const expiresIn = params.get('expires_in');
  const state = params.get('state');

  // Verify state
  const storedState = sessionStorage.getItem('imgur_oauth_state');
  if (state !== storedState) {
    console.error('OAuth state mismatch');
    return null;
  }

  if (!accessToken) {
    console.error('No access token in OAuth callback');
    return null;
  }

  // Calculate expiration time
  const expiresAt = expiresIn
    ? Date.now() + parseInt(expiresIn, 10) * 1000
    : Date.now() + 3600 * 1000; // Default 1 hour

  // Store credentials
  localStorage.setItem('imgur_access_token', accessToken);
  if (refreshToken) {
    localStorage.setItem('imgur_refresh_token', refreshToken);
  }
  localStorage.setItem('imgur_expires_at', expiresAt.toString());

  // Clear state
  sessionStorage.removeItem('imgur_oauth_state');

  return {
    accessToken,
    refreshToken: refreshToken ?? undefined,
    expiresAt
  };
}

function generateRandomState(): string {
  return Math.random().toString(36).substring(2, 15) +
    Math.random().toString(36).substring(2, 15);
}
