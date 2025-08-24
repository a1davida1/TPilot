import { useState, useEffect, lazy, Suspense } from "react";
import { GenerationPanel } from "@/components/generation-panel";
import { PhotoInstructions } from "@/components/photo-instructions";
import { AIGenerator } from "@/components/ai-generator";
import { ImageGallery } from "@/components/image-gallery";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import type { ContentGeneration } from "@shared/schema";
import { Sparkles, User, History, Settings, Shield, Brain, ImageIcon, LogOut, UserPlus } from "lucide-react";
import { ImageProtector } from "@/components/image-protector";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link, useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ProviderStatus } from "@/components/provider-status";
import { ConversionOptimization } from "@/components/conversion-optimization";
import { EnhancedDashboard } from "@/components/enhanced-dashboard";

export default function Dashboard() {
  const [currentGeneration, setCurrentGeneration] = useState<ContentGeneration | null>(null);
  const [isGuestMode, setIsGuestMode] = useState(false);
  const [location] = useLocation();
  const { user, isLoading, isAuthenticated } = useAuth();

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

  // Use clean dashboard for elegant interface
  const CleanDashboard = lazy(() => import("@/components/clean-dashboard").then(module => ({ default: module.CleanDashboard })));
  
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <CleanDashboard 
        isGuestMode={isGuestMode} 
        user={user}
        userTier={user?.tier || (isGuestMode ? 'guest' : 'free')}
      />
    </Suspense>
  );
}
