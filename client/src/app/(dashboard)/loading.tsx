'use client';

import { Skeleton } from "@/components/ui/skeleton";

function StatSkeleton() {
  return (
    <div className="rounded-2xl border border-white/5 bg-slate-900/80 p-4">
      <Skeleton className="mb-3 h-3 w-16 bg-white/10" />
      <Skeleton className="h-8 w-24 bg-white/20" />
    </div>
  );
}

export function DashboardLoading() {
  return (
    <div className="min-h-screen bg-slate-950 px-4 pb-12 pt-6 sm:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-[1400px] gap-6 lg:grid-cols-[280px_1fr]">
        <aside className="hidden h-full rounded-3xl border border-white/5 bg-slate-900/70 p-6 lg:block">
          <div className="space-y-6">
            <Skeleton className="h-10 w-40 bg-white/10" />
            <div className="space-y-4">
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} className="h-8 w-full bg-white/5" />
              ))}
            </div>
          </div>
        </aside>
        <main className="flex min-w-0 flex-col gap-6">
          <section className="rounded-3xl border border-white/5 bg-slate-900/70 p-6">
            <Skeleton className="mb-4 h-7 w-64 bg-white/15" />
            <Skeleton className="h-4 w-48 bg-white/10" />
            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <StatSkeleton key={index} />
              ))}
            </div>
          </section>
          <section className="rounded-3xl border border-white/5 bg-slate-900/70 p-6">
            <Skeleton className="mb-4 h-6 w-32 bg-white/15" />
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-24 w-full bg-white/5" />
              ))}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
