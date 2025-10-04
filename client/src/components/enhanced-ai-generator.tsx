import React, { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { AuthModal } from "@/components/auth-modal";
import { apiRequest, type ApiError } from "@/lib/queryClient";
import type { ContentGeneration } from "@shared/schema";
import { Sparkles, Brain, RefreshCw, Copy, Hash, Check } from "lucide-react";
import { assertExists } from "../../../helpers/assert";

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

// Assuming GeneratedContent is defined elsewhere and matches the structure of UnifiedAIResponse or similar
interface GeneratedContent {
  titles?: string[] | string;
  content?: string;
  photoInstructions?:
    | {
        lighting: string;
        cameraAngle: string;
        composition: string;
        styling: string;
        mood: string;
        technicalSettings: string;
      }
    | string;
  hashtags?: string[];
  caption?: string;
  id?: number;
  userId?: number;
  platform?: string;
  style?: string;
  theme?: string;
  prompt?: string;
  subreddit?: string;
  allowsPromotion?: boolean;
  generationType?: string;
  createdAt?: Date | string;
}


const photoInstructionFields: Array<{ key: keyof ContentGeneration["photoInstructions"]; label: string }> = [
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
  canGenerate: _canGenerate = true
}: EnhancedAIGeneratorProps) {
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Form state
  const [photoType, setPhotoType] = useState<string>("selfie");
  const [tone, setTone] = useState<string>("confident");
  const [customPrompt, setCustomPrompt] = useState<string>("");
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);
  // Copy feedback state with timeout tracking
  const [copiedItem, setCopiedItem] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"login" | "signup">("signup");

  const isGuestMode = !isAuthenticated || userTier === "guest";

  // TODO: Implement tier-based UI customization and limits
  const _tierConfig = {
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

  const basePhotoInstructions: ContentGeneration["photoInstructions"] = {
    lighting: "Soft natural lighting",
    cameraAngle: "Eye-level framing",
    composition: "Balanced composition highlighting the subject",
    styling: "Signature outfit and accessories",
    mood: "Confident and inviting",
    technicalSettings: "Auto settings"
  };

  const normalizePhotoInstructions = (
    instructions: GeneratedContent["photoInstructions"]
  ): ContentGeneration["photoInstructions"] => {
    if (instructions && typeof instructions === "object" && !Array.isArray(instructions)) {
      const typedInstructions = instructions as Record<string, unknown>;

      return {
        lighting:
          typeof typedInstructions.lighting === "string" && typedInstructions.lighting.trim().length > 0
            ? typedInstructions.lighting
            : basePhotoInstructions.lighting,
        cameraAngle:
          typeof typedInstructions.cameraAngle === "string" && typedInstructions.cameraAngle.trim().length > 0
            ? typedInstructions.cameraAngle
            : basePhotoInstructions.cameraAngle,
        composition:
          typeof typedInstructions.composition === "string" && typedInstructions.composition.trim().length > 0
            ? typedInstructions.composition
            : basePhotoInstructions.composition,
        styling:
          typeof typedInstructions.styling === "string" && typedInstructions.styling.trim().length > 0
            ? typedInstructions.styling
            : basePhotoInstructions.styling,
        mood:
          typeof typedInstructions.mood === "string" && typedInstructions.mood.trim().length > 0
            ? typedInstructions.mood
            : basePhotoInstructions.mood,
        technicalSettings:
          typeof typedInstructions.technicalSettings === "string" && typedInstructions.technicalSettings.trim().length > 0
            ? typedInstructions.technicalSettings
            : basePhotoInstructions.technicalSettings
      };
    }

    if (typeof instructions === "string" && instructions.trim().length > 0) {
      return {
        ...basePhotoInstructions,
        composition: instructions,
        mood: instructions
      };
    }

    return basePhotoInstructions;
  };

  const normalizeTitles = (titles: unknown): string[] => {
    if (Array.isArray(titles)) {
      const filtered = titles.filter((title): title is string => typeof title === "string" && title.trim().length > 0);
      if (filtered.length > 0) {
        return filtered;
      }
    }

    if (typeof titles === "string" && titles.trim().length > 0) {
      return [titles];
    }

    return ["Generated content ready to share"];
  };

  const generateContentMutation = useMutation<GeneratedContent, ApiError | Error, GenerateContentVariables>({
    mutationFn: async (data) => {
      const effectivePrompt = data.customPrompt || data.prompt || "";
      const response = await apiRequest("POST", "/api/generate-unified", {
        mode: "text",
        platform: data.platform || "reddit",
        style: data.style || "confident",
        theme: data.theme || "general",
        prompt: effectivePrompt,
        customInstructions: effectivePrompt,
        includePromotion:
          typeof data.includePromotion === "boolean"
            ? data.includePromotion
            : data.allowsPromotion !== "none"
      });
      return (await response.json()) as GeneratedContent;
    },
    onSuccess: (data, variables) => {
      setGeneratedContent(data);

      const candidate = data as Record<string, unknown>;
      const normalizedTitles = normalizeTitles(candidate.titles ?? data.titles);
      const normalizedPhotoInstructions = normalizePhotoInstructions(data.photoInstructions);
      const rawId = candidate.id;
      const id = typeof rawId === "number" ? rawId : Date.now();
      const rawUserId = candidate.userId;
      const userId = typeof rawUserId === "number" ? rawUserId : null;
      const rawCreatedAt = candidate.createdAt;
      const createdAt =
        rawCreatedAt instanceof Date
          ? rawCreatedAt
          : typeof rawCreatedAt === "string" && rawCreatedAt.trim().length > 0
            ? new Date(rawCreatedAt)
            : new Date();
      const resolvedPlatform =
        (typeof candidate.platform === "string" && candidate.platform.trim().length > 0
          ? candidate.platform
          : variables?.platform) || photoType;
      const resolvedStyle =
        (typeof candidate.style === "string" && candidate.style.trim().length > 0
          ? candidate.style
          : variables?.style) || tone;
      const resolvedTheme =
        (typeof candidate.theme === "string" && candidate.theme.trim().length > 0
          ? candidate.theme
          : variables?.theme) || photoType;
      const contentText =
        typeof data.content === "string" && data.content.trim().length > 0
          ? data.content
          : "Content generated successfully. Customize before sharing.";
      const candidatePrompt = candidate.prompt;
      const resolvedPrompt =
        typeof candidatePrompt === "string" && candidatePrompt.trim().length > 0
          ? candidatePrompt
          : variables?.customPrompt || variables?.prompt || (customPrompt.trim().length > 0 ? customPrompt : null);
      const candidateSubreddit = candidate.subreddit;
      const resolvedSubreddit =
        typeof candidateSubreddit === "string" && candidateSubreddit.trim().length > 0
          ? candidateSubreddit
          : variables?.subreddit || null;
      const candidateAllowsPromotion = candidate.allowsPromotion;
      const resolvedAllowsPromotion =
        typeof candidateAllowsPromotion === "boolean"
          ? candidateAllowsPromotion
          : Boolean(variables?.includePromotion ?? (typeof variables?.allowsPromotion === "string" ? variables.allowsPromotion !== "none" : false));
      const candidateGenerationType = candidate.generationType;
      const generationType =
        typeof candidateGenerationType === "string" && candidateGenerationType.trim().length > 0
          ? candidateGenerationType
          : "ai";

      const structuredGeneration: ContentGeneration = {
        id,
        userId,
        platform: resolvedPlatform,
        style: resolvedStyle,
        theme: resolvedTheme,
        titles: normalizedTitles,
        content: contentText,
        photoInstructions: normalizedPhotoInstructions,
        prompt: resolvedPrompt || null,
        subreddit: resolvedSubreddit || null,
        allowsPromotion: resolvedAllowsPromotion,
        generationType,
        createdAt
      };

      onContentGenerated(structuredGeneration);

      toast({
        title: "Content Generated Successfully!",
        description: structuredGeneration.titles[0] || "Your AI content is ready."
      });

      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
    },
    onError: (error) => {
      const apiError = error as ApiError;

      if (apiError?.isAuthError) {
        setAuthModalMode("login");
        setShowAuthModal(true);
        toast({
          title: "Authentication required",
          description: apiError.userMessage || "Please log in or create an account to generate content.",
        });
        return;
      }

      toast({
        title: "Generation Failed",
        description: apiError?.message || "Failed to generate content. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleGenerate = () => {
    if (isGuestMode) {
      setAuthModalMode("signup");
      setShowAuthModal(true);
      toast({
        title: "Create an account to continue",
        description: "Sign in or sign up to unlock AI content generation.",
      });
      return;
    }

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
      // Clear copied state after 2 seconds
      setTimeout(() => setCopiedItem(null), 2000);
    } catch (_error) {
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

        {isGuestMode ? (
          <Button
            onClick={() => {
              setAuthModalMode("signup");
              setShowAuthModal(true);
            }}
            className="w-full bg-gradient-to-r from-orange-500 via-amber-500 to-red-500 hover:from-orange-600 hover:via-amber-500 hover:to-red-500 text-white font-medium"
            size="lg"
          >
            <Sparkles className="mr-2 h-4 w-4" />
            Log in to generate content
          </Button>
        ) : (
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
        )}

        {generatedContent && (
          <div className="space-y-4 p-4 bg-gradient-to-br from-orange-50 via-amber-50 to-rose-100 rounded-lg border border-orange-200">
            <h4 className="font-semibold text-lg text-orange-800 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-orange-500" />
              Generated Content
            </h4>

            {generatedContent.titles && Array.isArray(generatedContent.titles) && generatedContent.titles.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-orange-700">Titles:</Label>
                {generatedContent.titles.map((title, index) => {
                  const isCopied = copiedItem === "Title";
                  return (
                    <div 
                      key={`${title}-${index}`} 
                      className={`relative p-3 bg-white rounded-lg border group transition-all duration-200 ${
                        isCopied ? 'ring-2 ring-green-500 bg-green-50' : ''
                      }`}
                    >
                      <p className="text-sm font-medium pr-8">{title}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => copyToClipboard(title, "Title")}
                        className={`absolute top-2 right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity ${
                          isCopied ? 'text-green-600 opacity-100' : 'text-orange-600'
                        }`}
                        aria-label={isCopied ? "Title copied" : "Copy title"}
                        data-testid="button-copy-title"
                      >
                        {isCopied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                      </Button>
                      {isCopied && (
                        <span className="sr-only" role="status" aria-live="polite">
                          Title copied to clipboard
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {generatedContent.caption && generatedContent.caption !== generatedContent.content && (
              <div className="space-y-2">
                <Label className="text-sm font-medium text-amber-700">Caption:</Label>
                <div 
                  className={`relative p-3 bg-white rounded-lg border group transition-all duration-200 ${
                    copiedItem === "Caption" ? 'ring-2 ring-green-500 bg-green-50' : ''
                  }`}
                >
                  <p className="text-sm whitespace-pre-wrap pr-8">{generatedContent.caption}</p>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => copyToClipboard(generatedContent.caption ?? "", "Caption")}
                    className={`absolute top-2 right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity ${
                      copiedItem === "Caption" ? 'text-green-600 opacity-100' : 'text-orange-600'
                    }`}
                    aria-label={copiedItem === "Caption" ? "Caption copied" : "Copy caption"}
                    data-testid="button-copy-caption"
                  >
                    {copiedItem === "Caption" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  </Button>
                  {copiedItem === "Caption" && (
                    <span className="sr-only" role="status" aria-live="polite">
                      Caption copied to clipboard
                    </span>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label className="text-sm font-medium text-red-700">Content:</Label>
              <div 
                className={`relative p-3 bg-white rounded-lg border group transition-all duration-200 ${
                  copiedItem === "Content" ? 'ring-2 ring-green-500 bg-green-50' : ''
                }`}
              >
                <p className="text-sm whitespace-pre-wrap pr-8">{generatedContent.content}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard(generatedContent.content ?? "", "Content")}
                  className={`absolute top-2 right-2 h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity ${
                    copiedItem === "Content" ? 'text-green-600 opacity-100' : 'text-orange-600'
                  }`}
                  aria-label={copiedItem === "Content" ? "Content copied" : "Copy content"}
                  data-testid="button-copy-content"
                >
                  {copiedItem === "Content" ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                </Button>
                {copiedItem === "Content" && (
                  <span className="sr-only" role="status" aria-live="polite">
                    Content copied to clipboard
                  </span>
                )}
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
                    onClick={() => {
                      assertExists(generatedContent.hashtags, 'Hashtags must exist to copy them');
                      copyToClipboard(generatedContent.hashtags.join(" "), "Hashtags");
                    }}
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

      {showAuthModal && (
        <AuthModal
          isOpen={showAuthModal}
          onClose={() => setShowAuthModal(false)}
          onSuccess={() => {
            setShowAuthModal(false);
            toast({
              title: "Welcome!",
              description: "You can now generate AI content.",
            });
          }}
          initialMode={authModalMode}
        />
      )}
    </div>
  );
}