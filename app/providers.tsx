'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { DehydratedState } from '@tanstack/react-query';
import { HydrationBoundary } from '@tanstack/react-query';
import { ReactNode, useState } from 'react';

interface QueryProviderProps {
  children: ReactNode;
}

export function QueryProvider({ children }: QueryProviderProps) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: (failureCount, error) => {
          if (failureCount > 2) return false;
          if (error instanceof Error && /401|403/.test(error.message)) {
            return false;
          }
          return true;
        },
      },
      mutations: {
        retry: 1,
      },
    },
  }));

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}

interface HydrateClientProps {
  state?: DehydratedState;
  children: ReactNode;
}

export function HydrateClient({ state, children }: HydrateClientProps) {
  return <HydrationBoundary state={state}>{children}</HydrationBoundary>;
}
