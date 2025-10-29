import { useCallback, useState } from 'react';
import { Upload, X, CheckCircle, AlertCircle, Loader2, Image as ImageIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { authenticatedRequest } from '@/lib/authenticated-request';

const ACCEPTED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_FILE_SIZE_BYTES = 32 * 1024 * 1024; // 32MB
const MAX_FILES = 20; // Reasonable limit for bulk upload

export interface UploadedImage {
  id: string;
  file: File;
  url: string;
  assetId?: number;
  caption?: string;
  status: 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
}

interface BulkUploadZoneProps {
  onImagesUploaded: (images: UploadedImage[]) => void;
  maxFiles?: number;
  autoGenerateCaptions?: boolean;
  className?: string;
}

export function BulkUploadZone({
  onImagesUploaded,
  maxFiles = MAX_FILES,
  autoGenerateCaptions = true,
  className,
}: BulkUploadZoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const { toast } = useToast();

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_MIME_TYPES.includes(file.type)) {
      return `${file.name}: Invalid file type. Accepted: JPG, PNG, WebP, GIF`;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return `${file.name}: File too large. Max size: 32MB`;
    }
    return null;
  };

  const uploadFile = async (file: File, imageId: string): Promise<void> => {
    try {
      // Update progress to show uploading
      setUploadedImages((prev) =>
        prev.map((img) =>
          img.id === imageId ? { ...img, status: 'uploading', progress: 10 } : img
        )
      );

      const formData = new FormData();
      formData.append('image', file);

      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setUploadedImages((prev) =>
          prev.map((img) =>
            img.id === imageId && img.progress < 90
              ? { ...img, progress: img.progress + 10 }
              : img
          )
        );
      }, 200);

      const response = await authenticatedRequest<{
        asset: { 
          id: number; 
          signedUrl: string;
          downloadUrl: string;
        };
      }>('/api/media/upload', 'POST', formData);

      clearInterval(progressInterval);

      const imageUrl = response.asset?.signedUrl || response.asset?.downloadUrl;
      if (!imageUrl) {
        throw new Error('Upload failed: No URL returned');
      }

      // Update with success
      setUploadedImages((prev) =>
        prev.map((img) =>
          img.id === imageId
            ? {
                ...img,
                url: imageUrl,
                assetId: response.asset.id,
                status: 'success',
                progress: 100,
              }
            : img
        )
      );

      // Auto-generate caption if enabled
      if (autoGenerateCaptions) {
        generateCaption(imageId, response.asset.url);
      }
    } catch (error) {
      setUploadedImages((prev) =>
        prev.map((img) =>
          img.id === imageId
            ? {
                ...img,
                status: 'error',
                progress: 0,
                error:
                  error instanceof Error ? error.message : 'Upload failed',
              }
            : img
        )
      );
    }
  };

  const generateCaption = async (imageId: string, imageUrl: string): Promise<void> => {
    try {
      const response = await authenticatedRequest<{ caption: string }>(
        '/api/caption/generate',
        'POST',
        {
          imageUrl,
          platform: 'reddit',
          voice: 'flirty_playful',
          style: 'explicit',
          nsfw: true,
        }
      );

      setUploadedImages((prev) =>
        prev.map((img) =>
          img.id === imageId ? { ...img, caption: response.caption } : img
        )
      );
    } catch (error) {
      console.error('Caption generation failed:', error);
      // Don't show error toast for caption generation - it's optional
    }
  };

  const handleFiles = useCallback(
    async (files: FileList | File[]) => {
      const fileArray = Array.from(files);

      // Check total count
      if (uploadedImages.length + fileArray.length > maxFiles) {
        toast({
          title: 'Too many files',
          description: `Maximum ${maxFiles} files allowed. You selected ${fileArray.length} files.`,
          variant: 'destructive',
        });
        return;
      }

      // Validate all files first
      const validationErrors: string[] = [];
      const validFiles: File[] = [];

      fileArray.forEach((file) => {
        const error = validateFile(file);
        if (error) {
          validationErrors.push(error);
        } else {
          validFiles.push(file);
        }
      });

      if (validationErrors.length > 0) {
        toast({
          title: 'Some files were rejected',
          description: validationErrors.join('\n'),
          variant: 'destructive',
        });
      }

      if (validFiles.length === 0) return;

      // Create image entries
      const newImages: UploadedImage[] = validFiles.map((file) => ({
        id: `${Date.now()}-${Math.random()}`,
        file,
        url: URL.createObjectURL(file), // Temporary preview URL
        status: 'uploading',
        progress: 0,
      }));

      setUploadedImages((prev) => [...prev, ...newImages]);

      // Upload all files
      await Promise.all(
        newImages.map((image) => uploadFile(image.file, image.id))
      );

      // Notify parent component
      const successfulImages = newImages.filter((img) => img.status === 'success');
      if (successfulImages.length > 0) {
        onImagesUploaded(successfulImages);
        toast({
          title: 'Upload complete',
          description: `${successfulImages.length} image${successfulImages.length > 1 ? 's' : ''} uploaded successfully`,
        });
      }
    },
    [uploadedImages.length, maxFiles, onImagesUploaded, toast, autoGenerateCaptions]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    },
    [handleFiles]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  }, []);

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(e.target.files);
      }
    },
    [handleFiles]
  );

  const removeImage = (imageId: string) => {
    setUploadedImages((prev) => prev.filter((img) => img.id !== imageId));
  };

  const retryUpload = (imageId: string) => {
    const image = uploadedImages.find((img) => img.id === imageId);
    if (image) {
      uploadFile(image.file, imageId);
    }
  };

  const totalProgress = uploadedImages.length > 0
    ? uploadedImages.reduce((sum, img) => sum + img.progress, 0) / uploadedImages.length
    : 0;

  const uploadingCount = uploadedImages.filter((img) => img.status === 'uploading').length;
  const successCount = uploadedImages.filter((img) => img.status === 'success').length;
  const errorCount = uploadedImages.filter((img) => img.status === 'error').length;

  return (
    <div className={cn('space-y-4', className)}>
      {/* Drop Zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        className={cn(
          'relative rounded-lg border-2 border-dashed transition-colors',
          dragActive
            ? 'border-primary bg-primary/5'
            : 'border-muted-foreground/25 hover:border-muted-foreground/50',
          uploadedImages.length > 0 ? 'p-4' : 'p-12'
        )}
      >
        <input
          type="file"
          id="bulk-upload-input"
          multiple
          accept={ACCEPTED_MIME_TYPES.join(',')}
          onChange={handleFileInput}
          className="hidden"
        />

        {uploadedImages.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-center">
            <Upload className="mb-4 h-12 w-12 text-muted-foreground" />
            <h3 className="mb-2 text-lg font-semibold">
              Drop images here or click to browse
            </h3>
            <p className="mb-4 text-sm text-muted-foreground">
              Upload up to {maxFiles} images (JPG, PNG, WebP, GIF • Max 32MB each)
            </p>
            <Button asChild>
              <label htmlFor="bulk-upload-input" className="cursor-pointer">
                <Upload className="mr-2 h-4 w-4" />
                Select Files
              </label>
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Progress Summary */}
            <div className="flex items-center justify-between">
              <div className="text-sm font-medium">
                {uploadingCount > 0 && (
                  <span className="text-blue-600">
                    Uploading {uploadingCount}...
                  </span>
                )}
                {uploadingCount === 0 && successCount > 0 && (
                  <span className="text-green-600">
                    {successCount} uploaded
                  </span>
                )}
                {errorCount > 0 && (
                  <span className="ml-2 text-red-600">
                    {errorCount} failed
                  </span>
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                asChild
                disabled={uploadingCount > 0}
              >
                <label htmlFor="bulk-upload-input" className="cursor-pointer">
                  <Upload className="mr-2 h-4 w-4" />
                  Add More
                </label>
              </Button>
            </div>

            {uploadingCount > 0 && (
              <Progress value={totalProgress} className="h-2" />
            )}

            {/* Image Grid */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {uploadedImages.map((image) => (
                <Card key={image.id} className="relative overflow-hidden">
                  <CardContent className="p-2">
                    {/* Image Preview */}
                    <div className="relative aspect-square overflow-hidden rounded-md bg-muted">
                      <img
                        src={image.url}
                        alt={image.file.name}
                        className="h-full w-full object-cover"
                      />

                      {/* Status Overlay */}
                      {image.status === 'uploading' && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                          <Loader2 className="h-8 w-8 animate-spin text-white" />
                        </div>
                      )}

                      {image.status === 'success' && (
                        <div className="absolute right-1 top-1">
                          <CheckCircle className="h-5 w-5 text-green-500" />
                        </div>
                      )}

                      {image.status === 'error' && (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                          <AlertCircle className="h-8 w-8 text-red-500" />
                        </div>
                      )}

                      {/* Remove Button */}
                      <button
                        onClick={() => removeImage(image.id)}
                        className="absolute right-1 top-1 rounded-full bg-black/50 p-1 text-white transition-colors hover:bg-black/70"
                        disabled={image.status === 'uploading'}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>

                    {/* File Name */}
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      {image.file.name}
                    </p>

                    {/* Progress Bar */}
                    {image.status === 'uploading' && (
                      <Progress value={image.progress} className="mt-1 h-1" />
                    )}

                    {/* Error Message */}
                    {image.status === 'error' && (
                      <div className="mt-1">
                        <p className="text-xs text-red-600">{image.error}</p>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => retryUpload(image.id)}
                          className="mt-1 h-6 w-full text-xs"
                        >
                          Retry
                        </Button>
                      </div>
                    )}

                    {/* Caption Status */}
                    {image.status === 'success' && autoGenerateCaptions && (
                      <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                        {image.caption ? (
                          <>
                            <CheckCircle className="h-3 w-3 text-green-500" />
                            <span>Caption ready</span>
                          </>
                        ) : (
                          <>
                            <Loader2 className="h-3 w-3 animate-spin" />
                            <span>Generating...</span>
                          </>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
