import { useLocation } from 'wouter';
import { PasswordChangeForm } from '@/components/PasswordChangeForm';
import { useAuth } from '@/hooks/useAuth';
import { useEffect } from 'react';
import type { User } from '@shared/schema';

export default function ChangePasswordPage() {
  const [location, navigate] = useLocation();
  const { user } = useAuth();

  // Get userId from URL params
  const urlParams = new URLSearchParams(window.location.search);
  const userId = urlParams.get('userId');

  useEffect(() => {
    // If user is already logged in normally (not requiring password change), redirect to dashboard
    if (user && !(user as User).mustChangePassword) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handlePasswordChangeSuccess = () => {
    // After successful password change, redirect to dashboard
    navigate('/dashboard');
  };

  if (!userId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black flex items-center justify-center p-4">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white mb-4">Invalid Request</h1>
          <p className="text-gray-400 mb-4">No user ID provided for password change.</p>
          <button 
            onClick={() => navigate('/')}
            className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white px-6 py-2 rounded-lg"
            data-testid="button-back-home"
          >
            Back to Home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-white mb-2">ThottoPilot</h1>
          <p className="text-gray-400">Secure Password Update</p>
        </div>
        
        <PasswordChangeForm 
          userId={parseInt(userId)} 
          onSuccess={handlePasswordChangeSuccess}
        />
      </div>
    </div>
  );
}