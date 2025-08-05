import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

interface User {
  id: string;
  email: string;
  username?: string;
  displayName?: string;
  subscription?: string;
}

export function useAuth() {
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem('authToken')
  );

  const { data: user, isLoading, error, refetch } = useQuery<User>({
    queryKey: ['/api/auth/user'],
    queryFn: async () => {
      if (!token) throw new Error('No token');
      
      const response = await fetch('/api/auth/user', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          localStorage.removeItem('authToken');
          localStorage.removeItem('user');
          setToken(null);
          throw new Error('Token expired');
        }
        throw new Error('Failed to fetch user');
      }
      
      return response.json();
    },
    enabled: !!token,
    retry: false,
  });

  const login = (newToken: string, userData: User) => {
    localStorage.setItem('authToken', newToken);
    localStorage.setItem('user', JSON.stringify(userData));
    setToken(newToken);
    refetch();
  };

  const logout = () => {
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    setToken(null);
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!token && !!user && !error,
    login,
    logout,
    token
  };
}