'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';

interface WidgetErrorBoundaryProps {
  fallback?: ReactNode;
  children: ReactNode;
}

interface WidgetErrorBoundaryState {
  hasError: boolean;
  message?: string;
}

export class WidgetErrorBoundary extends Component<WidgetErrorBoundaryProps, WidgetErrorBoundaryState> {
  state: WidgetErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): WidgetErrorBoundaryState {
    return { hasError: true, message: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Widget error captured', error, info);
  }

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }
      return (
        <div className="rounded-2xl border border-red-300 bg-red-50 px-6 py-8 text-sm text-red-700">
          <h3 className="text-base font-semibold">We hit turbulence</h3>
          <p className="mt-2">{this.state.message ?? 'Something went wrong while loading this section.'}</p>
        </div>
      );
    }

    return this.props.children;
  }
}
