import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Brain, 
  Sparkles, 
  Shield, 
  ImageIcon, 
  TrendingUp, 
  Users, 
  Eye,
  Heart,
  MessageCircle,
  Star,
  Zap,
  Clock,
  DollarSign,
  Target,
  CheckCircle,
  ArrowRight,
  Rocket
} from "lucide-react";
import { SocialAuth } from "@/components/social-auth";
import { ProviderStatus } from "@/components/provider-status";
import { ConversionOptimization } from "@/components/conversion-optimization";
import { AnalyticsDashboard } from "@/components/analytics-dashboard";
import { PerformanceOptimization } from "@/components/performance-optimization";
import { MobileOptimization } from "@/components/mobile-optimization";
import { EnhancedAIGenerator } from "@/components/enhanced-ai-generator";
import { DemoFallback } from "@/components/demo-fallback";

interface EnhancedDashboardProps {
  isGuestMode?: boolean;
}

export function EnhancedDashboard({ isGuestMode = false }: EnhancedDashboardProps) {
  const [activeTab, setActiveTab] = useState("ai-content");
  const [userStats, setUserStats] = useState({
    postsCreated: isGuestMode ? 0 : 47,
    totalViews: isGuestMode ? 0 : 12840,
    engagementRate: isGuestMode ? 0 : 14.9,
    streak: isGuestMode ? 0 : 7
  });

  const quickActions = [
    {
      icon: <Brain className="h-5 w-5" />,
      title: "AI Generator",
      description: "Create viral content with AI",
      action: () => setActiveTab("ai-content"),
      gradient: "from-purple-500 to-pink-500",
      popular: true
    },
    {
      icon: <Shield className="h-5 w-5" />,
      title: "Protect Images",
      description: "Secure your photos",
      action: () => setActiveTab("protect"),
      gradient: "from-blue-500 to-cyan-500"
    },
    {
      icon: <TrendingUp className="h-5 w-5" />,
      title: "Analytics",
      description: "Track performance",
      action: () => setActiveTab("analytics"),
      gradient: "from-green-500 to-emerald-500"
    },
    {
      icon: <ImageIcon className="h-5 w-5" />,
      title: "Gallery",
      description: "Manage your content",
      action: () => setActiveTab("gallery"),
      gradient: "from-orange-500 to-red-500"
    }
  ];

  const achievements = [
    { icon: <Star className="h-4 w-4" />, title: "First Post", completed: true },
    { icon: <Eye className="h-4 w-4" />, title: "1K Views", completed: !isGuestMode },
    { icon: <Heart className="h-4 w-4" />, title: "High Engagement", completed: !isGuestMode },
    { icon: <Rocket className="h-4 w-4" />, title: "Viral Content", completed: false }
  ];

  return (
    <MobileOptimization>
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
        {/* Enhanced Header */}
        <header className="bg-white/80 backdrop-blur-lg border-b border-gray-200/50 sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg flex items-center justify-center">
                    <Sparkles className="h-5 w-5 text-white" />
                  </div>
                  <h1 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                    ThottoPilot
                  </h1>
                </div>
                
                {!isGuestMode && (
                  <Badge className="bg-green-100 text-green-800 animate-pulse-slow">
                    <CheckCircle className="mr-1 h-3 w-3" />
                    Pro
                  </Badge>
                )}
              </div>

              <div className="flex items-center space-x-4">
                {isGuestMode ? (
                  <Button 
                    className="btn-premium"
                    onClick={() => window.location.href = '/login'}
                  >
                    <Star className="mr-2 h-4 w-4" />
                    Upgrade to Pro
                  </Button>
                ) : (
                  <div className="flex items-center space-x-3">
                    <div className="text-sm text-gray-600">
                      <div className="font-medium">{userStats.streak} day streak</div>
                    </div>
                    <Button variant="outline" size="sm">
                      Profile
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Guest Mode Banner */}
        {isGuestMode && (
          <div className="bg-gradient-to-r from-orange-500 to-pink-500 text-white">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
              <Alert className="border-white/20 bg-white/10 text-white">
                <Sparkles className="h-4 w-4" />
                <AlertDescription>
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                      <strong>🎯 Guest Mode Active!</strong> You're experiencing ThottoPilot with demo content. 
                      Sign up to save your work, access history, and unlock all premium features.
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        onClick={() => window.location.href = '/login'}
                        className="bg-white text-orange-600 hover:bg-gray-100"
                        size="sm"
                      >
                        Sign Up Free
                      </Button>
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            </div>
          </div>
        )}

        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Quick Stats Dashboard */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            <Card className="hover-lift transition-all-smooth">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Posts Created</p>
                    <p className="text-2xl font-bold text-gray-900">{userStats.postsCreated}</p>
                  </div>
                  <div className="text-purple-600">
                    <Sparkles className="h-8 w-8" />
                  </div>
                </div>
                <div className="mt-4">
                  <Progress value={isGuestMode ? 0 : 65} className="h-2" />
                  <p className="text-xs text-gray-500 mt-1">
                    {isGuestMode ? "Start creating!" : "13 this week"}
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="hover-lift transition-all-smooth">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total Views</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {userStats.totalViews.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-blue-600">
                    <Eye className="h-8 w-8" />
                  </div>
                </div>
                <div className="mt-4">
                  <div className="flex items-center text-sm text-green-600">
                    <TrendingUp className="h-4 w-4 mr-1" />
                    {isGuestMode ? "Join to track" : "+24% this week"}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover-lift transition-all-smooth">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Engagement Rate</p>
                    <p className="text-2xl font-bold text-gray-900">{userStats.engagementRate}%</p>
                  </div>
                  <div className="text-pink-600">
                    <Heart className="h-8 w-8" />
                  </div>
                </div>
                <div className="mt-4">
                  <div className="flex items-center text-sm text-green-600">
                    <ArrowRight className="h-4 w-4 mr-1" />
                    {isGuestMode ? "Unlock insights" : "Above average"}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="hover-lift transition-all-smooth">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Daily Streak</p>
                    <p className="text-2xl font-bold text-gray-900">{userStats.streak}</p>
                  </div>
                  <div className="text-orange-600">
                    <Zap className="h-8 w-8" />
                  </div>
                </div>
                <div className="mt-4">
                  <div className="flex items-center text-sm text-orange-600">
                    <Clock className="h-4 w-4 mr-1" />
                    {isGuestMode ? "Start your streak!" : "Keep it up!"}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card className="mb-8 shadow-premium">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Rocket className="mr-2 h-5 w-5" />
                Quick Actions
              </CardTitle>
              <CardDescription>
                Jump right into creating amazing content
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {quickActions.map((action, index) => (
                  <Button
                    key={index}
                    variant="outline"
                    className={`
                      h-20 flex-col space-y-2 relative overflow-hidden group
                      border-2 hover:border-transparent hover:shadow-glow transition-all-smooth
                    `}
                    onClick={action.action}
                  >
                    <div className={`absolute inset-0 bg-gradient-to-r ${action.gradient} opacity-0 group-hover:opacity-10 transition-opacity`} />
                    <div className="relative z-10 flex flex-col items-center space-y-2">
                      <div className={`text-gray-600 group-hover:text-transparent group-hover:bg-gradient-to-r ${action.gradient} group-hover:bg-clip-text transition-all`}>
                        {action.icon}
                      </div>
                      <div className="text-center">
                        <div className="font-medium text-sm">{action.title}</div>
                        <div className="text-xs text-gray-500">{action.description}</div>
                      </div>
                    </div>
                    {action.popular && (
                      <Badge className="absolute top-2 right-2 text-xs bg-red-100 text-red-800">
                        Popular
                      </Badge>
                    )}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Main Content Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-5 mb-8">
              <TabsTrigger value="ai-content" className="flex items-center gap-2">
                <Brain className="h-4 w-4" />
                AI Generator
              </TabsTrigger>
              <TabsTrigger value="analytics" className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Analytics
              </TabsTrigger>
              <TabsTrigger value="gallery" className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4" />
                Gallery
              </TabsTrigger>
              <TabsTrigger value="protect" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Protect
              </TabsTrigger>
              <TabsTrigger value="performance" className="flex items-center gap-2">
                <Zap className="h-4 w-4" />
                Performance
              </TabsTrigger>
            </TabsList>

            <TabsContent value="ai-content" className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2">
                  <EnhancedAIGenerator 
                    onContentGenerated={(generation) => console.log('Generated:', generation)}
                    isGuestMode={isGuestMode}
                  />
                </div>
                <div className="space-y-6">
                  {isGuestMode && (
                    <ConversionOptimization 
                      isGuestMode={true}
                      onUpgrade={() => window.location.href = '/login'}
                    />
                  )}
                  <ProviderStatus />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="analytics">
              <AnalyticsDashboard isGuestMode={isGuestMode} />
            </TabsContent>

            <TabsContent value="gallery">
              <Card className="min-h-[500px] flex items-center justify-center">
                <div className="text-center space-y-4">
                  <ImageIcon className="h-16 w-16 mx-auto text-gray-400" />
                  <h3 className="text-xl font-medium text-gray-600">
                    {isGuestMode ? "Gallery Preview" : "Your Content Gallery"}
                  </h3>
                  <p className="text-gray-500 max-w-md">
                    {isGuestMode 
                      ? "Sign up to save and organize your generated content"
                      : "Your generated content and images will appear here"
                    }
                  </p>
                  {isGuestMode && (
                    <Button className="btn-premium" onClick={() => window.location.href = '/login'}>
                      Unlock Gallery
                    </Button>
                  )}
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="protect">
              <Card className="min-h-[500px] flex items-center justify-center">
                <div className="text-center space-y-4">
                  <Shield className="h-16 w-16 mx-auto text-gray-400" />
                  <h3 className="text-xl font-medium text-gray-600">Image Protection Tools</h3>
                  <p className="text-gray-500 max-w-md">
                    Protect your images from reverse searches while maintaining visual quality
                  </p>
                  {isGuestMode && (
                    <Button className="btn-premium" onClick={() => window.location.href = '/login'}>
                      Unlock Protection
                    </Button>
                  )}
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="performance">
              <PerformanceOptimization />
            </TabsContent>
          </Tabs>

          {/* Achievements Section */}
          {!isGuestMode && (
            <Card className="mt-8">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Star className="mr-2 h-5 w-5" />
                  Achievements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {achievements.map((achievement, index) => (
                    <div 
                      key={index}
                      className={`
                        flex items-center space-x-3 p-3 rounded-lg border-2 transition-all
                        ${achievement.completed 
                          ? 'border-green-200 bg-green-50 text-green-800' 
                          : 'border-gray-200 bg-gray-50 text-gray-500'
                        }
                      `}
                    >
                      <div className={achievement.completed ? 'text-green-600' : 'text-gray-400'}>
                        {achievement.icon}
                      </div>
                      <span className="font-medium text-sm">{achievement.title}</span>
                      {achievement.completed && (
                        <CheckCircle className="h-4 w-4 text-green-600 ml-auto" />
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </main>
      </div>
    </MobileOptimization>
  );
}