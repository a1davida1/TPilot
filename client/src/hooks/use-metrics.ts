import { useQuery, useSuspenseQuery } from '@tanstack/react-query';

import { getQueryFn, type ApiError } from '@/lib/queryClient';

export interface Metrics {
  creators: number;
  posts: number;
  engagement: number;
  activeSubscriptions: number;
  generatedAt: string;
}

const metricsQueryKey = ['/api/landing/summary'] as const;
const metricsQueryFn = getQueryFn<Metrics>({ on401: 'returnNull' });

export function useMetrics() {
  return useQuery<Metrics, ApiError>({
    queryKey: metricsQueryKey,
    queryFn: metricsQueryFn,
    staleTime: 60_000,
    gcTime: 300_000,
    retry: 1,
  });
}

export function useMetricsSuspense(): Metrics {
  const { data } = useSuspenseQuery<Metrics, ApiError>({
    queryKey: metricsQueryKey,
    queryFn: metricsQueryFn,
    staleTime: 60_000,
    gcTime: 300_000,
  });

  return data;
}

export { metricsQueryKey };