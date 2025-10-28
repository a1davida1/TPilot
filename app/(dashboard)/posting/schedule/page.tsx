import { QueryClient, dehydrate } from '@tanstack/react-query';
import { cookies } from 'next/headers';

import type { RiskApiResponse, RiskApiSuccess } from './types';
import { ScheduleClient } from './schedule-client';
import { HydrateClient } from '../../../providers';

async function fetchInitialRiskSummary(): Promise<RiskApiSuccess | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? '';
    const cookieHeader = cookies().toString();
    const response = await fetch(`${baseUrl}/api/reddit/risk`, {
      cache: 'no-store',
      headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    });

    if (!response.ok) {
      return null;
    }

    const payload = (await response.json()) as RiskApiResponse;
    if ('success' in payload && payload.success) {
      return payload;
    }

    return null;
  } catch (error) {
    console.error('Failed to preload risk warnings', error);
    return null;
  }
}

export const dynamic = 'force-dynamic';

export default async function SchedulePage() {
  const initialResponse = await fetchInitialRiskSummary();
  const queryClient = new QueryClient();

  if (initialResponse) {
    queryClient.setQueryData(['dashboard', 'risk-assessment'], initialResponse);
  }

  const dehydratedState = dehydrate(queryClient);

  return (
    <HydrateClient state={dehydratedState}>
      <ScheduleClient initialResponse={initialResponse} />
    </HydrateClient>
  );
}
