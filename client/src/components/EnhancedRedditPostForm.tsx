/**
 * Enhanced Reddit Post Form
 * Mirrors Quick Post workflow with scheduling support
 */

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Send, 
  Calendar,
  Sparkles,
  Shield,
  Loader2,
  RefreshCw,
  Link,
  FileText,
  Image as ImageIcon,
  Clock
} from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { CatboxUploadPortal } from './CatboxUploadPortal';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

interface CaptionOption {
  id: string;
  text: string;
  style: string;
}

interface PostFormProps {
  mode: 'immediate' | 'scheduled';
  onSuccess?: () => void;
  defaultValues?: {
    subreddit?: string;
    title?: string;
    imageUrl?: string;
    body?: string;
    nsfw?: boolean;
    scheduledFor?: string;
  };
}

export function EnhancedRedditPostForm({ mode = 'immediate', onSuccess, defaultValues }: PostFormProps) {
  const { toast } = useToast();

  // Form state
  const [postType, setPostType] = useState<'image' | 'text' | 'link'>('image');
  const [subreddit, setSubreddit] = useState(defaultValues?.subreddit || '');
  const [title, setTitle] = useState(defaultValues?.title || '');
  const [body, setBody] = useState(defaultValues?.body || '');
  const [imageUrl, setImageUrl] = useState(defaultValues?.imageUrl || '');
  const [linkUrl, setLinkUrl] = useState('');
  const [nsfw, setNsfw] = useState(defaultValues?.nsfw ?? true);
  const [spoiler, setSpoiler] = useState(false);
  const [scheduledTime, setScheduledTime] = useState(
    defaultValues?.scheduledFor || format(new Date(Date.now() + 86400000), "yyyy-MM-dd'T'HH:mm")
  );

  // AI caption state
  const [captionOptions, setCaptionOptions] = useState<CaptionOption[]>([]);
  const [selectedCaption, setSelectedCaption] = useState<string>('');
  const [useAiCaption, setUseAiCaption] = useState(true);

  // Generate AI captions for images
  const generateCaptions = useMutation({
    mutationFn: async (imageUrl: string) => {
      const response = await apiRequest('POST', '/api/generate/caption', {
        imageUrl,
        platform: 'reddit',
        style: 'mixed',
        count: 2
      });
      return response as unknown as CaptionOption[];
    },
    onSuccess: (data) => {
      setCaptionOptions(data);
      if (data.length > 0) {
        setSelectedCaption(data[0].id);
        setTitle(data[0].text);
      }
    },
    onError: (_error) => {
      toast({
        title: 'Caption generation failed',
        description: 'Using manual title input',
        variant: 'destructive'
      });
      setUseAiCaption(false);
    }
  });

  // Protect image with ImageShield
  const protectImage = useMutation({
    mutationFn: async (imageUrl: string) => {
      const response = await apiRequest('POST', '/api/protect-image', {
        imageUrl,
        level: 'standard'
      });
      return response as unknown as { protectedUrl: string };
    },
    onSuccess: (data) => {
      setImageUrl(data.protectedUrl);
      toast({
        title: 'Image protected',
        description: 'Your image has been protected with ImageShield',
      });
    }
  });

  // Submit post (immediate or scheduled)
  const submitPost = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      if (mode === 'scheduled') {
        return apiRequest('POST', '/api/scheduled-posts', {
          ...data,
          scheduledFor: scheduledTime
        });
      } else {
        return apiRequest('POST', '/api/reddit/submit', data);
      }
    },
    onSuccess: () => {
      toast({
        title: mode === 'scheduled' ? 'Post scheduled!' : 'Posted to Reddit!',
        description: mode === 'scheduled' 
          ? `Will be posted at ${format(new Date(scheduledTime), 'PPp')}`
          : `Successfully posted to r/${subreddit}`,
      });
      onSuccess?.();
    },
    onError: (error: Error) => {
      toast({
        title: 'Post failed',
        description: error.message || 'Please try again',
        variant: 'destructive'
      });
    }
  });

  // Handle image upload
  const handleImageUpload = (result: { imageUrl: string }) => {
    setImageUrl(result.imageUrl);
    
    // Auto-generate captions if enabled
    if (useAiCaption) {
      generateCaptions.mutate(result.imageUrl);
    }
  };

  // Handle form submission
  const handleSubmit = () => {
    if (!subreddit || !title) {
      toast({
        title: 'Missing required fields',
        description: 'Please enter subreddit and title',
        variant: 'destructive'
      });
      return;
    }

    const postData: Record<string, unknown> = {
      subreddit,
      title: selectedCaption && useAiCaption && captionOptions.length > 0
        ? captionOptions.find(c => c.id === selectedCaption)?.text || title
        : title,
      nsfw,
      spoiler
    };

    if (postType === 'image') {
      postData.imageUrl = imageUrl;
      postData.caption = body;
    } else if (postType === 'link') {
      postData.url = linkUrl;
    } else {
      postData.body = body;
    }

    submitPost.mutate(postData);
  };

  const isProcessing = generateCaptions.isPending || protectImage.isPending || submitPost.isPending;
  const canSubmit = subreddit && title && !isProcessing && 
    ((postType === 'image' && imageUrl) || 
     (postType === 'link' && linkUrl) || 
     postType === 'text');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {mode === 'scheduled' ? (
            <>
              <Calendar className="h-5 w-5" />
              Schedule Reddit Post
            </>
          ) : (
            <>
              <Send className="h-5 w-5" />
              Post to Reddit Now
            </>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Post Type Selector */}
        <Tabs value={postType} onValueChange={(v) => setPostType(v as 'image' | 'text' | 'link')}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="image" className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              Image
            </TabsTrigger>
            <TabsTrigger value="text" className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Text
            </TabsTrigger>
            <TabsTrigger value="link" className="flex items-center gap-2">
              <Link className="h-4 w-4" />
              Link
            </TabsTrigger>
          </TabsList>

          <TabsContent value="image" className="space-y-4">
            {/* Image Upload */}
            {!imageUrl ? (
              <CatboxUploadPortal onComplete={(result) => handleImageUpload({ imageUrl: result.imageUrl })} />
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <img 
                    src={imageUrl} 
                    alt="Upload preview" 
                    className="w-32 h-32 object-cover rounded-lg"
                  />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Image uploaded</p>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => {
                        setImageUrl('');
                        setCaptionOptions([]);
                        setSelectedCaption('');
                      }}
                      className="mt-2"
                    >
                      Change Image
                    </Button>
                  </div>
                </div>

                {/* AI Caption Selection */}
                {useAiCaption && captionOptions.length > 0 && (
                  <div>
                    <Label className="flex items-center gap-2 mb-2">
                      <Sparkles className="h-4 w-4 text-purple-500" />
                      AI-Generated Titles
                    </Label>
                    <RadioGroup value={selectedCaption} onValueChange={setSelectedCaption}>
                      {captionOptions.map((option) => (
                        <Card 
                          key={option.id}
                          className={cn(
                            "p-3 cursor-pointer transition-all",
                            selectedCaption === option.id && "border-purple-500 bg-purple-50 dark:bg-purple-950/20"
                          )}
                          onClick={() => setSelectedCaption(option.id)}
                        >
                          <div className="flex items-start gap-3">
                            <RadioGroupItem value={option.id} />
                            <div className="flex-1">
                              <p className="text-sm">{option.text}</p>
                              <Badge variant="outline" className="mt-1">
                                {option.style}
                              </Badge>
                            </div>
                          </div>
                        </Card>
                      ))}
                    </RadioGroup>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => generateCaptions.mutate(imageUrl)}
                      disabled={generateCaptions.isPending}
                      className="mt-2"
                    >
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Regenerate Titles
                    </Button>
                  </div>
                )}

                {/* ImageShield Protection */}
                <Alert>
                  <Shield className="h-4 w-4" />
                  <AlertDescription>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => protectImage.mutate(imageUrl)}
                      disabled={protectImage.isPending}
                    >
                      {protectImage.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Shield className="h-4 w-4 mr-2" />
                      )}
                      Protect with ImageShield
                    </Button>
                  </AlertDescription>
                </Alert>
              </div>
            )}
          </TabsContent>

          <TabsContent value="text" className="space-y-4">
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Enter your post content..."
              rows={6}
            />
          </TabsContent>

          <TabsContent value="link" className="space-y-4">
            <Input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://example.com"
              type="url"
            />
          </TabsContent>
        </Tabs>

        {/* Common Fields */}
        <div className="space-y-4">
          {/* Subreddit */}
          <div>
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

          {/* Title */}
          {(!useAiCaption || captionOptions.length === 0 || postType !== 'image') && (
            <div>
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter post title"
                maxLength={300}
              />
            </div>
          )}

          {/* Additional Body Text (for image posts) */}
          {postType === 'image' && (
            <div>
              <Label htmlFor="body">Caption (optional)</Label>
              <Textarea
                id="body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Additional text for your post"
                rows={3}
              />
            </div>
          )}

          {/* Post Settings */}
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Switch
                id="nsfw"
                checked={nsfw}
                onCheckedChange={setNsfw}
              />
              <Label htmlFor="nsfw">NSFW</Label>
            </div>
            
            <div className="flex items-center gap-2">
              <Switch
                id="spoiler"
                checked={spoiler}
                onCheckedChange={setSpoiler}
              />
              <Label htmlFor="spoiler">Spoiler</Label>
            </div>
          </div>

          {/* Scheduling (only for scheduled mode) */}
          {mode === 'scheduled' && (
            <div>
              <Label htmlFor="schedule">Schedule Time</Label>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <Input
                  id="schedule"
                  type="datetime-local"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  min={format(new Date(), "yyyy-MM-dd'T'HH:mm")}
                />
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {scheduledTime && `Will post at ${format(new Date(scheduledTime), 'PPp')}`}
              </p>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full"
          size="lg"
        >
          {isProcessing ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : mode === 'scheduled' ? (
            <Calendar className="h-4 w-4 mr-2" />
          ) : (
            <Send className="h-4 w-4 mr-2" />
          )}
          {isProcessing 
            ? 'Processing...' 
            : mode === 'scheduled' 
              ? 'Schedule Post' 
              : 'Post Now'}
        </Button>

        {/* Status Messages */}
        {generateCaptions.isPending && (
          <Alert>
            <Sparkles className="h-4 w-4" />
            <AlertDescription>Generating AI captions...</AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
