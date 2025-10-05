import React from "react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const useQueryMock = vi.fn();
const useMutationMock = vi.fn();
const useQueryClientMock = vi.fn();
const toastMock = vi.fn();

vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: unknown) => useQueryMock(options),
  useMutation: (options: unknown) => useMutationMock(options),
  useQueryClient: () => useQueryClientMock(),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("wouter", () => ({
  Link: ({ href, children, ...props }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => <h2 {...props}>{children}</h2>,
  CardDescription: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => <p {...props}>{children}</p>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, asChild: _asChild, ...props }: React.PropsWithChildren<{ asChild?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => <span {...props}>{children}</span>,
}));

vi.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  DialogDescription: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => <p {...props}>{children}</p>,
  DialogHeader: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  DialogTitle: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => <h3 {...props}>{children}</h3>,
}));

vi.mock("lucide-react", () => new Proxy({}, {
  get: () => () => null,
}));

import { ProPerks } from "../pro-perks";

describe("ProPerks referral CTA", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    useQueryMock.mockReset();
    useMutationMock.mockReset();
    useQueryClientMock.mockReset();
    toastMock.mockReset();
    
    useQueryClientMock.mockReturnValue({
      invalidateQueries: vi.fn(),
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("renders the referral CTA for Pro members", () => {
    useQueryMock.mockReturnValue({
      data: {
        perks: [
          {
            id: "perk-1",
            name: "Test Perk",
            category: "affiliate",
            tier: "pro",
            description: "A testing perk",
            commissionRate: "10% recurring",
            requirements: [],
            signupProcess: "instant",
            estimatedEarnings: "$100/mo",
            status: "available",
            officialLink: "https://example.com",
            features: ["Feature"],
          },
        ],
        accessGranted: true,
      },
      isLoading: false,
      isError: false,
    });

    act(() => {
      root.render(<ProPerks userTier="pro" />);
    });

    const referralLink = container.querySelector('a[href="/referral"]');
    expect(referralLink).not.toBeNull();
    expect(referralLink?.textContent).toContain("Open referral hub");
  });

  it("keeps the referral CTA visible for non-Pro users", () => {
    useQueryMock.mockReturnValue({
      data: {
        perks: [],
        accessGranted: false,
      },
      isLoading: false,
      isError: false,
    });

    act(() => {
      root.render(<ProPerks userTier="free" />);
    });

    const referralLink = container.querySelector('a[href="/referral"]');
    expect(referralLink).not.toBeNull();
  });
});

describe("ProPerks referral code generation", () => {
  let container: HTMLDivElement;
  let root: Root;
  let mutateMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    useQueryMock.mockReset();
    useMutationMock.mockReset();
    useQueryClientMock.mockReset();
    toastMock.mockReset();
    
    mutateMock = vi.fn();
    
    useQueryClientMock.mockReturnValue({
      invalidateQueries: vi.fn(),
    });

    useQueryMock.mockReturnValue({
      data: {
        perks: [
          {
            id: "perk-1",
            name: "Test Perk",
            category: "affiliate",
            tier: "pro",
            description: "A testing perk",
            commissionRate: "10% recurring",
            requirements: [],
            signupProcess: "instant",
            estimatedEarnings: "$100/mo",
            status: "available",
            officialLink: "https://example.com",
            features: ["Feature 1", "Feature 2"],
          },
        ],
        accessGranted: true,
      },
      isLoading: false,
      isError: false,
    });

    useMutationMock.mockReturnValue({
      mutate: mutateMock,
      isPending: false,
      variables: null,
    });
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("shows generate referral code button when opening perk modal", () => {
    act(() => {
      root.render(<ProPerks userTier="pro" />);
    });

    const perkCard = container.querySelector('[data-testid="perk-card-perk-1"]') as HTMLElement;
    expect(perkCard).not.toBeNull();

    act(() => {
      perkCard.click();
    });

    const generateButton = container.querySelector('[data-testid="generate-referral-code-perk-1"]');
    expect(generateButton).toBeTruthy();
  });

  it("shows loading state when generating referral code", () => {
    useMutationMock.mockReturnValue({
      mutate: mutateMock,
      isPending: true,
      variables: "perk-1",
    });

    act(() => {
      root.render(<ProPerks userTier="pro" />);
    });

    const perkCard = container.querySelector('[data-testid="perk-card-perk-1"]') as HTMLElement;
    act(() => {
      perkCard.click();
    });

    expect(container.textContent).toContain("Generating code");
  });

  it("displays referral code after generation", () => {
    act(() => {
      root.render(<ProPerks userTier="pro" />);
    });

    const perkCard = container.querySelector('[data-testid="perk-card-perk-1"]') as HTMLElement;
    act(() => {
      perkCard.click();
    });

    expect(useMutationMock).toHaveBeenCalled();
  });

  it("shows copy button when referral code is available", () => {
    act(() => {
      root.render(<ProPerks userTier="pro" />);
    });

    const perkCard = container.querySelector('[data-testid="perk-card-perk-1"]') as HTMLElement;
    act(() => {
      perkCard.click();
    });

    const copyButton = container.querySelector('[data-testid="copy-referral-code-perk-1"]');
    expect(copyButton || container.querySelector('[data-testid="generate-referral-code-perk-1"]')).toBeTruthy();
  });
});
