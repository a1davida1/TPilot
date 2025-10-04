import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act } from "react-dom/test-utils";
import { createRoot } from "react-dom/client";
import type { Root } from "react-dom/client";

const toastMock = vi.fn();

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: React.HTMLAttributes<HTMLHeadingElement>) => <h2 {...props}>{children}</h2>,
  CardDescription: ({ children, ...props }: React.HTMLAttributes<HTMLParagraphElement>) => <p {...props}>{children}</p>,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, onClick, ...props }: React.PropsWithChildren<{ onClick?: () => void } & React.ButtonHTMLAttributes<HTMLButtonElement>>) => (
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
    <input type="checkbox" checked={checked} onChange={(e) => onCheckedChange(e.target.checked)} />
  ),
}));

vi.mock("@/components/ui/slider", () => ({
  Slider: ({ value, onValueChange }: { value: number[]; onValueChange: (value: number[]) => void }) => (
    <input
      type="range"
      value={value[0]}
      onChange={(e) => onValueChange([parseFloat(e.target.value)])}
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
  TabsContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
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

import { ImageProtector } from "../image-protector";

describe("ImageProtector", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    toastMock.mockReset();
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
      root.render(<ImageProtector userTier="free" />);
    });

    expect(container.textContent).toContain("ImageShield");
  });

  it("shows comparison toggle button when both images exist", () => {
    act(() => {
      root.render(<ImageProtector userTier="pro" />);
    });

    const toggleButton = container.querySelector('[data-testid="button-toggle-comparison"]');
    expect(toggleButton).toBeNull();
  });

  it("renders tier-specific badges correctly", () => {
    act(() => {
      root.render(<ImageProtector userTier="free" />);
    });

    expect(container.textContent).toContain("Free Tier");

    act(() => {
      root.unmount();
    });

    const root2 = createRoot(container);
    act(() => {
      root2.render(<ImageProtector userTier="pro" />);
    });

    expect(container.textContent).toContain("Pro Tier");

    act(() => {
      root2.unmount();
    });
  });
});
