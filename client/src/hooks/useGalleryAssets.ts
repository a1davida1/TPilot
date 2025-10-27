import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { authenticatedRequest } from '@/lib/authenticated-request';
import {
  CatboxUploadResponse,
  CatboxUploadsApiResponse,
  ImgurUploadResponse,
  ImgurUploadsApiResponse,
  GalleryImage,
  MediaAssetResponse,
  mergeGalleryImages,
  parseCatboxUploadsApiResponse,
  parseImgurUploadsApiResponse,
  parseMediaAssetsResponse
} from '@/lib/gallery';

interface UseGalleryAssetsResult {
  galleryImages: GalleryImage[];
  mediaAssets: MediaAssetResponse[];
  catboxUploads: CatboxUploadResponse[];
  imgurUploads: ImgurUploadResponse[];
  isLoading: boolean;
  mediaLoading: boolean;
  catboxLoading: boolean;
  imgurLoading: boolean;
  mediaError: unknown;
  catboxError: unknown;
  imgurError: unknown;
}

interface UseGalleryAssetsOptions {
  enabled?: boolean;
  catboxLimit?: number;
  staleTimeMs?: number;
}

const DEFAULT_CATBOX_LIMIT = 48;
const MAX_CATBOX_LIMIT = 100;
const DEFAULT_STALE_TIME_MS = 60_000;

function clampLimit(limit: number): number {
  if (!Number.isFinite(limit)) {
    return DEFAULT_CATBOX_LIMIT;
  }
  const normalized = Math.trunc(limit);
  return Math.min(Math.max(normalized, 1), MAX_CATBOX_LIMIT);
}

export function useGalleryAssets(options: UseGalleryAssetsOptions = {}): UseGalleryAssetsResult {
  const { enabled = true, catboxLimit = DEFAULT_CATBOX_LIMIT, staleTimeMs = DEFAULT_STALE_TIME_MS } = options;
  const normalizedLimit = clampLimit(catboxLimit);

  const mediaQuery = useQuery<MediaAssetResponse[]>({
    queryKey: ['/api/media'],
    queryFn: async () => {
      const response = await authenticatedRequest<unknown>('/api/media');
      return parseMediaAssetsResponse(response);
    },
    enabled,
    staleTime: staleTimeMs
  });

  const catboxQuery = useQuery<CatboxUploadsApiResponse>({
    queryKey: ['/api/catbox/uploads', { limit: normalizedLimit }],
    queryFn: async () => {
      const response = await authenticatedRequest<unknown>(`/api/catbox/uploads?limit=${normalizedLimit}`);
      return parseCatboxUploadsApiResponse(response);
    },
    enabled,
    staleTime: staleTimeMs
  });

  const imgurQuery = useQuery<ImgurUploadsApiResponse>({
    queryKey: ['/api/uploads/imgur/my-uploads'],
    queryFn: async () => {
      const response = await authenticatedRequest<unknown>('/api/uploads/imgur/my-uploads');
      return parseImgurUploadsApiResponse(response);
    },
    enabled,
    staleTime: staleTimeMs
  });

  const mediaAssets = mediaQuery.data ?? [];
  const catboxUploads = catboxQuery.data?.uploads ?? [];
  const imgurUploads = imgurQuery.data?.uploads ?? [];

  const galleryImages = useMemo(
    () => mergeGalleryImages(mediaAssets, catboxUploads, imgurUploads),
    [mediaAssets, catboxUploads, imgurUploads]
  );

  return {
    galleryImages,
    mediaAssets,
    catboxUploads,
    imgurUploads,
    isLoading: enabled && (mediaQuery.isLoading || catboxQuery.isLoading || imgurQuery.isLoading),
    mediaLoading: enabled && mediaQuery.isLoading,
    catboxLoading: enabled && catboxQuery.isLoading,
    imgurLoading: enabled && imgurQuery.isLoading,
    mediaError: enabled ? mediaQuery.error : null,
    catboxError: enabled ? catboxQuery.error : null,
    imgurError: enabled ? imgurQuery.error : null
  };
}
