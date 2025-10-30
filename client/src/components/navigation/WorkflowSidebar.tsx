/**
 * WorkflowSidebar Component
 * 
 * Desktop sidebar with workflow-based navigation sections.
 * Displays 4 workflow buckets: Create, Protect, Schedule, Analyze
 * with collapsible sub-items and active state highlighting.
 */

import { useState } from 'react';
import { useLocation } from 'wouter';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/hooks/useAuth';
import { 
  workflowBuckets, 
  filterWorkflowBucketsByAccess,
  type AccessContext,
  type WorkflowBucketKey
} from '@/config/navigation';
import { cn } from '@/lib/utils';

export function WorkflowSidebar() {
  const { user, isAuthenticated } = useAuth();
  const [location, setLocation] = useLocation();
  const [expandedSections, setExpandedSections] = useState<Set<WorkflowBucketKey>>(
    new Set(['create', 'protect', 'schedule', 'analyze']) // All expanded by default
  );

  // Build access context for filtering
  const userTier = user?.tier || 'free';
  const accessContext: AccessContext = {
    isAuthenticated,
    tier: (userTier === 'free' || userTier === 'pro' || userTier === 'premium' || userTier === 'admin') ? userTier : 'free',
    isAdmin: Boolean(user?.isAdmin || user?.role === 'admin'),
  };

  // Filter workflow buckets based on user access
  const availableBuckets = filterWorkflowBucketsByAccess(workflowBuckets, accessContext);

  const toggleSection = (key: WorkflowBucketKey) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <aside className="hidden lg:block w-64 border-r border-border bg-background">
      <ScrollArea className="h-[calc(100vh-4rem)]">
        <div className="p-4 space-y-6">
          {availableBuckets.map((bucket) => {
            const isExpanded = expandedSections.has(bucket.key);
            
            return (
              <div key={bucket.key}>
                {/* Section Header */}
                <button
                  onClick={() => toggleSection(bucket.key)}
                  className={cn(
                    "flex items-center justify-between w-full px-2 py-1.5 mb-2",
                    "text-sm font-semibold text-muted-foreground",
                    "hover:text-foreground transition-colors",
                    "group"
                  )}
                >
                  <span>{bucket.label}</span>
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                  ) : (
                    <ChevronRight className="h-4 w-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                  )}
                </button>

                {/* Section Routes */}
                {isExpanded && (
                  <div className="space-y-1">
                    {bucket.routes.map((route) => {
                      const Icon = route.icon;
                      const isActive = location === route.href;
                      
                      return (
                        <button
                          key={route.key}
                          onClick={() => setLocation(route.href)}
                          className={cn(
                            "flex items-center gap-3 w-full px-3 py-2 rounded-lg",
                            "transition-all duration-200",
                            "group",
                            isActive
                              ? "bg-pink-100 dark:bg-pink-950/30 text-pink-600 dark:text-pink-400 font-semibold shadow-sm"
                              : "hover:bg-accent text-foreground"
                          )}
                        >
                          <Icon className={cn(
                            "h-4 w-4 flex-shrink-0",
                            isActive 
                              ? "text-pink-600 dark:text-pink-400" 
                              : "text-muted-foreground group-hover:text-foreground"
                          )} />
                          
                          <span className="flex-1 text-left text-sm">
                            {route.label}
                          </span>
                          
                          {route.proOnly && (
                            <Badge 
                              variant="secondary" 
                              className="text-[10px] px-1.5 py-0 bg-gradient-to-r from-pink-500 to-purple-500 text-white border-0"
                            >
                              PRO
                            </Badge>
                          )}
                          
                          {route.adminOnly && (
                            <Badge 
                              variant="secondary" 
                              className="text-[10px] px-1.5 py-0 bg-gradient-to-r from-purple-500 to-blue-500 text-white border-0"
                            >
                              ADMIN
                            </Badge>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </aside>
  );
}
