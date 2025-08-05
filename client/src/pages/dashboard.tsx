import { useState } from "react";
import { GenerationPanel } from "@/components/generation-panel";
import { PhotoInstructions } from "@/components/photo-instructions";
import { AIGenerator } from "@/components/ai-generator";
import { ImageGallery } from "@/components/image-gallery";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import type { ContentGeneration } from "@shared/schema";
import { Sparkles, User, History, Settings, Shield, Brain, ImageIcon } from "lucide-react";
import { ImageProtector } from "@/components/image-protector";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export default function Dashboard() {
  const [currentGeneration, setCurrentGeneration] = useState<ContentGeneration | null>(null);

  const { data: stats } = useQuery({
    queryKey: ["/api/stats"],
  });

  const handleContentGenerated = (generation: ContentGeneration) => {
    setCurrentGeneration(generation);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <h1 className="text-2xl font-bold text-primary flex items-center">
                  <Sparkles className="mr-2 h-6 w-6" />
                  PromotionPro
                </h1>
              </div>
            </div>
            <nav className="hidden md:block">
              <div className="ml-10 flex items-baseline space-x-4">
                <a href="#" className="text-primary bg-indigo-50 px-3 py-2 rounded-md text-sm font-medium">
                  Dashboard
                </a>
                <a href="#" className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
                  History
                </a>
                <a href="#" className="text-gray-600 hover:text-gray-900 px-3 py-2 rounded-md text-sm font-medium">
                  Settings
                </a>
              </div>
            </nav>
            <div className="flex items-center">
              <Button className="bg-primary text-white hover:bg-indigo-700">
                <User className="mr-2 h-4 w-4" />
                Profile
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Main Dashboard */}
        <Tabs defaultValue="ai-content" className="w-full">
          <TabsList className="grid w-full grid-cols-4 mb-8">
            <TabsTrigger value="ai-content" className="flex items-center gap-2">
              <Brain className="h-4 w-4" />
              AI Generator
            </TabsTrigger>
            <TabsTrigger value="content" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Templates
            </TabsTrigger>
            <TabsTrigger value="gallery" className="flex items-center gap-2">
              <ImageIcon className="h-4 w-4" />
              Image Gallery
            </TabsTrigger>
            <TabsTrigger value="protect" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Image Protector
            </TabsTrigger>
          </TabsList>
          
          {/* AI Content Generator */}
          <TabsContent value="ai-content" className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* AI Generation Panel */}
              <div className="lg:col-span-2">
                <AIGenerator onContentGenerated={handleContentGenerated} />
              </div>
              
              {/* Generated Content Display */}
              <div className="space-y-6">
                {currentGeneration && (
                  <div className="bg-white rounded-lg p-6 shadow-md border space-y-4">
                    <h3 className="text-lg font-semibold mb-4">Generated Content</h3>
                    
                    {/* Titles */}
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Title Options</h4>
                      {(currentGeneration.titles || []).map((title, index) => (
                        <div key={index} className="p-2 bg-gray-50 rounded mb-2 text-sm">
                          {String(title)}
                        </div>
                      ))}
                    </div>
                    
                    {/* Content */}
                    <div>
                      <h4 className="font-medium text-gray-900 mb-2">Post Content</h4>
                      <div className="p-3 bg-gray-50 rounded text-sm whitespace-pre-wrap">
                        {String(currentGeneration.content || '')}
                      </div>
                    </div>
                    
                    {/* Photo Instructions */}
                    {currentGeneration.photoInstructions && (
                      <div>
                        <h4 className="font-medium text-gray-900 mb-2">Photo Instructions</h4>
                        <div className="space-y-2 text-sm">
                          {typeof currentGeneration.photoInstructions === 'object' && 
                           currentGeneration.photoInstructions && 
                           'lighting' in currentGeneration.photoInstructions && (
                            <div className="p-2 bg-blue-50 rounded">
                              <strong>Lighting:</strong> {String(currentGeneration.photoInstructions.lighting)}
                            </div>
                          )}
                          {typeof currentGeneration.photoInstructions === 'object' && 
                           currentGeneration.photoInstructions && 
                           'cameraAngle' in currentGeneration.photoInstructions && (
                            <div className="p-2 bg-green-50 rounded">
                              <strong>Camera Angle:</strong> {String(currentGeneration.photoInstructions.cameraAngle)}
                            </div>
                          )}
                          {typeof currentGeneration.photoInstructions === 'object' && 
                           currentGeneration.photoInstructions && 
                           'mood' in currentGeneration.photoInstructions && (
                            <div className="p-2 bg-purple-50 rounded">
                              <strong>Mood:</strong> {String(currentGeneration.photoInstructions.mood)}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {stats && (
                  <div className="bg-white rounded-lg p-6 shadow-md border">
                    <h3 className="text-lg font-semibold mb-4">Quick Stats</h3>
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Content Generated</span>
                        <span className="font-semibold">{stats.totalGenerated}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Content Saved</span>
                        <span className="font-semibold">{stats.totalSaved}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Avg Engagement</span>
                        <span className="font-semibold">{stats.avgEngagement}%</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>
          
          {/* Template Content Generator */}
          <TabsContent value="content" className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Content Generation Panel */}
              <div className="lg:col-span-2">
                <GenerationPanel onContentGenerated={handleContentGenerated} />
              </div>

              {/* Photography Instructions Panel */}
              <div className="lg:col-span-1">
                <PhotoInstructions currentGeneration={currentGeneration} />
              </div>
            </div>
          </TabsContent>
          
          {/* Image Gallery */}
          <TabsContent value="gallery" className="space-y-8">
            <ImageGallery />
          </TabsContent>
          
          <TabsContent value="protect" className="space-y-8">
            <ImageProtector />
          </TabsContent>
        </Tabs>

        {/* Statistics Section */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
            <div className="text-3xl font-bold text-primary mb-2">
              {stats?.totalGenerated || 0}
            </div>
            <div className="text-gray-600">Posts Generated</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
            <div className="text-3xl font-bold text-secondary mb-2">
              {stats?.totalSaved || 0}
            </div>
            <div className="text-gray-600">Saved Favorites</div>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 text-center">
            <div className="text-3xl font-bold text-accent mb-2">
              {stats?.avgEngagement || 0}%
            </div>
            <div className="text-gray-600">Avg. Engagement</div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center text-gray-500 text-sm">
            <p>&copy; 2024 PromotionPro. Professional content creation tools.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
