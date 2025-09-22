import React from "react";
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  afterAll,
  vi,
} from "vitest";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { act } from "react-dom/test-utils";

import { ModernDashboard } from "@/components/modern-dashboard";
import { QuickStartModal } from "@/components/dashboard-quick-start";

const mockUseQuery = vi.fn();
const apiRequestMock = vi.fn();
const toastMock = vi.fn();
const setLocationMock = vi.fn();
let mockedAuthUser: { id: number; username: string; tier?: string; isAdmin?: boolean; role?: string } | null = {
  id: 1,
  username: "Creator",
  tier: "pro",
};

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: { queryKey: unknown }) => mockUseQuery(options),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: mockedAuthUser,
  }),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("wouter", () => ({
  useLocation: () => ["/dashboard", setLocationMock] as const,
}));

vi.mock("@/lib/queryClient", async () => {
  const actual = await vi.importActual<typeof import("@/lib/queryClient")>("@/lib/queryClient");
  return {
    ...actual,
    apiRequest: apiRequestMock,
  };
});

const originalWindowOpen = window.open;

interface RenderResult {
  container: HTMLElement;
}

const mountedRoots: Array<{ root: Root; container: HTMLElement }> = [];

function render(ui: React.ReactElement): RenderResult {
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
    const { root, container } = mountedRoots.pop()!;
    act(() => {
      root.unmount();
    });
    container.remove();
  }
}

function textMatches(text: string, matcher: string | RegExp): boolean {
  if (typeof matcher === "string") {
    return text.includes(matcher);
  }
  return matcher.test(text);
}

function queryByText(matcher: string | RegExp): HTMLElement | null {
  const elements = Array.from(document.body.querySelectorAll("*") as NodeListOf<HTMLElement>);
  for (const element of elements) {
    const content = element.textContent?.trim() ?? "";
    if (content && textMatches(content, matcher)) {
      return element;
    }
  }
  return null;
}

function queryByTestId(testId: string): HTMLElement | null {
  return document.body.querySelector(`[data-testid="${testId}"]`) as HTMLElement | null;
}

async function waitFor<T>(callback: () => T, options: { timeout?: number; interval?: number } = {}): Promise<T> {
  const { timeout = 2000, interval = 20 } = options;
  const start = Date.now();
  let lastError: unknown;
  while (Date.now() - start < timeout) {
    try {
      return await callback();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }
  throw lastError ?? new Error("waitFor timeout");
}

async function findByText(matcher: string | RegExp): Promise<HTMLElement> {
  return waitFor(() => {
    const element = queryByText(matcher);
    if (!element) {
      throw new Error("Text not found");
    }
    return element;
  });
}

async function findByTestId(testId: string): Promise<HTMLElement> {
  return waitFor(() => {
    const element = queryByTestId(testId);
    if (!element) {
      throw new Error("Test id not found");
    }
    return element;
  });
}

function getButtonByText(matcher: string | RegExp): HTMLButtonElement {
  const button = Array.from(document.body.querySelectorAll("button") as NodeListOf<HTMLButtonElement>).find((element) =>
    textMatches(element.textContent?.trim() ?? "", matcher),
  );
  if (!button) {
    throw new Error(`Button with text ${String(matcher)} not found`);
  }
  return button;
}

function click(element: HTMLElement) {
  act(() => {
    element.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
  });
}

describe("ModernDashboard quick start", () => {
  beforeEach(() => {
    cleanup();
    mockUseQuery.mockReset();
    mockUseQuery.mockImplementation(({ queryKey }) => {
      const key = Array.isArray(queryKey) ? queryKey[0] : queryKey;
      if (key === "/api/dashboard/stats") {
        return {
          data: {
            postsToday: 2,
            engagementRate: 3.4,
            takedownsFound: 1,
            estimatedTaxSavings: 1250,
          },
          isLoading: false,
          error: null,
        };
      }
      if (key === "/api/dashboard/activity") {
        return {
          data: { recentMedia: [] },
          isLoading: false,
          error: null,
        };
      }
      return { data: undefined, isLoading: false, error: null };
    });

    apiRequestMock.mockReset();
    toastMock.mockReset();
    setLocationMock.mockReset();
    mockedAuthUser = {
      id: 11,
      username: "Test Creator",
      tier: "pro",
    };
    window.open = vi.fn() as unknown as typeof window.open;
  });

  afterEach(() => {
    cleanup();
  });

  afterAll(() => {
    window.open = originalWindowOpen;
  });

  it("opens the quick start modal when Quick Action is clicked", async () => {
    render(<ModernDashboard isRedditConnected user={{ id: 2, username: "Beta" }} />);

    const quickActionButton = getButtonByText(/Quick Action/i);
    click(quickActionButton);

    const dialog = await findByTestId("quick-start-dialog");
    expect(dialog).toBeTruthy();
    expect(await findByText(/Choose a subreddit/i)).toBeTruthy();
  });

  it("walks through the quick start flow and submits a Reddit post", async () => {
    mockedAuthUser = null;
    apiRequestMock.mockResolvedValueOnce({
      json: async () => ({ authUrl: "https://reddit.com/auth" }),
    } as Response);

    const onOpenChange = vi.fn();
    render(
      <QuickStartModal
        open
        onOpenChange={onOpenChange}
        initialStep="connect"
        isRedditConnected={false}
        onNavigate={setLocationMock}
      />,
    );

    click(getButtonByText(/Connect Reddit/i));

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenCalledWith("GET", "/api/reddit/connect");
      return true;
    });

    apiRequestMock.mockResolvedValueOnce({
      json: async () => ({ success: true }),
    } as Response);

    click(getButtonByText(/^Continue$/i));
    expect(await findByText(/Choose a subreddit/i)).toBeTruthy();

    click(getButtonByText(/^Continue$/i));
    expect(await findByText(/Generate your copy/i)).toBeTruthy();

    click(getButtonByText(/Review post/i));
    expect(await findByText(/Confirm your Reddit post/i)).toBeTruthy();

    click(getButtonByText(/Confirm & post/i));

    await waitFor(() => {
      expect(apiRequestMock).toHaveBeenLastCalledWith(
        "POST",
        "/api/reddit/submit",
        expect.objectContaining({ subreddit: "gonewild" }),
      );
      return true;
    });

    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});