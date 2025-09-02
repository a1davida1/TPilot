import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Menu, Smartphone, Tablet, Monitor, Eye } from "lucide-react";
export function MobileOptimization({ children }) {
    const [deviceType, setDeviceType] = useState('desktop');
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    useEffect(() => {
        const updateDeviceType = () => {
            const width = window.innerWidth;
            if (width < 768) {
                setDeviceType('mobile');
            }
            else if (width < 1024) {
                setDeviceType('tablet');
            }
            else {
                setDeviceType('desktop');
            }
        };
        updateDeviceType();
        window.addEventListener('resize', updateDeviceType);
        return () => window.removeEventListener('resize', updateDeviceType);
    }, []);
    const getDeviceIcon = () => {
        switch (deviceType) {
            case 'mobile':
                return <Smartphone className="h-4 w-4"/>;
            case 'tablet':
                return <Tablet className="h-4 w-4"/>;
            default:
                return <Monitor className="h-4 w-4"/>;
        }
    };
    return (<div className="relative">
      {/* Device Type Indicator */}
      <div className="fixed top-4 right-4 z-50 md:hidden">
        <Badge className="flex items-center space-x-1 bg-blue-100 text-blue-800">
          {getDeviceIcon()}
          <span className="capitalize">{deviceType}</span>
        </Badge>
      </div>

      {/* Mobile Navigation */}
      {deviceType === 'mobile' && (<Sheet open={isMenuOpen} onOpenChange={setIsMenuOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="sm" className="fixed top-4 left-4 z-50 md:hidden">
              <Menu className="h-4 w-4"/>
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-[300px] sm:w-[400px]">
            <SheetHeader>
              <SheetTitle>Navigation</SheetTitle>
              <SheetDescription>
                Quick access to all ThottoPilot features
              </SheetDescription>
            </SheetHeader>
            <div className="mt-6 space-y-4">
              {/* Mobile-optimized navigation content */}
              <div className="grid gap-2">
                <Button variant="ghost" className="justify-start">
                  Dashboard
                </Button>
                <Button variant="ghost" className="justify-start">
                  AI Generator
                </Button>
                <Button variant="ghost" className="justify-start">
                  Image Gallery
                </Button>
                <Button variant="ghost" className="justify-start">
                  Protection Tools
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>)}

      {/* Responsive Layout */}
      <div className={`
        ${deviceType === 'mobile' ? 'px-4 py-2' : ''}
        ${deviceType === 'tablet' ? 'px-6 py-4' : ''}
        ${deviceType === 'desktop' ? 'px-8 py-6' : ''}
      `}>
        {children}
      </div>

      {/* Mobile-specific optimization hints */}
      {deviceType === 'mobile' && (<div className="fixed bottom-4 left-4 right-4 z-40">
          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-3">
              <div className="flex items-center space-x-2">
                <Eye className="h-4 w-4 text-blue-600"/>
                <p className="text-xs text-blue-800">
                  Optimized for mobile • Tap to expand content
                </p>
              </div>
            </CardContent>
          </Card>
        </div>)}
    </div>);
}
// Hook for mobile-specific behaviors
export function useMobileOptimization() {
    const [isMobile, setIsMobile] = useState(false);
    const [isTouch, setIsTouch] = useState(false);
    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
            setIsTouch('ontouchstart' in window);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);
    return {
        isMobile,
        isTouch,
        shouldUseSimplifiedUI: isMobile || isTouch,
        recommendedButtonSize: isMobile ? 'lg' : 'default',
        recommendedSpacing: isMobile ? 'space-y-4' : 'space-y-2'
    };
}
