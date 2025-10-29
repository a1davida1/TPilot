import { useMemo, useState } from 'react';
import { Link, useLocation } from 'wouter';
import {
  User,
  LogOut,
  Settings as SettingsIcon,
  History as HistoryIcon,
  BarChart3,
  Sparkles,
  Menu,
  X,
  Crown,
  ChevronDown,
  Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ThottoPilotLogo } from '@/components/thottopilot-logo';
import { AuthModal } from '@/components/auth-modal';
import { useAuth } from '@/hooks/useAuth';
import {
  workflowBuckets,
  utilityRoutes,
  filterWorkflowBucketsByAccess,
  filterRoutesByAccess,
} from '@/config/workflows';
import type { WorkflowBucketConfig, WorkflowRouteConfig, UtilityRouteConfig } from '@/config/workflows';
import { OneClickPostWizard } from '@/components/one-click-post-wizard';

interface HeaderProps {
  onReplayWalkthrough?: () => void;
}

function navItemClasses(active: boolean): string {
  const baseClasses = 'px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300 cursor-pointer transform hover:scale-105';
  if (active) {
    return `${baseClasses} bg-gradient-to-r from-primary-500 to-accent-rose text-primary-foreground shadow-[0_10px_30px_hsl(var(--primary)/0.3)]`;
  }
  return `${baseClasses} text-muted-foreground hover:text-primary-600 hover:bg-primary-100/80 dark:hover:bg-primary-900/30`;
}

function mobileItemClasses(active: boolean): string {
  if (active) {
    return 'block px-3 py-2 rounded-lg text-base font-medium bg-primary-100 text-primary-700';
  }
  return 'block px-3 py-2 rounded-lg text-base font-medium text-muted-foreground hover:text-primary-600 hover:bg-primary-50';
}

function renderWorkflowIcon(route: WorkflowRouteConfig): JSX.Element {
  const Icon = route.icon;
  return <Icon className="h-4 w-4 text-primary" />;
}

function renderUtilityIcon(route: UtilityRouteConfig): JSX.Element | null {
  if (!route.icon) {
    return null;
  }
  const Icon = route.icon;
  return <Icon className="h-4 w-4 text-primary" />;
}

export function Header({ onReplayWalkthrough }: HeaderProps) {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [location] = useLocation();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup'>('login');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isCreateWizardOpen, setIsCreateWizardOpen] = useState(false);

  const handleReplayWalkthrough = () => {
    if (onReplayWalkthrough) {
      onReplayWalkthrough();
      setMobileMenuOpen(false);
    }
  };

  const handleLogout = () => {
    window.location.href = '/logout';
  };

  const isAdmin = Boolean(user?.isAdmin || user?.role === 'admin');
  const userTier = user?.tier ?? null;

  const accessContext = useMemo(
    () => ({
      isAuthenticated,
      tier: userTier,
      isAdmin,
    }),
    [isAuthenticated, userTier, isAdmin],
  );

  const accessibleWorkflowBuckets = useMemo<WorkflowBucketConfig[]>(
    () => filterWorkflowBucketsByAccess(workflowBuckets, accessContext),
    [accessContext],
  );

  const accessibleUtilityRoutes = useMemo<UtilityRouteConfig[]>(
    () => filterRoutesByAccess(utilityRoutes, accessContext),
    [accessContext],
  );

  const dashboardRoute = accessibleUtilityRoutes.find(route => route.key === 'dashboard') ?? null;
  const secondaryUtilityRoutes = accessibleUtilityRoutes.filter(route => route.key !== 'dashboard');

  const canReplayWalkthrough =
    Boolean(onReplayWalkthrough) &&
    isAuthenticated &&
    (location === '/dashboard' || location === '/settings');

  const isRouteActive = (href: string) => location === href;

  const handleCreateClick = () => {
    if (isLoading) {
      return;
    }

    if (!isAuthenticated) {
      setAuthModalMode('signup');
      setShowAuthModal(true);
      setMobileMenuOpen(false);
      return;
    }

    setIsCreateWizardOpen(true);
    setMobileMenuOpen(false);
  };

  const renderWorkflowDropdown = (bucket: WorkflowBucketConfig) => {
    const bucketActive = bucket.routes.some(route => isRouteActive(route.href));

    return (
      <DropdownMenu key={bucket.key}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className={navItemClasses(bucketActive)}
            data-testid={`nav-group-${bucket.key}`}
          >
            <span className="flex items-center gap-2">
              {bucket.label}
              <ChevronDown className="h-4 w-4" />
            </span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-72" align="start" sideOffset={8}>
          {bucket.routes.map(route => (
            <DropdownMenuItem asChild key={route.key}>
              <Link href={route.href}>
                <div className="flex items-start gap-3 py-1">
                  <div className="mt-0.5">{renderWorkflowIcon(route)}</div>
                  <div className="flex-1">
                    <div className="text-sm font-semibold text-foreground">{route.label}</div>
                    <p className="text-xs text-muted-foreground leading-snug">{route.description}</p>
                  </div>
                  {route.proOnly && (
                    <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                      Pro
                    </Badge>
                  )}
                </div>
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  };

  const renderUtilityLink = (route: UtilityRouteConfig) => (
    <Link
      key={route.key}
      href={route.href}
      className={navItemClasses(isRouteActive(route.href))}
      data-testid={`nav-${route.key}`}
    >
      <span className="flex items-center gap-2">
        {renderUtilityIcon(route)}
        <span>{route.label}</span>
      </span>
    </Link>
  );

  return (
    <>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:bg-background focus:text-foreground focus:px-4 focus:py-2 focus:rounded focus:shadow-lg"
      >
        Skip to main content
      </a>
      <header className="sticky top-0 z-50 bg-background/80 dark:bg-background/80 backdrop-blur-xl border-b border-border/40 dark:border-border/30 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href={isAuthenticated ? '/dashboard' : '/login'}>
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

            <div className="hidden md:flex items-center gap-3 bg-card/60 dark:bg-card/60 backdrop-blur-sm rounded-full px-4 py-2 border border-border/40 dark:border-border/30 shadow-lg">
              {dashboardRoute && renderUtilityLink(dashboardRoute)}
              {accessibleWorkflowBuckets.map(renderWorkflowDropdown)}
              {secondaryUtilityRoutes.map(renderUtilityLink)}
            </div>

            <div className="hidden md:flex items-center gap-3">
              <Button
                size="sm"
                onClick={handleCreateClick}
                className="bg-gradient-to-r from-primary-500 to-primary-700 hover:from-primary-600 hover:to-primary-800 text-primary-foreground border-0 shadow-lg"
                data-testid="button-create"
              >
                <Plus className="h-4 w-4 mr-2" />
                Create
              </Button>

              {isLoading ? (
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary border-t-transparent" />
              ) : isAuthenticated ? (
                <>
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
                          {user?.tier && (
                            <Badge
                              variant={user.tier === 'pro' ? 'default' : 'outline'}
                              className={user.tier === 'pro'
                                ? 'bg-primary text-primary-foreground text-xs px-2 py-0.5'
                                : 'text-xs px-2 py-0.5'}
                            >
                              {user.tier === 'pro' && <Crown className="h-3 w-3 mr-1" />}
                              {user.tier.toUpperCase()}
                            </Badge>
                          )}
                        </div>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem asChild>
                        <Link href="/dashboard" className="flex items-center gap-2 w-full">
                          <BarChart3 className="h-4 w-4" />
                          Dashboard
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/history" className="flex items-center gap-2 w-full">
                          <HistoryIcon className="h-4 w-4" />
                          History
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem asChild>
                        <Link href="/settings" className="flex items-center gap-2 w-full">
                          <SettingsIcon className="h-4 w-4" />
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

            <div className="flex items-center gap-2 md:hidden">
              <Button
                size="sm"
                onClick={handleCreateClick}
                className="bg-gradient-to-r from-primary-500 to-primary-700 hover:from-primary-600 hover:to-primary-800 text-primary-foreground border-0 shadow-lg"
                data-testid="button-create-mobile"
              >
                <Plus className="h-4 w-4 mr-1" />
                Create
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                aria-label="Toggle navigation"
              >
                {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>
            </div>
          </div>

          {mobileMenuOpen && (
            <div className="md:hidden border-t border-border/30 bg-background/95 backdrop-blur-md">
              <div className="px-2 pt-2 pb-4 space-y-4">
                {dashboardRoute && (
                  <Link
                    href={dashboardRoute.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={mobileItemClasses(isRouteActive(dashboardRoute.href))}
                    data-testid="mobile-nav-dashboard"
                  >
                    <div className="flex items-center gap-3">
                      {renderUtilityIcon(dashboardRoute)}
                      <span>{dashboardRoute.label}</span>
                    </div>
                  </Link>
                )}

                {accessibleWorkflowBuckets.map(bucket => (
                  <div key={bucket.key} className="space-y-2">
                    <p className="px-3 text-xs font-semibold uppercase text-muted-foreground tracking-wide">
                      {bucket.label}
                    </p>
                    <div className="space-y-1">
                      {bucket.routes.map(route => (
                        <Link
                          key={route.key}
                          href={route.href}
                          onClick={() => setMobileMenuOpen(false)}
                          className={mobileItemClasses(isRouteActive(route.href))}
                          data-testid={`mobile-nav-${route.key}`}
                        >
                          <div className="flex items-start gap-3">
                            {renderWorkflowIcon(route)}
                            <div className="flex-1">
                              <div className="text-sm font-medium text-foreground">{route.label}</div>
                              <p className="text-xs text-muted-foreground leading-snug">{route.description}</p>
                            </div>
                            {route.proOnly && (
                              <Badge variant="secondary" className="text-[10px] uppercase tracking-wide">
                                Pro
                              </Badge>
                            )}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                ))}

                {secondaryUtilityRoutes.length > 0 && (
                  <div className="space-y-1 pt-2 border-t border-border/20">
                    {secondaryUtilityRoutes.map(route => (
                      <Link
                        key={route.key}
                        href={route.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={mobileItemClasses(isRouteActive(route.href))}
                        data-testid={`mobile-nav-${route.key}`}
                      >
                        <div className="flex items-center gap-3">
                          {renderUtilityIcon(route)}
                          <span>{route.label}</span>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}

                <div className="pt-4 border-t border-border/30">
                  {isAuthenticated ? (
                    <div className="space-y-2 px-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground">
                          {user?.username || 'Account'}
                        </span>
                        {user?.tier && (
                          <Badge
                            variant={user.tier === 'pro' ? 'default' : 'outline'}
                            className={user.tier === 'pro'
                              ? 'bg-primary text-primary-foreground text-xs px-2 py-0.5'
                              : 'text-xs px-2 py-0.5'}
                          >
                            {user.tier === 'pro' && <Crown className="h-3 w-3 mr-1 inline" />}
                            {user.tier.toUpperCase()}
                          </Badge>
                        )}
                      </div>

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

      <Dialog open={isCreateWizardOpen} onOpenChange={setIsCreateWizardOpen}>
        <DialogContent className="max-w-5xl w-full max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Quick Create</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <OneClickPostWizard />
          </div>
        </DialogContent>
      </Dialog>

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
