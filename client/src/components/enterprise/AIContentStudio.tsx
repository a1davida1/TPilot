import React, { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, Copy, RefreshCw, Hash, Camera, Zap } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface GeneratedContent {
  platform: string;
  titles: string[];
  body: string;
  photoInstructions?: string;
  hashtags?: string[];
  style: string;
  confidence: number;
}

interface AiResponse {
  content: GeneratedContent[];
  tokensUsed: number;
  model: string;
  cached: boolean;
}

export default function AIContentStudio() {
  const [prompt, setPrompt] = useState('');
  const [platforms, setPlatforms] = useState(['reddit']);
  const [styleHints, setStyleHints] = useState(['authentic']);
  const [variants, setVariants] = useState(1);
  const [generatedContent, setGeneratedContent] = useState<AiResponse | null>(null);

  const { toast } = useToast();

  // AI generation mutation
  const generateMutation = useMutation({
    mutationFn: async (data: {
      prompt?: string;
      platforms: string[];
      styleHints?: string[];
      variants: number;
    }) => {
      const response = await apiRequest('POST', '/api/ai/generate', data);
      return response.json();
    },
    onSuccess: (data: unknown) => {
      const aiResponse = data as AiResponse;
      setGeneratedContent(aiResponse);
      toast({
        title: "Content generated",
        description: `Generated ${aiResponse.content.length} platform variations${aiResponse.cached ? ' (from cache)' : ''}`,
      });
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : "Failed to generate content";
      toast({
        title: "Generation failed",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const handleGenerate = () => {
    // Allow generation even without specific prompt if platforms are selected
    if (!prompt.trim() && platforms.length === 0) {
      toast({
        title: "Let's get started!",
        description: "Select platforms or add a prompt to generate content",
      });
      return;
    }

    // Show immediate feedback
    toast({
      title: "Generating content...",
      description: "AI is creating your content",
    });

    generateMutation.mutate({
      prompt: prompt.trim() || undefined,
      platforms,
      styleHints: styleHints.length > 0 ? styleHints : undefined,
      variants,
    });
  };

  const copyToClipboard = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({
        title: "Copied!",
        description: `${type} copied to clipboard`,
      });
    } catch {
      toast({
        title: "Copy failed",
        description: "Unable to copy to clipboard",
        variant: "destructive",
      });
    }
  };

  const platformOptions = [
    { value: 'reddit', label: 'Reddit' },
    { value: 'twitter', label: 'Twitter' },
    { value: 'instagram', label: 'Instagram' },
    { value: 'tiktok', label: 'TikTok' },
  ];

  const styleOptions = [
    { value: 'authentic', label: 'Authentic' },
    { value: 'playful', label: 'Playful' },
    { value: 'confident', label: 'Confident' },
    { value: 'mysterious', label: 'Mysterious' },
    { value: 'bold', label: 'Bold' },
    { value: 'sassy', label: 'Sassy' },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Sparkles className="h-8 w-8 text-purple-500" />
        <div>
          <h2 className="text-2xl font-bold">AI Content Studio</h2>
          <p className="text-gray-600">Generate engaging content with advanced AI models</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5" />
              Content Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Prompt Input */}
            <div>
              <label className="block text-sm font-medium mb-2">Content Prompt</label>
              <Textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={3}
                data-testid="textarea-prompt"
              />
            </div>

            {/* Platform Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">Platforms</label>
              <div className="flex flex-wrap gap-2">
                {platformOptions.map((platform) => (
                  <Button
                    key={platform.value}
                    variant={platforms.includes(platform.value) ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      if (platforms.includes(platform.value)) {
                        setPlatforms(platforms.filter(p => p !== platform.value));
                      } else {
                        setPlatforms([...platforms, platform.value]);
                      }
                    }}
                    data-testid={`button-platform-${platform.value}`}
                  >
                    {platform.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Style Selection */}
            <div>
              <label className="block text-sm font-medium mb-2">Content Style</label>
              <div className="flex flex-wrap gap-2">
                {styleOptions.map((style) => (
                  <Button
                    key={style.value}
                    variant={styleHints.includes(style.value) ? "default" : "outline"}
                    size="sm"
                    onClick={() => {
                      if (styleHints.includes(style.value)) {
                        setStyleHints(styleHints.filter(s => s !== style.value));
                      } else {
                        setStyleHints([...styleHints, style.value]);
                      }
                    }}
                    data-testid={`button-style-${style.value}`}
                  >
                    {style.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* Variants */}
            <div>
              <label className="block text-sm font-medium mb-2">Variants</label>
              <Select value={variants.toString()} onValueChange={(value) => setVariants(parseInt(value))}>
                <SelectTrigger data-testid="select-variants">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 variant</SelectItem>
                  <SelectItem value="2">2 variants</SelectItem>
                  <SelectItem value="3">3 variants</SelectItem>
                  <SelectItem value="5">5 variants</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button 
              onClick={handleGenerate} 
              disabled={generateMutation.isPending}
              className="w-full"
              data-testid="button-generate-content"
            >
              {generateMutation.isPending ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Generate Content
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Results Panel */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Generated Content
              {generatedContent && (
                <Badge variant="secondary">
                  {generatedContent.model} • {generatedContent.tokensUsed} tokens
                  {generatedContent.cached && " • Cached"}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!generatedContent ? (
              <div className="text-center py-12 text-gray-500">
                <Sparkles className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Generate content to see results here</p>
              </div>
            ) : (
              <Tabs defaultValue="0" className="space-y-4">
                <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${generatedContent.content.length}, 1fr)` }}>
                  {generatedContent.content.map((content, index) => (
                    <TabsTrigger key={index} value={index.toString()}>
                      {content.platform}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {generatedContent.content.map((content, index) => (
                  <TabsContent key={index} value={index.toString()} className="space-y-4">
                    {/* Titles */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium">Titles</label>
                        <Badge variant="outline">
                          Confidence: {Math.round(content.confidence * 100)}%
                        </Badge>
                      </div>
                      <div className="space-y-2">
                        {content.titles.map((title, titleIndex) => (
                          <div key={titleIndex} className="flex items-center gap-2 group">
                            <Input value={title} readOnly className="flex-1" />
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => copyToClipboard(title, 'Title')}
                              className="opacity-0 group-hover:opacity-100"
                              data-testid={`button-copy-title-${titleIndex}`}
                            >
                              <Copy className="h-4 w-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Body Content */}
                    {content.body && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-medium">Body Content</label>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(content.body, 'Content')}
                            data-testid="button-copy-body"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                        <Textarea value={content.body} readOnly rows={4} />
                      </div>
                    )}

                    {/* Photo Instructions */}
                    {content.photoInstructions && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-medium">Photo Instructions</label>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(content.photoInstructions || '', 'Instructions')}
                            data-testid="button-copy-instructions"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                        <Textarea value={content.photoInstructions} readOnly rows={3} />
                      </div>
                    )}

                    {/* Hashtags */}
                    {content.hashtags && content.hashtags.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-sm font-medium">Hashtags</label>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copyToClipboard(content.hashtags?.join(' ') || '', 'Hashtags')}
                            data-testid="button-copy-hashtags"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {content.hashtags.map((tag, tagIndex) => (
                            <Badge key={tagIndex} variant="outline" className="text-xs">
                              <Hash className="h-3 w-3 mr-1" />
                              {tag.replace('#', '')}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </TabsContent>
                ))}
              </Tabs>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}