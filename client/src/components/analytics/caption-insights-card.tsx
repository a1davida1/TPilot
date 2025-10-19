/**
 * Caption Insights Card
 * Shows user their own caption performance and preferences
 */

import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Zap, Edit3 } from 'lucide-react';

interface CaptionPreference {
  creator_id: number;
  style: string;
  times_chosen: number;
  avg_choice_time_ms: number;
  edit_rate: number;
}

interface StyleRecommendation {
  style: 'flirty' | 'slutty';
  confidence: number;
  reason: string;
  stats?: {
    timesChosen: number;
    avgPerformance: number;
    totalPosts: number;
  };
}

interface StyleComparison {
  flirty: { chosen: number; avgUpvotes: number; winRate: number };
  slutty: { chosen: number; avgUpvotes: number; winRate: number };
}

export function CaptionInsightsCard() {
  const { data: prefsData } = useQuery({
    queryKey: ['caption-analytics', 'my-preferences'],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/caption-analytics/my-preferences', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error('Failed to fetch preferences');
      return res.json() as Promise<{ preferences: CaptionPreference[] }>;
    }
  });

  const { data: recommendData } = useQuery({
    queryKey: ['caption-analytics', 'recommend-style'],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/caption-analytics/recommend-style', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error('Failed to fetch recommendation');
      return res.json() as Promise<{ recommendation: StyleRecommendation; comparison: StyleComparison }>;
    }
  });

  if (!prefsData?.preferences?.length && !recommendData) {
    return null; // No data yet
  }

  const topStyle = prefsData?.preferences?.[0];
  const comparison = recommendData?.comparison;
  const recommendation = recommendData?.recommendation;

  const getConfidenceBadge = (confidence: number) => {
    if (confidence >= 0.7) return <Badge variant="default" className="bg-green-600">High Confidence</Badge>;
    if (confidence >= 0.4) return <Badge variant="secondary">Medium Confidence</Badge>;
    return <Badge variant="outline">Low Confidence</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-yellow-500" />
          Your Caption Style
        </CardTitle>
        <CardDescription>
          AI-powered insights from your posting history
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Recommendation */}
        {recommendation && (
          <div className="p-4 bg-blue-50 dark:bg-blue-950 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-start justify-between mb-2">
              <div>
                <h4 className="font-semibold text-lg capitalize">{recommendation.style} Style</h4>
                <p className="text-sm text-muted-foreground">{recommendation.reason}</p>
              </div>
              {getConfidenceBadge(recommendation.confidence)}
            </div>
            {recommendation.stats && (
              <div className="grid grid-cols-3 gap-2 mt-3 text-sm">
                <div>
                  <div className="text-muted-foreground">Posts</div>
                  <div className="font-semibold">{recommendation.stats.totalPosts}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Avg Upvotes</div>
                  <div className="font-semibold">{recommendation.stats.avgPerformance}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Times Chosen</div>
                  <div className="font-semibold">{recommendation.stats.timesChosen}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Style Comparison */}
        {comparison && (
          <div className="space-y-3">
            <h4 className="font-semibold text-sm">Style Performance</h4>
            
            {/* Flirty */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Flirty</span>
                <span className="text-muted-foreground">{comparison.flirty.winRate}% chosen</span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-pink-500 transition-all"
                  style={{ width: `${comparison.flirty.winRate}%` }}
                />
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{comparison.flirty.avgUpvotes} avg upvotes</span>
                <span>•</span>
                <span>{comparison.flirty.chosen} times</span>
              </div>
            </div>

            {/* Slutty */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium">Slutty</span>
                <span className="text-muted-foreground">{comparison.slutty.winRate}% chosen</span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-purple-500 transition-all"
                  style={{ width: `${comparison.slutty.winRate}%` }}
                />
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{comparison.slutty.avgUpvotes} avg upvotes</span>
                <span>•</span>
                <span>{comparison.slutty.chosen} times</span>
              </div>
            </div>
          </div>
        )}

        {/* Quick Stats */}
        {topStyle && (
          <div className="grid grid-cols-2 gap-3 pt-3 border-t">
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Zap className="h-3 w-3" />
                Avg Decision Time
              </div>
              <div className="text-lg font-semibold">
                {(topStyle.avg_choice_time_ms / 1000).toFixed(1)}s
              </div>
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Edit3 className="h-3 w-3" />
                Edit Rate
              </div>
              <div className="text-lg font-semibold">
                {Math.round(topStyle.edit_rate * 100)}%
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
