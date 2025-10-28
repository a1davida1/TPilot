'use client';

import { AlertCircle, BarChart3, CheckCircle2, Zap } from 'lucide-react';
import { useMemo } from 'react';

interface CaptionUsage {
  used: number;
  limit: number;
  remaining: number;
}

interface StatusBannerProps {
  captionUsage?: CaptionUsage;
  hasScheduleAlerts?: boolean;
}

export function StatusBanner({ captionUsage, hasScheduleAlerts }: StatusBannerProps) {
  const usageCopy = useMemo(() => {
    if (!captionUsage) {
      return 'Caption usage available after first sync.';
    }

    if (!Number.isFinite(captionUsage.limit) || captionUsage.limit <= 0) {
      return `Used ${captionUsage.used} captions today`;
    }

    const percent = Math.min(100, Math.round((captionUsage.used / captionUsage.limit) * 100));
    return `Used ${captionUsage.used}/${captionUsage.limit} captions (${percent}% of your daily limit).`;
  }, [captionUsage]);

  return (
    <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      <article className="flex items-center gap-4 rounded-2xl border border-slate-800 bg-slate-900/80 px-5 py-4 shadow-bubble">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-pink-500 via-fuchsia-500 to-purple-600 text-white">
          <Zap className="h-5 w-5" />
        </span>
        <div className="flex flex-col">
          <span className="text-xs uppercase tracking-wide text-slate-400">AI captions</span>
          <span className="text-sm font-semibold text-slate-100">{usageCopy}</span>
        </div>
      </article>
      <article className="flex items-center gap-4 rounded-2xl border border-slate-800 bg-slate-900/80 px-5 py-4 shadow-bubble">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 text-white">
          <BarChart3 className="h-5 w-5" />
        </span>
        <div className="flex flex-col">
          <span className="text-xs uppercase tracking-wide text-slate-400">Performance</span>
          <span className="text-sm font-semibold text-slate-100">Realtime analytics are calibrated for Reddit native uploads.</span>
        </div>
      </article>
      <article className="flex items-center gap-4 rounded-2xl border border-slate-800 bg-slate-900/80 px-5 py-4 shadow-bubble">
        <span className={`flex h-11 w-11 items-center justify-center rounded-full ${hasScheduleAlerts ? 'bg-gradient-to-br from-amber-500 to-orange-500' : 'bg-gradient-to-br from-emerald-500 to-lime-500'} text-white`}>
          {hasScheduleAlerts ? <AlertCircle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
        </span>
        <div className="flex flex-col">
          <span className="text-xs uppercase tracking-wide text-slate-400">Schedule health</span>
          <span className="text-sm font-semibold text-slate-100">
            {hasScheduleAlerts ? 'Review risk alerts before publishing queue runs.' : 'All scheduled posts look compliant for the next 72 hours.'}
          </span>
        </div>
      </article>
    </section>
  );
}
