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
  Check
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ContentGeneration } from "@shared/schema";

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
  const [workflowMode, setWorkflowMode] = useState<'text' | 'image'>('text');
  const [customPrompt, setCustomPrompt] = useState("");
  const [platform, setPlatform] = useState("reddit");
  const [subreddit, setSubreddit] = useState("");
  const [allowsPromotion, setAllowsPromotion] = useState("moderate");
  const [useAdvancedSettings, setUseAdvancedSettings] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState("auto");
  
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
      const response = await apiRequest("POST", "/api/generate-ai", {
        ...data,
        generationType: workflowMode === 'text' ? "prompt" : "image",
        userProfile: {
          toneOfVoice: "confident",
          contentStyle: "authentic",
          personalBrand: "girl-next-door",
          contentLength: "medium",
          includeEmojis: true,
          promotionLevel: allowsPromotion
        }
      });
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
        preferredProvider: selectedProvider !== "auto" ? selectedProvider : undefined
      });
    } else {
      if (!uploadedImage) {
        toast({
          title: "Image Required",
          description: "Please upload an image for content generation",
          variant: "destructive"
        });
        return;
      }

      generateContentMutation.mutate({
        platform,
        imageData: uploadedImage,
        subreddit: subreddit || undefined,
        allowsPromotion,
        preferredProvider: selectedProvider !== "auto" ? selectedProvider : undefined
      });
    }
  };

  const handleUpgradePrompt = () => {
    toast({
      title: "Pro Feature",
      description: "Image-based content generation requires Pro tier. Upgrade to unlock this feature!",
      variant: "default"
    });
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
        <Tabs value={workflowMode} onValueChange={(value) => setWorkflowMode(value as 'text' | 'image')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="text" className="flex items-center">
              <FileText className="mr-2 h-4 w-4" />
              Text-First
            </TabsTrigger>
            <TabsTrigger value="image" className="flex items-center" disabled={!canUseImageWorkflow}>
              <Camera className="mr-2 h-4 w-4" />
              Image-First
              {!canUseImageWorkflow && <Lock className="ml-2 h-3 w-3" />}
            </TabsTrigger>
          </TabsList>

          {/* Text-First Workflow */}
          <TabsContent value="text" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="prompt">Content Prompt</Label>
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
                <Button onClick={handleUpgradePrompt} className="bg-purple-600 hover:bg-purple-700">
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
          className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
        >
          {generateContentMutation.isPending ? (
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="mr-2 h-4 w-4" />
          )}
          {generateContentMutation.isPending ? "Generating..." : "Generate Content"}
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>

        {/* Generated Content Output */}
        {generatedContent && (
          <div className="mt-8 space-y-6 border-t pt-6">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold flex items-center">
                <Sparkles className="mr-2 h-5 w-5 text-purple-500" />
                Generated Content
              </h3>
              {generatedContent.contentSource && (
                <Badge variant="secondary" className="text-xs">
                  {generatedContent.contentSource === 'template' ? 'Template' : 'AI Generated'}
                </Badge>
              )}
            </div>

            {/* Generated Titles */}
            {generatedContent.titles && Array.isArray(generatedContent.titles) && generatedContent.titles.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300">
                    Titles ({generatedContent.titles.length} options)
                  </h4>
                </div>
                <div className="space-y-2">
                  {generatedContent.titles.map((title: string, index: number) => (
                    <div 
                      key={index} 
                      className="relative p-3 bg-gray-50 dark:bg-gray-800 rounded-lg group hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                    >
                      <p className="text-sm pr-8">{title}</p>
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
                  <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300">
                    Post Content
                  </h4>
                </div>
                <div className="relative p-4 bg-gray-50 dark:bg-gray-800 rounded-lg group hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                  <p className="text-sm whitespace-pre-wrap pr-8">{generatedContent.content}</p>
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
                  <h4 className="font-medium text-sm text-gray-700 dark:text-gray-300 flex items-center">
                    <Camera className="mr-1 h-4 w-4" />
                    Photo Instructions
                  </h4>
                </div>
                <div className="relative p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg group hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors border border-blue-200 dark:border-blue-800">
                  <div className="space-y-3 pr-8">
                    {typeof generatedContent.photoInstructions === 'string' ? (
                      <p className="text-sm">{generatedContent.photoInstructions}</p>
                    ) : (
                      Object.entries(generatedContent.photoInstructions as { [key: string]: string }).map(([key, value]) => (
                        <div key={key}>
                          <span className="font-medium text-xs text-blue-700 dark:text-blue-300 uppercase tracking-wide">
                            {key.replace(/([A-Z])/g, ' $1').trim()}:
                          </span>
                          <p className="text-sm mt-1">{String(value)}</p>
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