/**
 * Analytics Insights Page
 * 
 * Features:
 * - QW-2: Post Removal Tracker
 * - QW-6: Subreddit Health Scores
 * - QW-3: Rule Validator (inline)
 */

import { useQuery } from '@tanstack/react-query';
import { TrendingUp, AlertTriangle, Shield } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { SubredditHealthBadge } from '@/components/analytics/SubredditHealthBadge';
import { RemovalHistory } from '@/components/analytics/RemovalHistory';
import { Skeleton } from '@/components/ui/skeleton';

interface SubredditHealth {
  subreddit: string;
  healthScore: number;
  status: 'excellent' | 'healthy' | 'watch' | 'risky';
  breakdown: {
    successRate: number;
    successScore: number;
    engagementRate: number;
    engagementScore: number;
    removalRate: number;
    removalScore: number;
  };
  metrics: {
    totalPosts: number;
    successfulPosts: number;
    removedPosts: number;
    avgUpvotes: number;
    avgViews: number;
  };
  trend: 'improving' | 'stable' | 'declining' | 'unknown';
}

export default function AnalyticsInsights() {
  const { user } = useAuth();

  const { data: healthData, isLoading: healthLoading } = useQuery<{
    healthScores: SubredditHealth[];
  }>({
    queryKey: ['subreddit-health'],
    queryFn: async () => {
      const response = await fetch('/api/analytics/subreddit-health', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch health scores');
      }

      return response.json();
    },
    enabled: !!user && ['pro', 'premium'].includes(user.tier),
    staleTime: 300000, // Cache for 5 minutes
  });

  const hasAccess = user?.tier && ['pro', 'premium'].includes(user.tier);

  if (!hasAccess) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-6 w-6" />
              Analytics Insights
            </CardTitle>
            <CardDescription>
              Advanced analytics and insights for your Reddit posts
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center py-12">
            <TrendingUp className="h-16 w-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-xl font-semibold mb-2">Pro Feature</h3>
            <p className="text-gray-600 mb-4">
              Analytics insights are available for Pro and Premium tiers
            </p>
            <Button className="mt-6">Upgrade to Pro</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <TrendingUp className="h-8 w-8" />
          Analytics Insights
        </h1>
        <p className="text-muted-foreground mt-2">
          Track your performance, learn from removals, and optimize your posting strategy
        </p>
      </div>

      <Tabs defaultValue="health" className="space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="health">
            <Shield className="h-4 w-4 mr-2" />
            Health Scores
          </TabsTrigger>
          <TabsTrigger value="removals">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Removals
          </TabsTrigger>
        </TabsList>

        {/* Health Scores Tab */}
        <TabsContent value="health" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Subreddit Health Scores
              </CardTitle>
              <CardDescription>
                Health scores for all your subreddits (last 30 days)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {healthLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-24" />
                  ))}
                </div>
              ) : !healthData || healthData.healthScores.length === 0 ? (
                <div className="text-center text-muted-foreground py-8">
                  No health data available yet. Start posting to see your health scores!
                </div>
              ) : (
                <div className="space-y-4">
                  {healthData.healthScores.map((health) => (
                    <div
                      key={health.subreddit}
                      className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                    >
                      {/* Header */}
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h3 className="font-semibold text-lg">
                            r/{health.subreddit}
                          </h3>
                          <div className="text-sm text-muted-foreground">
                            {health.metrics.totalPosts} posts in last 30 days
                          </div>
                        </div>
                        <SubredditHealthBadge
                          score={health.healthScore}
                          status={health.status}
                          breakdown={health.breakdown}
                          trend={health.trend}
                        />
                      </div>

                      {/* Metrics Grid */}
                      <div className="grid grid-cols-4 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground">Success Rate</div>
                          <div className="font-medium">
                            {health.breakdown.successRate}%
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Avg Upvotes</div>
                          <div className="font-medium">
                            {health.metrics.avgUpvotes}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Removals</div>
                          <div className="font-medium">
                            {health.metrics.removedPosts}
                          </div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Trend</div>
                          <div className="font-medium capitalize">
                            {health.trend}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* How Health Scores Work */}
          <Card>
            <CardHeader>
              <CardTitle>How Health Scores Work</CardTitle>
              <CardDescription>
                Understanding your subreddit health scores
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="bg-primary/10 rounded-full p-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium">Success Rate (40%)</div>
                    <p className="text-sm text-muted-foreground">
                      Percentage of posts that weren't removed and got engagement
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="bg-primary/10 rounded-full p-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium">Engagement Score (30%)</div>
                    <p className="text-sm text-muted-foreground">
                      Based on average upvotes and views (200+ upvotes = excellent)
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="bg-primary/10 rounded-full p-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <div className="font-medium">Removal Rate (30%)</div>
                    <p className="text-sm text-muted-foreground">
                      Inverted - lower removal rate = higher score
                    </p>
                  </div>
                </div>

                <div className="border-t pt-4 mt-4">
                  <div className="grid grid-cols-4 gap-2 text-sm">
                    <div className="text-center">
                      <div className="font-semibold text-green-600">85-100</div>
                      <div className="text-muted-foreground">Excellent</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-blue-600">70-84</div>
                      <div className="text-muted-foreground">Healthy</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-yellow-600">50-69</div>
                      <div className="text-muted-foreground">Watch</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-red-600">0-49</div>
                      <div className="text-muted-foreground">Risky</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Removals Tab */}
        <TabsContent value="removals" className="space-y-6">
          <RemovalHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
}
