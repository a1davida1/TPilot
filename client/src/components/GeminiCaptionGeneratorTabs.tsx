import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
// Switch component not currently used in this component
import { CaptionPreview } from "./CaptionPreview";
import { RedditNativeUploadPortal } from "./RedditNativeUploadPortal";
import { Loader2, Sparkles, AlertCircle, Image as ImageIcon, Type, Edit3 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { getErrorMessage } from '@/utils/errorHelpers';
import { cn } from "@/lib/utils";
import type { GenerationResponse, CaptionPreviewData } from '@shared/types/caption';

const PLATFORMS = [
  { value: "reddit", label: "Reddit" },
  { value: "instagram", label: "Instagram" },
  { value: "x", label: "X (Twitter)" },
  { value: "tiktok", label: "TikTok" }
];

const SFW_VOICES = [
  { value: "flirty_playful", label: "Flirty & Playful" },
  { value: "gamer_nerdy", label: "Gamer & Nerdy" },
  { value: "luxury_minimal", label: "Luxury Minimal" },
  { value: "arts_muse", label: "Arts & Muse" },
  { value: "gym_energy", label: "Gym Energy" },
  { value: "cozy_girl", label: "Cozy Girl" }
];

const NSFW_VOICES = [
  { value: "seductive_goddess", label: "Seductive Goddess" },
  { value: "intimate_girlfriend", label: "Intimate Girlfriend" },
  { value: "bratty_tease", label: "Bratty Tease" },
  { value: "submissive_kitten", label: "Submissive Kitten" }
];

const STYLES = [
  { value: "explicit", label: "Explicit" },
  { value: "poetic", label: "Poetic" },
  { value: "chill", label: "Chill" },
  { value: "playful", label: "Playful" },
  { value: "mysterious", label: "Mysterious" },
  { value: "confident", label: "Confident" },
  { value: "elegant", label: "Elegant" },
  { value: "casual", label: "Casual" }
];

const MOODS = [
  { value: "seductive", label: "Seductive" },
  { value: "romantic", label: "Romantic" },
  { value: "energetic", label: "Energetic" },
  { value: "relaxed", label: "Relaxed" },
  { value: "intimate", label: "Intimate" },
  { value: "adventurous", label: "Adventurous" },
  { value: "dreamy", label: "Dreamy" },
  { value: "bold", label: "Bold" }
];

interface CaptionOption {
  id: string;
  text: string;
  style: string;
}

export function GeminiCaptionGeneratorTabs() {
  // Shared states
  const [platform, setPlatform] = useState<string>("reddit");
  const [voice, setVoice] = useState<string>("flirty_playful");
  const [style, setStyle] = useState<string>("playful");
  const [mood, setMood] = useState<string>("seductive");
  const [nsfw, setNsfw] = useState<boolean>(false);
  const [promotionMode, setPromotionMode] = useState<'none' | 'subtle' | 'explicit'>('none');
  
  // Dynamic voice list based on NSFW state
  const availableVoices = nsfw ? NSFW_VOICES : SFW_VOICES;
  
  // Auto-switch voice when NSFW checkbox changes
  const handleNsfwChange = (checked: boolean) => {
    setNsfw(checked);
    // Switch to appropriate voice when toggling NSFW
    if (checked) {
      setVoice("seductive_goddess"); // Default NSFW voice
    } else {
      setVoice("flirty_playful"); // Default SFW voice
    }
  };
  const [includeHashtags, setIncludeHashtags] = useState<boolean>(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [captionData, setCaptionData] = useState<GenerationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Caption variant selection states
  const [captionOptions, setCaptionOptions] = useState<CaptionOption[]>([]);
  const [selectedCaption, setSelectedCaption] = useState<string>('');
  
  // Image tab states
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [_imagePreview, setImagePreview] = useState<string | null>(null);
  
  // Text tab states
  const [theme, setTheme] = useState("");
  const [context, setContext] = useState("");
  
  // Rewrite tab states
  const [existingCaption, setExistingCaption] = useState("");
  const [rewriteImageUrl, setRewriteImageUrl] = useState("");

  const _handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, forRewrite = false) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid file",
          description: "Please upload an image file",
          variant: "destructive"
        });
        return;
      }
      
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        if (forRewrite) {
          setRewriteImageUrl(base64);
        } else {
          setImageFile(file);
          setImagePreview(base64);
          setImageUrl(base64);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerateImage = async () => {
    if (!imageUrl && !imageFile) {
      setError("Please provide an image URL or upload an image");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setCaptionData(null);
    setCaptionOptions([]);
    setSelectedCaption('');

    try {
      const response = await apiRequest('POST', '/api/caption/generate', {
        imageUrl, platform, voice, style, mood, nsfw, includeHashtags, promotionMode
      });

      const result = await response.json() as { topVariants?: Array<{ caption: string; style?: string }>; final?: { caption: string } };

      // Extract top 2 variants from response
      const topVariants = result.topVariants || [];

      if (topVariants.length >= 2) {
        const options = [
          { id: '1', text: topVariants[0].caption, style: topVariants[0].style || 'Top Choice' },
          { id: '2', text: topVariants[1].caption, style: topVariants[1].style || 'Alternative' }
        ];
        setCaptionOptions(options);
        setSelectedCaption(options[0].id); // Auto-select first option
      } else if (topVariants.length === 1) {
        const options = [
          { id: '1', text: topVariants[0].caption, style: 'Generated Caption' },
          { id: '2', text: topVariants[0].caption, style: 'Same Caption' }
        ];
        setCaptionOptions(options);
        setSelectedCaption(options[0].id);
      } else if (result.final) {
        // Fallback to final if topVariants not available
        const finalCaption = typeof result.final === 'string' ? result.final : result.final.caption;
        const options = [
          { id: '1', text: finalCaption, style: 'Generated Caption' },
          { id: '2', text: finalCaption, style: 'Same Caption' }
        ];
        setCaptionOptions(options);
        setSelectedCaption(options[0].id);
      }

      // Store the full result for CaptionPreview
      setCaptionData(result as GenerationResponse);

      toast({
        title: "Content generated!",
        description: "Choose your preferred caption variant",
      });
    } catch (err: unknown) {
      console.error('Generation error:', err);
      setError(getErrorMessage(err) || 'Failed to generate caption');
      toast({
        title: "Generation failed",
        description: getErrorMessage(err) || 'Please try again',
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGenerateText = async () => {
    if (!theme) {
      setError("Please provide a theme for your content");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setCaptionData(null);
    setCaptionOptions([]);
    setSelectedCaption('');

    try {
      const response = await apiRequest('POST', '/api/caption/generate-text', {
        platform, voice, style, mood, theme, context, nsfw, includeHashtags, promotionMode
      });

      const result = await response.json() as { topVariants?: Array<{ caption: string; style?: string }>; final?: { caption: string } };

      // Extract top 2 variants from response
      const topVariants = result.topVariants || [];

      if (topVariants.length >= 2) {
        const options = [
          { id: '1', text: topVariants[0].caption, style: topVariants[0].style || 'Top Choice' },
          { id: '2', text: topVariants[1].caption, style: topVariants[1].style || 'Alternative' }
        ];
        setCaptionOptions(options);
        setSelectedCaption(options[0].id);
      } else if (topVariants.length === 1) {
        const options = [
          { id: '1', text: topVariants[0].caption, style: 'Generated Caption' },
          { id: '2', text: topVariants[0].caption, style: 'Same Caption' }
        ];
        setCaptionOptions(options);
        setSelectedCaption(options[0].id);
      } else if (result.final) {
        const finalCaption = typeof result.final === 'string' ? result.final : result.final.caption;
        const options = [
          { id: '1', text: finalCaption, style: 'Generated Caption' },
          { id: '2', text: finalCaption, style: 'Same Caption' }
        ];
        setCaptionOptions(options);
        setSelectedCaption(options[0].id);
      }

      setCaptionData(result as GenerationResponse);

      toast({
        title: "Content generated!",
        description: "Choose your preferred caption variant",
      });
    } catch (err: unknown) {
      console.error('Generation error:', err);
      setError(getErrorMessage(err) || 'Failed to generate caption');
      toast({
        title: "Generation failed",
        description: getErrorMessage(err) || 'Please try again',
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRewrite = async () => {
    if (!existingCaption) {
      setError("Please provide existing content to rewrite");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setCaptionData(null);
    setCaptionOptions([]);
    setSelectedCaption('');

    try {
      const response = await apiRequest('POST', '/api/caption/rewrite', {
        platform,
        voice,
        style,
        mood,
        existingCaption,
        imageUrl: rewriteImageUrl || undefined,
        nsfw,
        includeHashtags,
        promotionMode,
      });

      const result = await response.json() as { 
        topVariants?: Array<{ caption: string; style?: string }>; 
        final?: { caption: string };
        error?: string;
      };
      if (!response.ok) throw new Error(result.error || 'Rewrite failed');

      // Extract top 2 variants from response
      const topVariants = result.topVariants || [];

      if (topVariants.length >= 2) {
        const options = [
          { id: '1', text: topVariants[0].caption, style: topVariants[0].style || 'Top Choice' },
          { id: '2', text: topVariants[1].caption, style: topVariants[1].style || 'Alternative' }
        ];
        setCaptionOptions(options);
        setSelectedCaption(options[0].id);
      } else if (topVariants.length === 1) {
        const options = [
          { id: '1', text: topVariants[0].caption, style: 'Generated Caption' },
          { id: '2', text: topVariants[0].caption, style: 'Same Caption' }
        ];
        setCaptionOptions(options);
        setSelectedCaption(options[0].id);
      } else if (result.final) {
        const finalCaption = typeof result.final === 'string' ? result.final : result.final.caption;
        const options = [
          { id: '1', text: finalCaption, style: 'Generated Caption' },
          { id: '2', text: finalCaption, style: 'Same Caption' }
        ];
        setCaptionOptions(options);
        setSelectedCaption(options[0].id);
      }

      setCaptionData(result as GenerationResponse);

      toast({
        title: "Content rewritten!",
        description: "Choose your preferred caption variant",
      });
    } catch (err: unknown) {
      console.error('Rewrite error:', err);
      setError(getErrorMessage(err) || 'Failed to rewrite caption');
      toast({
        title: "Rewrite failed",
        description: getErrorMessage(err) || 'Please try again',
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const PlatformVoiceSelectors = () => (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="platform">Platform</Label>
          <Select value={platform} onValueChange={setPlatform}>
            <SelectTrigger id="platform">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PLATFORMS.map(p => (
                <SelectItem key={p.value} value={p.value}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="voice">Content Voice</Label>
          <Select value={voice} onValueChange={setVoice}>
            <SelectTrigger id="voice">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {availableVoices.map(v => (
                <SelectItem key={v.value} value={v.value}>
                  {v.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="style">Content Style</Label>
          <Select value={style} onValueChange={setStyle}>
            <SelectTrigger id="style">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STYLES.map(s => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="mood">Content Mood</Label>
          <Select value={mood} onValueChange={setMood}>
            <SelectTrigger id="mood">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MOODS.map(m => (
                <SelectItem key={m.value} value={m.value}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center space-x-2 pt-4">
        <Checkbox
          id="nsfw"
          checked={nsfw}
          onCheckedChange={(checked) => handleNsfwChange(checked as boolean)}
          data-testid="checkbox-nsfw"
        />
        <Label htmlFor="nsfw" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          NSFW Content (switches to explicit voices)
        </Label>
      </div>

      <div className="flex items-start gap-2 pt-2">
        <Checkbox
          id="include-hashtags"
          checked={includeHashtags}
          onCheckedChange={(checked) => setIncludeHashtags(Boolean(checked))}
          data-testid="checkbox-include-hashtags"
        />
        <div className="space-y-1">
          <Label htmlFor="include-hashtags" className="text-sm font-medium leading-none">
            Include Hashtags
          </Label>
          <p className="text-xs text-muted-foreground max-w-xs">
            Disable to generate clean captions without hashtag callouts. Enable for contextual tag recommendations.
          </p>
        </div>
      </div>

      {/* Promotion Mode */}
      <div className="space-y-2 pt-4">
        <Label className="text-sm font-medium">Promotion Mode</Label>
        <RadioGroup value={promotionMode} onValueChange={(value) => setPromotionMode(value as 'none' | 'subtle' | 'explicit')}>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="none" id="promo-none" />
            <Label htmlFor="promo-none" className="text-sm font-normal cursor-pointer">
              None - No promotional CTAs
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="subtle" id="promo-subtle" />
            <Label htmlFor="promo-subtle" className="text-sm font-normal cursor-pointer">
              Subtle - "Check my profile", "DM for more"
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <RadioGroupItem value="explicit" id="promo-explicit" />
            <Label htmlFor="promo-explicit" className="text-sm font-normal cursor-pointer">
              Explicit - Includes your OnlyFans/Fansly URL
            </Label>
          </div>
        </RadioGroup>
        {promotionMode === 'explicit' && (
          <Alert className="mt-2">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="text-xs">
              Make sure to add your OnlyFans or Fansly URL in <a href="/settings" className="underline font-medium">Settings</a> for this to work.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </>
  );

  return (
    <div className="space-y-6">
      <Tabs defaultValue="image" className="w-full relative z-10">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="image" className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4" />
            Image → Content
          </TabsTrigger>
          <TabsTrigger value="text" className="flex items-center gap-2">
            <Type className="h-4 w-4" />
            Text → Content
          </TabsTrigger>
          <TabsTrigger value="rewrite" className="flex items-center gap-2">
            <Edit3 className="h-4 w-4" />
            Rewrite
          </TabsTrigger>
        </TabsList>

        {/* Image → Caption Tab */}
        <TabsContent value="image" className="mt-0">
          <Card className="relative z-10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-pink-500" />
                Generate Content from Image
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Replace old upload UI with RedditNativeUploadPortal */}
              <RedditNativeUploadPortal
                onComplete={(result) => {
                  setImageUrl(result.imageUrl);
                  setImagePreview(result.imageUrl);
                  // Clear file if using URL
                  setImageFile(null);
                  toast({
                    title: "✅ Image uploaded!",
                    description: `Ready to generate content. URL: ${result.imageUrl.substring(0, 50)}...`,
                  });
                }}
                showPreview={true} // Show preview with uploaded URL
              />

              <PlatformVoiceSelectors />

              {/* Caption Variant Selection - Image Tab */}
              {captionOptions.length > 0 && (
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Choose Your Caption</Label>
                    <p className="text-xs text-muted-foreground mt-1">Select your preferred caption variant</p>
                  </div>

                  <RadioGroup value={selectedCaption} onValueChange={setSelectedCaption}>
                    <div className="space-y-3">
                      {captionOptions.map((option) => (
                        <Card
                          key={option.id}
                          className={cn(
                            "cursor-pointer transition-all",
                            selectedCaption === option.id && "border-purple-500 bg-purple-50 dark:bg-purple-950/20"
                          )}
                          onClick={() => setSelectedCaption(option.id)}
                        >
                          <CardHeader className="pb-2">
                            <div className="flex items-center gap-2">
                              <RadioGroupItem value={option.id} />
                              <Badge variant="secondary">{option.style}</Badge>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm">{option.text}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </RadioGroup>
                </div>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                onClick={handleGenerateImage}
                disabled={isGenerating || (!imageUrl && !imageFile)}
                className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white"
                data-testid="button-generate-image"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating with 2-Pass Pipeline...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Generate Content from Image
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Text → Caption Tab */}
        <TabsContent value="text" className="mt-0">
          <Card className="relative z-10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Type className="h-5 w-5 text-blue-500" />
                Generate Content from Text
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="theme">Content Theme / Topic</Label>
                <Input
                  id="theme"
                  type="text"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value)}
                  className="w-full"
                  data-testid="input-theme"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="context">Additional Context (Optional)</Label>
                <Textarea
                  id="context"
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  rows={3}
                  className="w-full resize-none"
                  data-testid="textarea-context"
                />
              </div>

              <PlatformVoiceSelectors />

              {/* Caption Variant Selection - Text Tab */}
              {captionOptions.length > 0 && (
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Choose Your Caption</Label>
                    <p className="text-xs text-muted-foreground mt-1">Select your preferred caption variant</p>
                  </div>

                  <RadioGroup value={selectedCaption} onValueChange={setSelectedCaption}>
                    <div className="space-y-3">
                      {captionOptions.map((option) => (
                        <Card
                          key={option.id}
                          className={cn(
                            "cursor-pointer transition-all",
                            selectedCaption === option.id && "border-purple-500 bg-purple-50 dark:bg-purple-950/20"
                          )}
                          onClick={() => setSelectedCaption(option.id)}
                        >
                          <CardHeader className="pb-2">
                            <div className="flex items-center gap-2">
                              <RadioGroupItem value={option.id} />
                              <Badge variant="secondary">{option.style}</Badge>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm">{option.text}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </RadioGroup>
                </div>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                onClick={handleGenerateText}
                disabled={isGenerating || !theme}
                className="w-full bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white"
                data-testid="button-generate-text"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating Content...
                  </>
                ) : (
                  <>
                    <Type className="mr-2 h-4 w-4" />
                    Generate Content from Text
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Rewrite Tab */}
        <TabsContent value="rewrite" className="mt-0">
          <Card className="relative z-10">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Edit3 className="h-5 w-5 text-green-500" />
                Rewrite Existing Content
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="existing">Existing Content</Label>
                <Textarea
                  id="existing"
                  value={existingCaption}
                  onChange={(e) => setExistingCaption(e.target.value)}
                  rows={4}
                  data-testid="textarea-existing-caption"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="rewrite-image">Optional: Add Image for Context</Label>
                <Input
                  id="rewrite-image"
                  type="url"
                  value={rewriteImageUrl}
                  onChange={(e) => setRewriteImageUrl(e.target.value)}
                  data-testid="input-rewrite-image-url"
                />
                <p className="text-sm text-muted-foreground">
                  Adding an image helps create more relevant content
                </p>
              </div>

              <PlatformVoiceSelectors />

              {/* Caption Variant Selection - Rewrite Tab */}
              {captionOptions.length > 0 && (
                <div className="space-y-4">
                  <div>
                    <Label className="text-sm font-medium">Choose Your Caption</Label>
                    <p className="text-xs text-muted-foreground mt-1">Select your preferred caption variant</p>
                  </div>

                  <RadioGroup value={selectedCaption} onValueChange={setSelectedCaption}>
                    <div className="space-y-3">
                      {captionOptions.map((option) => (
                        <Card
                          key={option.id}
                          className={cn(
                            "cursor-pointer transition-all",
                            selectedCaption === option.id && "border-purple-500 bg-purple-50 dark:bg-purple-950/20"
                          )}
                          onClick={() => setSelectedCaption(option.id)}
                        >
                          <CardHeader className="pb-2">
                            <div className="flex items-center gap-2">
                              <RadioGroupItem value={option.id} />
                              <Badge variant="secondary">{option.style}</Badge>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <p className="text-sm">{option.text}</p>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </RadioGroup>
                </div>
              )}

              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                onClick={handleRewrite}
                disabled={isGenerating || !existingCaption}
                className="w-full bg-gradient-to-r from-green-500 to-purple-500 hover:from-green-600 hover:to-purple-600 text-white"
                data-testid="button-rewrite"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Rewriting Content...
                  </>
                ) : (
                  <>
                    <Edit3 className="mr-2 h-4 w-4" />
                    Rewrite Content
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Show CaptionPreview only when a caption is selected */}
      {captionData && selectedCaption && captionOptions.length > 0 ? (() => {
        // Find the selected caption option
        const selectedOption = captionOptions.find(opt => opt.id === selectedCaption);

        if (!selectedOption) return null;

        // Construct preview data with the selected caption
        const previewData: CaptionPreviewData = {
          ...captionData,
          final: selectedOption.text
        };

        return (
          <CaptionPreview
            data={previewData}
            includeHashtags={includeHashtags}
            platform={platform}
          />
        );
      })() : null}
    </div>
  );
}