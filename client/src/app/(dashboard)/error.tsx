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
    <div className="min-h-screen bg-slate-950 px-4 pb-12 pt-6 sm:px-6 lg:px-8">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6">
        <section className="rounded-3xl border border-red-500/40 bg-red-500/10 p-8 text-center">
          <div className="space-y-3">
            <h2 className="text-2xl font-semibold text-red-200">Something went wrong</h2>
            <p className="mx-auto max-w-2xl text-sm text-red-100/80">
              We couldn't load your dashboard workspace. Our team has been notified and is already investigating the issue.
            </p>
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button onClick={() => reset()} variant="secondary" className="bg-white/10 text-white hover:bg-white/20">
              Try again
            </Button>
            <Button asChild variant="ghost" className="text-red-100 hover:text-white">
              <a href="/support" aria-label="Open support center">Contact support</a>
            </Button>
          </div>
          <p className="mt-4 text-xs text-red-100/60">Reference: {error.digest ?? 'unavailable'}</p>
        </section>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(360px,420px)_1fr]">
          <div className="space-y-6">
            <div className="rounded-3xl border border-white/5 bg-slate-900/70 p-6 text-left text-sm text-slate-300">
              <h3 className="mb-2 text-base font-semibold text-white">Quick fixes</h3>
              <ul className="list-disc space-y-1 pl-5">
                <li>Refresh the page or try again in a new tab.</li>
                <li>Reconnect your Reddit account from Settings.</li>
                <li>Verify that your network connection is stable.</li>
              </ul>
            </div>
          </div>
          <div className="space-y-6">
            <div className="rounded-3xl border border-white/5 bg-slate-900/70 p-6 text-sm text-slate-300">
              <h3 className="mb-2 text-base font-semibold text-white">Need hands-on help?</h3>
              <p>
                Check our status page for any active incidents or open a support ticket so the team can restore your workspace as
                quickly as possible.
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button asChild variant="secondary" className="bg-purple-500/20 text-purple-100 hover:bg-purple-500/30">
                  <a href="/status" aria-label="Open platform status">View status page</a>
                </Button>
                <Button asChild variant="ghost" className="text-slate-200 hover:text-white">
                  <a href="mailto:support@thottopilot.com" aria-label="Email support">Email support</a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
