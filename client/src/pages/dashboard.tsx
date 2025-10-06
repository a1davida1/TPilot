import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { ModernDashboard } from "@/components/modern-dashboard";
import { useToast } from "@/hooks/use-toast";
import { type User } from "@shared/schema.js";

// DashboardUser type - User already has redditUsername field
type DashboardUser = User & {
  reddit_username?: string | null; // For backwards compatibility
};

const ALLOWED_USER_TIERS = [
  'guest',
  'free',
  'basic',
  'starter',
  'pro',
  'premium',
  'admin',
] as const;

type AllowedUserTier = (typeof ALLOWED_USER_TIERS)[number];

const allowedUserTierSet: ReadonlySet<AllowedUserTier> = new Set(ALLOWED_USER_TIERS);

const DEFAULT_AUTHENTICATED_TIER: AllowedUserTier = 'free';
const DEFAULT_GUEST_TIER: AllowedUserTier = 'guest';

function isAllowedTier(tier: unknown): tier is AllowedUserTier {
  return typeof tier === 'string' && allowedUserTierSet.has(tier as AllowedUserTier);
}

function isAdminUser(user: Partial<User> | null | undefined): boolean {
  return Boolean(
    user &&
      (user.id === 999 ||
        user.username === 'admin' ||
        user.isAdmin ||
        user.email === 'thottopilot@thottopilot.com')
  );
}

function resolveUserTier(user: Partial<User> | null | undefined): AllowedUserTier {
  if (!user) {
    return DEFAULT_GUEST_TIER;
  }

  if (isAdminUser(user)) {
    return 'admin';
  }

  if (isAllowedTier(user.tier)) {
    return user.tier;
  }

  return DEFAULT_AUTHENTICATED_TIER;
}

export default function Dashboard() {
  const [_isGuestMode, setIsGuestMode] = useState(false);
  const [location] = useLocation();
  const { user, isLoading, isAuthenticated, refetch } = useAuth();
  const { toast } = useToast();

  // Check for OAuth callbacks, email verification, and guest mode
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const reddit = urlParams.get('reddit');
    const error = urlParams.get('error');
    const guest = urlParams.get('guest');
    const verified = urlParams.get('verified');
    const welcome = urlParams.get('welcome');
    
    // Handle email verification success
    if (verified === 'true') {
      toast({
        title: welcome === 'true' ? "Welcome to ThottoPilot!" : "Email Verified",
        description: welcome === 'true' 
          ? "Your account has been verified successfully. Welcome aboard!" 
          : "Your email has been verified successfully.",
        variant: "default",
      });
      // Clean URL
      window.history.replaceState({}, '', '/dashboard');
    }
    
    // Handle Reddit OAuth connections
    if (reddit === 'connected') {
      const username = urlParams.get('username') || undefined;
      if (window.opener) {
        window.opener.postMessage(
          { type: 'redditConnected', username },
          window.origin
        );
        window.close();
        return;
      } else {
        toast({
          title: 'Reddit Connected',
          description: username
            ? `Connected as u/${username}`
            : 'Reddit account linked successfully.',
        });
        refetch();
      }
      window.history.replaceState({}, '', '/dashboard');
    }

    // Handle OAuth errors
    if (error) {
      const errorMessages: Record<string, string> = {
        'oauth-not-implemented': 'Social login is being set up. Please try again later.',
        'reddit_access_denied': 'Reddit access was denied. Please try again.',
        'reddit_missing_params': 'Reddit authentication is incomplete. Please try again.',
        'invalid_state': 'Security validation failed. Please try again.',
        'reddit_token_exchange_failed': 'Failed to connect to Reddit. Please try again.',
        'reddit_profile_failed': 'Could not retrieve Reddit profile. Please try again.',
        'reddit_connection_failed': 'Reddit connection failed. Please try again.',
        'reddit_failed': 'Reddit sign-in failed. Please try again.',
        'google_failed': 'Google sign-in failed. Please try again.',
        'facebook_failed': 'Facebook sign-in failed. Please try again.',
      };
      
      toast({
        title: "Connection Failed",
        description: errorMessages[error] || "Authentication failed. Please try again.",
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  // Determine admin status and user tier
  const isAdmin = isAdminUser(user);
  const userTier = resolveUserTier(user);
  
  // Check Reddit connection status
  const typedUser = user as DashboardUser;
  const isRedditConnected = Boolean(
    typedUser?.redditUsername ||
      typedUser?.reddit_username ||
      typedUser?.provider
  );
  
  return (
    <ModernDashboard 
      user={user ? { ...user, username: user.username || user.email || 'User' } : undefined} 
      userTier={userTier} 
      isAdmin={isAdmin}
      isRedditConnected={isRedditConnected}
    />
  );
}