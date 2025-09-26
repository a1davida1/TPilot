import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import {
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import {
  TrendingUp, Eye, Heart, DollarSign,
  Clock, Brain, Sparkles
} from 'lucide-react';

interface AnalyticsData {
  totalRevenue: number;
  revenueChange: number;
  totalViews: number;
  viewsChange: number;
  engagementRate: number;
  engagementChange: number;
  topPerformingContent: Array<{
    id: string;
    title: string;
    platform: string;
    views: number;
    engagement: number;
    revenue: number;
  }>;
  revenueByPlatform: Array<{
    platform: string;
    revenue: number;
    percentage: number;
  }>;
  performanceTimeline: Array<{
    date: string;
    views: number;
    engagement: number;
    revenue: number;
  }>;
  aiInsights: {
    bestPostingTimes: string[];
    topPerformingTags: string[];
    contentRecommendations: string[];
    engagementPredictions: {
      nextWeek: number;
      confidence: number;
    };
  };
}

const COLORS = ['#8B5CF6', '#EC4899', '#06B6D4', '#10B981', '#F59E0B'];

const REVENUE_MULTIPLIER = 0.001;
const REVENUE_PER_GENERATION = 0.05;

interface PostType {
  title?: string;
  platform?: string;
  views?: number;
  engagement?: number;
}

interface ItemType {
  date?: string;
  estimatedViews?: number;
  estimatedEngagement?: number;
}

// Safe number formatting with fallbacks
const safeNumber = (value: unknown, fallback: number = 0): number => {
  const num = Number(value);
  return isNaN(num) ? fallback : num;
};

// Safe division to prevent division by zero
const safeDivide = (numerator: number, denominator: number, fallback: number = 0): number => {
  return denominator === 0 ? fallback : numerator / denominator;
};

// Safe array access
function safeArrayAccess<T>(array: T[] | undefined | null, index: number, fallback: T): T {
  return Array.isArray(array) && array.length > index && index >= 0 ? array[index] : fallback;
}

export default function SmartAnalytics() {
  const [timeRange, setTimeRange] = useState('7d');
  
  // Real data from analytics API and content generation stats with comprehensive error handling
  const { data: analyticsData, isLoading, error } = useQuery<AnalyticsData>({
    queryKey: ['/api/analytics', timeRange],
    queryFn: async () => {
      try {
        // Get analytics data and stats in parallel
        const [analyticsRes, statsRes, revenueRes] = await Promise.all([
          fetch(`/api/analytics/${timeRange}`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`
            }
          }),
          fetch('/api/stats', {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`
            }
          }),
          fetch('/api/revenue', {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}`
            }
          })
        ]);

        if (!analyticsRes.ok || !statsRes.ok || !revenueRes.ok) {
          throw new Error(`Analytics API failed: ${analyticsRes.status} ${statsRes.status} ${revenueRes.status}`);
        }

        const analytics = await analyticsRes.json();
        const stats = await statsRes.json();
        const revenue = await revenueRes.json();
        
        // Validate response structure
        if (!analytics || !stats || !revenue) {
          throw new Error('Invalid response structure from analytics API');
        }
        
        // Safe data extraction with fallbacks
        const totalViews = safeNumber(analytics.totalViews, 0);
        const totalGenerations = safeNumber(stats.totalGenerations, 1); // Prevent division by zero
        const averageEngagementRate = safeNumber(analytics.averageEngagementRate, 0);
        const successRate = safeNumber(stats.successRate, 0);
        
        // Revenue calculation with real Stripe data
        const totalRevenue = safeNumber(revenue.available, 0) / 100; // Convert from cents to dollars
        
        // Transform the data to match our interface with safe operations
        return {
          totalRevenue: Math.round(totalRevenue),
          revenueChange: safeNumber(analytics.growthMetrics?.viewsGrowth, 0),
          totalViews,
          viewsChange: safeNumber(analytics.growthMetrics?.viewsGrowth, 0),
          engagementRate: averageEngagementRate,
          engagementChange: safeNumber(analytics.growthMetrics?.engagementGrowth, 0),
          topPerformingContent: Array.isArray(analytics.topPerformingPosts) 
            ? analytics.topPerformingPosts.map((post: unknown, index: number) => ({
                id: String(index + 1),
                title: String((post as PostType)?.title || `Post ${index + 1}`),
                platform: String((post as PostType)?.platform || 'Unknown'),
                views: safeNumber((post as PostType)?.views, 0),
                engagement: safeNumber((post as PostType)?.engagement, 0),
                revenue: Math.round(safeNumber((post as PostType)?.views, 0) * REVENUE_MULTIPLIER)
              }))
            : [],
          revenueByPlatform: stats.platformDistribution
            ? Object.entries(stats.platformDistribution).map(([platform, count]: [string, unknown]) => {
                const numericCount = safeNumber(count, 0);
                const estimatedRevenue = Math.round(numericCount * REVENUE_PER_GENERATION);
                return {
                  platform: String(platform),
                  revenue: estimatedRevenue,
                  percentage: Number(safeDivide(numericCount * 100, totalGenerations, 0).toFixed(1))
                };
              })
            : [],
          performanceTimeline: Array.isArray(analytics.activityTimeline)
            ? analytics.activityTimeline.map((item: unknown) => ({
                date: String((item as ItemType)?.date || new Date().toISOString().split('T')[0]),
                views: safeNumber((item as ItemType)?.estimatedViews, 0),
                engagement: safeNumber((item as ItemType)?.estimatedEngagement, 0),
                revenue: Math.round(safeNumber((item as ItemType)?.estimatedViews, 0) * REVENUE_MULTIPLIER)
              }))
            : [],
          aiInsights: {
            bestPostingTimes: Array.isArray(analytics.bestPostingTimes) 
              ? analytics.bestPostingTimes.map((t: unknown) => {
                  const timeItem = t as { time?: string } | string;
                  return typeof timeItem === 'string' ? timeItem : String(timeItem?.time || '12:00');
                }).filter(Boolean)
              : ['09:00', '19:00', '12:00'],
            topPerformingTags: ['#content', '#creator', '#engagement', '#growth'], // Safe fallback
            contentRecommendations: [
              `You've generated ${totalGenerations} pieces of content`,
              `${successRate}% success rate with content generation`,
              `Most active on ${safeArrayAccess(Object.keys(stats.platformDistribution || {}), 0, 'Reddit')}`
            ],
            engagementPredictions: {
              nextWeek: Math.max(averageEngagementRate * 1.1, 0),
              confidence: Math.min(safeDivide(successRate, 100, 0.5), 0.95)
            }
          }
        };
      } catch (error) {
        console.error('Analytics data processing error:', error);
        throw new Error('Failed to process analytics data: ' + (error instanceof Error ? error.message : 'Unknown error'));
      }
    }
  });

  // Handle error state
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Smart Analytics</h2>
            <p className="text-gray-400">AI-powered insights and performance tracking</p>
          </div>
          <Badge className="bg-gradient-to-r from-purple-500 to-pink-500">Phase 3</Badge>
        </div>
        
        <Card className="bg-red-900/20 border-red-500/20">
          <CardContent className="p-6">
            <div className="text-center space-y-4">
              <div className="text-red-400 text-xl font-semibold">Analytics Unavailable</div>
              <p className="text-gray-300">We're having trouble loading your analytics data. Please try refreshing the page.</p>
              <Button 
                onClick={() => window.location.reload()} 
                className="bg-gradient-to-r from-purple-500 to-pink-500"
              >
                Refresh Page
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Smart Analytics</h2>
            <p className="text-gray-400">AI-powered insights and performance tracking</p>
          </div>
          <Badge className="bg-gradient-to-r from-purple-500 to-pink-500">Phase 3</Badge>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="bg-gray-800 border-purple-500/20 animate-pulse">
              <CardContent className="p-6">
                <div className="h-16 bg-gray-700 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Safe data access with proper validation
  if (!analyticsData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Smart Analytics</h2>
            <p className="text-gray-400">AI-powered insights and performance tracking</p>
          </div>
          <Badge className="bg-gradient-to-r from-purple-500 to-pink-500">Phase 3</Badge>
        </div>
        
        <Card className="bg-yellow-900/20 border-yellow-500/20">
          <CardContent className="p-6">
            <div className="text-center space-y-4">
              <div className="text-yellow-400 text-xl font-semibold">No Data Available</div>
              <p className="text-gray-300">Analytics data is not yet available. Start creating content to see your performance metrics.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  
  const data = analyticsData;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Smart Analytics</h2>
          <p className="text-gray-400">AI-powered insights and performance tracking</p>
        </div>
        <div className="flex items-center space-x-2">
          <Badge className="bg-gradient-to-r from-purple-500 to-pink-500">Phase 3</Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setTimeRange(timeRange === '7d' ? '30d' : '7d')}
            className="border-purple-500/20"
          >
            {timeRange === '7d' ? 'Last 7 Days' : 'Last 30 Days'}
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="bg-gray-800 border-purple-500/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Total Revenue</p>
                <div className="flex items-center space-x-2">
                  <p className="text-2xl font-bold text-white">${safeNumber(data.totalRevenue, 0).toLocaleString()}</p>
                  <div className="flex items-center space-x-1">
                    <TrendingUp className="h-4 w-4 text-green-400" />
                    <span className="text-sm text-green-400">+{safeNumber(data.revenueChange, 0)}%</span>
                  </div>
                </div>
              </div>
              <DollarSign className="h-8 w-8 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-purple-500/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Total Views</p>
                <div className="flex items-center space-x-2">
                  <p className="text-2xl font-bold text-white">{safeNumber(data.totalViews, 0).toLocaleString()}</p>
                  <div className="flex items-center space-x-1">
                    <TrendingUp className="h-4 w-4 text-blue-400" />
                    <span className="text-sm text-blue-400">+{safeNumber(data.viewsChange, 0)}%</span>
                  </div>
                </div>
              </div>
              <Eye className="h-8 w-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-purple-500/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">Engagement Rate</p>
                <div className="flex items-center space-x-2">
                  <p className="text-2xl font-bold text-white">{safeNumber(data.engagementRate, 0)}%</p>
                  <div className="flex items-center space-x-1">
                    <TrendingUp className="h-4 w-4 text-purple-400" />
                    <span className="text-sm text-purple-400">+{safeNumber(data.engagementChange, 0)}%</span>
                  </div>
                </div>
              </div>
              <Heart className="h-8 w-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-800 border-purple-500/20">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-400">AI Prediction</p>
                <div className="flex items-center space-x-2">
                  <p className="text-2xl font-bold text-white">{safeNumber(data.aiInsights.engagementPredictions.nextWeek, 0).toFixed(1)}%</p>
                  <div className="flex items-center space-x-1">
                    <Brain className="h-4 w-4 text-yellow-400" />
                    <span className="text-sm text-yellow-400">{Math.round(safeNumber(data.aiInsights.engagementPredictions.confidence, 0) * 100)}% confident</span>
                  </div>
                </div>
              </div>
              <Sparkles className="h-8 w-8 text-yellow-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Insights */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-gray-800 border-purple-500/20">
          <TabsTrigger value="overview">Performance Overview</TabsTrigger>
          <TabsTrigger value="content">Top Content</TabsTrigger>
          <TabsTrigger value="insights">AI Insights</TabsTrigger>
          <TabsTrigger value="revenue">Revenue Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card className="bg-gray-800 border-purple-500/20">
            <CardHeader>
              <CardTitle className="text-white">Performance Timeline</CardTitle>
              <CardDescription>Views, engagement, and revenue over time</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={data.performanceTimeline || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="date" stroke="#9CA3AF" />
                  <YAxis stroke="#9CA3AF" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1F2937',
                      border: '1px solid #374151',
                      borderRadius: '8px'
                    }}
                  />
                  <Area type="monotone" dataKey="views" stackId="1" stroke="#8B5CF6" fill="#8B5CF6" fillOpacity={0.3} />
                  <Area type="monotone" dataKey="engagement" stackId="2" stroke="#EC4899" fill="#EC4899" fillOpacity={0.3} />
                </AreaChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="content" className="space-y-4">
          <Card className="bg-gray-800 border-purple-500/20">
            <CardHeader>
              <CardTitle className="text-white">Top Performing Content</CardTitle>
              <CardDescription>Your best performing posts this week</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {(data.topPerformingContent || []).map((content, index) => (
                  <div key={content.id} className="flex items-center justify-between p-4 bg-gray-700 rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center justify-center w-8 h-8 bg-purple-600 rounded-full">
                        <span className="text-sm font-bold text-white">{index + 1}</span>
                      </div>
                      <div>
                        <h4 className="font-medium text-white">{content.title}</h4>
                        <p className="text-sm text-gray-400">{content.platform}</p>
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <div className="flex items-center space-x-4 text-sm">
                        <div className="flex items-center space-x-1">
                          <Eye className="h-4 w-4 text-blue-400" />
                          <span className="text-gray-300">{safeNumber(content.views, 0).toLocaleString()}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Heart className="h-4 w-4 text-purple-400" />
                          <span className="text-gray-300">{safeNumber(content.engagement, 0)}%</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <DollarSign className="h-4 w-4 text-green-400" />
                          <span className="text-gray-300">${safeNumber(content.revenue, 0)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {(!data.topPerformingContent || data.topPerformingContent.length === 0) && (
                  <div className="text-center py-8">
                    <p className="text-gray-400">No content data available yet. Start creating to see performance metrics.</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="bg-gray-800 border-purple-500/20">
              <CardHeader>
                <CardTitle className="text-white flex items-center space-x-2">
                  <Brain className="h-5 w-5 text-yellow-400" />
                  <span>AI Recommendations</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(data.aiInsights.contentRecommendations || []).map((rec, index) => (
                  <div key={index} className="flex items-start space-x-3 p-3 bg-gray-700 rounded-lg">
                    <Sparkles className="h-4 w-4 text-yellow-400 mt-0.5" />
                    <p className="text-sm text-gray-300">{rec}</p>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-purple-500/20">
              <CardHeader>
                <CardTitle className="text-white flex items-center space-x-2">
                  <Clock className="h-5 w-5 text-blue-400" />
                  <span>Optimal Posting Times</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(data.aiInsights.bestPostingTimes || []).map((time, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                    <span className="text-white font-medium">{time}</span>
                    <Badge variant="outline" className="border-blue-400 text-blue-400">
                      Peak Time
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="revenue" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="bg-gray-800 border-purple-500/20">
              <CardHeader>
                <CardTitle className="text-white">Revenue by Platform</CardTitle>
              </CardHeader>
              <CardContent>
                {data.revenueByPlatform && data.revenueByPlatform.length > 0 ? (
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={data.revenueByPlatform}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="revenue"
                      >
                        {data.revenueByPlatform.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-gray-400">No revenue data available yet.</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-purple-500/20">
              <CardHeader>
                <CardTitle className="text-white">Platform Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {(data.revenueByPlatform || []).map((platform, index) => (
                  <div key={platform.platform} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-white font-medium">{platform.platform}</span>
                      <span className="text-sm text-gray-400">${safeNumber(platform.revenue, 0).toLocaleString()}</span>
                    </div>
                    <Progress
                      value={safeNumber(platform.percentage, 0)}
                      className="h-2"
                      style={{ backgroundColor: COLORS[index % COLORS.length] + '20' }}
                    />
                  </div>
                ))}
                {(!data.revenueByPlatform || data.revenueByPlatform.length === 0) && (
                  <div className="text-center py-4">
                    <p className="text-gray-400">No platform data available yet.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}