import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { 
  TrendingUp, 
  TrendingDown, 
  Eye, 
  MessageCircle, 
  Users, 
  Zap,
  Search,
  Filter,
  ArrowUp,
  ArrowDown,
  Star,
  AlertCircle
} from 'lucide-react';

interface RedditTrendingTopic {
  topic: string;
  subreddit: string;
  score: number;
  comments: number;
  category: string;
  url: string;
  flair?: string;
  nsfw: boolean;
  postedAt: string;
  complianceWarnings?: string[];
  verificationRequired?: boolean;
  promotionAllowed?: string;
  cooldownHours?: number | null;
}

interface SubredditHealthMetric {
  subreddit: string;
  members: number;
  posts24h: number;
  avgEngagement: number;
  growthTrend: string;
  modActivity: string;
  trendingActivity: boolean;
  competitionLevel: string | null;
}

interface RedditForecastingSignal {
  subreddit: string;
  signal: string;
  confidence: number;
  rationale: string;
  projectedEngagement: number;
}

interface RedditIntelligenceDataset {
  fetchedAt: string;
  trendingTopics: RedditTrendingTopic[];
  subredditHealth: SubredditHealthMetric[];
  forecastingSignals: RedditForecastingSignal[];
}

export function TrendIntelligence() {
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const { data: intelligence, isLoading, error } = useQuery<RedditIntelligenceDataset>({
    queryKey: ['/api/reddit/intelligence'],
  });

  // Helper functions
  const formatProjectedEngagement = (value: number | null | undefined) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      return 'N/A';
    }

    if (value >= 1_000_000) {
      return `${(value / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
    }

    if (value >= 1_000) {
      return `${(value / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
    }

    return value.toLocaleString();
  };

  const resolveSignalTitle = (value: string) => {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : 'Forecasted opportunity';
  };

  const resolveSubredditLabel = (value: string) => {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : 'Unknown subreddit';
  };

  const resolveRationale = (value: string) => {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'rising': return <TrendingUp className="h-4 w-4 text-green-400" />;
      case 'declining': return <TrendingDown className="h-4 w-4 text-red-400" />;
      default: return <div className="h-4 w-4 rounded-full bg-yellow-400" />;
    }
  };

  const getTrendColor = (trend: string) => {
    switch (trend) {
      case 'rising': return 'text-green-400';
      case 'declining': return 'text-red-400';
      default: return 'text-yellow-400';
    }
  };

  // Derive trending topics with metadata
  const trendingTopics = intelligence?.trendingTopics || [];
  const subredditHealth = intelligence?.subredditHealth || [];
  const forecastingSignals = intelligence?.forecastingSignals || [];
  const topForecastingSignal = forecastingSignals[0];
  const topForecastingSignalDetails = topForecastingSignal
    ? {
        title: resolveSignalTitle(topForecastingSignal.signal),
        subreddit: resolveSubredditLabel(topForecastingSignal.subreddit),
        rationale: resolveRationale(topForecastingSignal.rationale),
        projectedEngagement: formatProjectedEngagement(topForecastingSignal.projectedEngagement),
        confidence: topForecastingSignal.confidence,
      }
    : null;

  // Filter trending topics
  const filteredTopics = trendingTopics.filter(topic => {
    const matchesSearch = topic.topic.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         topic.category.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  }).slice(0, 20);

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Trend Intelligence
            </h2>
            <p className="text-muted-foreground mt-1">Loading intelligence data...</p>
          </div>
        </div>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Card key={i} className="bg-gradient-to-r from-gray-900/50 to-gray-800/50 border-gray-700/50">
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2 mt-2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
              Trend Intelligence
            </h2>
          </div>
        </div>
        <Card className="bg-gradient-to-r from-red-900/20 to-red-800/20 border-red-500/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <AlertCircle className="h-5 w-5 text-red-400" />
              Failed to Load Intelligence Data
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-300">
              {error instanceof Error ? error.message : 'An unknown error occurred'}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Trend Intelligence
          </h2>
          <p className="text-muted-foreground mt-1">
            AI-powered trend analysis and content optimization insights
          </p>
          {intelligence && (
            <p className="text-xs text-gray-500 mt-1">
              Last updated: {new Date(intelligence.fetchedAt).toLocaleString()}
            </p>
          )}
        </div>
        <Badge variant="secondary" className="bg-purple-500/10 text-purple-400 border-purple-500/20">
          Live Data
        </Badge>
      </div>

      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="trends" data-testid="tab-trends">Trending Topics</TabsTrigger>
          <TabsTrigger value="suggestions" data-testid="tab-suggestions">Content Ideas</TabsTrigger>
          <TabsTrigger value="subreddits" data-testid="tab-subreddits">Subreddit Analysis</TabsTrigger>
          <TabsTrigger value="insights" data-testid="tab-insights">AI Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-4">
          {/* Search and Filter */}
          <div className="flex items-center space-x-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-gray-900/50 border-gray-700"
                data-testid="search-trends"
              />
            </div>
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-400" />
              {['all', 'rising', 'stable', 'declining'].map((filter) => (
                <Badge
                  key={filter}
                  variant={activeFilter === filter ? 'default' : 'outline'}
                  className={`cursor-pointer capitalize ${
                    activeFilter === filter 
                      ? 'bg-purple-500 hover:bg-purple-600' 
                      : 'border-gray-600 hover:border-purple-500'
                  }`}
                  onClick={() => setActiveFilter(filter)}
                  data-testid={`filter-${filter}`}
                >
                  {filter}
                </Badge>
              ))}
            </div>
          </div>

          {/* Trending Topics */}
          <div className="grid gap-4">
            {filteredTopics.length === 0 ? (
              <Card className="bg-gradient-to-r from-gray-900/50 to-gray-800/50 border-gray-700/50">
                <CardContent className="py-12 text-center">
                  <Search className="h-12 w-12 mx-auto mb-4 text-gray-500" />
                  <p className="text-gray-400">No trending topics found</p>
                </CardContent>
              </Card>
            ) : (
              filteredTopics.map((topic, index) => (
                <Card key={index} className="bg-gradient-to-r from-gray-900/50 to-gray-800/50 border-gray-700/50">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <div className="flex items-center space-x-3">
                      <TrendingUp className="h-4 w-4 text-green-400" />
                      <div>
                        <CardTitle className="text-lg text-white">{topic.topic}</CardTitle>
                        <div className="flex items-center gap-2">
                          <p className="text-sm text-gray-400">{topic.subreddit}</p>
                          {topic.nsfw && (
                            <Badge variant="destructive" className="text-xs">NSFW</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-white">{Math.round(topic.score / 10)}</div>
                      <p className="text-xs text-gray-400">Score</p>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Compliance Warnings */}
                    {topic.complianceWarnings && topic.complianceWarnings.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {topic.complianceWarnings.map((warning, wIndex) => (
                          <Badge
                            key={wIndex}
                            variant="outline"
                            className="text-xs border-yellow-500/50 text-yellow-400"
                          >
                            <AlertCircle className="h-3 w-3 mr-1" />
                            {warning}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* Stats */}
                    <div className="flex items-center justify-between text-sm">
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center gap-1">
                          <MessageCircle className="h-4 w-4 text-purple-400" />
                          <span className="text-gray-400">{topic.comments} comments</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Eye className="h-4 w-4 text-purple-400" />
                          <span className="text-gray-400">{topic.category}</span>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(topic.url, '_blank')}
                        data-testid={`view-topic-${index}`}
                      >
                        View Post
                      </Button>
                    </div>

                    {/* Flair if available */}
                    {topic.flair && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">Flair:</span>
                        <Badge variant="secondary" className="text-xs">
                          {topic.flair}
                        </Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="suggestions" className="space-y-4">
          {forecastingSignals.length === 0 ? (
            <Card className="bg-gradient-to-r from-gray-900/50 to-gray-800/50 border-gray-700/50">
              <CardContent className="py-12 text-center">
                <Zap className="h-12 w-12 mx-auto mb-4 text-gray-500" />
                <p className="text-gray-400">No content suggestions available yet</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {forecastingSignals.slice(0, 5).map((signal, index) => {
                const title = resolveSignalTitle(signal.signal);
                const subredditLabel = resolveSubredditLabel(signal.subreddit);
                const rationale = resolveRationale(signal.rationale) ?? 'No rationale provided yet.';
                const projection = formatProjectedEngagement(signal.projectedEngagement);
                const projectionLabel = projection === 'N/A' ? 'Unavailable' : projection;

                return (
                  <Card key={index} className="bg-gradient-to-r from-gray-900/50 to-gray-800/50 border-gray-700/50">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0">
                      <div>
                        <CardTitle className="text-lg text-white">{title}</CardTitle>
                        <p className="text-sm text-gray-400">Post to r/{subredditLabel}</p>
                      </div>
                      <Badge
                        variant={signal.confidence >= 80 ? 'default' : 'secondary'}
                        className={
                          signal.confidence >= 80
                            ? 'bg-green-500/20 text-green-400 border-green-500/20'
                            : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/20'
                        }
                      >
                        {signal.confidence}% Confidence
                      </Badge>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-gray-300">{rationale}</p>
                      <div className="flex items-center gap-2 text-sm">
                        <TrendingUp className="h-4 w-4 text-purple-400" />
                        <span className="text-gray-400">Projected engagement:</span>
                        <span className="font-medium text-white">{projectionLabel}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="subreddits" className="space-y-4">
          <div className="grid gap-4">
            {subredditHealth.length === 0 ? (
              <Card className="bg-gradient-to-r from-gray-900/50 to-gray-800/50 border-gray-700/50">
                <CardContent className="py-12 text-center">
                  <Users className="h-12 w-12 mx-auto mb-4 text-gray-500" />
                  <p className="text-gray-400">No subreddit health metrics available</p>
                </CardContent>
              </Card>
            ) : (
              subredditHealth.slice(0, 15).map((subreddit, index) => (
                <Card key={index} className="bg-gradient-to-r from-gray-900/50 to-gray-800/50 border-gray-700/50">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <div>
                      <CardTitle className="text-lg text-white">{subreddit.subreddit}</CardTitle>
                      <div className="flex items-center space-x-4 text-sm text-gray-400">
                        <span>{subreddit.posts24h}/day</span>
                        <span>•</span>
                        <span>{subreddit.avgEngagement.toFixed(1)}% avg engagement</span>
                        <span>•</span>
                        <span>{(subreddit.members / 1000).toFixed(0)}K members</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      {subreddit.growthTrend === 'up' && <ArrowUp className="h-4 w-4 text-green-400" />}
                      {subreddit.growthTrend === 'down' && <ArrowDown className="h-4 w-4 text-red-400" />}
                      {subreddit.growthTrend === 'stable' && <div className="h-4 w-4 rounded-full bg-yellow-400" />}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-400">Mod Activity:</span>
                        <Badge
                          variant="outline"
                          className={`text-xs ${
                            subreddit.modActivity === 'high' ? 'border-green-500 text-green-400' :
                            subreddit.modActivity === 'medium' ? 'border-yellow-500 text-yellow-400' :
                            'border-gray-600 text-gray-400'
                          }`}
                        >
                          {subreddit.modActivity}
                        </Badge>
                        {subreddit.trendingActivity && (
                          <Badge variant="secondary" className="text-xs bg-purple-500/20 text-purple-300">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            Trending
                          </Badge>
                        )}
                      </div>
                    </div>

                    {subreddit.competitionLevel && (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-400">Competition:</span>
                        <Badge variant="outline" className="text-xs">
                          {subreddit.competitionLevel}
                        </Badge>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <div className="grid gap-4">
            {topForecastingSignalDetails && (
              <Card className="bg-gradient-to-r from-purple-900/20 to-pink-900/20 border-purple-500/20">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Star className="h-5 w-5 text-yellow-400" />
                    Top Forecasting Signal
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <p className="text-gray-300">
                    <span className="font-semibold text-purple-400">{topForecastingSignalDetails.title}</span>{' '}
                    for{' '}
                    <span className="font-semibold text-purple-400">r/{topForecastingSignalDetails.subreddit}</span>.
                  </p>
                  {topForecastingSignalDetails.rationale && (
                    <p className="text-sm text-gray-400">
                      {topForecastingSignalDetails.rationale}
                    </p>
                  )}
                  <p className="text-xs text-gray-400">
                    Confidence: {topForecastingSignalDetails.confidence}% • Projected engagement:{' '}
                    {topForecastingSignalDetails.projectedEngagement === 'N/A'
                      ? 'Unavailable'
                      : topForecastingSignalDetails.projectedEngagement}
                  </p>
                </CardContent>
              </Card>
            )}

            <Card className="bg-gradient-to-r from-gray-900/50 to-gray-800/50 border-gray-700/50">
              <CardHeader>
                <CardTitle className="text-white">Forecasting Signals</CardTitle>
                <p className="text-sm text-gray-400">AI-powered growth predictions</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {forecastingSignals.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <TrendingUp className="h-12 w-12 mx-auto mb-4 text-purple-400" />
                    <p>No forecasting signals available yet</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {forecastingSignals.slice(0, 5).map((signal, index) => {
                      const confidenceColor = signal.confidence >= 80 ? 'green' : signal.confidence >= 60 ? 'yellow' : 'blue';
                      const title = resolveSignalTitle(signal.signal);
                      const rationale = resolveRationale(signal.rationale) ?? 'No rationale provided yet.';
                      const projectedEngagement = formatProjectedEngagement(signal.projectedEngagement);
                      const projectionLabel = projectedEngagement === 'N/A' ? 'Projection unavailable' : `Projected ${projectedEngagement}`;
                      const subredditLabel = resolveSubredditLabel(signal.subreddit);
                      return (
                        <div
                          key={index}
                          className={`flex items-start space-x-3 p-3 rounded-lg bg-${confidenceColor}-500/10 border border-${confidenceColor}-500/20`}
                        >
                          <TrendingUp className={`h-5 w-5 text-${confidenceColor}-400 mt-0.5`} />
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between flex-wrap gap-2">
                              <h4 className={`font-medium text-${confidenceColor}-400`}>{title}</h4>
                              <Badge variant="outline" className="text-xs">{projectionLabel}</Badge>
                            </div>
                            <p className="text-sm text-gray-300">{rationale}</p>
                            <p className="text-xs text-gray-400">Subreddit: r/{subredditLabel} • Confidence: {signal.confidence}%</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-gray-900/50 to-gray-800/50 border-gray-700/50">
              <CardHeader>
                <CardTitle className="text-white">Category Distribution</CardTitle>
                <p className="text-sm text-gray-400">Content categories currently trending</p>
              </CardHeader>
              <CardContent>
                {trendingTopics.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <Eye className="h-12 w-12 mx-auto mb-4 text-purple-400" />
                    <p>No category data available</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {Array.from(new Set(trendingTopics.map(t => t.category)))
                      .slice(0, 5)
                      .map((category, index) => {
                        const count = trendingTopics.filter(t => t.category === category).length;
                        const percentage = (count / trendingTopics.length) * 100;
                        return (
                          <div key={index} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-400">{category}</span>
                              <span className="text-white font-medium">{count} topics ({percentage.toFixed(0)}%)</span>
                            </div>
                            <Progress value={percentage} className="h-2" />
                          </div>
                        );
                      })}
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