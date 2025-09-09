import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface User {
  id: number;
  email: string;
  username?: string;
  displayName?: string;
  tier?: 'guest' | 'free' | 'basic' | 'starter' | 'pro' | 'premium' | 'admin';
  subscription?: string;
  isAdmin?: boolean;
  subscription_status?: string;
  role?: string;
}

export function useAuth() {
  const queryClient = useQueryClient();
  const [token, setToken] = useState<string | null>(
    () => {
      const storedToken = localStorage.getItem('authToken');
      return storedToken;
    }
  );

  // Check if we're on a public page that doesn't need auth
  const isPublicPage = () => {
    const path = window.location.pathname;
    const publicPaths = [
      '/forgot-password',
      '/reset-password',
      '/email-verification',
      '/change-password'
    ];
    return publicPaths.includes(path);
  };

  const { data: user, isLoading, error, refetch } = useQuery<User>({
    queryKey: ['/api/auth/user', token],
    queryFn: async () => {
      // If we have a token, try token-based auth first
      if (token) {
        const tokenResponse = await fetch('/api/auth/user', {
          headers: {
            'Authorization': `Bearer ${token}`
          },
          credentials: 'include'
        });
        
        
        if (tokenResponse.ok) {
          const userData = await tokenResponse.json();
          return userData;
        }
        
        if (tokenResponse.status === 401 || tokenResponse.status === 403) {
          localStorage.removeItem('authToken');
          localStorage.removeItem('user');
          setToken(null);
          // Return null instead of throwing to prevent endless retry loop
          return null;
        }
      }
      
      // Try session-based auth as fallback
      const response = await fetch('/api/auth/user', {
        credentials: 'include' // Include cookies for session-based auth
      });
      
      if (response.ok) {
        const userData = await response.json();
        return userData;
      }
      
      // Return null instead of throwing error to allow guest mode
      return null;
    },
    retry: false,
    // Skip request unless we have a token or auth cookie
    enabled:
      !isPublicPage() && (!!token || document.cookie.includes('authToken')),
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });

  const login = (newToken: string, userData: User) => {
    localStorage.setItem('authToken', newToken);
    localStorage.setItem('user', JSON.stringify(userData));
    setToken(newToken);
    setTimeout(() => refetch(), 100); // Small delay to ensure token is set
  };

  const logout = async () => {
    // Invalidate user cache immediately
    queryClient.removeQueries({ queryKey: ['/api/auth/user'] });
    
    // Clear local storage
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    setToken(null);
    
    // Logout from session
    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        credentials: 'include'
      });
      
      if (!response.ok) {
        console.error('Session logout failed:', response.status);
      }
    } catch (error) {
      console.error('Session logout error:', error);
    }
    
    // Force refetch to clear user state
    refetch();
  };

  // Check for OAuth redirect tokens in URL or cookies
  useEffect(() => {
    // Check URL params for OAuth success
    const urlParams = new URLSearchParams(window.location.search);
    const reddit = urlParams.get('reddit');
    const error = urlParams.get('error');
    
    if (reddit === 'connected') {
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
      // Refetch user to get updated Reddit connection status
      refetch();
    }
    
    if (error) {
      console.error('OAuth error:', error);
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }
    
    // Check for auth token in cookies (set by backend after OAuth)
    const checkCookieAuth = async () => {
      const response = await fetch('/api/auth/user', {
        credentials: 'include'
      });
      
      if (response.ok) {
        const userData = await response.json();
        if (userData && userData.id) {
          // User is authenticated via cookie/session
          refetch();
        }
      }
    };
    
    // Only check cookie auth if no token in localStorage
    if (!token && (reddit || error)) {
      checkCookieAuth();
    }
  }, [refetch]);

  // Quick admin login - development only
  const quickAdminLogin = async () => {
    if (import.meta.env.MODE !== 'development') {
      throw new Error('Admin backdoor disabled in production');
    }
    
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: process.env.VITE_ADMIN_EMAIL || 'thottopilot@thottopilot.com',
          password: process.env.VITE_ADMIN_PASSWORD || 'Struggle123!*'
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        login(data.token, data.user);
      }
    } catch (error) {
      // Silent fail in production
    }
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
    token,
    refetch,
    ...(import.meta.env.MODE === 'development' && { quickAdminLogin })
  };
}