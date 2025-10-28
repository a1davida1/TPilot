'use client';

import { useRouter } from 'next/navigation';
import { workflowBuckets } from '@/config/navigation';
import { Menu, Sparkles, User } from 'lucide-react';
import { useMemo } from 'react';

interface DashboardHeaderProps {
  onToggleMobileNav: () => void;
  onOpenCommandPalette: () => void;
}

export function DashboardHeader({ onToggleMobileNav, onOpenCommandPalette }: DashboardHeaderProps) {
  const router = useRouter();
  const workflows = useMemo(() => workflowBuckets, []);

  return (
    <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/80 backdrop-blur">
      <div className="flex items-center justify-between gap-4 px-4 py-4 lg:px-10">
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800 lg:hidden"
            onClick={onToggleMobileNav}
            aria-label="Toggle navigation"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="hidden flex-col lg:flex">
            <span className="text-xs uppercase tracking-wide text-slate-500">Workflow</span>
            <div className="flex items-center gap-3">
              {workflows.map((bucket) => (
                <button
                  type="button"
                  key={bucket.key}
                  className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-slate-500"
                  onClick={() => router.push(bucket.routes[0]?.href ?? '/dashboard')}
                >
                  <Sparkles className="h-3.5 w-3.5 text-rose-300" />
                  {bucket.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            className="hidden items-center gap-2 rounded-full border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-slate-500 lg:inline-flex"
            onClick={onOpenCommandPalette}
          >
            <Sparkles className="h-4 w-4" />
            Command + K
          </button>
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-700 bg-slate-900 text-slate-200 hover:border-slate-500"
            aria-label="Profile"
          >
            <User className="h-5 w-5" />
          </button>
        </div>
      </div>
    </header>
  );
}
