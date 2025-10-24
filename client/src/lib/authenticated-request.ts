import { getCsrfToken, clearCsrfToken } from './queryClient';

export async function authenticatedRequest<T>(
  url: string,
  method: string = 'GET',
  data?: unknown
): Promise<T> {
  let body: FormData | string | undefined;
  const headers: Record<string, string> = {};

  // Prepare body and headers
  if (data instanceof FormData) {
    body = data;
    // Don't set Content-Type for FormData, browser sets it with boundary
  } else if (data) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(data);
  }

  // Include CSRF token for state-changing requests
  if (typeof window !== 'undefined' && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method.toUpperCase())) {
    try {
      const token = await getCsrfToken();
      if (token) {
        // Include token in header
        headers['x-csrf-token'] = token;

        // Include token in body for redundancy
        if (data instanceof FormData) {
          data.append('_csrf', token);
        } else if (data && typeof data === 'object') {
          (data as Record<string, unknown> & { _csrf?: string })._csrf = token;
          // Re-stringify with token included
          if (headers['Content-Type'] === 'application/json') {
            body = JSON.stringify(data);
          }
        }
      }
    } catch (error) {
      console.warn('Unable to get CSRF token:', error);
    }
  }

  const response = await fetch(url, {
    method,
    headers,
    body,
    credentials: 'include' // Include session cookies for authentication
  });

  // Handle CSRF token errors with retry
  if (response.status === 403 && ['POST', 'PUT', 'DELETE', 'PATCH'].includes(method.toUpperCase())) {
    const clonedResponse = response.clone();
    try {
      const responseText = await clonedResponse.text();
      if (responseText.toLowerCase().includes('csrf')) {
        console.warn('CSRF token validation failed, fetching new token and retrying...');

        // Clear the stale token
        clearCsrfToken();

        // Get a fresh token
        const newToken = await getCsrfToken();
        if (newToken) {
          headers['x-csrf-token'] = newToken;

          // Update token in body
          if (data instanceof FormData) {
            data.set('_csrf', newToken);
          } else if (data && typeof data === 'object') {
            (data as Record<string, unknown> & { _csrf?: string })._csrf = newToken;
            if (headers['Content-Type'] === 'application/json') {
              body = JSON.stringify(data);
            }
          }

          // Retry the request
          const retryResponse = await fetch(url, {
            method,
            headers,
            body,
            credentials: 'include',
          });

          // Handle retry response
          if (!retryResponse.ok) {
            const errorText = await retryResponse.text();
            let errorMessage;
            try {
              const errorJson = JSON.parse(errorText);
              errorMessage = errorJson.message || errorText;
            } catch {
              errorMessage = errorText || retryResponse.statusText;
            }
            throw new Error(errorMessage);
          }

          if (retryResponse.status === 204) {
            return {} as T;
          }

          const contentType = retryResponse.headers.get('content-type');
          if (contentType?.includes('application/json')) {
            return retryResponse.json() as Promise<T>;
          }

          return {} as T;
        }
      }
    } catch (error) {
      // If retry logic fails, fall through to normal error handling
      console.error('Error during CSRF retry:', error);
    }
  }

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage;
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.message || errorText;
    } catch {
      errorMessage = errorText || response.statusText;
    }
    throw new Error(errorMessage);
  }

  if (response.status === 204) {
    return {} as T;
  }

  const contentType = response.headers.get('content-type');
  if (contentType?.includes('application/json')) {
    return response.json() as Promise<T>;
  }

  return {} as T;
}
