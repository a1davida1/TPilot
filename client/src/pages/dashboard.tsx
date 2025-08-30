import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { ModernDashboard } from "@/components/modern-dashboard";
import { useToast } from "@/hooks/use-toast";

export default function Dashboard() {
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [location] = useLocation();
  const { user, isLoading, isAuthenticated, refetch } = useAuth();
  const { toast } = useToast();

  // Check for OAuth callbacks and guest mode
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const reddit = urlParams.get('reddit');
    const error = urlParams.get('error');
    const guest = urlParams.get('guest');
    
    // Handle Reddit connection success
    if (reddit === 'connected') {
      toast({
        title: "Reddit Connected! 🎉",
        description: "Your Reddit account has been successfully linked.",
        variant: "default",
      });
      // Clean URL
      window.history.replaceState({}, '', '/dashboard');
      // Refetch user to get updated data
      refetch();
    }
    
    // Handle OAuth errors
    if (error) {
      let errorMessage = "Authentication failed. Please try again.";
      if (error === 'oauth-not-implemented') {
        errorMessage = "Reddit integration is being set up. Please try again later.";
      } else if (error === 'reddit_auth_failed') {
        errorMessage = "Reddit authentication failed. Please try again.";
      }
      
      toast({
        title: "Connection Failed",
        description: errorMessage,
        variant: "destructive",
      });
      // Clean URL
      window.history.replaceState({}, '', '/dashboard');
    }
    
    // Set guest mode
    setIsGuestMode(guest === 'true' || !isAuthenticated);
  }, [location, isAuthenticated, toast, refetch]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  return <ModernDashboard isRedditConnected={user?.provider === 'reddit'} />;
}