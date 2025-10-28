import { GeminiCaptionGeneratorTabs } from "@/components/GeminiCaptionGeneratorTabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { ArrowLeft, Sparkles } from "lucide-react";
import { StatusBanner } from "@/components/ui/status-banner";
import { useQuery } from "@tanstack/react-query";

export default function CaptionGeneratorPage() {
  // Fetch caption usage stats
const { data: captionStats } = useQuery<{ used: number; limit: number; remaining: number }>({
  queryKey: ['/api/generations/stats'],
  queryFn: () => fetch('/api/generations/stats').then(res => res.json()),
});

const showLimitWarning = captionStats?.remaining !== undefined && captionStats.remaining < 10;

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-purple-50 to-indigo-50 dark:from-gray-900 dark:via-purple-950 dark:to-indigo-950">
      {/* Status Banner for Caption Limits */}
      {showLimitWarning && (
        <StatusBanner
          message={`⚠️ Only ${captionStats.remaining} captions remaining this month. Upgrade for unlimited generations!`}
          variant="warning"
        />
      )}
      
      <div className="container mx-auto p-4 max-w-4xl">
        {/* Header */}
        <div className="mb-6">
          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>

        {/* Title Card */}
        <Card className="mb-6 bg-gradient-to-r from-pink-500 to-purple-600 text-white border-0">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center gap-2">
              <Sparkles className="h-6 w-6" />
              Professional Content Studio
            </CardTitle>
            <CardDescription className="text-pink-100">
              Professional-grade content creation with quality assurance for perfect results every time
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div className="bg-white/20 backdrop-blur rounded-lg p-3">
                <div className="font-semibold mb-1">📸 Multi-Mode</div>
                <div className="text-pink-100">Image, Text, or Rewrite existing content</div>
              </div>
              <div className="bg-white/20 backdrop-blur rounded-lg p-3">
                <div className="font-semibold mb-1">🎨 6 Voice Styles</div>
                <div className="text-pink-100">From flirty to luxury minimal</div>
              </div>
              <div className="bg-white/20 backdrop-blur rounded-lg p-3">
                <div className="font-semibold mb-1">✨ Quality Assured</div>
                <div className="text-pink-100">Professional editing with auto-enhancement</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        <GeminiCaptionGeneratorTabs />
      </div>
    </div>
  );
}