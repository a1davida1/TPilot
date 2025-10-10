import { useState, useCallback } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Loader2, 
  UploadCloud, 
  Link2, 
  AlertTriangle, 
  CheckCircle,
  Image,
  ExternalLink,
  Info,
  Trash2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface UploadResult {
  imageUrl: string;
  deleteHash?: string;
  dimensions?: { width: number; height: number };
  provider?: string;
}

interface ImgurUploadResponse {
  success: boolean;
  imageUrl: string;
  deleteHash?: string;
  dimensions?: { width: number; height: number };
  provider?: string;
}

interface ImgurStats {
  used: number;
  limit: number;
  remaining: number;
  percentUsed: number;
  nearLimit: boolean;
}

interface Props {
  onComplete: (result: UploadResult) => void;
  showPreview?: boolean;
  allowMultiple?: boolean;
  acceptedFormats?: string[];
}

export function ImgurUploadPortal({ 
  onComplete, 
  showPreview = true,
  allowMultiple = false,
  acceptedFormats = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
}: Props) {
  const [externalUrl, setExternalUrl] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);
  const { toast } = useToast();

  // Get usage stats
  const { data: stats } = useQuery<ImgurStats>({
    queryKey: ['/api/uploads/imgur/stats'],
    refetchInterval: 60000 // Refresh every minute
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('markSensitive', 'true');

      // Simulate progress for better UX
      setUploadProgress(10);
      
      const xhr = new XMLHttpRequest();
      
      return new Promise((resolve, reject) => {
        xhr.upload.addEventListener('progress', (e) => {
          if (e.lengthComputable) {
            const progress = Math.round((e.loaded / e.total) * 90) + 10;
            setUploadProgress(progress);
          }
        });

        xhr.addEventListener('load', () => {
          setUploadProgress(100);
          if (xhr.status === 200) {
            const response = JSON.parse(xhr.responseText);
            resolve(response);
          } else if (xhr.status === 429) {
            reject(new Error('Daily upload limit reached. Please paste an image URL instead.'));
          } else {
            reject(new Error('Upload failed'));
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Network error during upload'));
        });

        xhr.open('POST', '/api/uploads/imgur');
        xhr.send(formData);
      });
    },
    onSuccess: (data: unknown) => {
      // Type guard for the response data
      const response = data as ImgurUploadResponse;
      
      if (response.success && response.imageUrl) {
        setPreviewUrl(response.imageUrl);
        onComplete({ 
          imageUrl: response.imageUrl, 
          deleteHash: response.deleteHash,
          dimensions: response.dimensions,
          provider: response.provider
        });
      }
      
      toast({
        title: "Upload successful",
        description: "Your image has been uploaded to Imgur",
      });
      
      setUploadProgress(0);
    },
    onError: (error: Error) => {
      setUploadProgress(0);
      toast({
        title: "Upload failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Handle external URL submission
  const handleExternalSubmit = useCallback(() => {
    if (!externalUrl) return;
    
    // Basic validation of URL
    try {
      const url = new URL(externalUrl);
      if (!url.protocol.startsWith('http')) {
        toast({
          title: "Invalid URL",
          description: "Please enter a valid HTTP(S) URL",
          variant: "destructive"
        });
        return;
      }
    } catch {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid image URL",
        variant: "destructive"
      });
      return;
    }

    setPreviewUrl(externalUrl);
    onComplete({ imageUrl: externalUrl });
    
    toast({
      title: "URL accepted",
      description: "You can now generate captions for this image",
    });
  }, [externalUrl, onComplete, toast]);

  // Handle file selection
  const handleFileSelect = useCallback((file: File) => {
    // Validate file type
    if (!acceptedFormats.some(format => file.type.startsWith(format.split('/')[0]))) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file (JPEG, PNG, GIF, or WebP)",
        variant: "destructive"
      });
      return;
    }

    // Validate file size (15MB for Imgur)
    if (file.size > 15 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Maximum file size is 15MB",
        variant: "destructive"
      });
      return;
    }

    uploadMutation.mutate(file);
  }, [acceptedFormats, uploadMutation, toast]);

  // Drag and drop handlers
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }, [handleFileSelect]);

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Image className="w-5 h-5" />
          Image Upload Portal
        </CardTitle>
        <CardDescription>
          Upload to Imgur or paste an existing image URL
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Usage stats alert */}
        {stats?.nearLimit && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Upload limit warning</AlertTitle>
            <AlertDescription>
              You're approaching the daily upload limit ({stats.used}/{stats.limit}). 
              Consider pasting URLs instead.
            </AlertDescription>
          </Alert>
        )}

        <Tabs defaultValue="upload" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="upload">Upload File</TabsTrigger>
            <TabsTrigger value="url">Paste URL</TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="space-y-4">
            {/* Drag and drop zone */}
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'
              } ${uploadMutation.isPending ? 'opacity-50 pointer-events-none' : ''}`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <Input
                id="file-upload"
                type="file"
                accept={acceptedFormats.join(',')}
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFileSelect(file);
                }}
                disabled={uploadMutation.isPending}
              />
              
              <label 
                htmlFor="file-upload" 
                className="cursor-pointer flex flex-col items-center gap-2"
              >
                <UploadCloud className="w-10 h-10 text-muted-foreground" />
                <div className="space-y-1">
                  <p className="text-sm font-medium">
                    {dragActive ? 'Drop your image here' : 'Drag & drop or click to upload'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    JPEG, PNG, GIF, WebP up to 15MB
                  </p>
                </div>
              </label>
            </div>

            {/* Upload progress */}
            {uploadMutation.isPending && uploadProgress > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Uploading to Imgur...</span>
                  <span className="font-medium">{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="w-full" />
              </div>
            )}

            {/* Info about Imgur */}
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Images are uploaded anonymously to Imgur. They're not stored on our servers.
                For mission-critical content, consider using your own S3 bucket.
              </AlertDescription>
            </Alert>
          </TabsContent>

          <TabsContent value="url" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="external-url">Image URL</Label>
              <div className="flex gap-2">
                <Input
                  id="external-url"
                  type="url"
                  value={externalUrl}
                  onChange={(e) => setExternalUrl(e.target.value)}
                  placeholder="https://i.imgur.com/example.jpg"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleExternalSubmit();
                    }
                  }}
                />
                <Button 
                  onClick={handleExternalSubmit}
                  disabled={!externalUrl}
                  size="default"
                >
                  <Link2 className="w-4 h-4 mr-2" />
                  Use URL
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Supports Imgur, Catbox, Discord CDN, Reddit, and other direct image links
              </p>
            </div>

            {/* Popular hosts info */}
            <div className="rounded-lg bg-muted/50 p-4 space-y-2">
              <p className="text-sm font-medium">Popular image hosts:</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" />
                  <a href="https://imgur.com" target="_blank" rel="noopener noreferrer" 
                     className="text-primary hover:underline">
                    Imgur
                  </a>
                  <span className="text-muted-foreground">(Free, anonymous)</span>
                </div>
                <div className="flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" />
                  <a href="https://catbox.moe" target="_blank" rel="noopener noreferrer"
                     className="text-primary hover:underline">
                    Catbox
                  </a>
                  <span className="text-muted-foreground">(Free, 200MB)</span>
                </div>
                <div className="flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" />
                  <span>Discord CDN</span>
                  <span className="text-muted-foreground">(From Discord)</span>
                </div>
                <div className="flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" />
                  <span>Reddit</span>
                  <span className="text-muted-foreground">(i.redd.it links)</span>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Preview */}
        {showPreview && previewUrl && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Preview</Label>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPreviewUrl(null);
                  setExternalUrl('');
                }}
              >
                <Trash2 className="w-4 h-4 mr-1" />
                Clear
              </Button>
            </div>
            <div className="relative rounded-lg border bg-muted/20 p-2">
              <img 
                src={previewUrl} 
                alt="Upload preview" 
                className="max-h-64 w-auto mx-auto rounded object-contain"
                onError={() => {
                  toast({
                    title: "Preview failed",
                    description: "Could not load image preview",
                    variant: "destructive"
                  });
                }}
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle className="w-3 h-3 text-green-500" />
              Image ready for caption generation
            </div>
          </div>
        )}

        {/* Error state */}
        {uploadMutation.isError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Upload failed</AlertTitle>
            <AlertDescription>
              {uploadMutation.error?.message || 'Failed to upload image. Try pasting a URL instead.'}
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
