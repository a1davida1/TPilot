/**
 * MobileBackButton Component
 * 
 * Contextual back button for mobile navigation.
 * Navigates to parent route (not browser history).
 * Only shown on mobile (<768px) and hidden on top-level pages.
 */

import { useLocation } from 'wouter';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Determines the parent route for a given path
 * Example: "/post-scheduling/campaigns/draft-123" -> "/post-scheduling/campaigns"
 */
function getParentRoute(path: string): string {
  const segments = path.split('/').filter(Boolean);
  
  // If at root or single segment, go to dashboard
  if (segments.length <= 1) {
    return '/dashboard';
  }
  
  // Remove last segment to get parent
  segments.pop();
  return `/${segments.join('/')}`;
}

/**
 * Checks if the current route is a top-level page
 * Top-level pages: /, /dashboard, /login, /signup
 */
function isTopLevelPage(path: string): boolean {
  const topLevelPages = ['/', '/dashboard', '/login', '/signup', '/register'];
  return topLevelPages.includes(path);
}

export function MobileBackButton() {
  const [location, setLocation] = useLocation();
  
  // Don't show on top-level pages
  if (isTopLevelPage(location)) {
    return null;
  }
  
  const parentRoute = getParentRoute(location);
  
  const handleBack = () => {
    setLocation(parentRoute);
  };
  
  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleBack}
      className="md:hidden h-9 w-9"
      aria-label="Go back"
    >
      <ArrowLeft className="h-5 w-5" />
    </Button>
  );
}
