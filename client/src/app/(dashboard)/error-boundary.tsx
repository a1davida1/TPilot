'use client';

import { Component, type ErrorInfo, type ReactNode } from "react";
import DashboardError from "./error";

interface DashboardErrorBoundaryProps {
  children: ReactNode;
}

interface DashboardErrorBoundaryState {
  error: Error | null;
}

export class DashboardErrorBoundary extends Component<DashboardErrorBoundaryProps, DashboardErrorBoundaryState> {
  state: DashboardErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): DashboardErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Dashboard runtime error", error, info);
  }

  private handleReset = () => {
    this.setState({ error: null });
  };

  override render(): ReactNode {
    if (this.state.error) {
      return <DashboardError error={this.state.error} reset={this.handleReset} />;
    }

    return this.props.children;
  }
}
