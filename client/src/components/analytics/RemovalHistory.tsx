/**
 * Removal History Component (QW-2)
 * 
 * Displays post removal history with insights and recommendations
 */

import { useState, useMemo, memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Ban, Shield, Clock, TrendingDown, Info } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { apiRequest } from '@/lib/queryClient';

interface RemovalInsight {
  id: number;
  subreddit: string;
  title: string;
  removalReason: string | null;
  removalType: string | null;
  occurredAt: string;
  detectedAt: string | null;
  timeUntilRemovalMinutes: number | null;
  redditPostId: string | null;
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

// Helper functions moved outside component for performance
const getRemovalTypeBadge = (type: string | null) => {
  if (!type) return { variant: 'secondary' as const, label: 'Unknown' };
  
  switch (type.toLowerCase()) {
    case 'moderator':
      return { variant: 'destructive' as const, label: 'Moderator' };
    case 'spam':
      return { variant: 'destructive' as const, label: 'Spam Filter' };
    case 'automod_filtered':
      return { variant: 'default' as const, label: 'AutoMod' };
    default:
      return { variant: 'secondary' as const, label: type };
  }
};

const formatTime = (minutes: number | null) => {
  if (!minutes) return 'Unknown';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
};

export const RemovalHistory = memo(function RemovalHistory() {
  const [daysBack, setDaysBack] = useState('90');
  const [selectedSubreddit, setSelectedSubreddit] = useState<string>('all');

  // Fetch removal stats
  const { data: stats, isLoading } = useQuery<RemovalStats>({
    queryKey: ['/api/analytics/removal-stats', daysBack],
    queryFn: async () => {
      const response = await apiRequest<RemovalStats>(
        'GET',
        `/api/analytics/removal-stats?daysBack=${daysBack}`
      );
      return response;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-32 bg-gray-200 rounded mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertTitle>No Data Available</AlertTitle>
        <AlertDescription>
          Start posting to track removal patterns and get insights.
        </AlertDescription>
      </Alert>
    );
  }

  // Memoized computations to prevent re-filtering on every render
  const filteredRemovals = useMemo(() => {
    if (!stats) return [];
    return selectedSubreddit === 'all'
      ? stats.recentRemovals
      : stats.recentRemovals.filter((r) => r.subreddit === selectedSubreddit);
  }, [stats, selectedSubreddit]);

  const subreddits = useMemo(() => {
    if (!stats) return [];
    return Array.from(new Set(stats.recentRemovals.map((r) => r.subreddit)));
  }, [stats]);

  return (
    <div className="space-y-6">
      {/* Header with filters */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Post Removal Tracker</h2>
          <p className="text-gray-600">Learn from removals to improve future posts</p>
        </div>
        <div className="flex gap-2">
          <Select value={daysBack} onValueChange={setDaysBack}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="180">Last 6 months</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Removals</CardTitle>
            <Ban className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.totalRemovals}</div>
            <p className="text-xs text-muted-foreground">
              {stats.removalRate.toFixed(1)}% removal rate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Affected Subreddits</CardTitle>
            <TrendingDown className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.patternsBySubreddit.length}</div>
            <p className="text-xs text-muted-foreground">
              {stats.topReasons.length} unique reasons
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Top Issue</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold truncate">
              {stats.topReasons[0]?.reason || 'None'}
            </div>
            <p className="text-xs text-muted-foreground">
              {stats.topReasons[0]?.count || 0} occurrences
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Patterns by Subreddit */}
      {stats.patternsBySubreddit.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Removal Patterns by Subreddit</CardTitle>
            <CardDescription>
              Identify problematic subreddits and common issues
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {stats.patternsBySubreddit.map((pattern) => (
                <div
                  key={pattern.subreddit}
                  className="border rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold">r/{pattern.subreddit}</h4>
                      <p className="text-sm text-gray-600">
                        {pattern.totalRemovals} removals ({pattern.removalRate}% rate)
                      </p>
                    </div>
                    {pattern.avgTimeUntilRemoval && (
                      <Badge variant="outline">
                        <Clock className="h-3 w-3 mr-1" />
                        Avg: {formatTime(pattern.avgTimeUntilRemoval)}
                      </Badge>
                    )}
                  </div>

                  {/* Common Reasons */}
                  {pattern.commonReasons.length > 0 && (
                    <div>
                      <p className="text-sm font-medium mb-2">Common Reasons:</p>
                      <div className="flex flex-wrap gap-2">
                        {pattern.commonReasons.map((reason, idx) => (
                          <Badge key={idx} variant="secondary">
                            {reason.reason} ({reason.percentage}%)
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Recommendations */}
                  {pattern.recommendations.length > 0 && (
                    <Alert>
                      <Shield className="h-4 w-4" />
                      <AlertTitle>Recommendations</AlertTitle>
                      <AlertDescription>
                        <ul className="list-disc list-inside space-y-1 mt-2">
                          {pattern.recommendations.map((rec, idx) => (
                            <li key={idx} className="text-sm">
                              {rec}
                            </li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Removals Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Recent Removals</CardTitle>
              <CardDescription>
                Detailed history of removed posts
              </CardDescription>
            </div>
            <Select value={selectedSubreddit} onValueChange={setSelectedSubreddit}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="Filter by subreddit" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Subreddits</SelectItem>
                {subreddits.map((sub) => (
                  <SelectItem key={sub} value={sub}>
                    r/{sub}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {filteredRemovals.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Ban className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No removals found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Post</TableHead>
                  <TableHead>Subreddit</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Time to Removal</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRemovals.map((removal) => {
                  const badge = getRemovalTypeBadge(removal.removalType);
                  return (
                    <TableRow key={removal.id}>
                      <TableCell className="max-w-xs">
                        <div className="truncate font-medium">{removal.title}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">r/{removal.subreddit}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={badge.variant}>{badge.label}</Badge>
                      </TableCell>
                      <TableCell className="max-w-xs">
                        <div className="truncate text-sm text-gray-600">
                          {removal.removalReason || 'No reason provided'}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm">
                          {formatTime(removal.timeUntilRemovalMinutes)}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-gray-600">
                        {new Date(removal.occurredAt).toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Top Reasons Across All Subreddits */}
      {stats.topReasons.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Most Common Removal Reasons</CardTitle>
            <CardDescription>
              Across all your subreddits
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.topReasons.slice(0, 5).map((reason, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1">
                    <p className="font-medium">{reason.reason}</p>
                    <p className="text-sm text-gray-600">
                      Affects {reason.subreddits.length} subreddit
                      {reason.subreddits.length !== 1 ? 's' : ''}:{' '}
                      {reason.subreddits.slice(0, 3).map((s) => `r/${s}`).join(', ')}
                      {reason.subreddits.length > 3 && ` +${reason.subreddits.length - 3} more`}
                    </p>
                  </div>
                  <Badge variant="secondary">{reason.count} times</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* No removals state */}
      {stats.totalRemovals === 0 && (
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertTitle>Great Job!</AlertTitle>
          <AlertDescription>
            No post removals detected in the last {daysBack} days. Keep following subreddit rules!
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
});
