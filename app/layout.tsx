import './globals.css';

import type { Metadata } from 'next';
import { QueryProvider } from './providers';
import type { ReactNode } from 'react';

export const metadata: Metadata = {
  title: 'ThottoPilot Dashboard',
  description: 'Creator control center for Reddit scheduling, analytics, and protection.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-slate-900 font-inter text-slate-100 antialiased">
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
