import { useState } from 'react';
import { Pencil, CheckCircle, Loader2, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import type { UploadedImage } from '@/components/upload/BulkUploadZone';

interface ImageLibraryGridProps {
  images: UploadedImage[];
  selectedIds: Set<string>;
  onToggleSelection: (imageId: string) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onEditCaption: (imageId: string) => void;
  onDeleteImage: (imageId: string) => void;
  columns?: 2 | 3 | 4;
  className?: string;
}

export function ImageLibraryGrid({
  images,
  selectedIds,
  onToggleSelection,
  onSelectAll,
  onDeselectAll,
  onEditCaption,
  onDeleteImage,
  columns = 3,
  className,
}: ImageLibraryGridProps) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const allSelected = images.length > 0 && images.every((img) => selectedIds.has(img.id));
  const someSelected = images.some((img) => selectedIds.has(img.id)) && !allSelected;

  const gridColsClass = {
    2: 'grid-cols-2',
    3: 'grid-cols-2 md:grid-cols-3',
    4: 'grid-cols-2 md:grid-cols-3 lg:grid-cols-4',
  }[columns];

  if (images.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 p-12 text-center">
        <p className="text-muted-foreground">No images uploaded yet</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)}>
      {/* Toolbar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Checkbox
            checked={allSelected}
            onCheckedChange={(checked) => {
              if (checked) {
                onSelectAll();
              } else {
                onDeselectAll();
              }
            }}
            className={cn(someSelected && 'data-[state=checked]:bg-primary/50')}
          />
          <span className="text-sm text-muted-foreground">
            {selectedIds.size > 0
              ? `${selectedIds.size} of ${images.length} selected`
              : `${images.length} image${images.length !== 1 ? 's' : ''}`}
          </span>
        </div>

        {selectedIds.size > 0 && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onDeselectAll}
            >
              Clear Selection
            </Button>
          </div>
        )}
      </div>

      {/* Image Grid */}
      <div className={cn('grid gap-4', gridColsClass)}>
        {images.map((image) => {
          const isSelected = selectedIds.has(image.id);
          const isHovered = hoveredId === image.id;

          return (
            <Card
              key={image.id}
              className={cn(
                'group relative overflow-hidden transition-all',
                isSelected && 'ring-2 ring-primary ring-offset-2',
                isHovered && !isSelected && 'ring-2 ring-muted ring-offset-2'
              )}
              onMouseEnter={() => setHoveredId(image.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <CardContent className="p-0">
                {/* Image Container */}
                <div className="relative aspect-square overflow-hidden bg-muted">
                  {/* Image */}
                  <img
                    src={image.url}
                    alt={image.file?.name || 'Uploaded image'}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />

                  {/* Selection Checkbox Overlay */}
                  <div className="absolute left-2 top-2">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => onToggleSelection(image.id)}
                      className="h-5 w-5 border-2 border-white bg-white/90 shadow-lg data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground"
                    />
                  </div>

                  {/* Status Badge */}
                  <div className="absolute right-2 top-2">
                    {image.status === 'uploading' && (
                      <Badge variant="secondary" className="bg-blue-500 text-white">
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        Uploading
                      </Badge>
                    )}
                    {image.status === 'success' && image.caption && (
                      <Badge variant="secondary" className="bg-green-500 text-white">
                        <CheckCircle className="mr-1 h-3 w-3" />
                        Ready
                      </Badge>
                    )}
                    {image.status === 'error' && (
                      <Badge variant="destructive">
                        Error
                      </Badge>
                    )}
                  </div>

                  {/* Action Buttons Overlay */}
                  <div
                    className={cn(
                      'absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-gradient-to-t from-black/80 to-transparent p-3 transition-opacity',
                      isHovered || isSelected ? 'opacity-100' : 'opacity-0'
                    )}
                  >
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => onEditCaption(image.id)}
                      disabled={image.status !== 'success'}
                      className="h-8 bg-white/90 text-black hover:bg-white"
                    >
                      <Pencil className="mr-1 h-3 w-3" />
                      Edit Caption
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => onDeleteImage(image.id)}
                      className="h-8"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>

                {/* Caption Preview */}
                {image.caption && (
                  <div className="p-3">
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {image.caption}
                    </p>
                  </div>
                )}

                {/* No Caption State */}
                {image.status === 'success' && !image.caption && (
                  <div className="p-3">
                    <p className="text-xs text-muted-foreground italic">
                      No caption generated
                    </p>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onEditCaption(image.id)}
                      className="mt-1 h-6 w-full text-xs"
                    >
                      Add Caption
                    </Button>
                  </div>
                )}

                {/* Generating Caption State */}
                {image.status === 'success' && !image.caption && (
                  <div className="flex items-center gap-2 p-3">
                    <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">
                      Generating caption...
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// Hook to manage image library selection
export function useImageLibrarySelection(images: UploadedImage[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleSelection = (imageId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(imageId)) {
        next.delete(imageId);
      } else {
        next.add(imageId);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(images.map((img) => img.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const getSelectedImages = () => {
    return images.filter((img) => selectedIds.has(img.id));
  };

  return {
    selectedIds,
    toggleSelection,
    selectAll,
    deselectAll,
    getSelectedImages,
  };
}
