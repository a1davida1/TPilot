/**
 * Enhanced Performance Analytics Dashboard
 * Uses real-time data from /api/analytics/* endpoints
 */

import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { 
  TrendingUp, TrendingDown, Minus, Heart, 
  MessageSquare, BarChart3, Clock, Calendar,
  Lightbulb, Award, Target, AlertCircle, Download
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import {
  BarChart, Bar, LineChart, Line,
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
  const [subreddits, setSubreddits] = useState<string[]>([]);
  const [performanceData, setPerformanceData] = useState<PerformanceData | null>(null);
  const [peakHoursData, setPeakHoursData] = useState<PeakHoursData | null>(null);
  const [historicalData, setHistoricalData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const [, navigate] = useLocation();

  const hasAccess = user?.tier && ['pro', 'premium', 'admin'].includes(user.tier);
  const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Load user's subreddits on mount
  useEffect(() => {
    if (hasAccess && user?.id) {
      loadUserSubreddits();
    }
  }, [hasAccess, user?.id]);

  // Fetch analytics when subreddit changes
  useEffect(() => {
    if (hasAccess && user?.id && subreddit && subreddits.length > 0) {
      fetchAnalytics();
    }
  }, [subreddit, hasAccess, user?.id]);

  const loadUserSubreddits = async () => {
    try {
      const response = await apiRequest('GET', `/api/analytics/user-subreddits?userId=${user?.id}`);
      const data = await response.json();
      
      if (data.success && data.subreddits.length > 0) {
        setSubreddits(data.subreddits);
        setSubreddit(data.subreddits[0]); // Auto-select first
      } else {
        // Fallback to popular subreddits
        const fallback = ['gonewild', 'RealGirls', 'PetiteGoneWild', 'adorableporn'];
        setSubreddits(fallback);
        setSubreddit(fallback[0]);
      }
    } catch (error) {
      console.error('Failed to load subreddits:', error);
      // Fallback to popular
      const fallback = ['gonewild', 'RealGirls', 'PetiteGoneWild'];
      setSubreddits(fallback);
      setSubreddit(fallback[0]);
    }
  };

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch performance, peak hours, and historical data in parallel
      const [perfResponse, peakResponse, historicalResponse] = await Promise.all([
        apiRequest('GET', `/api/analytics/performance?subreddit=${subreddit}&userId=${user?.id}`),
        apiRequest('GET', `/api/analytics/peak-hours?subreddit=${subreddit}`),
        apiRequest('GET', `/api/analytics/historical-performance?subreddit=${subreddit}&userId=${user?.id}&days=30`)
      ]);

      const perfData = await perfResponse.json();
      const peakData = await peakResponse.json();
      const historicalData = await historicalResponse.json();

      if (perfData.success) {
        setPerformanceData(perfData.data);
      }
      if (peakData.success) {
        setPeakHoursData(peakData.data);
      }
      if (historicalData.success) {
        setHistoricalData(historicalData.data);
      }
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      setError(error instanceof Error ? error.message : 'Failed to load analytics');
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

  // Show error state
  if (error && !loading) {
    return (
      <div className="container mx-auto p-6">
        <Card className="p-8 text-center">
          <AlertCircle className="h-16 w-16 mx-auto mb-4 text-destructive" />
          <h2 className="text-2xl font-bold mb-2">Unable to Load Analytics</h2>
          <p className="text-muted-foreground mb-4">{error}</p>
          <Button onClick={() => fetchAnalytics()}>
            Try Again
          </Button>
        </Card>
      </div>
    );
  }

  // Show loading skeleton
  if (loading || !performanceData || !peakHoursData) {
    return (
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-9 w-[300px]" />
            <Skeleton className="h-4 w-[250px]" />
          </div>
          <Skeleton className="h-10 w-[200px]" />
        </div>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map(i => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-4 w-[100px]" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-[80px]" />
                <Skeleton className="h-3 w-[120px] mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-[200px]" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show empty state if user has no posts
  if (performanceData.user.totalPosts === 0) {
    return (
      <div className="container mx-auto p-6">
        <Card className="p-8 text-center max-w-4xl mx-auto">
          <BarChart3 className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-3xl font-bold mb-2">Start Tracking Your Performance</h2>
          <p className="text-muted-foreground mb-8 text-lg">
            Post to r/{subreddit} and come back here to see your analytics.
            You'll need at least 10 posts for AI-powered insights.
          </p>
          
          <div className="grid gap-4 md:grid-cols-3 max-w-3xl mx-auto mb-8">
            <Card className="p-6">
              <Target className="h-10 w-10 mb-3 text-primary" />
              <h3 className="font-semibold mb-2">Track Performance</h3>
              <p className="text-sm text-muted-foreground">
                See which posts get the most upvotes and engagement
              </p>
            </Card>
            <Card className="p-6">
              <Clock className="h-10 w-10 mb-3 text-primary" />
              <h3 className="font-semibold mb-2">Find Peak Hours</h3>
              <p className="text-sm text-muted-foreground">
                Discover when your audience is most active
              </p>
            </Card>
            <Card className="p-6">
              <Lightbulb className="h-10 w-10 mb-3 text-primary" />
              <h3 className="font-semibold mb-2">Get AI Suggestions</h3>
              <p className="text-sm text-muted-foreground">
                Receive personalized title recommendations
              </p>
            </Card>
          </div>
          
          <Button size="lg" onClick={() => navigate('/reddit-posting')}>
            Create Your First Post
          </Button>
        </Card>
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

  // Convert UTC hours to local timezone
  const convertToLocalHour = (utcHour: number): number => {
    const now = new Date();
    now.setUTCHours(utcHour, 0, 0, 0);
    return now.getHours();
  };

  // Format hour for display with timezone
  const formatHourWithTimezone = (utcHour: number): string => {
    const localHour = convertToLocalHour(utcHour);
    return `${localHour}:00 (${utcHour}:00 UTC)`;
  };

  // Export to PDF functionality
  const exportToPDF = async () => {
    // Simple text-based PDF export (would need jspdf library for real PDF)
    const reportContent = `
PERFORMANCE ANALYTICS REPORT
r/${subreddit}
Generated: ${new Date().toLocaleDateString()}

=== KEY METRICS ===
Average Upvotes: ${performanceData.user.avgUpvotes}
Success Rate: ${(performanceData.user.successRate * 100).toFixed(0)}%
Average Comments: ${performanceData.user.avgComments}
Total Posts: ${performanceData.user.totalPosts}
Rank: ${performanceData.user.vsGlobal?.percentile}th percentile

=== PEAK HOURS (Local Time) ===
${peakHoursData.peakHours.map(h => formatHourWithTimezone(h)).join(', ')}

=== RECOMMENDATIONS ===
${performanceData.recommendations.map((rec, i) => `${i + 1}. ${rec}`).join('\n')}
    `;

    // Create downloadable text file (placeholder until jspdf is added)
    const blob = new Blob([reportContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${subreddit}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-3xl font-bold">Performance Analytics</h1>
          <p className="text-gray-600">Real-time insights from your post history</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportToPDF}>
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
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
          {/* Historical Performance Graph */}
          {historicalData && historicalData.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Performance Trend (Last 30 Days)</CardTitle>
                <CardDescription>Track your improvement over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={historicalData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="date" 
                      tickFormatter={(date) => new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    />
                    <YAxis />
                    <Tooltip 
                      labelFormatter={(date) => new Date(date).toLocaleDateString()}
                      formatter={(value: number, name: string) => [
                        name === 'avgScore' ? `${Math.round(value)} upvotes` : `${value} posts`,
                        name === 'avgScore' ? 'Avg Score' : 'Posts'
                      ]}
                    />
                    <Legend />
                    <Line type="monotone" dataKey="avgScore" stroke="#8b5cf6" name="Avg Score" strokeWidth={2} />
                    <Line type="monotone" dataKey="totalPosts" stroke="#3b82f6" name="Posts" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

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
                Confidence: <Badge variant="outline">{peakHoursData.confidence}</Badge> • 
                Times shown in your timezone ({userTimezone})
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={heatmapData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="hour" 
                    tickFormatter={(hour) => `${convertToLocalHour(hour)}:00`}
                  />
                  <YAxis />
                  <Tooltip 
                    labelFormatter={(hour) => formatHourWithTimezone(hour)}
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
                        {convertToLocalHour(hour)}:00 local
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {peakHoursData.peakHours.map(h => `${h}:00`).join(', ')} UTC
                  </p>
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
