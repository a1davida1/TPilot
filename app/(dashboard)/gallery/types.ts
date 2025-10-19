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
