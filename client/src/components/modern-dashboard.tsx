/**
 * ModernDashboard Presentational Component
 *
 * Responsibilities:
 * - Render the dashboard UI (cards, actions, activity, etc.)
 * - Receive minimal typed props from the page container (`pages/dashboard.tsx`)
 */
import React, { useState, useEffect, useCallback, useTransition } from "react";
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

interface RedditRateLimitPayload {
  limit: number;
  remaining: number;
  resetAt: string;
}

interface RedditRateLimitState {
  blocked: boolean;
  rateLimit: RedditRateLimitPayload | null;
  error?: string;
}

interface DashboardWorkspaceProps {
  commandBar: React.ReactNode;
  leftPane: React.ReactNode;
  rightPane: React.ReactNode;
}

interface RedditRiskApiResponse {
  success?: boolean;
  rateLimit?: RedditRateLimitPayload | null;
  error?: string;
}

function formatResetDuration(resetAt: string | null | undefined): string {
  if (!resetAt) {
    return 'Unknown';
  }

  const resetDate = new Date(resetAt);
  if (Number.isNaN(resetDate.getTime())) {
    return 'Unknown';
  }

  const diffMs = resetDate.getTime() - Date.now();

  if (diffMs <= 0) {
    return 'Ready';
  }

  const totalMinutes = Math.round(diffMs / 60000);
  if (totalMinutes <= 0) {
    return 'Under 1m';
  }

  if (totalMinutes < 60) {
    return `${totalMinutes}m`;
  }

  const totalHours = Math.floor(totalMinutes / 60);
  const remainingMinutes = totalMinutes % 60;

  if (totalHours < 24) {
    return remainingMinutes > 0 ? `${totalHours}h ${remainingMinutes}m` : `${totalHours}h`;
  }

  const totalDays = Math.floor(totalHours / 24);
  const remainingHours = totalHours % 24;

  return remainingHours > 0 ? `${totalDays}d ${remainingHours}h` : `${totalDays}d`;
}

function DashboardWorkspace({ commandBar, leftPane, rightPane }: DashboardWorkspaceProps) {
  return (
    <div className="mx-auto flex w-full max-w-[1400px] flex-col gap-6">
      <section className="rounded-3xl border border-white/5 bg-slate-900/70 p-6">
        {commandBar}
      </section>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(360px,420px)_1fr]">
        <div className="space-y-6">{leftPane}</div>
        <div className="space-y-6">{rightPane}</div>
      </div>
    </div>
  );
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

  const tierLabel = `${resolvedTier.charAt(0).toUpperCase()}${resolvedTier.slice(1)}`;

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

  const {
    data: rateLimitState,
    isLoading: rateLimitLoading,
  } = useQuery<RedditRateLimitState>({
    queryKey: ['/api/reddit/risk'],
    enabled: Boolean(resolvedUser?.id),
    refetchInterval: 60_000,
    staleTime: 30_000,
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', '/api/reddit/risk');
        const payload = (await response.json()) as RedditRiskApiResponse;

        if (!response.ok || payload.success === false) {
          const errorMessage = payload.error ?? `Unable to retrieve rate limit (${response.status})`;
          return {
            blocked: false,
            rateLimit: payload.rateLimit ?? null,
            error: errorMessage,
          };
        }

        const rateLimit = payload.rateLimit ?? null;

        return {
          blocked: Boolean(rateLimit && rateLimit.remaining <= 0),
          rateLimit,
        };
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error retrieving rate limit';
        return {
          blocked: false,
          rateLimit: null,
          error: message,
        };
      }
    },
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
          <Card className="border-0 bg-gradient-to-r from-orange-500 to-red-500">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/20">
                  <FaReddit className="h-7 w-7 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="mb-1 text-xl font-bold text-white">
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
          <Card className="border-0 bg-gradient-to-r from-blue-500 to-purple-500">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/20">
                  <Target className="h-7 w-7 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="mb-1 text-xl font-bold text-white">
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
          <Card className="border-0 bg-gradient-to-r from-green-500 to-teal-500">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/20">
                  <Upload className="h-7 w-7 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="mb-1 text-xl font-bold text-white">
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
          <Card className="border-0 bg-gradient-to-r from-purple-500 to-pink-500">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/20">
                  <CheckCircle2 className="h-7 w-7 text-white" />
                </div>
                <div className="flex-1">
                  <h3 className="mb-1 text-xl font-bold text-white">
                    You're ready for deeper automation
                  </h3>
                  <p className="text-slate-100/80">
                    Explore advanced tools to scale your content creation
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge className="border-white/30 bg-white/20 text-white">
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

  const rateLimit = rateLimitState?.rateLimit ?? null;
  const isCooldownBlocked = Boolean(rateLimitState?.blocked || (rateLimit && rateLimit.remaining <= 0));
  const isCooldownWarning = Boolean(
    !isCooldownBlocked &&
      rateLimit &&
      rateLimit.limit > 0 &&
      rateLimit.remaining / rateLimit.limit <= 0.2,
  );
  const isCooldownError = Boolean(rateLimitState?.error);

  const cooldownSummary = (() => {
    if (isCooldownError) {
      return 'Check settings';
    }
    if (!rateLimit) {
      return 'Ready';
    }
    if (isCooldownBlocked) {
      return `Reset in ${formatResetDuration(rateLimit.resetAt)}`;
    }
    return `${rateLimit.remaining}/${rateLimit.limit} left`;
  })();

  const cooldownBadgeClass = cn(
    'border text-sm font-semibold uppercase tracking-wide',
    isCooldownError
      ? 'border-slate-500/60 bg-slate-800/70 text-slate-200'
      : isCooldownBlocked
      ? 'border-red-400/50 bg-red-500/10 text-red-100'
      : isCooldownWarning
      ? 'border-amber-400/40 bg-amber-500/10 text-amber-100'
      : 'border-emerald-400/40 bg-emerald-500/10 text-emerald-100',
  );

  const commandBar = (
    <>
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold text-white md:text-5xl">
            {getGreeting()}, {displayName}! 👋
          </h1>
          <p className="text-lg text-slate-200 md:text-xl">{dashboardPrompt}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className="border-purple-400/40 bg-purple-500/10 text-sm font-semibold uppercase tracking-wide text-purple-100"
          >
            Tier · {tierLabel}
          </Badge>
          <Badge variant="outline" className={cooldownBadgeClass}>
            {rateLimitLoading ? (
              <>
                <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
                Checking cooldown…
              </>
            ) : (
              <>Cooldown · {cooldownSummary}</>
            )}
          </Badge>
        </div>
      </div>
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap gap-3">
          <Button
            onClick={handleQuickAction}
            className="bg-gradient-to-r from-purple-500 to-fuchsia-500 text-white shadow-lg shadow-purple-500/30 transition-colors hover:from-purple-500/90 hover:to-fuchsia-500/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            <Zap className="mr-2 h-4 w-4" />
            Quick Action
          </Button>
          <Button
            onClick={handleCommandCenter}
            className="border border-white/70 bg-white/90 text-slate-900 transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 dark:border-slate-700/70 dark:bg-slate-900/80 dark:text-slate-100 dark:hover:bg-slate-900"
          >
            <Command className="mr-2 h-4 w-4" />
            Command Center
          </Button>
          <Button
            onClick={handleTaskFlow}
            className="bg-slate-900/80 text-slate-100 transition-colors hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            <ListChecks className="mr-2 h-4 w-4" />
            Task Flow
          </Button>
        </div>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Button
            variant="ghost"
            size="icon"
            className="text-slate-200 transition-colors hover:bg-slate-900/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            <Bell className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-slate-200 transition-colors hover:bg-slate-900/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
          >
            <Settings className="h-5 w-5" />
          </Button>
        </div>
      </div>
    </>
  );

  const heroCard = renderHeroCard();

  const leftPane = (
    <>
      <ReferralWidget />
      {heroCard}
      {coreCards.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">Getting Started</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {coreCards.map((card) => (
              <Card
                key={card.id}
                className={cn(
                  'bg-slate-950/60 border-slate-800/60 backdrop-blur cursor-pointer transition-all hover:scale-105',
                  selectedCard === card.id && 'ring-2 ring-purple-500',
                )}
                onClick={() => handleCardClick(card)}
                onMouseEnter={() => setSelectedCard(card.id)}
                onMouseLeave={() => setSelectedCard(null)}
                data-testid={`card-${card.id}`}
              >
                <CardContent className="p-6">
                  <div
                    className={cn(
                      'mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br',
                      card.color,
                    )}
                  >
                    {card.icon}
                  </div>
                  <h3 className="mb-1 font-semibold text-white">{card.title}</h3>
                  <p className="text-sm text-slate-300">{card.description}</p>
                  {card.comingSoon && (
                    <Badge className="mt-2" variant="outline">
                      Coming Soon
                    </Badge>
                  )}
                  {card.premium && !isPremium && (
                    <Badge className="mt-2" variant="outline">
                      Pro
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
      {growthCards.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold text-white">Content Creation</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {growthCards.map((card) => (
              <Card
                key={card.id}
                className={cn(
                  'bg-slate-950/60 border-slate-800/60 backdrop-blur cursor-pointer transition-all hover:scale-105',
                  selectedCard === card.id && 'ring-2 ring-purple-500',
                )}
                onClick={() => handleCardClick(card)}
                onMouseEnter={() => setSelectedCard(card.id)}
                onMouseLeave={() => setSelectedCard(null)}
                data-testid={`card-${card.id}`}
              >
                <CardContent className="p-6">
                  <div
                    className={cn(
                      'mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br',
                      card.color,
                    )}
                  >
                    {card.icon}
                  </div>
                  <h3 className="mb-1 font-semibold text-white">{card.title}</h3>
                  <p className="text-sm text-slate-300">{card.description}</p>
                  {card.comingSoon && (
                    <Badge className="mt-2" variant="outline">
                      Coming Soon
                    </Badge>
                  )}
                  {card.premium && !isPremium && (
                    <Badge className="mt-2" variant="outline">
                      Pro
                    </Badge>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
      {(secondaryCards.length > 0 || currentStage === 'advanced') && (
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">Advanced Tools</h2>
            <Button
              variant="ghost"
              onClick={() => setShowMoreTools(!showMoreTools)}
              className="text-slate-300 hover:text-white"
              data-testid={`button-${showMoreTools ? 'hide' : 'show'}-more-tools`}
            >
              {showMoreTools ? 'Hide Tools' : 'Show More Tools'}
              <ChevronRight className={cn('ml-2 h-4 w-4 transition-transform', showMoreTools && 'rotate-90')} />
            </Button>
          </div>
          {showMoreTools && (
            <div>
              {hasTierAccess(resolvedTier, 'starter', isAdminUser) ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {secondaryCards.map((card) => (
                    <Card
                      key={card.id}
                      className={cn(
                        'bg-slate-950/60 border-slate-800/60 backdrop-blur cursor-pointer transition-all hover:scale-105',
                        selectedCard === card.id && 'ring-2 ring-purple-500',
                      )}
                      onClick={() => handleCardClick(card)}
                      onMouseEnter={() => setSelectedCard(card.id)}
                      onMouseLeave={() => setSelectedCard(null)}
                      data-testid={`card-${card.id}`}
                    >
                      <CardContent className="p-6">
                        <div
                          className={cn(
                            'mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br',
                            card.color,
                          )}
                        >
                          {card.icon}
                        </div>
                        <h3 className="mb-1 font-semibold text-white">{card.title}</h3>
                        <p className="text-sm text-slate-300">{card.description}</p>
                        {card.comingSoon && (
                          <Badge className="mt-2" variant="outline">
                            Coming Soon
                          </Badge>
                        )}
                        {card.premium && !isPremium && (
                          <Badge className="mt-2" variant="outline">
                            Pro
                          </Badge>
                        )}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="border-slate-800/60 bg-slate-950/60 backdrop-blur">
                  <CardContent className="p-6 text-center">
                    <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-lg bg-gradient-to-br from-yellow-500 to-orange-500">
                      <Gift className="h-8 w-8 text-white" />
                    </div>
                    <h3 className="mb-2 font-semibold text-white">Upgrade to Unlock</h3>
                    <p className="mb-4 text-sm text-slate-300">
                      Upgrade your plan to unlock analytics, takedown scanning, and finance workflows
                    </p>
                    <Button
                      onClick={() => {
                        toast({
                          title: 'Upgrade Available',
                          description: 'Contact support to upgrade your plan.',
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
      {currentStage !== 'connect-reddit' && (
        <section className="space-y-3">
          <h3 className="text-lg font-semibold text-white">Your Progress</h3>
          <div className="flex flex-wrap gap-3">
            <Badge
              className={cn(
                'flex items-center gap-2 px-3 py-1',
                onboardingProgress.connectedReddit
                  ? 'border-green-500/30 bg-green-500/20 text-green-400'
                  : 'border-slate-600/40 bg-slate-700/30 text-slate-300',
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
                'flex items-center gap-2 px-3 py-1',
                onboardingProgress.selectedCommunities
                  ? 'border-green-500/30 bg-green-500/20 text-green-400'
                  : 'border-slate-600/40 bg-slate-700/30 text-slate-300',
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
                'flex items-center gap-2 px-3 py-1',
                onboardingProgress.createdFirstPost
                  ? 'border-green-500/30 bg-green-500/20 text-green-400'
                  : 'border-slate-600/40 bg-slate-700/30 text-slate-300',
              )}
            >
              {onboardingProgress.createdFirstPost ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <Clock className="h-4 w-4" />
              )}
              Ship First Post
            </Badge>
          </div>
        </section>
      )}
    </>
  );

  const rightPane = (
    <>
      <section className="rounded-3xl border border-white/5 bg-slate-900/70 p-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {statsCards.map((stat) => (
            <Card key={stat.label} className="bg-slate-950/60 border-slate-800/60 backdrop-blur">
              <CardContent className="p-6">
                <div className="mb-2 flex items-center justify-between">
                  <span className={stat.color}>{stat.icon}</span>
                  <span className="text-2xl font-bold text-white">{stat.value}</span>
                </div>
                <p className="text-sm text-slate-300">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
      <Card className="border-slate-800/60 bg-slate-950/60 backdrop-blur">
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
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              <div className="h-72 lg:col-span-2">
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
                    <Area type="monotone" dataKey="uploads" stroke="#A855F7" fill="#A855F7" fillOpacity={0.25} name="uploads" />
                    <Area type="monotone" dataKey="successRate" stroke="#22D3EE" fill="#22D3EE" fillOpacity={0.2} name="successRate" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-4">
                <div className="rounded-lg border border-slate-800/60 bg-slate-900/80 p-4">
                  <p className="text-sm text-slate-300">Total uploads</p>
                  <p className="text-2xl font-bold text-white">{formatNumber(catboxTotalUploads)}</p>
                </div>
                <div className="rounded-lg border border-slate-800/60 bg-slate-900/80 p-4">
                  <p className="text-sm text-slate-300">Success rate</p>
                  <p className="text-2xl font-bold text-white">{formatPercentage(catboxStats.successRate)}</p>
                </div>
                <div className="rounded-lg border border-slate-800/60 bg-slate-900/80 p-4">
                  <p className="text-sm text-slate-300">Data moved</p>
                  <p className="text-2xl font-bold text-white">{formatBytes(catboxStats.totalSize)}</p>
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
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Card className="border-slate-800/60 bg-slate-950/60 backdrop-blur">
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
                  <div key={i} className="aspect-square rounded-lg border border-slate-800/60 bg-slate-900/70 animate-pulse" />
                ))}
              </div>
            ) : showGalleryEmptyState ? (
              <div className="py-8 text-center text-slate-300">
                <ImageIcon className="mx-auto mb-2 h-12 w-12 opacity-50" />
                <p>No recent media</p>
                <p className="text-sm">Upload some content to see it here</p>
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2">
                {galleryItems.map((item) => (
                  <div
                    key={item.id}
                    className="aspect-square overflow-hidden rounded-lg border border-slate-800/60 bg-slate-900/70"
                  >
                    <img
                      src={item.signedUrl ?? item.url}
                      alt={item.alt}
                      className="h-full w-full object-cover"
                      data-testid={`img-recent-media-${item.id}`}
                    />
                  </div>
                ))}
              </div>
            )}
            <Button
              className="mt-4 w-full bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-lg shadow-purple-500/30 transition-colors hover:from-purple-500/90 hover:to-indigo-500/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              onClick={() => setLocation('/gallery')}
            >
              View All
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
        <Card className="border-slate-800/60 bg-slate-950/60 backdrop-blur">
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
              <div className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-900/70 p-3">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-purple-400" />
                  <div>
                    <p className="text-sm font-medium text-white">Morning Selfie</p>
                    <p className="text-xs text-slate-300">r/SelfieWorld • In 2 hours</p>
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border border-slate-800/60 bg-slate-900/70 p-3">
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-purple-400" />
                  <div>
                    <p className="text-sm font-medium text-white">Sunset Vibes</p>
                    <p className="text-xs text-slate-300">r/FreeKarma4U • In 6 hours</p>
                  </div>
                </div>
              </div>
            </div>
            <Button
              className="mt-4 w-full bg-gradient-to-r from-purple-500 to-indigo-500 text-white shadow-lg shadow-purple-500/30 transition-colors hover:from-purple-500/90 hover:to-indigo-500/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-300 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              onClick={handleManageSchedule}
              disabled={isNavigatingToScheduler}
            >
              {isNavigatingToScheduler ? (
                <>
                  Opening Scheduler
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                </>
              ) : (
                <>
                  Manage Schedule
                  <ChevronRight className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </>
  );

  return (
    <div className="relative min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(168,85,247,0.28),transparent_55%),radial-gradient(circle_at_bottom_right,rgba(56,189,248,0.22),transparent_60%)]" />
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
          <nav className="space-y-2">
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
        </div>
      </aside>

      {/* Main Content */}
      <div className="relative z-10 p-6 md:p-8">
        <DashboardWorkspace commandBar={commandBar} leftPane={leftPane} rightPane={rightPane} />
      </div>

      {/* Quick Start Modal */}
      <QuickStartModal
        open={quickStartOpen}
        onOpenChange={setQuickStartOpen}
        initialStep={quickStartStep}
        isRedditConnected={isRedditConnected}
        onNavigate={() => setLocation('/reddit')}
        onConnected={handleQuickStartConnected}
        onSelectedCommunity={handleQuickStartSelectedCommunity}
        onPosted={handleQuickStartPosted}
      />
    </div>
  );
}
