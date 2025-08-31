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
    
    // No longer handling Reddit OAuth connections
    
    // Handle OAuth errors
    if (error) {
      let errorMessage = "Authentication failed. Please try again.";
      
      // General OAuth error handling
      if (error === 'oauth-not-implemented') {
        errorMessage = "Social login is being set up. Please try again later.";
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
          <p className="mt-4 text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Determine admin status and user tier
  const isAdmin = user && (user.id === 999 || user.username === 'admin' || user.isAdmin || user.email === 'thottopilot@thottopilot.com');
  const userTier = isAdmin ? 'admin' : (user?.tier || 'free');
  
  // Check Reddit connection status
  const isRedditConnected = !!(user as any)?.reddit_username || !!(user as any)?.provider;
  
  return (
    <ModernDashboard 
      user={user} 
      userTier={userTier} 
      isAdmin={isAdmin}
      isRedditConnected={isRedditConnected}
    />
  );
}