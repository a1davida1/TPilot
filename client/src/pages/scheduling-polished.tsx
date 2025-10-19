/**
 * Polished Post Scheduling with Apple Design
 */

import { useState } from 'react';
import {
  Clock,
  Plus,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  XCircle,
  Edit,
  Trash2
} from 'lucide-react';
import { AppleCard, AppleCardContent, AppleCardHeader, AppleCardTitle } from '@/components/ui/apple-card';
import { AppleButton } from '@/components/ui/apple-button';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface ScheduledPost {
  id: string;
  title: string;
  subreddit: string;
  scheduledFor: Date;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  imageUrl?: string;
  optimalTime?: boolean;
}

function StatusBadge({ status }: { status: ScheduledPost['status'] }) {
  const config = {
    pending: { icon: Clock, className: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-950/50' },
    processing: { icon: AlertCircle, className: 'text-blue-600 bg-blue-50 dark:bg-blue-950/50' },
    completed: { icon: CheckCircle, className: 'text-green-600 bg-green-50 dark:bg-green-950/50' },
    failed: { icon: XCircle, className: 'text-red-600 bg-red-50 dark:bg-red-950/50' }
  };

  const { icon: Icon, className } = config[status];

  return (
    <div className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium", className)}>
      <Icon className="h-3 w-3" />
      {status}
    </div>
  );
}

export function PolishedScheduling() {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');

  // Mock scheduled posts
  const scheduledPosts: ScheduledPost[] = [
    {
      id: '1',
      title: 'Amazing sunset photo from my balcony',
      subreddit: 'r/EarthPorn',
      scheduledFor: new Date(Date.now() + 2 * 60 * 60 * 1000),
      status: 'pending',
      optimalTime: true
    },
    {
      id: '2',
      title: 'My new digital art piece',
      subreddit: 'r/Art',
      scheduledFor: new Date(Date.now() + 24 * 60 * 60 * 1000),
      status: 'pending'
    },
    {
      id: '3',
      title: 'Tips for better photography',
      subreddit: 'r/photography',
      scheduledFor: new Date(Date.now() - 24 * 60 * 60 * 1000),
      status: 'completed'
    }
  ];

  const upcomingPosts = scheduledPosts.filter(p => p.status === 'pending' || p.status === 'processing');
  const completedPosts = scheduledPosts.filter(p => p.status === 'completed' || p.status === 'failed');

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-7xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Post Scheduling</h1>
            <p className="text-muted-foreground mt-1">
              Plan and schedule your Reddit posts for optimal engagement
            </p>
          </div>
          
          <AppleButton variant="gradient" size="lg">
            <Plus className="h-5 w-5 mr-2" />
            Schedule New Post
          </AppleButton>
        </div>

        {/* Smart Scheduling Tips */}
        <AppleCard variant="glass" className="border-primary/20">
          <AppleCardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-600">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold mb-1">Smart Scheduling Active</h3>
                <p className="text-sm text-muted-foreground">
                  Posts marked with ⚡ are scheduled at optimal times based on subreddit activity patterns.
                  Your next best posting window is in 2 hours.
                </p>
              </div>
              <AppleButton variant="outline" size="sm">
                Learn More
              </AppleButton>
            </div>
          </AppleCardContent>
        </AppleCard>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Calendar View */}
          <div className="lg:col-span-2">
            <AppleCard variant="default">
              <AppleCardHeader>
                <div className="flex items-center justify-between">
                  <AppleCardTitle>Calendar View</AppleCardTitle>
                  <div className="flex items-center gap-2">
                    <AppleButton variant="ghost" size="icon">
                      <ChevronLeft className="h-4 w-4" />
                    </AppleButton>
                    <span className="text-sm font-medium">
                      {format(selectedDate, 'MMMM yyyy')}
                    </span>
                    <AppleButton variant="ghost" size="icon">
                      <ChevronRight className="h-4 w-4" />
                    </AppleButton>
                  </div>
                </div>
              </AppleCardHeader>
              <AppleCardContent>
                {/* Calendar Grid Placeholder */}
                <div className="grid grid-cols-7 gap-2">
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                    <div key={day} className="text-center text-xs font-medium text-muted-foreground py-2">
                      {day}
                    </div>
                  ))}
                  {Array.from({ length: 35 }, (_, i) => (
                    <div
                      key={i}
                      className={cn(
                        "aspect-square rounded-lg border border-border/50 p-2 hover:bg-accent/50 transition-colors cursor-pointer",
                        i === 15 && "bg-primary/10 border-primary"
                      )}
                    >
                      <div className="text-xs font-medium">{(i % 31) + 1}</div>
                      {i === 15 && (
                        <div className="mt-1">
                          <div className="h-1 w-full bg-primary rounded-full" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </AppleCardContent>
            </AppleCard>
          </div>

          {/* Upcoming Posts Sidebar */}
          <div className="space-y-6">
            {/* Stats */}
            <AppleCard variant="glass">
              <AppleCardContent className="p-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-2xl font-bold">{upcomingPosts.length}</p>
                    <p className="text-xs text-muted-foreground">Scheduled</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{completedPosts.length}</p>
                    <p className="text-xs text-muted-foreground">Completed</p>
                  </div>
                </div>
              </AppleCardContent>
            </AppleCard>

            {/* Today's Posts */}
            <AppleCard variant="default">
              <AppleCardHeader>
                <AppleCardTitle className="text-base">Today's Posts</AppleCardTitle>
              </AppleCardHeader>
              <AppleCardContent>
                <div className="space-y-3">
                  {upcomingPosts.slice(0, 3).map((post) => (
                    <div key={post.id} className="space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{post.title}</p>
                          <p className="text-xs text-muted-foreground">{post.subreddit}</p>
                        </div>
                        {post.optimalTime && (
                          <div className="ml-2">
                            <TrendingUp className="h-4 w-4 text-yellow-500" />
                          </div>
                        )}
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {format(post.scheduledFor, 'h:mm a')}
                        </span>
                        <StatusBadge status={post.status} />
                      </div>
                    </div>
                  ))}
                </div>
              </AppleCardContent>
            </AppleCard>
          </div>
        </div>

        {/* Scheduled Posts List */}
        <AppleCard variant="default">
          <AppleCardHeader>
            <div className="flex items-center justify-between">
              <AppleCardTitle>All Scheduled Posts</AppleCardTitle>
              <AppleButton variant="outline" size="sm">
                View History
              </AppleButton>
            </div>
          </AppleCardHeader>
          <AppleCardContent>
            <div className="space-y-3">
              {scheduledPosts.map((post) => (
                <div
                  key={post.id}
                  className="flex items-center gap-4 p-4 rounded-lg border border-border/50 hover:bg-accent/50 transition-colors"
                >
                  {/* Image Thumbnail */}
                  <div className="h-16 w-16 rounded-lg bg-gradient-to-br from-primary/20 to-primary/10 flex-shrink-0" />
                  
                  {/* Post Details */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-sm truncate">{post.title}</h3>
                      {post.optimalTime && (
                        <div className="flex items-center gap-1 text-yellow-500">
                          <Sparkles className="h-3 w-3" />
                          <span className="text-xs font-medium">Optimal</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-xs text-muted-foreground">{post.subreddit}</span>
                      <span className="text-xs text-muted-foreground">
                        {format(post.scheduledFor, 'MMM dd, h:mm a')}
                      </span>
                    </div>
                  </div>

                  {/* Status */}
                  <StatusBadge status={post.status} />

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <AppleButton variant="ghost" size="icon" className="h-8 w-8">
                      <Edit className="h-4 w-4" />
                    </AppleButton>
                    <AppleButton variant="ghost" size="icon" className="h-8 w-8">
                      <Trash2 className="h-4 w-4" />
                    </AppleButton>
                  </div>
                </div>
              ))}
            </div>
          </AppleCardContent>
        </AppleCard>
      </div>
    </div>
  );
}
