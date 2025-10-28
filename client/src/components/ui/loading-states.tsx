import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

// Basic spinner component
export function Spinner({ className, size = 'default' }: { 
  className?: string; 
  size?: 'sm' | 'default' | 'lg' 
}) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    default: 'h-6 w-6',
    lg: 'h-8 w-8'
  };

  return (
    <Loader2 
      className={cn('animate-spin text-muted-foreground', sizeClasses[size], className)} 
      aria-label="Loading"
      role="status"
    >
      <span className="sr-only">Loading...</span>
    </Loader2>
  );
}

// Full page loading spinner
export function PageSpinner({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <Spinner size="lg" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

// Stats card skeleton
export function StatsCardSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-6 animate-pulse">
      <div className="flex items-center justify-between space-y-0 pb-2">
        <div className="h-4 bg-muted rounded w-24" />
        <div className="h-8 w-8 bg-muted rounded" />
      </div>
      <div className="pt-4">
        <div className="h-8 bg-muted rounded w-32 mb-2" />
        <div className="h-3 bg-muted rounded w-20" />
      </div>
    </div>
  );
}

// Dashboard stats skeleton
export function DashboardStatsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {[...Array(4)].map((_, i) => (
        <StatsCardSkeleton key={i} />
      ))}
    </div>
  );
}

// Activity feed skeleton
export function ActivitySkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="flex items-start gap-3">
          <div className="h-8 w-8 rounded-full bg-muted" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-muted rounded w-3/4" />
            <div className="h-3 bg-muted rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

// Table skeleton
export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="w-full animate-pulse">
      {/* Header */}
      <div className="flex gap-4 pb-4 border-b">
        {[...Array(columns)].map((_, i) => (
          <div key={i} className="h-4 bg-muted rounded flex-1" />
        ))}
      </div>
      {/* Rows */}
      {[...Array(rows)].map((_, rowIndex) => (
        <div key={rowIndex} className="flex gap-4 py-4 border-b">
          {[...Array(columns)].map((_, colIndex) => (
            <div key={colIndex} className="h-4 bg-muted rounded flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}

// Button loading state
export function ButtonSpinner() {
  return <Spinner size="sm" className="mr-2" />;
}
