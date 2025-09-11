import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';

export default function LogoutPage() {
  const { logout } = useAuth();

  useEffect(() => {
    logout().finally(() => window.location.href = '/');
  }, [logout]);

  return <p>Logging out...</p>;
}