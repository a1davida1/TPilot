'use client';

import { Sparkles, Upload, Calendar, PenSquare } from 'lucide-react';
import Link from 'next/link';

const actions = [
  {
    href: '/posting',
    label: 'Generate caption',
    icon: Sparkles,
  },
  {
    href: '/gallery',
    label: 'Open gallery',
    icon: Upload,
  },
  {
    href: '/posting/schedule',
    label: 'View schedule',
    icon: Calendar,
  },
  {
    href: '/posting',
    label: 'Compose post',
    icon: PenSquare,
  },
] as const;

export function FloatingActions() {
  return (
    <div className="fixed bottom-6 right-6 z-40 hidden flex-col gap-3 lg:flex">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <Link
            key={action.href}
            href={action.href}
            className="group inline-flex items-center gap-3 rounded-full bg-gradient-to-br from-rose-500 via-pink-500 to-fuchsia-600 px-4 py-2 text-sm font-semibold text-white shadow-bubble transition hover:shadow-bubble-hover"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/15">
              <Icon className="h-4 w-4" />
            </span>
            {action.label}
          </Link>
        );
      })}
    </div>
  );
}
