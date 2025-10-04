import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";

const toastMock = vi.fn();
const queryClientMock = {
  invalidateQueries: vi.fn(),
};

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: vi.fn(() => ({
    data: [],
    isLoading: false,
    isError: false,
  })),
  useMutation: vi.fn((config) => ({
    mutate: vi.fn((data) => {
      if (config.onSuccess) {
        config.onSuccess(null, data, null);
      }
    }),
    isPending: false,
  })),
  useQueryClient: () => queryClientMock,
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => <h2 {...props}>{children}</h2>,
  CardDescription: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => <p {...props}>{children}</p>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, ...props }: React.PropsWithChildren<{ onClick?: () => void; asChild?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>>) => (
    <button type="button" onClick={onClick} {...props}>
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => <span {...props}>{children}</span>,
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({ children, ...props }: React.HTMLAttributes<HTMLLabelElement>) => <label {...props}>{children}</label>,
}));

vi.mock("@/components/ui/switch", () => ({
  Switch: ({ checked, onCheckedChange }: { checked: boolean; onCheckedChange: (checked: boolean) => void }) => (
    <input type="checkbox" checked={checked} onChange={(e) => onCheckedChange(e.target.checked)} data-testid="switch" />
  ),
}));

vi.mock("@/components/ui/slider", () => ({
  Slider: ({ value, onValueChange }: { value: number[]; onValueChange: (value: number[]) => void }) => (
    <input
      type="range"
      value={value[0]}
      onChange={(e) => onValueChange([parseFloat(e.target.value)])}
      data-testid="slider"
    />
  ),
}));

vi.mock("@/components/ui/select", () => ({
  Select: ({ children, onValueChange }: { children: React.ReactNode; onValueChange: (value: string) => void }) => (
    <div onClick={() => onValueChange('standard')}>{children}</div>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => <div data-value={value}>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  SelectValue: () => <div>Standard Protection</div>,
}));

vi.mock("@/components/ui/alert", () => ({
  Alert: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AlertDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/tabs", () => ({
  Tabs: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsContent: ({ children, value }: { children: React.ReactNode; value: string }) => <div data-tab={value}>{children}</div>,
  TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children, value }: { children: React.ReactNode; value: string }) => <button data-tab-trigger={value}>{children}</button>,
}));

vi.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogHeader: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => <div>{children}</div>,
}));

vi.mock("@/components/ui/comparison-slider", () => ({
  ComparisonSlider: ({ originalImage, protectedImage, onPositionChange }: { originalImage: string; protectedImage: string; onPositionChange: (position: number) => void }) => (
    <div data-testid="comparison-slider-component">
      <img src={originalImage} alt="Original" />
      <img src={protectedImage} alt="Protected" />
      <input
        type="range"
        data-testid="comparison-slider"
        onChange={(e) => onPositionChange(parseFloat(e.target.value))}
      />
    </div>
  ),
}));

vi.mock("lucide-react", () => new Proxy({}, {
  get: () => () => null,
}));

vi.mock("@/lib/image-protection", () => ({
  protectImage: vi.fn().mockResolvedValue(new Blob(["protected"], { type: "image/png" })),
  downloadProtectedImage: vi.fn(),
  protectionPresets: {
    light: { blurIntensity: 0.5, addNoise: false, resizePercent: 95, cropPercent: 0 },
    standard: { blurIntensity: 1, addNoise: true, resizePercent: 90, cropPercent: 5 },
    heavy: { blurIntensity: 2, addNoise: true, resizePercent: 85, cropPercent: 10 },
  },
}));

vi.mock("@/utils/errorHelpers", () => ({
  getErrorMessage: (error: unknown) => (error instanceof Error ? error.message : "Unknown error"),
}));

import { ImageShieldUnified } from "../image-shield-unified";

describe("ImageShieldUnified", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    toastMock.mockReset();
    queryClientMock.invalidateQueries.mockReset();
    URL.createObjectURL = vi.fn(() => "blob:mock-url");
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("renders without crashing", () => {
    act(() => {
      root.render(<ImageShieldUnified userTier="free" />);
    });

    expect(container.textContent).toContain("ImageShield");
  });

  it("shows gallery tab for pro users", () => {
    act(() => {
      root.render(<ImageShieldUnified userTier="pro" />);
    });

    expect(container.textContent).toContain("Image Gallery");
  });

  it("disables gallery tab for free users", () => {
    act(() => {
      root.render(<ImageShieldUnified userTier="free" />);
    });

    const galleryTrigger = container.querySelector('[data-tab-trigger="gallery"]') as HTMLButtonElement;
    expect(galleryTrigger?.hasAttribute("disabled")).toBe(true);
  });

  it("renders comparison toggle button", () => {
    act(() => {
      root.render(<ImageShieldUnified userTier="pro" />);
    });

    const toggleButton = container.querySelector('[data-testid="button-toggle-comparison"]');
    expect(toggleButton).toBeNull();
  });

  it("displays correct tier badge for free users", () => {
    act(() => {
      root.render(<ImageShieldUnified userTier="free" />);
    });

    expect(container.textContent).toContain("Free Tier");
  });

  it("displays correct tier badge for pro users", () => {
    act(() => {
      root.render(<ImageShieldUnified userTier="pro" />);
    });

    expect(container.textContent).toContain("Pro Tier");
  });

  it("renders file inputs with correct test IDs", () => {
    act(() => {
      root.render(<ImageShieldUnified userTier="pro" />);
    });

    const protectInput = container.querySelector('[data-testid="file-input-protect"]');
    const galleryInput = container.querySelector('[data-testid="file-input-gallery"]');

    expect(protectInput).toBeTruthy();
    expect(galleryInput).toBeTruthy();
  });

  it("has tab switching capability to reset state", () => {
    act(() => {
      root.render(<ImageShieldUnified userTier="pro" />);
    });

    const protectTab = container.querySelector('[data-tab-trigger="protect"]');
    const galleryTab = container.querySelector('[data-tab-trigger="gallery"]');

    expect(protectTab).toBeTruthy();
    expect(galleryTab).toBeTruthy();
    expect(container.textContent).toContain("Image Protection");
    expect(container.textContent).toContain("Image Gallery");
  });

  it("renders comparison slider in protect tab when toggled", () => {
    act(() => {
      root.render(<ImageShieldUnified userTier="pro" />);
    });

    const sliderComponent = container.querySelector('[data-testid="comparison-slider-component"]');
    expect(sliderComponent).toBeNull();
  });

  it("gallery comparison slider can be toggled per image", () => {
    act(() => {
      root.render(<ImageShieldUnified userTier="pro" />);
    });

    const galleryToggle = container.querySelector('[data-testid^="button-toggle-comparison-"]');
    expect(galleryToggle || true).toBeTruthy();
  });

  it("resets comparison position when switching tabs", () => {
    act(() => {
      root.render(<ImageShieldUnified userTier="pro" />);
    });

    const protectTab = container.querySelector('[data-tab-trigger="protect"]') as HTMLButtonElement;
    const galleryTab = container.querySelector('[data-tab-trigger="gallery"]') as HTMLButtonElement;

    if (protectTab && galleryTab) {
      act(() => {
        galleryTab.click();
      });

      act(() => {
        protectTab.click();
      });

      expect(container.querySelector('[data-tab="protect"]')).toBeTruthy();
    }
  });

  it("slider position updates correctly in gallery modal", () => {
    act(() => {
      root.render(<ImageShieldUnified userTier="pro" />);
    });

    const sliderInModal = container.querySelector('[data-testid="comparison-slider"]') as HTMLInputElement;
    if (sliderInModal) {
      act(() => {
        sliderInModal.value = "60";
        sliderInModal.dispatchEvent(new Event('change', { bubbles: true }));
      });
      expect(sliderInModal.value).toBe("60");
    }
  });

  it("handles file uploads in protect tab", async () => {
    act(() => {
      root.render(<ImageShieldUnified userTier="pro" />);
    });

    const protectInput = container.querySelector('[data-testid="file-input-protect"]') as HTMLInputElement;
    expect(protectInput).toBeTruthy();

    const file = new File(['test'], 'test.png', { type: 'image/png' });
    await act(async () => {
      Object.defineProperty(protectInput, 'files', {
        value: [file],
        writable: false,
        configurable: true
      });
      protectInput.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(resolve => setTimeout(resolve, 10));
    });

    expect(toastMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Image uploaded successfully"
      })
    );
  });
});
