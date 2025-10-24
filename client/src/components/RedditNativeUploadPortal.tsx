import { useCallback, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { UploadCloud, Link2, CheckCircle, Image, ExternalLink, Shield, Loader2 } from 'lucide-react';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { authenticatedRequest } from '@/lib/authenticated-request';
import { parseSingleMediaAsset, type MediaAssetResponse } from '@/lib/gallery';
import { trackUpload } from '@/lib/upload-monitoring';

const ACCEPTED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
]);

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB aligns with Reddit native limit

const uploadResponseSchema = z.object({
  message: z.string().optional(),
  asset: z.unknown(),
});

interface UploadResult {
  imageUrl: string;
  assetId?: number;
  filename?: string;
  provider?: string;
}

interface Props {
  onComplete: (result: UploadResult) => void;
  showPreview?: boolean;
  acceptedFormats?: string[];
}

function sanitizeUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (!['https:', 'http:'].includes(url.protocol)) {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function toAbsoluteUrl(url: string | null | undefined): string {
  if (!url) {
    return '';
  }

  const trimmed = url.trim();
  if (/^(?:https?:|data:|blob:)/i.test(trimmed)) {
    return trimmed;
  }

  if (typeof window === 'undefined') {
    return trimmed;
  }

  try {
    // Handle paths that start with a slash
    return new URL(trimmed.startsWith('/') ? trimmed : `./${trimmed}`, window.location.origin).toString();
  } catch {
    return trimmed;
  }
}
}

export function RedditNativeUploadPortal({
  onComplete,
  showPreview = true,
  acceptedFormats = Array.from(ACCEPTED_MIME_TYPES),
}: Props) {
  const [externalUrl, setExternalUrl] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const acceptedMimeLabels = useMemo(() => acceptedFormats.map((format) => format.replace('image/', '').toUpperCase()).join(', '), [acceptedFormats]);

  const finishUpload = useCallback(
    (asset: MediaAssetResponse) => {
      const rawUrl = asset.signedUrl ?? asset.downloadUrl;
      const imageUrl = toAbsoluteUrl(rawUrl);
      if (!imageUrl) {
        throw new Error('Upload succeeded but no accessible URL was returned.');
      }

      setPreviewUrl(imageUrl);
      onComplete({
        imageUrl,
        assetId: asset.id,
        filename: asset.filename,
        provider: 'reddit-native',
      });

      trackUpload({
        provider: 'reddit-native',
        success: true,
        fileSize: asset.bytes,
      });

      toast({
        title: 'Upload ready for Reddit',
        description: 'Image optimized and stored for native Reddit posting.',
      });

      queryClient.invalidateQueries({ queryKey: ['/api/media'] });
    },
    [onComplete, queryClient, toast],
  );

  const uploadToNative = useCallback(
    async (file: File) => {
      if (!file) {
        return;
      }

      if (!ACCEPTED_MIME_TYPES.has(file.type)) {
        toast({
          title: 'Unsupported file type',
          description: `Please upload ${acceptedMimeLabels} files only.`,
          variant: 'destructive',
        });
        return;
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        toast({
          title: 'File too large',
          description: 'Reddit native uploads are limited to 20MB.',
          variant: 'destructive',
        });
        return;
      }

      setIsUploading(true);
      setUploadProgress(8);
      const startTime = Date.now();
      const progressInterval = window.setInterval(() => {
        setUploadProgress((current) => Math.min(current + 7, 90));
      }, 250);

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('watermark', 'auto');

        const response = await authenticatedRequest<unknown>('/api/media/upload', 'POST', formData);
        const parsedResponse = uploadResponseSchema.safeParse(response);

        if (!parsedResponse.success) {
          throw new Error('Unexpected response from media upload endpoint.');
        }

        const asset = parseSingleMediaAsset(parsedResponse.data.asset);
        if (!asset) {
          throw new Error('Failed to parse uploaded media asset.');
        }

        setUploadProgress(100);
        finishUpload(asset);

        const duration = Date.now() - startTime;
        trackUpload({
          provider: 'reddit-native',
          success: true,
          duration,
          fileSize: file.size,
        });
      } catch (error) {
        trackUpload({
          provider: 'reddit-native',
          success: false,
          errorType: 'server',
        });

        const message = error instanceof Error ? error.message : 'Upload failed. Please try again or paste an existing URL.';
        toast({
          title: 'Upload failed',
          description: message,
          variant: 'destructive',
        });
      } finally {
        window.clearInterval(progressInterval);
        setTimeout(() => setUploadProgress(0), 500);
        setIsUploading(false);
      }
    },
    [acceptedMimeLabels, finishUpload, toast],
  );

  const handleExternalSubmit = useCallback(() => {
    const sanitized = sanitizeUrl(externalUrl);
    if (!sanitized) {
      toast({
        title: 'Invalid URL',
        description: 'Please enter a valid HTTP or HTTPS image URL.',
        variant: 'destructive',
      });
      return;
    }

    setPreviewUrl(sanitized);
    onComplete({ imageUrl: sanitized, provider: 'external' });
    trackUpload({ provider: 'external', success: true });
    toast({ title: 'URL accepted', description: 'We will pull this image directly when posting to Reddit.' });
  }, [externalUrl, onComplete, toast]);

  const handleDrag = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (event.type === 'dragenter' || event.type === 'dragover') {
      setDragActive(true);
    } else if (event.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setDragActive(false);

      const file = event.dataTransfer.files?.[0];
      if (file) {
        uploadToNative(file);
      }
    },
    [uploadToNative],
  );

  const handleFileInput = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        uploadToNative(file);
      }
    },
    [uploadToNative],
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UploadCloud className="h-5 w-5" />
          Reddit Native Upload
        </CardTitle>
        <CardDescription>
          Upload directly to our protected media store for instant Reddit native posting. No Catbox required.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <Tabs defaultValue="upload" className="space-y-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <UploadCloud className="h-4 w-4" /> Upload
            </TabsTrigger>
            <TabsTrigger value="url" className="flex items-center gap-2">
              <Link2 className="h-4 w-4" /> Paste URL
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="mt-4 space-y-4">
            <div
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
              className={`flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-8 text-center transition ${
                dragActive ? 'border-primary bg-muted/40' : 'border-muted-foreground/20'
              }`}
            >
              <Image className="h-10 w-10 text-muted-foreground" />
              <div>
                <p className="font-medium">Drag & drop your image</p>
                <p className="text-sm text-muted-foreground">JPEG, PNG, GIF, or WebP — up to 20MB</p>
              </div>
              <div className="flex items-center gap-2">
                <Button type="button" variant="secondary" onClick={() => document.getElementById('native-upload-input')?.click()} disabled={isUploading}>
                  Browse files
                </Button>
                <Shield className="h-4 w-4 text-emerald-500" />
                <span className="text-sm text-muted-foreground">Auto watermarked before posting</span>
              </div>
              <input
                id="native-upload-input"
                type="file"
                accept={acceptedFormats.join(',')}
                className="hidden"
                onChange={handleFileInput}
              />
            </div>

            {isUploading ? (
              <div className="flex items-center gap-3 rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Uploading and optimizing...
              </div>
            ) : null}

            {uploadProgress > 0 ? <Progress value={uploadProgress} /> : null}

            <Alert>
              <Shield className="h-4 w-4" />
              <AlertTitle>Reddit-first workflow</AlertTitle>
              <AlertDescription>
                Images are stored securely with watermarking so we can post directly via Reddit&apos;s native media API. No third-party hosts.
              </AlertDescription>
            </Alert>
          </TabsContent>

          <TabsContent value="url" className="mt-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="native-external-url">Image URL</Label>
              <Input
                id="native-external-url"
                placeholder="https://i.redd.it/example.jpg"
                value={externalUrl}
                onChange={(event) => setExternalUrl(event.target.value)}
                disabled={isUploading}
              />
            </div>
            <Button type="button" onClick={handleExternalSubmit} disabled={!externalUrl || isUploading}>
              <ExternalLink className="mr-2 h-4 w-4" /> Use URL
            </Button>
            <Alert variant="secondary">
              <AlertTitle>Already have a hosted image?</AlertTitle>
              <AlertDescription>
                Paste any direct image URL (Reddit CDN, Imgbox, etc.) and we&apos;ll pull it when generating captions or posting.
              </AlertDescription>
            </Alert>
          </TabsContent>
        </Tabs>

        {showPreview && previewUrl ? (
          <div className="mt-6 space-y-2">
            <Label className="text-sm text-muted-foreground">Preview</Label>
            <div className="relative aspect-video w-full overflow-hidden rounded-lg border">
              <img src={previewUrl} alt="Upload preview" className="h-full w-full object-contain" />
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <CheckCircle className="h-4 w-4 text-emerald-500" /> Ready for Reddit native posting
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default RedditNativeUploadPortal;
