import { useState, useEffect } from 'react';
import { HelpCircle, X } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from './tooltip';
import { cn } from '@/lib/utils';

interface ContextualTooltipProps {
  id: string;
  content: string;
  children: React.ReactNode;
  showOnce?: boolean;
  side?: 'top' | 'right' | 'bottom' | 'left';
  className?: string;
}

/**
 * Contextual tooltip that shows on first hover and can be dismissed
 */
export function ContextualTooltip({
  id,
  content,
  children,
  showOnce = true,
  side = 'top',
  className,
}: ContextualTooltipProps) {
  const [hasBeenSeen, setHasBeenSeen] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (showOnce) {
      const seen = localStorage.getItem(`tooltip-seen-${id}`);
      setHasBeenSeen(!!seen);
    }
  }, [id, showOnce]);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open && showOnce && !hasBeenSeen) {
      localStorage.setItem(`tooltip-seen-${id}`, 'true');
      setHasBeenSeen(true);
    }
  };

  return (
    <TooltipProvider>
      <Tooltip open={isOpen} onOpenChange={handleOpenChange}>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side={side} className={cn('max-w-xs', className)}>
          <p className="text-sm">{content}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Help icon with tooltip
 */
export function HelpTooltip({
  content,
  id,
  className,
}: {
  content: string;
  id: string;
  className?: string;
}) {
  return (
    <ContextualTooltip id={id} content={content} showOnce={false}>
      <button
        className={cn(
          'inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground',
          className
        )}
        aria-label="Help"
      >
        <HelpCircle className="h-4 w-4" />
      </button>
    </ContextualTooltip>
  );
}

/**
 * Feature announcement tooltip (shows automatically on first visit)
 */
export function FeatureAnnouncement({
  id,
  title,
  description,
  onDismiss,
}: {
  id: string;
  title: string;
  description: string;
  onDismiss?: () => void;
}) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const seen = localStorage.getItem(`feature-announcement-${id}`);
    if (!seen) {
      setIsVisible(true);
    }
  }, [id]);

  const handleDismiss = () => {
    localStorage.setItem(`feature-announcement-${id}`, 'true');
    setIsVisible(false);
    onDismiss?.();
  };

  if (!isVisible) return null;

  return (
    <div className="animate-in slide-in-from-top-5 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/20">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-blue-500 text-white">
          ✨
        </div>
        <div className="flex-1">
          <h4 className="mb-1 font-semibold text-blue-900 dark:text-blue-100">{title}</h4>
          <p className="text-sm text-blue-700 dark:text-blue-300">{description}</p>
        </div>
        <button
          onClick={handleDismiss}
          className="flex-shrink-0 rounded-md p-1 text-blue-600 transition-colors hover:bg-blue-100 dark:text-blue-400 dark:hover:bg-blue-900/50"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
