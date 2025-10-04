import React, { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";

let authState: {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: {
    id: number;
    username?: string;
    tier?: string;
    isAdmin?: boolean;
    role?: string;
  } | null;
};

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => authState,
}));

vi.mock("@/components/auth-modal", () => ({
  AuthModal: () => null,
}));

vi.mock("@/components/thottopilot-logo", () => ({
  ThottoPilotLogo: () => <div data-testid="logo" />,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock("@/components/ui/dropdown-menu", () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DropdownMenuSeparator: () => <div />,
}));

vi.mock("lucide-react", () => ({
  User: () => <span />,
  LogOut: () => <span />,
  Settings: () => <span />,
  History: () => <span />,
  BarChart3: () => <span />,
  Sparkles: () => <span />,
  Menu: () => <span />,
  X: () => <span />,
  Crown: () => <span />,
}));

vi.mock("wouter", () => ({
  Link: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
  useLocation: () => ["/dashboard", vi.fn()],
}));

import { Header } from "../header";

describe("Header navigation access control", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    authState = {
      isAuthenticated: true,
      isLoading: false,
      user: {
        id: 42,
        username: "admin",
        tier: "free",
        isAdmin: false,
      },
    };
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("does not render admin navigation for non-admin users", () => {
    act(() => {
      root.render(<Header />);
    });

    const adminLink = container.querySelector('[data-testid="nav-admin-portal"]');

    expect(adminLink).toBeNull();
  });
});
