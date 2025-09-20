
import React from 'react';
import { act } from 'react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { createRoot, Root } from 'react-dom/client';

const loadStripeMock = vi.fn(() => Promise.resolve({}));

vi.mock('@stripe/stripe-js', () => ({
  loadStripe: loadStripeMock,
}));

const confirmPaymentMock = vi.fn();

vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="elements">{children}</div>
  ),
  PaymentElement: () => <div data-testid="payment-element" />,
  useStripe: () => ({ confirmPayment: confirmPaymentMock }),
  useElements: () => ({}),
}));

const apiRequestMock = vi.fn(async () => ({
  json: async () => ({ clientSecret: 'test_client_secret' }),
}));

vi.mock('@/lib/queryClient', () => ({
  apiRequest: apiRequestMock,
}));

const toastMock = vi.fn();

vi.mock('@/hooks/use-toast', () => ({
  useToast: () => ({ toast: toastMock }),
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

const renderCheckout = async (Checkout: React.ComponentType) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(<Checkout />);
  });

  return { container, root };
};

const cleanupRender = async (root: Root, container: HTMLElement) => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
};

describe('Checkout page', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    loadStripeMock.mockClear();
    apiRequestMock.mockClear();
    toastMock.mockClear();
    confirmPaymentMock.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    document.body.innerHTML = '';
  });

  it('renders fallback when Stripe is not configured', async () => {
    vi.stubEnv('VITE_STRIPE_PUBLIC_KEY', '');
    const { default: Checkout } = await import('../checkout');

    const { container, root } = await renderCheckout(Checkout);

    expect(container.textContent).toContain('Payment System Not Configured');
    expect(apiRequestMock).not.toHaveBeenCalled();

    await cleanupRender(root, container);
  });

  it('renders payment form when Stripe is configured', async () => {
    vi.stubEnv('VITE_STRIPE_PUBLIC_KEY', 'pk_test_123');
    const { default: Checkout } = await import('../checkout');

    const { container, root } = await renderCheckout(Checkout);

    await act(async () => {
      await flushPromises();
    });

    expect(loadStripeMock).toHaveBeenCalledWith('pk_test_123');
    expect(apiRequestMock).toHaveBeenCalled();

    const elementsContainer = container.querySelector('[data-testid="elements"]');
    expect(elementsContainer).not.toBeNull();
    expect(container.textContent ?? '').toContain('Secured by Stripe');

    await cleanupRender(root, container);
  });
});
