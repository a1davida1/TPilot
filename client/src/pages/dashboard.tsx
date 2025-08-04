import { useState } from "react";
import { GenerationPanel } from "@/components/generation-panel";
import { PhotoInstructions } from "@/components/photo-instructions";
import { Button } from "@/components/ui/button";
import { useQuery } from "@tanstack/react-query";
import type { ContentGeneration } from "@shared/schema";
import { Sparkles, User, History, Settings } from "lucide-react";

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
                  ContentCraft
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
            <p>&copy; 2024 ContentCraft. Professional content creation tools.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
