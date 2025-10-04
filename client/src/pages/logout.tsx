import { useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';

export default function LogoutPage() {
  const { logout } = useAuth();

  useEffect(() => {
    let isActive = true;
    void logout()
      .then(() => {
        if (isActive) {
          window.location.assign('/login');
        }
      })
      .catch((error) => {
        console.error('Logout failed', error);
        if (isActive) {
          window.location.assign('/login?logoutError=1');
        }
      });
    return () => {
      isActive = false;
    };
  }, [logout]);

  return <p>Logging out...</p>;
}