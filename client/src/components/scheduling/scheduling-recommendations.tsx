/**
 * Scheduling Recommendations Panel
 * Shows optimal posting times and auto-schedule options
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { OptimalTimeBadge } from './optimal-time-badge';
import { Calendar, Sparkles, RefreshCw, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface OptimalTime {
  dayOfWeek: number;
  hourOfDay: number;
  avgUpvotes: number;
  score: number;
  confidence: 'low' | 'medium' | 'high';
  reason: string;
}

interface SchedulingRecommendationsProps {
  subreddit: string;
  onSelectTime?: (time: OptimalTime) => void;
  showAutoSchedule?: boolean;
  className?: string;
}

export function SchedulingRecommendations({
  subreddit,
  onSelectTime,
  showAutoSchedule = false,
  className = ''
}: SchedulingRecommendationsProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const {
    data,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['optimal-times', subreddit],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch(
        `/api/scheduling/analyze-best-times?subreddit=${encodeURIComponent(subreddit)}&count=3`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (!res.ok) {
        throw new Error('Failed to fetch optimal times');
      }

      return res.json();
    },
    enabled: !!subreddit
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      const token = localStorage.getItem('auth_token');
      await fetch('/api/scheduling/refresh-cache', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ subreddit })
      });
      await refetch();
    } catch (err) {
      // Silent fail
    } finally {
      setIsRefreshing(false);
    }
  };

  if (!subreddit) {
    return null;
  }

  if (isLoading) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Optimal Times
          </CardTitle>
          <CardDescription>Analyzing best times to post...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-8 bg-gray-200 rounded"></div>
            <div className="h-8 bg-gray-200 rounded"></div>
            <div className="h-8 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive" className={className}>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Failed to load optimal times. Please try again.
        </AlertDescription>
      </Alert>
    );
  }

  const optimalTimes = data?.optimalTimes || [];

  if (optimalTimes.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Optimal Times
          </CardTitle>
          <CardDescription>
            {data?.message || 'No timing data available yet'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Post more content to r/{subreddit} to get personalized recommendations.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-yellow-500" />
              Best Times for r/{subreddit}
            </CardTitle>
            <CardDescription>
              AI-recommended posting times based on your history
            </CardDescription>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {optimalTimes.map((time: OptimalTime, index: number) => (
          <div
            key={`${time.dayOfWeek}-${time.hourOfDay}`}
            className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-muted-foreground w-6">
                #{index + 1}
              </span>
              <OptimalTimeBadge {...time} />
            </div>
            {onSelectTime && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => onSelectTime(time)}
              >
                <Calendar className="h-4 w-4 mr-1" />
                Schedule
              </Button>
            )}
          </div>
        ))}

        {showAutoSchedule && optimalTimes.length > 0 && (
          <Button className="w-full mt-2" variant="default">
            <Sparkles className="h-4 w-4 mr-2" />
            Auto-Schedule Post
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
