import React from 'react';
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
  LogOut
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link, useLocation } from 'react-router-dom';

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: Home },
  { label: 'Schedule', href: '/post-scheduling', icon: Calendar },
  { label: 'Analytics', href: '/analytics', icon: BarChart3 },
  { label: 'AI Studio', href: '/generate', icon: Sparkles },
  { label: 'Shield', href: '/image-shield', icon: Shield },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export function AppleNav() {
  const location = useLocation();
  const { resolvedTheme } = useTheme();

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
              const isActive = location.pathname === item.href;
              const Icon = item.icon;
              
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
