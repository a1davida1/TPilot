/**
 * Performance Prediction Component (QW-7)
 * 
 * Displays AI-powered performance prediction for a post
 */

import { useQuery } from '@tanstack/react-query';
import { TrendingUp, AlertCircle, CheckCircle, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface PredictionProps {
  subreddit: string;
  title: string;
  scheduledTime?: Date;
}

interface PerformancePrediction {
  level: 'low' | 'medium' | 'high' | 'viral';
  score: number;
  confidence: 'low' | 'medium' | 'high';
  suggestions: string[];
  factors: {
    titleScore: number;
    timingScore: number;
    subredditHealthScore: number;
    userSuccessScore: number;
  };
}

const levelConfig = {
  viral: {
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-50 dark:bg-green-950',
    borderColor: 'border-green-500',
    icon: Zap,
    label: 'Viral Potential',
    description: 'Excellent chance of high engagement'
  },
  high: {
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50 dark:bg-blue-950',
    borderColor: 'border-blue-500',
    icon: TrendingUp,
    label: 'High Performance',
    description: 'Good chance of strong engagement'
  },
  medium: {
    color: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-50 dark:bg-yellow-950',
    borderColor: 'border-yellow-500',
    icon: CheckCircle,
    label: 'Medium Performance',
    description: 'Average engagement expected'
  },
  low: {
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-50 dark:bg-red-950',
    borderColor: 'border-red-500',
    icon: AlertCircle,
    label: 'Low Performance',
    description: 'Consider improving before posting'
  }
};

export function PerformancePrediction({ subreddit, title, scheduledTime }: PredictionProps) {
  const { data: prediction, isLoading, error } = useQuery<PerformancePrediction>({
    queryKey: ['predict-performance', subreddit, title, scheduledTime?.toISOString()],
    queryFn: async () => {
      const response = await fetch('/api/analytics/predict-performance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subreddit,
          title,
          scheduledTime: scheduledTime?.toISOString()
        }),
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to predict performance');
      }

      return response.json();
    },
    enabled: !!subreddit && !!title && title.length > 0,
    staleTime: 60000, // Cache for 1 minute
  });

  if (!subreddit || !title) {
    return null;
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Performance Prediction
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32" />
        </CardContent>
      </Card>
    );
  }

  if (error || !prediction) {
    return null;
  }

  const config = levelConfig[prediction.level];
  const Icon = config.icon;

  return (
    <Card className={cn('border-l-4', config.borderColor)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Icon className={cn('h-5 w-5', config.color)} />
          Performance Prediction
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Score Display */}
        <div className={cn('rounded-lg p-4', config.bgColor)}>
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className={cn('text-3xl font-bold', config.color)}>
                {config.label}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {config.description}
              </div>
            </div>
            <div className="text-right">
              <div className={cn('text-4xl font-bold', config.color)}>
                {prediction.score}
              </div>
              <div className="text-sm text-muted-foreground">/ 100</div>
            </div>
          </div>

          <Badge variant={prediction.confidence === 'high' ? 'default' : 'secondary'} className="mt-2">
            {prediction.confidence} confidence
          </Badge>
        </div>

        {/* Factor Breakdown */}
        <div className="space-y-2">
          <div className="text-sm font-medium">Score Breakdown:</div>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Title Quality:</span>
              <span className="font-medium">{prediction.factors.titleScore}/100</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Timing:</span>
              <span className="font-medium">{prediction.factors.timingScore}/100</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subreddit Health:</span>
              <span className="font-medium">{prediction.factors.subredditHealthScore}/100</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Your Success Rate:</span>
              <span className="font-medium">{prediction.factors.userSuccessScore}/100</span>
            </div>
          </div>
        </div>

        {/* Suggestions */}
        {prediction.suggestions.length > 0 && (
          <div className="space-y-2">
            <div className="text-sm font-medium">Suggestions:</div>
            <ul className="space-y-1">
              {prediction.suggestions.map((suggestion, index) => (
                <li key={index} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-primary mt-0.5">•</span>
                  <span>{suggestion}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
