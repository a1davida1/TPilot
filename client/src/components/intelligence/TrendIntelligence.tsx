import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { 
  TrendingUp, 
  TrendingDown, 
  Eye, 
  MessageCircle, 
  Heart, 
  Clock, 
  Users, 
  Zap,
  Search,
  Filter,
  ArrowUp,
  ArrowDown,
  Star
} from 'lucide-react';

export function TrendIntelligence() {
  const [activeFilter, setActiveFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const trendingTopics = [
    {
      id: 1,
      topic: 'Mirror Selfies',
      category: 'Photography',
      trend: 'rising',
      score: 94,
      engagement: '+127%',
      posts: '2.3K',
      platforms: ['reddit', 'instagram'],
      timeframe: '24h',
      suggestedTags: ['#mirrorselfie', '#bathroom', '#outfit', '#selfie']
    },
    {
      id: 2,
      topic: 'Workout Content',
      category: 'Fitness',
      trend: 'rising',
      score: 89,
      engagement: '+89%',
      posts: '1.8K',
      platforms: ['reddit', 'tiktok'],
      timeframe: '12h',
      suggestedTags: ['#workout', '#fitness', '#gym', '#motivation']
    },
    {
      id: 3,
      topic: 'Cozy Vibes',
      category: 'Lifestyle',
      trend: 'stable',
      score: 76,
      engagement: '+12%',
      posts: '956',
      platforms: ['instagram', 'twitter'],
      timeframe: '7d',
      suggestedTags: ['#cozy', '#comfy', '#relaxed', '#weekend']
    },
    {
      id: 4,
      topic: 'Beach Content',
      category: 'Travel',
      trend: 'declining',
      score: 42,
      engagement: '-23%',
      posts: '634',
      platforms: ['instagram'],
      timeframe: '7d',
      suggestedTags: ['#beach', '#summer', '#vacation', '#ocean']
    }
  ];

  const contentSuggestions = [
    {
      id: 1,
      title: 'Mirror selfie with new outfit',
      confidence: 'High',
      estimatedEngagement: '4.2K likes',
      bestTime: '8:30 PM',
      platforms: ['reddit', 'instagram'],
      reason: 'Mirror selfies trending +127% in last 24h'
    },
    {
      id: 2,
      title: 'Post-workout glow photo',
      confidence: 'Medium',
      estimatedEngagement: '3.1K likes',
      bestTime: '6:45 AM',
      platforms: ['reddit', 'tiktok'],
      reason: 'Fitness content performing well in morning hours'
    },
    {
      id: 3,
      title: 'Cozy evening setup',
      confidence: 'Medium',
      estimatedEngagement: '2.8K likes',
      bestTime: '9:15 PM',
      platforms: ['instagram'],
      reason: 'Cozy lifestyle content consistently engaging'
    }
  ];

  const subredditTrends = [
    {
      name: 'r/selfie',
      activity: 'very_high',
      engagement: 4.2,
      posts: '847/day',
      trend: 'up',
      change: '+15%',
      bestTimes: ['8PM-10PM', '11AM-1PM']
    },
    {
      name: 'r/FreeCompliments',
      activity: 'high',
      engagement: 3.8,
      posts: '623/day',
      trend: 'up',
      change: '+8%',
      bestTimes: ['7PM-9PM', '12PM-2PM']
    },
    {
      name: 'r/amihot',
      activity: 'medium',
      engagement: 3.1,
      posts: '412/day',
      trend: 'stable',
      change: '+2%',
      bestTimes: ['9PM-11PM', '1PM-3PM']
    },
    {
      name: 'r/Rateme',
      activity: 'medium',
      engagement: 2.9,
      posts: '298/day',
      trend: 'down',
      change: '-5%',
      bestTimes: ['8PM-10PM', '2PM-4PM']
    }
  ];

  const filteredTopics = trendingTopics.filter(topic => {
    const matchesFilter = activeFilter === 'all' || topic.trend === activeFilter;
    const matchesSearch = topic.topic.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         topic.category.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

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
        </div>
        <Badge variant="secondary" className="bg-purple-500/10 text-purple-400 border-purple-500/20">
          Phase 4 • Intelligence
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
            {filteredTopics.map((topic) => (
              <Card key={topic.id} className="bg-gradient-to-r from-gray-900/50 to-gray-800/50 border-gray-700/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div className="flex items-center space-x-3">
                    {getTrendIcon(topic.trend)}
                    <div>
                      <CardTitle className="text-lg text-white">{topic.topic}</CardTitle>
                      <p className="text-sm text-gray-400">{topic.category}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-white">{topic.score}</div>
                    <p className="text-xs text-gray-400">Trend Score</p>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Trending Strength</span>
                      <span className={getTrendColor(topic.trend)}>{topic.engagement}</span>
                    </div>
                    <Progress value={topic.score} className="h-2" />
                  </div>

                  {/* Stats */}
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center space-x-4">
                      <div className="flex items-center gap-1">
                        <MessageCircle className="h-4 w-4 text-purple-400" />
                        <span className="text-gray-400">{topic.posts} posts</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4 text-purple-400" />
                        <span className="text-gray-400">{topic.timeframe}</span>
                      </div>
                    </div>
                    <div className="flex space-x-1">
                      {topic.platforms.map((platform) => (
                        <Badge key={platform} variant="outline" className="text-xs border-gray-600">
                          {platform}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {/* Suggested Tags */}
                  <div className="space-y-2">
                    <p className="text-sm text-gray-400">Suggested tags:</p>
                    <div className="flex flex-wrap gap-1">
                      {topic.suggestedTags.map((tag, index) => (
                        <Badge
                          key={index}
                          variant="secondary"
                          className="text-xs bg-purple-500/20 text-purple-300 border-purple-500/30"
                        >
                          {tag}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="suggestions" className="space-y-4">
          <div className="grid gap-4">
            {contentSuggestions.map((suggestion) => (
              <Card key={suggestion.id} className="bg-gradient-to-r from-gray-900/50 to-gray-800/50 border-gray-700/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="text-lg text-white">{suggestion.title}</CardTitle>
                    <p className="text-sm text-gray-400">{suggestion.reason}</p>
                  </div>
                  <Badge
                    variant={suggestion.confidence === 'High' ? 'default' : 'secondary'}
                    className={
                      suggestion.confidence === 'High' 
                        ? 'bg-green-500/20 text-green-400 border-green-500/20' 
                        : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/20'
                    }
                  >
                    {suggestion.confidence} Confidence
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex items-center gap-2">
                      <Heart className="h-4 w-4 text-purple-400" />
                      <span className="text-gray-400">Est. engagement:</span>
                      <span className="font-medium text-white">{suggestion.estimatedEngagement}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-purple-400" />
                      <span className="text-gray-400">Best time:</span>
                      <span className="font-medium text-white">{suggestion.bestTime}</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex space-x-1">
                      {suggestion.platforms.map((platform) => (
                        <Badge key={platform} variant="outline" className="text-xs border-gray-600">
                          {platform}
                        </Badge>
                      ))}
                    </div>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm" data-testid={`save-suggestion-${suggestion.id}`}>
                        Save Idea
                      </Button>
                      <Button size="sm" className="bg-purple-600 hover:bg-purple-700" data-testid={`use-suggestion-${suggestion.id}`}>
                        <Zap className="h-4 w-4 mr-1" />
                        Use This
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="bg-gradient-to-r from-gray-900/50 to-gray-800/50 border-gray-700/50">
            <CardHeader>
              <CardTitle className="text-white">Get More Suggestions</CardTitle>
              <p className="text-sm text-gray-400">AI will analyze current trends and generate personalized content ideas</p>
            </CardHeader>
            <CardContent>
              <Button className="w-full bg-purple-600 hover:bg-purple-700" data-testid="generate-suggestions">
                <Zap className="h-4 w-4 mr-2" />
                Generate New Suggestions
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subreddits" className="space-y-4">
          <div className="grid gap-4">
            {subredditTrends.map((subreddit, index) => (
              <Card key={index} className="bg-gradient-to-r from-gray-900/50 to-gray-800/50 border-gray-700/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="text-lg text-white">{subreddit.name}</CardTitle>
                    <div className="flex items-center space-x-4 text-sm text-gray-400">
                      <span>{subreddit.posts}</span>
                      <span>•</span>
                      <span>{subreddit.engagement}% avg engagement</span>
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {subreddit.trend === 'up' && <ArrowUp className="h-4 w-4 text-green-400" />}
                    {subreddit.trend === 'down' && <ArrowDown className="h-4 w-4 text-red-400" />}
                    <span className={`text-sm font-medium ${
                      subreddit.trend === 'up' ? 'text-green-400' : 
                      subreddit.trend === 'down' ? 'text-red-400' : 'text-gray-400'
                    }`}>
                      {subreddit.change}
                    </span>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-400">Activity:</span>
                      <Badge
                        variant="outline"
                        className={`text-xs ${
                          subreddit.activity === 'very_high' ? 'border-green-500 text-green-400' :
                          subreddit.activity === 'high' ? 'border-yellow-500 text-yellow-400' :
                          'border-gray-600 text-gray-400'
                        }`}
                      >
                        {subreddit.activity.replace('_', ' ')}
                      </Badge>
                    </div>
                    <Button variant="outline" size="sm" data-testid={`analyze-${subreddit.name.slice(2)}`}>
                      Deep Analysis
                    </Button>
                  </div>

                  <div className="space-y-1">
                    <p className="text-sm text-gray-400">Best posting times:</p>
                    <div className="flex space-x-2">
                      {subreddit.bestTimes.map((time, timeIndex) => (
                        <Badge key={timeIndex} variant="secondary" className="text-xs bg-purple-500/20 text-purple-300">
                          {time}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <div className="grid gap-4">
            <Card className="bg-gradient-to-r from-purple-900/20 to-pink-900/20 border-purple-500/20">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Star className="h-5 w-5 text-yellow-400" />
                  AI Insight of the Day
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-300">
                  Mirror selfies are experiencing a 127% engagement boost in the last 24 hours. 
                  Consider posting between 8-10 PM for maximum visibility on Reddit communities.
                </p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-gray-900/50 to-gray-800/50 border-gray-700/50">
              <CardHeader>
                <CardTitle className="text-white">Optimization Recommendations</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-start space-x-3 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                    <TrendingUp className="h-5 w-5 text-green-400 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-green-400">High Impact</h4>
                      <p className="text-sm text-gray-300">
                        Increase mirror selfie content by 40% to capitalize on current trend
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                    <Eye className="h-5 w-5 text-yellow-400 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-yellow-400">Medium Impact</h4>
                      <p className="text-sm text-gray-300">
                        Adjust posting schedule to focus on 8-10 PM window for better engagement
                      </p>
                    </div>
                  </div>

                  <div className="flex items-start space-x-3 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                    <Users className="h-5 w-5 text-blue-400 mt-0.5" />
                    <div>
                      <h4 className="font-medium text-blue-400">Low Impact</h4>
                      <p className="text-sm text-gray-300">
                        Experiment with cozy lifestyle content for consistent engagement
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-gray-900/50 to-gray-800/50 border-gray-700/50">
              <CardHeader>
                <CardTitle className="text-white">Trend Predictions</CardTitle>
                <p className="text-sm text-gray-400">AI-powered forecasts for the next 7 days</p>
              </CardHeader>
              <CardContent>
                <div className="h-64 flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <TrendingUp className="h-12 w-12 mx-auto mb-4 text-purple-400" />
                    <p>Advanced trend prediction engine coming soon</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}