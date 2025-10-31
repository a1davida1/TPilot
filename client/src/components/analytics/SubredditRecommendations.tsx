/**
 * Subreddit Recommendations Component (QW-8)
 * 
 * Displays personalized subreddit recommendations
 */

import { useQuery } from '@tanstack/react-query';
import { Sparkles, Users, TrendingUp, AlertTriangle, Plus } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface SubredditRecommendation {
  subreddit: string;
  displayName: string;
  compatibilityScore: number;
  reason: string;
  estimatedSuccessRate: number;
  memberCount: number;
  competitionLevel: 'low' | 'medium' | 'high';
  warnings: string[];
  category?: string;
  over18: boolean;
}

interface RecommendationsResponse {
  recommendations: SubredditRecommendation[];
}

const competitionConfig = {
  low: {
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900',
    label: 'Low Competition'
  },
  medium: {
    color: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900',
    label: 'Medium Competition'
  },
  high: {
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-100 dark:bg-red-900',
    label: 'High Competition'
  }
};

function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}

export function SubredditRecommendations() {
  const { data, isLoading, error } = useQuery<RecommendationsResponse>({
    queryKey: ['subreddit-recommendations'],
    queryFn: async () => {
      const response = await fetch('/api/analytics/subreddit-recommendations', {
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to fetch recommendations');
      }

      return response.json();
    },
    staleTime: 300000, // Cache for 5 minutes
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Recommended Subreddits
          </CardTitle>
          <CardDescription>
            Personalized recommendations based on your posting history
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Recommended Subreddits
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            Unable to load recommendations. Please try again later.
          </div>
        </CardContent>
      </Card>
    );
  }

  const recommendations = data.recommendations;

  if (recommendations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Recommended Subreddits
          </CardTitle>
          <CardDescription>
            Post to a few subreddits first to get personalized recommendations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            No recommendations available yet. Start posting to build your profile!
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Recommended Subreddits
        </CardTitle>
        <CardDescription>
          Personalized recommendations based on your posting history
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {recommendations.map((rec) => {
            const competitionStyle = competitionConfig[rec.competitionLevel];

            return (
              <div
                key={rec.subreddit}
                className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold text-lg">
                        r/{rec.displayName}
                      </h3>
                      {rec.over18 && (
                        <Badge variant="destructive" className="text-xs">
                          NSFW
                        </Badge>
                      )}
                      {rec.category && (
                        <Badge variant="outline" className="text-xs">
                          {rec.category}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {rec.reason}
                    </p>
                  </div>

                  <Button size="sm" variant="outline" className="ml-4">
                    <Plus className="h-4 w-4 mr-1" />
                    Add
                  </Button>
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-3 gap-4 mt-3 mb-3">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">
                        {rec.compatibilityScore}%
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Compatibility
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <div className="text-sm font-medium">
                        {formatNumber(rec.memberCount)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Members
                      </div>
                    </div>
                  </div>

                  <div>
                    <Badge
                      variant="secondary"
                      className={cn('text-xs', competitionStyle.bgColor, competitionStyle.color)}
                    >
                      {competitionStyle.label}
                    </Badge>
                  </div>
                </div>

                {/* Success Rate */}
                <div className="mb-3">
                  <div className="flex items-center justify-between text-sm mb-1">
                    <span className="text-muted-foreground">Estimated Success Rate</span>
                    <span className="font-medium">{rec.estimatedSuccessRate}%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div
                      className={cn(
                        'h-2 rounded-full transition-all',
                        rec.estimatedSuccessRate >= 70
                          ? 'bg-green-500'
                          : rec.estimatedSuccessRate >= 50
                          ? 'bg-yellow-500'
                          : 'bg-red-500'
                      )}
                      style={{ width: `${rec.estimatedSuccessRate}%` }}
                    />
                  </div>
                </div>

                {/* Warnings */}
                {rec.warnings.length > 0 && (
                  <div className="flex items-start gap-2 p-2 bg-yellow-50 dark:bg-yellow-950 rounded border border-yellow-200 dark:border-yellow-800">
                    <AlertTriangle className="h-4 w-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
                    <div className="text-xs text-yellow-700 dark:text-yellow-300">
                      {rec.warnings.join(' • ')}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
