import type { CSSProperties, ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface StickyRailProps {
  children: ReactNode;
  rail: ReactNode;
  /**
   * Controls whether the rail should appear before or after the main content on large screens.
   * Mobile always renders in document order.
   */
  railPosition?: 'start' | 'end';
  /**
   * Offset in pixels for the sticky rail to account for persistent navigation bars.
   */
  offset?: number | string;
  className?: string;
  mainClassName?: string;
  railClassName?: string;
}

const DEFAULT_OFFSET = '6rem';

export function StickyRail({
  children,
  rail,
  railPosition = 'end',
  offset = DEFAULT_OFFSET,
  className,
  mainClassName,
  railClassName,
}: StickyRailProps) {
  const resolvedOffset = typeof offset === 'number' ? `${offset}px` : offset;
  const mainOrderClass = railPosition === 'start' ? 'lg:order-2' : 'lg:order-1';
  const railOrderClass = railPosition === 'start' ? 'lg:order-1' : 'lg:order-2';

  return (
    <div
      className={cn(
        'flex flex-col gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(260px,340px)] lg:items-start lg:gap-8',
        className,
      )}
    >
      <div className={cn('min-w-0', mainOrderClass, mainClassName)}>{children}</div>
      <aside
        className={cn(
          'lg:sticky lg:self-start',
          railOrderClass,
          railClassName,
        )}
        style={{ '--sticky-rail-offset': resolvedOffset, top: 'var(--sticky-rail-offset)' } as CSSProperties}
      >
        <div className="flex flex-col gap-6">{rail}</div>
      </aside>
    </div>
  );
}
