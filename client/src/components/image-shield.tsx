import { useState, useRef, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { 
  Shield, 
  Upload, 
  Download, 
  RefreshCw, 
  Eye, 
  EyeOff,
  Zap,
  Lock,
  CheckCircle,
  AlertTriangle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ImageShieldProps {
  isGuestMode?: boolean;
  userTier?: "free" | "basic" | "pro" | "premium";
}

export function ImageShield({ isGuestMode = false, userTier = "free" }: ImageShieldProps) {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [protectedImage, setProtectedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [showComparison, setShowComparison] = useState(false);
  
  // Protection settings
  const [protectionLevel, setProtectionLevel] = useState<"light" | "standard" | "heavy">("standard");
  const [blurStrength, setBlurStrength] = useState([2]);
  const [noiseLevel, setNoiseLevel] = useState([15]);
  const [colorShift, setColorShift] = useState([5]);
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { toast } = useToast();

  const protectionLevels = {
    light: { blur: 1, noise: 8, color: 2, description: "Subtle protection, maintains visual quality" },
    standard: { blur: 2, noise: 15, color: 5, description: "Balanced protection and quality" },
    heavy: { blur: 4, noise: 25, color: 10, description: "Maximum protection (Pro/Premium only)" }
  };

  const handleImageUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast({
          title: "File too large",
          description: "Please select an image under 10MB",
          variant: "destructive"
        });
        return;
      }

      const reader = new FileReader();
      reader.onload = (e) => {
        setOriginalImage(e.target?.result as string);
        setProtectedImage(null);
      };
      reader.readAsDataURL(file);
    }
  }, [toast]);

  const applyImageProtection = useCallback(async () => {
    if (!originalImage || !canvasRef.current) return;

    setIsProcessing(true);
    
    try {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context not available');

      const img = new Image();
      img.onload = () => {
        // Set canvas dimensions
        canvas.width = img.width;
        canvas.height = img.height;
        
        // Draw original image
        ctx.drawImage(img, 0, 0);
        
        // Get image data for manipulation
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Apply protection algorithms
        const settings = protectionLevels[protectionLevel];
        const actualBlur = userTier === "free" ? Math.min(settings.blur, 2) : blurStrength[0];
        const actualNoise = userTier === "free" ? Math.min(settings.noise, 15) : noiseLevel[0];
        const actualColor = userTier === "free" ? Math.min(settings.color, 5) : colorShift[0];

        // Apply noise injection
        for (let i = 0; i < data.length; i += 4) {
          const noise = (Math.random() - 0.5) * actualNoise;
          data[i] = Math.max(0, Math.min(255, data[i] + noise));     // R
          data[i + 1] = Math.max(0, Math.min(255, data[i + 1] + noise)); // G
          data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + noise)); // B
        }

        // Apply subtle color shift
        for (let i = 0; i < data.length; i += 4) {
          const shift = (Math.random() - 0.5) * actualColor;
          data[i] = Math.max(0, Math.min(255, data[i] + shift));
          data[i + 1] = Math.max(0, Math.min(255, data[i + 1] - shift));
          data[i + 2] = Math.max(0, Math.min(255, data[i + 2] + shift));
        }

        // Apply blur effect (simplified - for full blur would need convolution)
        if (actualBlur > 0) {
          ctx.filter = `blur(${actualBlur}px)`;
          ctx.drawImage(canvas, 0, 0);
          ctx.filter = 'none';
        }

        // Put processed data back
        ctx.putImageData(imageData, 0, 0);

        // Convert to data URL
        const protectedDataUrl = canvas.toDataURL('image/jpeg', 0.92);
        setProtectedImage(protectedDataUrl);

        // Strip EXIF data (already done by canvas conversion)
        toast({
          title: "Image Protected!",
          description: `Applied ${protectionLevel} protection with EXIF removal`
        });

        setIsProcessing(false);
      };

      img.src = originalImage;
    } catch (error) {
      toast({
        title: "Protection Failed",
        description: "Unable to process image",
        variant: "destructive"
      });
      setIsProcessing(false);
    }
  }, [originalImage, protectionLevel, blurStrength, noiseLevel, colorShift, userTier, toast]);

  const downloadProtected = useCallback(() => {
    if (!protectedImage) return;

    const link = document.createElement('a');
    link.download = 'protected-image.jpg';
    link.href = protectedImage;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    toast({
      title: "Download Complete",
      description: "Protected image saved to your device"
    });
  }, [protectedImage, toast]);

  const canUseAdvanced = userTier === "pro" || userTier === "premium";

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <Shield className="mr-2 h-5 w-5" />
              ImageShield - Free Protection
            </div>
            <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
              Client-Side Processing
            </Badge>
          </CardTitle>
          <CardDescription>
            Protect your images from reverse searches while maintaining visual quality. 
            Your images never leave your device - processing happens in your browser.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Upload Section */}
          <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6">
            {originalImage ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="text-center">
                    <h3 className="font-medium mb-2">Original Image</h3>
                    <img
                      src={originalImage}
                      alt="Original"
                      className="max-w-full h-auto max-h-64 mx-auto rounded-lg border"
                    />
                  </div>
                  {protectedImage && (
                    <div className="text-center">
                      <h3 className="font-medium mb-2">Protected Image</h3>
                      <img
                        src={protectedImage}
                        alt="Protected"
                        className="max-w-full h-auto max-h-64 mx-auto rounded-lg border"
                      />
                    </div>
                  )}
                </div>
                <div className="flex justify-center space-x-2">
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Change Image
                  </Button>
                  {protectedImage && (
                    <Button
                      variant="outline"
                      onClick={() => setShowComparison(!showComparison)}
                    >
                      {showComparison ? <EyeOff className="mr-2 h-4 w-4" /> : <Eye className="mr-2 h-4 w-4" />}
                      {showComparison ? "Hide" : "Compare"}
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center">
                <Upload className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-medium mb-2">Upload Image to Protect</h3>
                <p className="text-gray-500 mb-4">
                  Select an image to apply privacy protection. Processing happens locally in your browser.
                </p>
                <Button onClick={() => fileInputRef.current?.click()}>
                  <Upload className="mr-2 h-4 w-4" />
                  Choose Image
                </Button>
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />
          </div>

          {/* Settings */}
          {originalImage && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Protection Level</Label>
                <Select 
                  value={protectionLevel} 
                  onValueChange={(value: "light" | "standard" | "heavy") => {
                    if (value === "heavy" && !canUseAdvanced) {
                      toast({
                        title: "Pro Feature",
                        description: "Heavy protection requires Pro tier",
                        variant: "default"
                      });
                      return;
                    }
                    setProtectionLevel(value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select protection level" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="light">
                      Light Protection - {protectionLevels.light.description}
                    </SelectItem>
                    <SelectItem value="standard">
                      Standard Protection - {protectionLevels.standard.description}
                    </SelectItem>
                    <SelectItem value="heavy" disabled={!canUseAdvanced}>
                      Heavy Protection - {protectionLevels.heavy.description}
                      {!canUseAdvanced && <Lock className="ml-2 h-3 w-3" />}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {canUseAdvanced && (
                <div className="space-y-4 p-4 border rounded-lg">
                  <Label>Advanced Settings (Pro)</Label>
                  
                  <div className="space-y-2">
                    <Label>Blur Strength: {blurStrength[0]}px</Label>
                    <Slider
                      value={blurStrength}
                      onValueChange={setBlurStrength}
                      max={8}
                      min={0}
                      step={0.5}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Noise Level: {noiseLevel[0]}</Label>
                    <Slider
                      value={noiseLevel}
                      onValueChange={setNoiseLevel}
                      max={50}
                      min={0}
                      step={1}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Color Shift: {colorShift[0]}</Label>
                    <Slider
                      value={colorShift}
                      onValueChange={setColorShift}
                      max={20}
                      min={0}
                      step={1}
                    />
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex space-x-2">
                <Button 
                  onClick={applyImageProtection}
                  disabled={isProcessing}
                  className="flex-1"
                >
                  {isProcessing ? (
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Shield className="mr-2 h-4 w-4" />
                  )}
                  {isProcessing ? "Protecting..." : "Apply Protection"}
                </Button>

                {protectedImage && (
                  <Button onClick={downloadProtected} variant="outline">
                    <Download className="mr-2 h-4 w-4" />
                    Download
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Feature Benefits */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t">
            <div className="text-center p-3">
              <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-600" />
              <h4 className="font-medium">EXIF Removal</h4>
              <p className="text-sm text-gray-500">Strips all metadata</p>
            </div>
            <div className="text-center p-3">
              <Zap className="h-8 w-8 mx-auto mb-2 text-blue-600" />
              <h4 className="font-medium">Instant Processing</h4>
              <p className="text-sm text-gray-500">No upload required</p>
            </div>
            <div className="text-center p-3">
              <Lock className="h-8 w-8 mx-auto mb-2 text-purple-600" />
              <h4 className="font-medium">100% Private</h4>
              <p className="text-sm text-gray-500">Never leaves your device</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Hidden canvas for processing */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}