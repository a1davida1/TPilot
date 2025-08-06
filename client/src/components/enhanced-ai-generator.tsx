import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Sparkles, Brain, Zap, DollarSign, Clock, TrendingUp } from "lucide-react";
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

  const generateContentMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("/api/generate-ai", "POST", {
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

  // Cost information hidden from user interface - used internally for optimization

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center">
            <Brain className="mr-2 h-5 w-5" />
            Enhanced Content Generator
          </div>
          {isGuestMode && (
            <Badge variant="secondary" className="bg-orange-100 text-orange-800">
              Guest Mode
            </Badge>
          )}
        </CardTitle>
        <CardDescription>
          Generate engaging content optimized for your audience
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Cost Optimization Banner */}
        <div className="bg-gradient-to-r from-green-50 to-blue-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              <span className="font-medium text-green-900">Cost Optimization Active</span>
            </div>
            <Badge className="bg-green-100 text-green-800">
              Up to 98% savings
            </Badge>
          </div>
          <p className="text-sm text-green-700 mt-2">
            Intelligent provider selection for maximum cost efficiency
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
          className="w-full bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-700 hover:to-pink-700"
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