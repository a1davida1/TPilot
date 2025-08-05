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
  Hash
} from "lucide-react";
import { EnhancedAIGenerator } from "@/components/enhanced-ai-generator";
import { SocialAuth } from "@/components/social-auth";
import { ProviderStatus } from "@/components/provider-status";
import { cn } from "@/lib/utils";

interface UltraAestheticAppProps {
  isGuestMode?: boolean;
}

export function UltraAestheticApp({ isGuestMode = true }: UltraAestheticAppProps) {
  const [activeView, setActiveView] = useState("generate");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
    
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const navigationItems = [
    { id: "generate", label: "AI Generator", icon: <Brain className="h-5 w-5" />, badge: "NEW" },
    { id: "protect", label: "Image Shield", icon: <Shield className="h-5 w-5" /> },
    { id: "analytics", label: "Analytics", icon: <BarChart3 className="h-5 w-5" /> },
    { id: "history", label: "History", icon: <History className="h-5 w-5" /> },
    { id: "settings", label: "Settings", icon: <Settings className="h-5 w-5" /> }
  ];

  const stats = [
    { value: "2.4K", label: "Posts Created", trend: "+12%" },
    { value: "89%", label: "Engagement Rate", trend: "+5%" },
    { value: "$1,245", label: "Earnings", trend: "+23%" },
    { value: "4.9", label: "Rating", trend: "Stable" }
  ];

  return (
    <div className="min-h-screen bg-black text-white flex">
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
        "fixed left-0 top-0 h-full bg-gray-950/80 backdrop-blur-xl border-r border-white/10 transition-all duration-300 z-40",
        sidebarOpen ? "w-64" : "w-20"
      )}>
        {/* Logo */}
        <div className="h-16 flex items-center justify-between px-4 border-b border-white/10">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl flex items-center justify-center neon-purple">
              <Sparkles className="h-6 w-6 text-white" />
            </div>
            {sidebarOpen && (
              <div>
                <h1 className="text-lg font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  ThottoPilot
                </h1>
                <p className="text-xs text-gray-500">Pro Dashboard</p>
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
                    onClick={() => window.location.href = '/login'}
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
          
          {/* Quick Stats */}
          <div className="flex items-center space-x-6">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <p className="text-2xl font-bold text-white">{stat.value}</p>
                <p className="text-xs text-gray-500">{stat.label}</p>
                <p className="text-xs text-green-400">{stat.trend}</p>
              </div>
            ))}
          </div>
        </header>

        {/* Content Area */}
        <div className="p-6">
          <div className={`transition-all duration-500 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
            {activeView === "generate" && (
              <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                  <EnhancedAIGenerator 
                    isGuestMode={isGuestMode}
                    onContentGenerated={() => {}}
                  />
                  
                  {/* Recent Generations */}
                  <Card className="bg-gray-900/50 backdrop-blur-xl border-white/10">
                    <CardHeader>
                      <CardTitle className="flex items-center justify-between">
                        Recent Generations
                        <Button variant="ghost" size="sm" className="text-purple-400">
                          View All
                        </Button>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {[1, 2, 3].map((item) => (
                          <div key={item} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                            <div className="flex items-center space-x-3">
                              <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg flex items-center justify-center">
                                <FileText className="h-5 w-5 text-white" />
                              </div>
                              <div>
                                <p className="text-sm font-medium">Reddit Post - r/nsfw</p>
                                <p className="text-xs text-gray-500">Generated 2 hours ago</p>
                              </div>
                            </div>
                            <Button variant="ghost" size="sm" className="text-purple-400">
                              View
                            </Button>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
                
                {/* Sidebar */}
                <div className="space-y-6">
                  {/* Provider Status */}
                  <ProviderStatus />
                  
                  {/* Quick Actions */}
                  <Card className="bg-gray-900/50 backdrop-blur-xl border-white/10">
                    <CardHeader>
                      <CardTitle>Quick Actions</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <Button className="w-full justify-start" variant="outline">
                        <Camera className="mr-2 h-4 w-4" />
                        Upload Images
                      </Button>
                      <Button className="w-full justify-start" variant="outline">
                        <Hash className="mr-2 h-4 w-4" />
                        Trending Tags
                      </Button>
                      <Button className="w-full justify-start" variant="outline">
                        <Users className="mr-2 h-4 w-4" />
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
            )}
            
            {activeView === "protect" && (
              <div className="max-w-4xl mx-auto">
                <Card className="bg-gray-900/50 backdrop-blur-xl border-white/10">
                  <CardHeader className="text-center py-12">
                    <Shield className="h-24 w-24 mx-auto text-purple-400 mb-6" />
                    <CardTitle className="text-3xl mb-4">Image Protection Suite</CardTitle>
                    <CardDescription className="text-lg max-w-2xl mx-auto">
                      Military-grade protection for your photos. Prevent reverse image searches 
                      while maintaining visual quality. Your content, your control.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-3 gap-6 mb-8">
                      <Card className="bg-white/5 border-white/10">
                        <CardHeader>
                          <Lock className="h-8 w-8 text-green-400 mb-2" />
                          <CardTitle className="text-lg">Light Protection</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-gray-400">Basic protection for casual use</p>
                        </CardContent>
                      </Card>
                      <Card className="bg-white/5 border-white/10">
                        <CardHeader>
                          <Shield className="h-8 w-8 text-blue-400 mb-2" />
                          <CardTitle className="text-lg">Standard Protection</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-gray-400">Recommended for most creators</p>
                        </CardContent>
                      </Card>
                      <Card className="bg-white/5 border-white/10">
                        <CardHeader>
                          <Zap className="h-8 w-8 text-purple-400 mb-2" />
                          <CardTitle className="text-lg">Heavy Protection</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-gray-400">Maximum security for sensitive content</p>
                        </CardContent>
                      </Card>
                    </div>
                    <Button className="w-full bg-gradient-to-r from-purple-600 to-pink-600 h-12">
                      {isGuestMode ? "Sign Up to Access" : "Start Protecting Images"}
                    </Button>
                  </CardContent>
                </Card>
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
    </div>
  );
}