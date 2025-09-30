import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Camera,
  Check,
  ChevronRight,
  FileText,
  Save,
  Sparkles,
  Type,
} from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface TrainingData {
  id: number;
  type: 'post' | 'image' | 'caption';
  content: string;
  metadata?: {
    platform?: string;
    performance?: number;
    tags?: string[];
  };
}

export function IntegratedFineTuning() {
  const { toast } = useToast();
  
  // Fine-tuning settings
  const [writingStyle, setWritingStyle] = useState({
    tone: 50,
    formality: 50,
    explicitness: 50
  });
  
  const [photoStyle, setPhotoStyle] = useState({
    lighting: 50,
    mood: 50,
    composition: 50
  });
  
  const [contentPreferences, setContentPreferences] = useState({
    themes: "",
    avoid: "",
    prohibitedWords: [] as string[]
  });

  // TODO: Implement user preferences hydration
  const { data: _userPrefs } = useQuery({
    queryKey: ["/api/user-preferences"],
    retry: false,
  });

  // Save integrated settings
  const saveMutation = useMutation({
    mutationFn: async (data: unknown) => {
      return await apiRequest("/api/integrated-personalization", "PUT", data);
    },
    onSuccess: () => {
      toast({
        title: "Personalization Updated",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user-preferences"] });
    }
  });

  const handleAddTrainingData = (e: React.FormEvent<HTMLTextAreaElement>) => {
    const content = (e.target as HTMLTextAreaElement).value;
    if (content.trim()) {
      const newData = {
        id: Date.now(),
        type: 'post' as const,
        content: content.trim(),
        metadata: {
          platform: 'reddit',
          performance: Math.floor(Math.random() * 100)
        }
      };
      (e.target as HTMLTextAreaElement).value = '';
      toast({
        title: "Training data added",
        description: "Your content has been added to the training dataset"
      });
    }
  };

  const [activeTab, setActiveTab] = useState("writing");

  const handleSaveAll = () => {
    const data = {
      writingStyle,
      photoStyle,
      contentPreferences,
    };
    
    saveMutation.mutate(data);
  };

  const getStyleLabel = (value: number) => {
    if (value < 33) return "Low";
    if (value < 66) return "Medium";
    return "High";
  };

  return (
    <Card className="w-full bg-gray-900/50 backdrop-blur-xl border-white/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-purple-400" />
          Integrated Personalization Studio
        </CardTitle>
        <CardDescription className="text-gray-400">
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-4 w-full bg-gray-800/50">
            <TabsTrigger value="training" className="data-[state=active]:bg-purple-600">
              <FileText className="h-4 w-4 mr-2" />
              Training
            </TabsTrigger>
            <TabsTrigger value="writing" className="data-[state=active]:bg-purple-600">
              <Type className="h-4 w-4 mr-2" />
              Writing
            </TabsTrigger>
            <TabsTrigger value="visuals" className="data-[state=active]:bg-purple-600">
              <Camera className="h-4 w-4 mr-2" />
              Visuals
            </TabsTrigger>
            <TabsTrigger value="review" className="data-[state=active]:bg-purple-600">
              <Check className="h-4 w-4 mr-2" />
              Review
            </TabsTrigger>
          </TabsList>

          <TabsContent value="training" className="space-y-6">
            <div className="bg-gradient-to-r from-purple-900/20 to-pink-900/20 rounded-lg p-4 border border-purple-500/20">
              <h3 className="font-semibold mb-2 text-white">Upload Your Best Content</h3>
              <p className="text-sm text-gray-400 mb-4">
                Share examples of your most successful posts to help personalize content generation.
              </p>
              <Textarea
                placeholder="Paste your best-performing content here..."
                className="min-h-[100px] bg-gray-800/50 border-white/10 text-white"
                onKeyDown={handleAddTrainingData}
              />
            </div>

            <div className="space-y-2">
              <div className="grid gap-2 max-h-[300px] overflow-y-auto">
                {/* Training data will be rendered here when available */}
                <div className="text-center py-8 text-gray-500">
                  <FileText className="mx-auto h-12 w-12 mb-4 opacity-50" />
                  <p>No training content yet. Add some examples above to get started!</p>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button 
                onClick={() => setActiveTab("writing")}
                className="bg-purple-600 hover:bg-purple-700"
              >
                Next: Writing Style
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </TabsContent>

          {/* Writing Style Tab */}
          <TabsContent value="writing" className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label className="text-white mb-2 block">Tone</Label>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-400 w-20">Playful</span>
                  <Slider
                    value={[writingStyle.tone]}
                    onValueChange={([value]) => setWritingStyle({...writingStyle, tone: value})}
                    max={100}
                    className="flex-1"
                  />
                  <span className="text-sm text-gray-400 w-20 text-right">Seductive</span>
                  <Badge variant="outline">{getStyleLabel(writingStyle.tone)}</Badge>
                </div>
              </div>

              <div>
                <Label className="text-white mb-2 block">Formality</Label>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-400 w-20">Casual</span>
                  <Slider
                    value={[writingStyle.formality]}
                    onValueChange={([value]) => setWritingStyle({...writingStyle, formality: value})}
                    max={100}
                    className="flex-1"
                  />
                  <span className="text-sm text-gray-400 w-20 text-right">Professional</span>
                  <Badge variant="outline">{getStyleLabel(writingStyle.formality)}</Badge>
                </div>
              </div>

              <div>
                <Label className="text-white mb-2 block">Explicitness</Label>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-400 w-20">Subtle</span>
                  <Slider
                    value={[writingStyle.explicitness]}
                    onValueChange={([value]) => setWritingStyle({...writingStyle, explicitness: value})}
                    max={100}
                    className="flex-1"
                  />
                  <span className="text-sm text-gray-400 w-20 text-right">Direct</span>
                  <Badge variant="outline">{getStyleLabel(writingStyle.explicitness)}</Badge>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <Label className="text-white mb-2 block">Preferred Themes</Label>
                <Textarea
                  value={contentPreferences.themes}
                  onChange={(e) => setContentPreferences({...contentPreferences, themes: e.target.value})}
                  className="bg-gray-800/50 border-white/10 text-white"
                />
              </div>

              <div>
                <Label className="text-white mb-2 block">Words/Phrases to Avoid</Label>
                <Textarea
                  value={contentPreferences.avoid}
                  onChange={(e) => setContentPreferences({...contentPreferences, avoid: e.target.value})}
                  className="bg-gray-800/50 border-white/10 text-white"
                />
              </div>
            </div>

            <div className="flex justify-between">
              <Button 
                variant="outline"
                className="border-white/20"
              >
                Back
              </Button>
              <Button 
                onClick={() => setActiveTab("visuals")}
                className="bg-purple-600 hover:bg-purple-700"
              >
                Next: Visual Style
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </TabsContent>

          {/* Visual Style Tab */}
          <TabsContent value="visuals" className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label className="text-white mb-2 block">Lighting Preference</Label>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-400 w-20">Natural</span>
                  <Slider
                    value={[photoStyle.lighting]}
                    onValueChange={([value]) => setPhotoStyle({...photoStyle, lighting: value})}
                    max={100}
                    className="flex-1"
                  />
                  <span className="text-sm text-gray-400 w-20 text-right">Dramatic</span>
                  <Badge variant="outline">{getStyleLabel(photoStyle.lighting)}</Badge>
                </div>
              </div>

              <div>
                <Label className="text-white mb-2 block">Mood</Label>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-400 w-20">Soft</span>
                  <Slider
                    value={[photoStyle.mood]}
                    onValueChange={([value]) => setPhotoStyle({...photoStyle, mood: value})}
                    max={100}
                    className="flex-1"
                  />
                  <span className="text-sm text-gray-400 w-20 text-right">Bold</span>
                  <Badge variant="outline">{getStyleLabel(photoStyle.mood)}</Badge>
                </div>
              </div>

              <div>
                <Label className="text-white mb-2 block">Composition</Label>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-400 w-20">Simple</span>
                  <Slider
                    value={[photoStyle.composition]}
                    onValueChange={([value]) => setPhotoStyle({...photoStyle, composition: value})}
                    max={100}
                    className="flex-1"
                  />
                  <span className="text-sm text-gray-400 w-20 text-right">Complex</span>
                  <Badge variant="outline">{getStyleLabel(photoStyle.composition)}</Badge>
                </div>
              </div>
            </div>

            <div className="bg-gradient-to-r from-blue-900/20 to-purple-900/20 rounded-lg p-4 border border-blue-500/20">
              <h4 className="font-semibold text-white mb-2">Photo Guidelines Generated</h4>
              <p className="text-sm text-gray-300">
                Based on your preferences, we'll generate detailed photo instructions including:
              </p>
              <ul className="list-disc list-inside text-sm text-gray-400 mt-2 space-y-1">
                <li>Specific lighting setups and angles</li>
                <li>Pose and composition suggestions</li>
                <li>Styling and wardrobe recommendations</li>
                <li>Technical camera settings</li>
              </ul>
            </div>

            <div className="flex justify-between">
              <Button 
                onClick={() => setActiveTab("writing")}
                variant="outline"
                className="border-white/20"
              >
                Back
              </Button>
              <Button 
                onClick={() => setActiveTab("review")}
                className="bg-purple-600 hover:bg-purple-700"
              >
                Review & Save
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          </TabsContent>

          {/* Review Tab */}
          <TabsContent value="review" className="space-y-6">
            <div className="bg-gradient-to-r from-green-900/20 to-blue-900/20 rounded-lg p-6 border border-green-500/20">
              <h3 className="font-semibold text-white mb-4">Personalization Summary</h3>
              
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Writing Style</span>
                  <div className="flex gap-2">
                    <Badge variant="outline">Tone: {getStyleLabel(writingStyle.tone)}</Badge>
                    <Badge variant="outline">Formality: {getStyleLabel(writingStyle.formality)}</Badge>
                  </div>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">Visual Style</span>
                  <div className="flex gap-2">
                    <Badge variant="outline">Lighting: {getStyleLabel(photoStyle.lighting)}</Badge>
                    <Badge variant="outline">Mood: {getStyleLabel(photoStyle.mood)}</Badge>
                  </div>
                </div>
                
                {contentPreferences.themes && (
                  <div className="flex justify-between items-center">
                    <span className="text-gray-400">Themes</span>
                    <span className="text-sm text-gray-300">{contentPreferences.themes.substring(0, 30)}...</span>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-yellow-900/20 border border-yellow-500/20 rounded-lg p-4">
              <p className="text-sm text-yellow-300">
                <strong>Note:</strong> Your personalization settings will be applied to all future content generation. 
              </p>
            </div>

            <div className="flex justify-between">
              <Button 
                onClick={() => setActiveTab("visuals")}
                variant="outline"
                className="border-white/20"
              >
                Back
              </Button>
              <Button 
                onClick={handleSaveAll}
                disabled={saveMutation.isPending}
                className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                {saveMutation.isPending ? (
                  <>Saving...</>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save All Settings
                  </>
                )}
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}