'use client';

import type { ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import {
  navigationItems,
  filterNavigationByAccess,
  type AccessContext,
} from '@/config/navigation';
import Link from 'next/link';
import { DashboardNavigation } from './dashboard-navigation';
import { DashboardHeader } from './dashboard-header';
import { FloatingActions } from './floating-actions';
import { CommandPalette } from './command-palette';
import { StatusBanner } from './status-banner';
import { useCaptionUsageSummary, useScheduleSignal } from '../../../client/hooks/dashboard';

const defaultAccess: AccessContext = {
  isAuthenticated: true,
  tier: 'pro',
  isAdmin: false,
};

export function DashboardShell({ children }: { children: ReactNode }) {
  const [commandOpen, setCommandOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const accessItems = useMemo(() => filterNavigationByAccess(navigationItems, defaultAccess), []);
  const captionUsageQuery = useCaptionUsageSummary();
  const scheduleSignalQuery = useScheduleSignal();

  return (
    <div className="relative flex min-h-screen flex-col bg-slate-950 text-slate-100 lg:flex-row">
      <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
      <FloatingActions />
      <DashboardNavigation onNavigate={() => setMobileNavOpen(false)} />
      {mobileNavOpen && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 px-6 py-8 backdrop-blur">
          <div className="flex items-center justify-between">
            <span className="text-lg font-semibold text-white">Navigate</span>
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-700"
              onClick={() => setMobileNavOpen(false)}
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="mt-6 flex-1 space-y-3 overflow-y-auto">
            {accessItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.key}
                  href={item.href}
                  onClick={() => setMobileNavOpen(false)}
                  className="flex items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm font-medium text-slate-200"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="flex-1">
                    <span>{item.label}</span>
                    {item.description && (
                      <span className="block text-xs font-normal text-slate-400">{item.description}</span>
                    )}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
      <div className="flex min-h-screen flex-1 flex-col lg:pl-72">
        <DashboardHeader
          onToggleMobileNav={() => setMobileNavOpen((previous) => !previous)}
          onOpenCommandPalette={() => setCommandOpen(true)}
        />
        <main className="flex-1 space-y-8 bg-slate-900 px-4 pb-24 pt-6 text-slate-100 lg:px-10">
          <StatusBanner
            captionUsage={captionUsageQuery.data ?? undefined}
            hasScheduleAlerts={Boolean(scheduleSignalQuery.data?.hasAlerts)}
          />
          {children}
        </main>
      </div>
    </div>
  );
}
