import React, { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Upload, Trash2, Download, Image, Film, Eye, Shield } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface MediaAsset {
  id: number;
  filename: string;
  size: number;
  type: string;
  visibility: string;
  hasWatermark: boolean;
  signedUrl: string;
  downloadUrl?: string;
  createdAt: string;
}

interface StorageUsage {
  usedBytes: number;
  quotaBytes: number;
  usedPercentage: number;
  assetsCount: number;
  proUpgrade?: {
    quotaBytes: number;
    features: string[];
  };
}

export default function MediaLibrary() {
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewAsset, setPreviewAsset] = useState<MediaAsset | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch media assets
  const { data: assets = [], isLoading } = useQuery({
    queryKey: ['/api/media'],
  });

  // Fetch storage usage
  const { data: usage } = useQuery({
    queryKey: ['/api/storage/usage'],
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('watermark', 'true'); // Default watermark for uploads

      // Simulate progress (in real app, track actual upload progress)
      setUploadProgress(0);
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      try {
        const response = await fetch('/api/media/upload', {
          method: 'POST',
          body: formData,
        });
        if (!response.ok) {
          throw new Error(`Upload failed: ${response.statusText}`);
        }
        const result = await response.json();
        clearInterval(progressInterval);
        setUploadProgress(100);
        setTimeout(() => setUploadProgress(0), 1000);
        return result;
      } catch (error) {
        clearInterval(progressInterval);
        setUploadProgress(0);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/media'] });
      queryClient.invalidateQueries({ queryKey: ['/api/storage/usage'] });
      toast({
        title: "Upload successful",
        description: "Your media has been uploaded and protected",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload media",
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest('DELETE', `/api/media/${id}`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/media'] });
      queryClient.invalidateQueries({ queryKey: ['/api/storage/usage'] });
      toast({
        title: "Media deleted",
        description: "The media file has been removed from your library",
      });
    },
  });

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 50 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select a file smaller than 50MB",
          variant: "destructive",
        });
        return;
      }
      uploadMutation.mutate(file);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getAssetIcon = (type: string) => {
    if (type.startsWith('image/')) return <Image className="h-4 w-4" />;
    if (type.startsWith('video/')) return <Film className="h-4 w-4" />;
    return <Image className="h-4 w-4" />;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Storage Usage */}
      {usage && (usage as any) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              Media Storage
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between text-sm">
              <span>{formatFileSize((usage as any).usedBytes || 0)} of {formatFileSize((usage as any).quotaBytes || 0)} used</span>
              <span>{(usage as any).assetsCount || 0} files</span>
            </div>
            <Progress value={(usage as any).usedPercentage || 0} className="h-2" />
            {((usage as any).usedPercentage || 0) > 80 && (
              <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                <p className="text-sm text-orange-700 dark:text-orange-300">
                  Storage is almost full. Upgrade to Pro for {formatFileSize((usage as any).proUpgrade?.quotaBytes || 0)} storage.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Upload Area */}
      <Card>
        <CardContent className="p-6">
          <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
            <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
            <h3 className="text-lg font-medium mb-2">Upload Media</h3>
            <p className="text-gray-500 mb-4">
              Images and videos up to 50MB. All uploads are automatically protected.
            </p>
            <Button 
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadMutation.isPending}
              data-testid="button-upload-media"
            >
              {uploadMutation.isPending ? 'Uploading...' : 'Choose Files'}
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,video/*"
              onChange={handleFileSelect}
              className="hidden"
            />
            {uploadProgress > 0 && (
              <div className="mt-4 max-w-sm mx-auto">
                <Progress value={uploadProgress} className="h-2" />
                <p className="text-xs text-gray-500 mt-1">{uploadProgress}% uploaded</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Media Grid */}
      <Card>
        <CardHeader>
          <CardTitle>Media Library</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-square bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              ))}
            </div>
          ) : (assets as any[])?.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Image className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p>No media files yet. Upload some to get started!</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {(assets as any[])?.map((asset: any) => (
                <div key={asset.id} className="relative group">
                  <div className="aspect-square rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800">
                    {asset.type.startsWith('image/') ? (
                      <img
                        src={asset.signedUrl}
                        alt={asset.filename}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex items-center justify-center h-full">
                        <Film className="h-8 w-8 text-gray-400" />
                      </div>
                    )}
                    
                    {/* Watermark indicator */}
                    {asset.hasWatermark && (
                      <div className="absolute top-2 right-2">
                        <Badge variant="secondary" className="text-xs">
                          <Shield className="h-3 w-3 mr-1" />
                          Protected
                        </Badge>
                      </div>
                    )}

                    {/* Hover actions */}
                    <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setPreviewAsset(asset)}
                        data-testid={`button-preview-${asset.id}`}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      {asset.downloadUrl && (
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => window.open(asset.downloadUrl, '_blank')}
                          data-testid={`button-download-${asset.id}`}
                        >
                          <Download className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => deleteMutation.mutate(asset.id)}
                        data-testid={`button-delete-${asset.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="mt-2 space-y-1">
                    <p className="text-xs font-medium truncate" title={asset.filename}>
                      {asset.filename}
                    </p>
                    <div className="flex items-center justify-between text-xs text-gray-500">
                      <span>{formatFileSize(asset.size)}</span>
                      <div className="flex items-center gap-1">
                        {getAssetIcon(asset.type)}
                        {asset.visibility === 'private' && <Shield className="h-3 w-3" />}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview Modal */}
      <Dialog open={!!previewAsset} onOpenChange={() => setPreviewAsset(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{previewAsset?.filename}</DialogTitle>
          </DialogHeader>
          {previewAsset && (
            <div className="space-y-4">
              <div className="max-h-96 overflow-hidden rounded-lg">
                {previewAsset.type.startsWith('image/') ? (
                  <img
                    src={previewAsset.signedUrl}
                    alt={previewAsset.filename}
                    className="w-full h-auto"
                  />
                ) : (
                  <video controls className="w-full">
                    <source src={previewAsset.signedUrl} type={previewAsset.type} />
                  </video>
                )}
              </div>
              
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <strong>Size:</strong> {formatFileSize(previewAsset.size)}
                </div>
                <div>
                  <strong>Type:</strong> {previewAsset.type}
                </div>
                <div>
                  <strong>Protection:</strong> {previewAsset.hasWatermark ? 'Protected' : 'None'}
                </div>
                <div>
                  <strong>Uploaded:</strong> {new Date(previewAsset.createdAt).toLocaleDateString()}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}