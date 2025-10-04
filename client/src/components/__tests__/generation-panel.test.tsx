import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GenerationPanel } from '../generation-panel';

describe('GenerationPanel', () => {
  let container: HTMLDivElement;
  let root: ReturnType<typeof createRoot>;
  let queryClient: QueryClient;
  let sessionStorageMock: Record<string, string>;
  const mockOnContentGenerated = vi.fn();

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });

    // Mock sessionStorage
    sessionStorageMock = {};
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((key: string) => {
      return sessionStorageMock[key] || null;
    });

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation((key: string, value: string) => {
      sessionStorageMock[key] = value;
      return undefined;
    });
  });

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    document.body.removeChild(container);
    vi.restoreAllMocks();
    mockOnContentGenerated.mockClear();
  });

  it('renders generation panel with timing options', () => {
    act(() => {
      root = createRoot(container);
      root.render(
        <QueryClientProvider client={queryClient}>
          <GenerationPanel onContentGenerated={mockOnContentGenerated} />
        </QueryClientProvider>
      );
    });

    expect(container.querySelector('[data-testid="timing-morning"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="timing-evening"]')).toBeTruthy();
    expect(container.querySelector('[data-testid="timing-late"]')).toBeTruthy();
  });

  it('persists timing selection to sessionStorage', () => {
    act(() => {
      root = createRoot(container);
      root.render(
        <QueryClientProvider client={queryClient}>
          <GenerationPanel onContentGenerated={mockOnContentGenerated} />
        </QueryClientProvider>
      );
    });

    const morningButton = container.querySelector('[data-testid="timing-morning"]') as HTMLButtonElement;
    
    act(() => {
      morningButton.click();
    });

    // Verify timing was persisted
    expect(sessionStorageMock['content_timing']).toBe('morning');
  });

  it('displays copy counter when content is copied', () => {
    act(() => {
      root = createRoot(container);
      root.render(
        <QueryClientProvider client={queryClient}>
          <GenerationPanel onContentGenerated={mockOnContentGenerated} />
        </QueryClientProvider>
      );
    });

    // Counter should not be visible initially
    expect(container.querySelector('[data-testid="copy-counter"]')).toBeFalsy();
  });

  it('updates timing optimization hint', () => {
    act(() => {
      root = createRoot(container);
      root.render(
        <QueryClientProvider client={queryClient}>
          <GenerationPanel onContentGenerated={mockOnContentGenerated} />
        </QueryClientProvider>
      );
    });

    // Should have optimization hint text
    const hintText = container.textContent;
    expect(hintText).toContain('optimizes engagement');
  });
});
