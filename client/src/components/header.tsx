import React, { useState } from 'react';
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
  X
} from 'lucide-react';
import { GenerationCounter } from '@/components/generation-counter';
import { ThottoPilotLogo } from '@/components/thottopilot-logo';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';

export function Header() {
  const { isAuthenticated, isLoading, user, logout } = useAuth();
  const [location] = useLocation();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'signup'>('login');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    try {
      // Call the useAuth logout function which handles both frontend and backend logout
      await logout();
      // Redirect to home page after successful logout (shows landing page with login)
      window.location.href = '/';
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const isAdmin = user && (user.id === 999 || user.username === 'admin');
  
  const navigationItems = [
    { href: '/dashboard', label: 'Dashboard', authenticated: true },
    { href: '/reddit', label: 'Reddit', authenticated: null },
    { href: '/caption-generator', label: 'Generator', authenticated: null },
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
      return true;
    }
    return false;
  });

  return (
    <>
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-pink-200/50 dark:border-pink-800/30 shadow-lg shadow-pink-500/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            
            {/* Logo - Smart routing based on auth status */}
            <Link href={isAuthenticated ? "/dashboard" : "/login"}>
              <div className="flex items-center gap-3 cursor-pointer h-16">
                <img 
                  src="/logo.png" 
                  alt="ThottoPilot" 
                  className="h-10 w-10 object-contain hover:scale-105 transition-transform duration-200 filter drop-shadow-md"
                />
                <span className="text-xl font-bold bg-gradient-to-r from-pink-600 via-rose-500 to-purple-600 bg-clip-text text-transparent drop-shadow-sm">
                  ThottoPilot
                </span>
              </div>
            </Link>

            {/* Desktop Navigation - Glass Morphism Style */}
            <nav className="hidden md:flex items-center gap-2 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm rounded-full px-4 py-2 border border-pink-200/50 dark:border-pink-800/30 shadow-lg shadow-pink-500/10">
              {visibleItems.map((item) => (
                <Link 
                  key={item.href}
                  href={item.href}
                >
                  <span 
                    className={`px-4 py-2 rounded-full text-sm font-semibold transition-all duration-300 cursor-pointer transform hover:scale-105 ${
                      location === item.href 
                        ? 'bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-lg shadow-pink-500/30' 
                        : 'text-foreground hover:text-pink-600 hover:bg-pink-100/80 dark:hover:bg-pink-900/30'
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
                <div className="animate-spin rounded-full h-8 w-8 border-2 border-pink-500 border-t-transparent" />
              ) : isAuthenticated ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="flex items-center gap-2 px-3 py-2 hover:bg-pink-50"
                    >
                      <div className="w-8 h-8 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full flex items-center justify-center">
                        <User className="h-4 w-4 text-white" />
                      </div>
                      <span className="text-sm font-medium text-gray-700">
                        {user?.username || 'Account'}
                      </span>
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
                    <DropdownMenuSeparator />
                    <DropdownMenuItem 
                      onClick={handleLogout}
                      className="flex items-center gap-2 text-red-600 focus:text-red-600"
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
                    className="text-gray-700 hover:text-pink-600 hover:bg-pink-50"
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
                    className="bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white border-0 shadow-lg"
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
            <div className="md:hidden border-t border-pink-100 bg-white/95 backdrop-blur-md">
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
                          ? 'bg-pink-100 text-pink-700' 
                          : 'text-gray-700 hover:text-pink-600 hover:bg-pink-50'
                      }`}
                    >
                      {item.label}
                    </div>
                  </Link>
                ))}
                
                {/* Mobile Auth Controls */}
                <div className="pt-4 border-t border-pink-100">
                  {isAuthenticated ? (
                    <div className="space-y-1">
                      <div className="px-3 py-2 text-sm font-medium text-gray-900">
                        {user?.username || 'Account'}
                      </div>
                      <button
                        onClick={handleLogout}
                        className="w-full text-left px-3 py-2 text-base font-medium text-red-600 hover:bg-red-50 rounded-lg"
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
                        className="w-full justify-start text-gray-700 hover:text-pink-600 hover:bg-pink-50"
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
                        className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white border-0"
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