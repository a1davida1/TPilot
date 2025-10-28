import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import {
  TrendingUp,
  Clock,
  Target,
  AlertTriangle,
  CheckCircle,
  BarChart3,
  MessageSquare,
  Smile,
  Hash,
  Zap,
  Users,
  Shield,
  Calendar,
  ArrowUp,
  ArrowDown,
  Minus,
  Loader2,
  Lightbulb,
  Award
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface TitleAnalysis {
  sampleSize: number;
  daysAnalyzed: number;
  overview: {
    avgTitleLength: number;
    lengthRange: { min: number; max: number };
    questionRatio: number;
    emojiUsageRate: number;
    sentiment: { type: 'playful' | 'direct'; confidence: number };
  };
  questionAnalysis: {
    percentage: number;
    avgEngagement: number;
    vsStatements: number;
    verdict: string;
  };
  emojiAnalysis: {
    usageRate: number;
    avgEngagementWithEmoji: number;
    avgEngagementWithoutEmoji: number;
    topEmojis: Array<{ emoji: string; count: number; percentage: number }>;
    verdict: string;
  };
  lengthAnalysis: Array<{
    range: string;
    posts: number;
    avgEngagement: number;
    percentage: number;
  }>;
  topKeywords: Array<{ word: string; count: number; percentage: number }>;
  recommendations: string[];
}

interface PostingCadence {
  sampleSize: number;
  daysAnalyzed: number;
  currentCadence: {
    avgGapHours: number;
    minGapHours: number;
    maxGapHours: number;
    postsPerWeek: number;
    consistency: 'consistent' | 'inconsistent';
  };
  optimalCadence: {
    recommendedGapHours: number;
    postsPerWeek: number;
  };
  gapAnalysis: Array<{
    range: string;
    posts: number;
    avgEngagement: number;
    percentage: number;
  }>;
  status: 'over-posting' | 'optimal' | 'under-posting' | 'inconsistent';
  engagementTrend: {
    direction: 'improving' | 'declining' | 'stable';
    firstHalfAvg: number;
    secondHalfAvg: number;
    changePercent: number;
  };
  warnings: {
    diminishingReturns: boolean;
    burnoutDetected: boolean;
    overPosting: boolean;
    inconsistentSchedule: boolean;
  };
  recommendation: string;
  insights: string[];
}

interface SubredditRecommendations {
  sampleSize: number;
  basedOn: Array<{ subreddit: string; successRate: number; posts: number }>;
  summary: {
    totalRecommendations: number;
    lowRisk: number;
    mediumRisk: number;
    highRisk: number;
  };
  recommendations: {
    lowRisk: Array<CommunityRecommendation>;
    mediumRisk: Array<CommunityRecommendation>;
    highRisk: Array<CommunityRecommendation>;
  };
  insights: string[];
}

interface CommunityRecommendation {
  subreddit: string;
  members: number;
  description: string;
  score: number;
  competition: 'low' | 'medium' | 'high';
  riskLevel: 'low' | 'medium' | 'high';
  risks: string[];
  opportunities: string[];
  requirements: {
    verification: boolean;
    minKarma: number;
    minAccountAge: number;
    promotionAllowed: string;
  };
  similarity: {
    sizeRatio: number;
    nsfwMatch: boolean;
    avgMemberCount: number;
  };
}

export function IntelligenceInsightsPage() {
  const { user } = useAuth();
  const [selectedSubreddit, setSelectedSubreddit] = useState<string>('');
  const [activeTab, setActiveTab] = useState('title');

const fetchJson = async <T>(endpoint: string): Promise<T> => {
  try {
    const response = await apiRequest('GET', endpoint);
    if (!response.ok) {
      const body: unknown = await response.json().catch(() => ({} as unknown));
      const message = typeof (body as { error?: unknown }).error === 'string'
        ? (body as { error: string }).error
        : typeof (body as { message?: unknown }).message === 'string'
          ? (body as { message: string }).message
          : response.statusText || 'Request failed';
      throw new Error(message);
    }
    return response.json() as Promise<T>;
  } catch (error) {
    throw error instanceof Error ? error : new Error('Network request failed');
  }
};```

  const parseCommunityOptions = (value: unknown): Array<{ id: string; name: string; displayName: string }> => {
    if (!Array.isArray(value)) {
      return [];
    }
    return value
      .map((entry) => {
        if (!entry || typeof entry !== 'object') {
          return null;
        }
        const candidate = entry as Record<string, unknown>;
        const id = typeof candidate.id === 'string' && candidate.id.trim().length > 0
          ? candidate.id.trim()
          : typeof candidate.name === 'string' && candidate.name.trim().length > 0
            ? candidate.name.trim()
            : null;
        if (!id) {
          return null;
        }
        const name = typeof candidate.name === 'string' && candidate.name.trim().length > 0
          ? candidate.name.trim()
          : id;
        const displayName = typeof candidate.displayName === 'string' && candidate.displayName.trim().length > 0
          ? candidate.displayName.trim()
          : name;
        return { id, name, displayName };
      })
      .filter((entry): entry is { id: string; name: string; displayName: string } => Boolean(entry));
  };

  // Fetch user's subreddits
  const { data: subreddits = [] } = useQuery<{ id: string; name: string; displayName: string }[]>({
    queryKey: ['/api/reddit/communities'],
    enabled: !!user,
    queryFn: async () => parseCommunityOptions(await fetchJson<unknown>('/api/reddit/communities')),
  });

useEffect(() => {
  if (!selectedSubreddit && subreddits.length > 0) {
    setSelectedSubreddit(subreddits[0].name);
  }
}, [subreddits]);```

  // Fetch title analysis
  const { data: titleAnalysis, isLoading: titleLoading } = useQuery<TitleAnalysis>({
    queryKey: [`/api/intelligence/title-analysis/${encodeURIComponent(selectedSubreddit)}`],
    enabled: !!selectedSubreddit,
    queryFn: async () => fetchJson<TitleAnalysis>(`/api/intelligence/title-analysis/${encodeURIComponent(selectedSubreddit)}`)
  });

  // Fetch posting cadence
  const { data: cadenceAnalysis, isLoading: cadenceLoading } = useQuery<PostingCadence>({
    queryKey: [`/api/intelligence/posting-cadence/${encodeURIComponent(selectedSubreddit)}`],
    enabled: !!selectedSubreddit,
    queryFn: async () => fetchJson<PostingCadence>(`/api/intelligence/posting-cadence/${encodeURIComponent(selectedSubreddit)}`)
  });

  // Fetch subreddit recommendations
  const { data: recommendations, isLoading: recommendationsLoading } = useQuery<SubredditRecommendations>({
    queryKey: ['/api/intelligence/subreddit-recommendations'],
    enabled: !!user,
    queryFn: async () => fetchJson<SubredditRecommendations>('/api/intelligence/subreddit-recommendations')
  });

  // Check tier access
  const hasPro = user?.tier === 'pro' || user?.tier === 'premium';
  const hasPremium = user?.tier === 'premium';

  if (!hasPro) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-6 w-6 text-yellow-500" />
              Reddit Intelligence Insights
            </CardTitle>
            <CardDescription>
              Unlock AI-powered analytics to optimize your Reddit posting strategy
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Pro Tier Required</AlertTitle>
              <AlertDescription>
                Intelligence insights require Pro tier ($24.99/mo) or higher. Upgrade to access:
                <ul className="list-disc list-inside mt-2 space-y-1">
                  <li>Title pattern analysis and optimization</li>
                  <li>Posting cadence and burnout detection</li>
                  <li>Subreddit recommendations with risk scoring</li>
                  <li>Engagement trend tracking</li>
                </ul>
                <Button className="mt-4" onClick={() => window.location.href = '/pricing'}>
                  Upgrade to Pro
                </Button>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Zap className="h-8 w-8 text-yellow-500" />
          Reddit Intelligence Insights
        </h1>
        <p className="text-gray-600 mt-2">
          Data-driven insights to optimize your posting strategy and grow your audience
        </p>
      </div>

      {/* Subreddit Selector */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <label className="font-medium">Select Subreddit:</label>
            <Select value={selectedSubreddit} onValueChange={setSelectedSubreddit}>
              <SelectTrigger className="w-64">
                <SelectValue placeholder="Choose a subreddit..." />
              </SelectTrigger>
              <SelectContent>
                {subreddits?.map((sub) => (
                  <SelectItem key={sub.id} value={sub.id}>
                    {sub.displayName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedSubreddit && (
              <Badge variant="secondary">
                Analyzing r/{selectedSubreddit}
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>

      {!selectedSubreddit ? (
        <Alert>
          <Lightbulb className="h-4 w-4" />
          <AlertTitle>Get Started</AlertTitle>
          <AlertDescription>
            Select a subreddit above to see detailed intelligence insights about your posting performance.
          </AlertDescription>
        </Alert>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="title">
              <MessageSquare className="h-4 w-4 mr-2" />
              Title Analysis
            </TabsTrigger>
            <TabsTrigger value="cadence">
              <Clock className="h-4 w-4 mr-2" />
              Posting Cadence
            </TabsTrigger>
            <TabsTrigger value="recommendations">
              <Target className="h-4 w-4 mr-2" />
              Recommendations
            </TabsTrigger>
          </TabsList>

          {/* Title Analysis Tab */}
          <TabsContent value="title" className="space-y-4">
            {titleLoading ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                  <p className="text-gray-600">Analyzing your titles...</p>
                </CardContent>
              </Card>
            ) : titleAnalysis ? (
              <>
                {/* Overview Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Title Performance Overview
                    </CardTitle>
                    <CardDescription>
                      Analysis of {titleAnalysis.sampleSize} successful posts from the last {titleAnalysis.daysAnalyzed} days
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-4 bg-blue-50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-700">{titleAnalysis.overview.avgTitleLength}</div>
                        <div className="text-xs text-gray-600">Avg Length</div>
                      </div>
                      <div className="text-center p-4 bg-purple-50 rounded-lg">
                        <div className="text-2xl font-bold text-purple-700">{titleAnalysis.overview.questionRatio}%</div>
                        <div className="text-xs text-gray-600">Questions</div>
                      </div>
                      <div className="text-center p-4 bg-yellow-50 rounded-lg">
                        <div className="text-2xl font-bold text-yellow-700">{titleAnalysis.overview.emojiUsageRate}%</div>
                        <div className="text-xs text-gray-600">With Emojis</div>
                      </div>
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-700 capitalize">{titleAnalysis.overview.sentiment.type}</div>
                        <div className="text-xs text-gray-600">Tone</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Question vs Statement Analysis */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <MessageSquare className="h-5 w-5" />
                      Question vs Statement Performance
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                        <div>
                          <div className="font-medium">Questions</div>
                          <div className="text-2xl font-bold text-blue-600">{titleAnalysis.questionAnalysis.avgEngagement}</div>
                          <div className="text-xs text-gray-600">Avg Engagement</div>
                        </div>
                        <div>
                          <div className="font-medium">Statements</div>
                          <div className="text-2xl font-bold text-gray-600">{titleAnalysis.questionAnalysis.vsStatements}</div>
                          <div className="text-xs text-gray-600">Avg Engagement</div>
                        </div>
                      </div>
                      <Alert>
                        <CheckCircle className="h-4 w-4" />
                        <AlertDescription>{titleAnalysis.questionAnalysis.verdict}</AlertDescription>
                      </Alert>
                    </div>
                  </CardContent>
                </Card>

                {/* Emoji Analysis */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Smile className="h-5 w-5" />
                      Emoji Effectiveness
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="p-4 bg-green-50 rounded-lg">
                          <div className="text-sm text-gray-600">With Emojis</div>
                          <div className="text-2xl font-bold text-green-700">
                            {titleAnalysis.emojiAnalysis.avgEngagementWithEmoji}
                          </div>
                        </div>
                        <div className="p-4 bg-gray-50 rounded-lg">
                          <div className="text-sm text-gray-600">Without Emojis</div>
                          <div className="text-2xl font-bold text-gray-700">
                            {titleAnalysis.emojiAnalysis.avgEngagementWithoutEmoji}
                          </div>
                        </div>
                      </div>
                      {titleAnalysis.emojiAnalysis.topEmojis.length > 0 && (
                        <div>
                          <div className="text-sm font-medium mb-2">Your Top Emojis</div>
                          <div className="flex flex-wrap gap-2">
                            {titleAnalysis.emojiAnalysis.topEmojis.map((emoji, i) => (
                              <Badge key={i} variant="secondary" className="text-lg">
                                {emoji.emoji} <span className="text-xs ml-1">{emoji.percentage}%</span>
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      <Alert>
                        <CheckCircle className="h-4 w-4" />
                        <AlertDescription>{titleAnalysis.emojiAnalysis.verdict}</AlertDescription>
                      </Alert>
                    </div>
                  </CardContent>
                </Card>

                {/* Length Analysis */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Hash className="h-5 w-5" />
                      Title Length Performance
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {titleAnalysis.lengthAnalysis.map((bucket, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <div className="font-medium">{bucket.range}</div>
                            <div className="text-xs text-gray-600">{bucket.posts} posts ({bucket.percentage}%)</div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-blue-600">{bucket.avgEngagement}</div>
                            <div className="text-xs text-gray-600">Avg Engagement</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Keywords */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Award className="h-5 w-5" />
                      Your Power Words
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {titleAnalysis.topKeywords.map((keyword, i) => (
                        <Badge key={i} variant="outline" className="text-sm">
                          {keyword.word} <span className="ml-1 text-xs text-gray-500">({keyword.count})</span>
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                {/* Recommendations */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Lightbulb className="h-5 w-5 text-yellow-500" />
                      Recommendations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {titleAnalysis.recommendations.map((rec, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>Failed to load title analysis</AlertDescription>
              </Alert>
            )}
          </TabsContent>

          {/* Posting Cadence Tab */}
          <TabsContent value="cadence" className="space-y-4">
            {cadenceLoading ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                  <p className="text-gray-600">Analyzing posting cadence...</p>
                </CardContent>
              </Card>
            ) : cadenceAnalysis ? (
              <>
                {/* Status Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      {cadenceAnalysis.status === 'optimal' && <CheckCircle className="h-5 w-5 text-green-500" />}
                      {cadenceAnalysis.status === 'over-posting' && <AlertTriangle className="h-5 w-5 text-red-500" />}
                      {cadenceAnalysis.status === 'under-posting' && <ArrowUp className="h-5 w-5 text-blue-500" />}
                      {cadenceAnalysis.status === 'inconsistent' && <Minus className="h-5 w-5 text-yellow-500" />}
                      Posting Status: <span className="capitalize">{cadenceAnalysis.status.replace('-', ' ')}</span>
                    </CardTitle>
                    <CardDescription>
                      Based on {cadenceAnalysis.sampleSize} posts over {cadenceAnalysis.daysAnalyzed} days
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Alert className={
                      cadenceAnalysis.status === 'optimal' ? 'border-green-500 bg-green-50' :
                      cadenceAnalysis.status === 'over-posting' ? 'border-red-500 bg-red-50' :
                      'border-yellow-500 bg-yellow-50'
                    }>
                      <AlertDescription className="text-lg">{cadenceAnalysis.recommendation}</AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>

                {/* Current vs Optimal Cadence */}
                <div className="grid md:grid-cols-2 gap-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Calendar className="h-5 w-5" />
                        Current Cadence
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <div className="text-3xl font-bold text-blue-600">{cadenceAnalysis.currentCadence.avgGapHours}h</div>
                        <div className="text-sm text-gray-600">Average gap between posts</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-gray-700">{cadenceAnalysis.currentCadence.postsPerWeek}</div>
                        <div className="text-sm text-gray-600">Posts per week</div>
                      </div>
                      <Badge variant={cadenceAnalysis.currentCadence.consistency === 'consistent' ? 'secondary' : 'destructive'}>
                        {cadenceAnalysis.currentCadence.consistency}
                      </Badge>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Target className="h-5 w-5" />
                        Optimal Cadence
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div>
                        <div className="text-3xl font-bold text-green-600">{cadenceAnalysis.optimalCadence.recommendedGapHours}h</div>
                        <div className="text-sm text-gray-600">Recommended gap</div>
                      </div>
                      <div>
                        <div className="text-2xl font-bold text-gray-700">{cadenceAnalysis.optimalCadence.postsPerWeek}</div>
                        <div className="text-sm text-gray-600">Recommended posts/week</div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Engagement Trend */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <TrendingUp className="h-5 w-5" />
                      Engagement Trend
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div>
                        <div className="font-medium">Direction</div>
                        <div className="flex items-center gap-2 mt-1">
                          {cadenceAnalysis.engagementTrend.direction === 'improving' && <ArrowUp className="h-5 w-5 text-green-500" />}
                          {cadenceAnalysis.engagementTrend.direction === 'declining' && <ArrowDown className="h-5 w-5 text-red-500" />}
                          {cadenceAnalysis.engagementTrend.direction === 'stable' && <Minus className="h-5 w-5 text-gray-500" />}
                          <span className="capitalize text-lg font-semibold">{cadenceAnalysis.engagementTrend.direction}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">Change</div>
                        <div className={`text-2xl font-bold ${
                          cadenceAnalysis.engagementTrend.changePercent > 0 ? 'text-green-600' :
                          cadenceAnalysis.engagementTrend.changePercent < 0 ? 'text-red-600' : 'text-gray-600'
                        }`}>
                          {cadenceAnalysis.engagementTrend.changePercent > 0 ? '+' : ''}{cadenceAnalysis.engagementTrend.changePercent}%
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Warnings */}
                {Object.values(cadenceAnalysis.warnings).some(Boolean) && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-red-600">
                        <AlertTriangle className="h-5 w-5" />
                        Warnings
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2">
                        {cadenceAnalysis.warnings.diminishingReturns && (
                          <li className="flex items-start gap-2">
                            <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                            <span>Diminishing returns detected - posting too frequently hurts engagement</span>
                          </li>
                        )}
                        {cadenceAnalysis.warnings.burnoutDetected && (
                          <li className="flex items-start gap-2">
                            <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                            <span>Burnout pattern detected - take a break or reduce frequency</span>
                          </li>
                        )}
                        {cadenceAnalysis.warnings.inconsistentSchedule && (
                          <li className="flex items-start gap-2">
                            <AlertTriangle className="h-5 w-5 text-yellow-500 flex-shrink-0 mt-0.5" />
                            <span>Inconsistent posting schedule - try to maintain regular gaps</span>
                          </li>
                        )}
                      </ul>
                    </CardContent>
                  </Card>
                )}

                {/* Insights */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Lightbulb className="h-5 w-5 text-yellow-500" />
                      Insights
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {cadenceAnalysis.insights.map((insight, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                          <span>{insight}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>

                {/* Gap Analysis */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5" />
                      Performance by Posting Frequency
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {cadenceAnalysis.gapAnalysis.map((gap, i) => (
                        <div key={i} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          <div>
                            <div className="font-medium">{gap.range}</div>
                            <div className="text-xs text-gray-600">{gap.posts} posts ({gap.percentage}%)</div>
                          </div>
                          <div className="text-right">
                            <div className="text-lg font-bold text-blue-600">{gap.avgEngagement}</div>
                            <div className="text-xs text-gray-600">Avg Engagement</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>Failed to load cadence analysis</AlertDescription>
              </Alert>
            )}
          </TabsContent>

          {/* Subreddit Recommendations Tab */}
          <TabsContent value="recommendations" className="space-y-4">
            {recommendationsLoading ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
                  <p className="text-gray-600">Finding subreddit recommendations...</p>
                </CardContent>
              </Card>
            ) : recommendations ? (
              <>
                {/* Summary Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5" />
                      Expansion Opportunities
                    </CardTitle>
                    <CardDescription>
                      Based on your success in: {recommendations.basedOn.map(b => `r/${b.subreddit}`).join(', ')}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-700">{recommendations.summary.lowRisk}</div>
                        <div className="text-xs text-gray-600">Low Risk</div>
                      </div>
                      <div className="text-center p-4 bg-yellow-50 rounded-lg">
                        <div className="text-2xl font-bold text-yellow-700">{recommendations.summary.mediumRisk}</div>
                        <div className="text-xs text-gray-600">Medium Risk</div>
                      </div>
                      <div className="text-center p-4 bg-red-50 rounded-lg">
                        <div className="text-2xl font-bold text-red-700">{recommendations.summary.highRisk}</div>
                        <div className="text-xs text-gray-600">High Risk</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Low Risk Recommendations */}
                {recommendations.recommendations.lowRisk.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-green-700">
                        <CheckCircle className="h-5 w-5" />
                        Low Risk Opportunities
                      </CardTitle>
                      <CardDescription>Ready for immediate expansion</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {recommendations.recommendations.lowRisk.map((rec, i) => (
                        <div key={i} className="p-4 border rounded-lg space-y-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="font-semibold text-lg">r/{rec.subreddit}</div>
                              <div className="text-sm text-gray-600">{rec.description}</div>
                            </div>
                            <Badge className="bg-green-500">{rec.score}</Badge>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Badge variant="outline" className="text-xs">
                              <Users className="h-3 w-3 mr-1" />
                              {rec.members.toLocaleString()}
                            </Badge>
                            <Badge variant="secondary" className={
                              rec.competition === 'low' ? 'bg-green-100 text-green-800' :
                              rec.competition === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-red-100 text-red-800'
                            }>
                              {rec.competition} competition
                            </Badge>
                            {rec.requirements.verification && (
                              <Badge variant="outline">
                                <Shield className="h-3 w-3 mr-1" />
                                Verification
                              </Badge>
                            )}
                          </div>
                          {rec.opportunities.length > 0 && (
                            <div className="text-sm text-green-700">
                              ✓ {rec.opportunities.join(' • ')}
                            </div>
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Medium Risk Recommendations */}
                {recommendations.recommendations.mediumRisk.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-yellow-700">
                        <AlertTriangle className="h-5 w-5" />
                        Medium Risk Opportunities
                      </CardTitle>
                      <CardDescription>Proceed with caution</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {recommendations.recommendations.mediumRisk.slice(0, 3).map((rec, i) => (
                        <div key={i} className="p-4 border rounded-lg space-y-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="font-semibold text-lg">r/{rec.subreddit}</div>
                              <div className="text-sm text-gray-600">{rec.description}</div>
                            </div>
                            <Badge className="bg-yellow-500">{rec.score}</Badge>
                          </div>
                          {rec.risks.length > 0 && (
                            <div className="text-sm text-yellow-700">
                              ⚠ {rec.risks.join(' • ')}
                            </div>
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Insights */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Lightbulb className="h-5 w-5 text-yellow-500" />
                      Insights
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {recommendations.insights.map((insight, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <CheckCircle className="h-5 w-5 text-blue-500 flex-shrink-0 mt-0.5" />
                          <span>{insight}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </>
            ) : (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>Failed to load recommendations</AlertDescription>
              </Alert>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
