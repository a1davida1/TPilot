/**
 * Comment Engagement Component (MISSING-1)
 * 
 * Displays comment engagement metrics and highlights posts needing responses
 */

import { memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MessageSquare, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

// Performance: Extract repeated classNames
const ENGAGEMENT_CARD_CLASSES = "border rounded-lg p-4 hover:bg-accent/50 transition-colors";
const STATS_CARD_CLASSES = "p-4 border rounded-lg";

interface CommentEngagementMetrics {
  postId: number;
  redditPostId: string | null;
  subreddit: string;
  title: string;
  commentCount: number;
  avgCommentLength: number | null;
  userReplied: boolean;
  upvotes: number;
  commentToUpvoteRatio: number;
  engagementQuality: 'excellent' | 'good' | 'average' | 'low';
  needsResponse: boolean;
  occurredAt: string;
}

interface CommentEngagementStats {
  totalComments: number;
  avgCommentsPerPost: number;
  avgCommentToUpvoteRatio: number;
  responseRate: number;
  postsNeedingResponse: CommentEngagementMetrics[];
  topEngagingPosts: CommentEngagementMetrics[];
  engagementTrend: 'improving' | 'stable' | 'declining' | 'unknown';
}

const qualityConfig = {
  excellent: {
    color: 'text-green-600 dark:text-green-400',
    bgColor: 'bg-green-100 dark:bg-green-900',
    label: 'Excellent',
  },
  good: {
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-100 dark:bg-blue-900',
    label: 'Good',
  },
  average: {
    color: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-100 dark:bg-yellow-900',
    label: 'Average',
  },
  low: {
    color: 'text-gray-600 dark:text-gray-400',
    bgColor: 'bg-gray-100 dark:bg-gray-900',
    label: 'Low',
  },
};

export const CommentEngagement = memo(function CommentEngagement() {
  const { data, isLoading, error } = useQuery<CommentEngagementStats>({
    queryKey: ['comment-engagement-stats'],
    queryFn: async () => {
      const response = await fetch('/api/analytics/comment-engagement/stats', {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch comment engagement stats');
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
            <MessageSquare className="h-5 w-5" />
            Comment Engagement
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
            <MessageSquare className="h-5 w-5" />
            Comment Engagement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            Unable to load comment engagement data. Please try again later.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Comment Engagement Overview
          </CardTitle>
          <CardDescription>
            Track conversation quality and response opportunities
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className={STATS_CARD_CLASSES}>
              <div className="text-2xl font-bold">{data.totalComments}</div>
              <div className="text-sm text-muted-foreground">Total Comments</div>
            </div>

            <div className={STATS_CARD_CLASSES}>
              <div className="text-2xl font-bold">{data.avgCommentsPerPost}</div>
              <div className="text-sm text-muted-foreground">Avg per Post</div>
            </div>

            <div className={STATS_CARD_CLASSES}>
              <div className="text-2xl font-bold">{data.avgCommentToUpvoteRatio}%</div>
              <div className="text-sm text-muted-foreground">Comment/Upvote Ratio</div>
            </div>

            <div className={STATS_CARD_CLASSES}>
              <div className="text-2xl font-bold">{data.responseRate}%</div>
              <div className="text-sm text-muted-foreground">Response Rate</div>
              <Progress value={data.responseRate} className="mt-2" />
            </div>
          </div>

          {/* Trend Indicator */}
          {data.engagementTrend !== 'unknown' && (
            <div className="mt-4 flex items-center gap-2 text-sm">
              <TrendingUp
                className={cn(
                  'h-4 w-4',
                  data.engagementTrend === 'improving' && 'text-green-600',
                  data.engagementTrend === 'declining' && 'text-red-600 rotate-180',
                  data.engagementTrend === 'stable' && 'text-gray-600'
                )}
              />
              <span className="text-muted-foreground">
                Engagement is{' '}
                <span className="font-medium capitalize">{data.engagementTrend}</span>
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Posts Needing Response */}
      {data.postsNeedingResponse.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-orange-600" />
              Posts Needing Response
            </CardTitle>
            <CardDescription>
              {data.postsNeedingResponse.length} post(s) with comments awaiting your reply
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.postsNeedingResponse.map((post) => (
                <div
                  key={post.postId}
                  className={ENGAGEMENT_CARD_CLASSES}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="font-medium line-clamp-1">{post.title}</div>
                      <div className="text-sm text-muted-foreground">
                        r/{post.subreddit}
                      </div>
                    </div>
                    <Badge variant="destructive" className="ml-2">
                      {post.commentCount} comments
                    </Badge>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div>{post.upvotes} upvotes</div>
                    <div>Ratio: {post.commentToUpvoteRatio}%</div>
                    <div>{new Date(post.occurredAt).toLocaleDateString()}</div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Top Engaging Posts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Top Engaging Posts
          </CardTitle>
          <CardDescription>
            Posts with the highest comment-to-upvote ratios
          </CardDescription>
        </CardHeader>
        <CardContent>
          {data.topEngagingPosts.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">
              No engaging posts yet. Keep posting to build engagement!
            </div>
          ) : (
            <div className="space-y-3">
              {data.topEngagingPosts.map((post) => {
                const config = qualityConfig[post.engagementQuality];

                return (
                  <div
                    key={post.postId}
                    className={ENGAGEMENT_CARD_CLASSES}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="font-medium line-clamp-1">{post.title}</div>
                        <div className="text-sm text-muted-foreground">
                          r/{post.subreddit}
                        </div>
                      </div>
                      <Badge
                        variant="secondary"
                        className={cn(config.bgColor, config.color)}
                      >
                        {config.label}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-4 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">Comments</div>
                        <div className="font-medium">{post.commentCount}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Upvotes</div>
                        <div className="font-medium">{post.upvotes}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Ratio</div>
                        <div className="font-medium">{post.commentToUpvoteRatio}%</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Replied</div>
                        <div className="font-medium">
                          {post.userReplied ? '✓ Yes' : '✗ No'}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card>
        <CardHeader>
          <CardTitle>Understanding Comment Engagement</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <Alert>
              <MessageSquare className="h-4 w-4" />
              <AlertDescription>
                <strong>Comment-to-Upvote Ratio:</strong> Measures conversation quality.
                Higher ratios indicate posts that spark discussion.
              </AlertDescription>
            </Alert>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="p-3 border rounded">
                <div className="font-semibold text-green-600">Excellent: 15%+</div>
                <div className="text-muted-foreground">Highly engaging content</div>
              </div>
              <div className="p-3 border rounded">
                <div className="font-semibold text-blue-600">Good: 10-15%</div>
                <div className="text-muted-foreground">Strong engagement</div>
              </div>
              <div className="p-3 border rounded">
                <div className="font-semibold text-yellow-600">Average: 5-10%</div>
                <div className="text-muted-foreground">Moderate engagement</div>
              </div>
              <div className="p-3 border rounded">
                <div className="font-semibold text-gray-600">Low: &lt;5%</div>
                <div className="text-muted-foreground">Limited conversation</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});
