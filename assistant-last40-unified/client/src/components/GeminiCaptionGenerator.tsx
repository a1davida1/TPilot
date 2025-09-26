import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CaptionPreview } from "./CaptionPreview";
import { Loader2, Sparkles, Upload, AlertCircle, Image as _ImageIcon } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { apiRequest, type ApiError } from "@/lib/queryClient";
import { getErrorMessage } from "@/utils/errorHelpers";
import type { GenerationResponse, CaptionPreviewData } from '@shared/types/caption';

const PLATFORMS = [
  { value: "instagram", label: "Instagram" },
  { value: "x", label: "X (Twitter)" },
  { value: "reddit", label: "Reddit" },
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

const FALLBACK_ERROR_INDICATORS = [
  "invalid image",
  "image data",
  "failed to fetch image",
  "unsupported content-type",
  "could not process image",
  "couldn't process image",
  "unable to process image",
  "image processing failed",
  "image could not be processed",
  "base64"
];

function isApiError(error: unknown): error is ApiError {
  return (
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as { status: unknown }).status === "number" &&
    "statusText" in error &&
    typeof (error as { statusText: unknown }).statusText === "string"
  );
}

function shouldUseTextFallback(error: ApiError): boolean {
  if (error.status === 422) {
    return true;
  }

  const normalizedMessage = `${error.userMessage ?? ""} ${error.message ?? ""} ${error.statusText ?? ""}`
    .toLowerCase();

  return FALLBACK_ERROR_INDICATORS.some(indicator =>
    normalizedMessage.includes(indicator)
  );
}

export function GeminiCaptionGenerator() {
  const [imageUrl, setImageUrl] = useState("");
  const [platform, setPlatform] = useState<string>("instagram");
  const [voice, setVoice] = useState<string>("flirty_playful");
  const [isGenerating, setIsGenerating] = useState(false);
  const [captionData, setCaptionData] = useState<GenerationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setImagePreview(base64);
        setImageUrl(base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = async () => {
    if (!imageUrl) {
      setError("Please provide an image URL or upload an image");
      return;
    }

    setIsGenerating(true);
    setError(null);
    setCaptionData(null);

    try {
      const response = await apiRequest('POST', '/api/caption/generate', {
        imageUrl,
        platform,
        voice
      });

      const result = await response.json();

      setCaptionData(result);
      toast({
        title: "Caption generated!",
        description: "Your AI-powered caption is ready to use",
      });
    } catch (err: unknown) {
      console.error('Generation error:', err);
      let finalError: unknown = err;

      if (isApiError(err) && shouldUseTextFallback(err)) {
        try {
          const fallbackResponse = await apiRequest('POST', '/api/caption/generate-text', {
            platform,
            voice,
            style: 'authentic',
            mood: 'engaging',
            theme: 'Image fallback caption',
            context: 'Auto-generated because the supplied image could not be processed.',
            nsfw: false
          });

          const fallbackResult = await fallbackResponse.json();
          setCaptionData(fallbackResult);
          toast({
            title: "Fallback caption generated",
            description: "We couldn't process the image, so we created a text-based caption instead.",
          });
          return;
        } catch (fallbackError: unknown) {
          console.error('Fallback generation error:', fallbackError);
          finalError = fallbackError;
        }
      }

      const rawMessage = isApiError(finalError)
        ? finalError.userMessage ?? finalError.message ?? 'Failed to generate caption'
        : getErrorMessage(finalError);
      const message = rawMessage ?? 'Failed to generate caption';
      setError(message);
      toast({
        title: "Generation failed",
        description: message || 'Please try again',
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRegenerate = () => {
    setCaptionData(null);
    handleGenerate();
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-pink-500" />
            AI Caption Generator (2-Pass Gemini)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Image Input Section */}
          <div className="space-y-4">
            <Label>Image Source</Label>
            
            {/* Image URL Input */}
            <div className="space-y-2">
              <Input
                type="url"
                value={imageFile ? "" : imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                disabled={!!imageFile}
              />
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <span>OR</span>
              </div>
            </div>

            {/* File Upload */}
            <div className="space-y-2">
              <Label htmlFor="image-upload" className="cursor-pointer">
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-6 text-center hover:border-pink-400 dark:hover:border-pink-600 transition-colors">
                  {imagePreview ? (
                    <div className="space-y-2">
                      <img 
                        src={imagePreview} 
                        alt="Preview" 
                        className="mx-auto max-h-48 rounded-lg object-contain"
                      />
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {imageFile?.name}
                      </p>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload className="h-8 w-8 text-gray-400" />
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Click to upload an image
                      </p>
                    </div>
                  )}
                </div>
                <Input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </Label>
            </div>
          </div>

          {/* Platform Selection */}
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

          {/* Voice Selection */}
          <div className="space-y-2">
            <Label htmlFor="voice">Content Voice</Label>
            <Select value={voice} onValueChange={setVoice}>
              <SelectTrigger id="voice">
                <SelectValue />
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

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Generate Button */}
          <Button
            onClick={handleGenerate}
            disabled={isGenerating || !imageUrl}
            className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating Caption...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Caption
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {captionData ? (
        <div className="space-y-4">
          <CaptionPreview data={captionData as CaptionPreviewData} />
          
          {/* Regenerate Button */}
          <Button
            onClick={handleRegenerate}
            variant="outline"
            className="w-full"
          >
            <Sparkles className="h-4 w-4 mr-2" />
            Regenerate with Different Variations
          </Button>

          {/* Debug Info (can be removed in production) */}
          {process.env.NODE_ENV === 'development' && (
            <details className="text-xs">
              <summary className="cursor-pointer text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">
                Debug: Image Facts
              </summary>
              <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded text-xs overflow-x-auto">
                {JSON.stringify(captionData?.facts, null, 2)}
              </pre>
            </details>
          )}
        </div>
      ) : null}
    </div>
  );
}