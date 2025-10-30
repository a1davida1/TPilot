import React, { useState, useMemo } from 'react';
import { useLocation } from 'wouter';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { 
  Sparkles, 
  Upload, 
  Shield, 
  Calendar,
  Clock,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  TrendingUp,
  Image,
  Eye,
  Heart,
  HelpCircle,
  Crown,
  Rocket,
  Bot,
  type LucideIcon
} from 'lucide-react';
import { FaReddit } from 'react-icons/fa';

// UI Components
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ActivitySkeleton } from '@/components/ui/loading-states';

// Custom Components
import { CommandBar } from '@/components/ui/status-banner';
import { StatusBannerContainer, useStatusBanners } from '@/components/ui/status-banner-container';
import { FloatingActionButton } from '@/components/ui/floating-action-button';
import { StickyRail } from '@/components/ui/sticky-rail';
import { BatchActionsBar, useBatchSelection, BatchCheckbox } from '@/components/ui/batch-actions-bar';
import { QuickStartModal } from '@/components/dashboard-quick-start';
import { useDashboardStats, useRecentActivity } from '@/hooks/useDashboardStats';
import { cn } from '@/lib/utils';

// Types
interface DashboardUser {
  id: number;
  username: string;
  email?: string;
  tier?: 'free' | 'starter' | 'pro' | 'premium' | 'admin';
  isAdmin?: boolean;
  role?: string;
  redditUsername?: string;
}

// DashboardStats is now imported from @/hooks/useDashboardStats

interface ActivityItem {
  id: string;
  type: 'post' | 'caption' | 'upload' | 'schedule';
  title: string;
  description?: string;
  timestamp: Date;
  subreddit?: string;
  imageUrl?: string;
  metrics?: {
    views?: number;
    likes?: number;
    comments?: number;
    shares?: number;
  };
}

interface OnboardingProgress {
  redditConnected: boolean;
  firstPostCreated: boolean;
  profileCompleted: boolean;
}

// Quick Action Cards
interface QuickActionCard {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  href: string;
  color: string;
  proOnly?: boolean;
  badge?: string;
}

const quickActionCards: QuickActionCard[] = [
  {
    id: 'quick-post',
    title: 'Quick Post',
    description: 'Create a single Reddit post',
    icon: Sparkles,
    href: '/quick-post',
    color: 'bg-gradient-to-br from-purple-500 to-pink-500',
    badge: 'Popular',
  },
  {
    id: 'bulk-caption',
    title: 'Bulk Caption',
    description: 'Generate captions for multiple images',
    icon: Upload,
    href: '/bulk-caption',
    color: 'bg-gradient-to-br from-blue-500 to-cyan-500',
    proOnly: true,
  },
  {
    id: 'image-shield',
    title: 'ImageShield',
    description: 'Protect your content with watermarks',
    icon: Shield,
    href: '/imageshield',
    color: 'bg-gradient-to-br from-green-500 to-emerald-500',
  },
  {
    id: 'schedule',
    title: 'Schedule Posts',
    description: 'Plan your content calendar',
    icon: Calendar,
    href: '/post-scheduling',
    color: 'bg-gradient-to-br from-orange-500 to-red-500',
    proOnly: true,
  },
];

// Stat Cards
interface StatCard {
  label: string;
  value: string | number;
  change?: number;
  trend?: 'up' | 'down' | 'neutral';
  icon: LucideIcon;
}

// Main Dashboard Component
interface ModernDashboardV2Props {
  user?: DashboardUser | null;
  userTier?: 'free' | 'starter' | 'pro' | 'premium' | 'admin';
  isAdmin?: boolean;
  isRedditConnected?: boolean;
}

export function ModernDashboardV2({ 
  user: propUser,
  userTier = 'free',
  isAdmin: _isAdmin = false,
  isRedditConnected = false 
}: ModernDashboardV2Props) {
  const { user: authUser } = useAuth();
  const user = propUser || authUser;
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  
  // Status banners hook
  const {
    createTierLimitBanner,
    createCooldownBanner,
  } = useStatusBanners();
  
  // State
  const [showQuickStart, setShowQuickStart] = useState(false);
  const [selectedTab, setSelectedTab] = useState('overview');
  const [onboardingProgress, _setOnboardingProgress] = useState<OnboardingProgress>({
    redditConnected: isRedditConnected,
    firstPostCreated: false,
    profileCompleted: false,
  });

  // Batch selection for activity items
  const {
    selectedItems: _selectedItems,
    selectedCount,
    isSelected,
    toggleSelection,
    clearSelection,
  } = useBatchSelection<ActivityItem>();

  // Fetch dashboard stats - using custom hooks with proper API integration
  const { data: stats, isLoading: _statsLoading } = useDashboardStats();
  const { data: recentActivity, isLoading: activityLoading } = useRecentActivity();
  
  // Map RecentActivity to ActivityItem (component expects more fields than API returns)
  const mappedActivity: ActivityItem[] = (recentActivity?.map(item => ({
    id: item.id,
    type: 'post' as const, // Simplify - backend returns different types
    title: item.title,
    description: item.description,
    timestamp: new Date(item.timestamp),
    // Optional fields that backend may not provide
    imageUrl: undefined,
    metrics: undefined,
  })) || []) as ActivityItem[];
  
  // Fetch caption usage
  const { data: captionUsage } = useQuery<{ used: number; limit: number; remaining: number }>({
    queryKey: ['/api/generations/stats'],
    enabled: Boolean(user?.id),
  });

  // Calculate onboarding stage
  const onboardingStage = useMemo(() => {
    if (!onboardingProgress.redditConnected) return 'connect-reddit';
    if (!onboardingProgress.firstPostCreated) return 'first-post';
    if (!onboardingProgress.profileCompleted) return 'complete-profile';
    return 'advanced';
  }, [onboardingProgress]);

  const onboardingPercentage = useMemo(() => {
    const steps = [
      onboardingProgress.redditConnected,
      onboardingProgress.firstPostCreated,
      onboardingProgress.profileCompleted,
    ];
    return (steps.filter(Boolean).length / steps.length) * 100;
  }, [onboardingProgress]);

  // Handlers
  const handleQuickAction = (action: QuickActionCard) => {
    if (action.proOnly && userTier === 'free') {
      toast({
        title: 'Pro Feature',
        description: 'Upgrade to Pro to access this feature.',
        action: (
          <Button
            size="sm"
            onClick={() => setLocation('/settings#billing')}
          >
            Upgrade
          </Button>
        ),
      });
      return;
    }
    setLocation(action.href);
  };

  const handleUpgrade = () => {
    setLocation('/settings#billing');
  };

  const handleConnectReddit = () => {
    setLocation('/settings#connections');
  };

  // Render onboarding card based on stage
  const renderOnboardingCard = () => {
    switch (onboardingStage) {
      case 'connect-reddit':
        return (
          <Card className="border-orange-500/20 bg-gradient-to-r from-orange-500/10 to-red-500/10">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/20">
                  <FaReddit className="h-7 w-7 text-orange-500" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold">Connect your Reddit account</h3>
                  <p className="text-sm text-muted-foreground">
                    Sync your communities and start posting
                  </p>
                </div>
                <Button onClick={handleConnectReddit} className="bg-orange-500 hover:bg-orange-600">
                  Connect Reddit
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      
      case 'first-post':
        return (
          <Card className="border-green-500/20 bg-gradient-to-r from-green-500/10 to-teal-500/10">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/20">
                  <Upload className="h-7 w-7 text-green-500" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold">Create your first post</h3>
                  <p className="text-sm text-muted-foreground">
                    Upload an image and generate AI captions
                  </p>
                </div>
                <Button onClick={() => setShowQuickStart(true)} className="bg-green-500 hover:bg-green-600">
                  Create Post
                </Button>
              </div>
            </CardContent>
          </Card>
        );

      case 'advanced':
        return (
          <Card className="border-purple-500/20 bg-gradient-to-r from-purple-500/10 to-pink-500/10">
            <CardContent className="p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-white/20">
                  <CheckCircle2 className="h-7 w-7 text-purple-500" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold">You're all set!</h3>
                  <p className="text-sm text-muted-foreground">
                    Explore advanced features to grow your audience
                  </p>
                </div>
                <Badge className="bg-purple-500/20 text-purple-700 dark:text-purple-300">
                  {onboardingPercentage}% Complete
                </Badge>
              </div>
            </CardContent>
          </Card>
        );

      default:
        return null;
    }
  };

  // Stat cards data
  const statCards: StatCard[] = [
    {
      label: 'Posts Today',
      value: stats?.postsToday ?? 0,
      change: 23,
      trend: 'up',
      icon: Upload,
    },
    {
      label: 'Total Views',
      value: stats?.totalViews ? `${(stats.totalViews / 1000).toFixed(1)}K` : '0',
      change: 15,
      trend: 'up',
      icon: Eye,
    },
    {
      label: 'Engagement Rate',
      value: stats?.totalEngagement ? `${stats.totalEngagement}%` : '0%',
      change: -2,
      trend: 'down',
      icon: Heart,
    },
    {
      label: 'Scheduled',
      value: stats?.scheduledPosts ?? 0,
      trend: 'neutral',
      icon: Clock,
    },
  ];

  // Build status banners array
  const statusBanners = useMemo(() => {
    const banners = [];
    
    // Tier limit banner (show when 80% quota used)
    if (captionUsage && (userTier === 'free' || userTier === 'starter')) {
      const tierLimitBanner = createTierLimitBanner(
        captionUsage.remaining,
        captionUsage.limit,
        userTier
      );
      if (tierLimitBanner) {
        banners.push(tierLimitBanner);
      }
    }
    
    // Cooldown banner (if cooldown is active)
    // Note: We'd need to fetch cooldown data from API
    // For now, this is a placeholder
    const cooldownSeconds = 0; // TODO: Fetch from API
    if (cooldownSeconds > 0) {
      const cooldownBanner = createCooldownBanner(cooldownSeconds);
      if (cooldownBanner) {
        banners.push(cooldownBanner);
      }
    }
    
    return banners;
  }, [captionUsage, userTier, createTierLimitBanner, createCooldownBanner]);

  return (
    <div className="relative min-h-screen bg-background">
      {/* Status Banners */}
      <StatusBannerContainer banners={statusBanners} />
      
      <CommandBar
        tier={userTier}
        captionsRemaining={captionUsage?.remaining}
        scheduledPosts={stats?.scheduledPosts}
      />

      {/* Main Content */}
      <div className="container mx-auto p-6">
        <StickyRail
          rail={
            <div className="space-y-4">
              {/* Upgrade Card */}
              {userTier === 'free' && (
                <Card className="bg-gradient-to-br from-purple-600 to-pink-600 text-white">
                  <CardContent className="p-4">
                    <div className="mb-3 flex items-center gap-2">
                      <Crown className="h-5 w-5" />
                      <h4 className="font-semibold">Upgrade to Pro</h4>
                    </div>
                    <p className="mb-4 text-sm opacity-90">
                      Unlock unlimited captions, scheduling, and analytics
                    </p>
                    <Button 
                      onClick={handleUpgrade}
                      className="w-full bg-white text-purple-600 hover:bg-gray-100"
                    >
                      Upgrade Now
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Quick Stats */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Today's Performance</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Posts</span>
                    <span className="font-semibold">{stats?.postsToday ?? 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Views</span>
                    <span className="font-semibold">{stats?.totalViews ?? 0}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Captions Left</span>
                    <span className="font-semibold">{captionUsage?.remaining ?? 0}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Help & Resources */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">Resources</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => setLocation('/flight-school')}
                  >
                    <Rocket className="mr-2 h-4 w-4" />
                    FlightSchool
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => setLocation('/support')}
                  >
                    <HelpCircle className="mr-2 h-4 w-4" />
                    Get Support
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full justify-start"
                    onClick={() => setLocation('/automation')}
                  >
                    <Bot className="mr-2 h-4 w-4" />
                    Automation
                  </Button>
                </CardContent>
              </Card>
            </div>
          }
          railPosition="end"
        >
          <div className="space-y-6">
            {/* Welcome Header */}
            <div>
              <h1 className="text-3xl font-bold">
                Welcome back{user?.username ? `, ${user.username}` : ''}!
              </h1>
              <p className="text-muted-foreground">
                Here's what's happening with your content today
              </p>
            </div>

            {/* Onboarding Card */}
            {onboardingStage !== 'advanced' && renderOnboardingCard()}

            {/* Quick Actions Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {quickActionCards.map((card) => (
                <Card
                  key={card.id}
                  className={cn(
                    'group cursor-pointer transition-all hover:scale-105',
                    card.proOnly && userTier === 'free' && 'opacity-75'
                  )}
                  onClick={() => handleQuickAction(card)}
                >
                  <CardContent className="p-6">
                    <div className={cn('mb-4 inline-flex rounded-lg p-3', card.color)}>
                      <card.icon className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="mb-1 font-semibold">{card.title}</h3>
                    <p className="text-sm text-muted-foreground">{card.description}</p>
                    <div className="mt-3 flex items-center gap-2">
                      {card.badge && (
                        <Badge variant="secondary" className="text-xs">
                          {card.badge}
                        </Badge>
                      )}
                      {card.proOnly && (
                        <Badge variant="outline" className="text-xs">
                          PRO
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Stats Grid */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {statCards.map((stat) => (
                <Card key={stat.label}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-muted-foreground">{stat.label}</span>
                      <stat.icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="space-y-1">
                      <p className="text-2xl font-bold">{stat.value}</p>
                      {stat.change !== undefined && (
                        <div className="flex items-center gap-1 text-xs">
                          {stat.trend === 'up' ? (
                            <ArrowUp className="h-3 w-3 text-green-500" />
                          ) : stat.trend === 'down' ? (
                            <ArrowDown className="h-3 w-3 text-red-500" />
                          ) : (
                            <TrendingUp className="h-3 w-3 text-gray-500" />
                          )}
                          <span className={cn(
                            stat.trend === 'up' ? 'text-green-500' : 
                            stat.trend === 'down' ? 'text-red-500' : 
                            'text-gray-500'
                          )}>
                            {Math.abs(stat.change)}%
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Activity & Performance Tabs */}
            <Card>
              <CardHeader>
                <CardTitle>Activity & Insights</CardTitle>
                <CardDescription>
                  Track your recent posts and performance metrics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Tabs value={selectedTab} onValueChange={setSelectedTab}>
                  <TabsList className="grid w-full grid-cols-3">
                    <TabsTrigger value="overview">Overview</TabsTrigger>
                    <TabsTrigger value="activity">Recent Activity</TabsTrigger>
                    <TabsTrigger value="analytics">Analytics</TabsTrigger>
                  </TabsList>

                  <TabsContent value="overview" className="space-y-4">
                    {/* Placeholder for overview content */}
                    <div className="text-center py-8">
                      <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                      <p className="text-muted-foreground">
                        Performance overview coming soon
                      </p>
                    </div>
                  </TabsContent>

                  <TabsContent value="activity" className="space-y-4">
                    {activityLoading ? (
                      <ActivitySkeleton />
                    ) : mappedActivity && mappedActivity.length > 0 ? (
                      <div className="space-y-3">
                        {mappedActivity.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-4 rounded-lg border p-4"
                          >
                            <BatchCheckbox
                              checked={isSelected(item.id)}
                              onChange={() => toggleSelection(item.id)}
                            />
                            {item.imageUrl && (
                              <div className="h-12 w-12 rounded bg-muted" />
                            )}
                            <div className="flex-1">
                              <p className="font-medium">{item.title}</p>
                              {item.description && (
                                <p className="text-sm text-muted-foreground">
                                  {item.description}
                                </p>
                              )}
                            </div>
                            {item.metrics && (
                              <div className="flex gap-4 text-sm text-muted-foreground">
                                {item.metrics.views && (
                                  <span className="flex items-center gap-1">
                                    <Eye className="h-3 w-3" />
                                    {item.metrics.views}
                                  </span>
                                )}
                                {item.metrics.likes && (
                                  <span className="flex items-center gap-1">
                                    <Heart className="h-3 w-3" />
                                    {item.metrics.likes}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <Image className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">
                          No recent activity to display
                        </p>
                      </div>
                    )}
                  </TabsContent>

                  <TabsContent value="analytics" className="space-y-4">
                    {userTier === 'free' ? (
                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Pro Feature</AlertTitle>
                        <AlertDescription>
                          Upgrade to Pro to access detailed analytics and insights.
                          <Button
                            size="sm"
                            variant="link"
                            className="px-2"
                            onClick={handleUpgrade}
                          >
                            Upgrade Now →
                          </Button>
                        </AlertDescription>
                      </Alert>
                    ) : (
                      <div className="text-center py-8">
                        <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                        <p className="text-muted-foreground">
                          Analytics dashboard coming soon
                        </p>
                      </div>
                    )}
                  </TabsContent>
                </Tabs>
              </CardContent>
            </Card>
          </div>
        </StickyRail>
      </div>

      {/* Floating Action Button */}
      <FloatingActionButton />

      {/* Batch Actions Bar */}
      {selectedCount > 0 && (
        <BatchActionsBar
          selectedCount={selectedCount}
          onClearSelection={clearSelection}
        />
      )}

      {/* Quick Start Modal */}
      <QuickStartModal
        open={showQuickStart}
        onOpenChange={setShowQuickStart}
        isRedditConnected={isRedditConnected}
        initialStep={onboardingStage === 'connect-reddit' ? 'connect' : 'subreddit'}
      />
    </div>
  );
}
