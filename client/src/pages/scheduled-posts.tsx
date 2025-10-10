import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Calendar, 
  Clock, 
  Plus, 
  Edit2, 
  Trash2, 
  Loader2,
  CheckCircle,
  XCircle,
  AlertCircle,
  Image as ImageIcon
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import { format } from 'date-fns';
import { CreateScheduledPostModal } from '@/components/CreateScheduledPostModal';

interface ScheduledPost {
  id: number;
  title: string;
  subreddit: string;
  imageUrl?: string;
  caption?: string;
  scheduledFor: string; // ISO date string
  status: 'pending' | 'completed' | 'failed' | 'cancelled';
  nsfw?: boolean;
  createdAt: string;
}

export default function ScheduledPostsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<ScheduledPost | null>(null);

  // Fetch scheduled posts
  const { data: posts, isLoading } = useQuery<ScheduledPost[]>({
    queryKey: ['/api/scheduled-posts'],
    enabled: !!user,
    select: (data: any) => {
      // Handle both array response and object with posts array
      if (Array.isArray(data)) return data;
      if (data?.posts) return data.posts;
      if (data?.scheduledPosts) return data.scheduledPosts;
      return [];
    }
  });

  // Delete/Cancel mutation
  const deleteMutation = useMutation({
    mutationFn: async (postId: number) => {
      return apiRequest('DELETE', `/api/scheduled-posts/${postId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/scheduled-posts'] });
      toast({
        title: 'Post cancelled',
        description: 'The scheduled post has been cancelled.',
      });
    },
    onError: () => {
      toast({
        title: 'Cancel failed',
        description: 'Could not cancel the scheduled post.',
        variant: 'destructive',
      });
    },
  });

  const handleEditPost = (post: ScheduledPost) => {
    setEditingPost(post);
    setIsCreateModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsCreateModalOpen(false);
    setEditingPost(null);
    queryClient.invalidateQueries({ queryKey: ['/api/scheduled-posts'] });
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4 text-gray-500" />;
      default:
        return <Clock className="h-4 w-4 text-blue-500" />;
    }
  };

  const getStatusBadgeVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'failed':
        return 'destructive';
      case 'cancelled':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  // Group posts by status
  const pendingPosts = posts?.filter(p => p.status === 'pending') || [];
  const completedPosts = posts?.filter(p => p.status === 'completed') || [];
  const failedPosts = posts?.filter(p => p.status === 'failed') || [];

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Scheduled Posts
          </h1>
          <p className="text-lg text-muted-foreground mt-2">
            Plan and automate your Reddit posts
          </p>
        </div>
        
        <Button
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
        >
          <Plus className="h-4 w-4 mr-2" />
          Schedule Post
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Scheduled</CardDescription>
            <CardTitle className="text-2xl">{posts?.length || 0}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Pending</CardDescription>
            <CardTitle className="text-2xl text-blue-600">{pendingPosts.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Completed</CardDescription>
            <CardTitle className="text-2xl text-green-600">{completedPosts.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Failed</CardDescription>
            <CardTitle className="text-2xl text-red-600">{failedPosts.length}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Empty State */}
      {(!posts || posts.length === 0) && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calendar className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No scheduled posts</h3>
            <p className="text-muted-foreground text-center mb-4">
              Schedule your first post to automate your Reddit presence
            </p>
            <Button 
              onClick={() => setIsCreateModalOpen(true)}
              variant="outline"
            >
              <Plus className="h-4 w-4 mr-2" />
              Schedule Your First Post
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Pending Posts Section */}
      {pendingPosts.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Upcoming Posts
          </h2>
          <div className="grid gap-4">
            {pendingPosts.map((post) => (
              <Card key={post.id} className="hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-start gap-4">
                        {post.imageUrl && (
                          <div className="w-20 h-20 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                            <img 
                              src={post.imageUrl} 
                              alt={post.title}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none';
                              }}
                            />
                          </div>
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="font-semibold">{post.title}</h3>
                            {post.nsfw && (
                              <Badge variant="destructive" className="text-xs">NSFW</Badge>
                            )}
                          </div>
                          
                          <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                            <span>r/{post.subreddit}</span>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {format(new Date(post.scheduledFor), 'MMM d, yyyy h:mm a')}
                            </span>
                          </div>
                          
                          {post.caption && (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                              {post.caption}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditPost(post)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteMutation.mutate(post.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Completed Posts Section */}
      {completedPosts.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            Posted Successfully
          </h2>
          <div className="grid gap-4">
            {completedPosts.slice(0, 5).map((post) => (
              <Card key={post.id} className="opacity-75">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(post.status)}
                      <div>
                        <p className="font-medium">{post.title}</p>
                        <p className="text-sm text-muted-foreground">
                          r/{post.subreddit} • {format(new Date(post.scheduledFor), 'MMM d, h:mm a')}
                        </p>
                      </div>
                    </div>
                    <Badge variant={getStatusBadgeVariant(post.status)}>
                      {post.status}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Failed Posts Alert */}
      {failedPosts.length > 0 && (
        <Alert variant="destructive" className="mb-8">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {failedPosts.length} post{failedPosts.length > 1 ? 's' : ''} failed to publish. 
            Check your Reddit connection and try again.
          </AlertDescription>
        </Alert>
      )}

      {/* Schedule Modal */}
      {isCreateModalOpen && (
        <CreateScheduledPostModal
          isOpen={isCreateModalOpen}
          onClose={handleCloseModal}
          editingPost={editingPost}
        />
      )}
    </div>
  );
}
