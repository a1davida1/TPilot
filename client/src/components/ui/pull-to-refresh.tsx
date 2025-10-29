import { useState, useRef, useEffect } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface PullToRefreshProps {
  children: React.ReactNode;
  onRefresh: () => Promise<void>;
  threshold?: number; // pixels to pull before refresh
  className?: string;
}

export function PullToRefresh({
  children,
  onRefresh,
  threshold = 80,
  className,
}: PullToRefreshProps) {
  const isMobile = useIsMobile();
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [startY, setStartY] = useState(0);
  const [isPulling, setIsPulling] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Only enable on mobile
  if (!isMobile) {
    return <div className={className}>{children}</div>;
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    // Only start if scrolled to top
    if (containerRef.current && containerRef.current.scrollTop === 0) {
      setStartY(e.touches[0].clientY);
      setIsPulling(true);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isPulling || isRefreshing) return;

    const currentY = e.touches[0].clientY;
    const diff = currentY - startY;

    // Only allow pull down (positive values)
    if (diff > 0) {
      // Apply resistance
      const resistance = 0.5;
      setPullDistance(Math.min(diff * resistance, threshold * 1.5));
    }
  };

  const handleTouchEnd = async () => {
    setIsPulling(false);

    // If pulled past threshold, trigger refresh
    if (pullDistance > threshold) {
      setIsRefreshing(true);
      setPullDistance(threshold);

      try {
        await onRefresh();
      } finally {
        setIsRefreshing(false);
        setPullDistance(0);
      }
    } else {
      // Snap back
      setPullDistance(0);
    }
  };

  const progress = Math.min(pullDistance / threshold, 1);
  const shouldTrigger = pullDistance > threshold;

  return (
    <div
      ref={containerRef}
      className={cn('relative overflow-auto', className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull Indicator */}
      <div
        className={cn(
          'absolute left-0 right-0 top-0 z-10 flex items-center justify-center transition-all',
          pullDistance > 0 ? 'opacity-100' : 'opacity-0'
        )}
        style={{
          height: pullDistance,
        }}
      >
        <div
          className={cn(
            'flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground transition-all',
            shouldTrigger && 'scale-110'
          )}
          style={{
            transform: `rotate(${progress * 360}deg)`,
          }}
        >
          {isRefreshing ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <RefreshCw className="h-5 w-5" />
          )}
        </div>
      </div>

      {/* Content */}
      <div
        className="transition-transform"
        style={{
          transform: `translateY(${pullDistance}px)`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
