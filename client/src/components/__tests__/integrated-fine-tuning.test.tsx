import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { IntegratedFineTuning } from "@/components/integrated-fine-tuning";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();
const apiRequestMock = vi.hoisted(() => vi.fn());
const toastMock = vi.fn();

vi.mock("@tanstack/react-query", async () => {
  const actual = await vi.importActual<typeof import("@tanstack/react-query")>(
    "@tanstack/react-query"
  );
  return {
    ...actual,
    useQuery: (options: { queryKey: unknown }) => mockUseQuery(options),
    useMutation: (options: unknown) => mockUseMutation(options),
  };
});

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/lib/queryClient", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/queryClient")
  >("@/lib/queryClient");
  return {
    ...actual,
    apiRequest: apiRequestMock,
  };
});

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

describe("IntegratedFineTuning", () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  beforeEach(() => {
    // Mock successful preferences fetch
    mockUseQuery.mockReturnValue({
      data: {
        samplePhotos: ["photo1.jpg"],
        personalDetails: "Sample details",
        styleNotes: "Sample style notes",
      },
      isLoading: false,
      isError: false,
    });

    // Mock successful mutation
    mockUseMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders without crashing", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <IntegratedFineTuning />
      </QueryClientProvider>
    );

    const heading = queryByText(/Fine-Tuning Preferences/i);
    expect(heading).toBeTruthy();
  });

  it("displays loading state", () => {
    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });

    render(
      <QueryClientProvider client={queryClient}>
        <IntegratedFineTuning />
      </QueryClientProvider>
    );

    const loadingText = queryByText(/Loading preferences/i);
    expect(loadingText).toBeTruthy();
  });

  it("displays sample photos section", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <IntegratedFineTuning />
      </QueryClientProvider>
    );

    const sampleSection = queryByText(/Sample Photos/i);
    expect(sampleSection).toBeTruthy();
  });

  it("displays personal details section", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <IntegratedFineTuning />
      </QueryClientProvider>
    );

    const detailsSection = queryByText(/Personal Details/i);
    expect(detailsSection).toBeTruthy();
  });

  it("displays style notes section", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <IntegratedFineTuning />
      </QueryClientProvider>
    );

    const styleSection = queryByText(/Style Notes/i);
    expect(styleSection).toBeTruthy();
  });
});
