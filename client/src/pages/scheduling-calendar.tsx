import { useState, useEffect } from 'react';
import { Calendar, Clock, Plus, Edit2, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths } from 'date-fns';

interface ScheduledPost {
  id: string;
  title: string;
  subreddit: string;
  scheduledFor: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  imageUrl?: string;
  content?: string;
}

export function SchedulingCalendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [_loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  const tierLimits = {
    free: 0,
    starter: 0,
    pro: 7,
    premium: 30
  };

  const userLimit = tierLimits[user?.tier as keyof typeof tierLimits] || 0;

  useEffect(() => {
    fetchScheduledPosts();
  }, [currentMonth]);

  const fetchScheduledPosts = async () => {
    try {
      const start = startOfMonth(currentMonth);
      const end = endOfMonth(currentMonth);
      
      const response = await apiRequest('GET', '/api/scheduled-posts', {
        startDate: start.toISOString(),
        endDate: end.toISOString()
      });
      const data = await response.json();
      
      setScheduledPosts(data.posts || []);
    } catch (_error) {
      console.error('Failed to fetch scheduled posts:', _error);
    } finally {
      setLoading(false);
    }
  };

  const cancelPost = async (postId: string) => {
    try {
      await apiRequest('PUT', `/api/scheduled-posts/${postId}/cancel`);
      toast({
        title: 'Post cancelled',
        description: 'The scheduled post has been cancelled'
      });
      fetchScheduledPosts();
    } catch (_error) {
      toast({
        title: 'Failed to cancel',
        description: 'Could not cancel the scheduled post',
        variant: 'destructive'
      });
    }
  };

  const days = eachDayOfInterval({
    start: startOfMonth(currentMonth),
    end: endOfMonth(currentMonth)
  });

  const getPostsForDay = (date: Date) => {
    return scheduledPosts.filter(post => 
      isSameDay(new Date(post.scheduledFor), date)
    );
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'cancelled': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (userLimit === 0) {
    return (
      <div className="container mx-auto p-6">
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle>Post Scheduling</CardTitle>
            <CardDescription>Schedule your Reddit posts in advance</CardDescription>
          </CardHeader>
          <CardContent className="text-center py-12">
            <Calendar className="h-16 w-16 mx-auto mb-4 text-gray-400" />
            <h3 className="text-xl font-semibold mb-2">Scheduling Not Available</h3>
            <p className="text-gray-600 mb-4">
              Post scheduling is available for Pro and Premium tiers only
            </p>
            <div className="grid gap-4 max-w-md mx-auto mt-6">
              <div className="p-4 border rounded-lg">
                <Badge className="mb-2">Pro - $29/mo</Badge>
                <p className="text-sm">Schedule posts up to 7 days in advance</p>
              </div>
              <div className="p-4 border rounded-lg">
                <Badge className="mb-2" variant="secondary">Premium - $99/mo</Badge>
                <p className="text-sm">Schedule posts up to 30 days in advance</p>
              </div>
            </div>
            <Button className="mt-6">Upgrade Now</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Scheduling Calendar</h1>
          <p className="text-gray-600">
            Schedule posts up to {userLimit} days in advance
          </p>
        </div>
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          Schedule New Post
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[2fr,1fr]">
        {/* Calendar View */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{format(currentMonth, 'MMMM yyyy')}</CardTitle>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentMonth(new Date())}
                >
                  Today
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
                >
                  Next
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                <div key={day} className="p-2 text-center text-sm font-medium text-gray-600">
                  {day}
                </div>
              ))}
              {days.map(day => {
                const posts = getPostsForDay(day);
                const isToday = isSameDay(day, new Date());
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                
                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setSelectedDate(day)}
                    className={`
                      min-h-[80px] p-2 border rounded-lg text-left transition-colors
                      ${isToday ? 'bg-blue-50 border-blue-300' : 'hover:bg-gray-50'}
                      ${isSelected ? 'ring-2 ring-purple-500' : ''}
                    `}
                  >
                    <div className="text-sm font-medium">{format(day, 'd')}</div>
                    {posts.length > 0 && (
                      <div className="mt-1 space-y-1">
                        {posts.slice(0, 2).map(post => (
                          <div
                            key={post.id}
                            className="text-xs px-1 py-0.5 rounded bg-purple-100 text-purple-800 truncate"
                          >
                            r/{post.subreddit}
                          </div>
                        ))}
                        {posts.length > 2 && (
                          <div className="text-xs text-gray-500">
                            +{posts.length - 2} more
                          </div>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Selected Day Details */}
        <Card>
          <CardHeader>
            <CardTitle>
              {selectedDate ? format(selectedDate, 'EEEE, MMMM d') : 'Select a Day'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedDate ? (
              <div className="space-y-3">
                {getPostsForDay(selectedDate).length === 0 ? (
                  <div className="text-center py-8">
                    <Clock className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                    <p className="text-gray-600">No posts scheduled</p>
                    <Button size="sm" className="mt-3">
                      <Plus className="mr-2 h-3 w-3" />
                      Schedule Post
                    </Button>
                  </div>
                ) : (
                  getPostsForDay(selectedDate).map(post => (
                    <div key={post.id} className="p-3 border rounded-lg space-y-2">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="font-medium text-sm">{post.title}</div>
                          <div className="text-xs text-gray-600">r/{post.subreddit}</div>
                        </div>
                        <Badge className={getStatusColor(post.status)} variant="secondary">
                          {post.status}
                        </Badge>
                      </div>
                      
                      {post.imageUrl && (
                        <img 
                          src={post.imageUrl} 
                          alt={post.title}
                          className="w-full h-32 object-cover rounded"
                        />
                      )}
                      
                      <div className="text-xs text-gray-600">
                        <Clock className="inline h-3 w-3 mr-1" />
                        {format(new Date(post.scheduledFor), 'h:mm a')}
                      </div>
                      
                      {post.status === 'pending' && (
                        <div className="flex gap-2 pt-2">
                          <Button size="sm" variant="outline" className="flex-1">
                            <Edit2 className="mr-1 h-3 w-3" />
                            Edit
                          </Button>
                          <Button 
                            size="sm" 
                            variant="destructive" 
                            className="flex-1"
                            onClick={() => cancelPost(post.id)}
                          >
                            <Trash2 className="mr-1 h-3 w-3" />
                            Cancel
                          </Button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                Select a day to view scheduled posts
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Stats Bar */}
      <Card className="mt-6">
        <CardContent className="py-4">
          <div className="flex items-center justify-around text-center">
            <div>
              <div className="text-2xl font-bold">
                {scheduledPosts.filter(p => p.status === 'pending').length}
              </div>
              <div className="text-sm text-gray-600">Pending</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-green-600">
                {scheduledPosts.filter(p => p.status === 'completed').length}
              </div>
              <div className="text-sm text-gray-600">Completed</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-red-600">
                {scheduledPosts.filter(p => p.status === 'failed').length}
              </div>
              <div className="text-sm text-gray-600">Failed</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-purple-600">
                {userLimit - scheduledPosts.filter(p => p.status === 'pending').length}
              </div>
              <div className="text-sm text-gray-600">Slots Available</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
