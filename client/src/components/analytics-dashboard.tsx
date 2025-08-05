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

interface AnalyticsDashboardProps {
  isGuestMode?: boolean;
}

export function AnalyticsDashboard({ isGuestMode = false }: AnalyticsDashboardProps) {
  const [timeRange, setTimeRange] = useState<'24h' | '7d' | '30d'>('7d');
  
  const { data: analytics } = useQuery({
    queryKey: ["/api/analytics", timeRange],
    enabled: !isGuestMode,
  });

  // Demo data for guest mode
  const demoAnalytics = {
    totalPosts: 47,
    totalViews: 12840,
    totalEngagement: 1920,
    averageEngagementRate: 14.9,
    topPerformingPosts: [
      { title: "Cozy morning selfie ☀️", views: 2400, engagement: 360 },
      { title: "New outfit vibes ✨", views: 1950, engagement: 292 },
      { title: "Workout complete! 💪", views: 1680, engagement: 252 }
    ],
    growthMetrics: {
      viewsGrowth: 24.5,
      engagementGrowth: 18.2,
      followerGrowth: 12.3
    },
    bestPostingTimes: [
      { time: "9:00 AM", score: 95 },
      { time: "7:00 PM", score: 88 },
      { time: "12:00 PM", score: 73 }
    ]
  };

  const data = isGuestMode ? demoAnalytics : analytics || demoAnalytics;

  const metrics = [
    {
      label: "Total Posts",
      value: data.totalPosts,
      icon: <Calendar className="h-4 w-4" />,
      trend: "+12%",
      color: "text-blue-600"
    },
    {
      label: "Total Views",
      value: data.totalViews.toLocaleString(),
      icon: <Eye className="h-4 w-4" />,
      trend: `+${data.growthMetrics.viewsGrowth}%`,
      color: "text-green-600"
    },
    {
      label: "Engagement",
      value: data.totalEngagement.toLocaleString(),
      icon: <Heart className="h-4 w-4" />,
      trend: `+${data.growthMetrics.engagementGrowth}%`,
      color: "text-pink-600"
    },
    {
      label: "Avg. Rate",
      value: `${data.averageEngagementRate}%`,
      icon: <TrendingUp className="h-4 w-4" />,
      trend: "+2.1%",
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
              <div className="text-2xl font-bold text-orange-600">47</div>
              <div className="text-sm text-orange-700">Posts Created</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">14.9%</div>
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