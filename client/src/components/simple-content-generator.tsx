import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Copy,
  Camera,
  Wand2,
  RefreshCw,
  CheckCircle
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface GeneratedContent {
  titles: string[];
  content: string;
  photoInstructions?: {
    lighting: string;
    angles: string[];
    composition: string;
    styling: string;
    technical: string;
  };
}

interface SimpleContentGeneratorProps {
  isGuestMode?: boolean;
  onContentGenerated?: (data: unknown) => void;
}

export function SimpleContentGenerator({ isGuestMode = false, onContentGenerated }: SimpleContentGeneratorProps) {
  const [platform, setPlatform] = useState("reddit");
  const [style, setStyle] = useState("playful");
  const [theme, setTheme] = useState("teasing");
  const [customPrompt, setCustomPrompt] = useState("");
  const [generatedContent, setGeneratedContent] = useState<GeneratedContent | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const generateContentMutation = useMutation({
    mutationFn: async (data: unknown) => {
      const response = await apiRequest("POST", "/api/generate-ai", {
        ...data,
        generationType: "prompt",
        userProfile: {
          toneOfVoice: "confident",
          contentStyle: "authentic", 
          personalBrand: "girl-next-door",
          contentLength: "medium",
          includeEmojis: true,
          promotionLevel: "moderate"
        }
      });
      return await response.json();
    },
    onSuccess: (data) => {
      // Transform the data to match our display format
      const displayData: GeneratedContent = {
        titles: Array.isArray(data.titles) ? data.titles : 
                typeof data.titles === 'string' ? [data.titles] :
                data.titles ? Object.values(data.titles).filter(Boolean) : [],
        content: data.content || "",
        photoInstructions: data.photoInstructions ? {
          lighting: data.photoInstructions.lighting || "Soft, warm lighting - preferably golden hour (1 hour before sunset) or use warm LED panels. Avoid harsh overhead lighting.",
          angles: data.photoInstructions.angles || [
            "Eye-level for intimate connection",
            "Slightly above for flattering perspective", 
            "Profile shot to show silhouette",
            "Over-shoulder looking back"
          ],
          composition: data.photoInstructions.composition || "Rule of thirds - place yourself off-center. Leave negative space for text overlay. Include interesting background elements but keep them soft/blurred.",
          styling: data.photoInstructions.styling || "Casual-chic outfit, natural makeup with emphasis on glowing skin, loose hair with movement, minimal jewelry for elegance",
          technical: data.photoInstructions.technical || "Use portrait mode or f/1.8-2.8 for background blur. ISO 100-400 for quality. Take multiple shots for variety. Shoot in RAW for editing flexibility."
        } : undefined
      };
      
      setGeneratedContent(displayData);
      onContentGenerated?.(data);
      
      toast({
        title: "Content Generated!",
        description: "Content and photo instructions created"
      });
      
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
    generateContentMutation.mutate({
      platform,
      customPrompt: `${style} ${theme} content. ${customPrompt}`.trim(),
      photoType: theme,
      textTone: style,
      includePromotion: true,
      includeHashtags: true,
      selectedHashtags: []
    });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied!",
      description: "Content copied to clipboard"
    });
  };

  return (
    <div className="space-y-6">
      {/* Content Generator */}
      <Card className="bg-gradient-to-br from-purple-900/20 to-pink-900/20 border-purple-500/30">
        <CardHeader>
          <CardTitle className="text-2xl">Content Creator</CardTitle>
          <CardDescription className="text-gray-300">
            Generate engaging content with professional photo guidance
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid md:grid-cols-3 gap-4">
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger className="bg-gray-900/50 border-purple-500/20">
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="reddit">Reddit</SelectItem>
                <SelectItem value="twitter">Twitter</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
                <SelectItem value="onlyfans">OnlyFans</SelectItem>
              </SelectContent>
            </Select>

            <Select value={style} onValueChange={setStyle}>
              <SelectTrigger className="bg-gray-900/50 border-purple-500/20">
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="playful">Playful & Flirty</SelectItem>
                <SelectItem value="mysterious">Mysterious</SelectItem>
                <SelectItem value="confident">Bold & Confident</SelectItem>
                <SelectItem value="intimate">Intimate & Personal</SelectItem>
              </SelectContent>
            </Select>

            <Select value={theme} onValueChange={setTheme}>
              <SelectTrigger className="bg-gray-900/50 border-purple-500/20">
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="teasing">Teasing</SelectItem>
                <SelectItem value="behind-scenes">Behind the Scenes</SelectItem>
                <SelectItem value="outfit">Outfit Reveal</SelectItem>
                <SelectItem value="lifestyle">Lifestyle</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            className="bg-gray-900/50 border-purple-500/20 min-h-[100px]"
          />

          <Button 
            onClick={handleGenerate}
            disabled={generateContentMutation.isPending}
            className="w-full bg-gradient-to-r from-purple-500 to-pink-500"
          >
            {generateContentMutation.isPending ? (
              <>
                <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Wand2 className="mr-2 h-4 w-4" />
                Generate Content & Photo Instructions
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Generated Content Output */}
      {generatedContent && (
        <div className="space-y-4 animate-in fade-in duration-500">
          {/* Generated Content */}
          <Card className="bg-gray-900/50 border-purple-500/20">
            <CardHeader>
              <CardTitle className="text-lg">Generated Content</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-gray-400 mb-2">Titles (pick one):</p>
                {generatedContent.titles.map((title, i) => (
                  <div key={i} className="flex items-center justify-between p-2 bg-purple-500/10 rounded mb-2">
                    <span className="text-sm">{title}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => copyToClipboard(title)}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
              
              <div>
                <p className="text-sm text-gray-400 mb-2">Content:</p>
                <div className="p-3 bg-purple-500/10 rounded">
                  <p className="whitespace-pre-wrap text-sm">{generatedContent.content}</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="mt-2"
                    onClick={() => copyToClipboard(generatedContent.content)}
                  >
                    <Copy className="h-3 w-3 mr-2" />
                    Copy Content
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Photo Instructions */}
          {generatedContent.photoInstructions && (
            <Card className="bg-gray-900/50 border-pink-500/20">
              <CardHeader>
                <CardTitle className="text-lg flex items-center">
                  <Camera className="mr-2 h-5 w-5" />
                  Photo Instructions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="p-3 bg-pink-500/10 rounded">
                  <p className="text-sm font-semibold text-pink-300 mb-1">Lighting:</p>
                  <p className="text-sm">{generatedContent.photoInstructions.lighting}</p>
                </div>
                
                <div className="p-3 bg-pink-500/10 rounded">
                  <p className="text-sm font-semibold text-pink-300 mb-1">Angles:</p>
                  <ul className="text-sm space-y-1">
                    {generatedContent.photoInstructions.angles.map((angle, i) => (
                      <li key={i} className="flex items-start">
                        <CheckCircle className="h-3 w-3 mr-2 mt-0.5 text-green-400" />
                        {angle}
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div className="p-3 bg-pink-500/10 rounded">
                  <p className="text-sm font-semibold text-pink-300 mb-1">Composition:</p>
                  <p className="text-sm">{generatedContent.photoInstructions.composition}</p>
                </div>
                
                <div className="p-3 bg-pink-500/10 rounded">
                  <p className="text-sm font-semibold text-pink-300 mb-1">Styling:</p>
                  <p className="text-sm">{generatedContent.photoInstructions.styling}</p>
                </div>
                
                <div className="p-3 bg-pink-500/10 rounded">
                  <p className="text-sm font-semibold text-pink-300 mb-1">Technical:</p>
                  <p className="text-sm">{generatedContent.photoInstructions.technical}</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}