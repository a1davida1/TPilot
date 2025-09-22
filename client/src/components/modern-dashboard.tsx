import React, { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { 
  Upload,
  Sparkles,
  Shield,
  Target,
  Scale,
  BarChart3,
  Calculator,
  Gift,
  Menu,
  X,
  Clock,
  Bell,
  Settings,
  ChevronRight,
  Home,
  Brain,
  Users,
  Hash,
  History,
  ImageIcon,
  Wand2,
  Zap,
  ListChecks,
  Command
} from "lucide-react";
import { FaReddit } from "react-icons/fa";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface ModernDashboardProps {
  isRedditConnected?: boolean;
  user?: { id: number; username: string; email?: string; tier?: string; isVerified?: boolean };
  userTier?: 'guest' | 'free' | 'basic' | 'starter' | 'pro' | 'premium' | 'admin';
  isAdmin?: boolean;
}

interface DashboardStatsResponse {
  postsToday: number;
  engagementRate: number;
  takedownsFound: number;
  estimatedTaxSavings: number;
}

interface DashboardActivityResponse {
  recentMedia: Array<{
    id: number;
    url: string;
    alt: string;
    createdAt: string | null;
  }>;
}

export type { DashboardStatsResponse, DashboardActivityResponse };

const numberFormatter = new Intl.NumberFormat('en-US');

function formatNumber(value: number): string {
  return numberFormatter.format(value);
}

function formatPercentage(value: number): string {
  if (!Number.isFinite(value)) {
    return '0%';
  }
  const fractionDigits = Number.isInteger(value) ? 0 : 1;
  return `${value.toFixed(fractionDigits)}%`;
}

function formatCurrency(value: number): string {
  if (!Number.isFinite(value)) {
    return '$0';
  }
  const minimumFractionDigits = Number.isInteger(value) ? 0 : 2;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits,
    maximumFractionDigits: 2,
  }).format(value);
}

export function ModernDashboard({ isRedditConnected = false, user, userTier = 'free', isAdmin = false }: ModernDashboardProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [selectedCard, setSelectedCard] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { user: authUser } = useAuth();
  
  const resolvedTier = (authUser?.tier as ModernDashboardProps['userTier'] | undefined) ?? userTier;
  const resolvedUser = authUser ?? user;
  const isAdminUser = Boolean(authUser?.isAdmin || authUser?.role === 'admin' || resolvedTier === 'admin' || isAdmin);
  const isPremium = isAdminUser || resolvedTier === 'premium' || resolvedTier === 'pro';
  const displayName = resolvedUser?.username ?? resolvedUser?.email ?? 'Creator';
  const dashboardPrompt = isAdminUser
    ? 'Review platform performance and respond to creator needs.'
    : 'What would you like to do today?';

  const {
    data: statsData,
    isLoading: statsLoading,
    error: statsError,
  } = useQuery<DashboardStatsResponse>({
    queryKey: ['/api/dashboard/stats'],
    enabled: Boolean(resolvedUser?.id),
  });

  const {
    data: activityData,
    isLoading: activityLoading,
    error: activityError,
  } = useQuery<DashboardActivityResponse>({
    queryKey: ['/api/dashboard/activity'],
    enabled: Boolean(resolvedUser?.id),
  });

  useEffect(() => {
    if (statsError instanceof Error) {
      toast({
        title: "Unable to load dashboard stats",
        description: statsError.message,
      });
    }
  }, [statsError, toast]);

  useEffect(() => {
    if (activityError instanceof Error) {
      toast({
        title: "Unable to load media activity",
        description: activityError.message,
      });
    }
  }, [activityError, toast]);
  
  // Get current time greeting
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const statsLoadingWithoutData = statsLoading && !statsData;
  const statsUnavailable = (!statsLoading && !statsData && statsError instanceof Error) || statsLoadingWithoutData;
  const statsSummary = {
    postsToday: statsData?.postsToday ?? 0,
    engagementRate: statsData?.engagementRate ?? 0,
    takedownsFound: statsData?.takedownsFound ?? 0,
    estimatedTaxSavings: statsData?.estimatedTaxSavings ?? 0,
  } satisfies DashboardStatsResponse;

  const statsCards = [
    {
      label: "Posts Today",
      value: statsUnavailable ? "--" : formatNumber(statsSummary.postsToday),
      icon: <Upload className="h-5 w-5" />,
      color: "text-purple-400"
    },
    {
      label: "Engagement Rate",
      value: statsUnavailable ? "--" : formatPercentage(statsSummary.engagementRate),
      icon: <Target className="h-5 w-5" />,
      color: "text-green-400"
    },
    {
      label: "Takedowns Found",
      value: statsUnavailable ? "--" : formatNumber(statsSummary.takedownsFound),
      icon: <Shield className="h-5 w-5" />,
      color: "text-yellow-400"
    },
    {
      label: "Estimated Tax Savings",
      value: statsUnavailable ? "--" : formatCurrency(statsSummary.estimatedTaxSavings),
      icon: <Calculator className="h-5 w-5" />,
      color: "text-blue-400"
    }
  ];

  const galleryItems = activityData?.recentMedia ?? [];
  const showGalleryEmptyState = !activityLoading && galleryItems.length === 0;

  const actionCards = [
    {
      id: "quick-post",
      title: "Quick Post",
      description: "Upload a post in seconds",
      icon: <Upload className="h-6 w-6" />,
      color: "from-purple-500 to-purple-600",
      route: "/reddit"
    },
    {
      id: "generate-caption",
      title: "Generate Caption",
      description: "AI-powered content",
      icon: <Sparkles className="h-6 w-6" />,
      color: "from-blue-500 to-blue-600",
      route: "/caption-generator"
    },
    {
      id: "protect-image",
      title: "Protect Image",
      description: "Image/Video protection",
      icon: <Shield className="h-6 w-6" />,
      color: "from-green-500 to-green-600",
      route: "/imageshield"
    },
    {
      id: "find-subreddits",
      title: "Find Subreddits",
      description: "Best communities for you",
      icon: <Target className="h-6 w-6" />,
      color: "from-orange-500 to-orange-600",
      route: "/communities"
    },
    {
      id: "scan-takedowns",
      title: "Scan Takedowns",
      description: "Find leaked content",
      icon: <Scale className="h-6 w-6" />,
      color: "from-red-500 to-red-600",
      route: null,
      comingSoon: true
    },
    {
      id: "view-analytics",
      title: "View Analytics",
      description: "Performance insights",
      icon: <BarChart3 className="h-6 w-6" />,
      color: "from-indigo-500 to-indigo-600",
      route: null,
      comingSoon: true
    },
    {
      id: "tax-tracker",
      title: "Tax Tracker",
      description: "Track expenses",
      icon: <Calculator className="h-6 w-6" />,
      color: "from-teal-500 to-teal-600",
      route: "/tax-tracker"
    },
    {
      id: "pro-perks",
      title: "ProPerks",
      description: "Exclusive deals",
      icon: <Gift className="h-6 w-6" />,
      color: "from-pink-500 to-pink-600",
      route: null,
      premium: true
    }
  ];

  const handleCardClick = (card: typeof actionCards[0]) => {
    if (card.route) {
      setLocation(card.route);
    } else if (card.comingSoon) {
      toast({
        title: "Coming Soon",
        description: `${card.title} feature is being developed.`,
      });
    } else if (card.premium && !isPremium) {
      toast({
        title: "Premium Feature",
        description: "Upgrade to Pro to access this feature.",
      });
    }
  };

  const handleQuickAction = () => {
    toast({
      title: "Quick Actions",
      description: "Quick action menu opening...",
    });
  };

  const handleCommandCenter = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const handleTaskFlow = () => {
    toast({
      title: "Task Flow",
      description: "Guided workflow starting...",
    });
  };


  return (
    <div className="min-h-screen bg-gradient-purple">
      {/* Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 h-full w-[280px] bg-gray-900 border-r border-gray-800 z-50 transform transition-transform duration-300",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="p-6">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center">
                <img 
                  src="/logo.png" 
                  alt="ThottoPilot" 
                  className="w-8 h-8 rounded-lg"
                />
              </div>
              <span className="text-xl font-bold text-purple-gradient">
                ThottoPilot
              </span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(false)}
              className="text-gray-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation Items */}
          <nav className="space-y-2">
            <button 
              onClick={() => setLocation('/dashboard')}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-white hover:bg-purple-600/20 rounded-lg transition-all"
            >
              <Home className="h-5 w-5" />
              <span>Dashboard</span>
            </button>
            <button 
              onClick={() => setLocation('/reddit')}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-white hover:bg-purple-600/20 rounded-lg transition-all"
            >
              <FaReddit className="h-5 w-5" />
              <span>Reddit Hub</span>
              <Badge className="ml-auto" variant="secondary">NEW</Badge>
            </button>
            <button 
              onClick={() => setLocation('/caption-generator')}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-white hover:bg-purple-600/20 rounded-lg transition-all"
            >
              <Brain className="h-5 w-5" />
              <span>Content Creator</span>
            </button>
            <button 
              onClick={() => setLocation('/imageshield')}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-white hover:bg-purple-600/20 rounded-lg transition-all"
            >
              <Shield className="h-5 w-5" />
              <span>ImageShield</span>
            </button>
            <button 
              onClick={() => setLocation('/gallery')}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-white hover:bg-purple-600/20 rounded-lg transition-all"
            >
              <ImageIcon className="h-5 w-5" />
              <span>Media Gallery</span>
            </button>
            <button 
              onClick={() => setLocation('/communities')}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-white hover:bg-purple-600/20 rounded-lg transition-all"
            >
              <Users className="h-5 w-5" />
              <span>Communities</span>
            </button>
            <button 
              onClick={() => setLocation('/tax-tracker')}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-white hover:bg-purple-600/20 rounded-lg transition-all"
            >
              <Calculator className="h-5 w-5" />
              <span>Tax Tracker</span>
            </button>
            <button 
              onClick={() => setLocation('/history')}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-white hover:bg-purple-600/20 rounded-lg transition-all"
            >
              <History className="h-5 w-5" />
              <span>History</span>
            </button>
            <button 
              onClick={() => setLocation('/settings')}
              className="w-full flex items-center gap-3 px-3 py-2.5 text-white hover:bg-purple-600/20 rounded-lg transition-all"
            >
              <Settings className="h-5 w-5" />
              <span>Settings</span>
            </button>
          </nav>
        </div>
      </aside>

      {/* Main Content */}
      <div className="p-6 md:p-8">
        {/* Header with Action Buttons */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
            <div className="flex gap-3">
              <Button
                onClick={handleQuickAction}
                className="bg-purple-600 hover:bg-purple-700 text-white"
              >
                <Zap className="h-4 w-4 mr-2" />
                Quick Action
              </Button>
              <Button
                onClick={handleCommandCenter}
                className="bg-gray-800 hover:bg-gray-700 text-white"
              >
                <Command className="h-4 w-4 mr-2" />
                Command Center
              </Button>
              <Button
                onClick={handleTaskFlow}
                className="bg-gray-800 hover:bg-gray-700 text-white"
              >
                <ListChecks className="h-4 w-4 mr-2" />
                Task Flow
              </Button>
            </div>
            <div className="flex gap-3">
              <Button variant="ghost" size="icon" className="text-white">
                <Bell className="h-5 w-5" />
              </Button>
              <Button variant="ghost" size="icon" className="text-white">
                <Settings className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">
            {getGreeting()}, {displayName}! 👋
          </h1>
          <p className="text-xl text-gray-300">
            {dashboardPrompt}
          </p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {statsCards.map((stat) => (
            <Card key={stat.label} className="bg-gray-800 border-gray-700">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className={stat.color}>{stat.icon}</span>
                  <span className="text-2xl font-bold text-white">{stat.value}</span>
                </div>
                <p className="text-gray-400 text-sm">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Action Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {actionCards.map((card) => (
            <Card
              key={card.id}
              className={cn(
                "bg-gray-800 border-gray-700 cursor-pointer transition-all hover:scale-105",
                selectedCard === card.id && "ring-2 ring-purple-500"
              )}
              onClick={() => handleCardClick(card)}
              onMouseEnter={() => setSelectedCard(card.id)}
              onMouseLeave={() => setSelectedCard(null)}
            >
              <CardContent className="p-6">
                <div className={cn(
                  "w-12 h-12 rounded-lg bg-gradient-to-br flex items-center justify-center mb-4",
                  card.color
                )}>
                  {card.icon}
                </div>
                <h3 className="text-white font-semibold mb-1">{card.title}</h3>
                <p className="text-gray-400 text-sm">{card.description}</p>
                {card.comingSoon && (
                  <Badge className="mt-2" variant="outline">Coming Soon</Badge>
                )}
                {card.premium && !isPremium && (
                  <Badge className="mt-2" variant="outline">Pro</Badge>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Bottom Sections */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Gallery */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <CardTitle className="text-white">Recent Gallery</CardTitle>
              <CardDescription className="text-gray-400">
                Your latest uploads
              </CardDescription>
            </CardHeader>
            <CardContent>
              {activityLoading ? (
                <div className="grid grid-cols-4 gap-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="aspect-square bg-gray-700 rounded-lg animate-pulse" />
                  ))}
                </div>
              ) : showGalleryEmptyState ? (
                <div className="text-center py-8 text-gray-400">
                  <ImageIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No recent media</p>
                  <p className="text-sm">Upload some content to see it here</p>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2">
                  {galleryItems.map((item) => (
                    <div
                      key={item.id}
                      className="aspect-square bg-gray-700 rounded-lg overflow-hidden"
                    >
                      <img
                        src={item.url}
                        alt={item.alt}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ))}
                </div>
              )}
              <Button 
                className="w-full mt-4 bg-purple-600 hover:bg-purple-700"
                onClick={() => setLocation('/gallery')}
              >
                View All
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>

          {/* Scheduled Posts */}
          <Card className="bg-gray-800 border-gray-700">
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-white">Scheduled Posts</CardTitle>
                <Badge className="bg-orange-500 text-white">2 PENDING</Badge>
              </div>
              <CardDescription className="text-gray-400">
                Upcoming content
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-purple-400" />
                    <div>
                      <p className="text-white text-sm font-medium">Morning Selfie</p>
                      <p className="text-gray-400 text-xs">r/SelfieWorld • In 2 hours</p>
                    </div>
                  </div>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-700 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Clock className="h-5 w-5 text-purple-400" />
                    <div>
                      <p className="text-white text-sm font-medium">Sunset Vibes</p>
                      <p className="text-gray-400 text-xs">r/FreeKarma4U • In 6 hours</p>
                    </div>
                  </div>
                </div>
              </div>
              <Button 
                className="w-full mt-4 bg-purple-600 hover:bg-purple-700"
                onClick={() => {
                  toast({
                    title: "Scheduler",
                    description: "Post scheduler coming soon!",
                  });
                }}
              >
                Manage Schedule
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}