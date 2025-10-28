import type { SerializedScheduleJob } from '@shared/schedule-job-types';

import { ScheduleClient } from './schedule-client';

async function fetchInitialJobs(): Promise<SerializedScheduleJob[] | null> {
  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? '';
    const response = await fetch(`${baseUrl}/api/schedule/jobs`, {
      cache: 'no-store',
      credentials: 'include',
    });
    if (!response.ok) {
      return null;
    }
    const data = (await response.json()) as { jobs: SerializedScheduleJob[] };
    return data.jobs ?? null;
  } catch (error) {
    console.error('Failed to preload schedule jobs', error);
    return null;
  }
}

export const dynamic = 'force-dynamic';

export default async function SchedulePage() {
  const initialJobs = await fetchInitialJobs();
  return <ScheduleClient initialJobs={initialJobs} />;
}

