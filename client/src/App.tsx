import React, { Suspense, useEffect } from "react";
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
import { UnifiedLanding } from "@/components/unified-landing";
import { FeedbackWidget } from "@/components/FeedbackWidget";
const Dashboard = React.lazy(() => import("@/pages/dashboard"));
const Phase4Dashboard = React.lazy(() => import("@/pages/phase4"));
import { OnboardingWalkthrough } from "@/components/onboarding-walkthrough";
import { useOnboarding } from "@/hooks/useOnboarding";
import NotFound from "@/pages/not-found";
import ResetPasswordPage from "@/pages/reset-password";
import ForgotPasswordPage from "@/pages/forgot-password";
import EmailVerificationPage from "@/pages/email-verification";
import ChangePasswordPage from "@/pages/change-password";
import LogoutPage from "@/pages/logout";
import History from "@/pages/history";
import Settings from "@/pages/settings";
import Checkout from "@/pages/checkout";
import Enterprise from "@/pages/enterprise";
const AdminDashboard = React.lazy(() => import("@/pages/admin").then(module => ({ default: module.AdminDashboard })));
const AdminLeadsPage = React.lazy(() => import("@/pages/admin-leads").then(module => ({ default: module.AdminLeadsPage })));
const CaptionGeneratorPage = React.lazy(() => import("@/pages/caption-generator"));
const RedditPostingPage = React.lazy(() => import("@/pages/reddit-posting"));
const ImageShieldPage = React.lazy(() => import("@/pages/imageshield"));
const TaxTracker = React.lazy(() => import("@/pages/tax-tracker"));
const ReferralPage = React.lazy(() => import("@/pages/referral"));
const ProPerksPage = React.lazy(() => import("@/pages/pro-perks"));
const TermsOfService = React.lazy(() => import("@/pages/terms-of-service"));
const PrivacyPolicy = React.lazy(() => import("@/pages/privacy-policy"));
const PostSchedulingPage = React.lazy(() => import("@/pages/post-scheduling"));
const QuickPostPage = React.lazy(() => import("@/pages/quick-post"));
const ScheduledPostsPage = React.lazy(() => import("@/pages/scheduled-posts"));
const AnalyticsPage = React.lazy(() => import("@/pages/analytics"));
import { RedditCommunities } from "@/components/reddit-communities";
import { ImageGallery } from "@/components/image-gallery";
// Phase 1: Real Analytics Tracking
import { trackPageView, setUserId, trackFeatureUsage } from "@/lib/analytics-tracker";

// Communities Page Component
function CommunitiesPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-background via-primary-50/60 to-primary-100/50 dark:from-background dark:via-primary-900/40 dark:to-primary-950/40">
      {/* Animated Background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-card/10 via-transparent to-[hsl(var(--accent-yellow)/0.12)] opacity-60"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--accent-pink)/0.12),transparent_55%)]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,hsl(var(--accent-yellow)/0.08),transparent_55%)]"></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="mb-2 text-4xl font-bold bg-gradient-to-r from-primary-600 via-accent-rose to-primary-700 dark:from-primary-400 dark:via-accent-rose dark:to-primary-500 bg-clip-text text-transparent drop-shadow-sm">
            Reddit Communities
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
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
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-background via-primary-50/60 to-primary-100/50 dark:from-background dark:via-primary-900/40 dark:to-primary-950/40">
      {/* Animated Background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-card/10 via-transparent to-[hsl(var(--accent-yellow)/0.12)] opacity-60"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--accent-pink)/0.12),transparent_55%)]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,hsl(var(--accent-yellow)/0.08),transparent_55%)]"></div>
      </div>

      <div className="relative z-10 container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="mb-2 text-4xl font-bold bg-gradient-to-r from-primary-600 via-accent-rose to-primary-700 dark:from-primary-400 dark:via-accent-rose dark:to-primary-500 bg-clip-text text-transparent drop-shadow-sm">
            Media Gallery
          </h1>
          <p className="max-w-2xl text-lg text-muted-foreground">
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
  const isAdmin = Boolean(user?.isAdmin);
  const userTier = user?.tier || 'free';

  return (
    <Switch>
      <Route path="/landing">
        <SEOOptimization {...seoConfigs.landing} />
        <UnifiedLanding />
      </Route>
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/">
        <Redirect to="/dashboard" />
      </Route>
      <Route path="/caption-generator" component={CaptionGeneratorPage} />
      <Route path="/imageshield" component={ImageShieldPage} />
      <Route path="/enterprise" component={Enterprise} />
      <Route path="/phase4" component={Phase4Dashboard} />
      <Route path="/reddit" component={RedditPostingPage} />
      <Route path="/reddit/communities" component={() => <CommunitiesPage />} />
      <Route path="/quick-post" component={QuickPostPage} />
      <Route path="/post-scheduling" component={PostSchedulingPage} />
      <Route path="/scheduled-posts" component={ScheduledPostsPage} />
      <Route path="/analytics" component={AnalyticsPage} />
      <Route path="/gallery" component={() => <GalleryPage />} />
      <Route path="/tax-tracker" component={() => <TaxTracker />} />
      {/* Referral Program - Available to all authenticated users */}
      <Route path="/referral" component={ReferralPage} />
      <Route path="/pro-perks" component={ProPerksPage} />
      <Route path="/history" component={History} />
      <Route path="/settings" component={Settings} />
      <Route path="/checkout" component={Checkout} />
      <Route path="/logout" component={LogoutPage} />
      <Route path="/terms" component={TermsOfService} />
      <Route path="/privacy" component={PrivacyPolicy} />
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
        <UnifiedLanding />
      </Route>
      <Route path="/signup">
        <SEOOptimization {...seoConfigs.landing} />
        <UnifiedLanding />
      </Route>
      <Route path="/email-verification" component={EmailVerificationPage} />
      <Route path="/reset-password" component={ResetPasswordPage} />
      <Route path="/forgot-password" component={ForgotPasswordPage} />
      <Route path="/change-password" component={ChangePasswordPage} />
      <Route path="/caption-generator" component={CaptionGeneratorPage} />
      <Route path="/imageshield" component={ImageShieldPage} />
      <Route path="/reddit" component={RedditPostingPage} />
      <Route path="/pro-perks" component={ProPerksPage} />
      <Route path="/landing">
        <SEOOptimization {...seoConfigs.landing} />
        <UnifiedLanding />
      </Route>
      <Route path="/terms" component={TermsOfService} />
      <Route path="/privacy" component={PrivacyPolicy} />
      <Route path="/">
        <SEOOptimization {...seoConfigs.landing} />
        <UnifiedLanding />
      </Route>
      <Route>
        <Redirect to="/" />
      </Route>
    </Switch>
  );
}

function Router() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const { shouldShowOnboarding, markWalkthroughCompleted, showOnboarding: _showOnboarding } = useOnboarding();
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
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <Suspense fallback={<div className="p-4">Loading...</div>}>
          {isAuthenticated ? <AuthenticatedRoutes /> : <UnauthenticatedRoutes />}
        </Suspense>
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
        <ThemeProvider defaultTheme="system" storageKey="thottopilot-ui-theme">
          <TooltipProvider>
            <div className="min-h-screen bg-background text-foreground font-poppins">
              <Toaster />
              <Router />
              <FeedbackWidget />
            </div>
          </TooltipProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;