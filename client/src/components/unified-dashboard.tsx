import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Home,
  Plus,
  ImageIcon,
  BarChart3,
  Zap,
  Shield,
  Calendar,
  DollarSign,
  Gift,
  Users,
  Settings,
  HelpCircle,
  Menu,
  X,
  Upload,
  Crown,
  TrendingUp,
  ArrowUpRight,
  Clock,
  CheckCircle,
  Eye,
  Heart,
  MessageCircle,
  ChevronUp
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Link, useLocation } from "wouter";

interface StatCard {
  title: string;
  value: string;
  change: string;
  changeType: 'positive' | 'negative';
  accentColor: string;
}

interface ActivityItem {
  id: string;
  type: 'posted' | 'generated' | 'scheduled' | 'protected';
  title: string;
  subtitle: string;
  time: string;
  icon: React.ReactNode;
  iconBg: string;
}

export function UnifiedDashboard() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth < 768) {
        setSidebarOpen(false);
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const navigationItems = [
    { id: "dashboard", label: "Dashboard", icon: <Home className="h-5 w-5" />, active: true },
    { id: "create", label: "Create Post", icon: <Plus className="h-5 w-5" />, href: "/caption-generator" },
    { id: "gallery", label: "Gallery", icon: <ImageIcon className="h-5 w-5" /> },
    { id: "analytics", label: "Analytics", icon: <BarChart3 className="h-5 w-5" /> },
  ];

  const toolsItems = [
    { id: "quick-repost", label: "Quick Repost", icon: <Zap className="h-5 w-5" />, href: "/reddit" },
    { id: "imageshield", label: "ImageShield", icon: <Shield className="h-5 w-5" /> },
    { id: "scheduler", label: "Scheduler", icon: <Calendar className="h-5 w-5" /> },
  ];

  const businessItems = [
    { id: "tax-tracker", label: "Tax Tracker", icon: <DollarSign className="h-5 w-5" />, href: "/enterprise" },
    { id: "pro-perks", label: "Pro Perks", icon: <Gift className="h-5 w-5" /> },
    { id: "referrals", label: "Referrals", icon: <Users className="h-5 w-5" /> },
  ];

  const accountItems = [
    { id: "settings", label: "Settings", icon: <Settings className="h-5 w-5" />, href: "/settings" },
    { id: "help", label: "Help", icon: <HelpCircle className="h-5 w-5" /> },
  ];

  const stats: StatCard[] = [
    {
      title: "Total Posts",
      value: "847",
      change: "+12% this week",
      changeType: "positive",
      accentColor: "bg-indigo-500"
    },
    {
      title: "Average Comments",
      value: "47",
      change: "+23% this month",
      changeType: "positive",
      accentColor: "bg-emerald-500"
    },
    {
      title: "Total Views",
      value: "12.4K",
      change: "+8% this week",
      changeType: "positive",
      accentColor: "bg-rose-500"
    },
    {
      title: "Average Upvotes",
      value: "187",
      change: "+12% this month",
      changeType: "positive",
      accentColor: "bg-purple-500"
    }
  ];

  const activities: ActivityItem[] = [
    {
      id: "1",
      type: "posted",
      title: "Posted to r/selfie",
      subtitle: "Getting great engagement!",
      time: "2 hours ago",
      icon: <CheckCircle className="h-4 w-4" />,
      iconBg: "bg-green-100 text-green-600"
    },
    {
      id: "2",
      type: "generated",
      title: "Generated 3 new captions",
      subtitle: "For tomorrow's posts",
      time: "4 hours ago",
      icon: <Zap className="h-4 w-4" />,
      iconBg: "bg-blue-100 text-blue-600"
    },
    {
      id: "3",
      type: "scheduled",
      title: "Scheduled post for 8 PM",
      subtitle: "Reddit & Instagram",
      time: "1 day ago",
      icon: <Clock className="h-4 w-4" />,
      iconBg: "bg-amber-100 text-amber-600"
    }
  ];

  const handleNavigation = (href?: string) => {
    if (href) {
      setLocation(href);
    }
  };

  const handleUpgrade = () => {
    toast({
      title: "Upgrade Available!",
      description: "Remove watermarks and unlock premium features.",
    });
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Mobile Menu Button */}
      {isMobile && (
        <Button
          variant="ghost"
          className="fixed top-4 left-4 z-50 md:hidden"
          onClick={() => setSidebarOpen(!sidebarOpen)}
        >
          {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </Button>
      )}

      {/* Sidebar */}
      <AnimatePresence>
        {(sidebarOpen || !isMobile) && (
          <motion.aside
            initial={isMobile ? { x: -240 } : false}
            animate={{ x: 0 }}
            exit={{ x: -240 }}
            transition={{ duration: 0.3 }}
            className={cn(
              "fixed left-0 top-0 w-60 h-screen bg-white border-r border-slate-200 z-40",
              "flex flex-col"
            )}
          >
            {/* Logo */}
            <div className="flex items-center gap-3 p-5 border-b border-slate-100">
              <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center text-white text-lg font-bold">
                ✨
              </div>
              <span className="text-xl font-bold text-slate-800">ThottoPilot</span>
            </div>

            {/* Navigation */}
            <nav className="flex-1 p-3 space-y-1">
              {/* Main Navigation */}
              {navigationItems.map((item) => (
                <button
                  key={item.id}
                  onClick={() => handleNavigation(item.href)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium transition-all",
                    item.active 
                      ? "bg-slate-100 text-indigo-600" 
                      : "text-slate-600 hover:bg-slate-50 hover:text-indigo-600"
                  )}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}

              {/* Tools Section */}
              <div className="pt-6">
                <h3 className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                  Tools
                </h3>
                {toolsItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleNavigation(item.href)}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-all"
                  >
                    {item.icon}
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Business Section */}
              <div className="pt-6">
                <h3 className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                  Business
                </h3>
                {businessItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleNavigation(item.href)}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-all"
                  >
                    {item.icon}
                    {item.label}
                  </button>
                ))}
              </div>

              {/* Account Section */}
              <div className="pt-6">
                <h3 className="px-3 text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">
                  Account
                </h3>
                {accountItems.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleNavigation(item.href)}
                    className="w-full flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-indigo-600 transition-all"
                  >
                    {item.icon}
                    {item.label}
                  </button>
                ))}
              </div>
            </nav>

            {/* Upgrade Card */}
            <div className="p-3 mt-auto">
              <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-4 text-white text-center">
                <div className="text-sm font-semibold mb-2">Remove Watermark</div>
                <div className="text-xs opacity-90 mb-3">Upgrade to Starter for clean posts</div>
                <Button 
                  onClick={handleUpgrade}
                  className="w-full bg-white text-indigo-600 hover:bg-slate-50 text-sm font-semibold"
                >
                  Upgrade Now
                </Button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className={cn(
        "min-h-screen transition-all duration-300",
        sidebarOpen && !isMobile ? "ml-60" : "ml-0"
      )}>
        {/* Header */}
        <header className="bg-white border-b border-slate-200 px-6 py-5">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-slate-800 mb-1">
                Welcome back, {user?.username || 'Creator'}! 👋
              </h1>
              <p className="text-slate-600 text-sm">Here's what's happening with your content today</p>
            </div>
            
            <div className="flex items-center gap-3">
              <Button variant="outline" className="hidden sm:flex">
                <BarChart3 className="h-4 w-4 mr-2" />
                View Report
              </Button>
              <Button onClick={() => handleNavigation('/caption-generator')}>
                <Upload className="h-4 w-4 mr-2" />
                Create Post
              </Button>
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-full flex items-center justify-center text-white font-semibold cursor-pointer">
                {(user?.username?.[0] || 'U').toUpperCase()}
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="p-6">
          {/* Stats Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
            {stats.map((stat, index) => (
              <Card key={index} className="relative overflow-hidden">
                <div className={cn("absolute top-0 left-0 right-0 h-1", stat.accentColor)} />
                <CardContent className="p-6">
                  <div className="text-3xl font-bold text-slate-800 mb-1">{stat.value}</div>
                  <div className="text-sm text-slate-600 mb-2">{stat.title}</div>
                  <div className="flex items-center text-xs font-semibold text-emerald-600">
                    <ArrowUpRight className="h-3 w-3 mr-1" />
                    {stat.change}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Achievement Badges */}
          <div className="flex gap-3 mb-8 flex-wrap">
            <Badge className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-4 py-2 text-sm">
              🔥 7 Day Streak
            </Badge>
            <Badge className="bg-gradient-to-r from-emerald-500 to-green-600 text-white px-4 py-2 text-sm">
              💰 $340 Referral Earnings
            </Badge>
            <Badge className="bg-gradient-to-r from-purple-500 to-indigo-600 text-white px-4 py-2 text-sm">
              ⭐ Top Creator This Week
            </Badge>
          </div>

          {/* Main Grid */}
          <div className="grid lg:grid-cols-3 gap-6 mb-8">
            {/* Quick Upload - Takes 2 columns */}
            <div className="lg:col-span-2">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Quick Upload</CardTitle>
                  <Button variant="outline" size="sm">View All</Button>
                </CardHeader>
                <CardContent>
                  <div className="border-2 border-dashed border-slate-300 rounded-xl p-12 text-center hover:border-indigo-400 hover:bg-indigo-50/30 transition-colors cursor-pointer mb-6">
                    <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-indigo-500">
                      <Upload className="h-6 w-6" />
                    </div>
                    <div className="text-lg font-semibold text-slate-800 mb-2">Drop your images here</div>
                    <div className="text-slate-600">or click to browse files</div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-3">
                    <button className="p-3 border border-slate-200 rounded-lg text-center hover:border-indigo-400 hover:bg-indigo-50/30 transition-colors">
                      <div className="text-lg mb-1">🧠</div>
                      <div className="text-xs font-semibold text-slate-600">Smart Caption</div>
                    </button>
                    <button className="p-3 border border-slate-200 rounded-lg text-center hover:border-indigo-400 hover:bg-indigo-50/30 transition-colors">
                      <div className="text-lg mb-1">🛡️</div>
                      <div className="text-xs font-semibold text-slate-600">Add Protection</div>
                    </button>
                    <button className="p-3 border border-slate-200 rounded-lg text-center hover:border-indigo-400 hover:bg-indigo-50/30 transition-colors">
                      <div className="text-lg mb-1">⚡</div>
                      <div className="text-xs font-semibold text-slate-600">Quick Post</div>
                    </button>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {activities.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3">
                      <div className={cn("w-10 h-10 rounded-lg flex items-center justify-center", activity.iconBg)}>
                        {activity.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-slate-800">{activity.title}</div>
                        <div className="text-xs text-slate-600">{activity.subtitle}</div>
                      </div>
                      <div className="text-xs text-slate-400">{activity.time}</div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Bottom Grid */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Gallery Preview */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Gallery Preview</CardTitle>
                <Button variant="outline" size="sm">View All</Button>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  {[1, 2, 3, 4, 5, 6].map((item) => (
                    <div key={item} className="aspect-square bg-slate-100 rounded-lg relative overflow-hidden hover:scale-105 transition-transform cursor-pointer">
                      <div className="absolute top-2 right-2 bg-black/80 text-white px-2 py-1 rounded text-xs font-semibold">
                        1.2K ↗
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Performance Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>Platform Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between py-4 border-b border-slate-100 last:border-b-0">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-orange-500 rounded-md flex items-center justify-center text-white text-sm font-bold">
                        R
                      </div>
                      <span className="font-medium text-slate-700">Reddit</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-slate-800">847</div>
                      <div className="text-xs text-slate-600">Posts</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-4 border-b border-slate-100 last:border-b-0">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-500 rounded-md flex items-center justify-center text-white text-sm font-bold">
                        T
                      </div>
                      <span className="font-medium text-slate-700">Twitter</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-slate-800">234</div>
                      <div className="text-xs text-slate-600">Posts</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-between py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-cyan-500 rounded-md flex items-center justify-center text-white text-sm font-bold">
                        O
                      </div>
                      <span className="font-medium text-slate-700">OnlyFans</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-slate-800">89</div>
                      <div className="text-xs text-slate-600">Posts</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}