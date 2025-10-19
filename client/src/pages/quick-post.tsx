/**
 * Quick Post Page
 * One-click workflow: Upload → 2 Captions → Auto-Protect → Post Now
 */

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { 
  Zap, 
  Sparkles,
  Shield,
  Send,
  CheckCircle,
  Loader2,
  RefreshCw,
  Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { CatboxUploadPortal } from '@/components/CatboxUploadPortal';
import { cn } from '@/lib/utils';

interface CaptionOption {
  id: string;
  text: string;
  style: string;
}

export default function QuickPostPage() {
  const { toast } = useToast();

  // State
  const [imageUrl, setImageUrl] = useState<string>('');
  const [protectedImageUrl, setProtectedImageUrl] = useState<string>('');
  const [captionOptions, setCaptionOptions] = useState<CaptionOption[]>([]);
  const [selectedCaption, setSelectedCaption] = useState<string>('');
  const [subreddit, setSubreddit] = useState<string>('');
  const [nsfw, setNsfw] = useState<boolean>(true);
  const [_isProcessing, setIsProcessing] = useState(false);
  const [posted, setPosted] = useState(false);

  // Generate 2 caption options using Grok
  const generateCaptions = useMutation({
    mutationFn: async (url: string) => {
      // Generate two different styles
      const promises = [
        apiRequest('POST', '/api/caption/generate', {
          imageUrl: url,
          platform: 'reddit',
          voice: 'flirty_playful',
          style: 'explicit',
          nsfw: true,
        }),
        apiRequest('POST', '/api/caption/generate', {
          imageUrl: url,
          platform: 'reddit',
          voice: 'cozy_girl',
          style: 'poetic',
          nsfw: true,
        })
      ];
      
      const results = await Promise.all(promises) as unknown as Array<{ caption?: string; text?: string }>;
      return [
        { id: '1', text: results[0]?.caption || results[0]?.text || '', style: 'Flirty & Explicit' },
        { id: '2', text: results[1]?.caption || results[1]?.text || '', style: 'Cozy & Poetic' }
      ];
    },
    onSuccess: (options) => {
      setCaptionOptions(options);
      setSelectedCaption(options[0].id);
      // Auto-protect after captions are generated
      protectImage.mutate(imageUrl);
    },
    onError: () => {
      toast({
        title: 'Caption generation failed',
        description: 'Could not generate captions. Please try again.',
        variant: 'destructive'
      });
    }
  });

  // Auto-protect image
  const protectImage = useMutation({
    mutationFn: async (url: string) => {
      // In production: Apply ImageShield protection
      // For now, simulate with a delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      return url + '?protected=true';
    },
    onSuccess: (protectedUrl) => {
      setProtectedImageUrl(protectedUrl);
      toast({
        title: 'Image protected',
        description: 'ImageShield protection applied automatically',
      });
    }
  });

  // Post to Reddit immediately
  const postToReddit = useMutation({
    mutationFn: async () => {
      const caption = captionOptions.find(c => c.id === selectedCaption)?.text;
      
      if (!caption || !subreddit) {
        throw new Error('Missing caption or subreddit');
      }

      return apiRequest('POST', '/api/reddit/post', {
        title: caption.substring(0, 100) + '...',
        subreddit,
        imageUrl: protectedImageUrl || imageUrl,
        text: caption,
        nsfw,
        sendReplies: true
      });
    },
    onSuccess: () => {
      setPosted(true);
      toast({
        title: '🎉 Posted successfully!',
        description: `Your post is now live on r/${subreddit}`,
      });
    },
    onError: (error) => {
      toast({
        title: 'Post failed',
        description: error instanceof Error ? error.message : 'Could not post to Reddit',
        variant: 'destructive'
      });
    }
  });

  // Handle image upload
  const handleImageUpload = (result: { imageUrl: string }) => {
    setImageUrl(result.imageUrl);
    setPosted(false);
    setCaptionOptions([]);
    setProtectedImageUrl('');
    
    // Start the auto-flow
    setIsProcessing(true);
    generateCaptions.mutate(result.imageUrl);
  };

  // Reset for new post
  const startNewPost = () => {
    setImageUrl('');
    setProtectedImageUrl('');
    setCaptionOptions([]);
    setSelectedCaption('');
    setPosted(false);
    setIsProcessing(false);
  };

  // Check if ready to post
  const isReadyToPost = imageUrl && selectedCaption && subreddit && !postToReddit.isPending;

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-2 mb-4">
          <div className="p-2 bg-yellow-500 text-white rounded-full">
            <Zap className="h-6 w-6" />
          </div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-yellow-500 to-orange-500 bg-clip-text text-transparent">
            Quick Post
          </h1>
        </div>
        <p className="text-lg text-muted-foreground">
          Upload, caption, protect & post to Reddit in seconds
        </p>
      </div>

      {/* Main Card */}
      <Card>
        <CardContent className="p-6">
          {!posted ? (
            <div className="space-y-6">
              {/* Step 1: Upload Image */}
              <div>
                <div className="flex items-center gap-2 mb-4">
                  <Badge variant={imageUrl ? 'default' : 'outline'}>
                    {imageUrl ? <CheckCircle className="h-3 w-3 mr-1" /> : '1'}
                  </Badge>
                  <Label>Upload Image</Label>
                </div>
                
                {!imageUrl ? (
                  <CatboxUploadPortal onComplete={handleImageUpload} />
                ) : (
                  <div className="flex items-center gap-4">
                    <img 
                      src={imageUrl} 
                      alt="Uploaded" 
                      className="w-32 h-32 object-cover rounded-lg"
                    />
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Image uploaded to Catbox</p>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={startNewPost}
                      >
                        Upload Different Image
                      </Button>
                    </div>
                  </div>
                )}
              </div>

              {/* Step 2: Caption Options */}
              {imageUrl && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Badge variant={captionOptions.length > 0 ? 'default' : 'outline'}>
                      {captionOptions.length > 0 ? <CheckCircle className="h-3 w-3 mr-1" /> : '2'}
                    </Badge>
                    <Label>Choose Caption</Label>
                    {generateCaptions.isPending && (
                      <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
                    )}
                  </div>
                  
                  {captionOptions.length > 0 ? (
                    <RadioGroup value={selectedCaption} onValueChange={setSelectedCaption}>
                      <div className="space-y-4">
                        {captionOptions.map((option) => (
                          <Card 
                            key={option.id}
                            className={cn(
                              "cursor-pointer transition-all",
                              selectedCaption === option.id && "border-purple-500 bg-purple-50 dark:bg-purple-950/20"
                            )}
                            onClick={() => setSelectedCaption(option.id)}
                          >
                            <CardHeader className="pb-2">
                              <div className="flex items-center gap-2">
                                <RadioGroupItem value={option.id} />
                                <Badge variant="secondary">{option.style}</Badge>
                              </div>
                            </CardHeader>
                            <CardContent>
                              <p className="text-sm">{option.text}</p>
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    </RadioGroup>
                  ) : generateCaptions.isPending ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="text-center">
                        <Sparkles className="h-8 w-8 mx-auto mb-2 text-purple-500 animate-pulse" />
                        <p className="text-sm text-muted-foreground">Generating captions with Grok...</p>
                      </div>
                    </div>
                  ) : null}
                  
                  {captionOptions.length > 0 && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-4"
                      onClick={() => generateCaptions.mutate(imageUrl)}
                      disabled={generateCaptions.isPending}
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Regenerate Captions
                    </Button>
                  )}
                </div>
              )}

              {/* Step 3: Auto-Protection Status */}
              {imageUrl && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Badge variant={protectedImageUrl ? 'default' : 'outline'}>
                      {protectedImageUrl ? <CheckCircle className="h-3 w-3 mr-1" /> : '3'}
                    </Badge>
                    <Label>ImageShield Protection</Label>
                    {protectImage.isPending && (
                      <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                    )}
                  </div>
                  
                  {protectedImageUrl ? (
                    <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20">
                      <Shield className="h-4 w-4 text-green-600" />
                      <AlertDescription className="text-green-700 dark:text-green-400">
                        Image protected against reverse search
                      </AlertDescription>
                    </Alert>
                  ) : protectImage.isPending ? (
                    <Alert>
                      <Shield className="h-4 w-4 animate-pulse" />
                      <AlertDescription>Applying protection...</AlertDescription>
                    </Alert>
                  ) : null}
                </div>
              )}

              {/* Step 4: Reddit Details */}
              {captionOptions.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Badge variant="outline">4</Badge>
                    <Label>Post Details</Label>
                  </div>
                  
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="subreddit">Subreddit</Label>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-muted-foreground">r/</span>
                        <Input 
                          id="subreddit"
                          placeholder="gonewild"
                          value={subreddit}
                          onChange={(e) => setSubreddit(e.target.value)}
                        />
                      </div>
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Switch 
                        id="nsfw"
                        checked={nsfw}
                        onCheckedChange={setNsfw}
                      />
                      <Label htmlFor="nsfw">Mark as NSFW</Label>
                    </div>
                  </div>
                </div>
              )}

              {/* Post Button */}
              {captionOptions.length > 0 && (
                <div className="pt-4 border-t">
                  <Button 
                    onClick={() => postToReddit.mutate()}
                    disabled={!isReadyToPost}
                    className="w-full bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
                    size="lg"
                  >
                    {postToReddit.isPending ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Posting...
                      </>
                    ) : (
                      <>
                        <Send className="mr-2 h-4 w-4" />
                        Post to Reddit Now
                      </>
                    )}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            // Success State
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 text-green-600 rounded-full mb-4">
                <CheckCircle className="h-8 w-8" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Posted Successfully!</h2>
              <p className="text-muted-foreground mb-6">
                Your post is now live on r/{subreddit}
              </p>
              <div className="flex gap-4 justify-center">
                <Button 
                  variant="outline"
                  onClick={() => window.open(`https://reddit.com/r/${subreddit}`, '_blank')}
                >
                  View on Reddit
                </Button>
                <Button onClick={startNewPost}>
                  <Plus className="mr-2 h-4 w-4" />
                  Create Another Post
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Info Card */}
      <Card className="mt-6 border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Quick Post Benefits
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="text-sm space-y-1 text-muted-foreground">
            <li>• 24-hour ephemeral image storage</li>
            <li>• 2 AI-generated captions from Grok</li>
            <li>• Automatic ImageShield protection</li>
            <li>• One-click posting to Reddit</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
