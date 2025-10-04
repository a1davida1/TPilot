import React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type MockQueryOptions = {
  queryKey: unknown;
  enabled?: boolean;
};

type MockQueryResult<TData = unknown, TError = unknown> = {
  data: TData;
  isLoading: boolean;
  isError: boolean;
  error: TError;
  refetch: () => Promise<unknown>;
};

const mockUseQuery = vi.fn<(options: MockQueryOptions) => MockQueryResult>();
const mockUseAuth = vi.fn();
const mockToast = vi.fn();
const mockNavigate = vi.fn();

vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual<typeof import('@tanstack/react-query')>('@tanstack/react-query');

  return {
    ...actual,
    useQuery: (options: MockQueryOptions) => mockUseQuery(options),
  };
});

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: (...args: unknown[]) => mockToast(...args) }),
}));

vi.mock('wouter', () => ({
  useLocation: () => ['/referral', mockNavigate],
}));

const globalScope = globalThis as typeof globalThis & {
  React?: typeof React;
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

globalScope.React = React;

globalScope.IS_REACT_ACT_ENVIRONMENT = true;

const flushPromises = () => new Promise<void>((resolve) => {
  setTimeout(resolve, 0);
});

const clipboardWriteText = vi.fn((_text: string) => Promise.resolve());

Object.defineProperty(navigator, 'clipboard', {
  value: {
    writeText: clipboardWriteText,
  },
  configurable: true,
});

describe('ReferralPage', () => {
  beforeEach(() => {
    vi.resetModules();
    mockUseQuery.mockReset();
    mockUseAuth.mockReset();
    mockToast.mockReset();
    mockNavigate.mockReset();
    clipboardWriteText.mockReset();
    Object.defineProperty(navigator, 'share', {
      value: vi.fn().mockResolvedValue(undefined),
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('renders live referral data from API responses', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 42 }, isLoading: false });

    mockUseQuery.mockImplementation(({ queryKey }: MockQueryOptions) => {
      const key = Array.isArray(queryKey) ? queryKey[0] : queryKey;

      if (key === '/api/referral/code') {
        return {
          data: { referralCode: 'TP123456', referralUrl: 'https://example.com/signup?ref=TP123456' },
          isLoading: false,
          isError: false,
          error: null,
          refetch: vi.fn().mockResolvedValue(undefined),
        } satisfies MockQueryResult;
      }

      if (key === '/api/referral/summary') {
        return {
          data: {
            code: 'TP123456',
            totalReferrals: 12,
            activeReferrals: 7,
            totalCommission: 35,
            conversionRate: 0.58,
          },
          isLoading: false,
          isError: false,
          error: null,
          refetch: vi.fn().mockResolvedValue(undefined),
        } satisfies MockQueryResult;
      }

      return {
        data: undefined,
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn().mockResolvedValue(undefined),
      } satisfies MockQueryResult;
    });

    const { default: ReferralPage } = await import('../referral');

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<ReferralPage />);
    });

    await act(async () => {
      await flushPromises();
    });

    const codeInput = container.querySelector('[data-testid="input-referral-code"]') as HTMLInputElement | null;
    const urlInput = container.querySelector('[data-testid="input-referral-url"]') as HTMLInputElement | null;
    const totalReferrals = container.querySelector('[data-testid="stat-total-referrals"]');
    const totalCommission = container.querySelector('[data-testid="stat-total-commission"]');
    const conversionRate = container.querySelector('[data-testid="stat-conversion-rate"]');

    expect(codeInput?.value).toBe('TP123456');
    expect(urlInput?.value).toBe('https://example.com/signup?ref=TP123456');
    expect(totalReferrals?.textContent).toContain('12');
    expect(totalCommission?.textContent).toContain('$35.00');
    expect(conversionRate).not.toBeNull();
    expect(conversionRate?.textContent).toBe('58%');
  });

  it('copies and shares referral information using live API payloads', async () => {
    mockUseAuth.mockReturnValue({ user: { id: 12 }, isLoading: false });

    mockUseQuery.mockImplementation(({ queryKey }: MockQueryOptions) => {
      const key = Array.isArray(queryKey) ? queryKey[0] : queryKey;

      if (key === '/api/referral/code') {
        return {
          data: { referralCode: 'TP654321', referralUrl: 'https://example.com/signup?ref=TP654321' },
          isLoading: false,
          isError: false,
          error: null,
          refetch: vi.fn().mockResolvedValue(undefined),
        } satisfies MockQueryResult;
      }

      if (key === '/api/referral/summary') {
        return {
          data: {
            code: 'TP654321',
            totalReferrals: 5,
            activeReferrals: 3,
            totalCommission: 15,
            conversionRate: 0.6,
          },
          isLoading: false,
          isError: false,
          error: null,
          refetch: vi.fn().mockResolvedValue(undefined),
        } satisfies MockQueryResult;
      }

      return {
        data: undefined,
        isLoading: false,
        isError: false,
        error: null,
        refetch: vi.fn().mockResolvedValue(undefined),
      } satisfies MockQueryResult;
    });

    const { default: ReferralPage } = await import('../referral');

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    const shareMock = navigator.share as unknown as ReturnType<typeof vi.fn>;

    await act(async () => {
      root.render(<ReferralPage />);
    });

    await act(async () => {
      await flushPromises();
    });

    const copyCodeButton = container.querySelector('[data-testid="button-copy-code"]') as HTMLButtonElement | null;
    const shareButton = container.querySelector('[data-testid="button-share-referral"]') as HTMLButtonElement | null;

    expect(copyCodeButton).not.toBeNull();
    expect(shareButton).not.toBeNull();

    await act(async () => {
      copyCodeButton?.click();
      await flushPromises();
    });

    expect(clipboardWriteText).toHaveBeenCalledWith('TP654321');

    await act(async () => {
      shareButton?.click();
      await flushPromises();
    });

    expect(shareMock).toHaveBeenCalledWith({
      title: 'Join ThottoPilot with my referral code!',
      text: 'Get exclusive content creation tools and earn rewards with my referral code.',
      url: 'https://example.com/signup?ref=TP654321',
    });

    Object.defineProperty(navigator, 'share', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    const fallbackShareButton = container.querySelector('[data-testid="button-share-referral"]') as HTMLButtonElement | null;

    clipboardWriteText.mockClear();

    await act(async () => {
      fallbackShareButton?.click();
      await flushPromises();
    });

    expect(clipboardWriteText).toHaveBeenCalledWith('https://example.com/signup?ref=TP654321');
  });

  it('redirects unauthenticated users to the login page', async () => {
    mockUseAuth.mockReturnValue({ user: null, isLoading: false });

    mockUseQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      error: null,
      refetch: vi.fn().mockResolvedValue(undefined),
    } satisfies MockQueryResult);

    const { default: ReferralPage } = await import('../referral');

    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    await act(async () => {
      root.render(<ReferralPage />);
    });

    await act(async () => {
      await flushPromises();
    });

    expect(mockNavigate).toHaveBeenCalledWith('/login?redirect=/referral');
    expect(container.textContent).toContain('Redirecting to login…');
  });
});