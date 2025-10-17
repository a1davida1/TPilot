/**
 * Reddit Intelligence Dashboard
 * Real-time insights and analytics for content creators
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  TrendingUp, 
  Clock, 
  Lightbulb, 
  BarChart3,
  Sparkles,
  AlertCircle,
  RefreshCw,
  ChevronRight,
  Flame
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import { cn } from '@/lib/utils';

interface TrendingTopic {
  topic: string;
  subreddit: string;
  score: number;
  comments: number;
  category: string;
  url: string;
  nsfw: boolean;
  confidence: number;
}

interface OptimalTime {
  time: string;
  day: string;
  score: number;
  competition: 'low' | 'medium' | 'high';
  engagement: number;
}

interface ContentSuggestion {
  title: string;
  description: string;
  confidence: number;
  category: string;
  examples: string[];
}

interface SubredditMetrics {
  subreddit: string;
  members: number;
  activeUsers: number;
  growthRate: number;
  engagementRate: number;
  bestPostingTimes: OptimalTime[];
  topContent: string[];
}

export function IntelligenceDashboard() {
  useAuth();
  const [selectedSubreddit] = useState<string>('gonewild');
  const [refreshing, setRefreshing] = useState(false);

  // Fetch trending topics
  const { data: trends, isLoading: trendsLoading, refetch: refetchTrends } = useQuery<TrendingTopic[]>({
    queryKey: ['/api/intelligence/trends', selectedSubreddit],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/intelligence/trends/${selectedSubreddit}`);
      return response as unknown as TrendingTopic[];
    },
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  // Fetch optimal posting times
  const { data: optimalTimes, isLoading: timesLoading } = useQuery<OptimalTime[]>({
    queryKey: ['/api/intelligence/optimal-times', selectedSubreddit],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/intelligence/optimal-times/${selectedSubreddit}`);
      return response as unknown as OptimalTime[];
    },
  });

  // Fetch content suggestions
  const { data: suggestions, isLoading: suggestionsLoading } = useQuery<ContentSuggestion[]>({
    queryKey: ['/api/intelligence/suggestions'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/intelligence/suggestions');
      return response as unknown as ContentSuggestion[];
    },
  });

  // Fetch performance metrics
  const { data: metrics, isLoading: metricsLoading } = useQuery<SubredditMetrics>({
    queryKey: ['/api/intelligence/performance', selectedSubreddit],
    queryFn: async () => {
      const response = await apiRequest('GET', `/api/intelligence/performance?subreddit=${selectedSubreddit}`);
      return response as unknown as SubredditMetrics;
    },
  });

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      refetchTrends(),
    ]);
    setRefreshing(false);
  };

  const getCompetitionColor = (competition: string) => {
    switch (competition) {
      case 'low':
        return 'text-green-500';
      case 'medium':
        return 'text-yellow-500';
      case 'high':
        return 'text-red-500';
      default:
        return 'text-gray-500';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 80) return 'bg-green-100 text-green-800';
    if (confidence >= 60) return 'bg-yellow-100 text-yellow-800';
    return 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Reddit Intelligence
          </h2>
          <p className="text-muted-foreground mt-1">
            Real-time insights and trends across Reddit communities
          </p>
        </div>
        <Button 
          onClick={handleRefresh}
          disabled={refreshing}
          variant="outline"
        >
          <RefreshCw className={cn("h-4 w-4 mr-2", refreshing && "animate-spin")} />
          Refresh Data
        </Button>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Active Trends</CardDescription>
            <CardTitle className="text-2xl">
              {trends?.length || 0}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Avg Engagement</CardDescription>
            <CardTitle className="text-2xl">
              {metrics?.engagementRate ? `${metrics.engagementRate}%` : '—'}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Community Size</CardDescription>
            <CardTitle className="text-2xl">
              {metrics?.members ? `${(metrics.members / 1000).toFixed(0)}k` : '—'}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription>Active Now</CardDescription>
            <CardTitle className="text-2xl">
              {metrics?.activeUsers || '—'}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="trends">Trending</TabsTrigger>
          <TabsTrigger value="timing">Best Times</TabsTrigger>
          <TabsTrigger value="suggestions">Suggestions</TabsTrigger>
          <TabsTrigger value="metrics">Analytics</TabsTrigger>
        </TabsList>

        {/* Trending Topics Tab */}
        <TabsContent value="trends" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Trending Topics
              </CardTitle>
              <CardDescription>
                Hot topics and viral content across Reddit right now
              </CardDescription>
            </CardHeader>
            <CardContent>
              {trendsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-20 bg-muted animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : trends && trends.length > 0 ? (
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {trends.map((trend, index) => (
                      <div 
                        key={index}
                        className="p-4 border rounded-lg hover:bg-accent transition-colors cursor-pointer"
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Flame className="h-4 w-4 text-orange-500" />
                              <span className="font-semibold">{trend.topic}</span>
                              {trend.nsfw && (
                                <Badge variant="destructive" className="text-xs">NSFW</Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <span>r/{trend.subreddit}</span>
                              <span>•</span>
                              <span>{trend.score} points</span>
                              <span>•</span>
                              <span>{trend.comments} comments</span>
                            </div>
                            <Badge 
                              className={cn("mt-2", getConfidenceColor(trend.confidence))}
                              variant="secondary"
                            >
                              {trend.confidence}% confidence
                            </Badge>
                          </div>
                          <Button variant="ghost" size="sm">
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No trending topics found. Try refreshing or selecting a different subreddit.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Optimal Times Tab */}
        <TabsContent value="timing" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Optimal Posting Times
              </CardTitle>
              <CardDescription>
                Best times to post for maximum engagement
              </CardDescription>
            </CardHeader>
            <CardContent>
              {timesLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : optimalTimes && optimalTimes.length > 0 ? (
                <div className="space-y-3">
                  {optimalTimes.map((time, index) => (
                    <div 
                      key={index}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-4">
                        <Clock className="h-8 w-8 text-muted-foreground" />
                        <div>
                          <p className="font-semibold">{time.day} at {time.time}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-sm text-muted-foreground">
                              Competition:
                            </span>
                            <span className={cn("text-sm font-medium", getCompetitionColor(time.competition))}>
                              {time.competition}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold">{time.score}</p>
                        <p className="text-xs text-muted-foreground">Score</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No optimal posting times available. Try selecting a different subreddit.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Content Suggestions Tab */}
        <TabsContent value="suggestions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lightbulb className="h-5 w-5" />
                Content Suggestions
              </CardTitle>
              <CardDescription>
                AI-powered content ideas based on current trends
              </CardDescription>
            </CardHeader>
            <CardContent>
              {suggestionsLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-24 bg-muted animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : suggestions && suggestions.length > 0 ? (
                <div className="grid gap-4">
                  {suggestions.map((suggestion, index) => (
                    <Card key={index} className="border-l-4 border-l-purple-500">
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Sparkles className="h-4 w-4 text-purple-500" />
                              <h4 className="font-semibold">{suggestion.title}</h4>
                            </div>
                            <p className="text-sm text-muted-foreground mb-3">
                              {suggestion.description}
                            </p>
                            {suggestion.examples && suggestion.examples.length > 0 && (
                              <div className="space-y-1">
                                <p className="text-xs font-medium text-muted-foreground">Examples:</p>
                                {suggestion.examples.map((example, i) => (
                                  <p key={i} className="text-xs text-muted-foreground pl-2">
                                    • {example}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                          <Badge className={getConfidenceColor(suggestion.confidence)}>
                            {suggestion.confidence}%
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No content suggestions available. Try refreshing the data.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Performance Metrics Tab */}
        <TabsContent value="metrics" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Performance Analytics
              </CardTitle>
              <CardDescription>
                Detailed metrics for r/{selectedSubreddit}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {metricsLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
                  ))}
                </div>
              ) : metrics ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Members</span>
                        <span className="font-medium">{metrics.members?.toLocaleString()}</span>
                      </div>
                      <Progress value={75} className="h-2" />
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-sm text-muted-foreground">Active Users</span>
                        <span className="font-medium">{metrics.activeUsers?.toLocaleString()}</span>
                      </div>
                      <Progress value={(metrics.activeUsers / metrics.members) * 100} className="h-2" />
                    </div>
                  </div>
                  
                  <div className="pt-4 border-t">
                    <p className="text-sm font-medium mb-2">Growth Rate</p>
                    <div className="flex items-center gap-2">
                      <TrendingUp className={cn(
                        "h-4 w-4",
                        metrics.growthRate > 0 ? "text-green-500" : "text-red-500"
                      )} />
                      <span className={cn(
                        "text-2xl font-bold",
                        metrics.growthRate > 0 ? "text-green-500" : "text-red-500"
                      )}>
                        {metrics.growthRate > 0 ? '+' : ''}{metrics.growthRate}%
                      </span>
                      <span className="text-sm text-muted-foreground">this week</span>
                    </div>
                  </div>

                  {metrics.topContent && metrics.topContent.length > 0 && (
                    <div className="pt-4 border-t">
                      <p className="text-sm font-medium mb-2">Top Performing Content</p>
                      <div className="space-y-2">
                        {metrics.topContent.slice(0, 3).map((content, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <Badge variant="outline">{i + 1}</Badge>
                            <p className="text-sm text-muted-foreground">{content}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    No metrics available for this subreddit.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
