import { useState, useCallback } from 'react';
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
  CheckCircle,
  Image,
  ExternalLink,
  Info,
  Trash2,
  Shield
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { trackUpload } from '@/lib/upload-monitoring';

interface UploadResult {
  imageUrl: string;
  deleteHash?: string;
  dimensions?: { width: number; height: number };
  provider?: string;
}

interface Props {
  onComplete: (result: UploadResult) => void;
  showPreview?: boolean;
  allowMultiple?: boolean;
  acceptedFormats?: string[];
}

export function CatboxUploadPortal({ 
  onComplete, 
  showPreview = true,
  acceptedFormats = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
}: Props) {
  const [externalUrl, setExternalUrl] = useState('');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const { toast } = useToast();

  // Direct upload to Catbox (client-side only, no backend involvement)
  const uploadToCatbox = useCallback(async (file: File) => {
    if (!file) return;

    // Validate file type
    if (!acceptedFormats.some(format => file.type.startsWith(format.split('/')[0]))) {
      toast({
        title: "Invalid file type",
        description: "Please select an image file (JPEG, PNG, GIF, or WebP)",
        variant: "destructive"
      });
      return;
    }

    // Validate file size (200MB for Catbox)
    if (file.size > 200 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Maximum file size is 200MB",
        variant: "destructive"
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(10);

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 300);

      // ALWAYS use proxy to avoid CORS - Catbox doesn't set CORS headers
      const formData = new FormData();
      formData.append('file', file);
      
      const startTime = Date.now();
      const response = await fetch('/api/upload/catbox-proxy', {
        method: 'POST',
        body: formData,
        credentials: 'include' // Include cookies for auth
      });
      
      clearInterval(progressInterval);
      const _uploadDuration = Date.now() - startTime;

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || `Upload failed: ${response.statusText}`);
      }

      const data = await response.json();
      
      if (!data.success || !data.imageUrl) {
        throw new Error('Failed to get valid URL from upload');
      }

      setUploadProgress(100);
      
      // Set preview and notify parent
      const imageUrl = data.imageUrl;
      setPreviewUrl(imageUrl);
      onComplete({ 
        imageUrl,
        provider: data.provider || 'catbox'
      });
      
      // Track successful direct upload
      trackUpload({
        provider: 'catbox',
        success: true,
        fileSize: file.size,
        duration: _uploadDuration
      });
      
      toast({
        title: "Upload successful",
        description: "Your image has been uploaded to Catbox",
      });

      // Reset after a short delay
      setTimeout(() => {
        setUploadProgress(0);
        setIsUploading(false);
      }, 500);

    } catch (error) {
      // Upload failed
      trackUpload({
        provider: 'catbox',
        success: false,
        errorType: 'network'
      });
      
      setUploadProgress(0);
      setIsUploading(false);
      
      toast({
        title: "Upload failed",
        description: error instanceof Error ? error.message : "Failed to upload image. Please try again or use a URL.",
        variant: "destructive"
      });
    }
  }, [acceptedFormats, onComplete, toast]);

  // Handle external URL submission
  const handleExternalSubmit = useCallback(async () => {
    if (!externalUrl) return;
    
    // Basic validation of URL
    try {
      const url = new URL(externalUrl);
      if (!url.protocol.startsWith('http')) {
        throw new Error('Invalid URL');
      }
    } catch {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid image URL",
        variant: "destructive"
      });
      return;
    }
    
    setIsUploading(true);
    setUploadProgress(50);
    
    try {
      // Try to upload URL via our Catbox API (server-side)
      const response = await fetch('/api/catbox/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: externalUrl }),
        credentials: 'include'
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'URL upload failed');
      }
      
      const data = await response.json();
      
      if (!data.success || !data.url) {
        throw new Error('Failed to upload from URL');
      }
      
      setUploadProgress(100);
      setPreviewUrl(data.url);
      onComplete({
        imageUrl: data.url,
        provider: 'catbox'
      });
      
      toast({
        title: "Upload successful",
        description: "Image uploaded from URL to Catbox",
      });
      
      setExternalUrl('');
      setTimeout(() => {
        setUploadProgress(0);
        setIsUploading(false);
      }, 500);
      
    } catch (_error) {
      // Fall back to accepting the URL directly if Catbox upload fails
      setPreviewUrl(externalUrl);
      onComplete({ imageUrl: externalUrl, provider: 'external' });
      
      toast({
        title: "URL accepted",
        description: "Using original URL (Catbox upload not available)",
      });
      
      setUploadProgress(0);
      setIsUploading(false);
    }
  }, [externalUrl, onComplete, toast]);

  // Handle file selection
  const handleFileSelect = useCallback((file: File) => {
    uploadToCatbox(file);
  }, [uploadToCatbox]);

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
          Upload to Catbox (free, anonymous) or paste an existing image URL
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Privacy notice */}
        <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20">
          <Shield className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-800 dark:text-green-400">Privacy First</AlertTitle>
          <AlertDescription className="text-green-700 dark:text-green-300">
            Images upload directly to Catbox from your browser. They never touch our servers, 
            ensuring complete privacy and legal compliance.
          </AlertDescription>
        </Alert>

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
              } ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
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
                disabled={isUploading}
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
                    JPEG, PNG, GIF, WebP up to 200MB
                  </p>
                </div>
              </label>
            </div>

            {/* Upload progress */}
            {isUploading && uploadProgress > 0 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Uploading to Catbox...</span>
                  <span className="font-medium">{uploadProgress}%</span>
                </div>
                <Progress value={uploadProgress} className="w-full" />
              </div>
            )}

            {/* Info about Catbox */}
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                Images are uploaded anonymously to Catbox. Free service with 200MB file limit. 
                Direct browser upload means your content never touches our servers.
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
                  placeholder="https://files.catbox.moe/example.jpg"
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
                Supports Catbox, Imgur, Discord CDN, Reddit, and other direct image links
              </p>
            </div>

            {/* Popular hosts info */}
            <div className="rounded-lg bg-muted/50 p-4 space-y-2">
              <p className="text-sm font-medium">Popular image hosts:</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
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
                  <a href="https://imgur.com" target="_blank" rel="noopener noreferrer" 
                     className="text-primary hover:underline">
                    Imgur
                  </a>
                  <span className="text-muted-foreground">(Free tier limited)</span>
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
      </CardContent>
    </Card>
  );
}
