'use client';

import { useEffect } from 'react';

interface AnalyticsErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AnalyticsError({ error, reset }: AnalyticsErrorProps) {
  useEffect(() => {
    console.error('Analytics dashboard failed to render', error);
  }, [error]);

  return (
    <div className="space-y-4 rounded-lg border border-destructive/40 bg-destructive/10 p-6">
      <div>
        <h2 className="text-xl font-semibold text-destructive">Something went wrong</h2>
        <p className="mt-1 text-sm text-destructive">
          We could not load your analytics data. Please refresh the page or try again in a moment.
        </p>
      </div>
      <button
        type="button"
        onClick={reset}
        className="inline-flex items-center justify-center rounded-md bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground transition hover:bg-destructive/90"
      >
        Retry loading analytics
      </button>
    </div>
  );
}
