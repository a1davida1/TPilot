/**
 * DashboardGrid Layout Component
 * 
 * 12-column responsive grid system for dashboard layouts.
 * Default: 8 columns main content, 4 columns sidebar.
 * 
 * Features:
 * - Responsive breakpoints (mobile, tablet, desktop)
 * - Optional full-width mode
 * - Automatic vertical stacking on mobile
 * - Consistent spacing and alignment
 */

import { cn } from '@/lib/utils';

interface DashboardGridProps {
  mainContent: React.ReactNode;
  sidebar?: React.ReactNode;
  fullWidth?: boolean;
  className?: string;
}

export function DashboardGrid({ 
  mainContent, 
  sidebar, 
  fullWidth = false,
  className 
}: DashboardGridProps) {
  return (
    <div className={cn("grid grid-cols-1 lg:grid-cols-12 gap-6", className)}>
      {/* Main Content Area */}
      <div className={cn(
        "col-span-1",
        fullWidth ? "lg:col-span-12" : "lg:col-span-8"
      )}>
        {mainContent}
      </div>
      
      {/* Sidebar (optional) */}
      {sidebar && !fullWidth && (
        <aside className="col-span-1 lg:col-span-4">
          {sidebar}
        </aside>
      )}
    </div>
  );
}
