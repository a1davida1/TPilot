import { cookies } from 'next/headers';

import type { RiskApiResponse, RiskApiSuccess } from './types';
import { ScheduleClient } from './schedule-client';

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
  return <ScheduleClient initialResponse={initialResponse} />;
}
