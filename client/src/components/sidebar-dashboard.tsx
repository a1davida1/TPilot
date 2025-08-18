import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LoginModal } from "./login-modal";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
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
  Rocket,
  LogIn,
  LogOut,
  UserPlus,
  Crown,
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  Home,
  PenTool,
  History,
  Settings,
  HelpCircle,
  Gift,
  Hash,
  BarChart,
  BookOpen,
  FileText,
  Calculator,
  Globe
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { UnifiedContentCreator } from "@/components/unified-content-creator";
import { AnalyticsDashboard } from "@/components/analytics-dashboard";
import { PerformanceOptimization } from "@/components/performance-optimization";
import { MobileOptimization } from "@/components/mobile-optimization";
import { RedditCommunities } from "@/components/reddit-communities";
import { TrendingTags } from "@/components/trending-tags";
import { AudienceInsights } from "@/components/audience-insights";
import { ImageGallery } from "@/components/image-gallery";
import { ProPerks } from "@/components/pro-perks";
import { ImageProtector } from "@/components/image-protector";
import { AdminPortal } from "@/components/admin-portal";
import { cn } from "@/lib/utils";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/sidebar"; // Assuming these are your sidebar components

interface SidebarDashboardProps {
  isGuestMode?: boolean;
}

// Placeholder for getPageTitle function, assuming it exists elsewhere or is defined here
const getPageTitle = () => {
  // This is a placeholder. In a real app, this would dynamically return the title
  // based on the activeSection or route.
  return "Dashboard Overview"; 
};

export function SidebarDashboard({ isGuestMode = false }: SidebarDashboardProps) {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [userTier, setUserTier] = useState<'guest' | 'free' | 'pro' | 'premium'>('guest');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeSection, setActiveSection] = useState('generator');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['content', 'creator-tools']));

  // Load user from localStorage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('user');
    if (storedUser) {
      const userData = JSON.parse(storedUser);
      setUser(userData);
      setUserTier(userData.tier || 'free');
    } else if (isGuestMode) {
      setUserTier('guest');
    }
  }, [isGuestMode]);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setUserTier('guest');
    window.location.reload();
  };

  const handleLoginSuccess = (userData: any) => {
    setUser(userData);
    setUserTier(userData.tier || 'free');
    window.location.reload();
  };

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  // Check if user is admin
  const isAdmin = user?.username === 'admin' || user?.isAdmin || user?.email === 'admin@thottopilot.com';

  const menuItems = [
    {
      id: 'creator-tools',
      label: 'Creator Tools',
      icon: <PenTool className="h-4 w-4" />,
      items: [
        { id: 'generator', label: 'Content Creator', icon: <Brain className="h-4 w-4" />, badge: 'Popular' },
        { id: 'gallery', label: 'Image Gallery', icon: <ImageIcon className="h-4 w-4" /> },
        { id: 'protect', label: 'Image Shield', icon: <Shield className="h-4 w-4" /> },
        { id: 'history', label: 'Generation History', icon: <History className="h-4 w-4" /> },
      ]
    },
    {
      id: 'content',
      label: 'Content Templates',
      icon: <Sparkles className="h-4 w-4" />,
      items: [
        { id: 'templates', label: 'Style Presets', icon: <FileText className="h-4 w-4" />, badge: '8 Styles' },
        { id: 'customization', label: 'Personalization', icon: <Settings className="h-4 w-4" /> },
        { id: 'export', label: 'Export Tools', icon: <FileText className="h-4 w-4" /> },
      ]
    },
    {
      id: 'growth',
      label: 'Growth & Analytics',
      icon: <TrendingUp className="h-4 w-4" />,
      items: [
        { id: 'reddit', label: 'Reddit Communities', icon: <Users className="h-4 w-4" />, badge: 'New' },
        { id: 'trending', label: 'Trending Tags', icon: <Hash className="h-4 w-4" /> },
        { id: 'audience', label: 'Audience Insights', icon: <BarChart className="h-4 w-4" /> },
        { id: 'analytics', label: 'Performance', icon: <Zap className="h-4 w-4" /> },
      ]
    },
    {
      id: 'resources',
      label: 'Resources & Tools',
      icon: <BookOpen className="h-4 w-4" />,
      items: [
        { id: 'perks', label: 'Pro Perks', icon: <Gift className="h-4 w-4" />, badge: '$1,247 Value' },
        { id: 'tax', label: 'Tax Tracker', icon: <Calculator className="h-4 w-4" /> },
        { id: 'guides', label: 'Creator Guides', icon: <FileText className="h-4 w-4" /> },
        { id: 'community', label: 'Community', icon: <Globe className="h-4 w-4" /> },
      ]
    },
    {
      id: 'enterprise',
      label: 'Enterprise Features',
      icon: <Crown className="h-4 w-4" />,
      items: [
        { id: 'enterprise-dashboard', label: 'Enterprise Dashboard', icon: <Crown className="h-4 w-4" />, badge: 'Phase 2' },
      ]
    },
    // Admin-only section
    ...(isAdmin ? [{
      id: 'admin',
      label: 'Administration',
      icon: <Shield className="h-4 w-4 text-red-400" />,
      items: [
        { id: 'admin-portal', label: 'Admin Control Center', icon: <Crown className="h-4 w-4 text-yellow-400" />, badge: 'Admin' },
      ]
    }] : [])
  ];

  const userStats = {
    postsCreated: userTier === 'guest' ? 0 : 47,
    totalViews: userTier === 'guest' ? 0 : 12840,
    engagementRate: userTier === 'guest' ? 0 : 14.9,
    streak: userTier === 'guest' ? 0 : 7
  };

  const renderContent = () => {
    switch (activeSection) {
      case 'content':
      case 'generator':
        return (
          <div className="space-y-6">
            <UnifiedContentCreator 
              onContentGenerated={(generation) => console.log('Generated:', generation)}
              isGuestMode={userTier === 'guest'}
              userTier={userTier === 'guest' ? "free" : userTier}
            />
            {userTier === 'guest' && (
              <Card className="bg-gray-800 border-purple-500/20">
                <CardContent className="p-4 text-center space-y-2">
                  <Sparkles className="h-8 w-8 mx-auto text-purple-400" />
                  <h4 className="text-sm font-medium text-white">Unlock Full Access</h4>
                  <p className="text-xs text-gray-400">Get unlimited generations and premium features</p>
                  <Button 
                    size="sm" 
                    className="w-full bg-gradient-to-r from-purple-600 to-pink-600"
                    onClick={() => setShowLoginModal(true)}
                  >
                    Sign Up Free
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        );

      case 'reddit':
        return <RedditCommunities />;

      case 'trending':
        return <TrendingTags />;

      case 'audience':
        return <AudienceInsights />;

      case 'gallery':
        return <ImageGallery />;

      case 'protect':
        return <ImageProtector userTier={userTier} />;

      case 'analytics':
        return <AnalyticsDashboard isGuestMode={userTier === 'guest'} />;

      case 'perks':
        return <ProPerks userTier={userTier} />;

      case 'admin-portal':
        return isAdmin ? <AdminPortal /> : null;

      case 'enterprise-dashboard':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-white">Enterprise Dashboard</h1>
                <p className="text-gray-400">Advanced AI content creation and automation</p>
              </div>
              <Badge className="bg-gradient-to-r from-purple-500 to-pink-500">Phase 2</Badge>
            </div>
            <div className="rounded-lg bg-gray-800 border border-purple-500/20 p-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
                <Card className="bg-gray-700 border-purple-500/20">
                  <CardContent className="p-4 text-center">
                    <Crown className="h-8 w-8 mx-auto text-yellow-500 mb-2" />
                    <h4 className="font-semibold text-white">AI Studio</h4>
                    <p className="text-xs text-gray-400">Multi-platform content generation</p>
                  </CardContent>
                </Card>
                <Card className="bg-gray-700 border-purple-500/20">
                  <CardContent className="p-4 text-center">
                    <ImageIcon className="h-8 w-8 mx-auto text-blue-500 mb-2" />
                    <h4 className="font-semibold text-white">Media Library</h4>
                    <p className="text-xs text-gray-400">S3 storage + watermarking</p>
                  </CardContent>
                </Card>
                <Card className="bg-gray-700 border-purple-500/20">
                  <CardContent className="p-4 text-center">
                    <Clock className="h-8 w-8 mx-auto text-green-500 mb-2" />
                    <h4 className="font-semibold text-white">Post Scheduler</h4>
                    <p className="text-xs text-gray-400">Reddit automation + timing</p>
                  </CardContent>
                </Card>
                <Card className="bg-gray-700 border-purple-500/20">
                  <CardContent className="p-4 text-center">
                    <DollarSign className="h-8 w-8 mx-auto text-purple-500 mb-2" />
                    <h4 className="font-semibold text-white">Billing</h4>
                    <p className="text-xs text-gray-400">CCBill integration</p>
                  </CardContent>
                </Card>
              </div>
              
              <div className="text-center space-y-4">
                <p className="text-gray-300">Access the full Enterprise Dashboard with all advanced features:</p>
                <ul className="text-sm text-gray-400 space-y-1">
                  <li>• Advanced AI content studio with Gemini + OpenAI integration</li>
                  <li>• Secure media library with AWS S3 storage and watermarking</li>
                  <li>• Intelligent Reddit post scheduling with BullMQ queues</li>
                  <li>• CCBill billing integration with Pro/Premium subscriptions</li>
                  <li>• Background job processing with Redis queue system</li>
                </ul>
                
                <Button 
                  onClick={() => window.location.href = '/enterprise'}
                  className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                  data-testid="button-open-enterprise"
                >
                  <Crown className="h-4 w-4 mr-2" />
                  Open Enterprise Dashboard
                </Button>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <Card className="min-h-[400px] flex items-center justify-center">
            <div className="text-center space-y-4">
              <Sparkles className="h-16 w-16 mx-auto text-gray-400" />
              <h3 className="text-xl font-medium text-gray-600">Coming Soon</h3>
              <p className="text-gray-500">This feature is under development</p>
            </div>
          </Card>
        );
    }
  };

  return (
    <MobileOptimization>
      <div className="min-h-screen bg-black">
        {/* Header */}
        <header className="bg-gray-900 border-b border-purple-500/20 sticky top-0 z-50">
          <div className="flex items-center justify-between px-4 h-16">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="text-gray-400 hover:text-white"
              >
                {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>

              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                  ThottoPilot
                </h1>
              </div>

              {userTier === 'pro' && (
                <Badge className="bg-purple-600/20 text-purple-400 border-purple-500/30">
                  <Crown className="mr-1 h-3 w-3" />
                  Pro
                </Badge>
              )}
              {userTier === 'premium' && (
                <Badge className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 text-pink-400 border-pink-500/30">
                  <Sparkles className="mr-1 h-3 w-3" />
                  Premium
                </Badge>
              )}
            </div>

            <div className="flex items-center space-x-4">
              <ThemeToggle />
              {userTier === 'guest' ? (
                <>
                  <Button 
                    variant="outline"
                    onClick={() => setShowLoginModal(true)}
                    className="border-purple-500/20 hover:border-purple-500/40 text-gray-300"
                  >
                    <LogIn className="mr-2 h-4 w-4" />
                    Login
                  </Button>
                  <Button 
                    className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                    onClick={() => setShowLoginModal(true)}
                  >
                    <UserPlus className="mr-2 h-4 w-4" />
                    Sign Up Free
                  </Button>
                </>
              ) : (
                <div className="flex items-center space-x-3">
                  <div className="text-sm text-gray-300">
                    <div className="font-medium">{user?.username || 'User'}</div>
                    <div className="text-xs text-gray-500">
                      {userTier === 'pro' ? 'Pro Member' : userTier === 'premium' ? 'Premium' : 'Free Account'}
                    </div>
                  </div>
                  {userTier === 'free' && (
                    <Button 
                      variant="outline" 
                      size="sm"
                      className="border-purple-500/20 hover:border-purple-500/40 text-purple-400"
                      onClick={() => setShowLoginModal(true)}
                    >
                      <Crown className="mr-1 h-3 w-3" />
                      Upgrade
                    </Button>
                  )}
                  <Button 
                    variant="ghost" 
                    size="icon"
                    onClick={handleLogout}
                    className="text-gray-400 hover:text-white"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </header>

        <div className="flex">
          {/* Sidebar */}
          <aside className={cn(
            "bg-gray-900 border-r border-purple-500/20 transition-all duration-300",
            sidebarOpen ? "w-64" : "w-0 overflow-hidden"
          )}>
            <ScrollArea className="h-[calc(100vh-4rem)]">
              <div className="p-4 space-y-4">
                {/* Quick Stats */}
                <Card className="bg-gray-800 border-purple-500/20">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">Posts Created</span>
                      <span className="text-sm font-bold text-white">{userStats.postsCreated}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">Total Views</span>
                      <span className="text-sm font-bold text-white">{userStats.totalViews.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">Engagement</span>
                      <span className="text-sm font-bold text-green-400">{userStats.engagementRate}%</span>
                    </div>
                    <Separator className="bg-purple-500/20" />
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-400">Daily Streak</span>
                      <div className="flex items-center space-x-1">
                        <Zap className="h-3 w-3 text-orange-400" />
                        <span className="text-sm font-bold text-orange-400">{userStats.streak}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Navigation */}
                <div className="space-y-2">
                  {menuItems.map((section) => (
                    <div key={section.id} className="space-y-1">
                      <Button
                        variant="ghost"
                        className="w-full justify-between text-gray-300 hover:text-white hover:bg-purple-600/10"
                        onClick={() => toggleSection(section.id)}
                      >
                        <div className="flex items-center space-x-2">
                          {section.icon}
                          <span className="text-sm font-medium">{section.label}</span>
                        </div>
                        {expandedSections.has(section.id) ? (
                          <ChevronDown className="h-4 w-4" />
                        ) : (
                          <ChevronRight className="h-4 w-4" />
                        )}
                      </Button>

                      {expandedSections.has(section.id) && (
                        <div className="ml-4 space-y-1">
                          {section.items.map((item) => (
                            <Button
                              key={item.id}
                              variant="ghost"
                              className={cn(
                                "w-full justify-start text-sm",
                                activeSection === item.id 
                                  ? "bg-purple-600/20 text-purple-400 border-l-2 border-purple-400" 
                                  : "text-gray-400 hover:text-white hover:bg-purple-600/10"
                              )}
                              onClick={() => setActiveSection(item.id)}
                              disabled={item.proOnly && userTier === 'guest'}
                            >
                              <div className="flex items-center justify-between w-full">
                                <div className="flex items-center space-x-2">
                                  {item.icon}
                                  <span>{item.label}</span>
                                </div>
                                {item.badge && (
                                  <Badge className="bg-purple-600/20 text-purple-400 text-xs">
                                    {item.badge}
                                  </Badge>
                                )}
                                {item.proOnly && userTier === 'guest' && (
                                  <Crown className="h-3 w-3 text-yellow-400" />
                                )}
                              </div>
                            </Button>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Upgrade Card for Free Users */}
                {userTier === 'free' && (
                  <Card className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 border-purple-500/30">
                    <CardContent className="p-4 text-center space-y-2">
                      <Crown className="h-8 w-8 mx-auto text-yellow-400" />
                      <h4 className="text-sm font-medium text-white">Upgrade to Pro</h4>
                      <p className="text-xs text-gray-400">Unlock all features and remove limits</p>
                      <Button 
                        size="sm" 
                        className="w-full bg-gradient-to-r from-purple-600 to-pink-600"
                        onClick={() => setShowLoginModal(true)}
                      >
                        Upgrade Now
                      </Button>
                    </CardContent>
                  </Card>
                )}
              </div>
            </ScrollArea>
          </aside>

          {/* Main Content */}
          <main className="flex-1 p-6 overflow-auto bg-background text-foreground">
            {/* Guest Mode Banner */}
            {userTier === 'guest' && (
              <Alert className="mb-6 bg-gradient-to-r from-orange-500/10 to-pink-500/10 border-orange-500/20">
                <Sparkles className="h-4 w-4 text-orange-400" />
                <AlertDescription className="text-gray-300">
                  <div className="flex items-center justify-between">
                    <div>
                      <strong>Guest Mode Active!</strong> Sign up to save your work and unlock all features.
                    </div>
                    <Button 
                      size="sm"
                      className="bg-gradient-to-r from-orange-500 to-pink-500"
                      onClick={() => setShowLoginModal(true)}
                    >
                      Sign Up Free
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Free User Banner */}
            {userTier === 'free' && (
              <Alert className="mb-6 bg-purple-600/10 border-purple-500/20">
                <Crown className="h-4 w-4 text-purple-400" />
                <AlertDescription className="text-gray-300">
                  <div className="flex items-center justify-between">
                    <span>Unlock Pro features: Image workflow, unlimited generations, priority support</span>
                    <Button 
                      variant="ghost" 
                      size="sm"
                      className="text-purple-400 hover:text-purple-300"
                      onClick={() => setShowLoginModal(true)}
                    >
                      Upgrade to Pro
                    </Button>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Content Area */}
            {renderContent()}
          </main>
        </div>
      </div>

      {/* Login Modal */}
      <LoginModal 
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onSuccess={handleLoginSuccess}
      />
    </MobileOptimization>
  );
}