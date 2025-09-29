
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
import type { UploadResult } from "@uppy/core";

import SampleUpload from "@/components/sample-upload";

interface MutationOptions<Variables = unknown> {
  mutationFn: (variables: Variables) => Promise<unknown>;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

type QueryResult<Data> = {
  data: Data;
  isLoading: boolean;
  error: Error | null;
};

const mockUseQuery = vi.fn();
const mockUseMutation = vi.fn();
const toastMock = vi.fn();
const invalidateQueriesMock = vi.hoisted(() => vi.fn());
const apiRequestMock = vi.hoisted(() => vi.fn());

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: { queryKey: unknown; queryFn: () => Promise<unknown> }) =>
    mockUseQuery(options),
  useMutation: (options: MutationOptions) => mockUseMutation(options),
  QueryClient: vi.fn(() => ({
    getQueryData: vi.fn(),
    setQueryData: vi.fn(),
    invalidateQueries: vi.fn(),
    removeQueries: vi.fn(),
  })),
  QueryFunction: vi.fn(),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/lib/queryClient", async () => {
  const actual = await vi.importActual<typeof import("@/lib/queryClient")>("@/lib/queryClient");
  return {
    ...actual,
    apiRequest: apiRequestMock(),
    queryClient: {
      ...actual.queryClient,
      invalidateQueries: invalidateQueriesMock(),
    },
  };
});

vi.mock("@/components/ObjectUploader", () => ({
  ObjectUploader: ({
    onComplete,
    children,
  }: {
    onComplete?: (
      result: UploadResult<Record<string, unknown>, Record<string, unknown>>,
    ) => void;
    children: React.ReactNode;
  }) => (
    <button
      type="button"
      data-testid="mock-object-uploader"
      onClick={() =>
        onComplete?.({
          successful: [{ uploadURL: "https://cdn.example.com/uploaded.png" }],
        } as UploadResult<Record<string, unknown>, Record<string, unknown>>)
      }
    >
      {children}
    </button>
  ),
}));

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
    const entry = mountedRoots.pop();
    if (!entry) {
      break;
    }
    const { root, container } = entry;
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

const clipboardDescriptor = Object.getOwnPropertyDescriptor(navigator, "clipboard");
const clipboardWriteMock = vi.fn(() => Promise.resolve());

describe("SampleUpload", () => {
  beforeEach(() => {
    cleanup();
    mockUseQuery.mockReset();
    mockUseMutation.mockReset();
    toastMock.mockReset();
    invalidateQueriesMock.mockReset();
    apiRequestMock.mockReset();
    clipboardWriteMock.mockReset();

    mockUseMutation.mockImplementation(() => ({ mutate: vi.fn(), isPending: false }));

    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: clipboardWriteMock,
      },
    });
  });

  afterEach(() => {
    cleanup();
  });

  afterAll(() => {
    if (clipboardDescriptor) {
      Object.defineProperty(navigator, "clipboard", clipboardDescriptor);
    }
  });

  it("renders samples from the query and copies content to the clipboard", async () => {
    const sample = {
      id: 42,
      userId: 7,
      title: "Viral Reddit Post",
      content: "Always provide value first.",
      platform: "reddit" as const,
      createdAt: new Date("2024-06-01").toISOString(),
      updatedAt: new Date("2024-06-01").toISOString(),
      upvotes: 512,
    };

    mockUseQuery.mockImplementation((): QueryResult<typeof sample[]> => ({
      data: [sample],
      isLoading: false,
      error: null,
    }));

    render(<SampleUpload />);

    const sampleCard = await findByTestId(`sample-card-${sample.id}`);
    click(sampleCard);

    const copyButton = getButtonByText(/Copy Content/i);
    click(copyButton);

    await waitFor(() => {
      expect(clipboardWriteMock).toHaveBeenCalledWith(sample.content);
    });

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Copied!", description: "Content copied to clipboard." }),
    );
  });

  it("updates the form after an upload completes", async () => {
    mockUseQuery.mockImplementation((): QueryResult<[]> => ({
      data: [],
      isLoading: false,
      error: null,
    }));

    render(<SampleUpload />);

    const addButton = getButtonByText(/Add Sample/i);
    click(addButton);

    const uploaderButton = await findByTestId("mock-object-uploader");
    click(uploaderButton);

    await findByText(/Image uploaded successfully/i);

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Image uploaded" }),
    );
  });
});
