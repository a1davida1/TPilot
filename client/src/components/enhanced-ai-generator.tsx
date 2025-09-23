` tags.

<replit_final_file>
import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { apiRequest, type ApiError } from "@/lib/queryClient";
import type { ContentGeneration } from "@shared/schema";
import { Sparkles, Brain, RefreshCw, Settings, Copy, Hash } from "lucide-react";

// Define types for mutation variables and response
interface GenerateContentVariables {
  platform?: string;
  style?: string;
  theme?: string;
  subreddit?: string;
  customPrompt?: string;
  prompt?: string;
  includePromotion?: boolean;
  allowsPromotion?: "none" | "subtle" | "direct";
}

interface UnifiedAIResponse {
  titles: string[];
  content: string;
  photoInstructions: {
    lighting: string;
    cameraAngle: string;
    composition: string;
    styling: string;
    mood: string;
    technicalSettings: string;
  };
  hashtags?: string[];
  caption?: string;
}

const photoInstructionFields: Array<{ key: keyof UnifiedAIResponse["photoInstructions"]; label: string }> = [
  { key: "lighting", label: "Lighting" },
  { key: "cameraAngle", label: "Camera Angle" },
  { key: "composition", label: "Composition" },
  { key: "styling", label: "Styling" },
  { key: "mood", label: "Mood" },
  { key: "technicalSettings", label: "Technical Settings" }
];

const photoTypes = [
  { id: 'selfie', label: 'Selfie', description: 'Casual self-portrait' },
  { id: 'portrait', label: 'Portrait', description: 'Professional headshot' },
  { id: 'lifestyle', label: 'Lifestyle', description: 'Daily activity shots' },
  { id: 'artistic', label: 'Artistic', description: 'Creative composition' },
];

const toneOptions = [
  { value: "confident", label: "Confident" },
  { value: "flirty", label: "Flirty" },
  { value: "playful", label: "Playful" },
  { value: "mysterious", label: "Mysterious" },
  { value: "friendly", label: "Friendly" },
];

interface EnhancedAIGeneratorProps {
  onContentGenerated: (content: ContentGeneration) => void;
  userTier?: string;
  canGenerate?: boolean;
}

export function EnhancedAIGenerator({ 
  onContentGenerated, 
  userTier = "guest",
  canGenerate = true 
}: EnhancedAIGeneratorProps) {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form state
  const [photoType, setPhotoType] = useState<string>("selfie");
  const [tone, setTone] = useState<string>("confident");
  const [customPrompt, setCustomPrompt] = useState<string>("");
  const [generatedContent, setGeneratedContent] = useState<UnifiedAIResponse | null>(null);
  const [copiedItem, setCopiedItem] = useState<string | null>(null);

  const isGuestMode = !isAuthenticated || userTier === 'guest';

  const tierConfig = {
    guest: {
      dailyLimit: 3,
      color: 'bg-gradient-to-br from-orange-50 to-amber-100 hover:from-orange-100 hover:to-amber-200 text-orange-900 border-2 border-orange-200 hover:border-orange-300 shadow-sm hover:shadow-md'
    },
    free: {
      dailyLimit: 10,
      color: 'bg-gradient-to-br from-orange-50 to-amber-100 hover:from-orange-100 hover:to-amber-200 text-orange-900 border-2 border-orange-200 hover:border-orange-300 shadow-sm hover:shadow-md'
    },
    pro: {
      dailyLimit: 100,
      color: 'bg-gradient-to-br from-orange-50 to-amber-100 hover:from-orange-100 hover:to-amber-200 text-orange-900 border-2 border-orange-200 hover:border-orange-300 shadow-sm hover:shadow-md'
    }
  };

  const currentTierConfig = tierConfig[userTier as keyof typeof tierConfig] || tierConfig.guest;

  const generateContentMutation = useMutation<UnifiedAIResponse, Error, GenerateContentVariables>({
    mutationFn: async (variables) => {
      const response = await apiRequest("POST", "/api/generate", variables);
      if (!response.ok) {
        throw new Error("Failed to generate content");
      }
      return (await response.json()) as UnifiedAIResponse;
    },
    onSuccess: (data, variables) => {
      const fallbackTitle = data.caption?.trim() || data.titles?.[0] || "AI Generated Content";
      const normalizedTitles = data.titles && data.titles.length > 0 ? data.titles : [fallbackTitle];
      const primaryContent = data.content?.trim() ? data.content : data.caption ?? fallbackTitle;
      const sanitizedHashtags = data.hashtags
        ?.map((tag) => tag.trim())
        .filter((tag) => tag.length > 0);
      const safePhotoInstructions = {
        lighting: data.photoInstructions?.lighting || "Use warm, soft lighting that flatters skin tones.",
        cameraAngle: data.photoInstructions?.cameraAngle || "Shoot at eye level or slightly above for a confident look.",
        composition: data.photoInstructions?.composition || "Center yourself and keep the framing clean.",
        styling: data.photoInstructions?.styling || "Match wardrobe and props to the vibe of the caption.",
        mood: data.photoInstructions?.mood || "Project confidence with relaxed, inviting expressions.",
        technicalSettings: data.photoInstructions?.technicalSettings || "Auto settings are fine; prioritize clear focus."
      };

      const normalizedResponse: UnifiedAIResponse = {
        titles: normalizedTitles,
        content: primaryContent,
        photoInstructions: safePhotoInstructions,
        caption: data.caption?.trim() || undefined,
        hashtags: sanitizedHashtags && sanitizedHashtags.length > 0 ? sanitizedHashtags : undefined
      };

      setGeneratedContent(normalizedResponse);

      const allowsPromotionValue =
        typeof variables.includePromotion === "boolean"
          ? variables.includePromotion
          : variables.allowsPromotion !== "none";

      // Transform the API response to match ContentGeneration interface for the callback
      const transformedContent: ContentGeneration = {
        id: 0, // Will be set by database
        userId: 0, // Will be set by database
        platform: variables.platform || "reddit",
        style: variables.style || "confident",
        theme: variables.theme || "general",
        titles: normalizedResponse.titles,
        content: normalizedResponse.content,
        photoInstructions: normalizedResponse.photoInstructions,
        prompt: variables.customPrompt || variables.prompt || "",
        subreddit: variables.subreddit,
        allowsPromotion: allowsPromotionValue,
        generationType: "ai",
        createdAt: new Date(),
      };

      onContentGenerated(transformedContent);

      toast({
        title: "Content Generated Successfully!",
        description: normalizedResponse.caption ?? normalizedResponse.titles[0] ?? "Your AI content is ready."
      });

      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Generation Failed",
        description: error.message || "Failed to generate content. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleGenerate = () => {
    generateContentMutation.mutate({
      platform: "reddit",
      style: tone,
      theme: photoType,
      customPrompt: customPrompt.trim() || undefined,
    });
  };

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedItem(type);
      toast({
        title: `${type} copied!`,
        description: "Content copied to clipboard",
      });
      setTimeout(() => setCopiedItem(null), 2000);
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Unable to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center">
              <Brain className="mr-2 h-5 w-5 text-orange-500" />
              <span className="bg-gradient-to-r from-orange-500 via-amber-500 to-red-500 bg-clip-text text-transparent">
                Enhanced AI Generator
              </span>
            </div>
          </div>
          {isGuestMode && (
            <Badge variant="secondary" className="bg-orange-100 text-orange-800">
              Guest Mode
            </Badge>
          )}
        </div>

        <div className="space-y-4">
          <div className="space-y-3">
            <h3 className="text-lg font-semibold mb-2 bg-gradient-to-r from-orange-500 via-amber-500 to-red-500 bg-clip-text text-transparent">
              Custom Prompt
            </h3>
            {generateContentMutation.isPending && (
              <div className="flex items-center justify-center space-x-2 py-4">
                <RefreshCw className="h-4 w-4 animate-spin text-orange-500" />
                <span className="text-sm text-muted-foreground">Generating content...</span>
              </div>
            )}
            <Textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              rows={3}
              className="border-orange-200 focus:ring-orange-500"
              placeholder="Describe what kind of content you want to generate..."
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-base font-medium text-orange-600">Photo Type</Label>
              <div className="grid grid-cols-2 gap-2">
                {photoTypes.map((type) => (
                  <Button
                    key={type.id}
                    variant="outline"
                    onClick={() => setPhotoType(type.id)}
                    className={`text-xs p-2 h-auto ${photoType === type.id ? 'bg-gradient-to-r from-orange-500 to-red-500 text-white shadow-lg shadow-orange-500/30 border-transparent' : 'text-orange-600 hover:bg-orange-50 border-orange-200'}`}
                  >
                    <div className="text-center">
                      <div className="font-medium">{type.label}</div>
                      <div className="text-xs opacity-80">{type.description}</div>
                    </div>
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-base font-medium text-amber-600">Text Tone</Label>
              <Select value={tone} onValueChange={setTone}>
                <SelectTrigger className="border-amber-200 focus:ring-amber-500">
                  <SelectValue placeholder="Select tone" />
                </SelectTrigger>
                <SelectContent>
                  {toneOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <Button
          onClick={handleGenerate}
          disabled={generateContentMutation.isPending}
          className="w-full bg-gradient-to-r from-orange-500 via-amber-500 to-red-500 hover:from-orange-600 hover:via-amber-500 hover:to-red-500 text-white font-medium"
          size="lg"
        >
          {generateContentMutation.isPending ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Sparkles className="mr-2 h-4 w-4" />
              Generate Content
            </>
          )}
        </Button>

        {generatedContent && (
          <div className="space-y-4 p-4 bg-gradient-to-br from-orange-50 via-amber-50 to-rose-100 rounded-lg border border-orange-200">
            <h4 className="font-semibold text-lg text-orange-800 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-orange-500" />
              Generated Content
            </h4>

            {generatedContent.titles && generatedContent.titles.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-orange-700">Titles:</Label>
                {generatedContent.titles.map((title, index) => (
                  <div key={`${title}-${index}`} className="relative p-3 bg-white rounded-lg border group">
                    <p className="text-sm font-medium pr-8">{title}</p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(title, "Title")}
                      className="absolute top-2 right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-orange-600"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {generatedContent.caption && generatedContent.caption !== generatedContent.content && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-amber-700">Caption:</Label>
                <div className="relative p-3 bg-white rounded-lg border group">
                  <p className="text-sm whitespace-pre-wrap pr-8">{generatedContent.caption}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(generatedContent.caption ?? "", "Caption")}
                    className="absolute top-2 right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-orange-600"
                  >
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-sm font-medium text-red-700">Content:</Label>
              <div className="relative p-3 bg-white rounded-lg border group">
                <p className="text-sm whitespace-pre-wrap pr-8">{generatedContent.content}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(generatedContent.content, "Content")}
                  className="absolute top-2 right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity text-orange-600"
                >
                  <Copy className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {generatedContent.hashtags && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-orange-700 flex items-center gap-1">
                  <Hash className="h-3 w-3" />
                  Hashtags:
                </Label>
                <div className="flex flex-wrap gap-2">
                  {generatedContent.hashtags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 rounded-full bg-orange-100 text-orange-800 text-xs font-semibold"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(generatedContent.hashtags!.join(" "), "Hashtags")}
                    className="h-7 px-2 text-xs text-orange-600 hover:text-orange-700"
                  >
                    <Copy className="h-3 w-3 mr-1" />
                    Copy all
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-sm font-medium text-amber-700">Photo Instructions:</Label>
              <div className="relative p-3 bg-white rounded-lg border">
                <dl className="grid gap-2 text-sm text-slate-700 dark:text-slate-200">
                  {photoInstructionFields.map(({ key, label }) => (
                    <div key={key} className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1">
                      <dt className="font-semibold text-orange-700">{label}</dt>
                      <dd className="sm:text-right">{generatedContent.photoInstructions[key]}</dd>
                    </div>
                  ))}
                </dl>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    copyToClipboard(JSON.stringify(generatedContent.photoInstructions, null, 2), "Photo Instructions")
                  }
                  className="absolute top-2 right-2 h-7 px-2 text-xs opacity-70 hover:opacity-100 text-orange-600"
                >
                  <Copy className="h-3 w-3 mr-1" />
                  Copy JSON
                </Button>
              </div>
            </div>
          </div>
        )}

        {isGuestMode && (
          <div className="text-center p-4 bg-orange-50 border border-orange-200 rounded-lg">
            <p className="text-sm text-orange-700">
              <a href="/login" className="text-orange-800 underline ml-1 font-medium">
                Sign up for full access
              </a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}