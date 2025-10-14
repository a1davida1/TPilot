import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar, Loader2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { ImageUploadField } from './ImageUploadField';

interface ScheduledPost {
  id?: number;
  title?: string;
  imageUrl?: string;
  caption?: string;
  subreddit?: string;
  scheduledFor?: string;
  nsfw?: boolean;
}

interface CreateScheduledPostModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingPost?: ScheduledPost;
}

export function CreateScheduledPostModal({ isOpen, onClose, editingPost }: CreateScheduledPostModalProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [title, setTitle] = useState(editingPost?.title || '');
  const [imageUrl, setImageUrl] = useState(editingPost?.imageUrl || '');
  const [caption, setCaption] = useState(editingPost?.caption || '');
  const [subreddit, setSubreddit] = useState(editingPost?.subreddit || '');
  const [scheduledTime, setScheduledTime] = useState(
    editingPost?.scheduledFor ? format(new Date(editingPost.scheduledFor), "yyyy-MM-dd'T'HH:mm") : ''
  );
  const [nsfw, setNsfw] = useState(editingPost?.nsfw || false);

  const createMutation = useMutation({
    mutationFn: async (data: ScheduledPost) => {
      if (editingPost) {
        return apiRequest('PUT', `/api/scheduled-posts/${editingPost.id}`, data);
      }
      return apiRequest('POST', '/api/scheduled-posts', data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/scheduled-posts'] });
      toast({
        title: editingPost ? 'Post updated' : 'Post scheduled',
        description: `Your post will be published at ${format(new Date(scheduledTime), 'PPp')}`,
      });
      onClose();
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to schedule post',
        description: error.message || 'Please try again',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = () => {
    if (!title || !subreddit || !scheduledTime) {
      toast({
        title: 'Missing required fields',
        description: 'Please fill in all required fields',
        variant: 'destructive',
      });
      return;
    }

    createMutation.mutate({
      title,
      imageUrl,
      caption,
      subreddit: subreddit.replace('r/', '').replace('/', ''),
      scheduledFor: new Date(scheduledTime).toISOString(),
      nsfw,
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[550px]">
        <DialogHeader>
          <DialogTitle>{editingPost ? 'Edit' : 'Schedule New'} Post</DialogTitle>
          <DialogDescription>
            Schedule your Reddit post for automatic publishing
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter post title"
              maxLength={300}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="subreddit">Subreddit *</Label>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">r/</span>
              <Input
                id="subreddit"
                value={subreddit}
                onChange={(e) => setSubreddit(e.target.value)}
                placeholder="gonewild"
              />
            </div>
          </div>
          
          <ImageUploadField
            value={imageUrl}
            onChange={setImageUrl}
            label="Image (optional)"
            placeholder="https://i.imgur.com/..."
            showPreview={true}
            preferredService="catbox"
          />
          
          <div className="space-y-2">
            <Label htmlFor="caption">Caption (optional)</Label>
            <Textarea
              id="caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Additional text for your post"
              rows={3}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="schedule">Schedule Time *</Label>
            <Input
              id="schedule"
              type="datetime-local"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              min={new Date().toISOString().slice(0, 16)}
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <Switch
              id="nsfw"
              checked={nsfw}
              onCheckedChange={setNsfw}
            />
            <Label htmlFor="nsfw">Mark as NSFW</Label>
          </div>
          
          {createMutation.isError && (
            <Alert variant="destructive">
              <AlertDescription>
                Failed to schedule post. Please try again.
              </AlertDescription>
            </Alert>
          )}
        </div>
        
        <div className="flex justify-end gap-3">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSubmit}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Scheduling...
              </>
            ) : (
              <>
                <Calendar className="mr-2 h-4 w-4" />
                {editingPost ? 'Update' : 'Schedule'} Post
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
