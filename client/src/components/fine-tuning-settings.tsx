import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import {
  Sparkles,
  Save,
  RotateCcw,
  Info,
  Ban,
  Palette,
  Type,
  Camera
} from "lucide-react";

interface UserPreferences {
  userId: number;
  fineTuningEnabled: boolean;
  writingStyle: {
    tone: number;
    formality: number;
    explicitness: number;
  };
  contentPreferences: {
    themes: string;
    avoid: string;
  };
  prohibitedWords: string[];
  photoStyle: {
    lighting: number;
    mood: number;
    composition: number;
  };
}

export function FineTuningSettings() {
  const { toast } = useToast();
  const [hasChanges, setHasChanges] = useState(false);
  
  const { data: preferences, isLoading } = useQuery<UserPreferences>({
    queryKey: ["/api/user-preferences"],
    retry: false
  });

  const [settings, setSettings] = useState<UserPreferences>({
    userId: 1,
    fineTuningEnabled: false,
    writingStyle: { tone: 50, formality: 50, explicitness: 50 },
    contentPreferences: { themes: "", avoid: "" },
    prohibitedWords: [],
    photoStyle: { lighting: 50, mood: 50, composition: 50 }
  });

  const [newProhibitedWord, setNewProhibitedWord] = useState("");

  useEffect(() => {
    if (preferences) {
      setSettings(preferences);
    }
  }, [preferences]);

  const saveMutation = useMutation({
    mutationFn: async (data: UserPreferences) => {
      const response = await fetch("/api/user-preferences", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(data)
      });
      if (!response.ok) {
        throw new Error("Failed to save preferences");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-preferences"] });
      toast({
        title: "Settings saved",
        description: "Your fine-tuning preferences have been updated."
      });
      setHasChanges(false);
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save settings. Please try again.",
        variant: "destructive"
      });
    }
  });

  const updateSettings = (updates: Partial<UserPreferences>) => {
    setSettings(prev => ({ ...prev, ...updates }));
    setHasChanges(true);
  };

  const resetSettings = () => {
    if (preferences) {
      setSettings(preferences);
      setHasChanges(false);
    }
  };

  const addProhibitedWord = () => {
    if (newProhibitedWord.trim()) {
      updateSettings({
        prohibitedWords: [...settings.prohibitedWords, newProhibitedWord.trim()]
      });
      setNewProhibitedWord("");
    }
  };

  const removeProhibitedWord = (word: string) => {
    updateSettings({
      prohibitedWords: settings.prohibitedWords.filter(w => w !== word)
    });
  };

  if (isLoading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
        <p className="text-gray-400">Loading preferences...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Fine-Tuning Settings
          </h2>
          <p className="text-gray-400 mt-1">
            Customize how the AI generates content based on your preferences
          </p>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={resetSettings}
            disabled={!hasChanges}
            className="border-gray-700 hover:bg-gray-800"
          >
            <RotateCcw className="h-4 w-4 mr-2" />
            Reset
          </Button>
          <Button
            onClick={() => saveMutation.mutate(settings)}
            disabled={!hasChanges || saveMutation.isPending}
            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
          >
            <Save className="h-4 w-4 mr-2" />
            {saveMutation.isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* Master Toggle */}
      <Card className="bg-gray-900/50 border-gray-800/50 backdrop-blur-sm p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-600/20 rounded-lg">
              <Sparkles className="h-6 w-6 text-purple-400" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-white">Enable Fine-Tuning</h3>
              <p className="text-sm text-gray-400 mt-1">
              </p>
            </div>
          </div>
          <Switch
            checked={settings.fineTuningEnabled}
            onCheckedChange={(checked) => updateSettings({ fineTuningEnabled: checked })}
            className="data-[state=checked]:bg-purple-600"
          />
        </div>
      </Card>

      {/* Writing Style */}
      <Card className="bg-gray-900/50 border-gray-800/50 backdrop-blur-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <Type className="h-5 w-5 text-purple-400" />
          <h3 className="text-lg font-semibold text-white">Writing Style</h3>
        </div>

        <div className="space-y-6">
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm font-medium text-gray-300">Tone</label>
              <span className="text-sm text-gray-500">
                {settings.writingStyle.tone < 33 ? "Casual" : settings.writingStyle.tone < 66 ? "Balanced" : "Intimate"}
              </span>
            </div>
            <Slider
              value={[settings.writingStyle.tone]}
              onValueChange={([value]) => updateSettings({
                writingStyle: { ...settings.writingStyle, tone: value }
              })}
              max={100}
              step={1}
              className="[&_[role=slider]]:bg-purple-600"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Casual</span>
              <span>Intimate</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm font-medium text-gray-300">Formality</label>
              <span className="text-sm text-gray-500">
                {settings.writingStyle.formality < 33 ? "Very Casual" : settings.writingStyle.formality < 66 ? "Semi-Formal" : "Professional"}
              </span>
            </div>
            <Slider
              value={[settings.writingStyle.formality]}
              onValueChange={([value]) => updateSettings({
                writingStyle: { ...settings.writingStyle, formality: value }
              })}
              max={100}
              step={1}
              className="[&_[role=slider]]:bg-purple-600"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Very Casual</span>
              <span>Professional</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm font-medium text-gray-300">Explicitness</label>
              <span className="text-sm text-gray-500">
                {settings.writingStyle.explicitness < 33 ? "Subtle" : settings.writingStyle.explicitness < 66 ? "Suggestive" : "Direct"}
              </span>
            </div>
            <Slider
              value={[settings.writingStyle.explicitness]}
              onValueChange={([value]) => updateSettings({
                writingStyle: { ...settings.writingStyle, explicitness: value }
              })}
              max={100}
              step={1}
              className="[&_[role=slider]]:bg-purple-600"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Subtle</span>
              <span>Direct</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Content Preferences */}
      <Card className="bg-gray-900/50 border-gray-800/50 backdrop-blur-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <Palette className="h-5 w-5 text-purple-400" />
          <h3 className="text-lg font-semibold text-white">Content Preferences</h3>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-gray-300 block mb-2">
              Preferred Themes
            </label>
            <input
              type="text"
              value={settings.contentPreferences.themes}
              onChange={(e) => updateSettings({
                contentPreferences: { ...settings.contentPreferences, themes: e.target.value }
              })}
              className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Comma-separated themes the AI should focus on
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-300 block mb-2">
              Topics to Avoid
            </label>
            <input
              type="text"
              value={settings.contentPreferences.avoid}
              onChange={(e) => updateSettings({
                contentPreferences: { ...settings.contentPreferences, avoid: e.target.value }
              })}
              className="w-full bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <p className="text-xs text-gray-500 mt-1">
              Comma-separated topics to exclude from content
            </p>
          </div>
        </div>
      </Card>

      {/* Prohibited Words */}
      <Card className="bg-gray-900/50 border-gray-800/50 backdrop-blur-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <Ban className="h-5 w-5 text-purple-400" />
          <h3 className="text-lg font-semibold text-white">Prohibited Words</h3>
        </div>

        <div className="space-y-4">
          <div className="flex gap-2">
            <input
              type="text"
              value={newProhibitedWord}
              onChange={(e) => setNewProhibitedWord(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && addProhibitedWord()}
              className="flex-1 bg-gray-800/50 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <Button
              onClick={addProhibitedWord}
              disabled={!newProhibitedWord.trim()}
              className="bg-purple-600 hover:bg-purple-700"
            >
              Add
            </Button>
          </div>

          {settings.prohibitedWords.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {settings.prohibitedWords.map((word) => (
                <Badge
                  key={word}
                  variant="secondary"
                  className="bg-red-900/30 text-red-300 cursor-pointer hover:bg-red-900/50"
                  onClick={() => removeProhibitedWord(word)}
                >
                  {word}
                  <span className="ml-2">×</span>
                </Badge>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500">
              No prohibited words added yet
            </p>
          )}
        </div>
      </Card>

      {/* Photo Style Preferences */}
      <Card className="bg-gray-900/50 border-gray-800/50 backdrop-blur-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <Camera className="h-5 w-5 text-purple-400" />
          <h3 className="text-lg font-semibold text-white">Photo Style Preferences</h3>
        </div>

        <div className="space-y-6">
          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm font-medium text-gray-300">Lighting Style</label>
              <span className="text-sm text-gray-500">
                {settings.photoStyle.lighting < 33 ? "Soft" : settings.photoStyle.lighting < 66 ? "Natural" : "Dramatic"}
              </span>
            </div>
            <Slider
              value={[settings.photoStyle.lighting]}
              onValueChange={([value]) => updateSettings({
                photoStyle: { ...settings.photoStyle, lighting: value }
              })}
              max={100}
              step={1}
              className="[&_[role=slider]]:bg-purple-600"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Soft</span>
              <span>Dramatic</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm font-medium text-gray-300">Mood</label>
              <span className="text-sm text-gray-500">
                {settings.photoStyle.mood < 33 ? "Playful" : settings.photoStyle.mood < 66 ? "Elegant" : "Sensual"}
              </span>
            </div>
            <Slider
              value={[settings.photoStyle.mood]}
              onValueChange={([value]) => updateSettings({
                photoStyle: { ...settings.photoStyle, mood: value }
              })}
              max={100}
              step={1}
              className="[&_[role=slider]]:bg-purple-600"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Playful</span>
              <span>Sensual</span>
            </div>
          </div>

          <div>
            <div className="flex justify-between mb-2">
              <label className="text-sm font-medium text-gray-300">Composition</label>
              <span className="text-sm text-gray-500">
                {settings.photoStyle.composition < 33 ? "Casual" : settings.photoStyle.composition < 66 ? "Artistic" : "Professional"}
              </span>
            </div>
            <Slider
              value={[settings.photoStyle.composition]}
              onValueChange={([value]) => updateSettings({
                photoStyle: { ...settings.photoStyle, composition: value }
              })}
              max={100}
              step={1}
              className="[&_[role=slider]]:bg-purple-600"
            />
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Casual</span>
              <span>Professional</span>
            </div>
          </div>
        </div>
      </Card>

      {/* Info Box */}
      <Card className="bg-purple-900/20 border-purple-800/50 p-4">
        <div className="flex gap-3">
          <Info className="h-5 w-5 text-purple-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-purple-300">
            <p className="font-medium mb-1">Pro Tip</p>
            <p className="text-purple-300/80">
              The AI will analyze your writing patterns and adapt its generation style accordingly.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}