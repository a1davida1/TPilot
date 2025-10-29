import { useState, useEffect } from 'react';
import { Save, X, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { authenticatedRequest } from '@/lib/authenticated-request';
import { useToast } from '@/hooks/use-toast';

const MAX_CAPTION_LENGTH = 40000; // Reddit's limit
const TITLE_MAX_LENGTH = 300; // Reddit's title limit
const WARNING_THRESHOLD = 35000; // Warn when approaching limit

interface CaptionEditorProps {
  imageId: string;
  imageUrl: string;
  initialCaption?: string;
  subreddit?: string;
  onSave: (imageId: string, caption: string) => void;
  onCancel: () => void;
  className?: string;
}

interface SubredditRule {
  type: 'warning' | 'error';
  message: string;
}

export function CaptionEditor({
  imageId,
  imageUrl,
  initialCaption = '',
  subreddit,
  onSave,
  onCancel,
  className,
}: CaptionEditorProps) {
  const [caption, setCaption] = useState(initialCaption);
  const [rules, setRules] = useState<SubredditRule[]>([]);
  const { toast } = useToast();

  const characterCount = caption.length;
  const isNearLimit = characterCount > WARNING_THRESHOLD;
  const isOverLimit = characterCount > MAX_CAPTION_LENGTH;

  // Regenerate caption mutation
  const regenerateCaption = useMutation({
    mutationFn: async () => {
      const response = await authenticatedRequest<{ caption: string }>(
        'POST',
        '/api/caption/generate',
        {
          imageUrl,
          platform: 'reddit',
          voice: 'flirty_playful',
          style: 'explicit',
          nsfw: true,
        }
      );
      return response.caption;
    },
    onSuccess: (newCaption) => {
      setCaption(newCaption);
      toast({
        title: 'Caption regenerated',
        description: 'A new caption has been generated for this image',
      });
    },
    onError: (error) => {
      toast({
        title: 'Regeneration failed',
        description: error instanceof Error ? error.message : 'Failed to generate new caption',
        variant: 'destructive',
      });
    },
  });

  // Validate caption against subreddit rules
  useEffect(() => {
    if (!subreddit || !caption) {
      setRules([]);
      return;
    }

    const validateRules = async () => {
      try {
        const response = await authenticatedRequest<{
          warnings?: string[];
          blockers?: string[];
        }>('POST', '/api/subreddit-lint', {
          subreddit,
          title: caption.substring(0, TITLE_MAX_LENGTH),
          caption,
          nsfw: true,
        });

        const newRules: SubredditRule[] = [];

        if (response.warnings) {
          response.warnings.forEach((warning) => {
            newRules.push({ type: 'warning', message: warning });
          });
        }

        if (response.blockers) {
          response.blockers.forEach((blocker) => {
            newRules.push({ type: 'error', message: blocker });
          });
        }

        setRules(newRules);
      } catch (error) {
        console.error('Failed to validate subreddit rules:', error);
      }
    };

    // Debounce validation
    const timeoutId = setTimeout(validateRules, 500);
    return () => clearTimeout(timeoutId);
  }, [caption, subreddit]);

  const handleSave = () => {
    if (isOverLimit) {
      toast({
        title: 'Caption too long',
        description: `Caption must be under ${MAX_CAPTION_LENGTH} characters`,
        variant: 'destructive',
      });
      return;
    }

    if (rules.some((rule) => rule.type === 'error')) {
      toast({
        title: 'Caption has errors',
        description: 'Please fix the errors before saving',
        variant: 'destructive',
      });
      return;
    }

    onSave(imageId, caption);
  };

  const hasErrors = rules.some((rule) => rule.type === 'error');
  const hasWarnings = rules.some((rule) => rule.type === 'warning');

  return (
    <div className={cn('space-y-3', className)}>
      {/* Caption Textarea */}
      <div className="relative">
        <Textarea
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="Enter your caption here..."
          className={cn(
            'min-h-[120px] resize-none',
            isOverLimit && 'border-red-500 focus-visible:ring-red-500',
            isNearLimit && !isOverLimit && 'border-yellow-500 focus-visible:ring-yellow-500'
          )}
          maxLength={MAX_CAPTION_LENGTH}
        />

        {/* Character Count */}
        <div className="absolute bottom-2 right-2 flex items-center gap-2">
          <Badge
            variant={isOverLimit ? 'destructive' : isNearLimit ? 'secondary' : 'outline'}
            className="text-xs"
          >
            {characterCount.toLocaleString()} / {MAX_CAPTION_LENGTH.toLocaleString()}
          </Badge>
        </div>
      </div>

      {/* Subreddit Rules Validation */}
      {rules.length > 0 && (
        <div className="space-y-2">
          {rules.map((rule, index) => (
            <Alert
              key={index}
              variant={rule.type === 'error' ? 'destructive' : 'default'}
              className={cn(
                rule.type === 'warning' && 'border-yellow-500 bg-yellow-50 text-yellow-900 dark:bg-yellow-950/30 dark:text-yellow-100'
              )}
            >
              {rule.type === 'error' ? (
                <AlertTriangle className="h-4 w-4" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-yellow-600" />
              )}
              <AlertDescription className="text-sm">
                {rule.message}
              </AlertDescription>
            </Alert>
          ))}
        </div>
      )}

      {/* Subreddit Info */}
      {subreddit && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Validating for</span>
          <Badge variant="outline">r/{subreddit}</Badge>
          {!hasErrors && !hasWarnings && caption.length > 0 && (
            <>
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-green-600">Compatible</span>
            </>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex items-center justify-between gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => regenerateCaption.mutate()}
          disabled={regenerateCaption.isPending}
        >
          {regenerateCaption.isPending ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Regenerating...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Regenerate
            </>
          )}
        </Button>

        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onCancel}
          >
            <X className="mr-2 h-4 w-4" />
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={isOverLimit || hasErrors || !caption.trim()}
          >
            <Save className="mr-2 h-4 w-4" />
            Save Caption
          </Button>
        </div>
      </div>

      {/* Help Text */}
      <p className="text-xs text-muted-foreground">
        Tip: Keep captions engaging and relevant to your image. Avoid spam or excessive emojis.
      </p>
    </div>
  );
}

// Modal wrapper for caption editor
interface CaptionEditorModalProps extends CaptionEditorProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CaptionEditorModal({
  isOpen,
  onClose,
  onSave,
  ...editorProps
}: CaptionEditorModalProps) {
  if (!isOpen) return null;

  const handleSave = (imageId: string, caption: string) => {
    onSave(imageId, caption);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-2xl rounded-lg border bg-background p-6 shadow-lg">
        <h2 className="mb-4 text-lg font-semibold">Edit Caption</h2>
        <CaptionEditor
          {...editorProps}
          onSave={handleSave}
          onCancel={onClose}
        />
      </div>
    </div>
  );
}
