import { useState, useEffect, useCallback, ReactNode } from 'react';
import { useLocation } from 'wouter';
import {
  Menu,
  X,
  Plus,
  type LucideIcon,
} from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getMobileNavigation, type NavigationItem } from '@/config/navigation';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';

// Mobile Navigation Item Type
interface MobileNavigationItem {
  href: string;
  label: string;
  description?: string;
  icon: LucideIcon;
  badge?: {
    text: string;
    variant?: 'default' | 'success' | 'warning' | 'error' | 'pro';
  };
}

// Device Detection Hook
export function useDeviceDetection() {
  const [deviceType, setDeviceType] = useState<'mobile' | 'tablet' | 'desktop'>('desktop');
  const [screenSize, setScreenSize] = useState({ width: 0, height: 0 });
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [isTouchDevice, setIsTouchDevice] = useState(false);

  useEffect(() => {
    const updateDeviceInfo = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      // Update device type
      if (width < 640) {
        setDeviceType('mobile');
      } else if (width < 1024) {
        setDeviceType('tablet');
      } else {
        setDeviceType('desktop');
      }
      
      // Update screen size
      setScreenSize({ width, height });
      
      // Update orientation
      setOrientation(width > height ? 'landscape' : 'portrait');
      
      // Check for touch device
      setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0);
    };

    updateDeviceInfo();
    window.addEventListener('resize', updateDeviceInfo);
    window.addEventListener('orientationchange', updateDeviceInfo);
    
    return () => {
      window.removeEventListener('resize', updateDeviceInfo);
      window.removeEventListener('orientationchange', updateDeviceInfo);
    };
  }, []);

  return { deviceType, screenSize, orientation, isTouchDevice };
}

// Responsive sizing utilities
export function useResponsiveSizes() {
  const { deviceType } = useDeviceDetection();
  
  const buttonSize = deviceType === 'mobile' ? 'default' : 'sm';
  const iconSize = deviceType === 'mobile' ? 'h-5 w-5' : 'h-4 w-4';
  const paddingSize = deviceType === 'mobile' ? 'p-4' : 'p-2';
  const textSize = deviceType === 'mobile' ? 'text-base' : 'text-sm';
  
  return { buttonSize, iconSize, paddingSize, textSize };
}

// Bottom Navigation Bar Component
interface BottomNavBarProps {
  items: MobileNavigationItem[];
  currentPath: string;
  onNavigate: (path: string) => void;
}

function BottomNavBar({ items, currentPath, onNavigate }: BottomNavBarProps) {
  // Show only top 5 items in bottom nav
  const navItems = items.slice(0, 5);
  
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 lg:hidden">
      <div className="flex items-center justify-around py-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPath === item.href || currentPath.startsWith(`${item.href}/`);
          
          return (
            <button
              key={item.href}
              onClick={() => onNavigate(item.href)}
              className={cn(
                'flex flex-col items-center gap-1 p-2 min-w-0 flex-1',
                'transition-colors',
                isActive
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs truncate max-w-full">{item.label}</span>
              {item.badge && (
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-destructive"></span>
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Floating Menu Button Component
interface FloatingMenuButtonProps {
  onClick: () => void;
  isOpen: boolean;
}

function FloatingMenuButton({ onClick, isOpen }: FloatingMenuButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'fixed top-4 left-4 z-50',
        'h-10 w-10 rounded-full',
        'bg-primary text-primary-foreground',
        'shadow-lg',
        'flex items-center justify-center',
        'transition-all duration-200',
        'hover:scale-110',
        'lg:hidden'
      )}
    >
      {isOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
    </button>
  );
}

// Mobile Sidebar Sheet
interface MobileSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  navigationItems: MobileNavigationItem[];
  currentPath: string;
  onNavigate: (path: string) => void;
  userTier?: string;
}

function MobileSidebar({
  open,
  onOpenChange,
  navigationItems,
  currentPath,
  onNavigate,
  userTier,
}: MobileSidebarProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-80 p-0">
        <SheetHeader className="p-4 border-b">
          <SheetTitle>Navigation</SheetTitle>
          <SheetDescription>
            Access all features and settings
          </SheetDescription>
        </SheetHeader>
        
        <ScrollArea className="h-[calc(100vh-100px)]">
          <div className="p-4 space-y-1">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentPath === item.href || currentPath.startsWith(`${item.href}/`);
              
              return (
                <button
                  key={item.href}
                  onClick={() => {
                    onNavigate(item.href);
                    onOpenChange(false);
                  }}
                  className={cn(
                    'w-full flex items-center gap-3 px-3 py-2 rounded-lg',
                    'transition-colors',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'hover:bg-accent hover:text-accent-foreground'
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <div className="flex-1 text-left">
                    <div className="font-medium">{item.label}</div>
                    {item.description && (
                      <div className="text-xs text-muted-foreground">
                        {item.description}
                      </div>
                    )}
                  </div>
                  {item.badge && (
                    <Badge variant={item.badge.variant as any}>
                      {item.badge.text}
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>
        </ScrollArea>
        
        {/* User Tier Indicator */}
        {userTier && (
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t bg-background">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Current Plan</span>
              <Badge variant={userTier === 'pro' ? 'default' : 'outline'}>
                {userTier.toUpperCase()}
              </Badge>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// Quick Action Button for Mobile
interface MobileQuickActionProps {
  onClick: () => void;
}

function MobileQuickAction({ onClick }: MobileQuickActionProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'fixed bottom-20 right-4 z-40',
        'h-14 w-14 rounded-full',
        'bg-gradient-to-r from-purple-600 to-pink-600',
        'shadow-lg shadow-purple-600/30',
        'flex items-center justify-center',
        'transition-all duration-200',
        'hover:scale-110',
        'lg:hidden'
      )}
    >
      <Plus className="h-6 w-6 text-white" />
    </button>
  );
}

// Main Mobile Optimization Component
interface MobileOptimizationProps {
  children: ReactNode;
  navigationItems?: NavigationItem[];
  showBottomNav?: boolean;
  showFloatingMenu?: boolean;
  showQuickAction?: boolean;
  onQuickAction?: () => void;
  className?: string;
}

export function MobileOptimization({
  children,
  navigationItems,
  showBottomNav = true,
  showFloatingMenu = true,
  showQuickAction = true,
  onQuickAction,
  className,
}: MobileOptimizationProps) {
  const [currentPath, setLocation] = useLocation();
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { deviceType, isTouchDevice } = useDeviceDetection();
  
  // Get mobile-optimized navigation items
  const mobileNavItems = navigationItems ? 
    getMobileNavigation(navigationItems).map(item => ({
      ...item,
      icon: item.icon as LucideIcon,
    } as MobileNavigationItem)) : [];
  
  const handleNavigate = useCallback((path: string) => {
    setLocation(path);
    setSidebarOpen(false);
  }, [setLocation]);
  
  const handleQuickAction = useCallback(() => {
    if (onQuickAction) {
      onQuickAction();
    } else {
      // Default to quick post
      handleNavigate('/quick-post');
    }
  }, [onQuickAction, handleNavigate]);
  
  // Add mobile-specific styles
  const isMobile = deviceType === 'mobile';
  const isTablet = deviceType === 'tablet';
  
  return (
    <div 
      className={cn(
        'relative min-h-screen',
        isMobile && showBottomNav && 'pb-16', // Add padding for bottom nav
        className
      )}
    >
      {/* Main Content */}
      <div
        className={cn(
          'w-full',
          isMobile && 'overflow-x-hidden', // Prevent horizontal scroll on mobile
        )}
      >
        {children}
      </div>
      
      {/* Mobile-Only Components */}
      {(isMobile || isTablet) && (
        <>
          {/* Floating Menu Button */}
          {showFloatingMenu && (
            <FloatingMenuButton
              onClick={() => setSidebarOpen(!sidebarOpen)}
              isOpen={sidebarOpen}
            />
          )}
          
          {/* Mobile Sidebar */}
          <MobileSidebar
            open={sidebarOpen}
            onOpenChange={setSidebarOpen}
            navigationItems={mobileNavItems}
            currentPath={currentPath}
            onNavigate={handleNavigate}
            userTier={user?.tier}
          />
          
          {/* Bottom Navigation Bar (Mobile Only) */}
          {isMobile && showBottomNav && (
            <BottomNavBar
              items={mobileNavItems}
              currentPath={currentPath}
              onNavigate={handleNavigate}
            />
          )}
          
          {/* Quick Action Button */}
          {showQuickAction && (
            <MobileQuickAction onClick={handleQuickAction} />
          )}
        </>
      )}
      
      {/* Touch Indicator (Development Only) */}
      {process.env.NODE_ENV === 'development' && isTouchDevice && (
        <div className="fixed top-4 right-4 z-50">
          <Badge variant="outline" className="text-xs">
            Touch: {deviceType}
          </Badge>
        </div>
      )}
    </div>
  );
}

// Export additional utilities
export { type MobileNavigationItem };
export default MobileOptimization;
