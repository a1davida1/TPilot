import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
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
  Wand2
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ContentGeneration } from "@shared/schema";

// Assuming ThemeToggle and other necessary components/hooks are imported correctly.
// For example: import ThemeToggle from "@/components/ThemeToggle";
// And placeholder functions/types like photoTypes, textTones, availableHashtags, setSelectedPhotoType, etc. are defined or imported.

// Dummy definitions for placeholder types and states to make the code runnable for demonstration.
// In a real app, these would be imported or defined elsewhere.
const ThemeToggle = () => null; // Placeholder for ThemeToggle component
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
interface GeneratedContentDisplay extends ContentGeneration {
  contentSource?: 'ai' | 'template';
  aiProvider?: string;
  estimatedCost?: number;
  upgradeMessage?: string;
  userTier?: string;
  variationCount?: number;
  titles: string[]; // Ensure titles is always an array
  photoInstructions: {
    [key: string]: string;
  } | string; // Support both object and string formats
}

interface UnifiedContentCreatorProps {
  onContentGenerated: (generation: ContentGeneration) => void;
  isGuestMode?: boolean;
  userTier?: "free" | "basic" | "pro" | "premium";
}

export function UnifiedContentCreator({ 
  onContentGenerated, 
  isGuestMode = false,
  userTier = "free" 
}: UnifiedContentCreatorProps) {
  const [workflowMode, setWorkflowMode] = useState<'text' | 'image' | 'presets'>('presets');
  const [customPrompt, setCustomPrompt] = useState("");
  const [platform, setPlatform] = useState("reddit");
  const [subreddit, setSubreddit] = useState("");
  const [allowsPromotion, setAllowsPromotion] = useState("moderate");
  const [useAdvancedSettings, setUseAdvancedSettings] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState("auto");

  // State for photo types and text tones
  const [selectedPhotoType, setSelectedPhotoType] = useState(photoTypes[0].id);
  const [selectedTextTone, setSelectedTextTone] = useState(textTones[0].id);
  const [selectedHashtags, setSelectedHashtags] = useState<string[]>([]);

  // Image workflow states
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Output display states
  const [generatedContent, setGeneratedContent] = useState<GeneratedContentDisplay | null>(null);
  const [copiedItem, setCopiedItem] = useState<string | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const canUseImageWorkflow = userTier === "pro" || userTier === "premium";

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
      color: 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-300'
    }
  ];

  const copyToClipboard = async (text: string, itemName: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedItem(itemName);
      toast({
        title: "Copied!",
        description: `${itemName} copied to clipboard`
      });

      // Reset copied state after 2 seconds
      setTimeout(() => setCopiedItem(null), 2000);
    } catch (err) {
      toast({
        title: "Copy Failed",
        description: "Unable to copy to clipboard",
        variant: "destructive"
      });
    }
  };

  const generateContentMutation = useMutation({
    mutationFn: async (data: any) => {
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
      const response = await fetch('/api/generate-unified', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
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
      toast({
        title: "Generation Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setUploadedImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);

      toast({
        title: "Image Uploaded",
        description: "Your image has been uploaded successfully!"
      });
    }
  };

  const handleGenerate = () => {
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

  const handlePresetGenerate = (preset: typeof contentPresets[0]) => {
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

  const toggleHashtag = (hashtag: string) => {
    setSelectedHashtags((prev) =>
      prev.includes(hashtag)
        ? prev.filter((h) => h !== hashtag)
        : [...prev.slice(0, 9), hashtag].slice(0, 10) // Limit to 10 hashtags
    );
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <Brain className="mr-2 h-5 w-5" />
            Content Creator
          </div>
          {isGuestMode && (
            <Badge variant="secondary" className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
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
        <Tabs value={workflowMode} onValueChange={(value) => setWorkflowMode(value as 'text' | 'image' | 'presets')}>
          <TabsList className="grid w-full grid-cols-3">
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
              {!canUseImageWorkflow && <Lock className="ml-2 h-3 w-3" />}
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
                placeholder="Describe what you want to create... (e.g., 'playful tease about trying on new lingerie')"
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                className="min-h-[100px]"
              />
            </div>
          </TabsContent>

          {/* Image-First Workflow */}
          <TabsContent value="image" className="space-y-4">
            {!canUseImageWorkflow ? (
              <div className="text-center p-8 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
                <Crown className="mx-auto h-12 w-12 text-gray-400 mb-4" />
                <h3 className="text-lg font-semibold mb-2">Pro Feature</h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
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
                  <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6">
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
                        <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
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
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Shared Settings */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Platform</Label>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger>
                <SelectValue placeholder="Select platform" />
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
              placeholder="e.g., r/selfie, r/gonewild"
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
              <SelectValue placeholder="Select promotion level" />
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
                  <SelectValue placeholder="Select provider" />
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
                    variant={generatedContent.contentSource === 'demo' ? 'destructive' : 'secondary'} 
                    className="text-xs"
                  >
                    {generatedContent.contentSource === 'demo' ? 'DEMO - AI Unavailable' : 
                     generatedContent.contentSource === 'template' ? 'Template' : 'AI Generated'}
                  </Badge>
                )}
                {(generatedContent as any).isDemo && (
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
      </CardContent>
    </Card>
  );
}