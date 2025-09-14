import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Brain, 
  Camera, 
  FileText, 
  Sparkles, 
  Upload, 
  Zap,
  Lock,
  Crown,
  ArrowRight,
  RefreshCw,
  Copy,
  Check,
  Wand2,
  UserCheck,
  LogIn
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import type { ContentGeneration } from "@shared/schema.js";
import { GenerationHistory } from "./generation-history";
import { AuthModal } from "./auth-modal";
import { protectImage, protectionPresets, downloadProtectedImage } from "@/lib/image-protection";

// Assuming ThemeToggle and other necessary components/hooks are imported correctly.
// For example: import ThemeToggle from "@/components/ThemeToggle";

// In a real app, these would be imported or defined elsewhere.
const photoTypes = [
  { id: 'realistic', label: 'Realistic', emoji: '📸' },
  { id: 'artistic', label: 'Artistic', emoji: '🎨' },
];
const textTones = [
  { id: 'playful', label: 'Playful', emoji: '😜' },
  { id: 'sensual', label: 'Sensual', emoji: '💋' },
  { id: 'elegant', label: 'Elegant', emoji: '👑' },
  { id: 'casual', label: 'Casual', emoji: '😊' },
];
const availableHashtags = ['#model', '#photography', '#fashion', '#lifestyle', '#beauty', '#art', '#portrait', '#creative', '#outfit', '#style'];

// Extended interface for frontend display with dynamic server properties
interface GeneratedContentDisplay extends Omit<ContentGeneration, 'photoInstructions'> {
  aiProvider?: string;
  estimatedCost?: number;
  upgradeMessage?: string;
  userTier?: string;
  variationCount?: number;
  apiStatus?: string;
  contentSource?: string;
  quotaExceeded?: boolean;
  titles: string[]; // Ensure titles is always an array
  photoInstructions: {
    lighting: string;
    cameraAngle: string;
    composition: string;
    styling: string;
    mood: string;
    technicalSettings: string;
  }; // Match the exact schema type
}

interface UnifiedContentCreatorProps {
  onContentGenerated: (generation: ContentGeneration) => void;
  isGuestMode?: boolean;
  userTier?: "free" | "starter" | "pro";
}

export function UnifiedContentCreator({ 
  onContentGenerated, 
  isGuestMode = false,
  userTier = "free" 
}: UnifiedContentCreatorProps) {
  const [workflowMode, setWorkflowMode] = useState<'text' | 'image' | 'presets' | 'history'>('presets');
  const [customPrompt, setCustomPrompt] = useState("");
  const [platform, setPlatform] = useState("reddit");
  const [subreddit, setSubreddit] = useState("");
  const [allowsPromotion, setAllowsPromotion] = useState("moderate");
  const [useAdvancedSettings, setUseAdvancedSettings] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState("auto");
  const [showAuthModal, setShowAuthModal] = useState(false);

  // State for photo types and text tones
  const [selectedPhotoType, setSelectedPhotoType] = useState(photoTypes[0].id);
  const [selectedTextTone, setSelectedTextTone] = useState(textTones[0].id);
  const [selectedHashtags, setSelectedHashtags] = useState<string[]>([]);

  // Image workflow states
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // ImageShield protection states
  const [autoProtect, setAutoProtect] = useState(false);
  const [protectionLevel, setProtectionLevel] = useState<'light' | 'standard' | 'heavy'>('standard');
  const [protectedImageUrl, setProtectedImageUrl] = useState<string | null>(null);
  const [showProtectionComparison, setShowProtectionComparison] = useState(false);

  // Output display states
  const [generatedContent, setGeneratedContent] = useState<GeneratedContentDisplay | null>(null);
  const [copiedItem, setCopiedItem] = useState<string | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAuthenticated, user } = useAuth();

  const canUseImageWorkflow = true; // Image workflow available for all users

  // Preset style definitions
  const contentPresets = [
    {
      id: 'nude-photos',
      title: 'Nude Photos',
      icon: '🔥',
      prompt: 'Confident and natural nude photo content with artistic flair',
      description: 'Tasteful nude photography content',
      color: 'bg-red-100 hover:bg-red-200 text-red-800 border-red-300'
    },
    {
      id: 'shower-content',
      title: 'Shower Scene',
      icon: '🚿',
      prompt: 'Steamy shower content with water droplets and sultry mood',
      description: 'Sensual shower photography',
      color: 'bg-blue-100 hover:bg-blue-200 text-blue-800 border-blue-300'
    },
    {
      id: 'workout-clothes',
      title: 'Workout Gear',
      icon: '💪',
      prompt: 'Athletic and fit workout clothes content showing strength and curves',
      description: 'Fitness and athletic wear',
      color: 'bg-green-100 hover:bg-green-200 text-green-800 border-green-300'
    },
    {
      id: 'lingerie',
      title: 'Lingerie',
      icon: '👙',
      prompt: 'Elegant lingerie content with sophisticated and alluring appeal',
      description: 'Beautiful lingerie photography',
      color: 'bg-pink-100 hover:bg-pink-200 text-pink-800 border-pink-300'
    },
    {
      id: 'casual-tease',
      title: 'Casual Tease',
      icon: '😉',
      prompt: 'Playful and casual teasing content with everyday charm',
      description: 'Everyday casual content',
      color: 'bg-purple-100 hover:bg-purple-200 text-purple-800 border-purple-300'
    },
    {
      id: 'bedroom-scene',
      title: 'Bedroom Scene',
      icon: '🛏️',
      prompt: 'Intimate bedroom content with cozy and inviting atmosphere',
      description: 'Bedroom photography',
      color: 'bg-amber-100 hover:bg-amber-200 text-amber-800 border-amber-300'
    },
    {
      id: 'outdoor-adventure',
      title: 'Outdoor Fun',
      icon: '🌳',
      prompt: 'Adventurous outdoor content with natural beauty and freedom',
      description: 'Outdoor and nature content',
      color: 'bg-emerald-100 hover:bg-emerald-200 text-emerald-800 border-emerald-300'
    },
    {
      id: 'professional-tease',
      title: 'Professional',
      icon: '👔',
      prompt: 'Professional yet seductive content balancing sophistication with allure',
      description: 'Professional/office content',
      color: 'bg-white hover:bg-gray-50 text-gray-800 border-gray-300'
    }
  ];

  const copyToClipboard = async (_text: string, itemName: string) => {
    try {
      await navigator.clipboard.writeText(_text);
      setCopiedItem(itemName);
      toast({
        title: "Copied!",
        description: `${itemName} copied to clipboard`
      });

      // Reset copied state after 2 seconds
      setTimeout(() => setCopiedItem(null), 2000);
    } catch (_err) {
      toast({
        title: "Copy Failed",
        description: "Unable to copy to clipboard",
        variant: "destructive"
      });
    }
  };

  const generateContentMutation = useMutation({
    mutationFn: async (_data: unknown) => {
      const data = _data as any; // Type assertion for mutation data
      // Use FormData for unified endpoint that handles both text and images
      const formData = new FormData();

      // Set mode based on workflow
      if (workflowMode === 'image' && imageFile) {
        formData.append('mode', 'image');
        formData.append('image', imageFile);
      } else {
        formData.append('mode', 'text');
        formData.append('prompt', data.customPrompt || data.prompt || '');
      }

      // Add common parameters
      formData.append('platform', data.platform || platform);
      formData.append('style', data.style || 'playful');
      formData.append('theme', data.theme || '');
      formData.append('includePromotion', String(data.allowsPromotion === 'high'));
      formData.append('customInstructions', data.customPrompt || '');
      formData.append('photoType', data.photoType || selectedPhotoType);
      formData.append('textTone', data.textTone || selectedTextTone);
      formData.append('hashtags', data.hashtags?.join(',') || selectedHashtags.join(','));


      // Send to unified endpoint  
      const token = localStorage.getItem('authToken');
      
      const response = await fetch('/api/generate-unified', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token || ''}`,
        },
        body: formData
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to generate content');
      }

      return await response.json();
    },
    onSuccess: (data) => {
      // Clear existing content first to ensure overwrite
      setGeneratedContent(null);
      
      // Invalidate user stats to refresh daily generation counter
      queryClient.invalidateQueries({ queryKey: ['/api/user/stats'] });
      
      // Ensure proper data structure for display
      const displayData: GeneratedContentDisplay = {
        ...data,
        titles: Array.isArray(data.titles) ? data.titles : 
                typeof data.titles === 'string' ? [data.titles] :
                data.titles ? Object.values(data.titles).filter(Boolean) : [],
        photoInstructions: data.photoInstructions || {}
      };

      onContentGenerated(data);
      setGeneratedContent(displayData);

      const hasWatermark = data.content?.includes('[via ThottoPilot]') || 
                          (Array.isArray(data.titles) && data.titles[0]?.includes('[via ThottoPilot]'));

      const description = data.contentSource === 'template' 
        ? `Using pre-generated content${hasWatermark ? ' (with watermark)' : ''}`
        : `Generated with ${data.aiProvider || 'service'}`;

      toast({
        title: "Content Generated Successfully!",
        description: description
      });

      if (data.upgradeMessage) {
        setTimeout(() => {
          toast({
            title: "Want More?",
            description: data.upgradeMessage
          });
        }, 2000);
      }

      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: (error) => {
      console.error('Generation failed with error:', error);
      toast({
        title: "Generation Failed", 
        description: error.message || 'Failed to generate content',
        variant: "destructive"
      });
      
      // If auth error, suggest login
      if (error.message?.includes('Authentication') || error.message?.includes('Invalid token')) {
        setTimeout(() => {
          toast({
            title: "Please Login",
            description: "Sign in with admin@thottopilot.com / admin123 to test features",
          });
        }, 1500);
      }
    }
  });

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        const uploadedImageUrl = e.target?.result as string;
        setUploadedImage(uploadedImageUrl);
        
        if (autoProtect) {
          applyImageShieldProtection(file);
          toast({ title: "Image Uploaded", description: "Image uploaded and protection applied automatically!" });
        } else {
          toast({ title: "Image Uploaded", description: "Image ready for protection." });
        }
      };
      reader.readAsDataURL(file);
    }
  };

  // Apply ImageShield protection using the full protection system
  const applyImageShieldProtection = async (_file: File) => {
    try {
      const settings = protectionPresets[protectionLevel];
      // Apply watermark for free users (Pro/Premium users get watermark-free)
      const shouldAddWatermark = userTier === 'free' || isGuestMode;
      const protectedBlob = await protectImage(_file, settings, shouldAddWatermark);
      
      // Create preview URL for protected image
      const protectedUrl = URL.createObjectURL(protectedBlob);
      setProtectedImageUrl(protectedUrl);
      setShowProtectionComparison(true);
      
      toast({
        title: "Image Protected!",
        description: `${protectionLevel} protection applied${shouldAddWatermark ? ' with watermark' : ''}`,
      });
    } catch (_error) {
      toast({
        title: "Protection Failed",
        description: "Failed to protect the image. Please try again.",
        variant: "destructive"
      });
      console.error('ImageShield protection failed:', _error);
    }
  };

  // Manual protection function for user-triggered protection
  const protectCurrentImage = async () => {
    if (!imageFile) {
      toast({
        title: "No Image",
        description: "Please upload an image first",
        variant: "destructive"
      });
      return;
    }
    
    await applyImageShieldProtection(imageFile);
  };

  // Download protected image
  const downloadCurrentProtectedImage = () => {
    if (!protectedImageUrl || !imageFile) return;
    
    fetch(protectedImageUrl)
      .then(response => response.blob())
      .then(blob => {
        const originalFileName = imageFile.name;
        const timestamp = new Date().toISOString().slice(0, 10);
        const filename = `protected_${timestamp}_${originalFileName}`;
        downloadProtectedImage(blob, filename);
      })
      .catch(error => {
        toast({
          title: "Download Failed",
          description: "Failed to download protected image",
          variant: "destructive"
        });
      });
  };

  const handleGenerate = () => {
    if (!requireAuth("generate content")) return;
    
    // Clear existing content before new generation
    setGeneratedContent(null);
    
    if (workflowMode === 'text') {
      if (!customPrompt.trim()) {
        toast({
          title: "Prompt Required",
          description: "Please enter a prompt for content generation",
          variant: "destructive"
        });
        return;
      }

      generateContentMutation.mutate({
        platform,
        customPrompt,
        subreddit: subreddit || undefined,
        allowsPromotion,
        preferredProvider: selectedProvider !== "auto" ? selectedProvider : undefined,
        photoType: selectedPhotoType,
        textTone: selectedTextTone,
        hashtags: selectedHashtags
      });
    } else if (workflowMode === 'image') {
      if (!imageFile) {
        toast({
          title: "Image Required",
          description: "Please upload an image for content generation",
          variant: "destructive"
        });
        return;
      }

      generateContentMutation.mutate({
        platform,
        customPrompt: '', // Add empty prompt for image mode
        imageFile,
        subreddit: subreddit || undefined,
        allowsPromotion,
        preferredProvider: selectedProvider !== "auto" ? selectedProvider : undefined,
        photoType: selectedPhotoType,
        textTone: selectedTextTone,
        hashtags: selectedHashtags
      });
    }
  };

  // Authentication check helper
  const requireAuth = (action: string) => {
    if (!isAuthenticated) {
      toast({
        title: "🔐 Authentication Required",
        description: `Please log in to ${action}. Creating an account takes just 30 seconds!`,
        action: (
          <Button
            size="sm"
            onClick={() => setShowAuthModal(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white"
          >
            <LogIn className="h-4 w-4 mr-1" />
            Log In
          </Button>
        ),
        duration: 6000,
      });
      return false;
    }
    return true;
  };

  const handlePresetGenerate = (preset: typeof contentPresets[0]) => {
    if (!requireAuth("generate content")) return;
    
    // Clear existing content before new generation
    setGeneratedContent(null);
    
    generateContentMutation.mutate({
      platform,
      customPrompt: preset.prompt,
      subreddit: subreddit || undefined,
      allowsPromotion,
      style: preset.id,
      theme: preset.title.toLowerCase(),
      preferredProvider: selectedProvider !== "auto" ? selectedProvider : undefined,
      photoType: selectedPhotoType,
      textTone: selectedTextTone,
      hashtags: selectedHashtags
    });
  };

  const handleUpgradePrompt = () => {
    toast({
      title: "Pro Feature",
      description: "Image-based content generation requires Pro tier. Upgrade to unlock this feature!",
      variant: "default"
    });
  };

  const toggleHashtag = (_hashtag: string) => {
    setSelectedHashtags((prev) =>
      prev.includes(_hashtag)
        ? prev.filter((h) => h !== _hashtag)
        : [...prev.slice(0, 9), _hashtag].slice(0, 10) // Limit to 10 hashtags
    );
  };

  return (
    <Card className="w-full bg-white border-gray-200 shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <Brain className="mr-2 h-5 w-5" />
            Content Creator
          </div>
          {isGuestMode && (
            <Badge variant="secondary" className="bg-orange-100 text-orange-800">
              Guest Mode
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Create engaging content with text prompts or image analysis
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Workflow Mode Selector */}
        <Tabs value={workflowMode} onValueChange={(value) => setWorkflowMode(value as 'text' | 'image' | 'presets' | 'history')}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="presets" className="flex items-center">
              <Zap className="mr-2 h-4 w-4" />
              Quick Styles
            </TabsTrigger>
            <TabsTrigger value="text" className="flex items-center">
              <FileText className="mr-2 h-4 w-4" />
              Custom
            </TabsTrigger>
            <TabsTrigger value="image" className="flex items-center" disabled={!canUseImageWorkflow}>
              <Camera className="mr-2 h-4 w-4" />
              Image-First
              {!canUseImageWorkflow && (
                <div className="flex items-center ml-2">
                  <Badge className="bg-yellow-100 text-yellow-700 text-xs">Pro Feature</Badge>
                  <Lock className="ml-1 h-3 w-3" />
                </div>
              )}
            </TabsTrigger>
            <TabsTrigger value="history" className="flex items-center">
              <RefreshCw className="mr-2 h-4 w-4" />
              History
            </TabsTrigger>
          </TabsList>

          {/* Quick Style Presets */}
          <TabsContent value="presets" className="space-y-4">
            <div className="space-y-4">
              <div className="text-center">
                <h3 className="text-lg font-semibold mb-2">Choose Your Style</h3>
                <p className="text-sm text-muted-foreground">
                  Click any style below to instantly generate content for that theme
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {contentPresets.map((preset) => (
                  <Button
                    key={preset.id}
                    variant="outline"
                    className={`h-auto p-4 flex flex-col items-center space-y-2 border-2 transition-all duration-200 ${preset.color}`}
                    onClick={() => handlePresetGenerate(preset)}
                    disabled={generateContentMutation.isPending}
                  >
                    <span className="text-2xl">{preset.icon}</span>
                    <span className="font-medium text-sm">{preset.title}</span>
                    <span className="text-xs opacity-75 text-center leading-tight">
                      {preset.description}
                    </span>
                  </Button>
                ))}
              </div>

              {generateContentMutation.isPending && (
                <div className="flex items-center justify-center space-x-2 py-4">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span className="text-sm text-muted-foreground">Generating content...</span>
                </div>
              )}
            </div>
          </TabsContent>

          {/* Text-First Workflow */}
          <TabsContent value="text" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="prompt">Custom Content Prompt</Label>
              <Textarea
                id="prompt"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
          </TabsContent>

          {/* Image-First Workflow */}
          <TabsContent value="image" className="space-y-4">
            {!canUseImageWorkflow ? (
              <div className="text-center p-8 border-2 border-dashed border-gray-300 rounded-lg bg-gray-50">
                <Crown className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2 text-gray-900">Pro Feature</h3>
                <p className="text-muted-foreground mb-4">
                  Image-based content generation is available for Pro and Premium users
                </p>
                <Button onClick={handleUpgradePrompt} className="bg-primary hover:bg-primary/90">
                  <Crown className="mr-2 h-4 w-4" />
                  Upgrade to Pro
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Upload Image</Label>
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 bg-gray-50">
                    {uploadedImage ? (
                      <div className="space-y-4">
                        <img
                          src={uploadedImage}
                          alt="Uploaded"
                          className="max-w-full h-auto max-h-64 mx-auto rounded-lg"
                        />
                        <div className="flex justify-center space-x-2">
                          <Button
                            variant="outline"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <RefreshCw className="mr-2 h-4 w-4" />
                            Change Image
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="text-center">
                        <Upload className="mx-auto h-8 w-8 text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground mb-4">
                          Upload an image to generate captions and content
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
                </div>

                {/* ImageShield Protection Controls */}
                {uploadedImage && (
                  <Card className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 border-purple-500/20">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-lg">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-600">
                          🛡️
                        </div>
                        ImageShield™ Protection
                      </CardTitle>
                      <CardDescription>
                        Protect your image from reverse searches with advanced anti-detection technology
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Auto-protect toggle */}
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <Label className="text-sm font-medium">Auto-Protect Images</Label>
                          <p className="text-xs text-muted-foreground">
                            Automatically apply protection when uploading images
                          </p>
                        </div>
                        <Switch
                          checked={autoProtect}
                          onCheckedChange={setAutoProtect}
                        />
                      </div>

                      {/* Protection level selector */}
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Protection Level</Label>
                        <Select value={protectionLevel} onValueChange={(value) => setProtectionLevel(value as 'light' | 'standard' | 'heavy')}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="light">
                              <div className="flex items-center gap-2">
                                <span className="text-yellow-500">⚡</span>
                                <span>Light - Minimal changes, fast processing</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="standard">
                              <div className="flex items-center gap-2">
                                <span className="text-blue-500">🛡️</span>
                                <span>Standard - Balanced protection (Recommended)</span>
                              </div>
                            </SelectItem>
                            <SelectItem value="heavy">
                              <div className="flex items-center gap-2">
                                <span className="text-red-500">🔒</span>
                                <span>Heavy - Maximum security</span>
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Protection actions */}
                      <div className="flex gap-2">
                        <Button
                          onClick={protectCurrentImage}
                          className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                        >
                          <div className="flex items-center justify-center w-4 h-4 mr-2">🛡️</div>
                          Protect Image
                        </Button>
                        
                        {protectedImageUrl && (
                          <Button
                            onClick={downloadCurrentProtectedImage}
                            variant="outline"
                            className="border-purple-500 text-purple-600 hover:bg-purple-50"
                          >
                            <ArrowRight className="h-4 w-4 mr-2" />
                            Download
                          </Button>
                        )}
                      </div>

                      {/* Protection comparison */}
                      {showProtectionComparison && protectedImageUrl && (
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Before vs After</Label>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <p className="text-xs text-muted-foreground text-center">Original</p>
                              <img
                                src={uploadedImage}
                                alt="Original"
                                className="w-full h-32 object-cover rounded-lg border"
                              />
                            </div>
                            <div className="space-y-2">
                              <p className="text-xs text-muted-foreground text-center">Protected</p>
                              <img
                                src={protectedImageUrl}
                                alt="Protected"
                                className="w-full h-32 object-cover rounded-lg border border-purple-500"
                              />
                            </div>
                          </div>
                          {(isGuestMode || userTier === 'free') && (
                            <p className="text-xs text-orange-600 text-center">
                              ⚠️ Watermark applied - Upgrade to Pro to remove
                            </p>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </TabsContent>

          {/* Generation History */}
          <TabsContent value="history" className="space-y-4">
            <GenerationHistory 
              onSelectGeneration={(generation) => {
                // Load selected generation as current content
                const displayData: GeneratedContentDisplay = {
                  ...generation,
                  userId: (generation as any).userId || 0,
                  subreddit: (generation as any).subreddit || null,
                  generationType: (generation as any).generationType || 'ai',
                  createdAt: typeof generation.createdAt === 'string' 
                    ? new Date(generation.createdAt) 
                    : generation.createdAt || new Date(),
                  titles: generation.titles || [],
                  photoInstructions: (generation.photoInstructions && typeof generation.photoInstructions === 'object' && 'lighting' in generation.photoInstructions) 
                    ? generation.photoInstructions as {
                        lighting: string;
                        cameraAngle: string;
                        composition: string;
                        styling: string;
                        mood: string;
                        technicalSettings: string;
                      }
                    : {
                        lighting: '',
                        cameraAngle: '',
                        composition: '',
                        styling: '',
                        mood: '',
                        technicalSettings: ''
                      }
                };
                setGeneratedContent(displayData);
                toast({
                  title: "Generation Loaded",
                  description: "Previous content loaded successfully"
                });
              }}
            />
          </TabsContent>
        </Tabs>

        {/* Shared Settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Platform</Label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="reddit">Reddit</SelectItem>
                <SelectItem value="twitter">Twitter</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="onlyfans">OnlyFans</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Subreddit (Optional)</Label>
            <Textarea
              value={subreddit}
              onChange={(e) => setSubreddit(e.target.value)}
              className="h-10"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>Promotion Level</Label>
          <Select value={allowsPromotion} onValueChange={setAllowsPromotion}>
            <SelectTrigger>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No Promotion</SelectItem>
              <SelectItem value="subtle">Subtle Hints</SelectItem>
              <SelectItem value="moderate">Moderate Promotion</SelectItem>
              <SelectItem value="direct">Direct Promotion</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Advanced Settings */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="advanced">Advanced Settings</Label>
            <Switch
              id="advanced"
              checked={useAdvancedSettings}
              onCheckedChange={setUseAdvancedSettings}
            />
          </div>

          {useAdvancedSettings && (
            <div className="space-y-2">
              <Label>Provider Preference</Label>
              <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                <SelectTrigger>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto (Optimized)</SelectItem>
                  <SelectItem value="gemini">Gemini Flash - Fast & Efficient</SelectItem>
                  <SelectItem value="claude">Claude Haiku - Balanced Performance</SelectItem>
                  <SelectItem value="openai">OpenAI GPT-4o - Premium Quality</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {/* Generate Button */}
        <Button 
          onClick={handleGenerate} 
          disabled={generateContentMutation.isPending}
          aria-label="Generate content with current settings"
          aria-busy={generateContentMutation.isPending}
          className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-3"
        >
          {generateContentMutation.isPending ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4 mr-2" />
              Generate Content
            </>
          )}
        </Button>

        {/* Generated Content Output */}
        {generatedContent && (
          <div className="mt-8 space-y-6 border-t pt-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center">
                <Sparkles className="mr-2 h-5 w-5 text-primary" />
                Generated Content
              </h3>
              <div className="flex gap-2">
                {generatedContent.contentSource && (
                  <Badge 
                    className="text-xs"
                  >
                    {generatedContent.contentSource === 'template' ? 'Template' : 'AI Generated'}
                  </Badge>
                )}
                {generatedContent.quotaExceeded && (
                  <Badge variant="outline" className="text-xs text-orange-600 border-orange-600">
                    OpenAI Quota Exceeded
                  </Badge>
                )}
              </div>
            </div>

            {/* Generated Titles */}
            {generatedContent.titles && Array.isArray(generatedContent.titles) && generatedContent.titles.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm text-card-foreground">
                    Titles ({generatedContent.titles.length} options)
                  </h4>
                </div>
                <div className="space-y-2">
                  {generatedContent.titles.map((title: string, index: number) => (
                    <div 
                      key={index} 
                      className="relative p-3 bg-secondary rounded-lg group hover:bg-secondary/80 transition-colors border border-border"
                    >
                      <p className="text-secondary-foreground">{title}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(title, `Title ${index + 1}`)}
                        className="absolute top-2 right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        {copiedItem === `Title ${index + 1}` ? (
                          <Check className="h-3 w-3" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Generated Content */}
            {generatedContent.content && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm text-card-foreground">
                    Post Content
                  </h4>
                </div>
                <div className="relative p-4 bg-secondary rounded-lg group hover:bg-secondary/80 transition-colors border border-border">
                  <p className="text-secondary-foreground whitespace-pre-wrap">{generatedContent.content}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(generatedContent.content || '', 'Content')}
                    className="absolute top-2 right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    {copiedItem === 'Content' ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Photo Instructions */}
            {generatedContent.photoInstructions && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm text-card-foreground flex items-center">
                    <Camera className="mr-1 h-4 w-4" />
                    Photo Instructions
                  </h4>
                </div>
                <div className="relative p-4 bg-primary/10 rounded-lg group hover:bg-primary/20 transition-colors border border-primary/30">
                  <div className="space-y-3 pr-8">
                    {typeof generatedContent.photoInstructions === 'string' ? (
                      <p className="text-sm text-card-foreground">{generatedContent.photoInstructions}</p>
                    ) : (
                      Object.entries(generatedContent.photoInstructions as { [key: string]: string }).map(([key, value]) => (
                        <div key={key}>
                          <span className="font-medium text-xs text-primary uppercase tracking-wide">
                            {key.replace(/([A-Z])/g, ' $1').trim()}:
                          </span>
                          <p className="text-sm mt-1 text-card-foreground">{String(value)}</p>
                        </div>
                      ))
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(
                      typeof generatedContent.photoInstructions === 'string' 
                        ? generatedContent.photoInstructions
                        : Object.entries(generatedContent.photoInstructions as { [key: string]: string })
                            .map(([key, value]) => `${key.replace(/([A-Z])/g, ' $1').trim()}: ${value}`)
                            .join('\n\n'),
                      'Photo Instructions'
                    )}
                    className="absolute top-2 right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    {copiedItem === 'Photo Instructions' ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Authentication Prompt for Unauthenticated Users */}
        {!isAuthenticated && !generatedContent && (
          <Alert className="mt-6 border-purple-200 bg-purple-50 dark:bg-purple-900/20">
            <UserCheck className="h-4 w-4 text-purple-600" />
            <AlertDescription className="flex items-center justify-between">
              <div>
                <p className="font-medium text-purple-800 dark:text-purple-200">Ready to create amazing content?</p>
                <p className="text-sm text-purple-600 dark:text-purple-300 mt-1">
                  Sign up for free to start generating captions, titles, and photo instructions with AI
                </p>
              </div>
              <Button 
                onClick={() => setShowAuthModal(true)}
                className="ml-4 bg-purple-600 hover:bg-purple-700 text-white"
                data-testid="button-auth-prompt"
              >
                <LogIn className="h-4 w-4 mr-1" />
                Get Started
              </Button>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => {
          setShowAuthModal(false);
          toast({
            title: "🎉 Welcome to ThottoPilot!",
            description: "You can now generate content and connect your social accounts.",
          });
        }}
        initialMode="signup"
      />
    </Card>
  );
}