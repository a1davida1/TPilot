import { useState, useEffect } from 'react';
import { StatusBanner } from './status-banner';
import { useLocation } from 'wouter';

interface BannerConfig {
  id: string;
  show: boolean;
  variant: 'warning' | 'error' | 'info' | 'success';
  message: string | React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  closeable?: boolean;
}

interface StatusBannerContainerProps {
  banners: BannerConfig[];
}

const DISMISS_STORAGE_KEY = 'dismissed-banners';
const DISMISS_DURATION = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

interface DismissedBanner {
  id: string;
  dismissedAt: number;
}

function getDismissedBanners(): DismissedBanner[] {
  try {
    const stored = localStorage.getItem(DISMISS_STORAGE_KEY);
    if (!stored) return [];
    
    const dismissed: DismissedBanner[] = JSON.parse(stored);
    const now = Date.now();
    
    // Filter out expired dismissals (older than 24 hours)
    const valid = dismissed.filter(
      (item) => now - item.dismissedAt < DISMISS_DURATION
    );
    
    // Update storage if we filtered anything out
    if (valid.length !== dismissed.length) {
      localStorage.setItem(DISMISS_STORAGE_KEY, JSON.stringify(valid));
    }
    
    return valid;
  } catch {
    return [];
  }
}

function dismissBanner(id: string): void {
  try {
    const dismissed = getDismissedBanners();
    dismissed.push({ id, dismissedAt: Date.now() });
    localStorage.setItem(DISMISS_STORAGE_KEY, JSON.stringify(dismissed));
  } catch {
    // Silently fail if localStorage is not available
  }
}

function isBannerDismissed(id: string): boolean {
  const dismissed = getDismissedBanners();
  return dismissed.some((item) => item.id === id);
}

export function StatusBannerContainer({ banners }: StatusBannerContainerProps) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // Load dismissed banners on mount
  useEffect(() => {
    const dismissed = getDismissedBanners();
    setDismissedIds(new Set(dismissed.map((item) => item.id)));
  }, []);

  const handleDismiss = (id: string) => {
    dismissBanner(id);
    setDismissedIds((prev) => new Set([...prev, id]));
  };

  // Filter banners: only show if not dismissed and show=true
  const visibleBanners = banners.filter(
    (banner) => banner.show && !dismissedIds.has(banner.id)
  );

  if (visibleBanners.length === 0) return null;

  return (
    <div className="sticky top-[64px] z-40">
      {visibleBanners.map((banner) => (
        <StatusBanner
          key={banner.id}
          show={true}
          variant={banner.variant}
          message={banner.message}
          actionLabel={banner.actionLabel}
          onAction={banner.onAction}
          onClose={banner.closeable !== false ? () => handleDismiss(banner.id) : undefined}
          closeable={banner.closeable !== false}
        />
      ))}
    </div>
  );
}

// Hook to manage banner state
export function useStatusBanners() {
  const [, setLocation] = useLocation();

  const createTierLimitBanner = (
    remaining: number,
    limit: number,
    tier: string
  ): BannerConfig | null => {
    // Show when 80% quota used (20% remaining)
    const percentRemaining = (remaining / limit) * 100;
    if (percentRemaining > 20) return null;

    return {
      id: 'tier-limit',
      show: true,
      variant: 'warning',
      message: (
        <>
          You've used <span className="font-bold">{limit - remaining}</span> of{' '}
          <span className="font-bold">{limit}</span> captions this month.{' '}
          {remaining > 0 ? (
            <>Only <span className="font-bold">{remaining}</span> remaining.</>
          ) : (
            <span className="font-bold">Limit reached.</span>
          )}
        </>
      ),
      actionLabel: 'Upgrade to Pro',
      onAction: () => setLocation('/settings'),
      closeable: true,
    };
  };

  const createCooldownBanner = (cooldownSeconds: number): BannerConfig | null => {
    if (cooldownSeconds <= 0) return null;

    const hours = Math.floor(cooldownSeconds / 3600);
    const minutes = Math.floor((cooldownSeconds % 3600) / 60);
    const seconds = cooldownSeconds % 60;

    let timeString = '';
    if (hours > 0) timeString += `${hours}h `;
    if (minutes > 0) timeString += `${minutes}m `;
    if (seconds > 0 && hours === 0) timeString += `${seconds}s`;

    return {
      id: 'reddit-cooldown',
      show: true,
      variant: 'info',
      message: (
        <>
          Reddit cooldown active. Next post available in{' '}
          <span className="font-bold">{timeString.trim()}</span>
        </>
      ),
      closeable: false, // Don't allow dismissing cooldown
    };
  };

  const createPostRemovalBanner = (
    subreddit: string,
    reason: string,
    postId?: string
  ): BannerConfig => {
    return {
      id: `post-removal-${postId || Date.now()}`,
      show: true,
      variant: 'error',
      message: (
        <>
          Your post to <span className="font-bold">r/{subreddit}</span> was removed:{' '}
          {reason}
        </>
      ),
      actionLabel: 'View Details',
      onAction: postId ? () => setLocation(`/history?post=${postId}`) : undefined,
      closeable: true,
    };
  };

  const createPostSuccessBanner = (subreddit: string): BannerConfig => {
    return {
      id: `post-success-${Date.now()}`,
      show: true,
      variant: 'success',
      message: (
        <>
          Successfully posted to <span className="font-bold">r/{subreddit}</span>!
        </>
      ),
      closeable: true,
    };
  };

  return {
    createTierLimitBanner,
    createCooldownBanner,
    createPostRemovalBanner,
    createPostSuccessBanner,
  };
}
