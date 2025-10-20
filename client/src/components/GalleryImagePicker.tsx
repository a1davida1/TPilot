import { useEffect, useMemo, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { useGalleryAssets } from '@/hooks/useGalleryAssets';
import { GalleryImage, getGalleryImageUrl, isLibraryImage } from '@/lib/gallery';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

interface GalleryImagePickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (images: GalleryImage[]) => void;
  selectionMode?: 'single' | 'multiple';
  title?: string;
  description?: string;
}

function getProviderLabel(image: GalleryImage): string {
  if (isLibraryImage(image)) {
    return 'Media Library';
  }
  return image.provider || 'Catbox';
}

export function GalleryImagePicker({
  open,
  onOpenChange,
  onSelect,
  selectionMode = 'single',
  title = 'Choose from Gallery',
  description = 'Select previously uploaded images from your gallery.'
}: GalleryImagePickerProps) {
  const { toast } = useToast();
  const {
    galleryImages,
    isLoading: galleryLoading,
    mediaLoading,
    catboxLoading,
    mediaError,
    catboxError
  } = useGalleryAssets({ enabled: open, catboxLimit: 48 });
  const [query, setQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) {
      setQuery('');
      setSelectedIds(new Set());
    }
  }, [open]);

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

  useEffect(() => {
    if (selectionMode !== 'multiple') {
      return;
    }
    setSelectedIds((current) => {
      if (current.size === 0) {
        return current;
      }
      const validIds = new Set(galleryImages.map((image) => image.id));
      let changed = false;
      const next = new Set<string>();
      current.forEach((id) => {
        if (validIds.has(id)) {
          next.add(id);
        } else {
          changed = true;
        }
      });
      return changed ? next : current;
    });
  }, [galleryImages, selectionMode]);

  const normalizedQuery = query.trim().toLowerCase();
  const filteredImages = useMemo(() => {
    if (!normalizedQuery) {
      return galleryImages;
    }

    return galleryImages.filter((image) => {
      const provider = getProviderLabel(image).toLowerCase();
      return (
        image.filename.toLowerCase().includes(normalizedQuery) ||
        provider.includes(normalizedQuery)
      );
    });
  }, [galleryImages, normalizedQuery]);

  const hasPartialError = Boolean(mediaError) || Boolean(catboxError);
  const errorMessage = useMemo(() => {
    if (mediaError && catboxError) {
      return 'We could not load your media library or Catbox uploads. Try again in a moment.';
    }
    if (mediaError) {
      return 'We could not load your media library assets.';
    }
    if (catboxError) {
      return 'We could not load your Catbox uploads.';
    }
    return null;
  }, [mediaError, catboxError]);

  const toggleSelection = (imageId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(imageId)) {
        next.delete(imageId);
      } else {
        next.add(imageId);
      }
      return next;
    });
  };

  const handleImageClick = (image: GalleryImage) => {
    if (selectionMode === 'single') {
      onSelect([image]);
      onOpenChange(false);
      return;
    }
    toggleSelection(image.id);
  };

  const handleConfirm = () => {
    if (selectionMode === 'multiple') {
      const selectedImages = galleryImages.filter((image) => selectedIds.has(image.id));
      if (selectedImages.length === 0) {
        toast({
          title: 'Select at least one image',
          description: 'Choose the images you want to use before confirming.',
          variant: 'destructive'
        });
        return;
      }
      onSelect(selectedImages);
      onOpenChange(false);
    }
  };

  const renderContent = () => {
    if (galleryLoading) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" aria-hidden />
          <p>Loading gallery sources…</p>
          <p className="text-xs text-muted-foreground/80">
            {mediaLoading && catboxLoading
              ? 'Fetching media library and Catbox uploads'
              : mediaLoading
                ? 'Fetching media library uploads'
                : 'Fetching Catbox uploads'}
          </p>
        </div>
      );
    }

    if (hasPartialError && galleryImages.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
          <p className="text-sm font-medium text-destructive">Unable to load gallery</p>
          <p className="text-xs text-muted-foreground">
            Please try again later or upload a new image directly.
          </p>
        </div>
      );
    }

    if (filteredImages.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center gap-2 py-12 text-muted-foreground">
          <p>No images found.</p>
          <p className="text-xs text-muted-foreground/80">
            {normalizedQuery ? 'Try a different search term.' : 'Upload new content or refresh to sync your gallery.'}
          </p>
        </div>
      );
    }

    return (
      <div className="grid max-h-[420px] grid-cols-2 gap-4 overflow-y-auto pr-1 md:grid-cols-3 lg:grid-cols-4">
        {filteredImages.map((image) => {
          const isLibrary = isLibraryImage(image);
          const isSelected = selectedIds.has(image.id);
          const previewUrl = getGalleryImageUrl(image);
          const providerLabel = getProviderLabel(image);

          return (
            <button
              key={image.id}
              type="button"
              onClick={() => handleImageClick(image)}
              className={cn(
                'group relative aspect-square overflow-hidden rounded-lg border transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                isSelected ? 'border-primary shadow-lg' : 'border-border hover:shadow-md'
              )}
            >
              <img
                src={previewUrl}
                alt={image.filename}
                loading="lazy"
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 flex flex-col justify-between bg-gradient-to-b from-black/40 via-transparent to-black/60 p-2 opacity-0 transition-opacity group-hover:opacity-100">
                <div className="flex items-start justify-between">
                  <Badge variant="secondary" className="text-xs">
                    {providerLabel}
                  </Badge>
                  {isSelected && selectionMode === 'multiple' ? (
                    <Badge variant="default" className="text-xs">
                      Selected
                    </Badge>
                  ) : null}
                </div>
                <div>
                  <p className="truncate text-xs text-white/90">{image.filename}</p>
                  <p className="text-[10px] text-white/70">
                    {Math.round(image.bytes / 1024)}KB · {image.mime.split('/').pop()?.toUpperCase()}
                  </p>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by filename or provider…"
            autoFocus
          />

          {hasPartialError && errorMessage ? (
            <div className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {errorMessage}
            </div>
          ) : null}

          {renderContent()}
        </div>

        {selectionMode === 'multiple' ? (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirm} disabled={selectedIds.size === 0}>
              Use {selectedIds.size > 0 ? `${selectedIds.size} image${selectedIds.size > 1 ? 's' : ''}` : 'Selected'}
            </Button>
          </DialogFooter>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
