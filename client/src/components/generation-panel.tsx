import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import type { ContentGeneration } from "@shared/schema";
import { Sparkles, Copy, Check, Loader2 } from "lucide-react";

interface GenerationPanelProps {
  onContentGenerated: (generation: ContentGeneration) => void;
}

export function GenerationPanel({ onContentGenerated }: GenerationPanelProps) {
  const [platform, setPlatform] = useState("reddit");
  const [style, setStyle] = useState("playful");
  const [theme, setTheme] = useState("lifestyle");
  const [copiedItem, setCopiedItem] = useState<string | null>(null);
  const [generatedContent, setGeneratedContent] = useState<ContentGeneration | null>(null);

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const generateMutation = useMutation({
    mutationFn: async (data: { platform: string; style: string; theme: string }) => {
      const response = await apiRequest("POST", "/api/generate", data);
      return response.json();
    },
    onSuccess: (data: ContentGeneration) => {
      setGeneratedContent(data);
      onContentGenerated(data);
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Content Generated!",
        description: "Your new post content is ready.",
      });
    },
    onError: (error) => {
      toast({
        title: "Generation Failed",
        description: error instanceof Error ? error.message : "Failed to generate content",
        variant: "destructive",
      });
    },
  });

  const handleGenerate = () => {
    generateMutation.mutate({ platform, style, theme });
  };

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedItem(type);
      setTimeout(() => setCopiedItem(null), 1000);
      toast({
        title: "Copied!",
        description: `${type} copied to clipboard`,
      });
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="bg-white rounded-xl shadow-sm border border-gray-200">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900 flex items-center">
            <Sparkles className="text-accent mr-2 h-6 w-6" />
            Content Generator
          </h2>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">Platform:</span>
            <Select value={platform} onValueChange={setPlatform}>
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="reddit">Reddit</SelectItem>
                <SelectItem value="twitter">Twitter</SelectItem>
                <SelectItem value="instagram">Instagram</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Generation Options */}
        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Content Style</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {["playful", "mysterious", "bold", "elegant"].map((styleOption) => (
                <Button
                  key={styleOption}
                  variant={style === styleOption ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStyle(styleOption)}
                  className={style === styleOption ? "bg-primary text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}
                >
                  {styleOption.charAt(0).toUpperCase() + styleOption.slice(1)}
                </Button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Theme Focus</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {["lifestyle", "fashion", "artistic"].map((themeOption) => (
                <Button
                  key={themeOption}
                  variant={theme === themeOption ? "default" : "outline"}
                  size="sm"
                  onClick={() => setTheme(themeOption)}
                  className={theme === themeOption ? "bg-secondary text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"}
                >
                  {themeOption.charAt(0).toUpperCase() + themeOption.slice(1)}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {/* Generate Button */}
        <div className="text-center">
          <Button
            onClick={handleGenerate}
            disabled={generateMutation.isPending}
            className="bg-gradient-to-r from-primary to-secondary text-white px-8 py-4 text-lg font-semibold hover:from-indigo-700 hover:to-purple-700 transition-all duration-200 transform hover:scale-105 shadow-lg"
          >
            {generateMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-5 w-5" />
                {generatedContent ? "Generate New Content" : "Generate Content"}
              </>
            )}
          </Button>
        </div>

        {/* Generated Content Display */}
        {generatedContent && (
          <div className="mt-8 space-y-6">
            {/* Title Options */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                <span className="text-primary mr-2">#</span>
                Generated Titles
              </h3>
              <div className="space-y-2">
                {generatedContent.titles.map((title, index) => (
                  <div
                    key={index}
                    className="bg-white p-3 rounded-lg border border-gray-200 cursor-pointer hover:border-primary transition-colors flex items-center justify-between"
                  >
                    <span className="text-gray-800 flex-1">{title}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => copyToClipboard(title, `Title ${index + 1}`)}
                      className="text-primary hover:text-indigo-700 ml-2"
                    >
                      {copiedItem === `Title ${index + 1}` ? (
                        <Check className="h-4 w-4 text-green-500" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </div>

            {/* Post Content */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                <span className="text-secondary mr-2">✏️</span>
                Post Content
              </h3>
              <div className="bg-white p-4 rounded-lg border border-gray-200">
                <div className="whitespace-pre-line text-gray-800 mb-3">
                  {generatedContent.content}
                </div>
                <Button
                  variant="ghost"
                  onClick={() => copyToClipboard(generatedContent.content, "Post Content")}
                  className="text-primary hover:text-indigo-700 font-medium"
                >
                  {copiedItem === "Post Content" ? (
                    <>
                      <Check className="mr-1 h-4 w-4 text-green-500" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="mr-1 h-4 w-4" />
                      Copy Content
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
