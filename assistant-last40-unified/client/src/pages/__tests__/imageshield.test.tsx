
import React from 'react';
import { act } from 'react';
import { createRoot, Root } from 'react-dom/client';
import { describe, expect, it, beforeEach, afterEach, vi } from 'vitest';

const imageShieldPropsSpy = vi.fn();

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({
    user: { tier: 'pro_plus' },
  }) as unknown,
}));

vi.mock('@/components/image-shield', () => ({
  ImageShield: (props: { userTier?: 'free' | 'starter' | 'pro'; isGuestMode?: boolean }) => {
    imageShieldPropsSpy(props);
    return <div data-testid="image-shield-mock" />;
  },
}));

const globalScope = globalThis as typeof globalThis & {
  React?: typeof React;
  IS_REACT_ACT_ENVIRONMENT?: boolean;
};

globalScope.React = React;
globalScope.IS_REACT_ACT_ENVIRONMENT = true;

const renderImageShieldPage = async (ImageShieldPage: React.ComponentType) => {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(<ImageShieldPage />);
  });

  return { container, root };
};

const cleanupRender = async (root: Root, container: HTMLElement) => {
  await act(async () => {
    root.unmount();
  });
  container.remove();
};

describe('ImageShield page', () => {
  beforeEach(() => {
    vi.resetModules();
    imageShieldPropsSpy.mockClear();
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('normalizes pro_plus tier to pro for ImageShield component', async () => {
    const { default: ImageShieldPage } = await import('../imageshield');

    const { container, root } = await renderImageShieldPage(ImageShieldPage);

    expect(imageShieldPropsSpy).toHaveBeenCalledTimes(1);
    const props = imageShieldPropsSpy.mock.calls[0]?.[0];
    expect(props?.userTier).toBe('pro');

    await cleanupRender(root, container);
  });
});
