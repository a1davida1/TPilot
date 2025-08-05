import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Brain, Upload, Sparkles, Image as ImageIcon, Settings } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { ContentGeneration } from '@shared/schema';

interface AIGeneratorProps {
  onContentGenerated: (generation: ContentGeneration) => void;
}

export function AIGenerator({ onContentGenerated }: AIGeneratorProps) {
  const [generationType, setGenerationType] = useState<'ai-prompt' | 'ai-image' | 'template'>('ai-prompt');
  const [platform, setPlatform] = useState('reddit');
  const [customPrompt, setCustomPrompt] = useState('');
  const [subreddit, setSubreddit] = useState('');
  const [allowsPromotion, setAllowsPromotion] = useState('no');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState({
    toneOfVoice: 'confident',
    contentStyle: 'authentic',
    personalBrand: 'girl-next-door',
    contentLength: 'medium' as 'short' | 'medium' | 'long',
    includeEmojis: true,
    promotionLevel: 'moderate' as 'subtle' | 'moderate' | 'direct'
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const generateMutation = useMutation({
    mutationFn: async (data: any) => {
      const formData = new FormData();
      Object.keys(data).forEach(key => {
        if (key === 'userProfile') {
          formData.append(key, JSON.stringify(data[key]));
        } else if (key === 'image' && data[key]) {
          formData.append(key, data[key]);
        } else {
          formData.append(key, data[key]);
        }
      });
      return apiRequest('/api/generate-ai', {
        method: 'POST',
        body: formData,
      });
    },
    onSuccess: (data) => {
      onContentGenerated(data);
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      toast({
        title: "AI content generated!",
        description: "Your personalized content is ready."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Generation failed",
        description: error.message || "Failed to generate content. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedImage(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleGenerate = () => {
    if (generationType === 'ai-prompt' && !customPrompt.trim()) {
      toast({
        title: "Missing prompt",
        description: "Please enter a custom prompt for AI generation.",
        variant: "destructive"
      });
      return;
    }

    if (generationType === 'ai-image' && !selectedImage) {
      toast({
        title: "Missing image",
        description: "Please select an image for AI analysis.",
        variant: "destructive"
      });
      return;
    }

    generateMutation.mutate({
      generationType,
      platform,
      customPrompt: generationType === 'ai-prompt' ? customPrompt : undefined,
      image: generationType === 'ai-image' ? selectedImage : undefined,
      subreddit,
      allowsPromotion,
      userProfile,
      style: 'ai-generated',
      theme: 'personalized'
    });
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-purple-600" />
          AI Content Generator
        </CardTitle>
        <CardDescription>
          Create personalized content using AI that matches your unique voice and brand
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Generation Type */}
        <div className="space-y-3">
          <Label>Content Generation Method</Label>
          <div className="grid grid-cols-3 gap-2">
            <Button
              variant={generationType === 'ai-prompt' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setGenerationType('ai-prompt')}
              className="flex flex-col items-center gap-1 h-auto py-3"
            >
              <Sparkles className="h-4 w-4" />
              <span className="text-xs">Custom Prompt</span>
            </Button>
            <Button
              variant={generationType === 'ai-image' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setGenerationType('ai-image')}
              className="flex flex-col items-center gap-1 h-auto py-3"
            >
              <ImageIcon className="h-4 w-4" />
              <span className="text-xs">From Image</span>
            </Button>
            <Button
              variant={generationType === 'template' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setGenerationType('template')}
              className="flex flex-col items-center gap-1 h-auto py-3"
            >
              <Settings className="h-4 w-4" />
              <span className="text-xs">Template</span>
            </Button>
          </div>
        </div>

        {/* Custom Prompt Input */}
        {generationType === 'ai-prompt' && (
          <div className="space-y-2">
            <Label>Custom Prompt</Label>
            <Textarea
              placeholder="Describe the content you want to create... e.g., 'Create a post about trying a new workout routine' or 'Generate content for a cozy morning routine'"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              className="min-h-[100px]"
            />
          </div>
        )}

        {/* Image Upload */}
        {generationType === 'ai-image' && (
          <div className="space-y-2">
            <Label>Upload Image</Label>
            <div className="border-2 border-dashed border-gray-300 rounded-lg p-4">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
                id="image-upload"
              />
              <label htmlFor="image-upload" className="cursor-pointer">
                {imagePreview ? (
                  <div className="space-y-2">
                    <img
                      src={imagePreview}
                      alt="Selected"
                      className="max-w-full h-32 object-cover rounded-lg mx-auto"
                    />
                    <p className="text-sm text-center text-gray-600">
                      Click to change image
                    </p>
                  </div>
                ) : (
                  <div className="text-center">
                    <Upload className="mx-auto h-8 w-8 text-gray-400" />
                    <p className="mt-2 text-sm text-gray-600">
                      Upload an image to generate content based on what you see
                    </p>
                  </div>
                )}
              </label>
            </div>
          </div>
        )}

        {/* Platform & Settings */}
        <div className="grid grid-cols-2 gap-4">
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

          <div className="space-y-2">
            <Label>Subreddit (optional)</Label>
            <Input
              placeholder="e.g., selfie, pics, etc."
              value={subreddit}
              onChange={(e) => setSubreddit(e.target.value)}
            />
          </div>
        </div>

        {/* Promotion Setting */}
        <div className="space-y-2">
          <Label>Promotion Allowed</Label>
          <div className="grid grid-cols-2 gap-2">
            {['yes', 'no'].map((option) => (
              <Button
                key={option}
                variant={allowsPromotion === option ? 'default' : 'outline'}
                size="sm"
                onClick={() => setAllowsPromotion(option)}
              >
                {option === 'yes' ? 'Yes - Include promo' : 'No - Keep subtle'}
              </Button>
            ))}
          </div>
        </div>

        {/* User Profile Settings */}
        <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-medium">Personality Profile</Label>
            <Badge variant="outline">AI Training Data</Badge>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <Label className="text-xs">Tone of Voice</Label>
              <Select 
                value={userProfile.toneOfVoice} 
                onValueChange={(value) => setUserProfile(prev => ({ ...prev, toneOfVoice: value }))}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="casual">Casual</SelectItem>
                  <SelectItem value="flirty">Flirty</SelectItem>
                  <SelectItem value="mysterious">Mysterious</SelectItem>
                  <SelectItem value="confident">Confident</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Content Style</Label>
              <Select 
                value={userProfile.contentStyle} 
                onValueChange={(value) => setUserProfile(prev => ({ ...prev, contentStyle: value }))}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="playful">Playful</SelectItem>
                  <SelectItem value="sultry">Sultry</SelectItem>
                  <SelectItem value="artistic">Artistic</SelectItem>
                  <SelectItem value="authentic">Authentic</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Personal Brand</Label>
              <Select 
                value={userProfile.personalBrand} 
                onValueChange={(value) => setUserProfile(prev => ({ ...prev, personalBrand: value }))}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="girl-next-door">Girl Next Door</SelectItem>
                  <SelectItem value="alternative">Alternative</SelectItem>
                  <SelectItem value="luxury">Luxury</SelectItem>
                  <SelectItem value="gamer">Gamer</SelectItem>
                  <SelectItem value="fitness">Fitness</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label className="text-xs">Content Length</Label>
              <Select 
                value={userProfile.contentLength} 
                onValueChange={(value: 'short' | 'medium' | 'long') => setUserProfile(prev => ({ ...prev, contentLength: value }))}
              >
                <SelectTrigger className="h-8">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="short">Short & Punchy</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="long">Detailed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Label className="text-xs">Include Emojis</Label>
            <Switch
              checked={userProfile.includeEmojis}
              onCheckedChange={(checked) => setUserProfile(prev => ({ ...prev, includeEmojis: checked }))}
            />
          </div>
        </div>

        {/* Generate Button */}
        <Button
          onClick={handleGenerate}
          disabled={generateMutation.isPending}
          className="w-full"
          size="lg"
        >
          {generateMutation.isPending ? (
            "Generating..."
          ) : (
            <>
              <Brain className="mr-2 h-4 w-4" />
              Generate AI Content
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}