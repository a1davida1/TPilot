import React from "react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";
import { act } from "react";

const { toastMock, loginMock, apiRequestMock } = vi.hoisted(() => ({
  toastMock: vi.fn(),
  loginMock: vi.fn(),
  apiRequestMock: vi.fn<(...args: unknown[]) => Promise<Response>>(),
}));
const mutationConfigs: Array<Record<string, unknown>> = [];

const useMutationMock = vi.fn((options?: Record<string, unknown>) => {
  mutationConfigs.push(options ?? {});
  const mutationFn = (options as { mutationFn?: (...args: unknown[]) => Promise<unknown> })?.mutationFn;
  
  return {
    mutate: vi.fn(async (variables: unknown) => {
      if (mutationFn) {
        try {
          const result = await mutationFn(variables);
          const onSuccess = (options as { onSuccess?: (data: unknown) => void })?.onSuccess;
          if (onSuccess) {
            onSuccess(result);
          }
        } catch (error) {
          const onError = (options as { onError?: (error: unknown) => void })?.onError;
          if (onError) {
            onError(error);
          }
        }
      }
    }),
    mutateAsync: vi.fn(async (variables: unknown) => {
      if (mutationFn) {
        return await mutationFn(variables);
      }
    }),
    reset: vi.fn(),
    data: undefined,
    error: undefined,
    isPending: false,
    isSuccess: false,
    status: "idle",
  };
});

vi.mock("@tanstack/react-query", () => ({
  useMutation: (options?: Record<string, unknown>) => useMutationMock(options),
}));

// Button component is not mocked - using actual component to ensure onClick works

vi.mock("@/components/ui/input", () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({ children, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) => (
    <label {...props}>{children}</label>
  ),
}));

vi.mock("@/components/ui/separator", () => ({
  Separator: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div {...props}>{children}</div>
  ),
}));

vi.mock("@/components/ui/alert", () => ({
  Alert: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div role="alert" {...props}>{children}</div>
  ),
  AlertDescription: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div {...props}>{children}</div>
  ),
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ login: loginMock }),
}));

vi.mock("react-icons/fa", () => ({
  FaGoogle: () => <span />,
  FaFacebook: () => <span />,
  FaReddit: () => <span />,
}));

vi.mock("lucide-react", () => ({
  Mail: () => <span />,
  Lock: () => <span />,
  User: () => <span />,
  ArrowRight: () => <span />,
  Sparkles: () => <span />,
  CheckCircle: () => <span />,
  AlertCircle: () => <span />,
}));

vi.doMock("@/lib/queryClient", () => ({
  apiRequest: apiRequestMock,
  queryClient: {
    invalidateQueries: vi.fn(),
    setQueryData: vi.fn(),
  },
}));

import type { ApiError } from "@/lib/queryClient";
import { AuthModal } from "../auth-modal";

describe("AuthModal resend verification", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mutationConfigs.length = 0;
    toastMock.mockClear();
    loginMock.mockClear();
    apiRequestMock.mockReset();
    useMutationMock.mockReset();
    useMutationMock.mockImplementation((options?: Record<string, unknown>) => {
      mutationConfigs.push(options ?? {});
      const mutationFn = (options as { mutationFn?: (...args: unknown[]) => Promise<unknown> })?.mutationFn;
      
      return {
        mutate: vi.fn(async (variables: unknown) => {
          if (mutationFn) {
            try {
              const result = await mutationFn(variables);
              const onSuccess = (options as { onSuccess?: (data: unknown) => void })?.onSuccess;
              if (onSuccess) {
                onSuccess(result);
              }
            } catch (error) {
              const onError = (options as { onError?: (error: unknown) => void })?.onError;
              if (onError) {
                onError(error);
              }
            }
          }
        }),
        mutateAsync: vi.fn(async (variables: unknown) => {
          if (mutationFn) {
            return await mutationFn(variables);
          }
        }),
        reset: vi.fn(),
        data: undefined,
        error: undefined,
        isPending: false,
        isSuccess: false,
        status: "idle",
      };
    });

    apiRequestMock.mockResolvedValue(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
    vi.clearAllMocks();
  });

  it("shows the resend alert and wires the resend action when login fails with EMAIL_NOT_VERIFIED", async () => {
    await act(async () => {
      root.render(
        <AuthModal
          isOpen
          onClose={() => {}}
          onSuccess={() => {}}
          initialMode="login"
        />
      );
    });

    const authMutationOptions = mutationConfigs[0];
    expect(authMutationOptions).toBeDefined();
    const onError = authMutationOptions?.onError as ((error: ApiError) => Promise<void>) | undefined;
    expect(typeof onError).toBe("function");

    const apiError = new Error("Please verify your email") as ApiError;
    apiError.code = "EMAIL_NOT_VERIFIED";
    apiError.email = "user@example.com";

    await act(async () => {
      await onError?.(apiError);
    });

    const resendButton = container.querySelector(
      '[data-testid="button-resend-verification"]'
    ) as HTMLButtonElement | null;

    expect(resendButton).not.toBeNull();

    await act(async () => {
      resendButton?.click();
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    expect(apiRequestMock).toHaveBeenCalledWith(
      "POST",
      "/api/auth/resend-verification",
      { email: "user@example.com" }
    );

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Email not verified" })
    );
  });
});
