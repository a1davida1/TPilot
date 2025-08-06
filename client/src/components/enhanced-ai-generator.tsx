import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Sparkles, Brain, Zap, DollarSign, Clock, TrendingUp, RefreshCw } from "lucide-react";
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
  
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

    generateContentMutation.mutate({
      platform,
      customPrompt,
      subreddit: subreddit || undefined,
      allowsPromotion,
      preferredProvider: selectedProvider !== "auto" ? selectedProvider : undefined
    });
  };

  const handlePresetGenerate = (preset: typeof contentPresets[0]) => {
    generateContentMutation.mutate({
      platform,
      customPrompt: preset.prompt,
      subreddit: subreddit || undefined,
      allowsPromotion,
      style: preset.id,
      theme: preset.title.toLowerCase(),
      preferredProvider: selectedProvider !== "auto" ? selectedProvider : undefined
    });
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

        {/* Cost Optimization Banner */}
        <div className="bg-gradient-to-r from-pink-50 to-purple-50 border border-pink-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Sparkles className="h-5 w-5 text-pink-600" />
              <span className="font-medium text-pink-900">Smart Content Creation</span>
            </div>
            <Badge className="bg-pink-100 text-pink-800">
              AI Powered
            </Badge>
          </div>
          <p className="text-sm text-pink-700 mt-2">
            Intelligent content generation optimized for women creators
          </p>
        </div>

        {/* Advanced Settings Toggle */}
        <div className="flex items-center space-x-2">
          <Switch
            id="advanced-settings"
            checked={useAdvancedSettings}
            onCheckedChange={setUseAdvancedSettings}
          />
          <Label htmlFor="advanced-settings">Advanced Settings</Label>
        </div>

        {/* Provider Selection (Advanced) */}
        {useAdvancedSettings && (
          <div className="space-y-2">
            <Label>Provider Preference</Label>
            <Select value={selectedProvider} onValueChange={setSelectedProvider}>
              <SelectTrigger>
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto (Optimized)</SelectItem>
                <SelectItem value="gemini">
                  Gemini Flash - Fast & Efficient
                </SelectItem>
                <SelectItem value="claude">
                  Claude Haiku - Balanced Performance
                </SelectItem>
                <SelectItem value="openai">
                  OpenAI GPT-4o - Premium Quality
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Platform Selection */}
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

        {/* Subreddit (for Reddit) */}
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

        {/* Promotion Level */}
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

        {/* Content Prompt */}
        <div className="space-y-2">
          <Label>Content Prompt</Label>
          <Textarea
            placeholder="Describe the content you want to create... (e.g., 'Cozy morning selfie with coffee')"
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            rows={4}
          />
        </div>

        {/* Generation Stats (Advanced) */}
        {useAdvancedSettings && (
          <div className="grid grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
            <div className="text-center">
              <Clock className="h-4 w-4 mx-auto mb-1 text-gray-600" />
              <div className="text-sm font-medium">Est. Time</div>
              <div className="text-xs text-gray-600">2-5 seconds</div>
            </div>
            <div className="text-center">
              <DollarSign className="h-4 w-4 mx-auto mb-1 text-gray-600" />
              <div className="text-sm font-medium">Est. Cost</div>
              <div className="text-xs text-gray-600">$0.001-0.02</div>
            </div>
            <div className="text-center">
              <TrendingUp className="h-4 w-4 mx-auto mb-1 text-gray-600" />
              <div className="text-sm font-medium">Quality</div>
              <div className="text-xs text-gray-600">Premium AI</div>
            </div>
          </div>
        )}

        {/* Generate Button */}
        <Button
          onClick={handleGenerate}
          disabled={generateContentMutation.isPending || !customPrompt.trim()}
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
              Generate AI Content
            </>
          )}
        </Button>

        {/* Guest Mode Limitation */}
        {isGuestMode && (
          <div className="text-center p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <p className="text-sm text-orange-700">
              🎯 <strong>Guest Mode:</strong> Limited to demo content. 
              <a href="/login" className="text-orange-800 underline ml-1">
                Sign up for full AI access
              </a>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}