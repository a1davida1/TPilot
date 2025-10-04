import React from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { EnhancedAIGenerator } from "@/components/enhanced-ai-generator";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();
const apiRequestMock = vi.hoisted(() => vi.fn());
const toastMock = vi.fn();
let mockedAuthUser: { id: number; username: string; tier?: string } | null = {
  id: 1,
  username: "testuser",
  tier: "free",
};

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

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: mockedAuthUser,
    isAuthenticated: !!mockedAuthUser,
  }),
}));

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

function queryByTestId(testId: string): HTMLElement | null {
  return document.body.querySelector(
    `[data-testid="${testId}"]`
  ) as HTMLElement | null;
}

describe("EnhancedAIGenerator", () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  beforeEach(() => {
    // Mock daily usage query
    mockUseQuery.mockImplementation((options: { queryKey: unknown[] }) => {
      if (
        Array.isArray(options.queryKey) &&
        options.queryKey[0] === "/api/stats/daily-usage"
      ) {
        return {
          data: { count: 5 },
          isLoading: false,
          isError: false,
        };
      }
      return {
        data: undefined,
        isLoading: false,
        isError: false,
      };
    });

    // Mock successful mutation
    mockUseMutation.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    });
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it("renders without crashing for authenticated user", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <EnhancedAIGenerator userTier="free" onContentGenerated={vi.fn()} />
      </QueryClientProvider>
    );

    const generateButton = queryByTestId("button-generate-content");
    expect(generateButton).toBeTruthy();
  });

  it("displays quota information for free tier", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <EnhancedAIGenerator userTier="free" onContentGenerated={vi.fn()} />
      </QueryClientProvider>
    );

    const quotaText = queryByText(/5\/10 generations used today/i);
    expect(quotaText).toBeTruthy();
  });

  it("shows login button for guest users", () => {
    mockedAuthUser = null;

    render(
      <QueryClientProvider client={queryClient}>
        <EnhancedAIGenerator userTier="guest" onContentGenerated={vi.fn()} />
      </QueryClientProvider>
    );

    const loginButton = queryByText(/Log in to generate content/i);
    expect(loginButton).toBeTruthy();
  });

  it("displays tone selection dropdown", () => {
    mockedAuthUser = { id: 1, username: "testuser", tier: "free" };

    render(
      <QueryClientProvider client={queryClient}>
        <EnhancedAIGenerator userTier="free" onContentGenerated={vi.fn()} />
      </QueryClientProvider>
    );

    const toneLabel = queryByText(/Tone/i);
    expect(toneLabel).toBeTruthy();
  });

  it("displays photo type selection dropdown", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <EnhancedAIGenerator userTier="free" onContentGenerated={vi.fn()} />
      </QueryClientProvider>
    );

    const photoLabel = queryByText(/Photo Type/i);
    expect(photoLabel).toBeTruthy();
  });

  it("shows quota exhausted message when limit reached", () => {
    mockUseQuery.mockImplementation((options: { queryKey: unknown[] }) => {
      if (
        Array.isArray(options.queryKey) &&
        options.queryKey[0] === "/api/stats/daily-usage"
      ) {
        return {
          data: { count: 10 },
          isLoading: false,
          isError: false,
        };
      }
      return {
        data: undefined,
        isLoading: false,
        isError: false,
      };
    });

    render(
      <QueryClientProvider client={queryClient}>
        <EnhancedAIGenerator userTier="free" onContentGenerated={vi.fn()} />
      </QueryClientProvider>
    );

    const exhaustedText = queryByText(/Daily limit reached/i);
    expect(exhaustedText).toBeTruthy();
  });
});
