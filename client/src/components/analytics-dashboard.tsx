import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { 
  TrendingUp, 
  Users, 
  Eye, 
  Heart, 
  MessageCircle, 
  Share2,
  Calendar,
  Clock,
  Target,
  Zap
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { safeNumber, safeGet, safeArray, safeLocaleString } from "@/utils/safeDataAccess";

interface AnalyticsDashboardProps {
  isGuestMode?: boolean;
}

export function AnalyticsDashboard({ isGuestMode = false }: AnalyticsDashboardProps) {
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('7d');
  
  const { data: analytics } = useQuery({
    queryKey: ["/api/analytics", timeRange],
    enabled: !isGuestMode,
  });

  // Demo data for guest mode - minimal showcase
  const demoAnalytics = {
    totalPosts: 0,
    totalViews: 0,
    totalEngagement: 0,
    averageEngagementRate: 0,
    topPerformingPosts: [],
    growthMetrics: {
      viewsGrowth: 0,
      engagementGrowth: 0,
      followerGrowth: 0
    },
    bestPostingTimes: [
      { time: "09:00", score: 0 },
      { time: "19:00", score: 0 },
      { time: "12:00", score: 0 }
    ]
  };

  // Safe data access without unsafe type casting
  const data = isGuestMode ? demoAnalytics : {
    totalPosts: safeNumber(analytics?.totalPosts, 0),
    totalViews: safeNumber(analytics?.totalViews, 0),
    totalEngagement: safeNumber(analytics?.totalEngagement, 0),
    averageEngagementRate: safeNumber(analytics?.averageEngagementRate, 0),
    topPerformingPosts: safeArray(analytics?.topPerformingPosts, []),
    growthMetrics: {
      viewsGrowth: safeNumber(safeGet(analytics, 'growthMetrics.viewsGrowth', 0), 0),
      engagementGrowth: safeNumber(safeGet(analytics, 'growthMetrics.engagementGrowth', 0), 0),
      followerGrowth: safeNumber(safeGet(analytics, 'growthMetrics.followerGrowth', 0), 0)
    },
    bestPostingTimes: safeArray(analytics?.bestPostingTimes, demoAnalytics.bestPostingTimes)
  };

  // Safe metrics calculation with proper null handling
  const metrics = [
    {
      label: "Total Posts",
      value: safeNumber(data.totalPosts, 0),
      icon: <Calendar className="h-4 w-4" />,
      trend: "+0%",
      color: "text-blue-600"
    },
    {
      label: "Total Views",
      value: safeLocaleString(data.totalViews, 0),
      icon: <Eye className="h-4 w-4" />,
      trend: `+${safeNumber(data.growthMetrics.viewsGrowth, 0)}%`,
      color: "text-green-600"
    },
    {
      label: "Engagement",
      value: safeLocaleString(data.totalEngagement, 0),
      icon: <Heart className="h-4 w-4" />,
      trend: `+${safeNumber(data.growthMetrics.engagementGrowth, 0)}%`,
      color: "text-pink-600"
    },
    {
      label: "Avg. Rate",
      value: `${safeNumber(data.averageEngagementRate, 0).toFixed(1)}%`,
      icon: <TrendingUp className="h-4 w-4" />,
      trend: "+0%",
      color: "text-purple-600"
    }
  ];

  if (isGuestMode) {
    return (
      <Card className="border-orange-200 bg-gradient-to-r from-orange-50 to-yellow-50">
        <CardHeader>
          <CardTitle className="flex items-center">
            <TrendingUp className="mr-2 h-5 w-5 text-orange-600" />
            Analytics Preview
          </CardTitle>
          <CardDescription>
            See how your content performs with detailed analytics
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">0</div>
              <div className="text-sm text-orange-700">Posts Created</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">0.0%</div>
              <div className="text-sm text-orange-700">Avg. Engagement</div>
            </div>
          </div>
          
          <div className="p-4 bg-white rounded-lg border border-orange-200">
            <p className="text-sm text-orange-800 mb-2">
              <strong>Top Performing Content Types:</strong>
            </p>
            <ul className="text-xs text-orange-700 space-y-1">
              <li>• Morning selfies: 24% higher engagement</li>
              <li>• Lifestyle posts: 18% more views</li>
              <li>• Behind-the-scenes: 31% more comments</li>
            </ul>
          </div>
          
          <Button 
            className="w-full bg-orange-500 hover:bg-orange-600"
            onClick={() => window.location.href = '/login'}
          >
            Unlock Full Analytics
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Time Range Selector */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-medium">Performance Analytics</h3>
        <div className="flex space-x-2">
          {(['24h', '7d', '30d'] as const).map((range) => (
            <Button
              key={range}
              variant={timeRange === range ? "default" : "outline"}
              size="sm"
              onClick={() => setTimeRange(range)}
            >
              {range}
            </Button>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric, index) => (
          <Card key={index}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className={metric.color}>
                  {metric.icon}
                </div>
                <Badge variant="secondary" className="text-xs">
                  {metric.trend}
                </Badge>
              </div>
              <div className="mt-2">
                <div className="text-2xl font-bold">{metric.value}</div>
                <div className="text-sm text-gray-600">{metric.label}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Top Performing Posts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Zap className="mr-2 h-5 w-5" />
            Top Performing Posts
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.topPerformingPosts.map((post, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex-1">
                  <h4 className="font-medium">{post.title}</h4>
                  <div className="flex items-center space-x-4 text-sm text-gray-600">
                    <span className="flex items-center">
                      <Eye className="h-3 w-3 mr-1" />
                      {post.views.toLocaleString()}
                    </span>
                    <span className="flex items-center">
                      <Heart className="h-3 w-3 mr-1" />
                      {post.engagement}
                    </span>
                  </div>
                </div>
                <Badge variant="secondary">
                  #{index + 1}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Best Posting Times */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Clock className="mr-2 h-5 w-5" />
            Optimal Posting Times
          </CardTitle>
          <CardDescription>
            When your audience is most active
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.bestPostingTimes.map((time, index) => (
              <div key={index} className="flex items-center justify-between">
                <span className="font-medium">{time.time}</span>
                <div className="flex items-center space-x-2">
                  <Progress value={time.score} className="w-20" />
                  <span className="text-sm text-gray-600">{time.score}%</span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}