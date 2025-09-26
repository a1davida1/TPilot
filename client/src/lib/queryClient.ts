import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Enhanced error interface for better error handling
export interface ApiError extends Error {
  status: number;
  statusText: string;
  isAuthError?: boolean;
  userMessage?: string;
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
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    console.error(`❌ API Error: ${res.status} ${res.statusText} - ${text}`);

    // Create enhanced error object
    const error = new Error(`${res.status}: ${text}`) as ApiError;
    error.status = res.status;
    error.statusText = res.statusText;

    // Enhanced error messages for common auth scenarios
    if (res.status === 401) {
      error.isAuthError = true;
      if (text.includes("Access token required")) {
        error.userMessage = "Please log in to continue. Creating an account takes just 30 seconds!";
      } else if (text.includes("Invalid credentials")) {
        error.userMessage = "Invalid login credentials. Please check your username/email and password.";
      } else if (text.includes("Email not verified")) {
        error.userMessage = "Please verify your email before logging in. Check your inbox for the verification link.";
      } else {
        error.userMessage = "Authentication required. Please log in to access this feature.";
      }
    } else if (res.status === 403) {
      error.isAuthError = true;
      if (text.includes("Insufficient permissions")) {
        error.userMessage = "You don't have permission to perform this action. Please contact support if you think this is an error.";
      } else {
        error.userMessage = "Access denied. Please ensure you're logged in with the correct account.";
      }
    } else if (res.status === 404) {
      error.userMessage = "The requested resource was not found. Please check the URL or try again.";
    } else if (res.status >= 500) {
      error.userMessage = "Server error occurred. Please try again in a few moments.";
    } else {
      error.userMessage = `Request failed: ${text}`;
    }

    throw error;
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown,
): Promise<Response> {
  const headers: Record<string, string> = {};
  let body: BodyInit | undefined;

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

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T = unknown>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
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
          } catch (logoutError) {
            console.error('Failed to log out after auth error:', logoutError);
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