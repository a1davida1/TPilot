import { AlertTriangle, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface StatusBannerProps {
  show?: boolean;
  onClose?: () => void;
  onAction?: () => void;
  variant?: 'warning' | 'error' | 'info' | 'success';
  message: string | React.ReactNode;
  actionLabel?: string;
  closeable?: boolean;
  className?: string;
}

const variantStyles = {
  warning: 'bg-amber-50 border-amber-200 text-amber-900 dark:bg-amber-950/30 dark:border-amber-900 dark:text-amber-100',
  error: 'bg-red-50 border-red-200 text-red-900 dark:bg-red-950/30 dark:border-red-900 dark:text-red-100',
  info: 'bg-blue-50 border-blue-200 text-blue-900 dark:bg-blue-950/30 dark:border-blue-900 dark:text-blue-100',
  success: 'bg-green-50 border-green-200 text-green-900 dark:bg-green-950/30 dark:border-green-900 dark:text-green-100',
};

const iconStyles = {
  warning: 'text-amber-600 dark:text-amber-400',
  error: 'text-red-600 dark:text-red-400',
  info: 'text-blue-600 dark:text-blue-400',
  success: 'text-green-600 dark:text-green-400',
};

export function StatusBanner({
  show = true,
  onClose,
  onAction,
  variant = 'warning',
  message,
  actionLabel = 'Upgrade to Pro',
  closeable = true,
  className,
}: StatusBannerProps) {
  if (!show) return null;

  return (
    <div className={cn(
      'relative border-b px-4 py-2 transition-all',
      variantStyles[variant],
      className
    )}>
      <div className="mx-auto flex max-w-7xl items-center justify-between">
        <div className="flex items-center gap-2">
          <AlertTriangle className={cn('h-4 w-4', iconStyles[variant])} />
          <span className="text-sm font-medium">{message}</span>
        </div>
        
        <div className="flex items-center gap-2">
          {onAction && actionLabel && (
            <Button
              onClick={onAction}
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs hover:bg-white/20"
            >
              {actionLabel} →
            </Button>
          )}
          {closeable && onClose && (
            <button
              onClick={onClose}
              className="rounded-md p-1 transition-colors hover:bg-white/20"
              aria-label="Close banner"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Specific banner for caption limits
interface CaptionLimitBannerProps {
  remaining: number;
  limit: number;
  tier: 'free' | 'pro' | 'premium';
  onUpgrade?: () => void;
  onClose?: () => void;
}

export function CaptionLimitBanner({
  remaining,
  limit,
  tier,
  onUpgrade,
  onClose,
}: CaptionLimitBannerProps) {
  // Only show for free tier when running low
  const shouldShow = tier === 'free' && remaining <= 3;
  
  if (!shouldShow) return null;

  const message = (
    <>
      Only <span className="font-bold">{remaining}</span> AI captions remaining this month
      {limit > 0 && (
        <span className="opacity-75"> (out of {limit})</span>
      )}
    </>
  );

  return (
    <StatusBanner
      show
      variant="warning"
      message={message}
      actionLabel="Upgrade to Pro"
      onAction={onUpgrade}
      onClose={onClose}
      closeable={false} // Don't allow closing for important limits
    />
  );
}

// Global command bar for system status
interface CommandBarProps {
  tier: 'free' | 'starter' | 'pro' | 'premium' | 'admin';
  captionsRemaining?: number;
  cooldownSeconds?: number;
  scheduledPosts?: number;
  className?: string;
}

export function CommandBar({
  tier,
  captionsRemaining,
  cooldownSeconds,
  scheduledPosts,
  className,
}: CommandBarProps) {
  const items: React.ReactNode[] = [];

  // Tier indicator
  items.push(
    <div key="tier" className="command-bar-item">
      <span className="text-xs font-medium uppercase">
        {tier === 'premium' ? 'Premium' : tier === 'pro' ? 'Pro' : 'Free'}
      </span>
    </div>
  );

  // Caption limit (only show if limited)
  if (tier === 'free' && captionsRemaining !== undefined) {
    const isLow = captionsRemaining <= 3;
    items.push(
      <div
        key="captions"
        className={cn(
          'command-bar-item',
          isLow && 'command-bar-warning'
        )}
      >
        <span className="text-xs">
          {captionsRemaining} captions left
        </span>
      </div>
    );
  }

  // Cooldown timer
  if (cooldownSeconds && cooldownSeconds > 0) {
    const hours = Math.floor(cooldownSeconds / 3600);
    const minutes = Math.floor((cooldownSeconds % 3600) / 60);
    items.push(
      <div key="cooldown" className="command-bar-item command-bar-warning">
        <span className="text-xs">
          Cooldown: {hours}h {minutes}m
        </span>
      </div>
    );
  }

  // Scheduled posts
  if (scheduledPosts && scheduledPosts > 0) {
    items.push(
      <div key="scheduled" className="command-bar-item">
        <span className="text-xs">
          {scheduledPosts} posts scheduled
        </span>
      </div>
    );
  }

  if (items.length === 0) return null;

  return (
    <div className={cn(
      'sticky top-[64px] z-40 border-b bg-gradient-to-r from-purple-50/90 via-pink-50/90 to-blue-50/90 px-4 py-2 backdrop-blur-sm dark:from-purple-950/30 dark:via-pink-950/30 dark:to-blue-950/30',
      className
    )}>
      <div className="mx-auto flex max-w-7xl items-center gap-3 text-xs">
        {items}
      </div>
    </div>
  );
}
