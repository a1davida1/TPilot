import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
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
  const [token, setToken] = useState<string | null>(
    () => {
      const storedToken = localStorage.getItem('authToken');
      console.log('Stored auth token:', storedToken ? 'Found' : 'Not found');
      return storedToken;
    }
  );

  const { data: user, isLoading, error, refetch } = useQuery<User>({
    queryKey: ['/api/auth/user', token],
    queryFn: async () => {
      // If we have a token, try token-based auth first
      if (token) {
        console.log('Sending request with token:', token ? 'Token present' : 'No token');
        const tokenResponse = await fetch('/api/auth/user', {
          headers: {
            'Authorization': `Bearer ${token}`
          },
          credentials: 'include'
        });
        
        console.log('Token response status:', tokenResponse.status);
        
        if (tokenResponse.ok) {
          const userData = await tokenResponse.json();
          console.log('Token auth successful:', userData.username);
          return userData;
        }
        
        if (tokenResponse.status === 401 || tokenResponse.status === 403) {
          console.log('Token expired or invalid, clearing...');
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
    enabled: true,
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
    // Clear local storage
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    setToken(null);
    
    // Also try to logout from session
    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include'
      });
    } catch (error) {
      console.log('Session logout failed:', error);
    }
  };

  // Check for OAuth redirect tokens in URL or cookies
  useEffect(() => {
    // Check URL params for OAuth success
    const urlParams = new URLSearchParams(window.location.search);
    const reddit = urlParams.get('reddit');
    const error = urlParams.get('error');
    
    if (reddit === 'connected') {
      console.log('Reddit connected successfully!');
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
          console.log('User authenticated via OAuth:', userData.username);
          refetch();
        }
      }
    };
    
    // Only check cookie auth if no token in localStorage
    if (!token && (reddit || error)) {
      checkCookieAuth();
    }
  }, [refetch]);

  // Quick admin login function for testing
  const quickAdminLogin = async () => {
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'thottopilot@thottopilot.com',
          password: 'Struggle123!*'
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        login(data.token, data.user);
      }
    } catch (error) {
      console.error('Quick login failed:', error);
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
    quickAdminLogin
  };
}