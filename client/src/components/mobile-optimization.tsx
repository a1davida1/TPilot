import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from "react";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "@/components/ui/sheet";
import {
  Menu,
  Smartphone,
  Tablet,
  Monitor,
  Eye,
  ChevronRight
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type DeviceType = "mobile" | "tablet" | "desktop";

type BadgeVariant = React.ComponentProps<typeof Badge>["variant"];

export interface MobileNavigationItem {
  href: string;
  label: string;
  description?: string;
  icon?: LucideIcon;
  badge?: {
    text: string;
    variant?: BadgeVariant;
  };
}

interface MobileOptimizationProps {
  children: React.ReactNode;
  navigationItems: MobileNavigationItem[];
}

interface MobileOptimizationContextValue {
  deviceType: DeviceType;
  isMobile: boolean;
  isTouch: boolean;
  shouldUseSimplifiedUI: boolean;
  recommendedButtonSize: "lg" | "default";
  recommendedSpacing: string;
  isNavigationOpen: boolean;
  openNavigation: () => void;
  closeNavigation: () => void;
  toggleNavigation: () => void;
}

const MobileOptimizationContext =
  createContext<MobileOptimizationContextValue | null>(null);

const defaultContextValue: MobileOptimizationContextValue = {
  deviceType: "desktop",
  isMobile: false,
  isTouch: false,
  shouldUseSimplifiedUI: false,
  recommendedButtonSize: "default",
  recommendedSpacing: "space-y-2",
  isNavigationOpen: false,
  openNavigation: () => undefined,
  closeNavigation: () => undefined,
  toggleNavigation: () => undefined
};

function detectDeviceType(width: number): DeviceType {
  if (width < 768) {
    return "mobile";
  }
  if (width < 1024) {
    return "tablet";
  }
  return "desktop";
}

function detectIsTouch(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  return "ontouchstart" in window || navigator.maxTouchPoints > 0;
}

function readDeviceSnapshot(): { deviceType: DeviceType; isTouch: boolean } {
  if (typeof window === "undefined") {
    return { deviceType: "desktop", isTouch: false };
  }
  return {
    deviceType: detectDeviceType(window.innerWidth),
    isTouch: detectIsTouch()
  };
}

export function MobileOptimization({
  children,
  navigationItems
}: MobileOptimizationProps) {
  const [{ deviceType, isTouch }, setDeviceState] = useState(readDeviceSnapshot);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [location, setLocation] = useLocation();

  useEffect(() => {
    const updateDeviceState = () => {
      setDeviceState(readDeviceSnapshot());
    };

    updateDeviceState();
    window.addEventListener("resize", updateDeviceState);
    return () => window.removeEventListener("resize", updateDeviceState);
  }, []);

  const isMobile = deviceType === "mobile";
  const recommendedButtonSize = isMobile ? "lg" : "default";
  const recommendedSpacing = isMobile ? "space-y-4" : "space-y-2";

  const openNavigation = useCallback(() => setIsMenuOpen(true), []);
  const closeNavigation = useCallback(() => setIsMenuOpen(false), []);
  const toggleNavigation = useCallback(
    () => setIsMenuOpen((current) => !current),
    []
  );

  useEffect(() => {
    if (!isMobile && isMenuOpen) {
      setIsMenuOpen(false);
    }
  }, [isMenuOpen, isMobile]);

  const contextValue = useMemo<MobileOptimizationContextValue>(
    () => ({
      deviceType,
      isMobile,
      isTouch,
      shouldUseSimplifiedUI: isMobile || isTouch,
      recommendedButtonSize,
      recommendedSpacing,
      isNavigationOpen: isMenuOpen,
      openNavigation,
      closeNavigation,
      toggleNavigation
    }),
    [
      deviceType,
      isMobile,
      isTouch,
      recommendedButtonSize,
      recommendedSpacing,
      isMenuOpen,
      openNavigation,
      closeNavigation,
      toggleNavigation
    ]
  );

  const getDeviceIcon = () => {
    switch (deviceType) {
      case "mobile":
        return <Smartphone className="h-4 w-4" />;
      case "tablet":
        return <Tablet className="h-4 w-4" />;
      default:
        return <Monitor className="h-4 w-4" />;
    }
  };

  const menuButtonSize = isMobile ? "lg" : "sm";

  return (
    <MobileOptimizationContext.Provider value={contextValue}>
      <div className="relative">
        <div className="fixed top-4 right-4 z-50 md:hidden">
          <Badge
            className={cn(
              "flex items-center gap-2 bg-blue-100 text-blue-800",
              isMobile ? "px-4 py-1.5 text-sm" : "px-3 py-1 text-xs"
            )}
          >
            {getDeviceIcon()}
            <span className="capitalize">{deviceType}</span>
          </Badge>
        </div>

        {isMobile && (
          <Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
            <SheetTrigger asChild>
              <Button
                variant="outline"
                size={menuButtonSize}
                className="fixed top-4 left-4 z-50 md:hidden flex items-center gap-2"
              >
                <Menu className="h-5 w-5" />
                <span className="text-sm font-semibold">Menu</span>
              </Button>
            </SheetTrigger>
            <SheetContent
              side="left"
              className="flex w-[300px] flex-col sm:w-[360px]"
            >
              <SheetHeader>
                <SheetTitle>Navigation</SheetTitle>
                <SheetDescription>
                  Quick access to all ThottoPilot features
                </SheetDescription>
              </SheetHeader>
              <div className={cn("mt-6 flex flex-col", recommendedSpacing)}>
                {navigationItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = location === item.href;
                  return (
                    <Button
                      key={item.href}
                      variant={isActive ? "default" : "ghost"}
                      size={recommendedButtonSize}
                      className={cn(
                        "justify-between rounded-xl text-left",
                        isMobile ? "px-4 py-4" : "px-3 py-2"
                      )}
                      onClick={() => {
                        setLocation(item.href);
                        closeNavigation();
                      }}
                    >
                      <span className="flex flex-col gap-1 text-left">
                        <span className="flex items-center gap-2">
                          {Icon ? <Icon className="h-5 w-5" /> : null}
                          <span className="font-semibold">{item.label}</span>
                        </span>
                        {item.description ? (
                          <span className="text-xs text-muted-foreground">
                            {item.description}
                          </span>
                        ) : null}
                      </span>
                      <span className="flex items-center gap-2">
                        {item.badge ? (
                          <Badge
                            variant={item.badge.variant ?? "secondary"}
                            className={cn(
                              "uppercase tracking-wide",
                              isMobile
                                ? "px-3 py-1 text-xs"
                                : "px-2 py-0.5 text-[10px]"
                            )}
                          >
                            {item.badge.text}
                          </Badge>
                        ) : null}
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </span>
                    </Button>
                  );
                })}
              </div>
            </SheetContent>
          </Sheet>
        )}

        <div
          className={cn(
            {
              "px-4 py-2": deviceType === "mobile",
              "px-6 py-4": deviceType === "tablet",
              "px-8 py-6": deviceType === "desktop"
            }
          )}
        >
          {children}
        </div>

        {isMobile && (
          <div className="fixed bottom-4 left-4 right-4 z-40">
            <Card className="border-blue-200 bg-blue-50">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-blue-600" />
                  <p className="text-sm text-blue-800">
                    Optimized for mobile • Tap cards to expand content
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </MobileOptimizationContext.Provider>
  );
}

export function useMobileOptimization(): MobileOptimizationContextValue {
  const context = useContext(MobileOptimizationContext);
  const [fallbackState, setFallbackState] = useState(readDeviceSnapshot);

  useEffect(() => {
    if (context) {
      return;
    }

    const handleResize = () => {
      setFallbackState(readDeviceSnapshot());
    };

    if (typeof window !== "undefined") {
      window.addEventListener("resize", handleResize);
      handleResize();
    }

    return () => {
      if (typeof window !== "undefined") {
        window.removeEventListener("resize", handleResize);
      }
    };
  }, [context]);

  if (context) {
    return context;
  }

  const isMobile = fallbackState.deviceType === "mobile";
  const isTouch = fallbackState.isTouch;

  return {
    deviceType: fallbackState.deviceType,
    isMobile,
    isTouch,
    shouldUseSimplifiedUI: isMobile || isTouch,
    recommendedButtonSize: isMobile ? "lg" : "default",
    recommendedSpacing: isMobile ? "space-y-4" : "space-y-2",
    isNavigationOpen: false,
    openNavigation: defaultContextValue.openNavigation,
    closeNavigation: defaultContextValue.closeNavigation,
    toggleNavigation: defaultContextValue.toggleNavigation
  };
}
