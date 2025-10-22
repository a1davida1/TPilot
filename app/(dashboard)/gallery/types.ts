export interface GalleryItem {
  id: number;
  filename: string;
  thumbnailUrl: string;
  sourceUrl: string;
  downloadUrl?: string;
  bytes: number;
  mime: string;
  createdAt: string;
  isWatermarked: boolean;
  lastRepostedAt?: string;
}

export interface GalleryResponse {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasMore: boolean;
  items: GalleryItem[];
}

export interface QuickRepostPayload {
  assetId: number;
  subreddit: string;
  title: string;
  nsfw?: boolean;
  spoiler?: boolean;
}

export const REPOST_COOLDOWN_HOURS = 72;

export interface CooldownStatus {
  active: boolean;
  hoursRemaining: number;
}

export function getCooldownStatus(
  lastRepostedAt: string | undefined,
  referenceDate: Date = new Date(),
): CooldownStatus {
  const inactiveStatus: CooldownStatus = { active: false, hoursRemaining: 0 };

  if (!lastRepostedAt) {
    return inactiveStatus;
  }

  const lastRepostDate = new Date(lastRepostedAt);
  if (Number.isNaN(lastRepostDate.getTime())) {
    return inactiveStatus;
  }

  const millisecondsSinceRepost = referenceDate.getTime() - lastRepostDate.getTime();
  const hoursSinceRepost = millisecondsSinceRepost / (1000 * 60 * 60);
  const hoursRemaining = REPOST_COOLDOWN_HOURS - hoursSinceRepost;

  if (hoursRemaining > 0) {
    return { active: true, hoursRemaining };
  }

  return inactiveStatus;
}
