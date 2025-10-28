import React, { useState } from 'react';
import { 
  Bell, 
  Search, 
  Settings, 
  LogOut, 
  User,
  Sparkles,
  Plus,
  Send,
  ChevronDown
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from 'wouter';
import { CommandPalette } from './ui/command-palette';
import { StatusBanner } from './ui/status-banner';
import { ErrorBoundary } from './ui/error-boundary';

export function HeaderEnhanced() {
  const { user, logout } = useAuth();
  const [, setLocation] = useLocation();
  const [commandOpen, setCommandOpen] = useState(false);
  const [notificationCount] = useState(3); // This should come from API

  // Handle logout with error handling
  const handleLogout = async () => {
    try {
      await logout();
      setLocation('/login');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  return (
    <ErrorBoundary>
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center px-4">
          {/* Logo/Brand */}
          <div className="mr-4 flex items-center space-x-2">
            <Sparkles className="h-6 w-6 text-primary" />
            <span className="hidden font-bold sm:inline-block">TPilot</span>
          </div>

          {/* Search Button with Keyboard Shortcut */}
          <Button
            variant="outline"
            size="sm"
            className="mr-4 h-9 w-9 p-0 sm:w-auto sm:px-3"
            onClick={() => setCommandOpen(true)}
            aria-label="Open command palette"
            aria-keyshortcuts="Meta+K"
          >
            <Search className="h-4 w-4 sm:mr-2" aria-hidden="true" />
            <span className="hidden sm:inline-block">Search</span>
            <kbd className="pointer-events-none ml-2 hidden h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-100 sm:flex">
              <span className="text-xs">⌘</span>K
            </kbd>
          </Button>

          {/* AI Status Indicator */}
          <div className="mr-4 hidden items-center space-x-2 rounded-lg bg-secondary/50 px-3 py-1.5 md:flex">
            <div className="relative">
              <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
              <div className="absolute inset-0 h-2 w-2 animate-ping rounded-full bg-green-500 opacity-75" />
            </div>
            <span className="text-xs font-medium">AI Status</span>
            <Badge variant="secondary" className="ml-1 px-1.5 py-0 text-xs">
              Active
            </Badge>
            <span className="text-xs text-muted-foreground">3 models available</span>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Quick Actions */}
          <div className="mr-4 hidden items-center space-x-2 lg:flex">
            <Button 
              size="sm" 
              variant="ghost"
              onClick={() => setLocation('/caption/generate')}
              aria-label="Generate new caption"
            >
              <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
              Generate Caption
            </Button>
            <Button 
              size="sm" 
              variant="ghost"
              onClick={() => setLocation('/quick-post')}
              aria-label="Create quick post"
            >
              <Send className="mr-2 h-4 w-4" aria-hidden="true" />
              Quick Post
            </Button>
          </div>

          {/* Notifications */}
          <Button
            variant="ghost"
            size="icon"
            className="relative mr-2"
            aria-label={`View notifications. ${notificationCount} unread`}
            aria-describedby="notification-badge"
          >
            <Bell className="h-5 w-5" aria-hidden="true" />
            {notificationCount > 0 && (
              <span 
                id="notification-badge"
                className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-destructive text-[10px] font-medium text-destructive-foreground flex items-center justify-center"
                aria-label={`${notificationCount} unread notifications`}
              >
                {notificationCount}
              </span>
            )}
          </Button>

          {/* User Menu */}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon"
                  aria-label="Open user menu"
                  aria-expanded="false"
                  aria-haspopup="menu"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.avatar} alt={`${user.firstName}'s avatar`} />
                    <AvatarFallback aria-label={`${user.firstName} avatar`}>
                      {user.firstName?.[0]?.toUpperCase() || 'U'}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{user.firstName}</p>
                    <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setLocation('/profile')}>
                  <User className="mr-2 h-4 w-4" aria-hidden="true" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLocation('/settings')}>
                  <Settings className="mr-2 h-4 w-4" aria-hidden="true" />
                  Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive">
                  <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              size="sm"
              onClick={() => setLocation('/login')}
              aria-label="Sign in to your account"
            >
              Sign In
            </Button>
          )}
        </div>

        {/* Command Palette */}
        <CommandPalette open={commandOpen} onOpenChange={setCommandOpen} />
      </header>
      
      {/* System Status Banner (optional) */}
      <StatusBanner 
        variant="info"
        message="Dashboard has been redesigned! Check out the new features."
        dismissible
        storageKey="dashboard-redesign-notice"
        action={{
          label: 'Learn More',
          onClick: () => setLocation('/changelog')
        }}
      />
    </ErrorBoundary>
  );
}
