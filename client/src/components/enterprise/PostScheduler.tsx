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
import { apiRequest } from '@/lib/queryClient';

interface PostJob {
  id: number;
  subreddit: string;
  titleFinal: string;
  bodyFinal: string;
  mediaKey?: string;
  scheduledAt: string;
  status: 'pending' | 'sent' | 'failed';
  resultJson?: unknown;
  createdAt: string;
  updatedAt: string;
}

interface SchedulePostForm {
  subreddit: string;
  title: string;
  body: string;
  mediaKey?: string;
  scheduledAt?: string;
}

export default function PostScheduler() {
  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [formData, setFormData] = useState<SchedulePostForm>({
    subreddit: '',
    title: '',
    body: '',
  });

  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch scheduled posts
  const { data: scheduledPosts = [], isLoading } = useQuery({
    queryKey: ['/api/posts/scheduled'],
  });

  // Schedule post mutation
  const scheduleMutation = useMutation({
    mutationFn: async (data: SchedulePostForm) => {
      const response = await apiRequest('POST', '/api/posts/schedule', data);
      return response.json();
    },
    onSuccess: (_data) => {
      queryClient.invalidateQueries({ queryKey: ['/api/posts/scheduled'] });
      setIsScheduleOpen(false);
      setFormData({ subreddit: '', title: '', body: '' });
      toast({
        title: "Post scheduled",
        description: `Your post will be sent to r/${formData.subreddit} at the optimal time`,
      });
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : "Please check your input and try again";
      toast({
        title: "Failed to schedule post",
        description: errorMessage,
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
    scheduleMutation.mutate(formData);
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
                <Select value={formData.scheduledAt || 'optimal'} onValueChange={(value) => 
                  setFormData({ ...formData, scheduledAt: value === 'optimal' ? undefined : value })
                }>
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
          ) : (scheduledPosts as PostJob[])?.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <CalendarIcon className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>No scheduled posts yet. Schedule your first post to get started!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {(scheduledPosts as PostJob[])?.map((post: PostJob) => {
                const { date, time } = formatDateTime(post.scheduledAt);
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
                    
                    {post.status === 'sent' && (post.resultJson as any)?.url && (
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        <a 
                          href={(post.resultJson as any).url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-blue-500 hover:underline"
                        >
                          View on Reddit
                        </a>
                      </div>
                    )}
                    
                    {post.status === 'failed' && (post.resultJson as any)?.error && (
                      <div className="flex items-center gap-2 text-sm text-red-600">
                        <XCircle className="h-4 w-4" />
                        <span>Failed: {(post.resultJson as any).error}</span>
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