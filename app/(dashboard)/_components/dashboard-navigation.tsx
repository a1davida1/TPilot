'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { navigationItems, getMobileNavigation, filterNavigationByAccess, type AccessContext } from '@/config/navigation';
import { useMemo } from 'react';

interface DashboardNavigationProps {
  onNavigate?: () => void;
}

const defaultAccess: AccessContext = {
  isAuthenticated: true,
  tier: 'pro',
  isAdmin: false,
};

export function DashboardNavigation({ onNavigate }: DashboardNavigationProps) {
  const pathname = usePathname();
  const items = useMemo(() => filterNavigationByAccess(navigationItems, defaultAccess), []);
  const mobile = useMemo(() => getMobileNavigation(items), [items]);

  return (
    <>
      <aside className="hidden h-screen w-72 flex-shrink-0 flex-col border-r border-slate-800 bg-slate-950/80 px-6 py-8 text-slate-100 lg:flex">
        <div className="flex items-center gap-3">
          <span className="text-xl font-semibold text-white">ThottoPilot</span>
        </div>
        <nav className="mt-8 flex-1 space-y-6 overflow-y-auto pb-16">
          {items.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            return (
              <Link
                key={item.key}
                href={item.href}
                className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition ${
                  isActive ? 'bg-slate-800 text-white shadow-bubble' : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                }`}
                onClick={onNavigate}
              >
                <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${isActive ? 'bg-white/10' : 'bg-white/5'}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="flex-1">
                  <span>{item.label}</span>
                  {item.description && (
                    <span className="block text-xs font-normal text-slate-400">{item.description}</span>
                  )}
                </span>
                {item.badge && (
                  <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-rose-200">
                    {item.badge.text}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-800 bg-slate-950/95 px-3 py-2 shadow-lg lg:hidden">
        <ul className="flex items-center justify-between gap-1">
          {mobile.map((item) => {
            const Icon = item.icon;
            const isActive = pathname.startsWith(item.href);
            return (
              <li key={item.key} className="flex flex-1">
                <Link
                  href={item.href}
                  className={`flex w-full flex-col items-center gap-1 rounded-xl px-3 py-2 text-xs font-medium transition ${
                    isActive ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                  onClick={onNavigate}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
