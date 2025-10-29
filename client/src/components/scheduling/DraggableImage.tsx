import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Calendar, CheckCircle, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { UploadedImage } from '@/components/upload/BulkUploadZone';

interface DraggableImageProps {
  image: UploadedImage;
  disabled?: boolean;
  showCaption?: boolean;
  className?: string;
}

export function DraggableImage({
  image,
  disabled = false,
  showCaption = true,
  className,
}: DraggableImageProps) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: image.id,
    disabled: disabled || image.status !== 'success',
    data: {
      image,
    },
  });

  const style = transform
    ? {
        transform: CSS.Translate.toString(transform),
      }
    : undefined;

  const canDrag = !disabled && image.status === 'success';

  return (
    <Card
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative overflow-hidden transition-all',
        isDragging && 'opacity-50 ring-2 ring-primary',
        canDrag && 'cursor-grab active:cursor-grabbing',
        !canDrag && 'opacity-60',
        className
      )}
    >
      <CardContent className="p-0">
        {/* Drag Handle */}
        {canDrag && (
          <div
            {...listeners}
            {...attributes}
            className="absolute left-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-md bg-black/50 text-white backdrop-blur-sm transition-colors hover:bg-black/70"
          >
            <GripVertical className="h-4 w-4" />
          </div>
        )}

        {/* Status Badge */}
        <div className="absolute right-2 top-2 z-10">
          {image.status === 'uploading' && (
            <Badge variant="secondary" className="bg-blue-500 text-white">
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              Uploading
            </Badge>
          )}
          {image.status === 'success' && !image.caption && (
            <Badge variant="secondary" className="bg-yellow-500 text-white">
              <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              Generating
            </Badge>
          )}
          {image.status === 'success' && image.caption && (
            <Badge variant="secondary" className="bg-green-500 text-white">
              <CheckCircle className="mr-1 h-3 w-3" />
              Ready
            </Badge>
          )}
          {image.status === 'error' && (
            <Badge variant="destructive">Error</Badge>
          )}
        </div>

        {/* Image */}
        <div className="relative aspect-square overflow-hidden bg-muted">
          <img
            src={image.url}
            alt={image.file?.name || 'Uploaded image'}
            className="h-full w-full object-cover"
          />

          {/* Drag Overlay */}
          {isDragging && (
            <div className="absolute inset-0 flex items-center justify-center bg-primary/20 backdrop-blur-sm">
              <Calendar className="h-12 w-12 text-primary" />
            </div>
          )}

          {/* Disabled Overlay */}
          {!canDrag && image.status !== 'uploading' && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <p className="text-sm text-white">
                {image.status === 'error' ? 'Upload failed' : 'Processing...'}
              </p>
            </div>
          )}
        </div>

        {/* Caption Preview */}
        {showCaption && image.caption && (
          <div className="p-3">
            <p className="line-clamp-2 text-xs text-muted-foreground">
              {image.caption}
            </p>
          </div>
        )}

        {/* Drag Hint */}
        {canDrag && !isDragging && (
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-2 text-center opacity-0 transition-opacity hover:opacity-100">
            <p className="text-xs text-white">
              Drag to calendar to schedule
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Ghost preview component shown while dragging
export function DragOverlay({ image }: { image: UploadedImage }) {
  return (
    <Card className="w-48 rotate-3 shadow-2xl">
      <CardContent className="p-0">
        <div className="relative aspect-square overflow-hidden bg-muted">
          <img
            src={image.url}
            alt={image.file?.name || 'Dragging image'}
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 flex items-center justify-center bg-primary/20 backdrop-blur-sm">
            <Calendar className="h-12 w-12 text-primary" />
          </div>
        </div>
        {image.caption && (
          <div className="p-2">
            <p className="line-clamp-1 text-xs text-muted-foreground">
              {image.caption}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
