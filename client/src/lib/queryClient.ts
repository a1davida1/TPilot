import { QueryClient, QueryFunction } from "@tanstack/react-query";

// Enhanced error interface for better error handling
export interface ApiError extends Error {
  status: number;
  statusText: string;
  isAuthError?: boolean;
  userMessage?: string;
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
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T = unknown>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const headers: Record<string, string> = {};
    
    

    const url = queryKey[0] as string;
    const res = await fetch(url, {
      credentials: "include",
      headers,
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
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
