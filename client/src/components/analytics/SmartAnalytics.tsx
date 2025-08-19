import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area
} from 'recharts';
import {
  TrendingUp, TrendingDown, Eye, Heart, MessageCircle, Share2, DollarSign,
  Target, Clock, Zap, Star, Users, Calendar, Award, Brain, Sparkles
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

export default function SmartAnalytics() {
  const [timeRange, setTimeRange] = useState('7d');
  
  // Mock data - replace with real API call
  const { data: analyticsData, isLoading } = useQuery<AnalyticsData>({
    queryKey: ['/api/analytics/smart', timeRange],
    queryFn: () => Promise.resolve({
      totalRevenue: 12847,
      revenueChange: 18.5,
      totalViews: 187340,
      viewsChange: 12.3,
      engagementRate: 14.8,
      engagementChange: 5.7,
      topPerformingContent: [
        { id: '1', title: 'Morning workout routine ✨', platform: 'Reddit', views: 15420, engagement: 18.5, revenue: 340 },
        { id: '2', title: 'Cozy evening vibes 💕', platform: 'Instagram', views: 12300, engagement: 16.2, revenue: 285 },
        { id: '3', title: 'Weekend adventures!', platform: 'Twitter', views: 9800, engagement: 15.1, revenue: 220 }
      ],
      revenueByPlatform: [
        { platform: 'Reddit', revenue: 6500, percentage: 50.6 },
        { platform: 'Instagram', revenue: 3200, percentage: 24.9 },
        { platform: 'Twitter', revenue: 2100, percentage: 16.4 },
        { platform: 'TikTok', revenue: 1047, percentage: 8.1 }
      ],
      performanceTimeline: [
        { date: '2024-01-01', views: 12000, engagement: 14.2, revenue: 280 },
        { date: '2024-01-02', views: 15500, engagement: 16.8, revenue: 340 },
        { date: '2024-01-03', views: 18200, engagement: 15.3, revenue: 410 },
        { date: '2024-01-04', views: 14800, engagement: 17.1, revenue: 320 },
        { date: '2024-01-05', views: 21000, engagement: 18.5, revenue: 480 },
        { date: '2024-01-06', views: 19500, engagement: 16.9, revenue: 450 },
        { date: '2024-01-07', views: 23100, engagement: 19.2, revenue: 520 }
      ],
      aiInsights: {
        bestPostingTimes: ['9:00 AM', '6:30 PM', '10:15 PM'],
        topPerformingTags: ['#workout', '#aesthetic', '#mood', '#lifestyle'],
        contentRecommendations: [
          'Morning routine content performs 25% better',
          'Workout posts get 40% higher engagement',
          'Evening mood posts drive more subscriptions'
        ],
        engagementPredictions: {
          nextWeek: 21.3,
          confidence: 0.87
        }
      }
    })
  });

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

  const data = analyticsData!;

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
                  <p className="text-2xl font-bold text-white">${data.totalRevenue.toLocaleString()}</p>
                  <div className="flex items-center space-x-1">
                    <TrendingUp className="h-4 w-4 text-green-400" />
                    <span className="text-sm text-green-400">+{data.revenueChange}%</span>
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
                  <p className="text-2xl font-bold text-white">{data.totalViews.toLocaleString()}</p>
                  <div className="flex items-center space-x-1">
                    <TrendingUp className="h-4 w-4 text-blue-400" />
                    <span className="text-sm text-blue-400">+{data.viewsChange}%</span>
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
                  <p className="text-2xl font-bold text-white">{data.engagementRate}%</p>
                  <div className="flex items-center space-x-1">
                    <TrendingUp className="h-4 w-4 text-purple-400" />
                    <span className="text-sm text-purple-400">+{data.engagementChange}%</span>
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
                  <p className="text-2xl font-bold text-white">{data.aiInsights.engagementPredictions.nextWeek}%</p>
                  <div className="flex items-center space-x-1">
                    <Brain className="h-4 w-4 text-yellow-400" />
                    <span className="text-sm text-yellow-400">{Math.round(data.aiInsights.engagementPredictions.confidence * 100)}% confident</span>
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
                <AreaChart data={data.performanceTimeline}>
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
                {data.topPerformingContent.map((content, index) => (
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
                          <span className="text-gray-300">{content.views.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Heart className="h-4 w-4 text-purple-400" />
                          <span className="text-gray-300">{content.engagement}%</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          <DollarSign className="h-4 w-4 text-green-400" />
                          <span className="text-gray-300">${content.revenue}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
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
                {data.aiInsights.contentRecommendations.map((rec, index) => (
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
                {data.aiInsights.bestPostingTimes.map((time, index) => (
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
              </CardContent>
            </Card>

            <Card className="bg-gray-800 border-purple-500/20">
              <CardHeader>
                <CardTitle className="text-white">Platform Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data.revenueByPlatform.map((platform, index) => (
                  <div key={platform.platform} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-white font-medium">{platform.platform}</span>
                      <span className="text-sm text-gray-400">${platform.revenue.toLocaleString()}</span>
                    </div>
                    <Progress
                      value={platform.percentage}
                      className="h-2"
                      style={{ backgroundColor: COLORS[index % COLORS.length] + '20' }}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}