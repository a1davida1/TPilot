import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { downloadProtectedImage } from '@/lib/image-protection';
import { Upload, Shield, Download, Trash2, Tag, Share2 } from 'lucide-react';

interface MediaAssetResponse {
  id: number;
  filename: string;
  bytes: number;
  mime: string;
  visibility: string;
  createdAt: string | Date;
  signedUrl?: string;
  downloadUrl?: string;
  isProtected?: boolean;
  protectionLevel?: ProtectionLevel;
  lastRepostedAt?: string;
}

interface CatboxUploadResponse {
  id: number;
  url: string;
  filename: string;
  fileSize: number;
  mime: string;
  uploadedAt: string;
  provider: string;
}

interface CatboxUploadsApiResponse {
  uploads: CatboxUploadResponse[];
}

type ProtectionLevel = 'light' | 'standard' | 'heavy';

interface GalleryImageBase {
  id: string;
  filename: string;
  bytes: number;
  mime: string;
  createdAt: string;
  signedUrl?: string;
  downloadUrl?: string;
  isProtected?: boolean;
  protectionLevel?: ProtectionLevel;
  lastRepostedAt?: string;
}

interface LibraryGalleryImage extends GalleryImageBase {
  origin: 'library';
  libraryId: number;
  visibility: string;
}

interface CatboxGalleryImage extends GalleryImageBase {
  origin: 'catbox';
  catboxId: number;
  provider: string;
}

type GalleryImage = LibraryGalleryImage | CatboxGalleryImage;

function isLibraryImage(image: GalleryImage): image is LibraryGalleryImage {
  return image.origin === 'library';
}

function toIsoString(value: Date | string | null | undefined): string {
  if (!value) {
    return new Date(0).toISOString();
  }

  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? new Date(0).toISOString() : value.toISOString();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? new Date(0).toISOString() : parsed.toISOString();
}

function normalizeBytes(value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    return 0;
  }
  return Math.round(value);
}

function formatMimeLabel(mime: string): string {
  if (!mime.includes('/')) {
    return mime.toUpperCase();
  }
  const [, subtype] = mime.split('/');
  return subtype ? subtype.toUpperCase() : mime.toUpperCase();
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
                data-testid="quick-protect-button"
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
  const [selectedImageId, setSelectedImageId] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();

  // Authenticated API request - use session-based auth like the rest of the app
  const authenticatedRequest = async <T,>(url: string, method: string = 'GET', data?: unknown): Promise<T> => {
    let body: FormData | string | undefined;
    const headers: Record<string, string> = {};

    if (data instanceof FormData) {
      body = data;
      // Don't set Content-Type for FormData, browser sets it with boundary
    } else if (data) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(data);
    }

    const response = await fetch(url, {
      method,
      headers,
      body,
      credentials: 'include' // Include session cookies for authentication
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || errorText;
      } catch {
        errorMessage = errorText || response.statusText;
      }
      throw new Error(errorMessage);
    }

    if (response.status === 204) {
      return {} as T;
    }

    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return response.json() as Promise<T>;
    }

    return {} as T;
  };

  const { data: images = [] } = useQuery<UserImage[]>({
    queryKey: ['/api/media'],
    queryFn: () => authenticatedRequest<UserImage[]>('/api/media'),
    enabled: true // Always enable to avoid blocking
  });

  const selectedImage = useMemo(() => {
    if (selectedImageId === null) {
      return null;
    }
    return images.find(image => image.id === selectedImageId) ?? null;
  }, [images, selectedImageId]);

  const updateCachedImage = (imageId: number, updater: (image: UserImage) => UserImage): void => {
    queryClient.setQueryData<UserImage[]>(['/api/media'], (current) => {
      if (!current) {
        return current;
      }
      return current.map(image => (image.id === imageId ? updater(image) : image));
    });
  };

  const removeCachedImage = (imageId: number): void => {
    queryClient.setQueryData<UserImage[]>(['/api/media'], (current) => {
      if (!current) {
        return current;
      }
      return current.filter(image => image.id !== imageId);
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
      updateCachedImage(variables.imageId, (image) => ({
        ...image,
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
      updateCachedImage(imageId, (image) => ({
        ...image,
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
      removeCachedImage(imageId);
      setSelectedImageId((current) => (current === imageId ? null : current));
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

  const handleProtectImage = (image: UserImage, level: ProtectionLevel) => {
    protectMutation.mutate({ imageId: image.id, protectionLevel: level });
  };

  const handleQuickRepost = (image: UserImage) => {
    quickRepostMutation.mutate(image.id);
  };

  const handleDeleteImage = (image: UserImage) => {
    deleteMutation.mutate(image.id);
  };

  const handleDownloadProtected = async (image: UserImage) => {
    try {
      const response = await fetch(image.signedUrl || image.downloadUrl || '');
      const blob = await response.blob();
      downloadProtectedImage(blob, image.filename);
    } catch {
      toast({
        title: "Download failed",
        description: "Could not download image.",
        variant: "destructive"
      });
    }
  };

  const filteredImages = images.filter(image =>
    !selectedTags || image.filename.toLowerCase().includes(selectedTags.toLowerCase())
  );

  const handleImageSelection = (imageId: number) => {
    setSelectedImageId(imageId);
  };

  const handleModalOpenChange = (open: boolean) => {
    if (!open) {
      setSelectedImageId(null);
    }
  };

  const isModalOpen = selectedImageId !== null && selectedImage !== null;

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card>
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
      <Card>
        <CardHeader>
          <CardTitle>Your Image Gallery ({images.length} images)</CardTitle>
          <CardDescription>
            Manage your uploaded images, apply protection, and generate content.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {filteredImages.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground/80">
              <Upload className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
              <p>No images yet. Upload some photos to get started!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredImages.map((image) => (
                <button
                  key={image.id}
                  type="button"
                  className="group relative aspect-square overflow-hidden rounded-lg border cursor-pointer hover:shadow-lg transition-shadow"
                  onClick={() => handleImageSelection(image.id)}
                  data-testid={`image-card-${image.id}`}
                >
                  <img
                    src={image.signedUrl || image.downloadUrl || ''}
                    alt={image.filename}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-foreground bg-opacity-0 group-hover:bg-opacity-20 transition-all">
                    <div className="absolute bottom-2 left-2 right-2">
                      <div className="flex flex-wrap gap-1">
                        <Badge variant="secondary" className="text-xs">
                          {image.mime.split('/')[1].toUpperCase()}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {Math.round(image.bytes / 1024)}KB
                        </Badge>
                      </div>
                    </div>
                  </div>
                </button>
              ))}
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
    </div>
  );
}
