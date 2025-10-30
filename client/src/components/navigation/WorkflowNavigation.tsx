/**
 * WorkflowNavigation Component
 * 
 * Displays workflow-based navigation dropdowns in the header.
 * Organizes features by user intent: Create, Protect, Schedule, Analyze
 */

import { useLocation } from 'wouter';
import { ChevronDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { 
  workflowBuckets, 
  filterWorkflowBucketsByAccess,
  type AccessContext 
} from '@/config/navigation';
import { cn } from '@/lib/utils';

export function WorkflowNavigation() {
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

  return (
    <nav className="hidden md:flex items-center gap-1">
      {availableBuckets.map((bucket) => (
        <DropdownMenu key={bucket.key}>
          <DropdownMenuTrigger asChild>
            <Button 
              variant="ghost" 
              className={cn(
                "gap-1.5 h-9 px-3",
                "hover:bg-accent hover:text-accent-foreground",
                "data-[state=open]:bg-accent data-[state=open]:text-accent-foreground"
              )}
            >
              {bucket.label}
              <ChevronDown className="h-3.5 w-3.5 opacity-50" />
            </Button>
          </DropdownMenuTrigger>
          
          <DropdownMenuContent align="start" className="w-72">
            <DropdownMenuLabel className="text-xs text-muted-foreground font-normal">
              {bucket.description}
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            
            {bucket.routes.map((route) => {
              const Icon = route.icon;
              const isActive = location === route.href;
              
              return (
                <DropdownMenuItem
                  key={route.key}
                  onClick={() => setLocation(route.href)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 cursor-pointer",
                    isActive && "bg-accent"
                  )}
                >
                  <div className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-lg",
                    isActive 
                      ? "bg-primary/20 text-primary" 
                      : "bg-muted text-muted-foreground"
                  )}>
                    <Icon className="h-4 w-4" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm leading-none mb-1">
                      {route.label}
                    </div>
                    <div className="text-xs text-muted-foreground line-clamp-1">
                      {route.description}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {route.proOnly && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        PRO
                      </Badge>
                    )}
                    {route.shortcut && (
                      <kbd className="hidden lg:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                        {route.shortcut}
                      </kbd>
                    )}
                  </div>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      ))}
    </nav>
  );
}
