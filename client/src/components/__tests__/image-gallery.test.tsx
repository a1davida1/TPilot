import React from 'react';
import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  afterAll,
  vi
} from 'vitest';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import { act } from "react";
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient as QueryClientType } from '@tanstack/react-query';

const { toastMock, downloadProtectedImageMock } = vi.hoisted(() => ({
  toastMock: vi.fn(),
  downloadProtectedImageMock: vi.fn()
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock })
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ isAuthenticated: true })
}));

vi.mock('@/lib/image-protection', async () => {
  const actual = await vi.importActual<typeof import('@/lib/image-protection')>('@/lib/image-protection');
  return {
    ...actual,
    downloadProtectedImage: downloadProtectedImageMock
  };
});

import { ImageGallery } from '../image-gallery';

interface MockImage {
  id: number;
  userId: number;
  key: string;
  filename: string;
  bytes: number;
  mime: string;
  visibility: string;
  signedUrl: string;
  downloadUrl: string;
  createdAt: string;
  lastRepostedAt?: string;
  protectionLevel?: string;
}

type FetchArgs = Parameters<typeof fetch>;
type FetchReturn = ReturnType<typeof fetch>;

type RenderEntry = {
  root: Root;
  container: HTMLElement;
  queryClient: QueryClientType;
};

const mountedEntries: RenderEntry[] = [];

const baseImages: MockImage[] = [
  {
    id: 1,
    userId: 10,
    key: '1/image-one.jpg',
    filename: 'image-one.jpg',
    bytes: 150 * 1024,
    mime: 'image/jpeg',
    visibility: 'private',
    signedUrl: 'https://cdn.example.com/image-one.jpg',
    downloadUrl: 'https://cdn.example.com/image-one.jpg',
    createdAt: '2024-01-01T00:00:00.000Z'
  },
  {
    id: 2,
    userId: 10,
    key: '1/image-two.jpg',
    filename: 'image-two.jpg',
    bytes: 220 * 1024,
    mime: 'image/png',
    visibility: 'private',
    signedUrl: 'https://cdn.example.com/image-two.png',
    downloadUrl: 'https://cdn.example.com/image-two.png',
    createdAt: '2024-01-05T00:00:00.000Z'
  }
];

const originalFetch = globalThis.fetch;
let fetchMock: ReturnType<typeof vi.fn>;

function cloneImages(): MockImage[] {
  return baseImages.map((image) => ({ ...image }));
}

function createJsonResponse(data: unknown, init?: ResponseInit): Response {
  const headers = new Headers(init?.headers);
  if (!headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  return new Response(JSON.stringify(data), {
    status: init?.status ?? 200,
    statusText: init?.statusText,
    headers
  });
}

function toUrl(input: FetchArgs[0]): string {
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof URL) {
    return input.toString();
  }
  return input.url;
}

function renderGallery(): void {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <ImageGallery />
      </QueryClientProvider>
    );
  });
  mountedEntries.push({ root, container, queryClient });
}

function cleanup(): void {
  while (mountedEntries.length > 0) {
    const entry = mountedEntries.pop();
    if (!entry) {
      break;
    }
    const { root, container, queryClient } = entry;
    act(() => {
      root.unmount();
    });
    queryClient.clear();
    container.remove();
  }
}

function queryByTestId(testId: string): HTMLElement | null {
  return document.body.querySelector(`[data-testid="${testId}"]`);
}

async function waitFor<T>(callback: () => T, options: { timeout?: number; interval?: number } = {}): Promise<T> {
  const { timeout = 2000, interval = 20 } = options;
  const start = Date.now();
  let lastError: unknown;
  while (Date.now() - start < timeout) {
    try {
      return callback();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, interval));
    }
  }
  throw lastError ?? new Error('waitFor timeout');
}

async function findByTestId(testId: string): Promise<HTMLElement> {
  return waitFor(() => {
    const element = queryByTestId(testId);
    if (!element) {
      throw new Error(`Element with test id ${testId} not found`);
    }
    return element;
  });
}

beforeEach(() => {
  toastMock.mockClear();
  downloadProtectedImageMock.mockClear();
  fetchMock = vi.fn();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  cleanup();
  fetchMock.mockReset();
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

describe('ImageGallery detail modal', () => {
  it('opens and closes the detail modal from a gallery item', async () => {
    let currentImages = cloneImages();
    fetchMock.mockImplementation(async (input, init) => {
      const url = toUrl(input);
      const method = (init?.method ?? 'GET').toUpperCase();
      if (url.endsWith('/api/media') && method === 'GET') {
        return createJsonResponse(currentImages);
      }
      throw new Error(`Unhandled request ${method} ${url}`);
    });

    renderGallery();

    const firstCard = (await findByTestId('image-card-1')) as HTMLButtonElement;
    await act(async () => {
      firstCard.click();
    });

    const dialog = await findByTestId('image-detail-dialog');
    expect(dialog).toBeTruthy();

    const closeButton = await findByTestId('dialog-close-button');
    await act(async () => {
      (closeButton as HTMLButtonElement).click();
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 100));
    });

    await waitFor(() => {
      const maybeDialog = queryByTestId('image-detail-dialog');
      if (maybeDialog && maybeDialog.offsetParent !== null) {
        throw new Error('Dialog still visible');
      }
      return true;
    }, { timeout: 3000 });
  });

  it('queues a quick repost and updates the cached image state', async () => {
    const repostedAt = '2024-02-01T12:00:00.000Z';
    let currentImages = cloneImages();
    fetchMock.mockImplementation(async (input, init) => {
      const url = toUrl(input);
      const method = (init?.method ?? 'GET').toUpperCase();
      if (url.endsWith('/api/media') && method === 'GET') {
        return createJsonResponse(currentImages);
      }
      if (url.endsWith('/api/reddit/quick-repost') && method === 'POST') {
        const body = typeof init?.body === 'string' ? JSON.parse(init.body) : {};
        const imageId = Number(body.imageId);
        currentImages = currentImages.map((image) =>
          image.id === imageId ? { ...image, lastRepostedAt: repostedAt } : image
        );
        return createJsonResponse({ success: true, repostedAt });
      }
      throw new Error(`Unhandled request ${method} ${url}`);
    });

    renderGallery();

    const firstCard = (await findByTestId('image-card-1')) as HTMLButtonElement;
    await act(async () => {
      firstCard.click();
    });

    const repostButton = (await findByTestId('quick-repost-button')) as HTMLButtonElement;
    await act(async () => {
      repostButton.click();
    });

    await waitFor(() => {
      const badge = queryByTestId('repost-status');
      if (!badge) {
        throw new Error('Repost badge not found');
      }
      expect(badge.getAttribute('data-reposted-at')).toBe(repostedAt);
      return true;
    });

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Repost queued' })
    );
  });

  it('applies quick protection and reflects the new protection state', async () => {
    const protectedUrl = 'https://cdn.example.com/protected-image-one.jpg';
    let currentImages = cloneImages();
    fetchMock.mockImplementation(async (input, init) => {
      const url = toUrl(input);
      const method = (init?.method ?? 'GET').toUpperCase();
      if (url.endsWith('/api/media') && method === 'GET') {
        return createJsonResponse(currentImages);
      }
      if (url.includes('/api/protect-image/') && method === 'POST') {
        const imageId = Number.parseInt(url.split('/').pop() ?? '', 10);
        currentImages = currentImages.map((image) =>
          image.id === imageId
            ? {
                ...image,
                protectionLevel: 'standard',
                signedUrl: protectedUrl,
                downloadUrl: protectedUrl
              }
            : image
        );
        return createJsonResponse({ success: true, protectedUrl, message: 'Image protected successfully' });
      }
      throw new Error(`Unhandled request ${method} ${url}`);
    });

    renderGallery();

    const firstCard = (await findByTestId('image-card-1')) as HTMLButtonElement;
    await act(async () => {
      firstCard.click();
    });

    const protectButton = (await findByTestId('quick-protect-button')) as HTMLButtonElement;
    await act(async () => {
      protectButton.click();
    });

    await waitFor(() => {
      const badge = queryByTestId('protection-status');
      if (!badge) {
        throw new Error('Protection badge not found');
      }
      expect(badge.getAttribute('data-protection-level')).toBe('standard');
      const modalImage = document.querySelector('[data-testid="image-detail-dialog"] img') as HTMLImageElement | null;
      expect(modalImage?.getAttribute('src')).toBe(protectedUrl);
      return true;
    });

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Image protected' })
    );
  });
});
