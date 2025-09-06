import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Sparkles, 
  Brain, 
  Shield, 
  ImageIcon,
  TrendingUp,
  Zap,
  Star,
  ArrowRight,
  Check,
  Globe,
  Lock,
  Palette,
  Users,
  Heart,
  Eye,
  MessageCircle,
  DollarSign,
  Target,
  Rocket,
  Crown,
  BarChart3,
  History,
  Settings,
  Menu,
  X,
  LogOut,
  PlusCircle,
  FileText,
  Camera,
  Hash,
  Gift
} from "lucide-react";
import { SimpleContentGenerator } from "@/components/simple-content-generator";
import { SocialAuth } from "@/components/social-auth";
import { ProviderStatus } from "@/components/provider-status";
import { IntegratedFineTuning } from "@/components/integrated-fine-tuning";
import { AuthModal } from "@/components/auth-modal";
import { TrendingTagsExpanded } from "@/components/trending-tags-expanded";
import { AudienceInsights } from "@/components/audience-insights";
import { ImageGallery } from "@/components/image-gallery";
import { RedditCommunities } from "@/components/reddit-communities";
import { ProPerks } from "@/components/pro-perks";
import { ImageShield } from "@/components/image-shield";
import { cn } from "@/lib/utils";

interface UltraAestheticAppProps {
  isGuestMode?: boolean;
}

export function UltraAestheticApp({ isGuestMode = true }: UltraAestheticAppProps) {
  const [activeView, setActiveView] = useState("generate");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  useEffect(() => {
    setIsVisible(true);

    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const navigationItems = [
    { id: "generate", label: "Content Creator", icon: <Brain className="h-5 w-5" />, badge: "NEW" },
    { id: "dual", label: "Dual Workflow", icon: <Zap className="h-5 w-5" />, badge: "HOT" },
    { id: "protect", label: "Image Shield", icon: <Shield className="h-5 w-5" />, badge: "FREE" },
    { id: "finetune", label: "Personalization", icon: <Sparkles className="h-5 w-5" />, badge: "PRO" },
    { id: "perks", label: "ProPerks", icon: <Gift className="h-5 w-5" />, badge: "15+" },
    { id: "gallery", label: "Image Gallery", icon: <ImageIcon className="h-5 w-5" /> },
    { id: "communities", label: "Reddit Communities", icon: <Users className="h-5 w-5" />, badge: "50+" },
    { id: "trending", label: "Trending Tags", icon: <Hash className="h-5 w-5" /> },
    { id: "insights", label: "Audience Insights", icon: <BarChart3 className="h-5 w-5" /> },
    { id: "analytics", label: "Analytics", icon: <TrendingUp className="h-5 w-5" /> },
    { id: "history", label: "History", icon: <History className="h-5 w-5" /> },
    { id: "settings", label: "Settings", icon: <Settings className="h-5 w-5" /> }
  ];

  // These stats will be connected to real data from your content and analytics
  const stats = [
    { value: "2.4K", label: "Posts Created", trend: "+12%" },
    { value: "89%", label: "Engagement", trend: "+5%" },
    { value: "2,847", label: "Active Creators", trend: "+12%" }
  ];

  return (
    <div className="min-h-screen bg-background text-foreground flex dark">
      {/* Dynamic gradient background */}
      <div 
        className="fixed inset-0 opacity-20 pointer-events-none"
        style={{
          background: `radial-gradient(circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(147, 51, 234, 0.15), transparent 40%)`
        }}
      />

      {/* Animated gradient orbs */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-600/10 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '2s' }} />
      </div>

      {/* Sidebar */}
      <aside className={cn(
        "fixed left-0 top-0 h-full bg-gray-900/95 backdrop-blur-xl border-r border-purple-500/20 transition-all duration-300 z-40",
        sidebarOpen ? "w-64" : "w-20"
      )}>
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-purple-500/20">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/25">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            {sidebarOpen && (
              <div>
                <h1 className="text-lg font-bold bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">
                  ThottoPilot
                </h1>
                <p className="text-xs text-gray-400">Pro Dashboard</p>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-gray-400 hover:text-white"
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="p-4 space-y-2">
          {navigationItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={cn(
                "w-full flex items-center space-x-3 px-3 py-2.5 rounded-lg transition-all",
                activeView === item.id
                  ? "bg-purple-600/20 text-purple-300 border border-purple-500/30"
                  : "hover:bg-white/5 text-gray-400 hover:text-white"
              )}
            >
              {item.icon}
              {sidebarOpen && (
                <>
                  <span className="flex-1 text-left">{item.label}</span>
                  {item.badge && (
                    <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/50 text-xs">
                      {item.badge}
                    </Badge>
                  )}
                </>
              )}
            </button>
          ))}
        </nav>

        {/* User Section */}
        {sidebarOpen && (
          <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-white/10">
            {isGuestMode ? (
              <Card className="bg-purple-600/10 border-purple-500/30">
                <CardContent className="p-4">
                  <p className="text-sm text-purple-300 mb-3">
                    <Sparkles className="inline h-4 w-4 mr-1" />
                    Guest Mode Active
                  </p>
                  <Button 
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                    onClick={() => setShowAuthModal(true)}
                  >
                    Unlock Full Access
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full" />
                <div className="flex-1">
                  <p className="text-sm font-medium">User Name</p>
                  <p className="text-xs text-gray-500">Pro Member</p>
                </div>
                <Button variant="ghost" size="icon" className="text-gray-400">
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        )}
      </aside>

      {/* Main Content */}
      <main className={cn(
        "flex-1 transition-all duration-300",
        sidebarOpen ? "ml-64" : "ml-20"
      )}>
        {/* Top Bar */}
        <header className="h-16 bg-gray-950/50 backdrop-blur-xl border-b border-white/10 flex items-center justify-between px-6">
          <div>
            <h2 className="text-xl font-semibold">
              {navigationItems.find(item => item.id === activeView)?.label}
            </h2>
            <p className="text-sm text-gray-500">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          {/* Login/Register and Stats */}
          <div className="flex items-center space-x-6">
            {/* Quick Stats */}
            <div className="hidden lg:flex items-center space-x-6">
              {stats.map((stat, index) => (
                <div key={index} className="text-center">
                  <p className="text-2xl font-bold text-white">{stat.value}</p>
                  <p className="text-xs text-gray-500">{stat.label}</p>
                  <p className="text-xs text-green-400">{stat.trend}</p>
                </div>
              ))}
            </div>

            {/* Auth Buttons */}
            {isGuestMode ? (
              <div className="flex items-center space-x-3">
                <Button 
                  variant="outline" 
                  size="sm"
                  className="border-purple-500/30 hover:bg-purple-500/10"
                  onClick={() => setShowAuthModal(true)}
                >
                  Sign In
                </Button>
                <Button 
                  size="sm"
                  className="bg-gradient-to-r from-purple-500 to-pink-500"
                  onClick={() => setShowAuthModal(true)}
                >
                  Get Started
                </Button>
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/50">
                  PRO MEMBER
                </Badge>
                <Button 
                  variant="ghost" 
                  size="sm"
                  className="text-gray-400"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </header>

        {/* Content Area */}
        <div className="p-6">
          <div className={`transition-all duration-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            {activeView === "generate" && (
              <div className="space-y-6">
                {/* Functionality Description for Guest Users */}
                {isGuestMode && (
                  <Card className="bg-gradient-to-r from-blue-900/20 to-cyan-900/20 border-blue-500/30 overflow-hidden">
                    <CardContent className="p-8">
                      <div className="text-center space-y-4">
                        <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                          Welcome to ThottoPilot
                        </h1>
                        <p className="text-xl text-gray-200 max-w-4xl mx-auto leading-relaxed">
                          The complete platform for adult content creators. Generate engaging Reddit posts, 
                          protect your images from reverse searches, access exclusive industry resources, 
                          and optimize your content strategy with intelligent tools.
                        </p>
                        <div className="grid md:grid-cols-3 gap-6 mt-8">
                          <div className="bg-white/5 p-4 rounded-lg">
                            <Brain className="h-8 w-8 text-purple-400 mx-auto mb-2" />
                            <h3 className="font-semibold text-white mb-1">Smart Content Creation</h3>
                            <p className="text-sm text-gray-300">Generate personalized Reddit posts with titles, content, and photo instructions</p>
                          </div>
                          <div className="bg-white/5 p-4 rounded-lg">
                            <Shield className="h-8 w-8 text-blue-400 mx-auto mb-2" />
                            <h3 className="font-semibold text-white mb-1">Image Protection</h3>
                            <p className="text-sm text-gray-300">Prevent reverse image searches while maintaining visual quality</p>
                          </div>
                          <div className="bg-white/5 p-4 rounded-lg">
                            <Gift className="h-8 w-8 text-pink-400 mx-auto mb-2" />
                            <h3 className="font-semibold text-white mb-1">Pro Resources</h3>
                            <p className="text-sm text-gray-300">Access exclusive guides, discounts, and professional tools worth $1,200+</p>
                          </div>
                        </div>
                        <div className="flex justify-center gap-4 mt-6">
                          <Button 
                            className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 px-8 py-3 text-lg"
                            onClick={() => setShowAuthModal(true)}
                          >
                            Start Free Trial
                            <ArrowRight className="ml-2 h-5 w-5" />
                          </Button>
                          <Button 
                            variant="outline"
                            className="border-blue-500/50 text-blue-400 hover:bg-blue-500/10 px-8 py-3 text-lg"
                            onClick={() => setActiveView("protect")}
                          >
                            Try Image Shield Free
                            <Shield className="ml-2 h-5 w-5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="grid lg:grid-cols-4 gap-6">
                  {/* Main Content Area - Generator + Output */}
                  <div className="lg:col-span-3 space-y-6">
                    {/* Content Generator */}
                    <SimpleContentGenerator 
                      isGuestMode={isGuestMode}
                      onContentGenerated={() => {}}
                    />


                  </div>

                  {/* Right Sidebar */}
                  <div className="space-y-6">
                    {/* Recent Generations */}
                    <Card className="bg-card/80 backdrop-blur-xl border-border">
                      <CardHeader>
                        <CardTitle className="flex items-center justify-between text-sm">
                          <span className="flex items-center">
                            <History className="mr-2 h-4 w-4" />
                            Recent Generations
                          </span>
                          <Button variant="ghost" size="sm" className="text-primary text-xs h-auto p-1">
                            View All
                          </Button>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          {[1, 2, 3].map((item) => (
                            <div key={item} className="flex items-center justify-between p-2 bg-muted/30 rounded-lg text-xs">
                              <div className="flex items-center space-x-2">
                                <div className="w-6 h-6 bg-gradient-to-r from-primary to-accent rounded flex items-center justify-center">
                                  <FileText className="h-3 w-3 text-primary-foreground" />
                                </div>
                                <div>
                                  <p className="font-medium">Reddit Post</p>
                                  <p className="text-muted-foreground">2h ago</p>
                                </div>
                              </div>
                              <Button variant="ghost" size="sm" className="text-primary text-xs h-auto p-1">
                                View
                              </Button>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>

                    {/* Quick Actions */}
                    <Card className="bg-card/80 backdrop-blur-xl border-border">
                      <CardHeader>
                        <CardTitle className="text-sm">Quick Actions</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <Button 
                          className="w-full justify-start text-xs h-8" 
                          variant="outline"
                          onClick={() => setActiveView("gallery")}
                        >
                          <Camera className="mr-2 h-3 w-3" />
                          Upload Images
                        </Button>
                        <Button 
                          className="w-full justify-start text-xs h-8" 
                          variant="outline"
                          onClick={() => setActiveView("trending")}
                        >
                          <Hash className="mr-2 h-3 w-3" />
                          Trending Tags
                        </Button>
                        <Button 
                          className="w-full justify-start text-xs h-8" 
                          variant="outline"
                          onClick={() => setActiveView("insights")}
                        >
                          <Users className="mr-2 h-3 w-3" />
                          Audience Insights
                        </Button>
                      </CardContent>
                    </Card>

                  {/* Upgrade Prompt */}
                  {isGuestMode && (
                    <Card className="bg-gradient-to-br from-purple-600/20 to-pink-600/20 border-purple-500/30">
                      <CardHeader>
                        <CardTitle className="text-purple-300">
                          <Crown className="inline mr-2 h-5 w-5" />
                          Go Premium
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-2 text-sm text-gray-300 mb-4">
                          <li className="flex items-center">
                            <Check className="mr-2 h-4 w-4 text-green-400" />
                            Unlimited generations
                          </li>
                          <li className="flex items-center">
                            <Check className="mr-2 h-4 w-4 text-green-400" />
                            Advanced analytics
                          </li>
                          <li className="flex items-center">
                            <Check className="mr-2 h-4 w-4 text-green-400" />
                            Priority support
                          </li>
                        </ul>
                        <Button className="w-full bg-gradient-to-r from-purple-600 to-pink-600">
                          Upgrade Now
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </div>
                </div>
              </div>
            )}

            {activeView === "trending" && (
              <div className="max-w-7xl mx-auto">
                <TrendingTagsExpanded />
              </div>
            )}

            {activeView === "insights" && (
              <div className="max-w-6xl mx-auto">
                <AudienceInsights />
              </div>
            )}

            {activeView === "communities" && (
              <div className="max-w-7xl mx-auto">
                <RedditCommunities />
              </div>
            )}

            {activeView === "dual" && (
              <div className="max-w-6xl mx-auto">
                <SimpleContentGenerator 
                  isGuestMode={isGuestMode}
                  onContentGenerated={() => {}}
                />
              </div>
            )}

            {activeView === "perks" && (
              <div className="max-w-7xl mx-auto">
                <ProPerks />
              </div>
            )}

            {activeView === "gallery" && (
              <div className="max-w-6xl mx-auto">
                <ImageGallery />
              </div>
            )}

            {activeView === "protect" && (
              <div className="max-w-4xl mx-auto">
                <ImageShield 
                  isGuestMode={isGuestMode} 
                  userTier={isGuestMode ? "free" : "pro"} 
                />
              </div>
            )}

            {activeView === "history" && (
              <div className="max-w-6xl mx-auto">
              </div>
            )}

            {activeView === "finetune" && (
              <div className="max-w-4xl mx-auto">
                <IntegratedFineTuning />
              </div>
            )}

            {activeView === "analytics" && (
              <div className="space-y-6">
                <div className="grid md:grid-cols-4 gap-6">
                  {[
                    { icon: Eye, label: "Total Views", value: "234.5K", change: "+12%" },
                    { icon: Heart, label: "Engagement", value: "89.2%", change: "+5%" },
                    { icon: MessageCircle, label: "Comments", value: "1,842", change: "+23%" },
                    { icon: DollarSign, label: "Revenue", value: "$4,235", change: "+18%" }
                  ].map((metric, index) => (
                    <Card key={index} className="bg-gray-900/50 backdrop-blur-xl border-white/10">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">{metric.label}</CardTitle>
                        <metric.icon className="h-4 w-4 text-gray-400" />
                      </CardHeader>
                      <CardContent>
                        <div className="text-2xl font-bold">{metric.value}</div>
                        <p className="text-xs text-green-400">{metric.change} from last month</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                <Card className="bg-gray-900/50 backdrop-blur-xl border-white/10">
                  <CardHeader>
                    <CardTitle>Performance Overview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64 flex items-center justify-center bg-white/5 rounded-lg">
                      <p className="text-gray-500">Analytics charts would appear here</p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => {
          setShowAuthModal(false);
          window.location.reload(); // Reload to update authentication state
        }}
      />
    </div>
  );
}