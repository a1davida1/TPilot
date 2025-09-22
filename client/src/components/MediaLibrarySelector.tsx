import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle, ImageIcon } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface MediaAsset {
  id: number;
  filename: string;
  signedUrl?: string;
  downloadUrl?: string;
  createdAt: string;
}

interface MediaLibrarySelectorProps {
  assets: MediaAsset[];
  selectedIds: number[];
  onToggle: (id: number) => void;
  captions: Record<number, string>;
  onCaptionChange: (id: number, caption: string) => void;
  maxSelection?: number;
  isLoading?: boolean;
  showCaptions?: boolean;
}

export function MediaLibrarySelector({
  assets,
  selectedIds,
  onToggle,
  captions,
  onCaptionChange,
  maxSelection = 20,
  isLoading = false,
  showCaptions = true
}: MediaLibrarySelectorProps) {
  const { toast } = useToast();
  const selectedAssets = assets.filter((asset) => selectedIds.includes(asset.id));

  const handleToggleSelection = (assetId: number) => {
    const isSelected = selectedIds.includes(assetId);
    
    if (!isSelected && selectedIds.length >= maxSelection) {
      toast({
        title: "Maximum reached",
        description: `You can select up to ${maxSelection} images.`,
        variant: "destructive"
      });
      return;
    }
    
    onToggle(assetId);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-pink-500 border-t-transparent" />
      </div>
    );
  }

  if (assets.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 bg-gray-50 rounded-lg border border-gray-200">
        <ImageIcon className="mx-auto h-12 w-12 mb-4 opacity-50" />
        <p>No media files in your library.</p>
        <p className="text-sm">Upload some images to your media library to get started.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label>Select Media from Library {maxSelection > 1 && `(Max ${maxSelection})`}</Label>
        {selectedAssets.length > 0 && (
          <Badge variant="outline" className="text-xs">
            {selectedAssets.length} selected
          </Badge>
        )}
      </div>
      
      <div className="grid grid-cols-3 md:grid-cols-4 gap-3 p-4 border-2 border-dashed border-pink-300 rounded-lg max-h-64 overflow-y-auto">
        {assets.map((asset) => {
          const previewUrl = asset.signedUrl || asset.downloadUrl || '';
          const isSelected = selectedIds.includes(asset.id);
          
          return (
            <button
              type="button"
              key={asset.id}
              onClick={() => handleToggleSelection(asset.id)}
              className={`group relative overflow-hidden rounded-lg border-2 bg-white shadow-sm transition focus:outline-none focus:ring-2 focus:ring-pink-500 ${
                isSelected ? 'ring-2 ring-pink-500 border-pink-400' : 'hover:border-pink-300'
              }`}
              data-testid={`button-select-media-${asset.id}`}
            >
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt={asset.filename}
                  className="h-20 w-full object-cover"
                />
              ) : (
                <div className="flex h-20 items-center justify-center bg-pink-50 text-sm text-pink-600">
                  No preview
                </div>
              )}
              {isSelected && (
                <div className="absolute inset-0 bg-pink-500 bg-opacity-20 flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-pink-600" />
                </div>
              )}
            </button>
          );
        })}
      </div>
      
      {showCaptions && selectedAssets.length > 0 && (
        <div className="space-y-3">
          <Label className="text-sm font-medium">Image Captions</Label>
          <div className="space-y-2 max-h-32 overflow-y-auto">
            {selectedAssets.map((asset) => (
              <div key={asset.id} className="flex gap-2 items-center">
                <div className="w-12 h-12 flex-shrink-0">
                  <img
                    src={asset.signedUrl || asset.downloadUrl || ''}
                    alt={asset.filename}
                    className="w-full h-full object-cover rounded"
                  />
                </div>
                <div className="flex-1">
                  <Input
                    placeholder={`Caption for ${asset.filename}`}
                    value={captions[asset.id] || ''}
                    onChange={(e) => onCaptionChange(asset.id, e.target.value)}
                    className="text-sm"
                    data-testid={`input-caption-${asset.id}`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}