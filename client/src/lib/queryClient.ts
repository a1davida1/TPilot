import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Enhanced error interface for better error handling
export interface ApiError extends Error {
  status: number;
  statusText: string;
  isAuthError?: boolean;
  userMessage?: string;
  code?: string;
  email?: string;
  responseBody?: unknown;
}

// CSRF token management
let csrfToken: string | null = null;
let csrfTokenPromise: Promise<string> | null = null;

export async function getCsrfToken(): Promise<string> {
  // If we have a valid token, return it
  if (csrfToken) {
    return csrfToken;
  }

  // If we're already fetching a token, wait for that request
  if (csrfTokenPromise) {
    return csrfTokenPromise;
  }

  // Otherwise, fetch a new token
  csrfTokenPromise = fetch('/api/csrf-token', {
    method: 'GET',
    credentials: 'include',
  })
    .then(async (res) => {
      if (!res.ok) {
        throw new Error('Failed to fetch CSRF token');
      }
      const data = await res.json();
      csrfToken = data.csrfToken;
      
      // Also read from XSRF-TOKEN cookie if available
      const cookies = document.cookie.split(';');
      for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'XSRF-TOKEN') {
          csrfToken = decodeURIComponent(value);
          break;
        }
      }
      
      return csrfToken || '';
    })
    .finally(() => {
      csrfTokenPromise = null;
    });

  return csrfTokenPromise;
}

// Clear CSRF token when auth changes
export function clearCsrfToken() {
  csrfToken = null;
  csrfTokenPromise = null;
}

// Helper function to get an error message based on status and error data
function getErrorMessage(status: number, errorData: Record<string, unknown>): string | undefined {
  if (errorData.message && typeof errorData.message === 'string') {
    return errorData.message;
  }
  switch (status) {
    case 401:
      return "Authentication failed. Please log in again.";
    case 403:
      return "You do not have permission to access this resource.";
    case 404:
      return "The requested resource was not found.";
    default:
      return `An error occurred: ${status}`;
  }
}

async function throwIfResNotOk(res: Response) {
  if (res.ok) {
    return;
  }

  let parsedBody: unknown;
  let bodyText: string | undefined;

  try {
    parsedBody = await res.clone().json();
  } catch (error) {
    if (error instanceof Error) {
      // Ignore JSON parse errors and fall back to text handling below
    }
  }

  if (parsedBody === undefined) {
    try {
      const text = await res.clone().text();
      bodyText = text || undefined;
    } catch (error) {
      if (error instanceof Error) {
        bodyText = undefined;
      }
    }
  } else if (typeof parsedBody === "string") {
    bodyText = parsedBody;
  } else {
    try {
      bodyText = JSON.stringify(parsedBody);
    } catch (error) {
      if (error instanceof Error) {
        bodyText = undefined;
      }
    }
  }

  const logMessage = bodyText ?? res.statusText;
  console.error(`❌ API Error: ${res.status} ${res.statusText} - ${logMessage}`);

  const serverMessage =
    typeof parsedBody === "object" && parsedBody !== null && "message" in parsedBody &&
    typeof (parsedBody as { message: unknown }).message === "string"
      ? (parsedBody as { message: string }).message
      : undefined;
  const serverCode =
    typeof parsedBody === "object" && parsedBody !== null && "code" in parsedBody &&
    typeof (parsedBody as { code: unknown }).code === "string"
      ? (parsedBody as { code: string }).code
      : undefined;
  const serverEmail =
    typeof parsedBody === "object" && parsedBody !== null && "email" in parsedBody &&
    typeof (parsedBody as { email: unknown }).email === "string"
      ? (parsedBody as { email: string }).email
      : undefined;

  const fallbackText = serverMessage ?? bodyText ?? res.statusText;

  // Create enhanced error object
  const error = new Error(fallbackText ? `${res.status}: ${fallbackText}` : `${res.status}`) as ApiError;
  error.status = res.status;
  error.statusText = res.statusText;
  error.responseBody = parsedBody ?? bodyText;

  if (serverMessage) {
    error.message = serverMessage;
    error.userMessage = serverMessage;
  }

  if (serverCode) {
    error.code = serverCode;
  }

  if (serverEmail) {
    error.email = serverEmail;
  }

  // Enhanced error messages for common auth scenarios
  if (res.status === 401) {
    error.isAuthError = true;
    if (!error.userMessage) {
      if (fallbackText.includes("Access token required")) {
        error.userMessage = "Please log in to continue. Creating an account takes just 30 seconds!";
      } else if (fallbackText.includes("Invalid credentials")) {
        error.userMessage = "Invalid login credentials. Please check your username/email and password.";
      } else if (fallbackText.includes("Email not verified")) {
        error.userMessage = "Please verify your email before logging in. Check your inbox for the verification link.";
      } else {
        error.userMessage = "Authentication required. Please log in to access this feature.";
      }
    }
  } else if (res.status === 403) {
    error.isAuthError = true;
    if (!error.userMessage) {
      if (fallbackText.includes("Insufficient permissions")) {
        error.userMessage = "You don't have permission to perform this action. Please contact support if you think this is an error.";
      } else {
        error.userMessage = "Access denied. Please ensure you're logged in with the correct account.";
      }
    }
  } else if (res.status === 404) {
    if (!error.userMessage) {
      error.userMessage = "The requested resource was not found. Please check the URL or try again.";
    }
  } else if (res.status >= 500) {
    if (!error.userMessage) {
      error.userMessage = "Server error occurred. Please try again in a few moments.";
    }
  }

  throw error;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown,
): Promise<Response> {
  const headers: Record<string, string> = {};
  let body: BodyInit | undefined;

  // Phase 3: Use in-memory token with auto-refresh
  if (typeof window !== "undefined") {
    try {
      // Try memory first (new), fallback to localStorage (backwards compat)
      const {
        getAccessToken,
        refreshAccessToken,
        hasRefreshableToken,
      } = await import('@/lib/auth');
      let token = getAccessToken();
      
      // If no token in memory, try localStorage for backwards compatibility (one-time migration)
      if (!token && window.localStorage?.getItem("authToken")) {
        const oldToken = window.localStorage.getItem("authToken");
        if (oldToken) {
          // Migrate to memory
          const { setAccessToken } = await import('@/lib/auth');
          setAccessToken(oldToken);
          token = getAccessToken(); // Get it again (might be expired)
          
          // Clear from localStorage after migration
          window.localStorage.removeItem("authToken");
        }
      }
      
      // Only attempt refresh if we previously had a token (even if expired)
      // Don't refresh on initial page load when user never logged in
      if (!token && hasRefreshableToken()) {
        token = await refreshAccessToken();
      }
      
      if (token && !headers["Authorization"]) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    } catch (error) {
      console.warn("Unable to access auth token", error);
    }
  }

  // Always include CSRF token for state-changing requests (POST, PUT, DELETE, PATCH)
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

  if (data instanceof FormData) {
    body = data;
  } else if (data !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(data);
  }

  const res = await fetch(url, {
    method,
    headers,
    body,
    credentials: "include", // Cookie-based auth only
  });

  // If we get a 403 with CSRF error, clear token and retry once
  if (res.status === 403) {
    // Clone response so we can read body multiple times
    const clonedRes = res.clone();
    const text = await clonedRes.text();
    
    if (text.includes('CSRF') || text.includes('csrf')) {
      clearCsrfToken();
      
      // Retry with fresh token
      const newToken = await getCsrfToken();
      if (newToken) {
        headers['X-CSRF-Token'] = newToken;
        
        const retryRes = await fetch(url, {
          method,
          headers,
          body,
          credentials: "include",
        });
        
        await throwIfResNotOk(retryRes);
        return retryRes;
      }
    }
    
    // Not a CSRF error, use throwIfResNotOk for proper error handling
    await throwIfResNotOk(res);
    return res;
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T = unknown>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: _unauthorizedBehavior }) =>
  async ({ queryKey: key, signal }) => {
    // Validate that the key is a string or array containing string
    let queryKey: string;
    if (Array.isArray(key)) {
      queryKey = String(key[0]);
    } else {
      queryKey = String(key);
    }
    const url = queryKey.startsWith('/') ? queryKey : `/${queryKey}`;

    if (!queryKey || typeof queryKey !== 'string') {
      throw new Error('Invalid query key');
    }

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      const response = await fetch(url, {
        signal,
        credentials: 'include', // Always include cookies
        headers
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as Record<string, unknown>;
        const errorMessage = typeof errorData.message === 'string' ? errorData.message : response.statusText;
        const error: ApiError = new Error(errorMessage) as ApiError;
        error.status = response.status;
        error.statusText = response.statusText;
        error.isAuthError = response.status === 401 || response.status === 403;
        error.userMessage = getErrorMessage(response.status, errorData);

        // If it's an auth error, call logout endpoint and redirect to login
        if (error.isAuthError) {
          try {
            await fetch('/api/auth/logout', {
              method: 'POST',
              credentials: 'include',
              headers: {
                'Content-Type': 'application/json',
              },
            });
          } catch {
            // Token refresh failed, user needs to re-login
          }
          if (window.location.pathname !== '/' && window.location.pathname !== '/login') {
            window.location.href = '/';
          }
        }

        throw error;
      }

      const contentType = response.headers.get('content-type');
      if (contentType?.includes('application/json')) {
        return response.json();
      }

      return response.text();
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw error;
      }

      // Enhanced error handling for network issues
      if (error instanceof TypeError && error.message.includes('fetch')) {
        const networkError: ApiError = new Error('Network connection failed') as ApiError;
        networkError.status = 0;
        networkError.statusText = 'Network Error';
        networkError.userMessage = 'Please check your internet connection and try again.';
        throw networkError;
      }

      throw error;
    }
  };


export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});