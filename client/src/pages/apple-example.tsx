import React from 'react';
import { AppleNav } from '@/components/apple-nav';
import { AppleDashboard } from '@/components/apple-dashboard';

export function AppleExamplePage() {
  return (
    <div className="min-h-screen bg-background transition-colors duration-300">
      <AppleNav />
      <AppleDashboard />
    </div>
  );
}
