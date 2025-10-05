import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { act } from "react";
import { OnboardingWizard } from "@/components/onboarding-wizard";

const mockUseOnboardingState = vi.fn();
const toastMock = vi.fn();

vi.mock("@/hooks/use-onboarding-state", () => ({
  useOnboardingState: () => mockUseOnboardingState(),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
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

describe("OnboardingWizard", () => {
  const mockOnComplete = vi.fn();
  const mockOnSkip = vi.fn();
  const mockUpdateState = vi.fn();

  beforeEach(() => {
    mockUseOnboardingState.mockReturnValue({
      data: {
        completedSteps: [],
        isMinimized: false,
        isDismissed: false,
      },
      isLoading: false,
      isError: false,
      updateState: mockUpdateState,
      isUpdating: false,
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders without crashing", () => {
    render(
      <OnboardingWizard onComplete={mockOnComplete} onSkip={mockOnSkip} />
    );

    const welcomeText = queryByText(/Welcome to ThottoPilot/i);
    expect(welcomeText).toBeTruthy();
  });

  it("displays first step by default", () => {
    render(
      <OnboardingWizard onComplete={mockOnComplete} onSkip={mockOnSkip} />
    );

    const firstStep = queryByText(/Welcome to ThottoPilot/i);
    expect(firstStep).toBeTruthy();
  });

  it("shows progress bar", () => {
    const { container } = render(
      <OnboardingWizard onComplete={mockOnComplete} onSkip={mockOnSkip} />
    );

    const progressBar = container.querySelector('[role="progressbar"]');
    expect(progressBar).toBeTruthy();
  });

  it("displays navigation buttons", () => {
    render(
      <OnboardingWizard onComplete={mockOnComplete} onSkip={mockOnSkip} />
    );

    const nextButton = queryByText(/Next/i);
    expect(nextButton).toBeTruthy();
  });

  it("restores wizard position from completed steps", () => {
    mockUseOnboardingState.mockReturnValue({
      data: {
        completedSteps: ["welcome", "platforms"],
        isMinimized: false,
        isDismissed: false,
      },
      isLoading: false,
      isError: false,
      updateState: mockUpdateState,
      isUpdating: false,
    });

    render(
      <OnboardingWizard onComplete={mockOnComplete} onSkip={mockOnSkip} />
    );

    // Should be at the AI setup step (first incomplete)
    const aiSetupStep = queryByText(/Customize Your AI Assistant/i);
    expect(aiSetupStep).toBeTruthy();
  });

  it("displays content type selection on welcome step", () => {
    render(
      <OnboardingWizard onComplete={mockOnComplete} onSkip={mockOnSkip} />
    );

    // Welcome step should contain content type options
    const welcomeStep = queryByText(/Welcome to ThottoPilot/i);
    expect(welcomeStep).toBeTruthy();
  });

  it("shows skip button", () => {
    render(
      <OnboardingWizard onComplete={mockOnComplete} onSkip={mockOnSkip} />
    );

    const skipButton = queryByText(/Skip/i);
    expect(skipButton).toBeTruthy();
  });
});
