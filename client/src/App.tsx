import React from "react";
import { Switch, Route, Redirect } from "wouter";
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
import { OnboardingWalkthrough } from "@/components/onboarding-walkthrough";
import { useOnboarding } from "@/hooks/useOnboarding";
import { PremiumLanding } from "./components/premium-landing";
import { AestheticLanding } from "./components/aesthetic-landing";
import { AppleInspiredApp } from "./components/apple-inspired-app";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import Login from "@/pages/login";
import History from "@/pages/history";
import Settings from "@/pages/settings";
import Enterprise from "@/pages/enterprise";
import Phase4Dashboard from "@/pages/phase4";
import { AdminDashboard } from "@/pages/admin";
import { AdminLeadsPage } from "@/pages/admin-leads";
import PolicyDemo from "@/pages/PolicyDemo";
import CaptionGeneratorPage from "@/pages/caption-generator";
import RedditPostingPage from "@/pages/reddit-posting";

function AuthenticatedRoutes() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/dashboard" component={Dashboard} />
      <Route path="/caption-generator" component={CaptionGeneratorPage} />
      <Route path="/enterprise" component={Enterprise} />
      <Route path="/phase4" component={Phase4Dashboard} />
      <Route path="/reddit" component={RedditPostingPage} />
      <Route path="/history" component={History} />
      <Route path="/settings" component={Settings} />
      <Route component={NotFound} />
    </Switch>
  );
}

function UnauthenticatedRoutes() {
  return (
    <Switch>
      <Route path="/login" component={Login} />
      <Route path="/caption-generator" component={CaptionGeneratorPage} />
      <Route path="/admin" component={AdminDashboard} />
      <Route path="/admin/leads" component={AdminLeadsPage} />
      <Route path="/policy-demo" component={PolicyDemo} />
      <Route path="/reddit" component={RedditPostingPage} />
      <Route path="/demo">
        <AppleInspiredApp />
      </Route>
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
  const { isAuthenticated, isLoading } = useAuth();
  const { shouldShowOnboarding, markWalkthroughCompleted, showOnboarding } = useOnboarding();

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
