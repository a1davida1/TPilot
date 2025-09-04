import React, { useEffect } from "react";
import { Switch, Route, Redirect, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ErrorBoundary } from "@/components/error-boundary";
import { Header } from "@/components/header";
import { useAuth } from "@/hooks/useAuth";
import { SEOOptimization, seoConfigs } from "@/components/seo-optimization";
import { LandingPage } from "@/components/landing-page";
import Dashboard from "@/pages/dashboard";
import { OnboardingWalkthrough } from "@/components/onboarding-walkthrough";
import { useOnboarding } from "@/hooks/useOnboarding";
import NotFound from "@/pages/not-found";
import ResetPasswordPage from "@/pages/reset-password";
import ForgotPasswordPage from "@/pages/forgot-password";
import EmailVerificationPage from "@/pages/email-verification";
import ChangePasswordPage from "@/pages/change-password";
import History from "@/pages/history";
import Settings from "@/pages/settings";
import Checkout from "@/pages/checkout";
import Enterprise from "@/pages/enterprise";
import Phase4Dashboard from "@/pages/phase4";
import { AdminDashboard } from "@/pages/admin";
import { AdminLeadsPage } from "@/pages/admin-leads";
import PolicyDemo from "@/pages/PolicyDemo";
import CaptionGeneratorPage from "@/pages/caption-generator";
import RedditPostingPage from "@/pages/reddit-posting";
import ImageShieldPage from "@/pages/imageshield";
import TaxTracker from "@/pages/tax-tracker";
import { RedditCommunities } from "@/components/reddit-communities";
import { ImageGallery } from "@/components/image-gallery";
// Phase 1: Real Analytics Tracking
import { trackPageView, setUserId, trackFeatureUsage } from "@/lib/analytics-tracker";

// Communities Page Component
function CommunitiesPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-purple-100 dark:from-gray-900 dark:via-purple-950/20 dark:to-pink-950/20">
      {/* Animated Background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-yellow-400/5 opacity-60"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,192,203,0.1),transparent_50%)]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(255,235,59,0.05),transparent_50%)]"></div>
      </div>
      
      <div className="relative container mx-auto px-4 py-8 z-10">
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-pink-600 via-rose-500 to-purple-600 dark:from-pink-400 dark:via-rose-400 dark:to-purple-400 bg-clip-text text-transparent drop-shadow-sm mb-2">
            Reddit Communities
          </h1>
          <p className="text-lg text-gray-700 dark:text-gray-300 max-w-2xl">
            Discover and explore 180+ active communities with detailed insights, engagement rates, and posting guidelines.
          </p>
        </div>
        <RedditCommunities />
      </div>
    </div>
  );
}

// Gallery Page Component
function GalleryPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-purple-100 dark:from-gray-900 dark:via-purple-950/20 dark:to-pink-950/20">
      {/* Animated Background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-yellow-400/5 opacity-60"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,192,203,0.1),transparent_50%)]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(255,235,59,0.05),transparent_50%)]"></div>
      </div>
      
      <div className="relative container mx-auto px-4 py-8 z-10">
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-pink-600 via-rose-500 to-purple-600 dark:from-pink-400 dark:via-rose-400 dark:to-purple-400 bg-clip-text text-transparent drop-shadow-sm mb-2">
            Media Gallery
          </h1>
          <p className="text-lg text-gray-700 dark:text-gray-300 max-w-2xl">
            Upload, organize, and protect your images. Apply advanced protection to prevent reverse searches.
          </p>
        </div>
        <ImageGallery />
      </div>
    </div>
  );
}

function AuthenticatedRoutes() {
  const { user } = useAuth();
  const isAdmin = user && (user.id === 999 || user.username === 'admin' || user.isAdmin);
  const userTier = user?.tier || 'free';

  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/caption-generator" component={CaptionGeneratorPage} />
      <Route path="/imageshield" component={ImageShieldPage} />
      <Route path="/enterprise" component={Enterprise} />
      {/* ULTRA PREMIUM ROUTE - Hidden for now */}
      {/* <Route path="/phase4" component={Phase4Dashboard} /> */}
      <Route path="/reddit" component={RedditPostingPage} />
      <Route path="/communities" component={() => <CommunitiesPage />} />
      <Route path="/gallery" component={() => <GalleryPage />} />
      <Route path="/tax-tracker" component={() => <TaxTracker />} />
      <Route path="/history" component={History} />
      <Route path="/settings" component={Settings} />
      <Route path="/checkout" component={Checkout} />
      {/* Admin Routes - Only for authenticated admin users */}
      {isAdmin && (
        <>
          <Route path="/admin" component={AdminDashboard} />
          <Route path="/admin/leads" component={AdminLeadsPage} />
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function UnauthenticatedRoutes() {
  return (
    <Switch>
      <Route path="/login">
        <SEOOptimization {...seoConfigs.landing} />
        <LandingPage showLoginModal={true} loginModalMode="login" />
      </Route>
      <Route path="/signup">
        <SEOOptimization {...seoConfigs.landing} />
        <LandingPage showLoginModal={true} loginModalMode="signup" />
      </Route>
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/email-verification" component={EmailVerificationPage} />
      <Route path="/verify-email" component={EmailVerificationPage} />
      <Route path="/change-password" component={ChangePasswordPage} />
      <Route path="/caption-generator" component={CaptionGeneratorPage} />
      <Route path="/imageshield" component={ImageShieldPage} />
      <Route path="/policy-demo" component={PolicyDemo} />
      <Route path="/reddit" component={RedditPostingPage} />
      <Route path="/">
        <SEOOptimization {...seoConfigs.landing} />
        <LandingPage />
      </Route>
      <Route>
        <Redirect to="/" />
      </Route>
    </Switch>
  );
}

function Router() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { shouldShowOnboarding, markWalkthroughCompleted, showOnboarding } = useOnboarding();
  const [location] = useLocation();

  // Phase 1: Track page views and user authentication
  useEffect(() => {
    trackPageView(location, document.title);
  }, [location]);

  useEffect(() => {
    if (user?.id) {
      setUserId(user.id.toString());
    }
  }, [user]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        {isAuthenticated ? <AuthenticatedRoutes /> : <UnauthenticatedRoutes />}
      </main>
      
      {/* Onboarding Walkthrough */}
      <OnboardingWalkthrough
        isOpen={shouldShowOnboarding}
        onClose={markWalkthroughCompleted}
        onComplete={markWalkthroughCompleted}
      />
    </div>
  );
}

function App() {
  // Phase 1: Initialize analytics on app startup
  useEffect(() => {
    trackFeatureUsage('app', 'startup', { timestamp: new Date().toISOString() });
  }, []);

  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider defaultTheme="light" storageKey="thottopilot-ui-theme" forcedTheme="light">
          <TooltipProvider>
            <div className="min-h-screen bg-background text-foreground font-poppins">
              <Toaster />
              <Router />
            </div>
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
