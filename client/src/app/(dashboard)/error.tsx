'use client';

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

interface DashboardErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: DashboardErrorProps) {
  useEffect(() => {
    console.error("Dashboard rendering error", error);
  }, [error]);

  return (
    <div className="flex min-h-[320px] flex-col items-center justify-center space-y-6 rounded-3xl border border-red-500/40 bg-red-500/10 p-8 text-center">
      <div className="space-y-2">
        <h2 className="text-2xl font-semibold text-red-200">Something went wrong</h2>
        <p className="max-w-lg text-sm text-red-100/80">
          We were unable to load your dashboard experience. Our team has been notified and is already investigating the issue.
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button onClick={() => reset()} variant="secondary" className="bg-white/10 text-white hover:bg-white/20">
          Try again
        </Button>
        <Button asChild variant="ghost" className="text-red-100 hover:text-white">
          <a href="/support" aria-label="Open support center">Contact support</a>
        </Button>
      </div>
      <p className="text-xs text-red-100/60">Reference: {error.digest ?? 'unavailable'}</p>
    </div>
  );
}
