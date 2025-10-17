/**
 * Enhanced Performance Analytics Dashboard
 * Uses real-time data from /api/analytics/* endpoints
 */

import { useState, useEffect } from 'react';
import { 
  TrendingUp, TrendingDown, Minus, Heart, 
  MessageSquare, BarChart3, Clock, Calendar,
  Lightbulb, Award, Target
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import {
  BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  Cell
} from 'recharts';

interface PerformanceData {
  user: {
    avgUpvotes: number;
    avgComments: number;
    successRate: number;
    totalPosts: number;
    trending?: 'up' | 'down' | 'stable';
    trendPercent?: number;
    bestHours?: number[];
    bestDay?: string;
    vsGlobal?: {
      percentile: number;
      betterThan: string;
    };
  };
  global: {
    avgUpvotes: number;
    avgComments: number;
    successRate: number;
    totalPosts: number;
  };
  recommendations: string[];
  last30Days?: {
    posts: number;
    totalUpvotes: number;
    totalComments: number;
    growth: string;
  };
}

interface PeakHoursData {
  subreddit: string;
  peakHours: number[];
  hourlyScores: Record<number, number>;
  confidence: 'high' | 'medium' | 'low';
  sampleSize: number;
}

export function PerformanceAnalytics() {
  const [subreddit, setSubreddit] = useState('gonewild');
  const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null);
  const [peakHoursData, setPeakHoursData] = useState<PeakHoursData | null>(null);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();

  const hasAccess = user?.tier && ['pro', 'premium', 'admin'].includes(user.tier);

  // Common subreddits list
  const subreddits = [
    'gonewild', 'RealGirls', 'PetiteGoneWild', 'OnlyFansPromotions',
    'adorableporn', 'NSFWverifiedamateurs', 'SexSells'
  ];

  useEffect(() => {
    if (hasAccess && user?.id) {
      fetchAnalytics();
    }
  }, [subreddit, hasAccess, user?.id]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      
      // Fetch performance analytics and peak hours in parallel
      const [perfResponse, peakResponse] = await Promise.all([
        apiRequest('GET', `/api/analytics/performance?subreddit=${subreddit}&userId=${user?.id}`),
        apiRequest('GET', `/api/analytics/peak-hours?subreddit=${subreddit}`)
      ]);

      const perfData = await perfResponse.json();
      const peakData = await peakResponse.json();

      if (perfData.success) {
        setPerformanceData(perfData.data);
      }
      if (peakData.success) {
        setPeakHoursData(peakData.data);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!hasAccess) {
    return (
      <div className="container mx-auto p-6">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Performance Analytics</CardTitle>
            <CardDescription>Real-time insights and recommendations</CardDescription>
          </CardHeader>
          <CardContent className="text-center py-12">
            <BarChart3 className="h-16 w-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-xl font-semibold mb-2">Analytics Locked</h3>
            <p className="text-gray-600 mb-4">
              Performance analytics require Pro or Premium tier
            </p>
            <div className="grid gap-4 max-w-md mx-auto mt-6">
              <div className="p-4 border rounded-lg">
                <Badge className="mb-2">Pro - $29/mo</Badge>
                <p className="text-sm">Real-time analytics & trending insights</p>
              </div>
              <div className="p-4 border rounded-lg">
                <Badge className="mb-2" variant="secondary">Premium - $99/mo</Badge>
                <p className="text-sm">Advanced analytics with AI recommendations</p>
              </div>
            </div>
            <Button className="mt-6">Upgrade for Analytics</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading || !performanceData || !peakHoursData) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const getTrendIcon = () => {
    if (performanceData.user.trending === 'up') return <TrendingUp className="h-4 w-4 text-green-500" />;
    if (performanceData.user.trending === 'down') return <TrendingDown className="h-4 w-4 text-red-500" />;
    return <Minus className="h-4 w-4 text-gray-400" />;
  };

  const getTrendColor = () => {
    if (performanceData.user.trending === 'up') return 'text-green-600';
    if (performanceData.user.trending === 'down') return 'text-red-600';
    return 'text-gray-600';
  };

  // Prepare peak hours heatmap data
  const heatmapData = Array.from({ length: 24 }, (_, hour) => ({
    hour,
    score: peakHoursData.hourlyScores[hour] || 0,
    isPeak: peakHoursData.peakHours.includes(hour)
  }));

  const _maxScore = Math.max(...Object.values(peakHoursData.hourlyScores));

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Performance Analytics</h1>
          <p className="text-gray-600">Real-time insights from your post history</p>
        </div>
        <Select value={subreddit} onValueChange={setSubreddit}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Select subreddit" />
          </SelectTrigger>
          <SelectContent>
            {subreddits.map(sub => (
              <SelectItem key={sub} value={sub}>
                r/{sub}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Upvotes</CardTitle>
            <Heart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{performanceData.user.avgUpvotes}</div>
            <div className="flex items-center gap-1 mt-1">
              {getTrendIcon()}
              <p className={`text-xs ${getTrendColor()}`}>
                {performanceData.user.trendPercent !== undefined && 
                  `${performanceData.user.trendPercent > 0 ? '+' : ''}${performanceData.user.trendPercent}% vs last 15 days`
                }
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(performanceData.user.successRate * 100).toFixed(0)}%
            </div>
            <p className="text-xs text-muted-foreground">
              {performanceData.user.totalPosts} posts tracked
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Comments</CardTitle>
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{performanceData.user.avgComments}</div>
            <p className="text-xs text-muted-foreground">
              Per post average
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Your Rank</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {performanceData.user.vsGlobal?.percentile}th
            </div>
            <p className="text-xs text-muted-foreground">
              {performanceData.user.vsGlobal?.betterThan}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="timing">Best Times</TabsTrigger>
          <TabsTrigger value="recommendations">Recommendations</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {/* Performance Comparison */}
            <Card>
              <CardHeader>
                <CardTitle>You vs Platform Average</CardTitle>
                <CardDescription>Compare your performance</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={[
                    {
                      metric: 'Upvotes',
                      You: performanceData.user.avgUpvotes,
                      Platform: performanceData.global.avgUpvotes
                    },
                    {
                      metric: 'Comments',
                      You: performanceData.user.avgComments,
                      Platform: performanceData.global.avgComments
                    },
                    {
                      metric: 'Success %',
                      You: performanceData.user.successRate * 100,
                      Platform: performanceData.global.successRate * 100
                    }
                  ]}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="metric" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="You" fill="#8b5cf6" />
                    <Bar dataKey="Platform" fill="#cbd5e1" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Last 30 Days Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Last 30 Days</CardTitle>
                <CardDescription>Your recent performance</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-purple-500" />
                    <span className="font-medium">Posts Published</span>
                  </div>
                  <span className="text-2xl font-bold">
                    {performanceData.last30Days?.posts || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Heart className="h-5 w-5 text-red-500" />
                    <span className="font-medium">Total Upvotes</span>
                  </div>
                  <span className="text-2xl font-bold">
                    {performanceData.last30Days?.totalUpvotes.toLocaleString() || 0}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-blue-500" />
                    <span className="font-medium">Total Comments</span>
                  </div>
                  <span className="text-2xl font-bold">
                    {performanceData.last30Days?.totalComments.toLocaleString() || 0}
                  </span>
                </div>
                <div className="pt-4 border-t">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Growth Rate</span>
                    <Badge 
                      variant={performanceData.user.trending === 'up' ? 'default' : 'secondary'}
                      className={performanceData.user.trending === 'up' ? 'bg-green-500' : ''}
                    >
                      {performanceData.last30Days?.growth || '0%'}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="timing" className="space-y-4">
          {/* Peak Hours Heatmap */}
          <Card>
            <CardHeader>
              <CardTitle>Best Posting Hours</CardTitle>
              <CardDescription>
                Based on {peakHoursData.sampleSize} posts • 
                Confidence: <Badge variant="outline">{peakHoursData.confidence}</Badge>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={heatmapData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="hour" 
                    tickFormatter={(hour) => `${hour}:00`}
                  />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={(hour) => `${hour}:00`}
                    formatter={(value: number) => [`${Math.round(value)} avg upvotes`, 'Performance']}
                  />
                  <Bar dataKey="score" radius={[8, 8, 0, 0]}>
                    {heatmapData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.isPeak ? '#8b5cf6' : '#cbd5e1'}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="h-5 w-5 text-purple-500" />
                    <span className="font-medium">Peak Hours</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {peakHoursData.peakHours.map(hour => (
                      <Badge key={hour} variant="secondary">
                        {hour}:00
                      </Badge>
                    ))}
                  </div>
                </div>

                <div className="p-4 border rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="h-5 w-5 text-blue-500" />
                    <span className="font-medium">Best Day</span>
                  </div>
                  <div className="text-2xl font-bold">
                    {performanceData.user.bestDay || 'Friday'}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="recommendations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Personalized Recommendations</CardTitle>
              <CardDescription>AI-powered insights to improve your performance</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {performanceData.recommendations.map((rec, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 border rounded-lg">
                    <Lightbulb className="h-5 w-5 text-yellow-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm">{rec}</p>
                  </div>
                ))}
              </div>

              {performanceData.recommendations.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Lightbulb className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                  <p>Keep posting to get personalized recommendations!</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Stats */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">vs Last Period</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-3xl font-bold ${getTrendColor()}`}>
                  {performanceData.user.trending === 'up' && '+'}
                  {performanceData.user.trendPercent}%
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Sample Size</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {peakHoursData.sampleSize}
                </div>
                <p className="text-xs text-muted-foreground mt-1">posts analyzed</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Data Quality</CardTitle>
              </CardHeader>
              <CardContent>
                <Badge 
                  variant={peakHoursData.confidence === 'high' ? 'default' : 'secondary'}
                  className="text-base"
                >
                  {peakHoursData.confidence.toUpperCase()}
                </Badge>
                <p className="text-xs text-muted-foreground mt-2">
                  {peakHoursData.confidence === 'high' && '50+ posts'}
                  {peakHoursData.confidence === 'medium' && '20-49 posts'}
                  {peakHoursData.confidence === 'low' && '<20 posts'}
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
