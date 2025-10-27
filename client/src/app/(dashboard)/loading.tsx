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
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6">
        <section className="rounded-3xl border border-white/5 bg-slate-900/70 p-6">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="space-y-3">
              <Skeleton className="h-4 w-24 bg-white/10" />
              <Skeleton className="h-10 w-64 bg-white/15" />
              <Skeleton className="h-4 w-48 bg-white/10" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-6 w-28 bg-white/10" />
              <Skeleton className="h-6 w-32 bg-white/10" />
            </div>
          </div>
          <div className="mt-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap gap-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-32 bg-white/10" />
              ))}
            </div>
            <div className="flex items-center gap-3">
              {Array.from({ length: 3 }).map((_, index) => (
                <Skeleton key={index} className="h-10 w-10 rounded-full bg-white/10" />
              ))}
            </div>
          </div>
        </section>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(360px,420px)_1fr]">
          <div className="space-y-6">
            <Skeleton className="h-60 w-full rounded-3xl border border-white/5 bg-slate-900/70" />
            <Skeleton className="h-80 w-full rounded-3xl border border-white/5 bg-slate-900/70" />
            <div className="space-y-4 rounded-3xl border border-white/5 bg-slate-900/70 p-6">
              <Skeleton className="h-4 w-48 bg-white/10" />
              <div className="flex flex-wrap gap-3">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton key={index} className="h-8 w-32 bg-white/10" />
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-6">
            <section className="rounded-3xl border border-white/5 bg-slate-900/70 p-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <StatSkeleton key={index} />
                ))}
              </div>
            </section>
            <section className="rounded-3xl border border-white/5 bg-slate-900/70 p-6">
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, index) => (
                  <Skeleton key={index} className="h-20 w-full bg-white/10" />
                ))}
              </div>
            </section>
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              {Array.from({ length: 2 }).map((_, index) => (
                <Skeleton key={index} className="h-72 w-full rounded-3xl border border-white/5 bg-slate-900/70" />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
