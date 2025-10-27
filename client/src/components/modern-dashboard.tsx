/**
 * ModernDashboard Presentational Component
 *
 * Responsibilities:
 * - Render the dashboard UI (cards, actions, activity, etc.)
 * - Receive minimal typed props from the page container (`pages/dashboard.tsx`)
 */
import React, { useState, useEffect, useCallback, useTransition, useRef, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import {
  CheckCircle2,
  Shield,
  Sparkles,
  Target,
  Upload,
  BarChart3,
  Clock,
  Users,
  Calculator,
  Scale,
  Calendar,
  Zap,
  ImageIcon,
  ListChecks,
  Command,
  ChevronRight,
  X,
  Home,
  Brain,
  Settings,
  Bell,
  Gift,
  History as HistoryIcon,
  Loader2
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
import { ReferralWidget } from "@/components/ReferralWidget";
import { ResponsiveContainer, AreaChart, Area, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
import type { CatboxUploadStatsResponse } from '@shared/catbox-analytics';

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

function formatBytes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '0 B';
  }

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let remaining = value;
  let unitIndex = 0;

  while (remaining >= 1024 && unitIndex < units.length - 1) {
    remaining /= 1024;
    unitIndex += 1;
  }

  const precision = remaining % 1 === 0 ? 0 : 1;
  return `${remaining.toFixed(precision)} ${units[unitIndex]}`;
}

function formatDurationMs(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '0 ms';
  }

  if (value < 1000) {
    return `${Math.round(value)} ms`;
  }

  if (value < 60_000) {
    return `${(value / 1000).toFixed(1)} s`;
  }

  return `${(value / 60000).toFixed(1)} min`;
}

function formatChartDateLabel(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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
  } catch (_error) {
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
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const sidebarLinkClasses = 'w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-slate-100 transition-colors hover:bg-slate-800/70 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950';
  const [showMoreTools, setShowMoreTools] = useState(false);
  const [onboardingProgress, setOnboardingProgress] = useState<OnboardingProgress>(() => readStoredProgress());
  const [quickStartOpen, setQuickStartOpen] = useState(false);
  const [quickStartStep, setQuickStartStep] = useState<'connect' | 'subreddit' | 'copy' | 'confirm'>('connect');
  const chartContainerRef = useRef<HTMLDivElement | null>(null);
  const [shouldRenderCharts, setShouldRenderCharts] = useState(false);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { user: authUser } = useAuth();
  const [isNavigatingToScheduler, startSchedulerNavigation] = useTransition();
  
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

  const {
    data: catboxStats,
    isLoading: catboxStatsLoading,
    error: catboxStatsError,
  } = useQuery<CatboxUploadStatsResponse>({
    queryKey: ['/api/catbox/stats'],
    enabled: Boolean(resolvedUser?.id),
  });

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (shouldRenderCharts) {
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          setShouldRenderCharts(true);
          observer.disconnect();
        }
      });
    }, { rootMargin: '200px 0px 200px 0px' });

    const target = chartContainerRef.current;
    if (target) {
      observer.observe(target);
    }

    return () => {
      observer.disconnect();
    };
  }, [shouldRenderCharts]);

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
      } catch (_error) {
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
  
  useEffect(() => {
    if (catboxStatsError instanceof Error) {
      toast({
        title: "Unable to load Catbox insights",
        description: catboxStatsError.message,
      });
    }
  }, [catboxStatsError, toast]);
  
  // Get current time greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  const statsLoadingWithoutData = statsLoading && !statsData;
  const statsUnavailable = (!statsLoading && !statsData && statsError instanceof Error) || statsLoadingWithoutData;
  const statsSummary = {
    postsToday: statsData?.postsToday ?? 0,
    engagementRate: statsData?.engagementRate ?? 0,
    takedownsFound: statsData?.takedownsFound ?? 0,
    estimatedTaxSavings: statsData?.estimatedTaxSavings ?? 0,
  } satisfies DashboardStatsResponse;

  const catboxTotalUploads = catboxStats?.totalUploads ?? 0;
  const catboxSuccessfulUploads = catboxStats?.successfulUploads ?? 0;
  const catboxFailedUploads = catboxStats?.failedUploads ?? 0;
  const catboxChartData = (catboxStats?.uploadsByDay ?? []).map(point => ({
    ...point,
    dateLabel: formatChartDateLabel(point.date),
  }));
  const catboxRecentUploads = catboxStats?.recentUploads ?? [];

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
      route: "/reddit/communities",
      group: "core",
      requiredMilestones: ["connectedReddit"],
      completeMilestone: "selectedCommunities"
    },
    {
      id: "quick-post",
      title: "Quick Post",
      description: "One-click post to Reddit",
      icon: <Zap className="h-6 w-6" />,
      color: "from-yellow-500 to-orange-500",
      route: "/quick-post",
      group: "core",
      requiredMilestones: ["connectedReddit"],
      completeMilestone: "createdFirstPost"
    },
    {
      id: "schedule-posts",
      title: "Schedule Posts",
      description: "Plan your content calendar",
      icon: <Calendar className="h-6 w-6" />,
      color: "from-purple-500 to-purple-600",
      route: "/post-scheduling",
      group: "core",
      requiredMilestones: ["connectedReddit", "selectedCommunities"]
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

  const workflowBuckets = useMemo(() => ([
    { id: 'core', label: 'Getting Started', navLabel: 'Getting started workflows', cards: coreCards },
    { id: 'growth', label: 'Content Creation', navLabel: 'Content creation workflows', cards: growthCards },
    { id: 'secondary', label: 'Advanced Tools', navLabel: 'Advanced tools workflows', cards: secondaryCards },
  ] as Array<{ id: 'core' | 'growth' | 'secondary'; label: string; navLabel: string; cards: ActionCardConfig[] }>).filter((bucket) => bucket.cards.length > 0), [coreCards, growthCards, secondaryCards]);

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
      } catch (_error) {
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

    setSidebarOpen(false);
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
      const response = await apiRequest('GET', '/api/reddit/connect?intent=posting&queue=modern-dashboard');
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
    } catch (_error) {
      const apiError = _error as Partial<ApiError> & Error;
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
    } catch (_error) {
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
    } catch (_error) {
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
    } catch (_error) {
      // Ignore localStorage errors
    }
  };

  const handleManageSchedule = () => {
    startSchedulerNavigation(() => {
      setLocation('/enterprise?tab=scheduler');
    });
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
                  <p className="text-slate-100/80">
                    Link your Reddit account to get started with automated posting
                  </p>
                </div>
                <Button
                  onClick={handleConnectReddit}
                  className="bg-white text-orange-600 hover:bg-white/90"
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
                  <p className="text-slate-100/80">
                    Choose the communities where you want to share your content
                  </p>
                </div>
                <Button
                  onClick={() => setLocation('/reddit/communities')}
                  className="bg-white text-blue-600 hover:bg-white/90"
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
                  <p className="text-slate-100/80">
                    Create and publish your first post to get things rolling
                  </p>
                </div>
                <Button
                  onClick={() => setLocation('/reddit')}
                  className="bg-white text-green-600 hover:bg-white/90"
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
                  <p className="text-slate-100/80">
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
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.28),transparent_55%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.22),transparent_60%)]" />
      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50"
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
          role="presentation"
        />
      )}

      {/* Sidebar */}
      <aside
        id="dashboard-primary-navigation"
        aria-label="Dashboard navigation"
        aria-hidden={!sidebarOpen}
        className={cn(
          "fixed left-0 top-0 h-full w-[280px] border-r border-slate-800/60 bg-slate-950/90 backdrop-blur-xl z-50 transform transition-transform duration-300",
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
              className="text-slate-400 transition-colors hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation Items */}
          <nav aria-label="Primary navigation" className="space-y-2">
            <button 
              onClick={() => setLocation('/dashboard')}
              className={sidebarLinkClasses}
            >
              <Home className="h-5 w-5" />
              <span>Dashboard</span>
            </button>
            <button 
              onClick={() => setLocation('/reddit')}
              className={sidebarLinkClasses}
            >
              <FaReddit className="h-5 w-5" />
              <span>Reddit Hub</span>
              <Badge className="ml-auto border border-purple-400/30 bg-purple-500/20 text-purple-100" variant="secondary">NEW</Badge>
            </button>
            <button 
              onClick={() => setLocation('/caption-generator')}
              className={sidebarLinkClasses}
            >
              <Brain className="h-5 w-5" />
              <span>Content Creator</span>
            </button>
            <button 
              onClick={() => setLocation('/imageshield')}
              className={sidebarLinkClasses}
            >
              <Shield className="h-5 w-5" />
              <span>ImageShield</span>
            </button>
            <button 
              onClick={() => setLocation('/gallery')}
              className={sidebarLinkClasses}
            >
              <ImageIcon className="h-5 w-5" />
              <span>Media Gallery</span>
            </button>
            <button 
              onClick={() => setLocation('/reddit/communities')}
              className={sidebarLinkClasses}
            >
              <Users className="h-5 w-5" />
              <span>Communities</span>
            </button>
            <button 
              onClick={() => setLocation('/tax-tracker')}
              className={sidebarLinkClasses}
            >
              <Calculator className="h-5 w-5" />
              <span>Tax Tracker</span>
            </button>
            <button 
              onClick={() => setLocation('/history')}
              className={sidebarLinkClasses}
            >
              <HistoryIcon className="h-5 w-5" />
              <span>History</span>
            </button>
            <button 
              onClick={() => setLocation('/settings')}
              className={sidebarLinkClasses}
            >
              <Settings className="h-5 w-5" />
              <span>Settings</span>
            </button>
          </nav>

          {workflowBuckets.length > 0 && (
            <div className="mt-10 space-y-4" data-testid="workflow-buckets-container">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Workflow buckets</p>
              <nav
                aria-label="Workflow buckets"
                data-testid="workflow-buckets-nav"
                className="space-y-3"
              >
                {workflowBuckets.map((bucket) => (
                  <div key={bucket.id} data-testid={`workflow-bucket-${bucket.id}`} className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">{bucket.label}</p>
                    <ul className="space-y-1">
                      {bucket.cards.map((card) => (
                        <li key={card.id}>
                          <button
                            type="button"
                            onClick={() => handleCardClick(card)}
                            className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-200 transition-colors hover:bg-slate-800/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                            data-testid={`workflow-link-${card.id}`}
                          >
                            <span className="flex items-center justify-between gap-2">
                              <span>{card.title}</span>
                              <span className="text-xs font-medium text-slate-400">
                                {card.comingSoon ? 'Soon' : card.premium && !isPremium ? 'Pro' : ''}
                              </span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </nav>
            </div>
          )}

        </div>
      </aside>

      {/* Main Content */}
      <main aria-labelledby="dashboard-heading" className="relative z-10 p-6 md:p-8">
        {/* Header with Action Buttons */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
            <div className="flex gap-3">
              <Button
                onClick={handleQuickAction}
                className="bg-gradient-to-r from-purple-500 to-fuchsia-500 text-white shadow-lg shadow-purple-500/30 transition-colors hover:from-purple-500/90 hover:to-fuchsia-500/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                <Zap className="h-4 w-4 mr-2" />
                Quick Action
              </Button>
              <Button
                onClick={handleCommandCenter}
                aria-expanded={sidebarOpen}
                aria-controls="dashboard-primary-navigation"
                data-testid="button-command-center"
                className="border border-white/70 bg-white/90 text-slate-900 transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 dark:border-slate-700/70 dark:bg-slate-900/80 dark:text-slate-100 dark:hover:bg-slate-900"
              >
                <Command className="h-4 w-4 mr-2" />
                Command Center
              </Button>
              <Button
                onClick={handleTaskFlow}
                className="bg-slate-900/80 text-slate-100 transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                <ListChecks className="h-4 w-4 mr-2" />
                Task Flow
              </Button>
            </div>
            <div className="flex gap-3">
              <ThemeToggle />
              <Button variant="ghost" size="icon" className="text-slate-200 transition-colors hover:bg-slate-900/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950">
                <Bell className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" className="text-slate-200 transition-colors hover:bg-slate-900/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950">
                <Settings className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Welcome Section */}
        <div className="mb-8">
          <h1 id="dashboard-heading" className="text-4xl md:text-5xl font-bold text-white mb-2">
            {getGreeting()}, {displayName}! 👋
          </h1>
          <p className="text-xl text-slate-200">
            {dashboardPrompt}
          </p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {statsCards.map((stat) => (
            <Card key={stat.label} className="bg-slate-950/60 border-slate-800/60 backdrop-blur">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className={stat.color}>{stat.icon}</span>
                  <span className="text-2xl font-bold text-white">{stat.value}</span>
                </div>
                <p className="text-slate-300 text-sm">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Catbox Analytics */}
        <Card className="bg-slate-950/60 border-slate-800/60 backdrop-blur mb-8">
          <CardHeader>
            <CardTitle className="text-white">Catbox Upload Insights</CardTitle>
            <CardDescription className="text-slate-300">
              Track your recent upload volume and performance
            </CardDescription>
          </CardHeader>
          <CardContent>
            {catboxStatsLoading ? (
              <div className="h-48 w-full animate-pulse rounded-lg bg-slate-900/70" />
            ) : catboxStats && catboxStats.totalUploads > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div
                  className="lg:col-span-2 h-72"
                  ref={chartContainerRef}
                  data-testid="catbox-chart-container"
                  aria-live="polite"
                >
                  {shouldRenderCharts ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={catboxChartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="dateLabel" stroke="#9CA3AF" />
                      <YAxis stroke="#9CA3AF" allowDecimals={false} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#1F2937',
                          border: '1px solid #4B5563',
                          borderRadius: '8px',
                          color: '#F9FAFB',
                        }}
                        formatter={(value: number, name: string) => {
                          if (name === 'uploads') {
                            return [value, 'Uploads'];
                          }
                          if (name === 'totalSize') {
                            return [formatBytes(value as number), 'Data'];
                          }
                          if (name === 'successRate') {
                            return [`${(value as number).toFixed(1)}%`, 'Success'];
                          }
                          return [value, name];
                        }}
                      />
                      <Area
                        type="monotone"
                        dataKey="uploads"
                        stroke="#A855F7"
                        fill="#A855F7"
                        fillOpacity={0.25}
                        name="uploads"
                      />
                      <Area
                        type="monotone"
                        dataKey="totalSize"
                        stroke="#38BDF8"
                        fill="#38BDF8"
                        fillOpacity={0.15}
                        name="totalSize"
                      />
                      <Area
                        type="monotone"
                        dataKey="successRate"
                        stroke="#F97316"
                        fill="#F97316"
                        fillOpacity={0}
                        name="successRate"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                  ) : (
                    <div className="flex h-full items-center justify-center rounded-lg border border-slate-800/60 bg-slate-900/70 text-sm text-slate-400">
                      Chart loads when in view
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div>
                      <p className="text-sm text-slate-300">Total attempts</p>
                      <p className="text-lg font-semibold text-white">
                        {formatNumber(catboxTotalUploads)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-300">Successful uploads</p>
                      <p className="text-lg font-semibold text-white">
                        {formatNumber(catboxSuccessfulUploads)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-300">Failed attempts</p>
                      <p className="text-lg font-semibold text-white">
                        {formatNumber(catboxFailedUploads)}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-300">Success rate</p>
                      <p className="text-lg font-semibold text-white">
                        {(catboxStats?.successRate ?? 0).toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-300">Active streak</p>
                      <p className="text-lg font-semibold text-white">
                        {catboxStats?.streakDays ?? 0} {catboxStats && catboxStats.streakDays === 1 ? 'day' : 'days'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-slate-300">Average upload time</p>
                      <p className="text-lg font-semibold text-white">
                        {formatDurationMs(catboxStats?.averageDuration ?? 0)}
                      </p>
                    </div>
                    <div className="md:col-span-2 lg:col-span-3">
                      <p className="text-sm text-slate-300">Data transferred</p>
                      <p className="text-lg font-semibold text-white">
                        {formatBytes(catboxStats?.totalSize ?? 0)}
                      </p>
                    </div>
                  </div>
                  <div>
                    <p className="mb-2 text-sm font-semibold text-slate-200">Recent uploads</p>
                    <div className="space-y-2">
                      {catboxRecentUploads.slice(0, 3).map((upload) => (
                        <div key={upload.id} className="flex items-center justify-between rounded-md bg-slate-900/70 px-3 py-2">
                          <div className="mr-3 min-w-0">
                            <p className="truncate text-sm text-slate-100">
                              {upload.filename ?? upload.url}
                            </p>
                            <p className="text-xs text-slate-300">
                              {upload.fileSize ? formatBytes(upload.fileSize) : 'Size unknown'}
                            </p>
                          </div>
                          <div className="text-right text-xs text-slate-300">
                            {upload.uploadedAt ? formatChartDateLabel(upload.uploadedAt) : '—'}
                          </div>
                        </div>
                      ))}
                      {catboxStats.recentUploads.length === 0 && (
                        <p className="text-sm text-slate-300">Uploads will appear here after your next Catbox transfer.</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-start gap-4 rounded-lg border border-dashed border-slate-800/60 bg-slate-950/70 p-6">
                <div>
                  <h4 className="text-lg font-semibold text-white">Start tracking your Catbox uploads</h4>
                  <p className="text-sm text-slate-300">
                    Upload media through ThottoPilot to unlock analytics and performance trends.
                  </p>
                </div>
                <Button
                  className="bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-lg shadow-purple-500/30 transition-colors hover:from-purple-500/90 hover:to-indigo-500/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                  onClick={() => setLocation('/settings')}
                >
                  Configure Catbox
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Referral Widget - Prominent placement for all users */}
        <div className="mb-8">
          <ReferralWidget />
        </div>

        {/* Hero Onboarding Card */}
        {renderHeroCard()}

        {/* Core Action Cards */}
        {coreCards.length > 0 && (
          <section aria-labelledby="workflow-core-heading" className="mb-8">
            <h2 id="workflow-core-heading" className="text-xl font-semibold text-white mb-4">Getting Started</h2>
            <nav aria-labelledby="workflow-core-heading" data-testid="workflow-nav-core">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {coreCards.map((card) => (
                  <Card
                    key={card.id}
                    className={cn(
                      "bg-slate-950/60 border-slate-800/60 backdrop-blur cursor-pointer transition-all hover:scale-105",
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
                      <p className="text-slate-300 text-sm">{card.description}</p>
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
            </nav>
          </section>
        )}

        {/* Growth Action Cards */}
        {growthCards.length > 0 && (
          <section aria-labelledby="workflow-growth-heading" className="mb-8">
            <h2 id="workflow-growth-heading" className="text-xl font-semibold text-white mb-4">Content Creation</h2>
            <nav aria-labelledby="workflow-growth-heading" data-testid="workflow-nav-growth">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {growthCards.map((card) => (
                  <Card
                    key={card.id}
                    className={cn(
                      "bg-slate-950/60 border-slate-800/60 backdrop-blur cursor-pointer transition-all hover:scale-105",
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
                      <p className="text-slate-300 text-sm">{card.description}</p>
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
            </nav>
          </section>
        )}

        {/* Advanced Tools Expander */}
        {(secondaryCards.length > 0 || currentStage === 'advanced') && (
          <section aria-labelledby="workflow-secondary-heading" className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 id="workflow-secondary-heading" className="text-xl font-semibold text-white">Advanced Tools</h2>
              <Button
                variant="ghost"
                onClick={() => setShowMoreTools(!showMoreTools)}
                className="text-slate-300 hover:text-white"
                data-testid={`button-${showMoreTools ? 'hide' : 'show'}-more-tools`}
              >
                {showMoreTools ? 'Hide Tools' : 'Show More Tools'}
                <ChevronRight className={cn("h-4 w-4 ml-2 transition-transform", showMoreTools && "rotate-90")} />
              </Button>
            </div>
            {showMoreTools && (
              <div>
                {hasTierAccess(resolvedTier, 'starter', isAdminUser) ? (
                  <nav aria-labelledby="workflow-secondary-heading" data-testid="workflow-nav-secondary">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {secondaryCards.map((card) => (
                        <Card
                          key={card.id}
                          className={cn(
                            "bg-slate-950/60 border-slate-800/60 backdrop-blur cursor-pointer transition-all hover:scale-105",
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
                            <p className="text-slate-300 text-sm">{card.description}</p>
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
                  </nav>
                ) : (
                  <Card className="bg-slate-950/60 border-slate-800/60 backdrop-blur">
                    <CardContent className="p-6 text-center">
                      <div className="w-16 h-16 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-lg flex items-center justify-center mx-auto mb-4">
                        <Gift className="h-8 w-8 text-white" />
                      </div>
                      <h3 className="text-white font-semibold mb-2">Upgrade to Unlock</h3>
                      <p className="text-slate-300 text-sm mb-4">
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
          </section>
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
                    : "bg-slate-700/30 text-slate-300 border-slate-600/40"
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
                    : "bg-slate-700/30 text-slate-300 border-slate-600/40"
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
                    : "bg-slate-700/30 text-slate-300 border-slate-600/40"
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
          <Card className="bg-slate-950/60 border-slate-800/60 backdrop-blur">
            <CardHeader>
              <CardTitle className="text-white">Recent Gallery</CardTitle>
              <CardDescription className="text-slate-300">
                Your latest uploads
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activityLoading ? (
                <div className="grid grid-cols-4 gap-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="aspect-square bg-slate-900/70 rounded-lg border border-slate-800/60 animate-pulse" />
                  ))}
                </div>
              ) : showGalleryEmptyState ? (
                <div className="text-center py-8 text-slate-300">
                  <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No recent media</p>
                  <p className="text-sm">Upload some content to see it here</p>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {galleryItems.map((item) => (
                    <div
                      key={item.id}
                      className="aspect-square bg-slate-900/70 rounded-lg border border-slate-800/60 overflow-hidden"
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
                className="w-full mt-4 bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-lg shadow-purple-500/30 transition-colors hover:from-purple-500/90 hover:to-indigo-500/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                onClick={() => setLocation('/gallery')}
              >
                View All
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>

          {/* Scheduled Posts */}
          <Card className="bg-slate-950/60 border-slate-800/60 backdrop-blur">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white">Scheduled Posts</CardTitle>
                <Badge className="bg-orange-500 text-white">2 PENDING</Badge>
              </div>
              <CardDescription className="text-slate-300">
                Upcoming content
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-slate-900/70 rounded-lg border border-slate-800/60">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-purple-400" />
                    <div>
                      <p className="text-white text-sm font-medium">Morning Selfie</p>
                      <p className="text-slate-300 text-xs">r/SelfieWorld • In 2 hours</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-slate-900/70 rounded-lg border border-slate-800/60">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-purple-400" />
                    <div>
                      <p className="text-white text-sm font-medium">Sunset Vibes</p>
                      <p className="text-slate-300 text-xs">r/FreeKarma4U • In 6 hours</p>
                    </div>
                  </div>
                </div>
              </div>
              <Button
                className="w-full mt-4 bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-lg shadow-purple-500/30 transition-colors hover:from-purple-500/90 hover:to-indigo-500/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                onClick={handleManageSchedule}
                disabled={isNavigatingToScheduler}
              >
                {isNavigatingToScheduler ? (
                  <>
                    Opening Scheduler
                    <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                  </>
                ) : (
                  <>
                    Manage Schedule
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>

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