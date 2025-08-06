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
  Upload, 
  Image, 
  Settings, 
  Save, 
  Sparkles, 
  Camera,
  Palette,
  Type,
  FileText,
  ChevronRight,
  Check,
  X
} from "lucide-react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface SampleData {
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
  const [activeTab, setActiveTab] = useState("samples");
  const [uploadedSamples, setUploadedSamples] = useState<SampleData[]>([]);
  const [selectedSamples, setSelectedSamples] = useState<number[]>([]);
  
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

  // Load existing samples
  const { data: existingSamples } = useQuery<SampleData[]>({
    queryKey: ["/api/user-samples"],
    retry: false
  });

  // Save integrated settings
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      return await apiRequest("/api/integrated-personalization", "PUT", data);
    },
    onSuccess: () => {
      toast({
        title: "Personalization Updated",
        description: "Your samples and preferences have been saved successfully"
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user-samples"] });
      queryClient.invalidateQueries({ queryKey: ["/api/user-preferences"] });
    }
  });

  const handleSampleUpload = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const content = e.target.value;
    if (content.trim()) {
      const newSample: SampleData = {
        id: Date.now(),
        type: 'post',
        content: content.trim(),
        metadata: {
          platform: 'reddit',
          performance: Math.floor(Math.random() * 100)
        }
      };
      setUploadedSamples([...uploadedSamples, newSample]);
      e.target.value = '';
      toast({
        title: "Sample Added",
        description: "Your content sample has been added to the library"
      });
    }
  };

  const toggleSampleSelection = (sampleId: number) => {
    setSelectedSamples(prev => 
      prev.includes(sampleId) 
        ? prev.filter(id => id !== sampleId)
        : [...prev, sampleId]
    );
  };

  const handleSaveAll = () => {
    const data = {
      samples: uploadedSamples,
      selectedSamples,
      writingStyle,
      photoStyle,
      contentPreferences,
      fineTuningEnabled: selectedSamples.length > 0
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
          Upload samples and fine-tune your content generation in one streamlined workflow
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-4 w-full bg-gray-800/50">
            <TabsTrigger value="samples" className="data-[state=active]:bg-purple-600">
              <FileText className="h-4 w-4 mr-2" />
              Samples
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

          {/* Samples Tab */}
          <TabsContent value="samples" className="space-y-4">
            <div className="bg-gradient-to-r from-purple-900/20 to-pink-900/20 rounded-lg p-4 border border-purple-500/20">
              <h3 className="font-semibold mb-2 text-white">Upload Your Best Content</h3>
              <p className="text-sm text-gray-400 mb-4">
                Add samples of your best-performing posts to train the system on your unique style
              </p>
              <Textarea
                placeholder="Paste a sample post here..."
                className="min-h-[100px] bg-gray-800/50 border-white/10 text-white"
                onBlur={handleSampleUpload}
              />
            </div>

            <div className="space-y-2">
              <h3 className="font-semibold text-white mb-3">Sample Library ({uploadedSamples.length + (existingSamples?.length || 0)} total)</h3>
              <div className="grid gap-2 max-h-[300px] overflow-y-auto">
                {uploadedSamples.map((sample) => (
                  <div
                    key={sample.id}
                    onClick={() => toggleSampleSelection(sample.id)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      selectedSamples.includes(sample.id)
                        ? 'bg-purple-900/30 border-purple-500'
                        : 'bg-gray-800/30 border-white/10 hover:border-white/20'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-sm text-gray-300 line-clamp-2">{sample.content}</p>
                        <div className="flex gap-2 mt-2">
                          {sample.metadata?.platform && (
                            <Badge variant="outline" className="text-xs">
                              {sample.metadata.platform}
                            </Badge>
                          )}
                          {sample.metadata?.performance && (
                            <Badge variant="outline" className="text-xs text-green-400">
                              {sample.metadata.performance}% engagement
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="ml-2">
                        {selectedSamples.includes(sample.id) ? (
                          <Check className="h-5 w-5 text-purple-400" />
                        ) : (
                          <div className="h-5 w-5 border border-white/30 rounded" />
                        )}
                      </div>
                    </div>
                  </div>
                ))}
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
                  placeholder="e.g., confidence, empowerment, playfulness..."
                  value={contentPreferences.themes}
                  onChange={(e) => setContentPreferences({...contentPreferences, themes: e.target.value})}
                  className="bg-gray-800/50 border-white/10 text-white"
                />
              </div>

              <div>
                <Label className="text-white mb-2 block">Words/Phrases to Avoid</Label>
                <Textarea
                  placeholder="Enter words or phrases you never want to use..."
                  value={contentPreferences.avoid}
                  onChange={(e) => setContentPreferences({...contentPreferences, avoid: e.target.value})}
                  className="bg-gray-800/50 border-white/10 text-white"
                />
              </div>
            </div>

            <div className="flex justify-between">
              <Button 
                onClick={() => setActiveTab("samples")}
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
                  <span className="text-gray-400">Samples Selected</span>
                  <Badge className="bg-purple-600">{selectedSamples.length} samples</Badge>
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
                The more samples you provide, the better the system can match your unique style.
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