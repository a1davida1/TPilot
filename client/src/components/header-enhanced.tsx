import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { AuthModal } from '@/components/auth-modal';
import { Link, useLocation } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { 
  User, 
  LogOut, 
  Settings, 
  History,
  BarChart3,
  Sparkles,
  Menu,
  X,
  Crown,
  Bell,
  Search,
  Plus,
  ChevronDown,
  HelpCircle,
  CreditCard
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from '@/components/ui/dropdown-menu';
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from '@/components/ui/navigation-menu';
import { Badge } from '@/components/ui/badge';
import { ThottoPilotLogo } from '@/components/thottopilot-logo';
import { CommandPalette, useCommandPalette } from '@/components/ui/command-palette';
import { 
  workflowBuckets, 
  filterWorkflowBucketsByAccess,
  type AccessContext
} from '@/config/navigation';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';

// Breadcrumb Component
interface BreadcrumbProps {
  path: string;
}

function Breadcrumbs({ path }: BreadcrumbProps) {
  const segments = path.split('/').filter(Boolean);
  const formatted = segments.map(s => 
    s.split('-').map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')
  );

  if (formatted.length === 0) return null;

  return (
    <div className="hidden md:flex items-center gap-2 text-sm text-muted-foreground">
      <Link href="/dashboard">
        <span className="hover:text-foreground cursor-pointer">Dashboard</span>
      </Link>
      {formatted.map((segment, index) => (
        <div key={index} className="flex items-center gap-2">
          <ChevronDown className="h-3 w-3 -rotate-90" />
          <span className={cn(
            index === formatted.length - 1 ? 'text-foreground font-medium' : 'hover:text-foreground cursor-pointer'
          )}>
            {segment}
          </span>
        </div>
      ))}
    </div>
  );
}

// Notification Bell Component
interface NotificationBellProps {
  count?: number;
  onClick?: () => void;
}

function NotificationBell({ count = 0, onClick }: NotificationBellProps) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="relative"
      onClick={onClick}
    >
      <Bell className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-xs text-destructive-foreground flex items-center justify-center">
          {count > 9 ? '9+' : count}
        </span>
      )}
    </Button>
  );
}

// Search Bar Component
interface SearchBarProps {
  open: boolean;
  onClose: () => void;
  placeholder?: string;
}

function SearchBar({ open, onClose, placeholder = 'Search posts...' }: SearchBarProps) {
  const [query, setQuery] = useState('');

  if (!open) return null;

  return (
    <div className="flex items-center gap-2 px-3 py-1 bg-muted rounded-lg">
      <Search className="h-4 w-4 text-muted-foreground" />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="bg-transparent border-none outline-none text-sm flex-1"
        autoFocus
      />
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setQuery('');
          onClose();
        }}
        className="h-6 w-6 p-0"
      >
        <X className="h-3 w-3" />
      </Button>
    </div>
  );
}

// Workflow Dropdown Component
interface WorkflowDropdownProps {
  bucket: typeof workflowBuckets[0];
  onNavigate?: () => void;
}

function WorkflowDropdown({ bucket, onNavigate }: WorkflowDropdownProps) {
  const [, setLocation] = useLocation();
  
  return (
    <NavigationMenuItem>
      <NavigationMenuTrigger className="h-9 px-3">
        {bucket.label}
      </NavigationMenuTrigger>
      <NavigationMenuContent>
        <ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2">
          {bucket.routes.map((route) => {
            const Icon = route.icon;
            return (
              <li key={route.key}>
                <NavigationMenuLink asChild>
                  <a
                    href={route.href}
                    onClick={(e) => {
                      e.preventDefault();
                      setLocation(route.href);
                      onNavigate?.();
                    }}
                    className={cn(
                      "block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors",
                      "hover:bg-accent hover:text-accent-foreground",
                      "focus:bg-accent focus:text-accent-foreground"
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1">
                        <div className="text-sm font-medium leading-none mb-1">
                          {route.label}
                        </div>
                        <p className="line-clamp-2 text-xs leading-snug text-muted-foreground">
                          {route.description}
                        </p>
                      </div>
                      {route.proOnly && (
                        <Badge variant="secondary" className="ml-auto">
                          PRO
                        </Badge>
                      )}
                    </div>
                  </a>
                </NavigationMenuLink>
              </li>
            );
          })}
        </ul>
      </NavigationMenuContent>
    </NavigationMenuItem>
  );
}

// Main Enhanced Header Component
type HeaderEnhancedProps = {
  onReplayWalkthrough?: () => void;
};

export function HeaderEnhanced({ onReplayWalkthrough }: HeaderEnhancedProps) {
  const { isAuthenticated, isLoading, user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const { toast } = useToast();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [_authModalMode, setAuthModalMode] = useState<'login' | 'signup'>('login');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationCount, setNotificationCount] = useState(2);
  const { open: commandPaletteOpen, setOpen: setCommandPaletteOpen } = useCommandPalette();

  // Get generation stats
  const { data: generationStats } = useQuery<{ remaining: number; limit: number }>({
    queryKey: ['/api/generations/stats'],
    enabled: isAuthenticated,
  });

  const handleReplayWalkthrough = () => {
    if (onReplayWalkthrough) {
      onReplayWalkthrough();
      setMobileMenuOpen(false);
    }
  };
  
  const handleLogout = () => {
    logout?.();
    toast({
      title: 'Signed out',
      description: 'You have been successfully signed out.',
    });
  };

  const isAdmin = Boolean(user?.isAdmin || user?.role === 'admin');
  const userTier = user?.tier || 'free';

  // Filter workflow buckets based on access
  const accessContext: AccessContext = {
    isAuthenticated,
    tier: userTier as any,
    isAdmin,
  };
  
  const availableWorkflowBuckets = filterWorkflowBucketsByAccess(workflowBuckets, accessContext);

  const canReplayWalkthrough =
    Boolean(onReplayWalkthrough) &&
    isAuthenticated &&
    (location === '/dashboard' || location === '/settings');

  // Quick actions
  const handleQuickPost = () => {
    setLocation('/quick-post');
  };

  const handleShowUpgrade = () => {
    setLocation('/settings#billing');
  };

  return (
    <>
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-b">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center justify-between">
            
            {/* Left Section: Logo + Breadcrumbs */}
            <div className="flex items-center gap-6">
              {/* Mobile Menu Button */}
              <Button
                variant="ghost"
                size="sm"
                className="lg:hidden"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>

              {/* Logo */}
              <Link href={isAuthenticated ? "/dashboard" : "/login"}>
                <div className="flex items-center gap-2 cursor-pointer group">
                  <ThottoPilotLogo size="lg" className="transition-transform group-hover:scale-110" />
                  <span className="hidden sm:inline text-xl font-bold bg-gradient-to-r from-primary-600 via-accent-rose to-primary-700 bg-clip-text text-transparent">
                    ThottoPilot
                  </span>
                </div>
              </Link>

              {/* Breadcrumbs */}
              <Breadcrumbs path={location} />
            </div>

            {/* Center Section: Workflow Navigation (Desktop) */}
            {isAuthenticated && (
              <NavigationMenu className="hidden lg:block">
                <NavigationMenuList>
                  {availableWorkflowBuckets.map((bucket) => (
                    <WorkflowDropdown key={bucket.key} bucket={bucket} />
                  ))}
                </NavigationMenuList>
              </NavigationMenu>
            )}

            {/* Right Section: Actions + User Menu */}
            <div className="flex items-center gap-2">
              {/* Search (Desktop) */}
              {!searchOpen ? (
                <Button
                  variant="ghost"
                  size="sm"
                  className="hidden md:inline-flex"
                  onClick={() => setSearchOpen(true)}
                >
                  <Search className="h-4 w-4" />
                </Button>
              ) : (
                <div className="hidden md:block">
                  <SearchBar open={searchOpen} onClose={() => setSearchOpen(false)} />
                </div>
              )}

              {/* Notifications */}
              {isAuthenticated && (
                <NotificationBell 
                  count={notificationCount} 
                  onClick={() => setNotificationCount(0)}
                />
              )}

              {/* Create Button */}
              {isAuthenticated && (
                <Button
                  size="sm"
                  className="hidden sm:inline-flex gap-2 bg-gradient-to-r from-purple-600 to-pink-600"
                  onClick={handleQuickPost}
                >
                  <Plus className="h-4 w-4" />
                  <span>Create</span>
                </Button>
              )}

              {/* User Menu or Auth Buttons */}
              {isLoading ? (
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
              ) : isAuthenticated ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="gap-2">
                      <div className="h-8 w-8 rounded-full bg-gradient-to-r from-purple-600 to-pink-600 flex items-center justify-center">
                        <User className="h-4 w-4 text-white" />
                      </div>
                      <div className="hidden md:flex items-center gap-2">
                        <span className="text-sm font-medium">
                          {user?.username || 'Account'}
                        </span>
                        {userTier === 'pro' && (
                          <Badge className="bg-gradient-to-r from-purple-600 to-pink-600">
                            <Crown className="h-3 w-3 mr-1" />
                            PRO
                          </Badge>
                        )}
                        {userTier === 'premium' && (
                          <Badge className="bg-gradient-to-r from-amber-500 to-orange-600">
                            <Crown className="h-3 w-3 mr-1" />
                            PREMIUM
                          </Badge>
                        )}
                      </div>
                      <ChevronDown className="h-4 w-4 hidden md:block" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    {/* User Info */}
                    <DropdownMenuLabel className="pb-2">
                      <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">
                          {user?.username}
                        </p>
                        <p className="text-xs leading-none text-muted-foreground">
                          {user?.email}
                        </p>
                        {userTier !== 'pro' && userTier !== 'premium' && (
                          <Badge 
                            variant="outline" 
                            className="mt-2 w-fit"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleShowUpgrade();
                            }}
                          >
                            <Sparkles className="h-3 w-3 mr-1" />
                            Upgrade to Pro
                          </Badge>
                        )}
                      </div>
                    </DropdownMenuLabel>
                    
                    <DropdownMenuSeparator />
                    
                    {/* Main Actions */}
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard" className="flex items-center gap-2 w-full cursor-pointer">
                        <BarChart3 className="h-4 w-4" />
                        Dashboard
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/history" className="flex items-center gap-2 w-full cursor-pointer">
                        <History className="h-4 w-4" />
                        History
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/settings" className="flex items-center gap-2 w-full cursor-pointer">
                        <Settings className="h-4 w-4" />
                        Settings
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/settings#billing" className="flex items-center gap-2 w-full cursor-pointer">
                        <CreditCard className="h-4 w-4" />
                        Billing
                      </Link>
                    </DropdownMenuItem>
                    
                    <DropdownMenuSeparator />
                    
                    {/* Support */}
                    <DropdownMenuItem asChild>
                      <Link href="/support" className="flex items-center gap-2 w-full cursor-pointer">
                        <HelpCircle className="h-4 w-4" />
                        Help & Support
                      </Link>
                    </DropdownMenuItem>
                    
                    {canReplayWalkthrough && (
                      <DropdownMenuItem 
                        onSelect={handleReplayWalkthrough}
                        className="flex items-center gap-2 cursor-pointer"
                      >
                        <Sparkles className="h-4 w-4" />
                        Replay Tutorial
                      </DropdownMenuItem>
                    )}
                    
                    <DropdownMenuSeparator />
                    
                    {/* Sign Out */}
                    <DropdownMenuItem 
                      onSelect={handleLogout}
                      className="flex items-center gap-2 text-destructive focus:text-destructive cursor-pointer"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setAuthModalMode('login');
                      setShowAuthModal(true);
                    }}
                  >
                    Sign In
                  </Button>
                  <Button
                    size="sm"
                    className="bg-gradient-to-r from-purple-600 to-pink-600"
                    onClick={() => {
                      setAuthModalMode('signup');
                      setShowAuthModal(true);
                    }}
                  >
                    Get Started
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="lg:hidden border-t py-4">
              <div className="space-y-4">
                {/* Mobile Workflow Navigation */}
                {isAuthenticated && availableWorkflowBuckets.map((bucket) => (
                  <div key={bucket.key} className="space-y-2">
                    <div className="px-2 text-sm font-medium text-muted-foreground">
                      {bucket.label}
                    </div>
                    <div className="space-y-1">
                      {bucket.routes.map((route) => {
                        const Icon = route.icon;
                        return (
                          <Link
                            key={route.key}
                            href={route.href}
                            onClick={() => setMobileMenuOpen(false)}
                          >
                            <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-accent cursor-pointer">
                              <Icon className="h-4 w-4" />
                              <div className="flex-1">
                                <div className="text-sm font-medium">{route.label}</div>
                                <div className="text-xs text-muted-foreground">
                                  {route.description}
                                </div>
                              </div>
                              {route.proOnly && (
                                <Badge variant="secondary" className="ml-auto">
                                  PRO
                                </Badge>
                              )}
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                ))}
                
                {/* Mobile Auth Controls */}
                {!isAuthenticated && (
                  <div className="px-3 space-y-2 border-t pt-4">
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setAuthModalMode('login');
                        setShowAuthModal(true);
                        setMobileMenuOpen(false);
                      }}
                    >
                      Sign In
                    </Button>
                    <Button
                      className="w-full bg-gradient-to-r from-purple-600 to-pink-600"
                      onClick={() => {
                        setAuthModalMode('signup');
                        setShowAuthModal(true);
                        setMobileMenuOpen(false);
                      }}
                    >
                      Get Started
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Auth Modal */}
      <AuthModal 
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => {
          setShowAuthModal(false);
          toast({
            title: 'Welcome!',
            description: 'Successfully signed in',
          });
        }}
      />

      {/* Command Palette */}
      <CommandPalette 
        open={commandPaletteOpen}
        onOpenChange={setCommandPaletteOpen}
        onGenerateCaption={() => {
          toast({
            title: 'Generating caption...',
            description: 'AI is creating your caption',
          });
        }}
        onShowUpgrade={handleShowUpgrade}
      />
    </>
  );
}
