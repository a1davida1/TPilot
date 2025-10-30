import { useState, useRef } from 'react';
import { Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface SwipeableListItemProps {
  children: React.ReactNode;
  onDelete: () => void;
  className?: string;
  deleteThreshold?: number; // pixels to swipe before delete
}

export function SwipeableListItem({
  children,
  onDelete,
  className,
  deleteThreshold = 100,
}: SwipeableListItemProps) {
  const isMobile = useIsMobile();
  const [translateX, setTranslateX] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const itemRef = useRef<HTMLDivElement>(null);

  // Only enable swipe on mobile
  if (!isMobile) {
    return <div className={className}>{children}</div>;
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    setStartX(e.touches[0].clientX);
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return;

    const currentX = e.touches[0].clientX;
    const diff = currentX - startX;

    // Only allow left swipe (negative values)
    if (diff < 0) {
      setTranslateX(diff);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);

    // If swiped past threshold, trigger delete
    if (Math.abs(translateX) > deleteThreshold) {
      // Animate out
      setTranslateX(-300);
      setTimeout(() => {
        onDelete();
      }, 200);
    } else {
      // Snap back
      setTranslateX(0);
    }
  };

  const showDeleteButton = Math.abs(translateX) > 20;
  const deleteProgress = Math.min(Math.abs(translateX) / deleteThreshold, 1);

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {/* Delete Button Background */}
      <div
        className={cn(
          'absolute inset-y-0 right-0 flex items-center justify-end bg-red-500 px-6 transition-opacity',
          showDeleteButton ? 'opacity-100' : 'opacity-0'
        )}
        style={{
          width: Math.abs(translateX),
        }}
      >
        <Trash2
          className="h-5 w-5 text-white"
          style={{
            transform: `scale(${0.8 + deleteProgress * 0.4})`,
          }}
        />
      </div>

      {/* Swipeable Content */}
      <div
        ref={itemRef}
        className={cn(
          'relative bg-background transition-transform',
          isDragging ? 'transition-none' : 'duration-200'
        )}
        style={{
          transform: `translateX(${translateX}px)`,
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}
