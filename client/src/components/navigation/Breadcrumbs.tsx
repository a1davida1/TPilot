/**
 * Breadcrumbs Component
 * 
 * Desktop-only breadcrumb navigation showing hierarchical path.
 * Automatically generates breadcrumbs from current route.
 * Truncates long paths with ellipsis.
 */

import { useLocation } from 'wouter';
import { ChevronRight, Home } from 'lucide-react';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
  BreadcrumbEllipsis,
} from '@/components/ui/breadcrumb';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface BreadcrumbSegment {
  label: string;
  href: string;
}

/**
 * Converts a URL path into breadcrumb segments
 * Example: "/post-scheduling/campaigns/draft-123" -> 
 * [
 *   { label: "Post Scheduling", href: "/post-scheduling" },
 *   { label: "Campaigns", href: "/post-scheduling/campaigns" },
 *   { label: "Draft 123", href: "/post-scheduling/campaigns/draft-123" }
 * ]
 */
function generateBreadcrumbs(path: string): BreadcrumbSegment[] {
  const segments = path.split('/').filter(Boolean);
  
  if (segments.length === 0) {
    return [];
  }

  const breadcrumbs: BreadcrumbSegment[] = [];
  let currentPath = '';

  segments.forEach((segment) => {
    currentPath += `/${segment}`;
    
    // Format segment: "post-scheduling" -> "Post Scheduling"
    const label = segment
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    
    breadcrumbs.push({
      label,
      href: currentPath,
    });
  });

  return breadcrumbs;
}

export function Breadcrumbs() {
  const [location, setLocation] = useLocation();
  
  // Don't show breadcrumbs on dashboard or root
  if (location === '/' || location === '/dashboard') {
    return null;
  }

  const breadcrumbs = generateBreadcrumbs(location);
  
  // Don't show if no breadcrumbs
  if (breadcrumbs.length === 0) {
    return null;
  }

  // If more than 3 segments, show first, ellipsis, and last two
  const shouldTruncate = breadcrumbs.length > 3;
  const visibleBreadcrumbs = shouldTruncate
    ? [breadcrumbs[0], ...breadcrumbs.slice(-2)]
    : breadcrumbs;
  const hiddenBreadcrumbs = shouldTruncate
    ? breadcrumbs.slice(1, -2)
    : [];

  return (
    <Breadcrumb className="hidden md:flex">
      <BreadcrumbList>
        {/* Home / Dashboard */}
        <BreadcrumbItem>
          <BreadcrumbLink 
            onClick={() => setLocation('/dashboard')}
            className="flex items-center gap-1 cursor-pointer"
          >
            <Home className="h-3.5 w-3.5" />
            <span>Dashboard</span>
          </BreadcrumbLink>
        </BreadcrumbItem>
        
        <BreadcrumbSeparator>
          <ChevronRight className="h-4 w-4" />
        </BreadcrumbSeparator>

        {/* First breadcrumb (if truncated) */}
        {shouldTruncate && (
          <>
            <BreadcrumbItem>
              <BreadcrumbLink 
                onClick={() => setLocation(visibleBreadcrumbs[0].href)}
                className="cursor-pointer"
              >
                {visibleBreadcrumbs[0].label}
              </BreadcrumbLink>
            </BreadcrumbItem>
            
            <BreadcrumbSeparator>
              <ChevronRight className="h-4 w-4" />
            </BreadcrumbSeparator>

            {/* Ellipsis with dropdown for hidden segments */}
            <BreadcrumbItem>
              <DropdownMenu>
                <DropdownMenuTrigger className="flex items-center gap-1">
                  <BreadcrumbEllipsis className="h-4 w-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {hiddenBreadcrumbs.map((crumb, index) => (
                    <DropdownMenuItem
                      key={index}
                      onClick={() => setLocation(crumb.href)}
                      className="cursor-pointer"
                    >
                      {crumb.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </BreadcrumbItem>
            
            <BreadcrumbSeparator>
              <ChevronRight className="h-4 w-4" />
            </BreadcrumbSeparator>
          </>
        )}

        {/* Visible breadcrumbs */}
        {(shouldTruncate ? visibleBreadcrumbs.slice(1) : visibleBreadcrumbs).map((crumb, index, array) => {
          const isLast = index === array.length - 1;
          
          return (
            <div key={crumb.href} className="flex items-center gap-2">
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage className="font-medium">
                    {crumb.label}
                  </BreadcrumbPage>
                ) : (
                  <BreadcrumbLink 
                    onClick={() => setLocation(crumb.href)}
                    className="cursor-pointer"
                  >
                    {crumb.label}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              
              {!isLast && (
                <BreadcrumbSeparator>
                  <ChevronRight className="h-4 w-4" />
                </BreadcrumbSeparator>
              )}
            </div>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
