import { QueryClient, dehydrate } from '@tanstack/react-query';
import { HydrateClient } from '../../providers';
import { PostingClient } from './posting-client';

export const dynamic = 'force-dynamic';

export default async function PostingPage() {
  const queryClient = new QueryClient();
  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrateClient state={dehydratedState}>
      <PostingClient />
    </HydrateClient>
  );
}
