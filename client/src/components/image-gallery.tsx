import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';
import { protectImage, downloadProtectedImage } from '@/lib/image-protection';
import { Upload, Shield, Download, Trash2, Eye, Tag, Plus } from 'lucide-react';

// Import MediaAsset type from schema
import type { MediaAsset } from '@shared/schema.js';

// Extended interface for gallery display with additional properties
interface UserImage extends MediaAsset {
  signedUrl?: string;
  downloadUrl?: string;
}

export function ImageGallery() {
  const [selectedTags, setSelectedTags] = useState<string>('');
  const [selectedImage, setSelectedImage] = useState<UserImage | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAuthenticated } = useAuth();
  
  // Authenticated API request - use session-based auth like the rest of the app
  const authenticatedRequest = async (url: string, method: string = 'GET', data?: unknown) => {
    let body: FormData | string | undefined;
    const headers: { [key: string]: string } = {};
    
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
    
    return response.json();
  };

  const { data: images = [] } = useQuery<UserImage[]>({
    queryKey: ['/api/media'],
    queryFn: () => authenticatedRequest('/api/media'),
    enabled: true // Always enable to avoid blocking
  });

  const uploadMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      return authenticatedRequest('/api/media/upload', 'POST', formData);
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

  const protectMutation = useMutation({
    mutationFn: async ({ imageId, protectionLevel }: { imageId: string, protectionLevel: string }) => {
      return authenticatedRequest(`/api/protect-image/${imageId}`, 'POST', { protectionLevel });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/media'] });
      toast({
        title: "Image protected",
        description: "Your image has been protected against reverse searches."
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: async (imageId: string) => {
      return authenticatedRequest(`/api/media/${imageId}`, 'DELETE');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/media'] });
      toast({
        title: "Image deleted",
        description: "Image has been removed from your gallery."
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

  const handleProtectImage = async (image: UserImage, level: string) => {
    protectMutation.mutate({ imageId: image.id.toString(), protectionLevel: level });
  };

  const handleDownloadProtected = async (image: UserImage) => {
    try {
      const response = await fetch(image.signedUrl || image.downloadUrl || '');
      const blob = await response.blob();
      downloadProtectedImage(blob, image.filename);
    } catch (error) {
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
                <div key={image.id} className="group relative">
                  <Dialog>
                    <DialogTrigger asChild>
                      <div className="aspect-square relative overflow-hidden rounded-lg border cursor-pointer hover:shadow-lg transition-shadow">
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
                      </div>
                    </DialogTrigger>
                    
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Image Details</DialogTitle>
                        <DialogDescription>
                          {image.filename}
                        </DialogDescription>
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
                            {image.mime}
                          </Badge>
                          <Badge variant="outline">
                            {new Date(image.createdAt).toLocaleDateString()}
                          </Badge>
                        </div>
                        
                        <div className="flex gap-2 flex-wrap">
                          {
                            <>
                              <Button
                                size="sm"
                                onClick={() => handleProtectImage(image, 'light')}
                                disabled={protectMutation.isPending}
                              >
                                <Shield className="h-4 w-4 mr-1" />
                                Light Protection
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleProtectImage(image, 'standard')}
                                disabled={protectMutation.isPending}
                              >
                                <Shield className="h-4 w-4 mr-1" />
                                Standard Protection
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleProtectImage(image, 'heavy')}
                                disabled={protectMutation.isPending}
                              >
                                <Shield className="h-4 w-4 mr-1" />
                                Heavy Protection
                              </Button>
                            </>
                        }
                          
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleDownloadProtected(image)}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            Download
                          </Button>
                          
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => deleteMutation.mutate(image.id.toString())}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4 mr-1" />
                            Delete
                          </Button>
                        </div>
                        
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}