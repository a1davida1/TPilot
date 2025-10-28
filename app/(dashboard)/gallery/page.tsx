import { QueryClient, dehydrate } from '@tanstack/react-query';
import { HydrateClient } from '../../providers';
import { GalleryClient } from './gallery-client';
import type { GalleryResponse } from './types';
import { fetchGallery, galleryQueryKey } from '../../../client/hooks/dashboard';

export const dynamic = 'force-dynamic';

export default async function GalleryPage() {
  const queryClient = new QueryClient();
  const initialData = await fetchGallery({ page: 1, pageSize: 20 }).catch<GalleryResponse | null>(() => null);

  if (initialData) {
    queryClient.setQueryData(galleryQueryKey({ page: 1, pageSize: 20 }), {
      pages: [initialData],
      pageParams: [1],
    });
  }

  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrateClient state={dehydratedState}>
      <GalleryClient initialData={initialData} />
    </HydrateClient>
  );
}
