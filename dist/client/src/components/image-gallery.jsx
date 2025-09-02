import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { downloadProtectedImage } from '@/lib/image-protection';
import { Upload, Shield, Download, Trash2, Tag } from 'lucide-react';
export function ImageGallery() {
    const [selectedTags, setSelectedTags] = useState('');
    const [selectedImage, setSelectedImage] = useState(null);
    const { toast } = useToast();
    const queryClient = useQueryClient();
    const { token } = useAuth();
    // Authenticated API request with JWT token
    const authenticatedRequest = async (url, method = 'GET', data) => {
        let body;
        const authToken = localStorage.getItem('authToken');
        const headers = {};
        if (authToken) {
            headers['Authorization'] = `Bearer ${authToken}`;
        }
        if (data instanceof FormData) {
            body = data;
            // Don't set Content-Type for FormData, browser sets it with boundary
        }
        else if (data) {
            headers['Content-Type'] = 'application/json';
            body = JSON.stringify(data);
        }
        const response = await fetch(url, {
            method,
            headers,
            body
        });
        if (!response.ok) {
            const errorText = await response.text();
            let errorMessage;
            try {
                const errorJson = JSON.parse(errorText);
                errorMessage = errorJson.message || errorText;
            }
            catch {
                errorMessage = errorText || response.statusText;
            }
            throw new Error(errorMessage);
        }
        return response.json();
    };
    const { data: images = [] } = useQuery({
        queryKey: ['/api/media'],
        queryFn: () => authenticatedRequest('/api/media'),
        enabled: true // Always enable to avoid blocking
    });
    const uploadMutation = useMutation({
        mutationFn: async (formData) => {
            return authenticatedRequest('/api/media/upload', 'POST', formData);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['/api/media'] });
            toast({
                title: "Image uploaded",
                description: "Your image has been saved to your gallery."
            });
        },
        onError: (error) => {
            toast({
                title: "Upload failed",
                description: error.message || "Failed to upload image.",
                variant: "destructive"
            });
        }
    });
    const protectMutation = useMutation({
        mutationFn: async ({ imageId, protectionLevel }) => {
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
        mutationFn: async (imageId) => {
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
    const handleFileUpload = async (event) => {
        const files = event.target.files;
        if (!files || files.length === 0)
            return;
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
            if (!localStorage.getItem('authToken')) {
                // Store in local state for demo purposes
                const localImage = {
                    id: Date.now().toString(),
                    originalUrl: previewUrl,
                    originalFileName: file.name,
                    tags: selectedTags ? selectedTags.split(',').map(t => t.trim()) : [],
                    isProtected: false,
                    uploadedAt: new Date().toISOString()
                };
                // Store in localStorage for persistence
                const storedImages = JSON.parse(localStorage.getItem('localImages') || '[]');
                storedImages.push(localImage);
                localStorage.setItem('localImages', JSON.stringify(storedImages));
                toast({
                    title: "Image ready!",
                    description: `${file.name} has been added to your gallery.`
                });
            }
            else {
                // Try server upload if authenticated
                const formData = new FormData();
                formData.append('file', file);
                if (selectedTags) {
                    formData.append('tags', selectedTags);
                }
                uploadMutation.mutate(formData);
            }
        }
        // Reset input
        event.target.value = '';
        setSelectedTags('');
    };
    const handleProtectImage = async (image, level) => {
        protectMutation.mutate({ imageId: image.id, protectionLevel: level });
    };
    const handleDownloadProtected = async (image) => {
        if (!image.protectedUrl)
            return;
        try {
            const response = await fetch(image.protectedUrl);
            const blob = await response.blob();
            downloadProtectedImage(blob, image.originalFileName);
        }
        catch (error) {
            toast({
                title: "Download failed",
                description: "Could not download protected image.",
                variant: "destructive"
            });
        }
    };
    const filteredImages = images.filter(image => !selectedTags || image.tags?.some((tag) => tag.toLowerCase().includes(selectedTags.toLowerCase())));
    return (<div className="space-y-6">
      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5"/>
            Upload Images
          </CardTitle>
          <CardDescription>
            Upload and organize your photos. Images are automatically saved and can be protected.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Tags (optional)</label>
            <Input placeholder="e.g., selfie, outfit, workout" value={selectedTags} onChange={(e) => setSelectedTags(e.target.value)}/>
          </div>
          
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
            <input type="file" accept="image/*" multiple onChange={handleFileUpload} className="hidden" id="bulk-upload"/>
            <label htmlFor="bulk-upload" className="cursor-pointer">
              <div className="text-center">
                <Upload className="mx-auto h-8 w-8 text-gray-400"/>
                <p className="mt-2 text-sm text-gray-600">
                  Click to upload images or drag and drop
                </p>
                <p className="text-xs text-gray-500">
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
          {filteredImages.length === 0 ? (<div className="text-center py-8 text-gray-500">
              <Upload className="mx-auto h-12 w-12 text-gray-300 mb-4"/>
              <p>No images yet. Upload some photos to get started!</p>
            </div>) : (<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredImages.map((image) => (<div key={image.id} className="group relative">
                  <Dialog>
                    <DialogTrigger asChild>
                      <div className="aspect-square relative overflow-hidden rounded-lg border cursor-pointer hover:shadow-lg transition-shadow">
                        <img src={image.originalUrl} alt={image.originalFileName} className="w-full h-full object-cover"/>
                        {image.isProtected && (<Shield className="absolute top-2 right-2 h-4 w-4 text-green-600 bg-white rounded-full p-0.5"/>)}
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all">
                          <div className="absolute bottom-2 left-2 right-2">
                            <div className="flex flex-wrap gap-1">
                              {image.tags?.slice(0, 2).map((tag) => (<Badge key={tag} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>))}
                              {(image.tags?.length || 0) > 2 && (<Badge variant="secondary" className="text-xs">
                                  +{(image.tags?.length || 0) - 2}
                                </Badge>)}
                            </div>
                          </div>
                        </div>
                      </div>
                    </DialogTrigger>
                    
                    <DialogContent className="max-w-2xl">
                      <DialogHeader>
                        <DialogTitle>Image Details</DialogTitle>
                        <DialogDescription>
                          {image.originalFileName}
                        </DialogDescription>
                      </DialogHeader>
                      
                      <div className="space-y-4">
                        <img src={image.originalUrl} alt={image.originalFileName} className="w-full max-h-96 object-contain rounded-lg"/>
                        
                        <div className="flex flex-wrap gap-2">
                          {image.tags?.map((tag) => (<Badge key={tag} variant="outline">
                              <Tag className="h-3 w-3 mr-1"/>
                              {tag}
                            </Badge>))}
                        </div>
                        
                        <div className="flex gap-2 flex-wrap">
                          {!image.isProtected && (<>
                              <Button size="sm" onClick={() => handleProtectImage(image, 'light')} disabled={protectMutation.isPending}>
                                <Shield className="h-4 w-4 mr-1"/>
                                Light Protection
                              </Button>
                              <Button size="sm" onClick={() => handleProtectImage(image, 'standard')} disabled={protectMutation.isPending}>
                                <Shield className="h-4 w-4 mr-1"/>
                                Standard Protection
                              </Button>
                              <Button size="sm" onClick={() => handleProtectImage(image, 'heavy')} disabled={protectMutation.isPending}>
                                <Shield className="h-4 w-4 mr-1"/>
                                Heavy Protection
                              </Button>
                            </>)}
                          
                          {image.protectedUrl && (<Button size="sm" variant="outline" onClick={() => handleDownloadProtected(image)}>
                              <Download className="h-4 w-4 mr-1"/>
                              Download Protected
                            </Button>)}
                          
                          <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate(image.id)} disabled={deleteMutation.isPending}>
                            <Trash2 className="h-4 w-4 mr-1"/>
                            Delete
                          </Button>
                        </div>
                        
                        {image.isProtected && (<div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                            <p className="text-sm text-green-800 font-medium">
                              ✓ This image is protected against reverse searches
                            </p>
                            <p className="text-xs text-green-600 mt-1">
                              Protection level: {image.protectionSettings?.level || 'standard'}
                            </p>
                          </div>)}
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>))}
            </div>)}
        </CardContent>
      </Card>
    </div>);
}
