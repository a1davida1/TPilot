import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { downloadProtectedImage } from '@/lib/image-protection';
import { Upload, Shield, Download, Trash2, Tag, Share2 } from 'lucide-react';
import { useGalleryAssets } from '@/hooks/useGalleryAssets';
import { authenticatedRequest } from '@/lib/authenticated-request';
import {
  GalleryImage,
  isLibraryImage,
  getGalleryImageUrl,
  formatMimeLabel,
  type MediaAssetResponse
} from '@/lib/gallery';

type ProtectionLevel = 'light' | 'standard' | 'heavy';

interface ProtectImageResponse {
  success?: boolean;
  protectedUrl?: string;
  message?: string;
}

interface QuickRepostResponse {
  success?: boolean;
  repostedAt?: string;
  message?: string;
}

interface DeleteImageResponse {
  success?: boolean;
  message?: string;
}

interface ImageDetailModalProps {
  image: GalleryImage | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onProtect: (image: GalleryImage, level: ProtectionLevel) => void;
  onQuickRepost: (image: GalleryImage) => void;
  onDownload: (image: GalleryImage) => void;
  onDelete: (image: GalleryImage) => void;
  isProtecting: boolean;
  isReposting: boolean;
  isDeleting: boolean;
}

function ImageDetailModal({
  image,
  open,
  onOpenChange,
  onProtect,
  onQuickRepost,
  onDownload,
  onDelete,
  isProtecting,
  isReposting,
  isDeleting
}: ImageDetailModalProps) {
  const isLibrary = image ? isLibraryImage(image) : false;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {image ? (
        <DialogContent className="max-w-2xl" data-testid="image-detail-dialog">
          <DialogHeader>
            <DialogTitle>Image Details</DialogTitle>
            <DialogDescription>{image.filename}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <img
              src={image.signedUrl || image.downloadUrl || ''}
              alt={image.filename}
              className="w-full max-h-96 object-contain rounded-lg"
            />

            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">
                <Tag className="h-3 w-3 mr-1" />
                {formatMimeLabel(image.mime)}
              </Badge>
              <Badge variant="outline">{Math.round(image.bytes / 1024)}KB</Badge>
              <Badge variant="outline">{new Date(image.createdAt).toLocaleDateString()}</Badge>
              <Badge variant="outline">{isLibrary ? 'Media Library' : 'Catbox Upload'}
              </Badge>
              {image.protectionLevel ? (
                <Badge
                  variant="secondary"
                  data-testid="protection-status"
                  data-protection-level={image.protectionLevel}
                >
                  <Shield className="h-3 w-3 mr-1" />
                  Protected: {image.protectionLevel}
                </Badge>
              ) : null}
              {image.lastRepostedAt ? (
                <Badge
                  variant="secondary"
                  data-testid="repost-status"
                  data-reposted-at={image.lastRepostedAt}
                >
                  <Share2 className="h-3 w-3 mr-1" />
                  Reposted {new Date(image.lastRepostedAt).toLocaleDateString()}
                </Badge>
              ) : null}
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                onClick={() => onQuickRepost(image)}
                disabled={!isLibrary || isReposting}
                data-testid="quick-repost-button"
                title={isLibrary ? undefined : 'Quick repost is only available for media library uploads'}
              >
                <Share2 className="h-4 w-4 mr-1" />
                {isReposting ? 'Reposting...' : 'Quick Repost'}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => onProtect(image, 'standard')}
                disabled={!isLibrary || isProtecting}
                data-testid="quick-protect-button"
                title={isLibrary ? undefined : 'Protection is managed through the media library'}
              >
                <Shield className="h-4 w-4 mr-1" />
                {isProtecting ? 'Protecting...' : 'Quick Protect'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onProtect(image, 'light')}
                disabled={!isLibrary || isProtecting}
                title={isLibrary ? undefined : 'Protection is managed through the media library'}
              >
                <Shield className="h-4 w-4 mr-1" />
                Light Shield
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onProtect(image, 'heavy')}
                disabled={!isLibrary || isProtecting}
                title={isLibrary ? undefined : 'Protection is managed through the media library'}
              >
                <Shield className="h-4 w-4 mr-1" />
                Heavy Shield
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onDownload(image)}
                data-testid="dialog-close-button"
              >
                <Download className="h-4 w-4 mr-1" />
                Download
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => onDelete(image)}
                disabled={!isLibrary || isDeleting}
                title={isLibrary ? undefined : 'Delete Catbox uploads from the Catbox dashboard'}
                data-testid="delete-button"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                {isDeleting ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

export function ImageGallery() {
  const [selectedTags, setSelectedTags] = useState<string>('');
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();

  const {
    galleryImages,
    isLoading: galleryLoading,
    mediaError,
    catboxError
  } = useGalleryAssets();

  const selectedImage = useMemo(() => {
    if (!selectedImageId) {
      return null;
    }
    return galleryImages.find(img => img.id === selectedImageId) || null;
  }, [galleryImages, selectedImageId]);

  const updateCachedLibraryImage = (imageId: number, updater: (asset: MediaAssetResponse) => MediaAssetResponse): void => {
    queryClient.setQueryData(['/api/media'], (current: unknown) => {
      if (!current || !Array.isArray(current)) {
        return current;
      }
      return current.map((asset: MediaAssetResponse) => (asset.id === imageId ? updater(asset) : asset));
    });
  };

  const removeCachedLibraryImage = (imageId: number): void => {
    queryClient.setQueryData(['/api/media'], (current: unknown) => {
      if (!current || !Array.isArray(current)) {
        return current;
      }
      return current.filter((asset: MediaAssetResponse) => asset.id !== imageId);
    });
  };

  const uploadMutation = useMutation<unknown, Error, FormData>({
    mutationFn: async (formData: FormData) => {
      return authenticatedRequest<unknown>('/api/media/upload', 'POST', formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/media'] });
      toast({
        title: "Image uploaded",
        description: "Your image has been saved to your gallery."
      });
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : "Failed to upload image.";
      toast({
        title: "Upload failed",
        description: errorMessage,
        variant: "destructive"
      });
    }
  });

  const protectMutation = useMutation<ProtectImageResponse, Error, { imageId: number; protectionLevel: ProtectionLevel }>({
    mutationFn: async ({ imageId, protectionLevel }) => {
      return authenticatedRequest<ProtectImageResponse>(`/api/protect-image/${imageId}`, 'POST', { protectionLevel });
    },
    onSuccess: (data, variables) => {
      const protectedUrl = data?.protectedUrl;
      updateCachedLibraryImage(variables.imageId, (asset) => ({
        ...asset,
        protectionLevel: variables.protectionLevel,
        isProtected: true,
        ...(protectedUrl ? { signedUrl: protectedUrl, downloadUrl: protectedUrl } : {})
      }));
      queryClient.invalidateQueries({ queryKey: ['/api/media'] });
      toast({
        title: "Image protected",
        description: data?.message || "Your image has been protected against reverse searches."
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Protection failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const quickRepostMutation = useMutation<QuickRepostResponse, Error, number>({
    mutationFn: async (imageId: number) => {
      return authenticatedRequest<QuickRepostResponse>('/api/reddit/quick-repost', 'POST', { imageId });
    },
    onSuccess: (data, imageId) => {
      const timestamp = data?.repostedAt ?? new Date().toISOString();
      updateCachedLibraryImage(imageId, (asset) => ({
        ...asset,
        lastRepostedAt: timestamp
      }));
      queryClient.invalidateQueries({ queryKey: ['/api/reddit/posts'] });
      toast({
        title: "Repost queued",
        description: data?.message || "Your image has been queued for reposting."
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Repost failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const deleteMutation = useMutation<DeleteImageResponse, Error, number>({
    mutationFn: async (imageId: number) => {
      return authenticatedRequest<DeleteImageResponse>(`/api/media/${imageId}`, 'DELETE');
    },
    onSuccess: (data, imageId) => {
      removeCachedLibraryImage(imageId);
      setSelectedImageId((current) => (current === `library-${imageId}` ? null : current));
      queryClient.invalidateQueries({ queryKey: ['/api/media'] });
      toast({
        title: "Image deleted",
        description: data?.message || "Image has been removed from your gallery."
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Delete failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Process files immediately without blocking
    for (const file of Array.from(files)) {
      // Show immediate feedback
      toast({
        title: "Processing image",
        description: `Uploading ${file.name}...`
      });
      
      // Create preview URL for immediate display
      const previewUrl = URL.createObjectURL(file);
      
      // Store locally for now if no auth
      if (!isAuthenticated) {
        toast({
          title: "Please log in",
          description: "Sign in to save your images to the gallery permanently.",
          variant: "destructive"
        });
        URL.revokeObjectURL(previewUrl); // Clean up preview URL
      } else {
        // Upload to server if authenticated
        const formData = new FormData();
        formData.append('file', file);
        if (selectedTags) {
          formData.append('tags', selectedTags);
        }
        uploadMutation.mutate(formData);
        URL.revokeObjectURL(previewUrl); // Clean up preview URL
      }
    }
    
    // Reset input
    event.target.value = '';
    setSelectedTags('');
  };

  const handleProtectImage = (image: GalleryImage, level: ProtectionLevel) => {
    if (!isLibraryImage(image)) {
      toast({
        title: 'Protection unavailable',
        description: 'Import this Catbox upload into your media library to enable protection tools.',
        variant: 'destructive'
      });
      return;
    }
    protectMutation.mutate({ imageId: image.libraryId, protectionLevel: level });
  };

  const handleQuickRepost = (image: GalleryImage) => {
    if (!isLibraryImage(image)) {
      toast({
        title: 'Quick repost unavailable',
        description: 'Quick repost only works for media library uploads.',
        variant: 'destructive'
      });
      return;
    }
    quickRepostMutation.mutate(image.libraryId);
  };

  const handleDeleteImage = (image: GalleryImage) => {
    if (!isLibraryImage(image)) {
      toast({
        title: 'Delete in Catbox',
        description: 'Remove Catbox uploads from your Catbox dashboard.',
        variant: 'destructive'
      });
      return;
    }
    deleteMutation.mutate(image.libraryId);
  };

  const handleDownloadProtected = async (image: GalleryImage) => {
    try {
      const sourceUrl = getGalleryImageUrl(image);
      if (!sourceUrl) {
        throw new Error('Missing download URL');
      }

      const response = await fetch(sourceUrl, { credentials: 'include' });
      if (!response.ok) {
        throw new Error(`Download failed with status ${response.status}`);
      }
      const blob = await response.blob();
      downloadProtectedImage(blob, image.filename);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not download image.';
      toast({
        title: 'Download failed',
        description: message,
        variant: 'destructive'
      });
    }
  };

  useEffect(() => {
    if (mediaError) {
      const message = mediaError instanceof Error ? mediaError.message : 'Unable to load media library.';
      toast({
        title: 'Failed to load media library',
        description: message,
        variant: 'destructive'
      });
    }
  }, [mediaError, toast]);

  useEffect(() => {
    if (catboxError) {
      const message = catboxError instanceof Error ? catboxError.message : 'Unable to load Catbox uploads.';
      toast({
        title: 'Failed to load Catbox uploads',
        description: message,
        variant: 'destructive'
      });
    }
  }, [catboxError, toast]);

  const galleryErrorMessage = useMemo(() => {
    if (mediaError && catboxError) {
      return 'Media library and Catbox uploads are unavailable right now.';
    }
    if (mediaError) {
      return 'Media library uploads are temporarily unavailable.';
    }
    if (catboxError) {
      return 'Catbox uploads are temporarily unavailable.';
    }
    return null;
  }, [mediaError, catboxError]);

  const normalizedFilter = selectedTags.trim().toLowerCase();

  const filteredImages = useMemo(() => {
    if (!normalizedFilter) {
      return galleryImages;
    }

    return galleryImages.filter((image) => {
      const providerLabel = isLibraryImage(image)
        ? 'media library'
        : (image.provider ?? 'catbox');
      return (
        image.filename.toLowerCase().includes(normalizedFilter) ||
        providerLabel.toLowerCase().includes(normalizedFilter)
      );
    });
  }, [galleryImages, normalizedFilter]);

  const handleImageSelection = (imageId: string) => {
    setSelectedImageId(imageId);
  };

  const handleModalOpenChange = (open: boolean) => {
    if (!open) {
      setSelectedImageId(null);
    }
  };

  const isModalOpen = selectedImageId !== null && selectedImage !== null;

  return (
    <main aria-labelledby="gallery-page-title" className="space-y-6">
      <h1 id="gallery-page-title" className="sr-only">Media gallery</h1>
      <nav aria-label="Gallery sections" className="sr-only focus-within:not-sr-only" data-testid="gallery-skip-nav">
        <a href="#gallery-upload-section" className="focus:block focus:fixed focus:z-50 focus:top-4 focus:left-4 focus:bg-background focus:p-2 focus:border focus:shadow-md">Skip to upload form</a>
        <a href="#gallery-grid-section" className="ml-4 focus:block focus:fixed focus:z-50 focus:top-4 focus:left-40 focus:bg-background focus:p-2 focus:border focus:shadow-md">Skip to gallery grid</a>
      </nav>
      {/* Upload Section */}
      <Card id="gallery-upload-section">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5" />
            Upload Images
          </CardTitle>
          <CardDescription>
            Upload and organize your photos. Images are automatically saved and can be protected.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Tags (optional)</label>
            <Input
              value={selectedTags}
              onChange={(e) => setSelectedTags(e.target.value)}
              data-testid="input-tags"
            />
          </div>
          
          <div className="border-2 border-dashed border-border rounded-lg p-6">
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileUpload}
              className="hidden"
              id="bulk-upload"
              data-testid="input-file-upload"
            />
            <label htmlFor="bulk-upload" className="cursor-pointer">
              <div className="text-center">
                <Upload className="mx-auto h-8 w-8 text-muted-foreground/70" />
                <p className="mt-2 text-sm text-muted-foreground">
                  Click to upload images or drag and drop
                </p>
                <p className="text-xs text-muted-foreground/80">
                  Supports multiple files
                </p>
              </div>
            </label>
          </div>
        </CardContent>
      </Card>

      {/* Gallery */}
      <Card id="gallery-grid-section">
        <CardHeader>
          <CardTitle>Your Image Gallery ({galleryImages.length} images)</CardTitle>
          <CardDescription>
            Manage your uploaded images, apply protection, and generate content.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {galleryErrorMessage ? (
            <div className="mb-4 rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {galleryErrorMessage}
            </div>
          ) : null}

          {galleryLoading ? (
            <div className="text-center py-8 text-muted-foreground/80">
              <Upload className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
              <p>Loading...</p>
            </div>
          ) : filteredImages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground/80">
              <Upload className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
              <p>No images yet. Upload some photos to get started!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredImages.map((image) => {
                const isLibrary = isLibraryImage(image);
                const cardTestId = isLibrary ? `image-card-${image.libraryId}` : `image-card-catbox-${image.catboxId}`;
                return (
                  <button
                    key={image.id}
                    type="button"
                    className="group relative aspect-square overflow-hidden rounded-lg border cursor-pointer hover:shadow-lg transition-shadow"
                    onClick={() => handleImageSelection(image.id)}
                    data-testid={cardTestId}
                >
                  <img
                    src={getGalleryImageUrl(image)}
                    alt={image.filename}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-foreground bg-opacity-0 group-hover:bg-opacity-20 transition-all">
                    <div className="absolute top-2 left-2 flex gap-1">
                      <Badge variant="secondary" className="text-xs">
                        {isLibraryImage(image) ? 'Media Library' : image.provider || 'Catbox'}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {formatMimeLabel(image.mime)}
                      </Badge>
                      <Badge variant="secondary" className="text-xs">
                        {Math.round(image.bytes / 1024)}KB
                      </Badge>
                    </div>
                  </div>
                </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <ImageDetailModal
        image={selectedImage}
        open={isModalOpen}
        onOpenChange={handleModalOpenChange}
        onProtect={handleProtectImage}
        onQuickRepost={handleQuickRepost}
        onDownload={handleDownloadProtected}
        onDelete={handleDeleteImage}
        isProtecting={protectMutation.isPending}
        isReposting={quickRepostMutation.isPending}
        isDeleting={deleteMutation.isPending}
      />
    </main>
  );
}
