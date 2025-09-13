import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface User {
  id: number;
  email: string;
  username?: string;
  displayName?: string;
  tier?: 'free' | 'starter' | 'pro';
  subscription?: string;
  isAdmin?: boolean;
  subscription_status?: string;
  role?: string;
}

export function useAuth() {
  const queryClient = useQueryClient();

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
    queryKey: ['/api/auth/user'],
    queryFn: async () => {
      // Use cookie-based authentication only
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
    // Skip request on public pages
    enabled: !isPublicPage(),
    refetchOnWindowFocus: false,
    refetchInterval: false,
  });

  const login = () => {
    // Cookie-based auth - just refetch user data
    setTimeout(() => refetch(), 100); // Small delay to ensure cookie is set
  };

  const logout = async () => {
    // Invalidate user cache immediately
    queryClient.removeQueries({ queryKey: ['/api/auth/user'] });
    
    // Ensure UI updates instantly
    queryClient.setQueryData(['/api/auth/user'], null);
    
    // Logout from session (clears HTTP-only cookie)
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
    
    // Check cookie auth if we have OAuth redirect params
    if (reddit || error) {
      checkCookieAuth();
    }
  }, [refetch]);

  // Quick admin login - development only
  const quickAdminLogin = async () => {
    if (import.meta.env.MODE !== 'development') {
      throw new Error('Admin backdoor disabled in production');
    }
    
    try {
      const email = import.meta.env.VITE_ADMIN_EMAIL;
      const password = import.meta.env.VITE_ADMIN_PASSWORD;

      if (!email || !password) {
        throw new Error('Admin credentials not configured');
      }

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      
      if (response.ok) {
        const data = await response.json();
        login();
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
    refetch,
    ...(import.meta.env.MODE === 'development' && { quickAdminLogin })
  };
}