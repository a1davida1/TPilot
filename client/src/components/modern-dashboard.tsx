import React, { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { 
  Upload,
  Sparkles,
  Shield,
  Target,
  Scale,
  BarChart3,
  Calculator,
  Gift,
  Menu,
  X,
  Clock,
  Bell,
  Settings,
  ChevronRight,
  Home,
  Brain,
  Users,
  Hash,
  History,
  ImageIcon,
  Wand2,
  Zap,
  ListChecks,
  Command,
  CheckCircle2
} from "lucide-react";
import { FaReddit } from "react-icons/fa";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { QuickStartModal } from "@/components/dashboard-quick-start";
import { ThemeToggle } from "@/components/theme-toggle";
import { apiRequest } from "@/lib/queryClient";
import type { ApiError } from "@/lib/queryClient";

interface ModernDashboardProps {
  isRedditConnected?: boolean;
  user?: { id: number; username: string; email?: string; tier?: string; isVerified?: boolean };
  userTier?: 'guest' | 'free' | 'basic' | 'starter' | 'pro' | 'premium' | 'admin';
  isAdmin?: boolean;
}

type UserTier = NonNullable<ModernDashboardProps['userTier']>;

interface OnboardingProgress {
  connectedReddit: boolean;
  selectedCommunities: boolean;
  createdFirstPost: boolean;
}

type OnboardingMilestone = keyof OnboardingProgress;

export const MODERN_DASHBOARD_ONBOARDING_STORAGE_KEY = 'modern-dashboard:onboarding-progress';

const onboardingDefaults: OnboardingProgress = {
  connectedReddit: false,
  selectedCommunities: false,
  createdFirstPost: false,
};

const tierHierarchy: Record<UserTier, number> = {
  guest: 0,
  free: 1,
  basic: 2,
  starter: 3,
  pro: 4,
  premium: 5,
  admin: 6,
};

interface ActionCardConfig {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  route: string | null;
  comingSoon?: boolean;
  premium?: boolean;
  requiredTier?: UserTier;
  requiredMilestones?: OnboardingMilestone[];
  group: 'core' | 'growth' | 'secondary';
  completeMilestone?: OnboardingMilestone;
}

interface DashboardStatsResponse {
  postsToday: number;
  engagementRate: number;
  takedownsFound: number;
  estimatedTaxSavings: number;
}

interface DashboardActivityResponse {
  recentMedia: Array<{
    id: number;
    url: string;
    signedUrl: string | null;
    alt: string;
    createdAt: string | null;
  }>;
}

export type { DashboardStatsResponse, DashboardActivityResponse };

const numberFormatter = new Intl.NumberFormat('en-US');

function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

function formatPercentage(value: number): string {
  if (!Number.isFinite(value)) {
    return '0%';
  }
  const fractionDigits = Number.isInteger(value) ? 0 : 1;
  return `${value.toFixed(fractionDigits)}%`;
}

function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) {
    return '$0';
  }
  const minimumFractionDigits = Number.isInteger(value) ? 0 : 2;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits,
    maximumFractionDigits: 2,
  }).format(value);
}

function readStoredProgress(): OnboardingProgress {
  if (typeof window === 'undefined') {
    return onboardingDefaults;
  }

  try {
    const raw = window.localStorage.getItem(MODERN_DASHBOARD_ONBOARDING_STORAGE_KEY);
    if (!raw) {
      return onboardingDefaults;
    }

    const parsed = JSON.parse(raw) as Partial<OnboardingProgress> | null;
    if (!parsed || typeof parsed !== 'object') {
      return onboardingDefaults;
    }

    return {
      connectedReddit: typeof parsed.connectedReddit === 'boolean' ? parsed.connectedReddit : onboardingDefaults.connectedReddit,
      selectedCommunities:
        typeof parsed.selectedCommunities === 'boolean' ? parsed.selectedCommunities : onboardingDefaults.selectedCommunities,
      createdFirstPost:
        typeof parsed.createdFirstPost === 'boolean' ? parsed.createdFirstPost : onboardingDefaults.createdFirstPost,
    };
  } catch (error) {
    return onboardingDefaults;
  }
}

function hasTierAccess(currentTier: UserTier, requiredTier: UserTier | undefined, isAdminUser: boolean): boolean {
  if (!requiredTier) {
    return true;
  }

  if (isAdminUser) {
    return true;
  }

  return tierHierarchy[currentTier] >= tierHierarchy[requiredTier];
}

export function ModernDashboard({ isRedditConnected = false, user, userTier = 'free', isAdmin = false }: ModernDashboardProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showMoreTools, setShowMoreTools] = useState(false);
  const [onboardingProgress, setOnboardingProgress] = useState<OnboardingProgress>(() => readStoredProgress());
  const [quickStartOpen, setQuickStartOpen] = useState(false);
  const [quickStartStep, setQuickStartStep] = useState<'connect' | 'subreddit' | 'copy' | 'confirm'>('connect');
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { user: authUser } = useAuth();
  
  const resolvedTier = (authUser?.tier as ModernDashboardProps['userTier'] | undefined) ?? userTier;
  const resolvedUser = authUser ?? user;
  const isAdminUser = Boolean(authUser?.isAdmin || authUser?.role === 'admin' || resolvedTier === 'admin' || isAdmin);
  const isPremium = isAdminUser || resolvedTier === 'premium' || resolvedTier === 'pro';
  const displayName = resolvedUser?.username ?? resolvedUser?.email ?? 'Creator';
  const dashboardPrompt = isAdminUser
    ? 'Review platform performance and respond to creator needs.'
    : 'What would you like to do today?';

  const {
    data: statsData,
    isLoading: statsLoading,
    error: statsError,
  } = useQuery<DashboardStatsResponse>({
    queryKey: ['/api/dashboard/stats'],
    enabled: Boolean(resolvedUser?.id),
  });

  const {
    data: activityData,
    isLoading: activityLoading,
    error: activityError,
  } = useQuery<DashboardActivityResponse>({
    queryKey: ['/api/dashboard/activity'],
    enabled: Boolean(resolvedUser?.id),
  });

  // Sync onboarding progress with props and API data
  useEffect(() => {
    const currentProgress = { ...onboardingProgress };
    let hasChanges = false;

    // Sync Reddit connection status
    if (currentProgress.connectedReddit !== isRedditConnected) {
      currentProgress.connectedReddit = isRedditConnected;
      hasChanges = true;
    }

    // Sync post creation status (example: check if user has posted)
    // This would typically come from API data about user's posting history
    // For now, we'll just check if they have recent posts from the stats
    if (statsData?.postsToday && statsData.postsToday > 0 && !currentProgress.createdFirstPost) {
      currentProgress.createdFirstPost = true;
      hasChanges = true;
    }

    if (hasChanges) {
      setOnboardingProgress(currentProgress);
      try {
        window.localStorage.setItem(MODERN_DASHBOARD_ONBOARDING_STORAGE_KEY, JSON.stringify(currentProgress));
      } catch (error) {
        // Ignore localStorage errors
      }
    }
  }, [isRedditConnected, statsData?.postsToday, onboardingProgress]);

  useEffect(() => {
    if (statsError instanceof Error) {
      toast({
        title: "Unable to load dashboard stats",
        description: statsError.message,
      });
    }
  }, [statsError, toast]);

  useEffect(() => {
    if (activityError instanceof Error) {
      toast({
        title: "Unable to load media activity",
        description: activityError.message,
      });
    }
  }, [activityError, toast]);
  
  // Get current time greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const statsLoadingWithoutData = statsLoading && !statsData;
  const statsUnavailable = (!statsLoading && !statsData && statsError instanceof Error) || statsLoadingWithoutData;
  const statsSummary = {
    postsToday: statsData?.postsToday ?? 0,
    engagementRate: statsData?.engagementRate ?? 0,
    takedownsFound: statsData?.takedownsFound ?? 0,
    estimatedTaxSavings: statsData?.estimatedTaxSavings ?? 0,
  } satisfies DashboardStatsResponse;

  const statsCards = [
    {
      label: "Posts Today",
      value: statsUnavailable ? "--" : formatNumber(statsSummary.postsToday),
      icon: <Upload className="h-5 w-5" />,
      color: "text-purple-400"
    },
    {
      label: "Engagement Rate",
      value: statsUnavailable ? "--" : formatPercentage(statsSummary.engagementRate),
      icon: <Target className="h-5 w-5" />,
      color: "text-green-400"
    },
    {
      label: "Takedowns Found",
      value: statsUnavailable ? "--" : formatNumber(statsSummary.takedownsFound),
      icon: <Shield className="h-5 w-5" />,
      color: "text-yellow-400"
    },
    {
      label: "Estimated Tax Savings",
      value: statsUnavailable ? "--" : formatCurrency(statsSummary.estimatedTaxSavings),
      icon: <Calculator className="h-5 w-5" />,
      color: "text-blue-400"
    }
  ];

  const galleryItems = activityData?.recentMedia ?? [];
  const showGalleryEmptyState = !activityLoading && galleryItems.length === 0;

  const actionCards: ActionCardConfig[] = [
    {
      id: "connect-reddit",
      title: "Connect Reddit",
      description: "Link your Reddit account",
      icon: <FaReddit className="h-6 w-6" />,
      color: "from-orange-500 to-orange-600",
      route: "/auth/reddit",
      group: "core",
      completeMilestone: "connectedReddit"
    },
    {
      id: "find-subreddits",
      title: "Find Subreddits",
      description: "Best communities for you",
      icon: <Target className="h-6 w-6" />,
      color: "from-orange-500 to-orange-600",
      route: "/communities",
      group: "core",
      requiredMilestones: ["connectedReddit"],
      completeMilestone: "selectedCommunities"
    },
    {
      id: "quick-post",
      title: "Quick Post",
      description: "Upload a post in seconds",
      icon: <Upload className="h-6 w-6" />,
      color: "from-purple-500 to-purple-600",
      route: "/reddit",
      group: "core",
      requiredMilestones: ["connectedReddit", "selectedCommunities"],
      completeMilestone: "createdFirstPost"
    },
    {
      id: "generate-caption",
      title: "Generate Caption",
      description: "AI-powered content",
      icon: <Sparkles className="h-6 w-6" />,
      color: "from-blue-500 to-blue-600",
      route: "/caption-generator",
      group: "growth",
      requiredMilestones: ["connectedReddit", "selectedCommunities"]
    },
    {
      id: "protect-image",
      title: "Protect Image",
      description: "Image/Video protection",
      icon: <Shield className="h-6 w-6" />,
      color: "from-green-500 to-green-600",
      route: "/imageshield",
      group: "growth",
      requiredMilestones: ["connectedReddit", "selectedCommunities"]
    },
    {
      id: "scan-takedowns",
      title: "Scan Takedowns",
      description: "Find leaked content",
      icon: <Scale className="h-6 w-6" />,
      color: "from-red-500 to-red-600",
      route: null,
      comingSoon: true,
      group: "secondary",
      requiredTier: "pro",
      requiredMilestones: ["connectedReddit", "selectedCommunities", "createdFirstPost"]
    },
    {
      id: "view-analytics",
      title: "View Analytics",
      description: "Performance insights",
      icon: <BarChart3 className="h-6 w-6" />,
      color: "from-indigo-500 to-indigo-600",
      route: null,
      comingSoon: true,
      group: "secondary",
      requiredTier: "starter",
      requiredMilestones: ["connectedReddit", "selectedCommunities", "createdFirstPost"]
    },
    {
      id: "tax-tracker",
      title: "Tax Tracker",
      description: "Track expenses",
      icon: <Calculator className="h-6 w-6" />,
      color: "from-teal-500 to-teal-600",
      route: "/tax-tracker",
      group: "secondary",
      requiredTier: "starter",
      requiredMilestones: ["connectedReddit", "selectedCommunities", "createdFirstPost"]
    },
    {
      id: "pro-perks",
      title: "ProPerks",
      description: "Exclusive deals",
      icon: <Gift className="h-6 w-6" />,
      color: "from-pink-500 to-pink-600",
      route: null,
      premium: true,
      group: "secondary",
      requiredTier: "pro",
      requiredMilestones: ["connectedReddit", "selectedCommunities", "createdFirstPost"]
    }
  ];

  // Filter cards based on onboarding progress and tier access
  const getVisibleCards = () => {
    return actionCards.filter(card => {
      // Check tier access
      if (!hasTierAccess(resolvedTier, card.requiredTier, isAdminUser)) {
        return false;
      }

      // Check milestone requirements
      if (card.requiredMilestones) {
        return card.requiredMilestones.every(milestone => onboardingProgress[milestone]);
      }

      return true;
    });
  };

  const visibleCards = getVisibleCards();
  const coreCards = visibleCards.filter(card => card.group === 'core');
  const growthCards = visibleCards.filter(card => card.group === 'growth');
  const secondaryCards = visibleCards.filter(card => card.group === 'secondary');

  const handleCardClick = (card: ActionCardConfig) => {
    // Complete milestone if applicable
    if (card.completeMilestone && !onboardingProgress[card.completeMilestone]) {
      const updatedProgress = {
        ...onboardingProgress,
        [card.completeMilestone]: true
      };
      setOnboardingProgress(updatedProgress);
      try {
        window.localStorage.setItem(MODERN_DASHBOARD_ONBOARDING_STORAGE_KEY, JSON.stringify(updatedProgress));
      } catch (error) {
        // Ignore localStorage errors
      }
    }

    if (card.route) {
      setLocation(card.route);
    } else if (card.comingSoon) {
      toast({
        title: "Coming Soon",
        description: `${card.title} feature is being developed.`,
      });
    } else if (card.premium && !isPremium) {
      toast({
        title: "Premium Feature",
        description: "Upgrade to Pro to access this feature.",
      });
    }
  };

  const handleQuickAction = () => {
    // Determine the appropriate starting step based on onboarding progress
    if (!onboardingProgress.connectedReddit) {
      setQuickStartStep('connect');
    } else if (!onboardingProgress.selectedCommunities) {
      setQuickStartStep('subreddit');
    } else {
      setQuickStartStep('copy');
    }
    setQuickStartOpen(true);
  };

  const handleConnectReddit = useCallback(async () => {
    try {
      const response = await apiRequest('GET', '/api/reddit/connect');
      const data = await response.json() as { authUrl?: string; message?: string };

      if (data?.authUrl) {
        window.open(data.authUrl, '_blank', 'noopener,noreferrer');
        toast({
          title: '🔗 Reddit Authorization',
          description: 'Complete the authorization in the popup window',
        });
        return;
      }

      const fallbackMessage = data?.message ?? 'Failed to get Reddit authorization link.';
      toast({
        title: '❌ Connection Failed',
        description: fallbackMessage,
        variant: 'destructive',
      });
    } catch (error) {
      const apiError = error as Partial<ApiError> & Error;
      const description = apiError.userMessage ?? apiError.message ?? 'Unable to connect to Reddit.';
      toast({
        title: '❌ Connection Failed',
        description,
        variant: 'destructive',
      });
    }
  }, [toast]);

  const handleCommandCenter = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleTaskFlow = () => {
    // Task flow always starts from the beginning for guided experience
    setQuickStartStep('connect');
    setQuickStartOpen(true);
  };

  const handleQuickStartConnected = () => {
    const updatedProgress = {
      ...onboardingProgress,
      connectedReddit: true
    };
    setOnboardingProgress(updatedProgress);
    try {
      window.localStorage.setItem(MODERN_DASHBOARD_ONBOARDING_STORAGE_KEY, JSON.stringify(updatedProgress));
    } catch (error) {
      // Ignore localStorage errors
    }
  };

  const handleQuickStartSelectedCommunity = () => {
    const updatedProgress = {
      ...onboardingProgress,
      selectedCommunities: true
    };
    setOnboardingProgress(updatedProgress);
    try {
      window.localStorage.setItem(MODERN_DASHBOARD_ONBOARDING_STORAGE_KEY, JSON.stringify(updatedProgress));
    } catch (error) {
      // Ignore localStorage errors
    }
  };

  const handleQuickStartPosted = () => {
    const updatedProgress = {
      ...onboardingProgress,
      createdFirstPost: true
    };
    setOnboardingProgress(updatedProgress);
    try {
      window.localStorage.setItem(MODERN_DASHBOARD_ONBOARDING_STORAGE_KEY, JSON.stringify(updatedProgress));
    } catch (error) {
      // Ignore localStorage errors
    }
  };

  // Get current onboarding stage for hero card
  const getCurrentStage = () => {
    if (!onboardingProgress.connectedReddit) {
      return 'connect-reddit';
    }
    if (!onboardingProgress.selectedCommunities) {
      return 'find-communities';
    }
    if (!onboardingProgress.createdFirstPost) {
      return 'first-post';
    }
    return 'advanced';
  };

  const currentStage = getCurrentStage();

  const renderHeroCard = () => {
    switch (currentStage) {
      case 'connect-reddit':
        return (
          <Card className="bg-gradient-to-r from-orange-500 to-red-500 border-0 mb-6">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                  <FaReddit className="h-7 w-7 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white mb-1">
                    Connect your Reddit account to sync communities
                  </h3>
                  <p className="text-white/80">
                    Link your Reddit account to get started with automated posting
                  </p>
                </div>
                <Button
                  onClick={handleConnectReddit}
                  className="bg-white text-orange-600 hover:bg-gray-100"
                  data-testid="button-connect-reddit-to-start"
                >
                  Connect Reddit to Start
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      case 'find-communities':
        return (
          <Card className="bg-gradient-to-r from-blue-500 to-purple-500 border-0 mb-6">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                  <Target className="h-7 w-7 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white mb-1">
                    Pick your top subreddits next
                  </h3>
                  <p className="text-white/80">
                    Choose the communities where you want to share your content
                  </p>
                </div>
                <Button
                  onClick={() => setLocation('/communities')}
                  className="bg-white text-blue-600 hover:bg-gray-100"
                >
                  Browse Communities
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      case 'first-post':
        return (
          <Card className="bg-gradient-to-r from-green-500 to-teal-500 border-0 mb-6">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                  <Upload className="h-7 w-7 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white mb-1">
                    Ship your first Reddit post
                  </h3>
                  <p className="text-white/80">
                    Create and publish your first post to get things rolling
                  </p>
                </div>
                <Button
                  onClick={() => setLocation('/reddit')}
                  className="bg-white text-green-600 hover:bg-gray-100"
                >
                  Create Post
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      case 'advanced':
        return (
          <Card className="bg-gradient-to-r from-purple-500 to-pink-500 border-0 mb-6">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center">
                  <CheckCircle2 className="h-7 w-7 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white mb-1">
                    You're ready for deeper automation
                  </h3>
                  <p className="text-white/80">
                    Explore advanced tools to scale your content creation
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge className="bg-white/20 text-white border-white/30">
                    {Object.values(onboardingProgress).filter(Boolean).length}/3 Complete
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      default:
        return null;
    }
  };


  return (
    <div className="min-h-screen bg-gradient-purple">
      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 h-full w-[280px] bg-gray-900 border-r border-gray-800 z-50 transform transition-transform duration-300",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
                <img 
                  src="/logo.png" 
                  alt="ThottoPilot" 
                  className="w-8 h-8 rounded-lg"
                />
              </div>
              <span className="text-xl font-bold text-purple-gradient">
                ThottoPilot
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(false)}
              className="text-gray-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation Items */}
          <nav className="space-y-2">
            <button 
              onClick={() => setLocation('/dashboard')}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-white hover:bg-purple-600/20 rounded-lg transition-all"
            >
              <Home className="h-5 w-5" />
              <span>Dashboard</span>
            </button>
            <button 
              onClick={() => setLocation('/reddit')}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-white hover:bg-purple-600/20 rounded-lg transition-all"
            >
              <FaReddit className="h-5 w-5" />
              <span>Reddit Hub</span>
              <Badge className="ml-auto" variant="secondary">NEW</Badge>
            </button>
            <button 
              onClick={() => setLocation('/caption-generator')}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-white hover:bg-purple-600/20 rounded-lg transition-all"
            >
              <Brain className="h-5 w-5" />
              <span>Content Creator</span>
            </button>
            <button 
              onClick={() => setLocation('/imageshield')}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-white hover:bg-purple-600/20 rounded-lg transition-all"
            >
              <Shield className="h-5 w-5" />
              <span>ImageShield</span>
            </button>
            <button 
              onClick={() => setLocation('/gallery')}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-white hover:bg-purple-600/20 rounded-lg transition-all"
            >
              <ImageIcon className="h-5 w-5" />
              <span>Media Gallery</span>
            </button>
            <button 
              onClick={() => setLocation('/communities')}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-white hover:bg-purple-600/20 rounded-lg transition-all"
            >
              <Users className="h-5 w-5" />
              <span>Communities</span>
            </button>
            <button 
              onClick={() => setLocation('/tax-tracker')}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-white hover:bg-purple-600/20 rounded-lg transition-all"
            >
              <Calculator className="h-5 w-5" />
              <span>Tax Tracker</span>
            </button>
            <button 
              onClick={() => setLocation('/history')}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-white hover:bg-purple-600/20 rounded-lg transition-all"
            >
              <History className="h-5 w-5" />
              <span>History</span>
            </button>
            <button 
              onClick={() => setLocation('/settings')}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-white hover:bg-purple-600/20 rounded-lg transition-all"
            >
              <Settings className="h-5 w-5" />
              <span>Settings</span>
            </button>
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <div className="p-6 md:p-8">
        {/* Header with Action Buttons */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
            <div className="flex gap-3">
              <Button
                onClick={handleQuickAction}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                <Zap className="h-4 w-4 mr-2" />
                Quick Action
              </Button>
              <Button
                onClick={handleCommandCenter}
                className="bg-gray-800 hover:bg-gray-700 text-white"
              >
                <Command className="h-4 w-4 mr-2" />
                Command Center
              </Button>
              <Button
                onClick={handleTaskFlow}
                className="bg-gray-800 hover:bg-gray-700 text-white"
              >
                <ListChecks className="h-4 w-4 mr-2" />
                Task Flow
              </Button>
            </div>
            <div className="flex gap-3">
              <ThemeToggle />
              <Button variant="ghost" size="icon" className="text-white">
                <Bell className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" className="text-white">
                <Settings className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">
            {getGreeting()}, {displayName}! 👋
          </h1>
          <p className="text-xl text-gray-300">
            {dashboardPrompt}
          </p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {statsCards.map((stat) => (
            <Card key={stat.label} className="bg-gray-800 border-gray-700">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className={stat.color}>{stat.icon}</span>
                  <span className="text-2xl font-bold text-white">{stat.value}</span>
                </div>
                <p className="text-gray-400 text-sm">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Hero Onboarding Card */}
        {renderHeroCard()}

        {/* Core Action Cards */}
        {coreCards.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">Getting Started</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {coreCards.map((card) => (
                <Card
                  key={card.id}
                  className={cn(
                    "bg-gray-800 border-gray-700 cursor-pointer transition-all hover:scale-105",
                    selectedCard === card.id && "ring-2 ring-purple-500"
                  )}
                  onClick={() => handleCardClick(card)}
                  onMouseEnter={() => setSelectedCard(card.id)}
                  onMouseLeave={() => setSelectedCard(null)}
                  data-testid={`card-${card.id}`}
                >
                  <CardContent className="p-6">
                    <div className={cn(
                      "w-12 h-12 rounded-lg bg-gradient-to-br flex items-center justify-center mb-4",
                      card.color
                    )}>
                      {card.icon}
                    </div>
                    <h3 className="text-white font-semibold mb-1">{card.title}</h3>
                    <p className="text-gray-400 text-sm">{card.description}</p>
                    {card.comingSoon && (
                      <Badge className="mt-2" variant="outline">Coming Soon</Badge>
                    )}
                    {card.premium && !isPremium && (
                      <Badge className="mt-2" variant="outline">Pro</Badge>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Growth Action Cards */}
        {growthCards.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-semibold text-white mb-4">Content Creation</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {growthCards.map((card) => (
                <Card
                  key={card.id}
                  className={cn(
                    "bg-gray-800 border-gray-700 cursor-pointer transition-all hover:scale-105",
                    selectedCard === card.id && "ring-2 ring-purple-500"
                  )}
                  onClick={() => handleCardClick(card)}
                  onMouseEnter={() => setSelectedCard(card.id)}
                  onMouseLeave={() => setSelectedCard(null)}
                  data-testid={`card-${card.id}`}
                >
                  <CardContent className="p-6">
                    <div className={cn(
                      "w-12 h-12 rounded-lg bg-gradient-to-br flex items-center justify-center mb-4",
                      card.color
                    )}>
                      {card.icon}
                    </div>
                    <h3 className="text-white font-semibold mb-1">{card.title}</h3>
                    <p className="text-gray-400 text-sm">{card.description}</p>
                    {card.comingSoon && (
                      <Badge className="mt-2" variant="outline">Coming Soon</Badge>
                    )}
                    {card.premium && !isPremium && (
                      <Badge className="mt-2" variant="outline">Pro</Badge>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Advanced Tools Expander */}
        {(secondaryCards.length > 0 || currentStage === 'advanced') && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">Advanced Tools</h2>
              <Button
                variant="ghost"
                onClick={() => setShowMoreTools(!showMoreTools)}
                className="text-gray-400 hover:text-white"
                data-testid={`button-${showMoreTools ? 'hide' : 'show'}-more-tools`}
              >
                {showMoreTools ? 'Hide Tools' : 'Show More Tools'}
                <ChevronRight className={cn("h-4 w-4 ml-2 transition-transform", showMoreTools && "rotate-90")} />
              </Button>
            </div>
            {showMoreTools && (
              <div>
                {hasTierAccess(resolvedTier, 'starter', isAdminUser) ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {secondaryCards.map((card) => (
                      <Card
                        key={card.id}
                        className={cn(
                          "bg-gray-800 border-gray-700 cursor-pointer transition-all hover:scale-105",
                          selectedCard === card.id && "ring-2 ring-purple-500"
                        )}
                        onClick={() => handleCardClick(card)}
                        onMouseEnter={() => setSelectedCard(card.id)}
                        onMouseLeave={() => setSelectedCard(null)}
                        data-testid={`card-${card.id}`}
                      >
                        <CardContent className="p-6">
                          <div className={cn(
                            "w-12 h-12 rounded-lg bg-gradient-to-br flex items-center justify-center mb-4",
                            card.color
                          )}>
                            {card.icon}
                          </div>
                          <h3 className="text-white font-semibold mb-1">{card.title}</h3>
                          <p className="text-gray-400 text-sm">{card.description}</p>
                          {card.comingSoon && (
                            <Badge className="mt-2" variant="outline">Coming Soon</Badge>
                          )}
                          {card.premium && !isPremium && (
                            <Badge className="mt-2" variant="outline">Pro</Badge>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                ) : (
                  <Card className="bg-gray-800 border-gray-700">
                    <CardContent className="p-6 text-center">
                      <div className="w-16 h-16 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-lg flex items-center justify-center mx-auto mb-4">
                        <Gift className="h-8 w-8 text-white" />
                      </div>
                      <h3 className="text-white font-semibold mb-2">Upgrade to Unlock</h3>
                      <p className="text-gray-400 text-sm mb-4">
                        Upgrade your plan to unlock analytics, takedown scanning, and finance workflows
                      </p>
                      <Button
                        onClick={() => {
                          toast({
                            title: "Upgrade Available",
                            description: "Contact support to upgrade your plan.",
                          });
                        }}
                        className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white"
                      >
                        Upgrade Plan
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        )}

        {/* Progress Pills */}
        {currentStage !== 'connect-reddit' && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-white mb-3">Your Progress</h3>
            <div className="flex gap-3 flex-wrap">
              <Badge
                className={cn(
                  "flex items-center gap-2 px-3 py-1",
                  onboardingProgress.connectedReddit
                    ? "bg-green-500/20 text-green-400 border-green-500/30"
                    : "bg-gray-500/20 text-gray-400 border-gray-500/30"
                )}
              >
                {onboardingProgress.connectedReddit ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Clock className="h-4 w-4" />
                )}
                Connect Reddit
              </Badge>
              <Badge
                className={cn(
                  "flex items-center gap-2 px-3 py-1",
                  onboardingProgress.selectedCommunities
                    ? "bg-green-500/20 text-green-400 border-green-500/30"
                    : "bg-gray-500/20 text-gray-400 border-gray-500/30"
                )}
              >
                {onboardingProgress.selectedCommunities ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Clock className="h-4 w-4" />
                )}
                Pick Communities
              </Badge>
              <Badge
                className={cn(
                  "flex items-center gap-2 px-3 py-1",
                  onboardingProgress.createdFirstPost
                    ? "bg-green-500/20 text-green-400 border-green-500/30"
                    : "bg-gray-500/20 text-gray-400 border-gray-500/30"
                )}
              >
                {onboardingProgress.createdFirstPost ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Clock className="h-4 w-4" />
                )}
                First Post
              </Badge>
            </div>
          </div>
        )}

        {/* Bottom Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Gallery */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Recent Gallery</CardTitle>
              <CardDescription className="text-gray-400">
                Your latest uploads
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activityLoading ? (
                <div className="grid grid-cols-4 gap-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="aspect-square bg-gray-700 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : showGalleryEmptyState ? (
                <div className="text-center py-8 text-gray-400">
                  <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No recent media</p>
                  <p className="text-sm">Upload some content to see it here</p>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {galleryItems.map((item) => (
                    <div
                      key={item.id}
                      className="aspect-square bg-gray-700 rounded-lg overflow-hidden"
                    >
                      <img
                        src={item.signedUrl ?? item.url}
                        alt={item.alt}
                        className="w-full h-full object-cover"
                        data-testid={`img-recent-media-${item.id}`}
                      />
                    </div>
                  ))}
                </div>
              )}
              <Button 
                className="w-full mt-4 bg-purple-600 hover:bg-purple-700"
                onClick={() => setLocation('/gallery')}
              >
                View All
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>

          {/* Scheduled Posts */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white">Scheduled Posts</CardTitle>
                <Badge className="bg-orange-500 text-white">2 PENDING</Badge>
              </div>
              <CardDescription className="text-gray-400">
                Upcoming content
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-purple-400" />
                    <div>
                      <p className="text-white text-sm font-medium">Morning Selfie</p>
                      <p className="text-gray-400 text-xs">r/SelfieWorld • In 2 hours</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-purple-400" />
                    <div>
                      <p className="text-white text-sm font-medium">Sunset Vibes</p>
                      <p className="text-gray-400 text-xs">r/FreeKarma4U • In 6 hours</p>
                    </div>
                  </div>
                </div>
              </div>
              <Button 
                className="w-full mt-4 bg-purple-600 hover:bg-purple-700"
                onClick={() => {
                  toast({
                    title: "Scheduler",
                    description: "Post scheduler coming soon!",
                  });
                }}
              >
                Manage Schedule
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Quick Start Modal */}
      <QuickStartModal
        open={quickStartOpen}
        onOpenChange={setQuickStartOpen}
        initialStep={quickStartStep}
        isRedditConnected={isRedditConnected}
        onNavigate={() => setLocation("/reddit")}
        onConnected={handleQuickStartConnected}
        onSelectedCommunity={handleQuickStartSelectedCommunity}
        onPosted={handleQuickStartPosted}
      />
    </div>
  );
}