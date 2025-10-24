import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Calendar, Clock, AlertCircle, CheckCircle2, XCircle, Calendar as CalendarIcon } from 'lucide-react';
import { apiRequest, type ApiError } from '@/lib/queryClient';

interface PostJob {
  id: number;
  subreddit: string;
  titleFinal: string;
  bodyFinal?: string | null;
  mediaKey?: string | null;
  scheduledAt: string;
  status: 'pending' | 'sent' | 'failed';
  resultJson?: unknown;
  createdAt: string;
  updatedAt: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isValidStatus = (value: unknown): value is PostJob['status'] =>
  value === 'pending' || value === 'sent' || value === 'failed';

function parsePostJobs(data: unknown): PostJob[] {
  if (!Array.isArray(data)) {
    throw new Error('Invalid scheduled posts response format');
  }

  return data.reduce<PostJob[]>((posts, item) => {
    if (!isRecord(item)) {
      return posts;
    }

    const {
      id,
      subreddit,
      titleFinal,
      bodyFinal,
      mediaKey,
      scheduledAt,
      status,
      resultJson,
      createdAt,
      updatedAt,
    } = item;

    if (
      typeof id !== 'number' ||
      typeof subreddit !== 'string' ||
      typeof titleFinal !== 'string' ||
      typeof scheduledAt !== 'string' ||
      !isValidStatus(status) ||
      typeof createdAt !== 'string' ||
      typeof updatedAt !== 'string'
    ) {
      return posts;
    }

    posts.push({
      id,
      subreddit,
      titleFinal,
      bodyFinal: typeof bodyFinal === 'string' ? bodyFinal : null,
      mediaKey: typeof mediaKey === 'string' ? mediaKey : null,
      scheduledAt,
      status,
      resultJson,
      createdAt,
      updatedAt,
    });

    return posts;
  }, []);
}

interface SchedulePostForm {
  subreddit: string;
  title: string;
  body: string;
  mediaKey?: string;
  scheduledAt?: string;
}

function isApiError(error: unknown): error is ApiError {
  if (!error || typeof error !== 'object') {
    return false;
  }

  return 'status' in error && 'statusText' in error;
}

type SchedulePreset = 'optimal' | 'now' | '1h' | '6h' | '12h' | '24h' | 'custom';

export default function PostScheduler() {
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState<SchedulePreset>('optimal');
  const [formData, setFormData] = useState<SchedulePostForm>({
    subreddit: '',
    title: '',
    body: '',
    scheduledAt: undefined,
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch scheduled posts
  const { data: scheduledPosts = [], isLoading } = useQuery<PostJob[]>({
    queryKey: ['/api/posts/scheduled'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/posts/scheduled');
      const payload = await response.json();
      return parsePostJobs(payload);
    },
  });

  // Schedule post mutation
  const scheduleMutation = useMutation({
    mutationFn: async (data: SchedulePostForm) => {
      const response = await apiRequest('POST', '/api/posts/schedule', data);
      return response.json();
    },
    onSuccess: (_data) => {
      const scheduledSubreddit = formData.subreddit;
      queryClient.invalidateQueries({ queryKey: ['/api/posts/scheduled'] });
      setIsScheduleOpen(false);
      setFormData({ subreddit: '', title: '', body: '', scheduledAt: undefined });
      setSelectedPreset('optimal');
      toast({
        title: "Post scheduled",
        description: `Your post will be sent to r/${scheduledSubreddit} at the optimal time`,
      });
    },
    onError: (error: unknown) => {
      let toastTitle = "Failed to schedule post";
      let description = "Please check your input and try again";

      if (isApiError(error)) {
        if (error.isAuthError) {
          toastTitle = "Authentication required";
          description = error.userMessage ?? "Please log in to schedule posts.";
        } else {
          description = error.userMessage ?? error.message;
        }
      } else if (error instanceof Error) {
        description = error.message;
      }

      toast({
        title: toastTitle,
        description,
        variant: "destructive",
      });
    },
  });

  const handleScheduleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.subreddit || !formData.title) {
      toast({
        title: "Missing information",
        description: "Please provide at least a subreddit and title",
        variant: "destructive",
      });
      return;
    }

    const presetOffsets: Record<Exclude<SchedulePreset, 'optimal' | 'now' | 'custom'>, number> = {
      '1h': 60 * 60 * 1000,
      '6h': 6 * 60 * 60 * 1000,
      '12h': 12 * 60 * 60 * 1000,
      '24h': 24 * 60 * 60 * 1000,
    };

    let scheduledAt: string | undefined;
    if (selectedPreset === 'custom') {
      scheduledAt = formData.scheduledAt;
    } else if (selectedPreset === 'now' || selectedPreset === 'optimal') {
      scheduledAt = undefined;
    } else {
      scheduledAt = new Date(Date.now() + presetOffsets[selectedPreset]).toISOString();
    }

    scheduleMutation.mutate({
      ...formData,
      scheduledAt,
    });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-blue-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge variant="outline" className="text-green-700 border-green-300">Sent</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="secondary">Pending</Badge>;
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString(),
      time: date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Reddit Post Scheduler</h2>
        <Dialog open={isScheduleOpen} onOpenChange={setIsScheduleOpen}>
          <DialogTrigger asChild>
            <Button data-testid="button-schedule-new-post">
              <Calendar className="h-4 w-4 mr-2" />
              Schedule New Post
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Schedule Reddit Post</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleScheduleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Subreddit</label>
                <Input
                  value={formData.subreddit}
                  onChange={(e) => setFormData({ ...formData, subreddit: e.target.value })}
                  data-testid="input-subreddit"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Title</label>
                <Input
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  data-testid="input-title"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Body (Optional)</label>
                <Textarea
                  value={formData.body}
                  onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                  rows={4}
                  data-testid="textarea-body"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-2">Schedule Time</label>
                <Select
                  value={selectedPreset}
                  onValueChange={(value) => {
                    const preset = value as SchedulePreset;
                    setSelectedPreset(preset);
                    if (preset !== 'custom') {
                      setFormData((prev) => ({ ...prev, scheduledAt: undefined }));
                    }
                  }}
                >
                  <SelectTrigger data-testid="select-schedule-time">
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="optimal">Optimal Time (AI-determined)</SelectItem>
                    <SelectItem value="now">Send Now</SelectItem>
                    <SelectItem value="1h">In 1 Hour</SelectItem>
                    <SelectItem value="6h">In 6 Hours</SelectItem>
                    <SelectItem value="12h">In 12 Hours</SelectItem>
                    <SelectItem value="24h">In 24 Hours</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500 mt-1">
                  Optimal timing analyzes subreddit activity patterns for maximum engagement
                </p>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsScheduleOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={scheduleMutation.isPending} data-testid="button-submit-schedule">
                  {scheduleMutation.isPending ? 'Scheduling...' : 'Schedule Post'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Info Card */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
            <div className="space-y-1">
              <p className="font-medium">Smart Scheduling Active</p>
              <p className="text-sm text-gray-600">
                Posts are automatically scheduled for optimal engagement times based on subreddit activity patterns.
                Rate limiting ensures compliance with Reddit&apos;s posting guidelines.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Scheduled Posts */}
      <Card>
        <CardHeader>
          <CardTitle>Scheduled Posts</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="space-y-2 flex-1">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : scheduledPosts.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <CalendarIcon className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>No scheduled posts yet. Schedule your first post to get started!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {scheduledPosts.map((post) => {
                const { date, time } = formatDateTime(post.scheduledAt);
                const resultData = isRecord(post.resultJson) ? post.resultJson : null;
                const resultUrl = typeof resultData?.url === 'string' ? resultData.url : undefined;
                const resultError = typeof resultData?.error === 'string' ? resultData.error : undefined;

                return (
                  <div key={post.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">r/{post.subreddit}</Badge>
                          {getStatusBadge(post.status)}
                        </div>
                        <h3 className="font-medium line-clamp-2">{post.titleFinal}</h3>
                        {post.bodyFinal && (
                          <p className="text-sm text-gray-600 line-clamp-3">{post.bodyFinal}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-gray-500">
                        {getStatusIcon(post.status)}
                        <div className="text-right">
                          <div>{date}</div>
                          <div>{time}</div>
                        </div>
                      </div>
                    </div>
                    
                    {post.status === 'sent' && resultUrl && (
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <a 
                          href={resultUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:underline"
                        >
                          View on Reddit
                        </a>
                      </div>
                    )}
                    
                    {post.status === 'failed' && resultError && (
                      <div className="flex items-center gap-2 text-sm text-red-600">
                        <XCircle className="h-4 w-4" />
                        <span>Failed: {resultError}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}