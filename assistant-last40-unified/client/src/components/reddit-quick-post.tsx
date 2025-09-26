import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { 
  Send, 
  Globe,
  Link as LinkIcon,
  Zap,
  CheckCircle,
  AlertCircle,
  Sparkles
} from 'lucide-react';
import { MediaLibrarySelector } from './MediaLibrarySelector';

interface QuickPostTemplate {
  subreddit: string;
  titlePrefix: string;
  titleSuffix?: string;
  contentTemplate?: string;
  isNsfw: boolean;
}

interface MediaAsset {
  id: number;
  filename: string;
  signedUrl?: string;
  downloadUrl?: string;
  createdAt: string;
}

interface QuickPostPayload {
  subreddit: string;
  title: string;
  nsfw: boolean;
  body?: string;
  postType?: 'text' | 'link' | 'image' | 'gallery';
  url?: string;
  images?: Array<{ url: string; caption?: string }>;
}

const QUICK_TEMPLATES: QuickPostTemplate[] = [
  {
    subreddit: 'gonewild',
    titlePrefix: 'Feeling cute today',
    titleSuffix: '[F]',
    contentTemplate: 'Hope you enjoy! More content on my profile 💕',
    isNsfw: true
  },
  {
    subreddit: 'onlyfans101',
    titlePrefix: 'New content just dropped!',
    titleSuffix: '🔥',
    contentTemplate: 'Check out my latest photos and videos! Link in bio 💋',
    isNsfw: true
  },
  {
    subreddit: 'selfie',
    titlePrefix: 'Good vibes only',
    titleSuffix: '✨',
    contentTemplate: 'Having a great day! How is everyone doing?',
    isNsfw: false
  }
];

export function RedditQuickPost() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [selectedTemplate, setSelectedTemplate] = useState<string>('');
  const [customTitle, setCustomTitle] = useState('');
  const [customContent, setCustomContent] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [selectedMediaIds, setSelectedMediaIds] = useState<number[]>([]);
  const [mediaCaptions, setMediaCaptions] = useState<Record<number, string>>({});

  // Fetch Reddit accounts
  const { data: accounts = [], isLoading: accountsLoading } = useQuery({
    queryKey: ['/api/reddit/accounts'],
    retry: false,
  });

  const { data: mediaAssets = [], isLoading: mediaLoading } = useQuery<MediaAsset[]>({
    queryKey: ['/api/media'],
    retry: false,
  });

  const selectedAssets = mediaAssets.filter((asset) => selectedMediaIds.includes(asset.id));

  const toggleMediaSelection = (assetId: number) => {
    setSelectedMediaIds((prev) => {
      if (prev.includes(assetId)) {
        return prev.filter((id) => id !== assetId);
      }
      return [...prev, assetId];
    });
  };

  const handleCaptionChange = (assetId: number, caption: string) => {
    setMediaCaptions((prev) => ({ ...prev, [assetId]: caption }));
  };

  // Connect Reddit account
  const connectReddit = async () => {
    setIsConnecting(true);
    try {
      const response = await apiRequest('GET', '/api/reddit/connect');
      const data = await response.json();
      
      if (data.authUrl) {
        window.open(data.authUrl, '_blank');
        toast({
          title: "🔗 Reddit Authorization",
          description: "Complete the authorization in the popup window, then refresh this page"
        });
      }
    } catch (error) {
      toast({
        title: "❌ Connection Failed",
        description: (error as Error).message,
        variant: "destructive"
      });
    } finally {
      setIsConnecting(false);
    }
  };

  // Submit post
  const { mutate: submitPost, isPending: submitting } = useMutation({
    mutationFn: async (data: QuickPostPayload) => {
      const response = await apiRequest('POST', '/api/reddit/submit', data);
      return response.json();
    },
    onSuccess: (data: unknown) => {
      const responseData = data as { success?: boolean; error?: string };
      if (responseData.success) {
        toast({
          title: "🎉 Posted Successfully!",
          description: `Your post is now live on Reddit`,
          variant: "default"
        });
        // Reset form
        setCustomTitle('');
        setCustomContent('');
        setSelectedTemplate('');
        setSelectedMediaIds([]);
        setMediaCaptions({});
        queryClient.invalidateQueries({ queryKey: ['/api/reddit/posts'] });
      } else {
        toast({
          title: "❌ Posting Failed",
          description: responseData.error || "Unable to post to Reddit",
          variant: "destructive"
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Error",
        description: (error as Error).message,
        variant: "destructive"
      });
    }
  });

  const handleQuickPost = () => {
    if (!selectedTemplate) {
      toast({
        title: "⚠️ Select a Template",
        description: "Please choose a posting template first",
        variant: "destructive"
      });
      return;
    }

    const template = QUICK_TEMPLATES.find(t => `${t.subreddit}-${t.titlePrefix}` === selectedTemplate);
    if (!template) return;

    const title = customTitle || `${template.titlePrefix} ${template.titleSuffix || ''}`.trim();
    const body = customContent || template.contentTemplate || '';

    const assetsWithUrls = selectedAssets
      .map((asset) => {
        const url = asset.downloadUrl ?? asset.signedUrl;
        if (!url) {
          return null;
        }
        return {
          asset,
          url,
          caption: mediaCaptions[asset.id]?.trim() || asset.filename
        };
      })
      .filter((value): value is { asset: MediaAsset; url: string; caption: string } => value !== null);

    if (selectedAssets.length > 0 && assetsWithUrls.length !== selectedAssets.length) {
      toast({
        title: "⚠️ Media unavailable",
        description: "One or more selected media files could not be resolved. Please refresh your media library and try again.",
        variant: "destructive"
      });
      return;
    }

    const payload: QuickPostPayload = {
      subreddit: template.subreddit,
      title,
      nsfw: template.isNsfw
    };

    if (assetsWithUrls.length > 1) {
      payload.postType = 'gallery';
      payload.images = assetsWithUrls.map(({ url, caption }) => ({ url, caption }));
    } else if (assetsWithUrls.length === 1) {
      payload.postType = 'image';
      payload.url = assetsWithUrls[0].url;
    } else {
      payload.body = body;
    }

    submitPost(payload);
  };

  const hasRedditAccount = accounts && Array.isArray(accounts) && accounts.length > 0;

  return (
    <Card className="bg-gradient-to-br from-orange-50 to-red-50 border-orange-200">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-gradient-to-br from-orange-500 to-red-500 rounded-lg">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg">One-Click Reddit Posting</CardTitle>
              <CardDescription>Quick post to your favorite subreddits</CardDescription>
            </div>
          </div>
          <Badge variant="secondary" className="bg-orange-100 text-orange-700">
            <Sparkles className="h-3 w-3 mr-1" />
            Quick Post
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {accountsLoading ? (
          <div className="flex items-center justify-center p-6">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-orange-500 border-t-transparent" />
          </div>
        ) : hasRedditAccount ? (
          <>
            {/* Account Status */}
            <div className="flex items-center gap-2 p-2 bg-green-50 rounded-lg border border-green-200">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <span className="text-sm text-green-700 font-medium">
                Connected as u/{accounts[0].username}
              </span>
            </div>

            {/* Template Selection */}
            <div className="space-y-2">
              <Label>Quick Template</Label>
              <Select value={selectedTemplate} onValueChange={setSelectedTemplate}>
                <SelectTrigger data-testid="select-reddit-template">
                </SelectTrigger>
                <SelectContent>
                  {QUICK_TEMPLATES.map((template) => (
                    <SelectItem 
                      key={`${template.subreddit}-${template.titlePrefix}`}
                      value={`${template.subreddit}-${template.titlePrefix}`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-medium">r/{template.subreddit}</span>
                        <span className="text-gray-500">•</span>
                        <span className="text-sm">{template.titlePrefix}</span>
                        {template.isNsfw && (
                          <Badge variant="destructive" className="text-xs ml-1">NSFW</Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Custom Title (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="quick-title">Custom Title (optional)</Label>
              <Input
                id="quick-title"
                value={customTitle}
                onChange={(e) => setCustomTitle(e.target.value)}
                data-testid="input-quick-title"
              />
            </div>

            {/* Custom Content (Optional) */}
            <div className="space-y-2">
              <Label htmlFor="quick-content">Custom Content (optional)</Label>
              <Textarea
                id="quick-content"
                value={customContent}
                onChange={(e) => setCustomContent(e.target.value)}
                rows={3}
                data-testid="textarea-quick-content"
              />
            </div>

            {/* Media Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>Attach Media (optional)</Label>
                {selectedAssets.length > 0 && (
                  <Badge variant="outline" className="text-xs">
                    {selectedAssets.length === 1 ? 'Posting as image' : 'Posting as gallery'}
                  </Badge>
                )}
              </div>
              <MediaLibrarySelector
                assets={mediaAssets}
                selectedIds={selectedMediaIds}
                onToggle={toggleMediaSelection}
                captions={mediaCaptions}
                onCaptionChange={handleCaptionChange}
                maxSelection={20}
                isLoading={mediaLoading}
                showCaptions={true}
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2">
              <Button
                onClick={handleQuickPost}
                disabled={submitting || !selectedTemplate}
                className="flex-1 bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600"
                data-testid="button-quick-post"
              >
                {submitting ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Post Now
              </Button>
              <Button
                variant="outline"
                onClick={() => window.location.href = '/reddit'}
                className="border-orange-300 text-orange-700 hover:bg-orange-50"
                data-testid="button-advanced-posting"
              >
                <Globe className="h-4 w-4 mr-2" />
                Advanced
              </Button>
            </div>
          </>
        ) : (
          <div className="text-center p-6 bg-orange-50 rounded-lg border border-orange-200">
            <Globe className="h-10 w-10 text-orange-500 mx-auto mb-3" />
            <h3 className="font-medium text-orange-800 mb-2">Connect Reddit Account</h3>
            <p className="text-sm text-orange-600 mb-4">
              Connect your Reddit account to enable one-click posting
            </p>
            <Button 
              onClick={connectReddit}
              disabled={isConnecting}
              className="bg-orange-500 hover:bg-orange-600 text-white"
              data-testid="button-connect-reddit"
            >
              {isConnecting ? (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
              ) : (
                <LinkIcon className="h-4 w-4 mr-2" />
              )}
              Connect Reddit Account
            </Button>
            <p className="text-xs text-gray-500 mt-3">
              You&apos;ll be redirected to Reddit to authorize ThottoPilot
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}