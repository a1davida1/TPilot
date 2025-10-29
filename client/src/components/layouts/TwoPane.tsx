/**
 * TwoPane Layout Component
 * 
 * Split-screen layout with inputs on left and outputs/preview on right.
 * Eliminates scrolling and provides real-time feedback.
 * 
 * Features:
 * - Configurable left pane width (30%, 40%, 50%)
 * - Optional sticky left pane
 * - Responsive stacking on mobile/tablet
 * - Card-based containers for visual separation
 */

import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface TwoPaneProps {
  leftPane: React.ReactNode;
  rightPane: React.ReactNode;
  leftWidth?: '30%' | '40%' | '50%';
  sticky?: boolean;
  mobileStack?: boolean;
  className?: string;
}

export function TwoPane({ 
  leftPane, 
  rightPane, 
  leftWidth = '40%',
  sticky = false,
  mobileStack = true,
  className 
}: TwoPaneProps) {
  return (
    <div className={cn("flex flex-col lg:flex-row gap-6 h-full", className)}>
      {/* Left Pane - Inputs/Configuration */}
      <div 
        className={cn(
          "flex-shrink-0",
          sticky && "lg:sticky lg:top-20 lg:h-[calc(100vh-5rem)] lg:overflow-auto",
          mobileStack && "w-full lg:w-[var(--left-width)]"
        )}
        style={{ '--left-width': leftWidth } as React.CSSProperties}
      >
        <Card className="h-full overflow-auto">
          {leftPane}
        </Card>
      </div>
      
      {/* Right Pane - Outputs/Preview */}
      <div className="flex-1 min-w-0">
        <Card className="h-full overflow-auto">
          {rightPane}
        </Card>
      </div>
    </div>
  );
}
