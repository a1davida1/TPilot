import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Upload, Download, Shield, Image as ImageIcon, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { protectImage, downloadProtectedImage, protectionPresets, type ImageProcessingOptions } from '@/lib/image-protection';

export function ImageProtector() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [protectedImageUrl, setProtectedImageUrl] = useState<string | null>(null);
  const [preset, setPreset] = useState<'light' | 'standard' | 'heavy'>('standard');
  const [customSettings, setCustomSettings] = useState<ImageProcessingOptions>(protectionPresets.standard);
  const [useCustom, setUseCustom] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        setSelectedFile(file);
        setProtectedImageUrl(null);
      } else {
        toast({
          title: "Invalid file type",
          description: "Please select an image file (JPG, PNG, etc.)",
          variant: "destructive"
        });
      }
    }
  };

  const processImage = async () => {
    if (!selectedFile) return;
    
    setIsProcessing(true);
    try {
      const settings = useCustom ? customSettings : protectionPresets[preset];
      const protectedBlob = await protectImage(selectedFile, settings);
      
      // Create preview URL
      const url = URL.createObjectURL(protectedBlob);
      setProtectedImageUrl(url);
      
      toast({
        title: "Image protected successfully!",
        description: "Your image is now protected against reverse search while maintaining quality."
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
      downloadProtectedImage(blob, selectedFile.name);
      
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

  return (
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-green-600" />
          Image Protection Tool
        </CardTitle>
        <CardDescription>
          Protect your photos from reverse image searches while maintaining visual quality.
          This tool applies smart blurring, noise, and subtle modifications to make your images unsearchable.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* File Upload */}
        <div className="space-y-4">
          <Label>Upload Image</Label>
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
            <input
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              ref={fileInputRef}
              className="hidden"
            />
            {selectedFile ? (
              <div className="space-y-2">
                <ImageIcon className="mx-auto h-8 w-8 text-green-600" />
                <p className="text-sm font-medium">{selectedFile.name}</p>
                <p className="text-xs text-gray-500">
                  {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Change Image
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="mx-auto h-8 w-8 text-gray-400" />
                <Button 
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                >
                  Select Image
                </Button>
                <p className="text-xs text-gray-500">
                  JPG, PNG, or other image formats
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Protection Settings */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label>Protection Level</Label>
            <div className="flex items-center space-x-2">
              <Label htmlFor="custom-settings" className="text-sm">Custom Settings</Label>
              <Switch
                id="custom-settings"
                checked={useCustom}
                onCheckedChange={setUseCustom}
              />
            </div>
          </div>

          {!useCustom ? (
            <Select value={preset} onValueChange={(value: 'light' | 'standard' | 'heavy') => setPreset(value)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="light">Light Protection - Minimal changes, high quality</SelectItem>
                <SelectItem value="standard">Standard Protection - Balanced approach (recommended)</SelectItem>
                <SelectItem value="heavy">Heavy Protection - Maximum protection, some quality loss</SelectItem>
              </SelectContent>
            </Select>
          ) : (
            <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
              <div className="space-y-2">
                <Label className="text-sm">Blur Intensity</Label>
                <Select 
                  value={customSettings.blurIntensity} 
                  onValueChange={(value: 'subtle' | 'medium' | 'strong') => 
                    setCustomSettings(prev => ({ ...prev, blurIntensity: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="subtle">Subtle</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="strong">Strong</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm">Add Noise</Label>
                <Switch
                  checked={customSettings.addNoise}
                  onCheckedChange={(checked) => 
                    setCustomSettings(prev => ({ ...prev, addNoise: checked }))
                  }
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm">Resize: {customSettings.resizePercent}%</Label>
                <Slider
                  value={[customSettings.resizePercent]}
                  onValueChange={([value]) => 
                    setCustomSettings(prev => ({ ...prev, resizePercent: value }))
                  }
                  min={85}
                  max={115}
                  step={1}
                />
              </div>
              
              <div className="space-y-2">
                <Label className="text-sm">Crop Edges: {customSettings.cropPercent}%</Label>
                <Slider
                  value={[customSettings.cropPercent]}
                  onValueChange={([value]) => 
                    setCustomSettings(prev => ({ ...prev, cropPercent: value }))
                  }
                  min={0}
                  max={15}
                  step={1}
                />
              </div>
            </div>
          )}
        </div>

        {/* Protection Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start space-x-2">
            <AlertCircle className="h-4 w-4 text-blue-600 mt-0.5" />
            <div className="text-sm text-blue-800">
              <p className="font-medium mb-1">How it works:</p>
              <ul className="space-y-1 text-xs">
                <li>• Applies intelligent blur that preserves visual appeal</li>
                <li>• Adds subtle noise to break pixel patterns</li>
                <li>• Slightly resizes and crops to alter image signature</li>
                <li>• Removes metadata that could identify the source</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Process Button */}
        <Button
          onClick={processImage}
          disabled={!selectedFile || isProcessing}
          className="w-full"
          size="lg"
        >
          {isProcessing ? (
            "Processing Image..."
          ) : (
            <>
              <Shield className="mr-2 h-4 w-4" />
              Protect Image
            </>
          )}
        </Button>

        {/* Results */}
        {protectedImageUrl && (
          <div className="space-y-4">
            <div className="border rounded-lg p-4">
              <Label className="text-sm font-medium text-green-700 mb-2 block">
                Protected Image Preview
              </Label>
              <img
                src={protectedImageUrl}
                alt="Protected version"
                className="max-w-full h-auto rounded-lg border"
                style={{ maxHeight: '300px' }}
              />
            </div>
            
            <Button
              onClick={downloadImage}
              className="w-full"
              variant="outline"
            >
              <Download className="mr-2 h-4 w-4" />
              Download Protected Image
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}