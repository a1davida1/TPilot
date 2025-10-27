import type { GalleryResponse } from './types';
import { GalleryClient } from './gallery-client';

async function fetchInitialGallery(): Promise<GalleryResponse | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? '';
    const requestUrl = `${baseUrl}/api/gallery?page=1&pageSize=20`;
    const response = await fetch(requestUrl, {
      cache: 'no-store',
      credentials: 'include',
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as GalleryResponse;
    return data;
  } catch (error) {
    console.error('Failed to preload gallery', error);
    return null;
  }
}

export const dynamic = 'force-dynamic';

export default async function GalleryPage() {
  const initialData = await fetchInitialGallery();
  return <GalleryClient initialData={initialData} stickyOffset={112} />;
}
