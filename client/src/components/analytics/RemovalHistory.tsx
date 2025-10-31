/**
 * Removal History Component (QW-2)
 * 
 * Displays post removal history with insights and patterns
 */

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, TrendingDown, Clock, Info } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface RemovalInsight {
  id: number;
  subreddit: string;
  title: string;
  removalReason: string | null;
  removalType: string | null;
  occurredAt: string;
  detectedAt: string | null;
  timeUntilRemovalMinutes: number | null;
}

interface RemovalPattern {
  subreddit: string;
  totalRemovals: number;
  removalRate: number;
  commonReasons: Array<{
    reason: string;
    count: number;
    percentage: number;
  }>;
  avgTimeUntilRemoval: number | null;
  recommendations: string[];
}

interface RemovalStats {
  totalRemovals: number;
  removalRate: number;
  recentRemovals: RemovalInsight[];
  patternsBySubreddit: RemovalPattern[];
  topReasons: Array<{
    reason: string;
    count: number;
    subreddits: string[];
  }>;
}

export function RemovalHistory() {
  const { data, isLoading, error } = useQuery<RemovalStats>({
    queryKey: ['removal-stats'],
    queryFn: async () => {
      const response = await fetch('/api/analytics/removal-stats', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch removal stats');
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
            <AlertTriangle className="h-5 w-5" />
            Post Removal Tracker
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-64" />
        </CardContent>
      </Card>
    );
  }

  if (error || !data) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Post Removal Tracker
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            Unable to load removal data. Please try again later.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          Post Removal Tracker
        </CardTitle>
        <CardDescription>
          Learn from removals to prevent future issues
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Overview Stats */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="p-4 border rounded-lg">
            <div className="text-2xl font-bold text-red-600">
              {data.totalRemovals}
            </div>
            <div className="text-sm text-muted-foreground">Total Removals</div>
          </div>
          <div className="p-4 border rounded-lg">
            <div className="text-2xl font-bold text-red-600">
              {data.removalRate}%
            </div>
            <div className="text-sm text-muted-foreground">Removal Rate</div>
          </div>
        </div>

        {data.totalRemovals === 0 ? (
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              No post removals detected. Keep up the good work!
            </AlertDescription>
          </Alert>
        ) : (
          <Tabs defaultValue="recent" className="space-y-4">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="recent">Recent</TabsTrigger>
              <TabsTrigger value="patterns">Patterns</TabsTrigger>
              <TabsTrigger value="reasons">Top Reasons</TabsTrigger>
            </TabsList>

            {/* Recent Removals */}
            <TabsContent value="recent" className="space-y-3">
              {data.recentRemovals.map((removal) => (
                <div
                  key={removal.id}
                  className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="font-medium line-clamp-1">
                        {removal.title}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        r/{removal.subreddit}
                      </div>
                    </div>
                    <Badge variant="destructive" className="ml-2">
                      Removed
                    </Badge>
                  </div>

                  {removal.removalReason && (
                    <div className="text-sm text-muted-foreground mb-2">
                      <span className="font-medium">Reason:</span>{' '}
                      {removal.removalReason}
                    </div>
                  )}

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {new Date(removal.occurredAt).toLocaleDateString()}
                    </div>
                    {removal.timeUntilRemovalMinutes && (
                      <div>
                        Removed after {removal.timeUntilRemovalMinutes} minutes
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </TabsContent>

            {/* Patterns by Subreddit */}
            <TabsContent value="patterns" className="space-y-4">
              {data.patternsBySubreddit.map((pattern) => (
                <div key={pattern.subreddit} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="font-semibold">r/{pattern.subreddit}</div>
                      <div className="text-sm text-muted-foreground">
                        {pattern.totalRemovals} removals ({pattern.removalRate}%
                        rate)
                      </div>
                    </div>
                    <TrendingDown className="h-5 w-5 text-red-500" />
                  </div>

                  {pattern.commonReasons.length > 0 && (
                    <div className="mb-3">
                      <div className="text-sm font-medium mb-2">
                        Common Reasons:
                      </div>
                      <div className="space-y-1">
                        {pattern.commonReasons.map((reason, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-sm"
                          >
                            <span className="text-muted-foreground">
                              {reason.reason}
                            </span>
                            <Badge variant="outline">
                              {reason.count} ({reason.percentage}%)
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {pattern.recommendations.length > 0 && (
                    <Alert>
                      <AlertTriangle className="h-4 w-4" />
                      <AlertDescription>
                        <ul className="list-disc list-inside space-y-1 text-sm">
                          {pattern.recommendations.map((rec, idx) => (
                            <li key={idx}>{rec}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              ))}
            </TabsContent>

            {/* Top Reasons */}
            <TabsContent value="reasons" className="space-y-3">
              {data.topReasons.map((reason, idx) => (
                <div key={idx} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="font-medium">{reason.reason}</div>
                    <Badge>{reason.count} times</Badge>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    Affected subreddits: {reason.subreddits.join(', ')}
                  </div>
                </div>
              ))}
            </TabsContent>
          </Tabs>
        )}
      </CardContent>
    </Card>
  );
}
