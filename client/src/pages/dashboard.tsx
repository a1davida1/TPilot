import { useState, useEffect, lazy, Suspense } from "react";
import { motion } from "framer-motion";
import { GenerationPanel } from "@/components/generation-panel";
import { PhotoInstructions } from "@/components/photo-instructions";
import { AIGenerator } from "@/components/ai-generator";
import { ImageGallery } from "@/components/image-gallery";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import type { ContentGeneration } from "@shared/schema";
import { Sparkles, User, History, Settings, Shield, Brain, ImageIcon, LogOut, UserPlus, PlayCircle, TrendingUp } from "lucide-react";
import { ImageProtector } from "@/components/image-protector";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ProviderStatus } from "@/components/provider-status";
import { ConversionOptimization } from "@/components/conversion-optimization";
import { EnhancedDashboard } from "@/components/enhanced-dashboard";
import { OnboardingWalkthrough } from "@/components/onboarding-walkthrough";
import { useOnboarding } from "@/hooks/useOnboarding";
import { GettingStarted } from "@/components/getting-started";

export default function Dashboard() {
  const [currentGeneration, setCurrentGeneration] = useState<ContentGeneration | null>(null);
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [location] = useLocation();
  const { user, isLoading, isAuthenticated } = useAuth();
  const { shouldShowOnboarding, markWalkthroughCompleted, showOnboarding } = useOnboarding();
  const [gettingStartedAtBottom, setGettingStartedAtBottom] = useState(false);
  const [showGettingStarted, setShowGettingStarted] = useState(true);

  // Check for guest mode
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    setIsGuestMode(urlParams.get('guest') === 'true' || !isAuthenticated);
  }, [location, isAuthenticated]);

  const handleContentGenerated = (generation: ContentGeneration) => {
    setCurrentGeneration(generation);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Load analytics dashboard for proper dashboard view
  const AnalyticsDashboard = lazy(() => import("@/components/analytics-dashboard").then(module => ({ default: module.AnalyticsDashboard })));
  const EngagementStats = lazy(() => import("@/components/engagement-stats").then(module => ({ default: module.EngagementStats })));
  const GenerationCounter = lazy(() => import("@/components/generation-counter").then(module => ({ default: module.GenerationCounter })));
  const ProviderStatus = lazy(() => import("@/components/provider-status").then(module => ({ default: module.ProviderStatus })));
  
  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Dashboard Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Track your content creation performance and statistics</p>
        </div>

        <Suspense fallback={
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        }>
          <div className="space-y-8">
            {/* Getting Started - Top Position */}
            {showGettingStarted && !gettingStartedAtBottom && !isGuestMode && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.5 }}
              >
                <GettingStarted 
                  userTier={user?.tier || 'free'}
                  onSetupLater={() => {
                    setGettingStartedAtBottom(true);
                  }}
                />
              </motion.div>
            )}

            {/* Generation Counter */}
            {!isGuestMode && (
              <div className="w-fit">
                <GenerationCounter />
              </div>
            )}

            {/* Engagement Statistics */}
            {!isGuestMode && (
              <EngagementStats />
            )}

            {/* Analytics Dashboard */}
            <AnalyticsDashboard isGuestMode={isGuestMode} />

            {/* Provider Status */}
            <ProviderStatus />

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Quick Actions
                </CardTitle>
                <CardDescription>
                  Jump to your most used features
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Link href="/caption-generator">
                    <Button variant="outline" className="w-full h-20 flex flex-col gap-2" data-testid="nav-content-creator">
                      <Brain className="h-6 w-6" />
                      <span>Generate Content</span>
                    </Button>
                  </Link>
                  <Link href="/dashboard?section=protect">
                    <Button variant="outline" className="w-full h-20 flex flex-col gap-2" data-testid="nav-image-shield">
                      <Shield className="h-6 w-6" />
                      <span>Protect Images</span>
                    </Button>
                  </Link>
                  <Link href="/history">
                    <Button variant="outline" className="w-full h-20 flex flex-col gap-2" data-testid="nav-analytics">
                      <History className="h-6 w-6" />
                      <span>View History</span>
                    </Button>
                  </Link>
                  <Link href="/reddit">
                    <Button variant="outline" className="w-full h-20 flex flex-col gap-2" data-testid="nav-reddit-communities">
                      <TrendingUp className="h-6 w-6" />
                      <span>Reddit Communities</span>
                    </Button>
                  </Link>
                </div>
                
                {/* Onboarding Test Button */}
                <div className="mt-4">
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={showOnboarding}
                    className="w-full"
                  >
                    <PlayCircle className="h-4 w-4 mr-2" />
                    Start Interactive Tutorial
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Getting Started - Bottom Position */}
            {showGettingStarted && gettingStartedAtBottom && !isGuestMode && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                <GettingStarted 
                  userTier={user?.tier || 'free'}
                  isAtBottom={true}
                  onSetupLater={() => {
                    setShowGettingStarted(false);
                  }}
                />
              </motion.div>
            )}
          </div>
        </Suspense>
      </div>
      
      {/* Onboarding Walkthrough */}
      <OnboardingWalkthrough
        isOpen={shouldShowOnboarding}
        onClose={markWalkthroughCompleted}
        onComplete={markWalkthroughCompleted}
      />
    </div>
  );
}
