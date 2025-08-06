import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Sparkles, Brain, Zap, DollarSign, Clock, TrendingUp, RefreshCw, Settings, Copy, Check, Hash } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ContentGeneration } from "@shared/schema";

interface EnhancedAIGeneratorProps {
  onContentGenerated: (generation: ContentGeneration) => void;
  isGuestMode?: boolean;
}

export function EnhancedAIGenerator({ onContentGenerated, isGuestMode = false }: EnhancedAIGeneratorProps) {
  const [customPrompt, setCustomPrompt] = useState("");
  const [platform, setPlatform] = useState("reddit");
  const [subreddit, setSubreddit] = useState("");
  const [allowsPromotion, setAllowsPromotion] = useState("moderate");
  const [useAdvancedSettings, setUseAdvancedSettings] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState("auto");
  
  // New categorization system
  const [photoType, setPhotoType] = useState("casual");
  const [textTone, setTextTone] = useState("confident");
  const [includePromotion, setIncludePromotion] = useState(true);
  const [includeHashtags, setIncludeHashtags] = useState(true);
  const [selectedHashtags, setSelectedHashtags] = useState<string[]>([]);
  const [generatedContent, setGeneratedContent] = useState<any>(null);
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Photo type categories with humor
  const photoTypes = [
    { id: 'casual', label: 'Casual & Cute', icon: '😊' },
    { id: 'workout', label: 'Workout Vibes', icon: '💪' },
    { id: 'shower', label: 'Shower Fresh', icon: '🚿' },
    { id: 'showing-skin', label: 'Showing a Lil Skin', icon: '😘' },
    { id: 'spicy', label: 'XX Spicy', icon: '🌶️' },
    { id: 'very-spicy', label: 'XXX Very Spicy', icon: '🔥' },
    { id: 'all-xs', label: 'All the X\'s & Then Some!', icon: '🔥💥' }
  ];

  const textTones = [
    { id: 'confident', label: 'Confident & Bold' },
    { id: 'playful', label: 'Playful & Flirty' },
    { id: 'mysterious', label: 'Mysterious & Alluring' },
    { id: 'authentic', label: 'Authentic & Real' },
    { id: 'sassy', label: 'Sassy & Fun' }
  ];

  const defaultHashtags = [
    '#selfie', '#confidence', '#beautiful', '#mood', '#vibes',
    '#natural', '#authentic', '#stunning', '#goddess', '#empowered'
  ];

  // Preset style definitions matching unified content creator
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

  const generateContentMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await apiRequest("POST", "/api/generate-ai", {
        ...data,
        generationType: "prompt",
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
      setGeneratedContent(data);
      onContentGenerated(data);
      
      // Check if watermark was added (free tier)
      const hasWatermark = data.content?.includes('[via ThottoPilot]') || 
                          data.titles?.[0]?.includes('[via ThottoPilot]');
      
      const description = data.contentSource === 'template' 
        ? `Using pre-generated content${hasWatermark ? ' (with watermark)' : ''}`
        : `Generated with ${data.aiProvider || 'service'}`;
      
      toast({
        title: "Content Generated Successfully!",
        description: description
      });
      
      // Show upgrade prompt for free/basic users
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

  const handleGenerate = () => {
    if (!customPrompt.trim()) {
      toast({
        title: "Prompt Required", 
        description: "Please enter a prompt for content generation",
        variant: "destructive"
      });
      return;
    }

    const hashtagText = includeHashtags && selectedHashtags.length > 0 
      ? ` Include these hashtags: ${selectedHashtags.join(' ')}`
      : '';

    generateContentMutation.mutate({
      platform,
      customPrompt: customPrompt + hashtagText,
      subreddit: subreddit || undefined,
      allowsPromotion: includePromotion ? allowsPromotion : 'none',
      photoType,
      textTone,
      includeHashtags,
      selectedHashtags,
      preferredProvider: selectedProvider !== "auto" ? selectedProvider : undefined
    });
  };

  const handlePresetGenerate = (preset: typeof contentPresets[0]) => {
    const hashtagText = includeHashtags && selectedHashtags.length > 0 
      ? ` Include these hashtags: ${selectedHashtags.join(' ')}`
      : '';

    generateContentMutation.mutate({
      platform,
      customPrompt: preset.prompt + hashtagText,
      subreddit: subreddit || undefined,
      allowsPromotion: includePromotion ? allowsPromotion : 'none',
      photoType,
      textTone,
      includeHashtags,
      selectedHashtags,
      style: preset.id,
      theme: preset.title.toLowerCase(),
      preferredProvider: selectedProvider !== "auto" ? selectedProvider : undefined
    });
  };

  const toggleHashtag = (hashtag: string) => {
    setSelectedHashtags(prev => 
      prev.includes(hashtag) 
        ? prev.filter(h => h !== hashtag)
        : [...prev, hashtag]
    );
  };

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: `${type} copied to clipboard`
      });
    } catch (err) {
      toast({
        title: "Copy Failed",
        description: "Unable to copy to clipboard",
        variant: "destructive"
      });
    }
  };

  // Cost information hidden from user interface - used internally for optimization

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <Brain className="mr-2 h-5 w-5 text-pink-600" />
            <span className="bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
              Enhanced Content Creator
            </span>
          </div>
          {isGuestMode && (
            <Badge variant="secondary" className="bg-pink-100 text-pink-800">
              Guest Mode
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Generate engaging content optimized for women creators
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Quick Style Presets */}
        <div className="space-y-4">
          <div className="text-center">
            <h3 className="text-lg font-semibold mb-2 bg-gradient-to-r from-pink-600 to-purple-600 bg-clip-text text-transparent">
              Choose Your Style
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
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
              <RefreshCw className="h-4 w-4 animate-spin text-pink-600" />
              <span className="text-sm text-gray-600">Generating content...</span>
            </div>
          )}
        </div>

        {/* Custom Prompt */}
        <div className="space-y-2">
          <Label className="text-base font-medium">Custom Prompt (Optional)</Label>
          <Textarea
            placeholder="Add specific details about your content... (e.g., 'Cozy morning selfie with coffee')"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            rows={3}
            className="border-pink-200 focus:ring-pink-500"
          />
        </div>

        {/* Advanced Settings Toggle */}
        <div className="flex items-center space-x-2">
          <Switch
            id="advanced-settings"
            checked={useAdvancedSettings}
            onCheckedChange={setUseAdvancedSettings}
          />
          <Label htmlFor="advanced-settings" className="text-sm text-gray-600">
            <Settings className="inline h-4 w-4 mr-1" />
            Advanced Settings
          </Label>
        </div>

        {/* Advanced Settings (Hidden by default) */}
        {useAdvancedSettings && (
          <div className="space-y-6 p-4 bg-gray-50 rounded-lg border">
            {/* Main Categories */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Photo Type */}
              <div className="space-y-3">
                <Label className="text-base font-medium text-pink-600">Photo Type</Label>
                <div className="grid grid-cols-2 gap-2">
                  {photoTypes.map((type) => (
                    <Button
                      key={type.id}
                      variant={photoType === type.id ? "default" : "outline"}
                      className={`text-xs p-2 h-auto ${photoType === type.id ? 'bg-pink-600 text-white' : 'hover:bg-pink-50'}`}
                      onClick={() => setPhotoType(type.id)}
                    >
                      <span className="mr-1">{type.icon}</span>
                      {type.label}
                    </Button>
                  ))}
                </div>
              </div>

              {/* Text Tone */}
              <div className="space-y-3">
                <Label className="text-base font-medium text-purple-600">Text Tone</Label>
                <Select value={textTone} onValueChange={setTextTone}>
                  <SelectTrigger className="border-purple-200 focus:ring-purple-500">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {textTones.map((tone) => (
                      <SelectItem key={tone.id} value={tone.id}>
                        {tone.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Promotion & Hashtags */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="include-promotion"
                    checked={includePromotion}
                    onCheckedChange={setIncludePromotion}
                  />
                  <Label htmlFor="include-promotion" className="text-base font-medium text-blue-600">
                    Include Promotion in Post
                  </Label>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="include-hashtags"
                    checked={includeHashtags}
                    onCheckedChange={setIncludeHashtags}
                  />
                  <Label htmlFor="include-hashtags" className="text-base font-medium text-green-600">
                    Include Hashtags
                  </Label>
                </div>
                {includeHashtags && (
                  <div className="space-y-2">
                    <Label className="text-sm text-gray-600">Choose hashtags:</Label>
                    <div className="flex flex-wrap gap-1">
                      {defaultHashtags.map((hashtag) => (
                        <Button
                          key={hashtag}
                          variant={selectedHashtags.includes(hashtag) ? "default" : "outline"}
                          size="sm"
                          className={`text-xs h-6 px-2 ${selectedHashtags.includes(hashtag) ? 'bg-green-600 text-white' : 'hover:bg-green-50'}`}
                          onClick={() => toggleHashtag(hashtag)}
                        >
                          {hashtag}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Platform & Provider Settings */}
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Platform</Label>
                <Select value={platform} onValueChange={setPlatform}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reddit">Reddit</SelectItem>
                    <SelectItem value="twitter">Twitter</SelectItem>
                    <SelectItem value="instagram">Instagram</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Provider Preference</Label>
                <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto (Optimized)</SelectItem>
                    <SelectItem value="gemini">Gemini Flash</SelectItem>
                    <SelectItem value="claude">Claude Haiku</SelectItem>
                    <SelectItem value="openai">OpenAI GPT-4o</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {platform === "reddit" && (
              <div className="space-y-2">
                <Label>Subreddit (optional)</Label>
                <input
                  type="text"
                  placeholder="e.g., selfie, photography"
                  value={subreddit}
                  onChange={(e) => setSubreddit(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
            )}

            {includePromotion && (
              <div className="space-y-2">
                <Label>Promotion Style</Label>
                <Select value={allowsPromotion} onValueChange={setAllowsPromotion}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="subtle">Subtle - Natural engagement</SelectItem>
                    <SelectItem value="moderate">Moderate - Balanced approach</SelectItem>
                    <SelectItem value="direct">Direct - Clear promotion</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        )}

        {/* Generate Button */}
        <Button
          onClick={handleGenerate}
          disabled={generateContentMutation.isPending}
          className="w-full bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-700 hover:to-purple-700 text-white font-medium"
          size="lg"
        >
          {generateContentMutation.isPending ? (
            <>
              <Brain className="mr-2 h-4 w-4 animate-spin" />
              Generating Content...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Generate Content
            </>
          )}
        </Button>

        {/* Generated Content Output */}
        {generatedContent && (
          <div className="space-y-4 p-4 bg-gradient-to-br from-pink-50 to-purple-50 rounded-lg border border-pink-200">
            <h4 className="font-semibold text-lg text-pink-800">Generated Content</h4>
            
            {/* Titles */}
            {generatedContent.titles && generatedContent.titles.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-pink-700">Titles:</Label>
                {(Array.isArray(generatedContent.titles) ? generatedContent.titles : [generatedContent.titles]).map((title: string, index: number) => (
                  <div key={index} className="relative p-3 bg-white rounded-lg border group">
                    <p className="text-sm font-medium pr-8">{title}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(title, 'Title')}
                      className="absolute top-2 right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {/* Content */}
            {generatedContent.content && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-purple-700">Content:</Label>
                <div className="relative p-3 bg-white rounded-lg border group">
                  <p className="text-sm whitespace-pre-wrap pr-8">{generatedContent.content}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(generatedContent.content, 'Content')}
                    className="absolute top-2 right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}

            {/* Photo Instructions */}
            {generatedContent.photoInstructions && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-blue-700">Photo Instructions:</Label>
                <div className="relative p-3 bg-white rounded-lg border group">
                  <p className="text-sm whitespace-pre-wrap pr-8">
                    {typeof generatedContent.photoInstructions === 'string' 
                      ? generatedContent.photoInstructions 
                      : JSON.stringify(generatedContent.photoInstructions, null, 2)}
                  </p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(
                      typeof generatedContent.photoInstructions === 'string' 
                        ? generatedContent.photoInstructions 
                        : JSON.stringify(generatedContent.photoInstructions, null, 2), 
                      'Photo Instructions'
                    )}
                    className="absolute top-2 right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Guest Mode Limitation */}
        {isGuestMode && (
          <div className="text-center p-4 bg-pink-50 border border-pink-200 rounded-lg">
            <p className="text-sm text-pink-700">
              ✨ <strong>Guest Mode:</strong> Limited to demo content. 
              <a href="/login" className="text-pink-800 underline ml-1 font-medium">
                Sign up for full access
              </a>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}