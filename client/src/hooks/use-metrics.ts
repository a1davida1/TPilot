import { useQuery } from '@tanstack/react-query';

export interface Metrics {
  creators: number;
  posts: number;
  engagement: number;
}

export function useMetrics() {
  return useQuery<Metrics, Error>({
    queryKey: ['metrics'],
    queryFn: async () => {
      const res = await fetch('/api/metrics');
      if (!res.ok) {
        throw new Error('Failed to fetch metrics');
      }
      return res.json() as Promise<Metrics>;
    },
  });
}