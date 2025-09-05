import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Users, Globe, Clock, TrendingUp, Calendar, Eye } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

interface AudienceData {
  platform: string;
  bestTime: string;
  activeUsers: string;
  engagement: number;
    age: string;
    location: string;
    interests: string[];
  };
}

export function AudienceInsights() {
  // Fetch real audience insights from analytics
  const { data: insightsData, isLoading } = useQuery({
    queryKey: ['audience-insights'],
    queryFn: async () => {
      const token = localStorage.getItem('authToken');
      if (!token) {
        return { audienceData: [], topSubreddits: [] };
      }
      
      try {
        const response = await fetch('/api/audience-insights', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) {
          throw new Error('Failed to fetch insights');
        }
        return response.json();
      } catch (error) {
        // Return empty data instead of mock data
        return { audienceData: [], topSubreddits: [] };
      }
    }
  });

  const audienceData: AudienceData[] = insightsData?.audienceData || [];
  const topSubreddits = insightsData?.topSubreddits || [];

  // Show message when no data is available
  if (!isLoading && audienceData.length === 0) {
    return (
      <div className="space-y-6">
        <Card className="bg-gray-900/50 backdrop-blur-xl border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-400" />
              Audience Insights
            </CardTitle>
            <CardDescription>
              Generate content to see audience analytics and insights
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <Eye className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-400">No audience data available yet</p>
              <p className="text-sm text-gray-500 mt-2">Start creating content to see insights about your audience</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Platform Performance */}
      <Card className="bg-gray-900/50 backdrop-blur-xl border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-purple-400" />
            Audience Insights
          </CardTitle>
          <CardDescription>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {audienceData.map((platform) => (
              <div key={platform.platform} className="p-4 bg-white/5 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-lg">{platform.platform}</h3>
                  <Badge variant="outline" className="text-purple-400 border-purple-400">
                    {platform.activeUsers} active
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-gray-400" />
                    <span className="text-gray-300">Best: {platform.bestTime}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Globe className="h-4 w-4 text-gray-400" />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Engagement Rate</span>
                    <span className="text-green-400">{platform.engagement}%</span>
                  </div>
                  <Progress value={platform.engagement} className="h-2" />
                </div>
                
                <div className="mt-3 flex flex-wrap gap-1">
                    <Badge key={interest} variant="secondary" className="text-xs">
                      {interest}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top Subreddits */}
      <Card className="bg-gray-900/50 backdrop-blur-xl border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-400" />
            Top Performing Subreddits
          </CardTitle>
          <CardDescription>
            Best communities for content promotion
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {topSubreddits.map((subreddit, index) => (
              <div key={subreddit.name} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-bold text-gray-500">#{index + 1}</span>
                  <div>
                    <p className="font-medium">{subreddit.name}</p>
                    <p className="text-xs text-gray-500">{subreddit.members} members</p>
                  </div>
                </div>
                <Badge variant="outline" className="text-green-400 border-green-400">
                  {subreddit.growth}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Best Posting Schedule */}
      <Card className="bg-gray-900/50 backdrop-blur-xl border-white/10">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-400" />
            Optimal Posting Schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-2 text-xs">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
              <div key={day} className="text-center">
                <p className="font-medium mb-2">{day}</p>
                <div className="space-y-1">
                  <div className="h-6 bg-green-500/20 rounded text-green-400 flex items-center justify-center">9PM</div>
                  <div className="h-6 bg-yellow-500/20 rounded text-yellow-400 flex items-center justify-center">3PM</div>
                  <div className="h-6 bg-gray-500/20 rounded text-gray-400 flex items-center justify-center">11AM</div>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500/20 rounded" />
              <span>High engagement</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-500/20 rounded" />
              <span>Medium</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-gray-500/20 rounded" />
              <span>Low</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}