/**
 * Analytics Dashboard Page
 * Tier-restricted analytics for content creators
 */

import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Clock, 
  Target,
  Calendar,
  DollarSign,
  Activity,
  Award,
  Lock,
  Crown,
  Zap,
  ChevronRight,
  Info,
  Sparkles,
  AlertCircle
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import { useLocation } from 'wouter';
import { format, subDays, startOfWeek, endOfWeek } from 'date-fns';
import { cn } from '@/lib/utils';

// Tier access levels
const TIER_ACCESS = {
  free: 0,
  starter: 1,
  pro: 2,
  premium: 3,
  admin: 4
};

interface AnalyticsData {
  overview: {
    totalPosts: number;
    totalEngagement: number;
    averageEngagementRate: number;
    growthRate: number;
    postsToday: number;
    postsThisWeek: number;
    postsThisMonth: number;
  };
  performance: {
    bestPostingTimes: Array<{ hour: number; day: string; engagement: number }>;
    topSubreddits: Array<{ name: string; posts: number; engagement: number; growth: number }>;
    contentPerformance: Array<{ type: string; count: number; avgEngagement: number }>;
  };
  trends: {
    weeklyGrowth: Array<{ date: string; posts: number; engagement: number }>;
    monthlyGrowth: Array<{ month: string; posts: number; revenue: number }>;
    projections: { nextWeek: number; nextMonth: number; confidence: number };
  };
  intelligence: {
    recommendations: string[];
    warnings: string[];
    opportunities: Array<{ subreddit: string; reason: string; potential: number }>;
    competitors: Array<{ username: string; followers: number; engagement: number }>;
  };
}

export default function AnalyticsPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [timeRange, setTimeRange] = useState('7d');
  const [selectedMetric, setSelectedMetric] = useState('engagement');
  
  const userTier = user?.tier || 'free';
  const tierLevel = TIER_ACCESS[userTier as keyof typeof TIER_ACCESS] || 0;
  const isProOrHigher = tierLevel >= TIER_ACCESS.pro;
  const isPremium = tierLevel >= TIER_ACCESS.premium;

  // Fetch analytics data based on tier
  const { data: analytics, isLoading, error } = useQuery<AnalyticsData>({
    queryKey: ['/api/analytics', timeRange, userTier],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', `/api/analytics?range=${timeRange}&tier=${userTier}`);
        return response as unknown as AnalyticsData;
      } catch (err) {
        console.error('Analytics fetch error:', err);
        throw err;
      }
    },
    enabled: isProOrHigher, // Only fetch for Pro and above
    retry: 1,
  });

  // Mock data removed - using real data only from API

  // Use real data only, no fallback to mock
  const data = analytics;

  // If data is not available and user has access, show loading or error state
  if (isProOrHigher && !data && !isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-7xl">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Failed to load analytics</AlertTitle>
          <AlertDescription>
            Please try refreshing the page. If the problem persists, contact support.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Render tier upgrade prompt
  const renderUpgradePrompt = () => {
    if (isProOrHigher) return null;

    return (
      <Alert className="mb-6 border-amber-200 bg-amber-50">
        <Lock className="h-4 w-4" />
        <AlertTitle>Analytics Requires Pro or Premium</AlertTitle>
        <AlertDescription className="mt-2">
          <p className="mb-3">
            Unlock powerful analytics to grow your audience and optimize your content strategy.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <Card className="border-purple-200">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Zap className="h-5 w-5 text-purple-600" />
                  Pro Plan - $29/month
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm">
                  <li>✅ Basic analytics & metrics</li>
                  <li>✅ Best posting times</li>
                  <li>✅ 7-day scheduling</li>
                  <li>✅ Performance tracking</li>
                </ul>
              </CardContent>
            </Card>
            <Card className="border-amber-200 relative">
              <Badge className="absolute -top-2 right-3 bg-gradient-to-r from-amber-500 to-amber-600">
                BEST VALUE
              </Badge>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Crown className="h-5 w-5 text-amber-600" />
                  Premium Plan - $99/month
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm">
                  <li>✅ Advanced analytics & AI insights</li>
                  <li>✅ Growth projections</li>
                  <li>✅ 30-day scheduling</li>
                  <li>✅ Competition analysis</li>
                  <li>✅ Unlimited everything</li>
                </ul>
              </CardContent>
            </Card>
          </div>
          <div className="mt-4 flex gap-3">
            <Button 
              onClick={() => setLocation('/settings?tab=billing')}
              className="bg-purple-600 hover:bg-purple-700"
            >
              Upgrade to Pro
            </Button>
            <Button 
              onClick={() => setLocation('/settings?tab=billing')}
              variant="outline"
              className="border-amber-500 text-amber-600 hover:bg-amber-50"
            >
              Go Premium
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  };

  // Basic stats cards (Pro tier)
  const renderBasicStats = () => {
    if (!data) return null;
    
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Total Posts</CardDescription>
            <CardTitle className="text-2xl">{data.overview.totalPosts}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Engagement Rate</CardDescription>
            <CardTitle className="text-2xl">{data.overview.averageEngagementRate}%</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>This Week</CardDescription>
            <CardTitle className="text-2xl">{data.overview.postsThisWeek} posts</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Growth</CardDescription>
            <CardTitle className="text-2xl flex items-center gap-1">
              <TrendingUp className="h-4 w-4 text-green-500" />
              {data.overview.growthRate}%
            </CardTitle>
          </CardHeader>
        </Card>
      </div>
    );
  };

  // Advanced intelligence (Premium only)
  const renderIntelligence = () => {
    if (!isPremium) {
      return (
        <Card className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-purple-50/50 to-amber-50/50 backdrop-blur-sm z-10 flex items-center justify-center">
            <div className="text-center">
              <Crown className="h-12 w-12 text-amber-600 mx-auto mb-3" />
              <h3 className="text-lg font-semibold mb-2">Premium Feature</h3>
              <p className="text-sm text-muted-foreground mb-4">
                AI-powered insights and recommendations
              </p>
              <Button onClick={() => setLocation('/settings?tab=billing')}>
                Upgrade to Premium
              </Button>
            </div>
          </div>
          <CardHeader>
            <CardTitle>AI Intelligence & Insights</CardTitle>
          </CardHeader>
          <CardContent className="opacity-50">
            <div className="space-y-4">
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
              <Skeleton className="h-20" />
            </div>
          </CardContent>
        </Card>
      );
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            AI Intelligence & Insights
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Recommendations */}
          <div>
            <h4 className="font-medium mb-2 text-green-700">📈 Recommendations</h4>
            <div className="space-y-2">
              {data?.intelligence?.recommendations?.map((rec, i) => (
                <Alert key={i} className="border-green-200 bg-green-50">
                  <AlertDescription>{rec}</AlertDescription>
                </Alert>
              ))}
            </div>
          </div>

          {/* Opportunities */}
          <div>
            <h4 className="font-medium mb-2 text-blue-700">✨ Opportunities</h4>
            <div className="space-y-2">
              {data?.intelligence?.opportunities?.map((opp, i) => (
                <div key={i} className="p-3 border rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">r/{opp.subreddit}</span>
                    <Badge className="bg-blue-100 text-blue-700">
                      {opp.potential}% potential
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{opp.reason}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Warnings */}
          {(data?.intelligence?.warnings?.length ?? 0) > 0 && (
            <div>
              <h4 className="font-medium mb-2 text-amber-700">⚠️ Warnings</h4>
              <div className="space-y-2">
                {data?.intelligence?.warnings?.map((warning, i) => (
                  <Alert key={i} className="border-amber-200 bg-amber-50">
                    <AlertDescription>{warning}</AlertDescription>
                  </Alert>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  if (!isProOrHigher) {
    return (
      <div className="container mx-auto p-6 max-w-6xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            Track your performance and grow your audience
          </p>
        </div>
        {renderUpgradePrompt()}
      </div>
    );
  }

  // Show loading state
  if (isLoading && isProOrHigher) {
    return (
      <div className="container mx-auto p-6 max-w-7xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
          <p className="text-muted-foreground mt-2">Loading your analytics...</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardHeader className="pb-3">
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-8 w-32" />
              </CardHeader>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {[1, 2].map(i => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-32 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Analytics Dashboard</h1>
          <p className="text-muted-foreground mt-2">
            {isPremium ? 'Premium Analytics - Full Intelligence Suite' : 'Pro Analytics - Performance Tracking'}
          </p>
        </div>
        <Select value={timeRange} onValueChange={setTimeRange}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Basic Stats */}
      {renderBasicStats()}

      {/* Main Content */}
      <Tabs defaultValue="performance" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="timing">Best Times</TabsTrigger>
          <TabsTrigger value="growth">Growth</TabsTrigger>
          <TabsTrigger value="intelligence" className="relative">
            Intelligence
            {!isPremium && <Lock className="h-3 w-3 ml-1" />}
          </TabsTrigger>
        </TabsList>

        {/* Performance Tab */}
        <TabsContent value="performance" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Top Performing Subreddits</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data?.performance?.topSubreddits?.map((sub) => (
                    <div key={sub.name} className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">r/{sub.name}</span>
                          <Badge variant="secondary">{sub.posts} posts</Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          <span>{sub.engagement} engagement</span>
                          <span className="text-green-600">+{sub.growth}%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Content Type Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {data?.performance?.contentPerformance?.map((content) => (
                    <div key={content.type}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">{content.type}</span>
                        <span className="text-sm text-muted-foreground">
                          {content.avgEngagement} avg engagement
                        </span>
                      </div>
                      <Progress 
                        value={(content.avgEngagement / 200) * 100} 
                        className="h-2"
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Best Times Tab */}
        <TabsContent value="timing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Optimal Posting Times</CardTitle>
              <CardDescription>
                Based on your audience engagement patterns
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {data?.performance?.bestPostingTimes?.map((time, index) => (
                  <div 
                    key={index}
                    className="flex items-center justify-between p-4 border rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <div className={cn(
                        "w-12 h-12 rounded-lg flex items-center justify-center font-bold text-lg",
                        index === 0 ? "bg-gradient-to-br from-amber-500 to-amber-600 text-white" :
                        index === 1 ? "bg-gradient-to-br from-gray-400 to-gray-500 text-white" :
                        "bg-gradient-to-br from-orange-400 to-orange-500 text-white"
                      )}>
                        #{index + 1}
                      </div>
                      <div>
                        <p className="font-semibold">{time.day} at {time.hour}:00</p>
                        <p className="text-sm text-muted-foreground">
                          Average engagement: {time.engagement}
                        </p>
                      </div>
                    </div>
                    {isPremium && (
                      <Button size="sm" variant="outline">
                        Schedule Post
                        <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Growth Tab */}
        <TabsContent value="growth" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Growth Trends</CardTitle>
              <CardDescription>Your posting and engagement over time</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-medium mb-3">Weekly Activity</h4>
                  <div className="space-y-2">
                    {data?.trends?.weeklyGrowth?.map((day) => (
                      <div key={day.date} className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground w-20">
                          {format(new Date(day.date), 'MMM d')}
                        </span>
                        <div className="flex-1">
                          <Progress 
                            value={(day.engagement / 3000) * 100} 
                            className="h-6"
                          />
                        </div>
                        <span className="text-sm font-medium w-16 text-right">
                          {day.posts} posts
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {isPremium && (
                  <div className="pt-4 border-t">
                    <h4 className="text-sm font-medium mb-3">Growth Projections</h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center p-3 border rounded-lg">
                        <p className="text-2xl font-bold">{data?.trends?.projections?.nextWeek}</p>
                        <p className="text-xs text-muted-foreground">Next Week</p>
                      </div>
                      <div className="text-center p-3 border rounded-lg">
                        <p className="text-2xl font-bold">{data?.trends?.projections?.nextMonth}</p>
                        <p className="text-xs text-muted-foreground">Next Month</p>
                      </div>
                      <div className="text-center p-3 border rounded-lg">
                        <p className="text-2xl font-bold">{data?.trends?.projections?.confidence}%</p>
                        <p className="text-xs text-muted-foreground">Confidence</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Intelligence Tab */}
        <TabsContent value="intelligence">
          {renderIntelligence()}
        </TabsContent>
      </Tabs>
    </div>
  );
}
