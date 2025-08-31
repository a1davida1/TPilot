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
import { CaptionPreview } from "./CaptionPreview";
import { Loader2, Sparkles, Upload, AlertCircle, Image as ImageIcon, Type, Edit3 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const PLATFORMS = [
  { value: "reddit", label: "Reddit" },
  { value: "instagram", label: "Instagram" },
  { value: "x", label: "X (Twitter)" },
  { value: "tiktok", label: "TikTok" }
];

const VOICES = [
  { value: "flirty_playful", label: "Flirty & Playful" },
  { value: "gamer_nerdy", label: "Gamer & Nerdy" },
  { value: "luxury_minimal", label: "Luxury Minimal" },
  { value: "arts_muse", label: "Arts & Muse" },
  { value: "gym_energy", label: "Gym Energy" },
  { value: "cozy_girl", label: "Cozy Girl" }
];

export function GeminiCaptionGeneratorTabs() {
  // Shared states
  const [platform, setPlatform] = useState<string>("reddit");
  const [voice, setVoice] = useState<string>("flirty_playful");
  const [nsfw, setNsfw] = useState<boolean>(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [captionData, setCaptionData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  // Image tab states
  const [imageUrl, setImageUrl] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  // Text tab states
  const [theme, setTheme] = useState("");
  const [context, setContext] = useState("");
  
  // Rewrite tab states
  const [existingCaption, setExistingCaption] = useState("");
  const [rewriteImageUrl, setRewriteImageUrl] = useState("");

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, forRewrite = false) => {
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

    try {
      const response = await apiRequest('POST', '/api/caption/generate', {
        imageUrl, platform, voice, nsfw
      });

      const result = await response.json();

      setCaptionData(result);
      toast({
        title: "Content generated!",
        description: "Your AI-powered content is ready to use",
      });
    } catch (err: any) {
      console.error('Generation error:', err);
      setError(err.message || 'Failed to generate caption');
      toast({
        title: "Generation failed",
        description: err.message || 'Please try again',
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

    try {
      const response = await apiRequest('POST', '/api/caption/generate-text', {
        platform, voice, theme, context, nsfw
      });

      const result = await response.json();

      setCaptionData(result);
      toast({
        title: "Content generated!",
        description: "Your AI-powered content is ready to use",
      });
    } catch (err: any) {
      console.error('Generation error:', err);
      setError(err.message || 'Failed to generate caption');
      toast({
        title: "Generation failed",
        description: err.message || 'Please try again',
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

    try {
      const response = await fetch('/api/caption/rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          platform, 
          voice, 
          existingCaption, 
          imageUrl: rewriteImageUrl || undefined,
          nsfw
        })
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Rewrite failed');

      setCaptionData(result);
      toast({
        title: "Content rewritten!",
        description: "Your improved content is ready to use",
      });
    } catch (err: any) {
      console.error('Rewrite error:', err);
      setError(err.message || 'Failed to rewrite caption');
      toast({
        title: "Rewrite failed",
        description: err.message || 'Please try again',
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const PlatformVoiceSelectors = () => (
    <>
      <div className="space-y-2">
        <Label htmlFor="platform">Platform</Label>
        <Select value={platform} onValueChange={setPlatform}>
          <SelectTrigger id="platform">
            <SelectValue placeholder="Select platform" />
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
            <SelectValue placeholder="Select voice" />
          </SelectTrigger>
          <SelectContent>
            {VOICES.map(v => (
              <SelectItem key={v.value} value={v.value}>
                {v.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center space-x-2">
        <Checkbox
          id="nsfw"
          checked={nsfw}
          onCheckedChange={(checked) => setNsfw(checked as boolean)}
          data-testid="checkbox-nsfw"
        />
        <Label htmlFor="nsfw" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
          NSFW Content
        </Label>
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
              <div className="space-y-4">
                <Label>Image Source</Label>
                <div className="space-y-2">
                  <Input
                    type="url"
                    placeholder="https://example.com/image.jpg"
                    value={imageFile ? "" : imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    disabled={!!imageFile}
                    data-testid="input-image-url"
                  />
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <span>OR</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="image-upload" className="cursor-pointer">
                    <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-6 text-center hover:border-pink-400 dark:hover:border-pink-600 transition-colors">
                      {imagePreview ? (
                        <div className="space-y-2">
                          <img 
                            src={imagePreview} 
                            alt="Preview" 
                            className="mx-auto max-h-48 rounded-lg object-contain"
                            data-testid="img-preview"
                          />
                          <p className="text-sm text-muted-foreground">
                            {imageFile?.name}
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <Upload className="h-8 w-8 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">
                            Click to upload an image
                          </p>
                        </div>
                      )}
                    </div>
                    <Input
                      id="image-upload"
                      type="file"
                      accept="image/*"
                      onChange={(e) => handleImageUpload(e, false)}
                      className="hidden"
                      data-testid="input-image-file"
                    />
                  </Label>
                </div>
              </div>

              <PlatformVoiceSelectors />

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
                  placeholder="e.g., 'Morning coffee vibes' or 'Workout motivation'"
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
                  placeholder="Any additional details or specific requirements..."
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  rows={3}
                  className="w-full resize-none"
                  data-testid="textarea-context"
                />
              </div>

              <PlatformVoiceSelectors />

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
                  placeholder="Paste your existing content here..."
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
                  placeholder="https://example.com/image.jpg (optional)"
                  value={rewriteImageUrl}
                  onChange={(e) => setRewriteImageUrl(e.target.value)}
                  data-testid="input-rewrite-image-url"
                />
                <p className="text-sm text-muted-foreground">
                  Adding an image helps create more relevant content
                </p>
              </div>

              <PlatformVoiceSelectors />

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

      {/* Caption Preview - Shared across all tabs */}
      {captionData && (
        <CaptionPreview data={captionData} />
      )}
    </div>
  );
}