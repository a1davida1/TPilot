import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { PremiumLanding } from "@/components/premium-landing";

const mockUseMetrics = vi.fn();

vi.mock("@/hooks/use-metrics", () => ({
  useMetrics: () => mockUseMetrics(),
}));

// Mock ResizeObserver for test environment
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

const mountedRoots: Array<{ root: Root; container: HTMLElement }> = [];

function render(ui: React.ReactElement) {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(ui);
  });
  mountedRoots.push({ root, container });
  return { container };
}

function cleanup() {
  while (mountedRoots.length > 0) {
    const mounted = mountedRoots.pop();
    if (mounted) {
      act(() => {
        mounted.root.unmount();
      });
      mounted.container.remove();
    }
  }
}

function queryByText(matcher: string | RegExp): HTMLElement | null {
  const elements = Array.from(
    document.body.querySelectorAll("*") as NodeListOf<HTMLElement>
  );
  for (const element of elements) {
    const content = element.textContent?.trim() ?? "";
    if (content) {
      if (typeof matcher === "string" && content.includes(matcher)) {
        return element;
      }
      if (matcher instanceof RegExp && matcher.test(content)) {
        return element;
      }
    }
  }
  return null;
}

function queryByTestId(testId: string): HTMLElement | null {
  return document.body.querySelector(
    `[data-testid="${testId}"]`
  ) as HTMLElement | null;
}

describe("PremiumLanding", () => {
  beforeEach(() => {
    mockUseMetrics.mockReturnValue({
      data: {
        creators: 10000,
        posts: 500000,
        engagement: 250,
      },
      isLoading: false,
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders without crashing", () => {
    render(<PremiumLanding />);
    const heading = queryByText(/Dominate/i);
    expect(heading).toBeTruthy();
  });

  it("displays metrics when loaded", () => {
    render(<PremiumLanding />);

    const creatorsMetric = queryByText(/10,000/i);
    expect(creatorsMetric).toBeTruthy();

    const postsMetric = queryByText(/500,000/i);
    expect(postsMetric).toBeTruthy();

    const engagementMetric = queryByText(/250%/i);
    expect(engagementMetric).toBeTruthy();
  });

  it("displays skeleton loaders when metrics are loading", () => {
    mockUseMetrics.mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    const { container } = render(<PremiumLanding />);

    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it("displays stats section with correct testids", () => {
    render(<PremiumLanding />);

    const activeCreatorsStat = queryByTestId("stat-active-creators");
    expect(activeCreatorsStat).toBeTruthy();

    const postsGeneratedStat = queryByTestId("stat-posts-generated");
    expect(postsGeneratedStat).toBeTruthy();

    const engagementBoostStat = queryByTestId("stat-avg.-engagement-boost");
    expect(engagementBoostStat).toBeTruthy();
  });

  it("displays feature cards", () => {
    render(<PremiumLanding />);

    const aiFeature = queryByText(/AI Content Generation/i);
    expect(aiFeature).toBeTruthy();

    const protectionFeature = queryByText(/Image Protection/i);
    expect(protectionFeature).toBeTruthy();

    const analyticsFeature = queryByText(/Analytics Dashboard/i);
    expect(analyticsFeature).toBeTruthy();
  });

  it("displays CTA buttons", () => {
    render(<PremiumLanding />);

    const startButton = queryByText(/Start Creating Free/i);
    expect(startButton).toBeTruthy();
  });

  it("shows loading state in trust indicators", () => {
    mockUseMetrics.mockReturnValue({
      data: undefined,
      isLoading: true,
    });

    const { container } = render(<PremiumLanding />);

    const skeletons = container.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThan(0);
  });
});
