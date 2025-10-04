import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { AuthModal } from '@/components/auth-modal';
import { Link, useLocation } from 'wouter';
import { 
  User, 
  LogOut, 
  Settings, 
  History,
  BarChart3,
  Sparkles,
  Menu,
  X,
  Crown
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { ThottoPilotLogo } from '@/components/thottopilot-logo';

type HeaderProps = {
  onReplayWalkthrough?: () => void;
};

export function Header({ onReplayWalkthrough }: HeaderProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [location] = useLocation();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup'>('login');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleReplayWalkthrough = () => {
    if (onReplayWalkthrough) {
      onReplayWalkthrough();
      setMobileMenuOpen(false);
    }
  };
  
  const handleLogout = () => {
    // Redirect to logout page which handles the logout process
    window.location.href = '/logout';
  };

  const isAdmin = Boolean(user?.isAdmin || user?.role === 'admin');

  const canReplayWalkthrough =
    Boolean(onReplayWalkthrough) &&
    isAuthenticated &&
    (location === '/dashboard' || location === '/settings');
  const navigationItems = [
    { href: '/dashboard', label: 'Dashboard', authenticated: true },
    { href: '/reddit', label: 'Reddit', authenticated: null },
    { href: '/caption-generator', label: 'Generator', authenticated: null },
    { href: '/referral', label: 'Referral', authenticated: true, proOnly: true },
    { href: '/history', label: 'History', authenticated: true },
    { href: '/settings', label: 'Settings', authenticated: true },
    { href: '/admin', label: 'Admin Portal', authenticated: true, adminOnly: true },
  ];

  const visibleItems = navigationItems.filter(item => {
    if (item.authenticated === null || item.authenticated === isAuthenticated) {
      // If item requires admin access, check admin status
      if (item.adminOnly) {
        return isAdmin;
      }
      // If item requires pro access, check pro status
      if (item.proOnly) {
        return user?.tier === 'pro';
      }
      return true;
    }
    return false;
  });

  return (
    <>
      <a href="#main-content" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:bg-background focus:text-foreground focus:px-4 focus:py-2 focus:rounded focus:shadow-lg">
        Skip to main content
      </a>
      <header className="sticky top-0 z-50 bg-background/80 dark:bg-background/80 backdrop-blur-xl border-b border-border/40 dark:border-border/30 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Logo - Smart routing based on auth status */}
            <Link href={isAuthenticated ? "/dashboard" : "/login"}>
              <div className="flex items-center gap-3 cursor-pointer h-16 group">
                <div className="smooth-hover">
                  <ThottoPilotLogo 
                    size="lg" 
                    className="group-hover:animate-logo-pulse transition-all duration-300"
                  />
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-primary-600 via-accent-rose to-primary-700 bg-clip-text text-transparent drop-shadow-sm group-hover:scale-105 transition-transform duration-300">
                  ThottoPilot
                </span>
              </div>
            </Link>

            {/* Desktop Navigation - Glass Morphism Style */}
            <nav className="hidden md:flex items-center gap-2 bg-card/60 dark:bg-card/60 backdrop-blur-sm rounded-full px-4 py-2 border border-border/40 dark:border-border/30 shadow-lg">
              {visibleItems.map((item) => (
                <Link 
                  key={item.href}
                  href={item.href}
                >
                  <span 
                    className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300 cursor-pointer transform hover:scale-105 ${
                      location === item.href 
                        ? 'bg-gradient-to-r from-primary-500 to-accent-rose text-primary-foreground shadow-[0_10px_30px_hsl(var(--primary)/0.3)]' 
                        : 'text-muted-foreground hover:text-primary-600 hover:bg-primary-100/80 dark:hover:bg-primary-900/30'
                    }`}
                    data-testid={`nav-${item.label.toLowerCase().replace(' ', '-')}`}
                  >
                    {item.label}
                  </span>
                </Link>
              ))}
            </nav>

{/* Generation Counter will be added to dashboard instead */}

            {/* Desktop Auth Controls */}
            <div className="hidden md:flex items-center gap-3">
              {isLoading ? (
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
              ) : isAuthenticated ? (
                <>
                  {/* Upgrade Button for Free/Starter Users */}
                  {user?.tier && user.tier !== 'pro' && (
                    <Link href="/settings">
                      <Button 
                        size="sm"
                        className="bg-[linear-gradient(90deg,hsl(var(--accent-yellow)),hsl(var(--warning)))] hover:opacity-90 text-warning-foreground font-semibold shadow-lg animate-pulse"
                        data-testid="button-upgrade-to-pro"
                      >
                        <Sparkles className="h-4 w-4 mr-2" />
                        Upgrade to Pro
                      </Button>
                    </Link>
                  )}
                  
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="flex items-center gap-2 px-3 py-2 hover:bg-primary-50 dark:hover:bg-primary-900/20"
                    >
                      <div className="w-8 h-8 bg-gradient-to-r from-primary-500 to-primary-700 rounded-full flex items-center justify-center">
                        <User className="h-4 w-4 text-primary-foreground" />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-muted-foreground">
                          {user?.username || 'Account'}
                        </span>
                        {/* Tier Badge Indicator */}
                        {user?.tier && (
                          <Badge 
                            variant={user.tier === 'pro' ? 'default' : 'outline'}
                            className={user.tier === 'pro' 
                              ? 'bg-primary text-primary-foreground text-xs px-2 py-0.5' 
                              : 'text-xs px-2 py-0.5'
                            }
                          >
                            {user.tier === 'pro' && <Crown className="h-3 w-3 mr-1" />}
                            {user.tier.toUpperCase()}
                          </Badge>
                        )}
                      </div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem asChild>
                      <Link href="/dashboard" className="flex items-center gap-2 w-full">
                        <BarChart3 className="h-4 w-4" />
                        Dashboard
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/history" className="flex items-center gap-2 w-full">
                        <History className="h-4 w-4" />
                        History
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/settings" className="flex items-center gap-2 w-full">
                        <Settings className="h-4 w-4" />
                        Settings
                      </Link>
                    </DropdownMenuItem>
                    {canReplayWalkthrough && (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem 
                          onSelect={handleReplayWalkthrough}
                          className="flex items-center gap-2"
                          data-testid="menu-replay-walkthrough"
                        >
                          <Sparkles className="h-4 w-4" />
                          Replay Tutorial
                        </DropdownMenuItem>
                      </>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onSelect={handleLogout}
                      className="flex items-center gap-2 text-destructive focus:text-destructive"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                </>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setAuthModalMode('login');
                      setShowAuthModal(true);
                    }}
                    className="text-muted-foreground hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20"
                    data-testid="button-sign-in"
                  >
                    Sign In
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setAuthModalMode('signup');
                      setShowAuthModal(true);
                    }}
                    className="bg-gradient-to-r from-primary-500 to-primary-700 hover:from-primary-600 hover:to-primary-800 text-primary-foreground border-0 shadow-lg"
                    data-testid="button-get-started"
                  >
                    Get Started
                  </Button>
                </div>
              )}
            </div>

            {/* Mobile Menu Button */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>

          {/* Mobile Menu */}
          {mobileMenuOpen && (
            <div className="md:hidden border-t border-border/30 bg-background/95 backdrop-blur-md">
              <div className="px-2 pt-2 pb-3 space-y-1">
                {visibleItems.map((item) => (
                  <Link 
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                  >
                    <div 
                      className={`block px-3 py-2 rounded-lg text-base font-medium transition-colors cursor-pointer ${
                        location === item.href 
                          ? 'bg-primary-100 text-primary-700' 
                          : 'text-muted-foreground hover:text-primary-600 hover:bg-primary-50'
                      }`}
                    >
                      {item.label}
                    </div>
                  </Link>
                ))}
                
                {/* Mobile Auth Controls */}
                <div className="pt-4 border-t border-border/30">
                  {isAuthenticated ? (
                    <div className="space-y-1">
                      <div className="px-3 py-2 flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">
                          {user?.username || 'Account'}
                        </span>
                        {/* Mobile Tier Badge */}
                        {user?.tier && (
                          <Badge 
                            variant={user.tier === 'pro' ? 'default' : 'outline'}
                            className={user.tier === 'pro' 
                              ? 'bg-primary text-primary-foreground text-xs px-2 py-0.5' 
                              : 'text-xs px-2 py-0.5'
                            }
                          >
                            {user.tier === 'pro' && <Crown className="h-3 w-3 mr-1 inline" />}
                            {user.tier.toUpperCase()}
                          </Badge>
                        )}
                      </div>
                      
                      {/* Mobile Upgrade Button for Free/Starter Users */}
                      {user?.tier && user.tier !== 'pro' && (
                        <Link href="/settings" onClick={() => setMobileMenuOpen(false)}>
                          <Button 
                            size="sm"
                            className="w-full bg-[linear-gradient(90deg,hsl(var(--accent-yellow)),hsl(var(--warning)))] hover:opacity-90 text-warning-foreground font-semibold shadow-lg animate-pulse"
                            data-testid="button-mobile-upgrade-to-pro"
                          >
                            <Sparkles className="h-4 w-4 mr-2" />
                            Upgrade to Pro
                          </Button>
                        </Link>
                      )}
                      
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-3 py-2 text-base font-medium text-destructive hover:bg-destructive/10 rounded-lg"
                      >
                        Sign Out
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2 px-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setAuthModalMode('login');
                          setShowAuthModal(true);
                          setMobileMenuOpen(false);
                        }}
                        className="w-full justify-start text-muted-foreground hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20"
                      >
                        Sign In
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => {
                          setAuthModalMode('signup');
                          setShowAuthModal(true);
                          setMobileMenuOpen(false);
                        }}
                        className="w-full bg-gradient-to-r from-primary-500 to-primary-700 hover:from-primary-600 hover:to-primary-800 text-primary-foreground border-0"
                      >
                        Get Started
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        initialMode={authModalMode}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => {
          setShowAuthModal(false);
          window.location.reload();
        }}
      />
    </>
  );
}