import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface User {
  id: number;
  email: string;
  username?: string;
  displayName?: string;
  tier?: 'guest' | 'free' | 'basic' | 'pro' | 'premium';
  subscription?: string;
}

export function useAuth() {
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem('authToken')
  );

  const { data: user, isLoading, error, refetch } = useQuery<User>({
    queryKey: ['/api/auth/user'],
    queryFn: async () => {
      // Try session-based auth first (for existing users)
      const response = await fetch('/api/auth/user', {
        credentials: 'include' // Include cookies for session-based auth
      });
      
      if (response.ok) {
        const userData = await response.json();
        return userData;
      }
      
      // If session auth fails and we have a token, try token-based auth
      if (token && response.status === 401) {
        const tokenResponse = await fetch('/api/auth/user', {
          headers: {
            'Authorization': `Bearer ${token}`
          },
          credentials: 'include'
        });
        
        if (tokenResponse.ok) {
          return tokenResponse.json();
        }
        
        if (tokenResponse.status === 401 || tokenResponse.status === 403) {
          localStorage.removeItem('authToken');
          localStorage.removeItem('user');
          setToken(null);
          throw new Error('Token expired');
        }
      }
      
      throw new Error('Not authenticated');
    },
    retry: false,
  });

  const login = (newToken: string, userData: User) => {
    localStorage.setItem('authToken', newToken);
    localStorage.setItem('user', JSON.stringify(userData));
    setToken(newToken);
    refetch();
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

  return {
    user,
    isLoading,
    isAuthenticated: !!user && !error,
    login,
    logout,
    token
  };
}