import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import {
  Zap, TrendingUp, Star, Sparkles, CheckCircle, Play, ArrowRight
} from 'lucide-react';

interface OptimizationRecommendation {
  id: string;
  type: 'content' | 'timing' | 'hashtags' | 'platform' | 'engagement';
  priority: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
  currentScore: number;
  potentialScore: number;
  actions: Array<{
    id: string;
    action: string;
    automated: boolean;
    status: 'pending' | 'running' | 'completed';
  }>;
}

interface PerformanceScore {
  overall: number;
  content: number;
  timing: number;
  engagement: number;
  hashtags: number;
  platforms: number;
}

export default function PerformanceOptimizer() {
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Mock data - replace with real API calls
  const { data: performanceScore, isLoading: scoreLoading } = useQuery<PerformanceScore>({
    queryKey: ['/api/optimization/score'],
    queryFn: () => Promise.resolve({
      overall: 78,
      content: 85,
      timing: 72,
      engagement: 81,
      hashtags: 76,
      platforms: 74
    })
  });

  const scores: PerformanceScore = performanceScore ?? {
    overall: 0,
    content: 0,
    timing: 0,
    engagement: 0,
    hashtags: 0,
    platforms: 0
  };

  const { data: recommendations, isLoading: recsLoading } = useQuery<OptimizationRecommendation[]>({
    queryKey: ['/api/optimization/recommendations'],
    queryFn: () => Promise.resolve([
      {
        id: '1',
        type: 'timing',
        priority: 'high',
        title: 'Optimize posting schedule',
        description: 'Your current posting times miss peak engagement windows by 2-3 hours',
        impact: '+23% potential engagement increase',
        effort: 'low',
        currentScore: 72,
        potentialScore: 89,
        actions: [
          { id: '1a', action: 'Auto-schedule posts for 9:00 AM peak', automated: true, status: 'pending' },
          { id: '1b', action: 'Adjust evening posts to 6:30 PM', automated: true, status: 'pending' }
        ]
      },
      {
        id: '2',
        type: 'hashtags',
        priority: 'high',
        title: 'Improve hashtag strategy',
        description: 'Current hashtags reach only 60% of your target audience',
        impact: '+18% reach expansion',
        effort: 'low',
        currentScore: 76,
        potentialScore: 91,
        actions: [
          { id: '2a', action: 'Replace #mood with trending #morningvibes', automated: false, status: 'pending' },
          { id: '2b', action: 'Add location-based hashtags for 15% boost', automated: false, status: 'pending' }
        ]
      },
      {
        id: '3',
        type: 'content',
        priority: 'medium',
        title: 'Content format optimization',
        description: 'Video content performs 40% better than images for your audience',
        impact: '+28% engagement boost',
        effort: 'medium',
        currentScore: 85,
        potentialScore: 95,
        actions: [
          { id: '3a', action: 'Create 15-second workout clips', automated: false, status: 'pending' },
          { id: '3b', action: 'Add motion graphics to static posts', automated: false, status: 'pending' }
        ]
      },
      {
        id: '4',
        type: 'platform',
        priority: 'medium',
        title: 'Cross-platform content adaptation',
        description: 'Same content across platforms - missing platform-specific optimizations',
        impact: '+15% overall performance',
        effort: 'medium',
        currentScore: 74,
        potentialScore: 87,
        actions: [
          { id: '4a', action: 'Adapt content for TikTok format', automated: false, status: 'pending' },
          { id: '4b', action: 'Create Instagram Story versions', automated: false, status: 'pending' }
        ]
      },
      {
        id: '5',
        type: 'engagement',
        priority: 'low',
        title: 'Response time improvement',
        description: 'Faster response to comments can increase engagement by 8%',
        impact: '+8% engagement retention',
        effort: 'low',
        currentScore: 81,
        potentialScore: 87,
        actions: [
          { id: '5a', action: 'Set up auto-responses for common questions', automated: true, status: 'pending' },
          { id: '5b', action: 'Enable push notifications for comments', automated: true, status: 'pending' }
        ]
      }
    ])
  });

  const applyOptimization = useMutation({
    mutationFn: async (_recommendationId: string) => {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      return { success: true };
    },
    onSuccess: (_, _recommendationId) => {
      queryClient.invalidateQueries({ queryKey: ['/api/optimization/recommendations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/optimization/score'] });
      toast({
        title: "Optimization Applied",
        description: "Your content strategy has been updated successfully!",
      });
    }
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'bg-red-500/20 text-red-400 border-red-500/30';
      case 'medium': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'low': return 'bg-green-500/20 text-green-400 border-green-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getEffortColor = (effort: string) => {
    switch (effort) {
      case 'low': return 'text-green-400';
      case 'medium': return 'text-yellow-400';
      case 'high': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const filteredRecommendations = recommendations?.filter(rec => 
    activeCategory === 'all' || rec.type === activeCategory
  ) || [];

  if (scoreLoading || recsLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Performance Optimizer</h2>
            <p className="text-gray-400">AI-powered optimization recommendations</p>
          </div>
          <Badge className="bg-gradient-to-r from-purple-500 to-pink-500">Phase 3</Badge>
        </div>
        
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[...Array(6)].map((_, i) => (
            <Card key={i} className="bg-gray-800 border-purple-500/20 animate-pulse">
              <CardContent className="p-6">
                <div className="h-20 bg-gray-700 rounded"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Performance Optimizer</h2>
          <p className="text-gray-400">AI-powered optimization recommendations</p>
        </div>
        <Badge className="bg-gradient-to-r from-purple-500 to-pink-500">Phase 3</Badge>
      </div>

      {/* Performance Score Overview */}
      <Card className="bg-gray-800 border-purple-500/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center space-x-2">
            <Zap className="h-5 w-5 text-yellow-400" />
            <span>Performance Score</span>
          </CardTitle>
          <CardDescription>Overall optimization score based on AI analysis</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Overall Score */}
            <div className="col-span-full md:col-span-1 text-center">
              <div className="relative inline-flex items-center justify-center w-32 h-32">
                <svg className="w-32 h-32 transform -rotate-90">
                  <circle cx="64" cy="64" r="56" fill="transparent" stroke="#374151" strokeWidth="8" />
                  <circle
                    cx="64"
                    cy="64"
                    r="56"
                    fill="transparent"
                    stroke="#8B5CF6"
                    strokeWidth="8"
                    strokeDasharray={`${2 * Math.PI * 56}`}
                    strokeDashoffset={`${2 * Math.PI * 56 * (1 - scores.overall / 100)}`}
                    className="transition-all duration-500"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-white">{scores.overall}</div>
                    <div className="text-sm text-gray-400">Overall</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Individual Scores */}
            <div className="col-span-full md:col-span-2 space-y-4">
              {Object.entries(scores).filter(([key]) => key !== 'overall').map(([key, value]) => (
                <div key={key} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-white capitalize font-medium">{key}</span>
                    <span className="text-sm text-gray-400">{value}/100</span>
                  </div>
                  <Progress 
                    value={value} 
                    className="h-2"
                    style={{ 
                      backgroundColor: '#374151',
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Category Filter */}
      <div className="flex flex-wrap gap-2">
        {['all', 'content', 'timing', 'hashtags', 'platform', 'engagement'].map((category) => (
          <Button
            key={category}
            variant={activeCategory === category ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveCategory(category)}
            className={activeCategory === category 
              ? "bg-purple-600 hover:bg-purple-700" 
              : "border-purple-500/20 hover:border-purple-500/40"
            }
          >
            {category === 'all' ? 'All Recommendations' : category.charAt(0).toUpperCase() + category.slice(1)}
          </Button>
        ))}
      </div>

      {/* Recommendations */}
      <div className="space-y-4">
        {filteredRecommendations.map((rec) => (
          <Card key={rec.id} className="bg-gray-800 border-purple-500/20">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <CardTitle className="text-white">{rec.title}</CardTitle>
                    <Badge className={getPriorityColor(rec.priority)}>
                      {rec.priority} priority
                    </Badge>
                  </div>
                  <CardDescription>{rec.description}</CardDescription>
                </div>
                <div className="text-right space-y-1">
                  <div className="text-sm text-gray-400">
                    Score: {rec.currentScore} → {rec.potentialScore}
                  </div>
                  <div className={`text-sm ${getEffortColor(rec.effort)}`}>
                    {rec.effort} effort
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Impact */}
              <Alert className="bg-green-500/10 border-green-500/20">
                <TrendingUp className="h-4 w-4 text-green-400" />
                <AlertDescription className="text-green-400">
                  <strong>Expected Impact:</strong> {rec.impact}
                </AlertDescription>
              </Alert>

              {/* Actions */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-gray-300">Recommended Actions:</h4>
                {rec.actions.map((action) => (
                  <div key={action.id} className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                    <div className="flex items-center space-x-3">
                      {action.status === 'completed' ? (
                        <CheckCircle className="h-4 w-4 text-green-400" />
                      ) : action.status === 'running' ? (
                        <div className="w-4 h-4 border-2 border-purple-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <div className="w-4 h-4 border border-gray-500 rounded" />
                      )}
                      <span className="text-sm text-gray-300">{action.action}</span>
                      {action.automated && (
                        <Badge variant="outline" className="border-blue-400 text-blue-400 text-xs">
                          Auto
                        </Badge>
                      )}
                    </div>
                    {action.status === 'pending' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="text-purple-400 hover:text-purple-300"
                        onClick={() => applyOptimization.mutate(rec.id)}
                        disabled={applyOptimization.isPending}
                      >
                        {action.automated ? <Play className="h-4 w-4" /> : <ArrowRight className="h-4 w-4" />}
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              {/* Apply Button */}
              <div className="flex justify-end">
                <Button
                  onClick={() => applyOptimization.mutate(rec.id)}
                  disabled={applyOptimization.isPending}
                  className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                >
                  {applyOptimization.isPending ? (
                    <>
                      <div className="w-4 h-4 mr-2 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Applying...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Apply Optimization
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredRecommendations.length === 0 && (
        <Card className="bg-gray-800 border-purple-500/20">
          <CardContent className="p-8 text-center">
            <Star className="h-12 w-12 mx-auto text-yellow-400 mb-4" />
            <h3 className="text-xl font-semibold text-white mb-2">
              {activeCategory === 'all' ? 'All Optimized!' : `${activeCategory.charAt(0).toUpperCase() + activeCategory.slice(1)} Optimized!`}
            </h3>
            <p className="text-gray-400">
              {activeCategory === 'all' 
                ? "You're performing excellently across all areas. Check back later for new optimization opportunities."
                : `Your ${activeCategory} strategy is already optimized. Great work!`
              }
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}