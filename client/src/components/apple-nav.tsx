import React, { useState } from 'react';
import { useTheme } from '@/components/theme-provider';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { 
  Home, 
  Calendar, 
  BarChart3, 
  Settings,
  Shield,
  Sparkles,
  User,
  LogOut,
  MessageSquare,
  ChevronDown,
  Zap,
  Gift,
  Share2
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link, useLocation } from 'wouter';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface NavItem {
  label: string;
  href?: string;
  icon: React.ElementType;
  submenu?: Array<{ label: string; href: string; icon: React.ElementType }>;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: Home },
  { 
    label: 'Reddit', 
    icon: MessageSquare,
    submenu: [
      { label: 'Quick Post', href: '/quick-post', icon: Zap },
      { label: 'Posting Hub', href: '/reddit', icon: Share2 },
      { label: 'Communities', href: '/reddit/communities', icon: MessageSquare },
    ]
  },
  { label: 'Schedule', href: '/post-scheduling', icon: Calendar },
  { label: 'Analytics', href: '/analytics', icon: BarChart3 },
  { label: 'AI Studio', href: '/generate', icon: Sparkles },
  { label: 'Pro Perks', href: '/pro-perks', icon: Gift },
  { label: 'Shield', href: '/imageshield', icon: Shield },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export function AppleNav() {
  const [location] = useLocation();
  const { resolvedTheme: _resolvedTheme } = useTheme();
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center">
        {/* Logo */}
        <div className="mr-8 flex">
          <Link to="/" className="flex items-center space-x-2">
            <div className="relative">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 shadow-lg" />
              <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-blue-400 to-purple-500 blur opacity-50" />
            </div>
            <span className="hidden font-bold text-xl tracking-tight sm:inline-block">
              ThottoPilot
            </span>
          </Link>
        </div>

        {/* Navigation Items */}
        <div className="flex flex-1 items-center space-x-4 lg:space-x-6">
          <div className="hidden md:flex items-center space-x-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              
              // Handle items with submenu
              if (item.submenu) {
                const isActive = item.submenu.some(sub => location === sub.href);
                
                return (
                  <DropdownMenu 
                    key={item.label}
                    open={openDropdown === item.label}
                    onOpenChange={(open) => setOpenDropdown(open ? item.label : null)}
                  >
                    <DropdownMenuTrigger asChild>
                      <button
                        className={cn(
                          "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-all hover:bg-accent/50",
                          isActive
                            ? "bg-accent text-accent-foreground"
                            : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <Icon className="h-4 w-4" />
                        <span>{item.label}</span>
                        <ChevronDown className="h-3 w-3 opacity-50" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-48">
                      {item.submenu.map((subItem) => {
                        const SubIcon = subItem.icon;
                        const isSubActive = location === subItem.href;
                        
                        return (
                          <DropdownMenuItem key={subItem.href} asChild>
                            <Link
                              to={subItem.href}
                              className={cn(
                                "flex items-center gap-2 w-full cursor-pointer",
                                isSubActive && "bg-accent text-accent-foreground"
                              )}
                            >
                              <SubIcon className="h-4 w-4" />
                              {subItem.label}
                            </Link>
                          </DropdownMenuItem>
                        );
                      })}
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              }
              
              // Handle regular items
              if (!item.href) return null;
              
              const isActive = location === item.href;
              
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition-all hover:bg-accent/50",
                    isActive
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Right Side Actions */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
          
          {/* User Menu */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="relative h-8 w-8 rounded-full"
            >
              <User className="h-4 w-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="sm"
              className="hidden sm:flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              <span>Sign Out</span>
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
}
