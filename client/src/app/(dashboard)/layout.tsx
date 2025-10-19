'use client';

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface DashboardLayoutProps {
  sidebar: ReactNode;
  header: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export function DashboardLayout({
  sidebar,
  header,
  toolbar,
  children,
  footer,
  className,
}: DashboardLayoutProps) {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-50">
      <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6 px-4 pb-12 pt-6 sm:px-6 lg:px-8">
        <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
          <aside className="hidden lg:block lg:sticky lg:top-6">
            <div className="rounded-3xl border border-white/10 bg-gradient-to-b from-slate-900/80 via-slate-900 to-slate-950 p-4 shadow-2xl shadow-purple-900/10 backdrop-blur">
              {sidebar}
            </div>
          </aside>
          <main className="flex min-w-0 flex-col gap-6">
            <header className="rounded-3xl border border-white/10 bg-slate-900/80 p-6 shadow-2xl shadow-purple-900/10 backdrop-blur">
              {header}
            </header>
            {toolbar ? (
              <div className="rounded-3xl border border-white/10 bg-slate-900/60 p-4 shadow-lg shadow-purple-900/5 backdrop-blur">
                {toolbar}
              </div>
            ) : null}
            <section
              className={cn(
                "rounded-3xl border border-white/10 bg-gradient-to-b from-slate-900/70 via-slate-950/60 to-slate-950/80 p-6 shadow-xl shadow-purple-900/10 backdrop-blur",
                className
              )}
            >
              {children}
            </section>
            {footer ? (
              <footer className="rounded-3xl border border-white/10 bg-slate-900/70 p-6 shadow-lg shadow-purple-900/5 backdrop-blur">
                {footer}
              </footer>
            ) : null}
          </main>
        </div>
      </div>
    </div>
  );
}
