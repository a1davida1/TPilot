import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useQueryClient } from '@tanstack/react-query';
import { EnhancedRedditPostForm } from './EnhancedRedditPostForm';

interface ScheduledPost {
  id?: number;
  title?: string;
  imageUrl?: string;
  caption?: string;
  body?: string;
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
  const queryClient = useQueryClient();
  
  const handleSuccess = () => {
    queryClient.invalidateQueries({ queryKey: ['/api/scheduled-posts'] });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <EnhancedRedditPostForm 
          mode="scheduled"
          onSuccess={handleSuccess}
          defaultValues={editingPost ? {
            subreddit: editingPost.subreddit,
            title: editingPost.title,
            imageUrl: editingPost.imageUrl,
            body: editingPost.body || editingPost.caption,
            nsfw: editingPost.nsfw,
            scheduledFor: editingPost.scheduledFor
          } : undefined}
        />
      </DialogContent>
    </Dialog>
  );
}
