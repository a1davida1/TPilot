import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { LoginModal } from "./login-modal";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useLocation } from "wouter";
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
  Globe,
  Smartphone,
  PlayCircle
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { UnifiedContentCreator } from "@/components/unified-content-creator";
import { AnalyticsDashboard } from "@/components/analytics-dashboard";
import { PerformanceOptimization } from "@/components/performance-optimization";
import { MobileOptimization } from "@/components/mobile-optimization";
import { RedditCommunities } from "@/components/reddit-communities";
import { RedditAccounts } from "@/components/reddit-accounts";
import { TrendingTags } from "@/components/trending-tags";
import { AudienceInsights } from "@/components/audience-insights";
import { ImageGallery } from "@/components/image-gallery";
import { ProPerks } from "@/components/pro-perks";
import { ImageProtector } from "@/components/image-protector";
import { AdminPortal } from "@/components/admin-portal";
import TaxTracker from "@/pages/tax-tracker";
import { GettingStarted } from "@/components/getting-started";
import { cn } from "@/lib/utils";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
// Navigation system using custom sidebar approach

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
  const [location, setLocation] = useLocation();
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [userTier, setUserTier] = useState<'guest' | 'free' | 'pro' | 'premium'>('guest');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeSection, setActiveSection] = useState('analytics');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['creator-tools']));

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
    localStorage.removeItem('authToken');
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
      id: 'getting-started',
      label: 'Getting Started',
      icon: <BookOpen className="h-4 w-4" />,
      badge: 'Setup Guide'
    },
    {
      id: 'creator-tools',
      label: 'Creator Tools',
      icon: <PenTool className="h-4 w-4" />,
      items: [
        { id: 'generator', label: 'Content Creator', icon: <Brain className="h-4 w-4" />, badge: 'Popular' },
        { id: 'caption-ai', label: 'AI Caption Generator', icon: <Sparkles className="h-4 w-4" />, badge: '2-Pass AI', link: '/caption-generator' },
        { id: 'gallery', label: 'Image Gallery', icon: <ImageIcon className="h-4 w-4" /> },
        { id: 'protect', label: 'Image Shield', icon: <Shield className="h-4 w-4" />, proOnly: true },
        { id: 'history', label: 'Generation History', icon: <History className="h-4 w-4" /> },
      ]
    },
    {
      id: 'content',
      label: 'Content Templates',
      icon: <Sparkles className="h-4 w-4" />,
      items: [
        { id: 'templates', label: 'Style Presets', icon: <FileText className="h-4 w-4" />, badge: '8 Styles' },
        { id: 'customization', label: 'Personalization', icon: <Settings className="h-4 w-4" />, proOnly: true },
        { id: 'export', label: 'Export Tools', icon: <FileText className="h-4 w-4" /> },
      ]
    },
    {
      id: 'growth',
      label: 'Growth & Analytics',
      icon: <TrendingUp className="h-4 w-4" />,
      items: [
        { id: 'reddit', label: 'Reddit Communities', icon: <Users className="h-4 w-4" />, badge: 'New' },
        { id: 'reddit-accounts', label: 'Connect Reddit', icon: <Globe className="h-4 w-4" />, badge: 'Setup' },
        { id: 'trending', label: 'Trending Tags', icon: <Hash className="h-4 w-4" /> },
        { id: 'audience', label: 'Audience Insights', icon: <BarChart className="h-4 w-4" />, proOnly: true },
        { id: 'analytics', label: 'Performance', icon: <Zap className="h-4 w-4" />, proOnly: true },
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
    // ULTRA PREMIUM FEATURES - Hidden for now, will be enabled for ultra premium tier later
    /*
    {
      id: 'phase3',
      label: 'Advanced Experience',
      icon: <Brain className="h-4 w-4" />,
      items: [
        { id: 'smart-analytics', label: 'Smart Analytics', icon: <BarChart className="h-4 w-4" />, badge: 'Phase 3' },
        { id: 'performance-optimizer', label: 'Performance Optimizer', icon: <Zap className="h-4 w-4" />, badge: 'AI-Powered' },
        { id: 'user-onboarding', label: 'Getting Started', icon: <BookOpen className="h-4 w-4" />, badge: 'Interactive' },
        { id: 'mobile-pwa', label: 'Mobile & PWA', icon: <Smartphone className="h-4 w-4" />, badge: 'Enhanced' },
      ]
    },
    {
      id: 'phase4',
      label: 'Automation & Intelligence',
      icon: <Rocket className="h-4 w-4" />,
      items: [
        { id: 'phase4-dashboard', label: 'Phase 4 Dashboard', icon: <Rocket className="h-4 w-4" />, badge: 'Phase 4' },
      ]
    },
    */
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

  const [userStats, setUserStats] = useState({
    postsCreated: 0,
    totalViews: 0,
    engagementRate: 0,
    streak: 0,
    dailyGenerations: {
      used: 0,
      limit: 5,
      remaining: 5
    }
  });
  
  // Fetch real user stats
  useEffect(() => {
    const fetchUserStats = async () => {
      if (userTier === 'guest') {
        setUserStats({
          postsCreated: 0,
          totalViews: 0,
          engagementRate: 0,
          streak: 0,
          dailyGenerations: {
            used: 0,
            limit: 5,
            remaining: 5
          }
        });
        return;
      }

      try {
        const token = localStorage.getItem('authToken');
        if (!token) return;

        const response = await fetch('/api/user/stats', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const stats = await response.json();
          setUserStats({
            postsCreated: stats.postsCreated,
            totalViews: stats.totalViews,
            engagementRate: parseFloat(stats.engagementRate),
            streak: stats.streak,
            dailyGenerations: stats.dailyGenerations || {
              used: 0,
              limit: 5,
              remaining: 5
            }
          });
        }
      } catch (error) {
        console.error('Error fetching user stats:', error);
      }
    };

    fetchUserStats();
  }, [userTier]);

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
              <Card className="bg-white border-gray-200">
                <CardContent className="p-4 text-center space-y-2">
                  <Sparkles className="h-8 w-8 mx-auto text-purple-400" />
                  <h4 className="text-sm font-medium text-gray-900">Unlock Full Access</h4>
                  <p className="text-xs text-gray-600">Get unlimited generations and premium features</p>
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

      case 'reddit-accounts':
        return <RedditAccounts />;

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

      case 'getting-started':
        return (
          <div data-testid="content-getting-started">
            <GettingStarted 
              userTier={userTier} 
              onSectionSelect={(section) => setActiveSection(section)}
              onSetupLater={() => setActiveSection('analytics')}
            />
          </div>
        );
      
      case 'tax':
        return <TaxTracker />;

      case 'admin-portal':
        return isAdmin ? <AdminPortal /> : null;

      case 'enterprise-dashboard':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Enterprise Dashboard</h1>
                <p className="text-gray-600">Advanced AI content creation and automation</p>
              </div>
              <Badge className="bg-gradient-to-r from-purple-500 to-pink-500">Phase 2</Badge>
            </div>
            <div className="rounded-lg bg-white border border-gray-200 p-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
                <Card className="bg-gray-700 border-gray-200">
                  <CardContent className="p-4 text-center">
                    <Crown className="h-8 w-8 mx-auto text-yellow-500 mb-2" />
                    <h4 className="font-semibold text-gray-900">AI Studio</h4>
                    <p className="text-xs text-gray-600">Multi-platform content generation</p>
                  </CardContent>
                </Card>
                <Card className="bg-gray-700 border-gray-200">
                  <CardContent className="p-4 text-center">
                    <ImageIcon className="h-8 w-8 mx-auto text-blue-500 mb-2" />
                    <h4 className="font-semibold text-gray-900">Media Library</h4>
                    <p className="text-xs text-gray-600">S3 storage + watermarking</p>
                  </CardContent>
                </Card>
                <Card className="bg-gray-700 border-gray-200">
                  <CardContent className="p-4 text-center">
                    <Clock className="h-8 w-8 mx-auto text-green-500 mb-2" />
                    <h4 className="font-semibold text-gray-900">Post Scheduler</h4>
                    <p className="text-xs text-gray-600">Reddit automation + timing</p>
                  </CardContent>
                </Card>
                <Card className="bg-gray-700 border-gray-200">
                  <CardContent className="p-4 text-center">
                    <DollarSign className="h-8 w-8 mx-auto text-purple-500 mb-2" />
                    <h4 className="font-semibold text-gray-900">Billing</h4>
                    <p className="text-xs text-gray-600">CCBill integration</p>
                  </CardContent>
                </Card>
              </div>
              
              <div className="text-center space-y-4">
                <p className="text-gray-300">Access the full Enterprise Dashboard with all advanced features:</p>
                <ul className="text-sm text-gray-600 space-y-1">
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

      case 'phase4-dashboard':
        return (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Phase 4: Advanced Automation</h1>
                <p className="text-gray-600">AI-powered automation, trend intelligence, and community management</p>
              </div>
              <Badge className="bg-gradient-to-r from-purple-500 to-pink-500">Phase 4</Badge>
            </div>
            <div className="rounded-lg bg-white border border-gray-200 p-6">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
                <Card className="bg-gray-700 border-gray-200">
                  <CardContent className="p-4 text-center">
                    <Zap className="h-8 w-8 mx-auto text-blue-500 mb-2" />
                    <h4 className="font-semibold text-gray-900">Social Automation</h4>
                    <p className="text-xs text-gray-600">Smart posting & engagement</p>
                  </CardContent>
                </Card>
                <Card className="bg-gray-700 border-gray-200">
                  <CardContent className="p-4 text-center">
                    <Brain className="h-8 w-8 mx-auto text-purple-500 mb-2" />
                    <h4 className="font-semibold text-gray-900">Trend Intelligence</h4>
                    <p className="text-xs text-gray-600">AI-powered trend analysis</p>
                  </CardContent>
                </Card>
                <Card className="bg-gray-700 border-gray-200">
                  <CardContent className="p-4 text-center">
                    <Users className="h-8 w-8 mx-auto text-green-500 mb-2" />
                    <h4 className="font-semibold text-gray-900">Community Manager</h4>
                    <p className="text-xs text-gray-600">Auto-replies & engagement</p>
                  </CardContent>
                </Card>
                <Card className="bg-gray-700 border-gray-200">
                  <CardContent className="p-4 text-center">
                    <Target className="h-8 w-8 mx-auto text-pink-500 mb-2" />
                    <h4 className="font-semibold text-gray-900">Content Optimizer</h4>
                    <p className="text-xs text-gray-600">A/B testing & optimization</p>
                  </CardContent>
                </Card>
              </div>
              
              <div className="text-center space-y-4">
                <p className="text-gray-300">Access the full Phase 4 automation and intelligence suite:</p>
                <ul className="text-sm text-gray-600 space-y-1">
                  <li>• Advanced social media automation with smart posting schedules</li>
                  <li>• AI-powered trend detection and content suggestions</li>
                  <li>• Intelligent community management with auto-responses</li>
                  <li>• Content optimization through A/B testing and performance analysis</li>
                  <li>• Cross-platform automation with sophisticated targeting</li>
                </ul>
                
                <Button 
                  onClick={() => window.location.href = '/phase4'}
                  className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                  data-testid="button-open-phase4"
                >
                  <Rocket className="h-4 w-4 mr-2" />
                  Open Phase 4 Dashboard
                </Button>
              </div>
            </div>
          </div>
        );

      default:
        return (
          <Card className="min-h-[400px] flex items-center justify-center">
            <div className="text-center space-y-4">
              <Sparkles className="h-16 w-16 mx-auto text-gray-600" />
              <h3 className="text-xl font-medium text-gray-600">Coming Soon</h3>
              <p className="text-gray-500">This feature is under development</p>
            </div>
          </Card>
        );
    }
  };

  return (
    <MobileOptimization>
      <div className="min-h-screen bg-white">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
          <div className="flex items-center justify-between px-4 h-16">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="text-gray-600 hover:text-gray-900"
              >
                {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
              </Button>

              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg flex items-center justify-center">
                  <Sparkles className="h-5 w-5 text-gray-900" />
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
                    className="border-gray-200 hover:border-purple-500/40 text-gray-300"
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
                      className="border-gray-200 hover:border-purple-500/40 text-purple-400"
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
                    className="text-gray-600 hover:text-gray-900"
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
            "bg-white border-r border-gray-200 transition-all duration-300",
            sidebarOpen ? "w-80" : "w-0 overflow-hidden"
          )}>
            <ScrollArea className="h-[calc(100vh-4rem)]">
              <div className="p-4 space-y-4">
                {/* Quick Stats */}
                <Card className="bg-white border-gray-200">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">Posts Created</span>
                      <span className="text-sm font-bold text-gray-900">{userStats.postsCreated}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">Total Views</span>
                      <span className="text-sm font-bold text-gray-900">{userStats.totalViews.toLocaleString()}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">Engagement</span>
                      <span className="text-sm font-bold text-green-400">{userStats.engagementRate}%</span>
                    </div>
                    <Separator className="bg-purple-500/20" />
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-600">Daily Streak</span>
                      <div className="flex items-center space-x-1">
                        <Zap className="h-3 w-3 text-orange-400" />
                        <span className="text-sm font-bold text-orange-400">{userStats.streak}</span>
                      </div>
                    </div>
                    {userTier !== 'guest' && (
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-600">Daily Generations</span>
                        <div className="flex items-center space-x-1">
                          <span className={`text-sm font-bold ${
                            userStats.dailyGenerations.remaining === 0 ? 'text-red-400' :
                            userStats.dailyGenerations.remaining <= 1 ? 'text-orange-400' :
                            'text-purple-400'
                          }`}>
                            {userStats.dailyGenerations.limit === -1 ? '∞' : 
                             `${userStats.dailyGenerations.used}/${userStats.dailyGenerations.limit}`}
                          </span>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Navigation */}
                <div className="space-y-2">
                  {menuItems.map((section) => (
                    <div key={section.id} className="space-y-1">
                      {/* Single item without subitems */}
                      {!section.items ? (
                        <Button
                          variant="ghost"
                          className={cn(
                            "w-full justify-start text-sm",
                            activeSection === section.id 
                              ? "bg-purple-600/20 text-purple-400 border-l-2 border-purple-400" 
                              : "text-gray-300 hover:text-gray-900 hover:bg-purple-600/10"
                          )}
                          onClick={() => setActiveSection(section.id)}
                        >
                          <div className="flex items-center justify-between w-full min-w-0">
                            <div className="flex items-center space-x-2 min-w-0 flex-1">
                              {section.icon}
                              <span className="truncate">{section.label}</span>
                            </div>
                            {section.badge && (
                              <span className="px-2 py-1 text-xs bg-purple-600/20 text-purple-400 rounded-full flex-shrink-0">
                                {section.badge}
                              </span>
                            )}
                          </div>
                        </Button>
                      ) : (
                        /* Section with dropdown items */
                        <>
                          <Button
                            variant="ghost"
                            className="w-full justify-between text-gray-300 hover:text-gray-900 hover:bg-purple-600/10"
                            onClick={() => toggleSection(section.id)}
                          >
                            <div className="flex items-center space-x-2 min-w-0 flex-1">
                              {section.icon}
                              <span className="text-sm font-medium truncate">{section.label}</span>
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
                                  : "text-gray-600 hover:text-gray-900 hover:bg-purple-600/10"
                              )}
                              onClick={() => {
                                if ((item as any).link) {
                                  setLocation((item as any).link);
                                } else {
                                  setActiveSection(item.id);
                                }
                              }}
                              disabled={item.proOnly && userTier === 'guest'}
                            >
                              <div className="flex items-center justify-between w-full min-w-0">
                                <div className="flex items-center space-x-2 min-w-0 flex-1">
                                  {item.icon}
                                  <span className="truncate">{item.label}</span>
                                </div>
                                <div className="flex items-center space-x-1 flex-shrink-0">
                                  {item.badge && (
                                    <Badge className="bg-purple-600/20 text-purple-400 text-xs whitespace-nowrap">
                                      {item.badge}
                                    </Badge>
                                  )}
                                  {item.proOnly && userTier === 'guest' && (
                                    <Crown className="h-3 w-3 text-yellow-400" />
                                  )}
                                </div>
                              </div>
                            </Button>
                                ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  ))}
                </div>

                {/* Upgrade Card for Free Users */}
                {userTier === 'free' && (
                  <Card className="bg-gradient-to-r from-purple-600/20 to-pink-600/20 border-purple-500/30">
                    <CardContent className="p-4 text-center space-y-2">
                      <Crown className="h-8 w-8 mx-auto text-yellow-400" />
                      <h4 className="text-sm font-medium text-gray-900">Upgrade to Pro</h4>
                      <p className="text-xs text-gray-600">Unlock all features and remove limits</p>
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
              <Alert className="mb-6 bg-purple-600/10 border-gray-200">
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