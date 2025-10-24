import { useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  UploadCloud,
  Link2,
  Image,
  ExternalLink,
  Trash2,
  Shield,
  AlertTriangle,
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { trackUpload } from '@/lib/upload-monitoring';

interface UploadResult {
  imageUrl: string;
  assetId: number;
  provider?: string;
  dimensions?: { width?: number; height?: number };
  warnings?: string[];
}

interface Props {
  onComplete: (result: UploadResult) => void;
  showPreview?: boolean;
  acceptedFormats?: string[];
  nsfw?: boolean;
}

export function RedditNativeUploadPortal({
  onComplete,
  showPreview = true,
  acceptedFormats = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  nsfw = false,
}: Props) {
  const [externalUrl, setExternalUrl] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const resetState = useCallback(() => {
    setUploadProgress(0);
    setIsUploading(false);
  }, []);

  const handleSuccess = useCallback((payload: {
    previewUrl?: string;
    assetId: number;
    provider?: string;
    width?: number;
    height?: number;
    warnings?: string[];
  }) => {
    const { previewUrl: url, assetId, provider, width, height, warnings } = payload;

    if (url) {
      setPreviewUrl(url);
    }

    onComplete({
      imageUrl: url ?? '',
      assetId,
      provider,
      dimensions: { width, height },
      warnings,
    });

    if (warnings?.length) {
      toast({
        title: 'Upload completed with warnings',
        description: warnings.join(' • '),
      });
    } else {
      toast({
        title: 'Upload ready',
        description: 'Image prepared for Reddit with Imgbox preview fallback',
      });
    }
  }, [onComplete, toast]);

  const uploadFile = useCallback(async (file: File) => {
    if (!file) return;

    if (!acceptedFormats.includes(file.type)) {
      toast({
        title: 'Unsupported file type',
        description: 'Please upload JPEG, PNG, GIF, or WebP images',
        variant: 'destructive',
      });
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      toast({
        title: 'File too large',
        description: 'Reddit native uploads are limited to 20MB',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(10);

    const progressInterval = setInterval(() => {
      setUploadProgress((prev) => Math.min(prev + 8, 90));
    }, 200);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('nsfw', String(nsfw));

      const response = await fetch('/api/reddit/native-upload/prepare', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });

      clearInterval(progressInterval);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Upload failed with status ${response.status}`);
      }

      const data = await response.json() as {
        assetId: number;
        previewUrl?: string;
        provider?: string;
        width?: number;
        height?: number;
        warnings?: string[];
      };

      setUploadProgress(100);

      handleSuccess(data);
      trackUpload({
        provider: 'reddit-native',
        success: true,
        fileSize: file.size,
      });

      queryClient.invalidateQueries({ queryKey: ['/api/reddit/native-upload/prepare'] });
      setTimeout(resetState, 600);
    } catch (error) {
      clearInterval(progressInterval);
      resetState();

      trackUpload({
        provider: 'reddit-native',
        success: false,
        errorType: 'network',
      });

      toast({
        title: 'Upload failed',
        description: error instanceof Error ? error.message : 'Unable to prepare image for Reddit. Try again later.',
        variant: 'destructive',
      });
    }
  }, [acceptedFormats, handleSuccess, nsfw, queryClient, resetState, toast]);

  const handleExternalSubmit = useCallback(async () => {
    if (!externalUrl) return;

    try {
      const url = new URL(externalUrl);
      if (!url.protocol.startsWith('http')) {
        throw new Error('Invalid URL protocol');
      }
    } catch (error) {
      toast({
        title: 'Invalid URL',
        description: error instanceof Error ? error.message : 'Enter a valid HTTP(S) image URL',
        variant: 'destructive',
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(40);

    try {
      const response = await fetch('/api/reddit/native-upload/prepare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ imageUrl: externalUrl, nsfw }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to prepare image from URL');
      }

      const data = await response.json() as {
        assetId: number;
        previewUrl?: string;
        provider?: string;
        width?: number;
        height?: number;
        warnings?: string[];
      };

      setUploadProgress(100);
      handleSuccess(data);
      trackUpload({
        provider: 'reddit-native',
        success: true,
      });
      resetState();
    } catch (error) {
      resetState();
      toast({
        title: 'URL processing failed',
        description: error instanceof Error ? error.message : 'Unable to fetch image from URL',
        variant: 'destructive',
      });
    }
  }, [externalUrl, handleSuccess, nsfw, resetState, toast]);

  const handleRemovePreview = useCallback(() => {
    setPreviewUrl(null);
    setExternalUrl('');
  }, []);

  return (
    <Card className="shadow-sm border border-muted/40">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-purple-500" />
          Native Reddit Upload Portal
        </CardTitle>
        <CardDescription>
          Upload images for Reddit. We optimize locally, store a secure asset, and provide an Imgbox fallback preview if Reddit rejects the native upload.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="upload" disabled={isUploading}>
              <UploadCloud className="h-4 w-4 mr-2" /> Upload File
            </TabsTrigger>
            <TabsTrigger value="url" disabled={isUploading}>
              <Link2 className="h-4 w-4 mr-2" /> Paste URL
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="mt-4">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragActive(false);
                const file = e.dataTransfer.files?.[0];
                if (file) {
                  void uploadFile(file);
                }
              }}
              className={`border-2 border-dashed rounded-lg p-6 text-center transition ${
                dragActive ? 'border-purple-500 bg-purple-500/5' : 'border-muted'
              } ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <UploadCloud className="h-10 w-10 text-muted-foreground mx-auto" />
              <p className="mt-2 text-sm text-muted-foreground">
                Drag & drop or click to upload (max 20MB). Files are optimized for Reddit instantly.
              </p>
              <div className="mt-4">
                <Input
                  type="file"
                  accept={acceptedFormats.join(',')}
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (file) {
                      void uploadFile(file);
                    }
                  }}
                  disabled={isUploading}
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="url" className="mt-4 space-y-3">
            <Label htmlFor="native-url">Image URL</Label>
            <Input
              id="native-url"
              placeholder="https://i.redd.it/example.jpg"
              value={externalUrl}
              onChange={(event) => setExternalUrl(event.target.value)}
              disabled={isUploading}
            />
            <Button onClick={() => void handleExternalSubmit()} disabled={isUploading || !externalUrl}>
              <ExternalLink className="h-4 w-4 mr-2" /> Use URL
            </Button>
          </TabsContent>
        </Tabs>

        {isUploading && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Image className="h-4 w-4" /> Preparing image for Reddit...
            </div>
            <Progress value={uploadProgress} className="h-2" />
          </div>
        )}

        {showPreview && previewUrl && (
          <div className="relative border rounded-lg overflow-hidden">
            <img src={previewUrl} alt="Upload preview" className="w-full h-48 object-cover" />
            <Button
              variant="destructive"
              size="sm"
              className="absolute top-3 right-3"
              onClick={handleRemovePreview}
            >
              <Trash2 className="h-4 w-4 mr-1" /> Remove
            </Button>
          </div>
        )}

        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>How this works</AlertTitle>
          <AlertDescription className="space-y-1 text-sm">
            <p>• Image is optimized locally for Reddit posting and stored securely for reuse.</p>
            <p>• If Reddit rejects the media, we automatically fall back to Imgbox for hosting.</p>
            <p>• The preview URL shown here comes from Imgbox fallback and is safe to share.</p>
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
