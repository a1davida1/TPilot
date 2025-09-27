import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { 
  Upload, 
  Download, 
  Shield, 
  Image as ImageIcon, 
  AlertCircle,
  CheckCircle,
  X,
  Eye,
  EyeOff,
  RefreshCw,
  Sparkles,
  Lock,
  Trash2,
  Tag,
  Crown,
  Zap,
  Plus
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { protectImage, downloadProtectedImage, protectionPresets, type ImageProcessingOptions } from '@/lib/image-protection';
import { getErrorMessage } from '@/utils/errorHelpers';

interface ImageShieldUnifiedProps {
  userTier?: 'guest' | 'free' | 'pro' | 'premium';
}

interface MediaAsset {
  id: number;
  userId: number;
  key: string;
  filename: string;
  bytes: number;
  mime: string;
  visibility: string;
  signedUrl: string;
  createdAt: string;
}

export function ImageShieldUnified({ userTier = 'guest' }: ImageShieldUnifiedProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [originalImageUrl, setOriginalImageUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [protectedImageUrl, setProtectedImageUrl] = useState<string | null>(null);
  const [preset, setPreset] = useState<'light' | 'standard' | 'heavy'>('standard');
  const [customSettings, setCustomSettings] = useState<ImageProcessingOptions>(protectionPresets.standard);
  const [useCustom, setUseCustom] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string>('');
  const [selectedImage, setSelectedImage] = useState<MediaAsset | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const isProUser = userTier === 'pro';
  const showGallery = isProUser; // Only Pro users see gallery

  // Authenticated API request helper
  const authenticatedRequest = async (url: string, method: string = 'GET', data?: unknown) => {
    let body: FormData | string | undefined;
    const headers: Record<string, string> = {};

    if (data instanceof FormData) {
      body = data;
    } else if (data) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(data);
    }

    const response = await fetch(url, {
      method,
      headers,
      body,
      credentials: 'include'
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.error || errorText;
      } catch {
        errorMessage = errorText || response.statusText;
      }
      throw new Error(errorMessage);
    }
    
    if (response.status === 204) {
      return null;
    }

    const contentType = response.headers.get('content-type');
    if (contentType?.includes('application/json')) {
      return response.json();
    }

    return null;
  };

  // Gallery functionality - only for Pro/Premium users
  const { data: galleryImages = [] } = useQuery<MediaAsset[]>({
    queryKey: ['/api/media'],
    queryFn: () => authenticatedRequest('/api/media'),
    enabled: showGallery
  });

  const uploadToGalleryMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      return authenticatedRequest('/api/media/upload', 'POST', formData);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/media'] });
      toast({
        title: "Image uploaded to gallery",
        description: "Your image has been saved and is ready for protection."
      });
    },
    onError: (error: unknown) => {
      toast({
        title: "Upload failed",
        description: getErrorMessage(error) || "Failed to upload image to gallery.",
        variant: "destructive"
      });
    }
  });

  const deleteImageMutation = useMutation({
    mutationFn: async (imageId: number) => {
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

  // ImageShield protection functionality
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleGalleryUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append('file', file);
      // Apply watermark for free users
      formData.append('watermark', (!isProUser).toString());
      
      uploadToGalleryMutation.mutate(formData);
    }
    
    // Reset input
    event.target.value = '';
  };

  const processFile = (file: File) => {
    if (file.type.startsWith('image/')) {
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setOriginalImageUrl(url);
      setProtectedImageUrl(null);
      setShowComparison(false);
      
      toast({
        title: "Image uploaded successfully",
        description: `${file.name} is ready for protection`
      });
    } else {
      toast({
        title: "Invalid file type",
        description: "Please select an image file (JPG, PNG, etc.)",
        variant: "destructive"
      });
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const processImage = async () => {
    if (!selectedFile) return;
    
    setIsProcessing(true);
    try {
      const settings = useCustom ? customSettings : protectionPresets[preset];
      // Apply watermark for free users (Pro/Premium users get watermark-free)
      const shouldAddWatermark = !isProUser;
      const protectedBlob = await protectImage(selectedFile, settings, shouldAddWatermark);
      
      // Create preview URL
      const url = URL.createObjectURL(protectedBlob);
      setProtectedImageUrl(url);
      setShowComparison(true);
      
      const successMessage = shouldAddWatermark 
        ? "Your image is now protected! Upgrade to Pro to remove watermarks."
        : "Your image is now protected against reverse search with no watermarks!";
      
      toast({
        title: "Image protected successfully!",
        description: successMessage,
        action: (
          <Button 
            size="sm" 
            variant="outline"
            onClick={() => downloadImage()}
          >
            <Download className="h-3 w-3 mr-1" />
            Download
          </Button>
        )
      });
    } catch (error) {
      toast({
        title: "Processing failed",
        description: "Failed to process the image. Please try again.",
        variant: "destructive"
      });
      console.error('Image processing error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadImage = async () => {
    if (!selectedFile || !protectedImageUrl) return;
    
    try {
      const response = await fetch(protectedImageUrl);
      const blob = await response.blob();
      const timestamp = new Date().toISOString().slice(0, 10);
      const filename = `protected_${timestamp}_${selectedFile.name}`;
      downloadProtectedImage(blob, filename);
      
      toast({
        title: "Download started",
        description: "Your protected image is downloading..."
      });
    } catch (error) {
      toast({
        title: "Download failed",
        description: "Failed to download the image. Please try again.",
        variant: "destructive"
      });
    }
  };

  const resetAll = () => {
    setSelectedFile(null);
    setOriginalImageUrl(null);
    setProtectedImageUrl(null);
    setShowComparison(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto space-y-6">
      {/* Header Card */}
      <Card className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-500/20">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-1 flex-1">
              <CardTitle className="flex items-center gap-2 text-2xl">
                <Shield className="h-6 w-6 text-purple-600" />
                ImageShield™ Protection {showGallery && '& Gallery'}
              </CardTitle>
              <CardDescription className="text-base">
                {showGallery 
                  ? "Upload, organize, and protect your photos. Pro users get gallery access and watermark-free protection."
                  : "Protect your photos from reverse image searches while maintaining visual quality."
                }
              </CardDescription>
            </div>
            <div className="ml-4">
              {!isProUser ? (
                <Badge variant="outline" className="border-orange-500 text-orange-600 px-3 py-1">
                  <Lock className="h-3 w-3 mr-1" />
                  Free Tier - Watermarks Applied
                </Badge>
              ) : (
                <Badge className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-3 py-1">
                  <Crown className="h-3 w-3 mr-1" />
                  Pro Tier - Full Access
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Tab Layout */}
      <Tabs defaultValue="protect" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="protect">
            <Shield className="h-4 w-4 mr-2" />
            Image Protection
          </TabsTrigger>
          <TabsTrigger value="gallery" disabled={!showGallery}>
            <ImageIcon className="h-4 w-4 mr-2" />
            {showGallery ? 'Image Gallery' : 'Gallery (Pro Only)'}
          </TabsTrigger>
        </TabsList>
        
        {/* Image Protection Tab */}
        <TabsContent value="protect" className="mt-6">
          <div className="grid md:grid-cols-2 gap-6">
            {/* Left Column - Upload & Settings */}
            <div className="space-y-6">
              {/* Upload Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center justify-between">
                    <span>Upload Image</span>
                    {selectedFile && (
                      <Button 
                        size="sm" 
                        variant="ghost"
                        onClick={resetAll}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Clear
                      </Button>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div 
                    className={`border-2 border-dashed rounded-lg p-8 text-center transition-all ${
                      dragActive 
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/20' 
                        : 'border-gray-300 dark:border-gray-700 hover:border-purple-400'
                    }`}
                    onDragEnter={handleDrag}
                    onDragLeave={handleDrag}
                    onDragOver={handleDrag}
                    onDrop={handleDrop}
                  >
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleFileSelect}
                      ref={fileInputRef}
                      className="hidden"
                      data-testid="file-input-protect"
                    />
                    
                    {selectedFile ? (
                      <div className="space-y-4">
                        <CheckCircle className="mx-auto h-12 w-12 text-green-500" />
                        <div>
                          <p className="font-medium text-lg">{selectedFile.name}</p>
                          <p className="text-sm text-gray-500">
                            {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        <Button 
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                          data-testid="button-change-image"
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          Change Image
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="mx-auto h-12 w-12 text-gray-400">
                          <Upload className="h-12 w-12" />
                        </div>
                        <div>
                          <p className="text-lg font-medium">
                            Drag & Drop or Click to Upload
                          </p>
                          <p className="text-sm text-gray-500 mt-1">
                            Supports JPG, PNG, WebP, and other formats
                          </p>
                        </div>
                        <Button 
                          onClick={() => fileInputRef.current?.click()}
                          className="bg-purple-600 hover:bg-purple-700"
                          data-testid="button-select-image"
                        >
                          <Upload className="h-4 w-4 mr-2" />
                          Select Image
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Protection Settings */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center justify-between">
                    Protection Settings
                    <Badge variant={useCustom ? "secondary" : "default"}>
                      {useCustom ? "Custom" : "Preset"}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label>Use Custom Settings</Label>
                    <Switch
                      checked={useCustom}
                      onCheckedChange={setUseCustom}
                      data-testid="switch-custom-settings"
                    />
                  </div>

                  {!useCustom ? (
                    <div className="space-y-4">
                      <Select value={preset} onValueChange={(value: 'light' | 'standard' | 'heavy') => setPreset(value)}>
                        <SelectTrigger data-testid="select-protection-preset">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="light">
                            <div className="flex items-center">
                              <Sparkles className="h-4 w-4 mr-2 text-yellow-500" />
                              Light Protection - Minimal changes
                            </div>
                          </SelectItem>
                          <SelectItem value="standard">
                            <div className="flex items-center">
                              <Shield className="h-4 w-4 mr-2 text-blue-500" />
                              Standard Protection - Recommended
                            </div>
                          </SelectItem>
                          <SelectItem value="heavy">
                            <div className="flex items-center">
                              <Lock className="h-4 w-4 mr-2 text-red-500" />
                              Heavy Protection - Maximum security
                            </div>
                          </SelectItem>
                        </SelectContent>
                      </Select>

                      <Alert>
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription>
                          {preset === 'light' && "Light protection adds subtle changes that won't affect visual quality."}
                          {preset === 'standard' && "Standard protection balances security with image quality."}
                          {preset === 'heavy' && "Heavy protection provides maximum security but may slightly reduce quality."}
                        </AlertDescription>
                      </Alert>
                    </div>
                  ) : (
                    <div className="space-y-4 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                      <div className="space-y-2">
                        <Label className="text-sm">Blur Intensity: {customSettings.blurIntensity || 1}px</Label>
                        <Slider
                          value={[customSettings.blurIntensity || 1]}
                          onValueChange={([value]) => 
                            setCustomSettings(prev => ({ ...prev, blurIntensity: value }))
                          }
                          min={0}
                          max={3}
                          step={0.5}
                          data-testid="slider-blur-intensity"
                        />
                      </div>
                      
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Add Noise</Label>
                        <Switch
                          checked={customSettings.addNoise || false}
                          onCheckedChange={(checked) => 
                            setCustomSettings(prev => ({ ...prev, addNoise: checked }))
                          }
                          data-testid="switch-add-noise"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-sm">Resize: {customSettings.resizePercent || 90}%</Label>
                        <Slider
                          value={[customSettings.resizePercent || 90]}
                          onValueChange={([value]) => 
                            setCustomSettings(prev => ({ ...prev, resizePercent: value }))
                          }
                          min={85}
                          max={115}
                          step={1}
                          data-testid="slider-resize-percent"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-sm">Crop Edges: {customSettings.cropPercent || 0}%</Label>
                        <Slider
                          value={[customSettings.cropPercent || 0]}
                          onValueChange={([value]) => 
                            setCustomSettings(prev => ({ ...prev, cropPercent: value }))
                          }
                          min={0}
                          max={15}
                          step={1}
                          data-testid="slider-crop-percent"
                        />
                      </div>
                    </div>
                  )}

                  {/* Process Button */}
                  <Button
                    onClick={processImage}
                    disabled={!selectedFile || isProcessing}
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                    size="lg"
                    data-testid="button-protect-image"
                  >
                    {isProcessing ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Processing Image...
                      </>
                    ) : (
                      <>
                        <Shield className="mr-2 h-4 w-4" />
                        Protect Image
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Preview & Results */}
            <div className="space-y-6">
              {originalImageUrl && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">
                      {protectedImageUrl ? 'Image Comparison' : 'Original Image'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {protectedImageUrl ? (
                      <Tabs defaultValue="protected" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                          <TabsTrigger value="original">
                            <Eye className="h-4 w-4 mr-2" />
                            Original
                          </TabsTrigger>
                          <TabsTrigger value="protected">
                            <Shield className="h-4 w-4 mr-2" />
                            Protected
                          </TabsTrigger>
                        </TabsList>
                        <TabsContent value="original" className="mt-4">
                          <img
                            src={originalImageUrl}
                            alt="Original"
                            className="w-full h-auto rounded-lg border"
                            style={{ maxHeight: '400px', objectFit: 'contain' }}
                            data-testid="img-original"
                          />
                        </TabsContent>
                        <TabsContent value="protected" className="mt-4">
                          <img
                            src={protectedImageUrl}
                            alt="Protected"
                            className="w-full h-auto rounded-lg border"
                            style={{ maxHeight: '400px', objectFit: 'contain' }}
                            data-testid="img-protected"
                          />
                        </TabsContent>
                      </Tabs>
                    ) : (
                      <img
                        src={originalImageUrl}
                        alt="Original"
                        className="w-full h-auto rounded-lg border"
                        style={{ maxHeight: '400px', objectFit: 'contain' }}
                        data-testid="img-preview"
                      />
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Download Section */}
              {protectedImageUrl && (
                <Card className="bg-green-50 dark:bg-green-950/20 border-green-500/20">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center text-green-700 dark:text-green-400">
                      <CheckCircle className="h-5 w-5 mr-2" />
                      Protection Complete!
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Your image has been successfully protected and is ready for download.
                    </p>
                    <Button
                      onClick={downloadImage}
                      className="w-full bg-green-600 hover:bg-green-700"
                      size="lg"
                      data-testid="button-download-protected"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download Protected Image
                    </Button>
                    <div className="text-xs text-gray-500 space-y-1">
                      <p>✓ Metadata removed</p>
                      <p>✓ Reverse search protection applied</p>
                      <p>✓ Visual quality maintained</p>
                      {!isProUser && <p>• Watermark applied (upgrade to Pro to remove)</p>}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Info Card */}
              {!originalImageUrl && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center">
                      <AlertCircle className="h-5 w-5 mr-2 text-blue-500" />
                      How It Works
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex items-start space-x-2">
                      <span className="text-purple-600 font-bold">1.</span>
                      <p>Upload your image using drag & drop or click to browse</p>
                    </div>
                    <div className="flex items-start space-x-2">
                      <span className="text-purple-600 font-bold">2.</span>
                      <p>Choose protection level (Light, Standard, or Heavy)</p>
                    </div>
                    <div className="flex items-start space-x-2">
                      <span className="text-purple-600 font-bold">3.</span>
                      <p>Click "Protect Image" to apply anti-reverse search algorithms</p>
                    </div>
                    <div className="flex items-start space-x-2">
                      <span className="text-purple-600 font-bold">4.</span>
                      <p>Download your protected image - safe from reverse searches!</p>
                    </div>
                    
                    <Alert className="mt-4">
                      <Shield className="h-4 w-4" />
                      <AlertDescription>
                        Our protection technology adds invisible modifications that prevent reverse image searches 
                        while keeping your photos looking perfect.
                      </AlertDescription>
                    </Alert>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        </TabsContent>

        {/* Image Gallery Tab - Pro/Premium Only */}
        <TabsContent value="gallery" className="mt-6">
          {showGallery ? (
            <div className="space-y-6">
              {/* Upload to Gallery Section */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Upload className="h-5 w-5" />
                    Upload to Gallery
                  </CardTitle>
                  <CardDescription>
                    Upload and organize your photos. Images are automatically saved to your gallery.
                    {!isProUser && " Watermarks are applied for free users."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleGalleryUpload}
                      className="hidden"
                      id="gallery-upload"
                      ref={galleryInputRef}
                      data-testid="file-input-gallery"
                    />
                    <label htmlFor="gallery-upload" className="cursor-pointer">
                      <div className="text-center">
                        <Upload className="mx-auto h-8 w-8 text-gray-400" />
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

              {/* Gallery Grid */}
              <Card>
                <CardHeader>
                  <CardTitle>Your Image Gallery ({galleryImages.length} images)</CardTitle>
                  <CardDescription>
                    Manage your uploaded images and apply additional protection.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {galleryImages.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <ImageIcon className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                      <p>No images yet. Upload some photos to get started!</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {galleryImages.map((image) => (
                        <div key={image.id} className="group relative" data-testid={`gallery-image-${image.id}`}>
                          <Dialog>
                            <DialogTrigger asChild>
                              <div className="aspect-square relative overflow-hidden rounded-lg border cursor-pointer hover:shadow-lg transition-shadow">
                                <img
                                  src={image.signedUrl}
                                  alt={image.filename}
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-20 transition-all">
                                  <div className="absolute bottom-2 left-2 right-2">
                                    <Badge variant="secondary" className="text-xs">
                                      {image.filename}
                                    </Badge>
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
                                  src={image.signedUrl}
                                  alt={image.filename}
                                  className="w-full max-h-96 object-contain rounded-lg"
                                />
                                
                                <div className="flex gap-2 flex-wrap">
                                  <Button
                                    size="sm"
                                    variant="destructive"
                                    onClick={() => deleteImageMutation.mutate(image.id)}
                                    disabled={deleteImageMutation.isPending}
                                    data-testid={`button-delete-${image.id}`}
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
          ) : (
            <Card>
              <CardContent className="text-center py-12">
                <Crown className="mx-auto h-16 w-16 text-gray-300 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Gallery Access - Pro Feature</h3>
                <p className="text-gray-600 mb-4">
                  Upgrade to Pro or Premium to access the image gallery and manage your uploads.
                </p>
                <Button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
                  <Zap className="h-4 w-4 mr-2" />
                  Upgrade to Pro
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}