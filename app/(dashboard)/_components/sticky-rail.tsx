import type { ReactNode } from 'react';
import { twMerge } from 'tailwind-merge';

interface StickyRailProps {
  children: ReactNode;
  rail: ReactNode;
  railPosition?: 'start' | 'end';
  offset?: number;
}

export function StickyRail({ children, rail, railPosition = 'end', offset = 112 }: StickyRailProps) {
  const mainOrder = railPosition === 'start' ? 'lg:order-2' : 'lg:order-1';
  const railOrder = railPosition === 'start' ? 'lg:order-1' : 'lg:order-2';

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-10">
      <section className={twMerge('min-w-0 space-y-6', mainOrder)}>{children}</section>
      <aside
        className={twMerge('self-start rounded-2xl border border-slate-800 bg-slate-900/80 p-5 shadow-bubble', railOrder)}
        style={{ top: `${offset}px`, position: 'sticky' }}
      >
        <div className="space-y-6">{rail}</div>
      </aside>
    </div>
  );
}
