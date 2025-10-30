/**
 * MobileMenu Component
 * 
 * Slide-over mobile navigation menu with workflow sections.
 * Uses Sheet component for smooth slide-in animation.
 * Ensures all touch targets are 44x44px minimum.
 */

import { useLocation } from 'wouter';
import { X } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useAuth } from '@/hooks/useAuth';
import { 
  workflowBuckets, 
  filterWorkflowBucketsByAccess,
  type AccessContext 
} from '@/config/navigation';
import { cn } from '@/lib/utils';

interface MobileMenuProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileMenu({ open, onOpenChange }: MobileMenuProps) {
  const { user, isAuthenticated } = useAuth();
  const [location, setLocation] = useLocation();

  // Build access context for filtering
  const userTier = user?.tier || 'free';
  const accessContext: AccessContext = {
    isAuthenticated,
    tier: (userTier === 'free' || userTier === 'pro' || userTier === 'premium' || userTier === 'admin') ? userTier : 'free',
    isAdmin: Boolean(user?.isAdmin || user?.role === 'admin'),
  };

  // Filter workflow buckets based on user access
  const availableBuckets = filterWorkflowBucketsByAccess(workflowBuckets, accessContext);

  const handleNavigate = (href: string) => {
    setLocation(href);
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-[300px] sm:w-[350px] p-0">
        <SheetHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg font-bold bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
              Navigation
            </SheetTitle>
            <SheetClose asChild>
              <Button 
                variant="ghost" 
                size="icon"
                className="h-11 w-11" // 44px touch target
              >
                <X className="h-5 w-5" />
                <span className="sr-only">Close</span>
              </Button>
            </SheetClose>
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-5rem)]">
          <div className="px-4 py-6 space-y-6">
            {availableBuckets.map((bucket, bucketIndex) => (
              <div key={bucket.key}>
                {/* Section Header */}
                <div className="px-2 mb-3">
                  <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {bucket.label}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {bucket.description}
                  </p>
                </div>

                {/* Section Routes */}
                <div className="space-y-1">
                  {bucket.routes.map((route) => {
                    const Icon = route.icon;
                    const isActive = location === route.href;
                    
                    return (
                      <button
                        key={route.key}
                        onClick={() => handleNavigate(route.href)}
                        className={cn(
                          "flex items-center gap-3 w-full px-3 py-3 rounded-lg", // py-3 ensures 44px+ height
                          "transition-all duration-200",
                          "min-h-[44px]", // Ensure minimum touch target
                          isActive
                            ? "bg-pink-100 dark:bg-pink-950/30 text-pink-600 dark:text-pink-400 font-semibold"
                            : "hover:bg-accent active:bg-accent/80"
                        )}
                      >
                        <div className={cn(
                          "flex h-10 w-10 items-center justify-center rounded-lg flex-shrink-0",
                          isActive 
                            ? "bg-pink-200 dark:bg-pink-900/50 text-pink-600 dark:text-pink-400" 
                            : "bg-muted text-muted-foreground"
                        )}>
                          <Icon className="h-5 w-5" />
                        </div>
                        
                        <div className="flex-1 text-left min-w-0">
                          <div className="text-sm font-medium leading-none mb-1">
                            {route.label}
                          </div>
                          <div className="text-xs text-muted-foreground line-clamp-1">
                            {route.description}
                          </div>
                        </div>
                        
                        {route.proOnly && (
                          <Badge 
                            variant="secondary" 
                            className="text-[10px] px-2 py-0.5 bg-gradient-to-r from-pink-500 to-purple-500 text-white border-0"
                          >
                            PRO
                          </Badge>
                        )}
                      </button>
                    );
                  })}
                </div>

                {/* Separator between sections (except last) */}
                {bucketIndex < availableBuckets.length - 1 && (
                  <Separator className="my-4" />
                )}
              </div>
            ))}
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
