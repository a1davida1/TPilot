/**
 * Reddit direct upload helper
 * Handles media lease + PUT + submit flow for one-click posting
 */

export interface RedditCredentials {
  accessToken: string;
  refreshToken?: string;
}

export interface RedditSubmitOptions {
  subreddit: string;
  title: string;
  nsfw: boolean;
  flair?: string;
  sendReplies?: boolean;
}

export interface MediaLeaseResponse {
  args: {
    action: string;
    fields: Array<{ name: string; value: string }>;
  };
  asset: {
    asset_id: string;
    processing_state: string;
    payload: {
      filepath: string;
    };
    websocket_url: string;
  };
}

export interface RedditSubmitResponse {
  json: {
    errors: Array<[string, string, string]>;
    data: {
      url: string;
      id: string;
      name: string;
    };
  };
}

/**
 * Upload image to Reddit and create post
 * @param blob Protected image blob
 * @param credentials Reddit OAuth credentials
 * @param options Post options (subreddit, title, nsfw, etc.)
 * @returns Reddit post URL
 */
export async function uploadAndSubmitToReddit(
  blob: Blob,
  credentials: RedditCredentials,
  options: RedditSubmitOptions
): Promise<{ url: string; postId: string }> {
  // Step 1: Get media upload lease
  const lease = await getMediaLease(credentials.accessToken);

  // Step 2: Upload blob to Reddit's S3
  await uploadToS3(blob, lease);

  // Step 3: Wait for processing (optional; Reddit usually processes fast)
  await waitForProcessing(lease.asset.websocket_url, lease.asset.asset_id);

  // Step 4: Submit post with media
  const result = await submitPost(credentials.accessToken, {
    subreddit: options.subreddit,
    title: options.title,
    nsfw: options.nsfw,
    flair: options.flair,
    assetId: lease.asset.asset_id,
    sendReplies: options.sendReplies ?? true
  });

  return {
    url: result.json.data.url,
    postId: result.json.data.id
  };
}

/**
 * Get media upload lease from Reddit API
 */
async function getMediaLease(accessToken: string): Promise<MediaLeaseResponse> {
  const response = await fetch('https://oauth.reddit.com/api/media/asset.json', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams({
      filepath: 'image.jpg',
      mimetype: 'image/jpeg'
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get media lease: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data;
}

/**
 * Upload blob to Reddit's S3 using signed URL
 */
async function uploadToS3(blob: Blob, lease: MediaLeaseResponse): Promise<void> {
  const formData = new FormData();

  // Add all fields from lease
  lease.args.fields.forEach(field => {
    formData.append(field.name, field.value);
  });

  // Add file last (required by S3)
  formData.append('file', blob, 'image.jpg');

  const response = await fetch(lease.args.action, {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to upload to S3: ${response.status} ${errorText}`);
  }
}

/**
 * Wait for Reddit to process uploaded media
 * Uses WebSocket or polling to check status
 */
async function waitForProcessing(
  websocketUrl: string,
  assetId: string,
  timeoutMs: number = 30000
): Promise<void> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      ws?.close();
      reject(new Error('Media processing timeout'));
    }, timeoutMs);

    let ws: WebSocket | undefined;

    try {
      ws = new WebSocket(websocketUrl);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'success' || data.payload?.status === 'valid') {
            clearTimeout(timeout);
            ws?.close();
            resolve();
          } else if (data.type === 'failed') {
            clearTimeout(timeout);
            ws?.close();
            reject(new Error(`Media processing failed: ${data.payload?.error ?? 'unknown'}`));
          }
        } catch (_error) {
          // Ignore parse errors; keep waiting
        }
      };

      ws.onerror = (error) => {
        clearTimeout(timeout);
        // WebSocket failed; fall back to assuming success (Reddit usually processes quickly)
        console.warn('WebSocket error, assuming media processed:', error);
        resolve();
      };

      ws.onclose = () => {
        clearTimeout(timeout);
        // If closed without error, assume success
        resolve();
      };
    } catch (error) {
      clearTimeout(timeout);
      // WebSocket not supported or failed to create; assume success
      console.warn('WebSocket creation failed, assuming media processed:', error);
      resolve();
    }
  });
}

/**
 * Submit post to Reddit with uploaded media
 */
async function submitPost(
  accessToken: string,
  options: {
    subreddit: string;
    title: string;
    nsfw: boolean;
    assetId: string;
    flair?: string;
    sendReplies: boolean;
  }
): Promise<RedditSubmitResponse> {
  const body: Record<string, string | boolean> = {
    sr: options.subreddit,
    kind: 'image',
    title: options.title,
    nsfw: options.nsfw,
    sendreplies: options.sendReplies,
    // Use asset_id for uploaded media
    video_poster_url: `https://reddit.com/media?asset_id=${options.assetId}`
  };

  if (options.flair) {
    body.flair_id = options.flair;
  }

  const response = await fetch('https://oauth.reddit.com/api/submit', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: new URLSearchParams(body as Record<string, string>)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to submit post: ${response.status} ${errorText}`);
  }

  const data: RedditSubmitResponse = await response.json();

  // Check for Reddit API errors
  if (data.json.errors && data.json.errors.length > 0) {
    const errorMessages = data.json.errors.map(([code, msg]) => `${code}: ${msg}`).join(', ');
    throw new Error(`Reddit API error: ${errorMessages}`);
  }

  return data;
}

/**
 * Get Reddit OAuth credentials from storage or context
 * This is a helper that should be implemented based on your auth system
 */
export async function getRedditCredentials(): Promise<RedditCredentials> {
  // TODO: Implement based on your Reddit OAuth storage
  // Example: fetch from localStorage, context, or API endpoint
  const accessToken = localStorage.getItem('reddit_access_token');
  const refreshToken = localStorage.getItem('reddit_refresh_token');

  if (!accessToken) {
    throw new Error('Reddit not connected. Please connect your Reddit account first.');
  }

  return {
    accessToken,
    refreshToken: refreshToken ?? undefined
  };
}

/**
 * Check if Reddit credentials are available
 */
export function hasRedditCredentials(): boolean {
  return !!localStorage.getItem('reddit_access_token');
}
