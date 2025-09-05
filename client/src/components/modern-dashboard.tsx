import React, { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
// import { motion, AnimatePresence } from "framer-motion";
import { RedditQuickPost } from "./reddit-quick-post";
import { useAuth } from "@/hooks/useAuth";
import { 
  Home,
  Sparkles, 
  Brain, 
  Shield, 
  ImageIcon,
  TrendingUp,
  Zap,
  Star,
  ArrowRight,
  Menu,
  X,
  Camera,
  Hash,
  Gift,
  Users,
  Plus,
  Upload,
  Wand2,
  Copy,
  Download,
  RefreshCw,
  Eye,
  CheckCircle,
  BarChart3,
  History,
  Settings,
  Bell,
  Crown,
  ChevronUp,
  Clock,
  Activity,
  Target,
  DollarSign,
  FileText,
  ChevronDown,
  Calculator
} from "lucide-react";
import { FaReddit } from "react-icons/fa";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface StatCard {
  title: string;
  value: string;
  change: string;
  changeType: 'positive' | 'negative';
  icon: React.ReactNode;
  color: string;
}

interface ActivityItem {
  id: string;
  type: 'posted' | 'generated' | 'scheduled' | 'protected';
  title: string;
  subtitle: string;
  time: string;
  icon: React.ReactNode;
}

interface ModernDashboardProps {
  isRedditConnected?: boolean;
  user?: any;
  userTier?: 'guest' | 'free' | 'basic' | 'starter' | 'pro' | 'premium' | 'admin';
  isAdmin?: boolean;
}

export function ModernDashboard({ isRedditConnected = false, user, userTier = 'free', isAdmin = false }: ModernDashboardProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeSection, setActiveSection] = useState("dashboard");
  const [isMobile, setIsMobile] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [, setLocation] = useLocation();
  const { user: authUser } = useAuth();
  
  // Extract token from session for API requests
  const getAuthToken = () => {
    try {
      const session = localStorage.getItem('session');
      if (session) {
        const parsed = JSON.parse(session);
        return parsed.token;
      }
    } catch (error) {
      console.error('Error extracting auth token:', error);
    }
    return null;
  };
  
  // Determine premium status
  const isPremium = isAdmin || userTier === 'premium' || userTier === 'pro' || userTier === 'admin';
  
  // User data logged for debugging - sensitive fields redacted in production
  if (import.meta.env.DEV) {
    console.log('Dashboard props:', { 
      userTier, 
      isAdmin, 
      isPremium,
      userId: user?.id,
      hasEmail: !!user?.email 
    });
  }

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
    { id: "dashboard", label: "Dashboard", icon: <Home className="h-5 w-5" />, section: "main" },
    { id: "reddit", label: "Reddit Hub", icon: <FaReddit className="h-5 w-5" />, badge: "NEW", section: "create" },
    { id: "generate", label: "Content Creator", icon: <Brain className="h-5 w-5" />, badge: "AI", section: "create" },
    { id: "protect", label: "ImageShield", icon: <Shield className="h-5 w-5" />, badge: "NEW", section: "create" },
    { id: "gallery", label: "Media Gallery", icon: <ImageIcon className="h-5 w-5" />, section: "create" },
    { id: "scheduler", label: "Post Scheduler", icon: <Clock className="h-5 w-5" />, badge: "PRO", section: "manage" },
    { id: "analytics", label: "Analytics", icon: <BarChart3 className="h-5 w-5" />, section: "manage" },
    { id: "communities", label: "Communities", icon: <Users className="h-5 w-5" />, badge: "50+", section: "manage" },
    { id: "tax-tracker", label: "Tax Tracker", icon: <Calculator className="h-5 w-5" />, badge: "NEW", section: "manage" },
    { id: "trending", label: "Trending Tags", icon: <Hash className="h-5 w-5" />, section: "insights" },
    { id: "audience", label: "Audience Insights", icon: <Target className="h-5 w-5" />, badge: "PRO", section: "insights" },
    { id: "history", label: "History", icon: <History className="h-5 w-5" />, section: "account" },
    { id: "settings", label: "Settings", icon: <Settings className="h-5 w-5" />, section: "account" }
  ];

  const stats: StatCard[] = [
    {
      title: "Total Posts",
      value: "2,847",
      change: "+12.5%",
      changeType: "positive",
      icon: <FileText className="h-6 w-6" />,
      color: "#6366f1"
    },
    {
      title: "This Month",
      value: "184",
      change: "+8.2%",
      changeType: "positive", 
      icon: <TrendingUp className="h-6 w-6" />,
      color: "#10b981"
    },
    {
      title: "Engagement Rate",
      value: "94.2%",
      change: "+2.1%",
      changeType: "positive",
      icon: <Activity className="h-6 w-6" />,
      color: "#f59e0b"
    },
    {
      title: "Revenue",
      value: "$12,847",
      change: "+15.3%",
      changeType: "positive",
      icon: <DollarSign className="h-6 w-6" />,
      color: "#ef4444"
    }
  ];

  const recentActivity: ActivityItem[] = [
    {
      id: "1",
      type: "posted",
      title: "Posted to r/SelfieWorld",
      subtitle: "Sunset vibes caption with 3 trending hashtags",
      time: "2 minutes ago",
      icon: <CheckCircle className="h-5 w-5" />
    },
    {
      id: "2", 
      type: "generated",
      title: "Generated 5 new captions",
      subtitle: "Instagram style • Playful tone • Summer theme",
      time: "1 hour ago",
      icon: <Brain className="h-5 w-5" />
    },
    {
      id: "3",
      type: "protected",
      title: "Applied ImageShield protection",
      subtitle: "3 photos processed • Advanced protection level",
      time: "3 hours ago", 
      icon: <Shield className="h-5 w-5" />
    },
    {
      id: "4",
      type: "scheduled",
      title: "Scheduled 8 posts",
      subtitle: "Optimal timing for maximum engagement",
      time: "Yesterday",
      icon: <Clock className="h-5 w-5" />
    }
  ];

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    
    if (!file) {
      return;
    }
    
    // File validation logging (safe data only)
    if (import.meta.env.DEV) {
      console.log('File upload:', { 
        size: file.size, 
        type: file.type,
        hasFile: true 
      });
    }
    
    // Check file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select an image under 10MB",
        variant: "destructive",
      });
      return;
    }
    
    // Show upload progress
    toast({
      title: "Uploading...",
      description: "Processing your image",
    });
    
    try {
      // Create FormData for upload
      const formData = new FormData();
      formData.append('file', file);
      
      // Get auth token
      const token = getAuthToken();
      
      // Upload to /api/media/upload endpoint
      const response = await fetch('/api/media/upload', {
        method: 'POST',
        body: formData,
        headers: {
          ...(token && { 'Authorization': `Bearer ${token}` })
        }
      });
      
      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }
      
      const result = await response.json();
      
      // Show success message
      toast({
        title: "Upload successful! 🎉",
        description: `${file.name} uploaded successfully. Switching to Content Creator...`,
      });
      
      // Store the uploaded file info for the content creator to use
      (window as any).selectedImageFile = file;
      (window as any).selectedImagePreview = URL.createObjectURL(file);
      (window as any).uploadedImageUrl = result.url;
      
      // Switch to the content generator section
      setTimeout(() => {
        setActiveSection('generate');
      }, 500);
      
    } catch (error) {
      console.error('Upload error:', error);
      toast({
        title: "Upload failed",
        description: "There was an error uploading your image. Please try again.",
        variant: "destructive",
      });
    }
    
    // Reset the input so the same file can be selected again
    event.target.value = '';
  };

  // const sidebarVariants = {
  //   open: { x: 0 },
  //   closed: { x: isMobile ? -280 : -240 }
  // };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Mobile Overlay */}
      {isMobile && sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 h-full w-[280px] md:w-[240px] bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 z-50 overflow-y-auto transition-transform duration-300",
          sidebarOpen ? "translate-x-0" : (isMobile ? "-translate-x-[280px]" : "-translate-x-[240px]")
        )}
      >
        <div className="p-6">
          {/* Logo */}
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl flex items-center justify-center shadow-lg">
              <img 
                src="/logo.png" 
                alt="ThottoPilot" 
                className="w-8 h-8 rounded-lg"
              />
            </div>
            <span className="text-xl font-bold bg-gradient-to-r from-pink-500 to-pink-600 bg-clip-text text-transparent">
              ThottoPilot
            </span>
            {isMobile && (
              <Button
                variant="ghost"
                size="sm"
                className="ml-auto"
                onClick={() => setSidebarOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Navigation */}
          <nav className="space-y-1">
            {["main", "create", "manage", "insights", "account"].map((section) => (
              <div key={section}>
                {section !== "main" && (
                  <div className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider mt-6">
                    {section}
                  </div>
                )}
                {navigationItems
                  .filter(item => item.section === section)
                  .map((item) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        // Navigate to appropriate page based on item
                        switch(item.id) {
                          case 'reddit':
                            setLocation('/reddit');
                            break;
                          case 'generate':
                            setLocation('/caption-generator');
                            break;
                          case 'protect':
                            setLocation('/imageshield');
                            break;
                          case 'history':
                            setLocation('/history');
                            break;
                          case 'settings':
                            setLocation('/settings');
                            break;
                          case 'gallery':
                            setLocation('/gallery');
                            break;
                          case 'dashboard':
                            setLocation('/dashboard');
                            break;
                          case 'communities':
                            setLocation('/communities');
                            break;
                          case 'tax-tracker':
                            setLocation('/tax-tracker');
                            break;
                          default:
                            // For unimplemented pages, just update active section
                            setActiveSection(item.id);
                            toast({
                              title: "Coming Soon",
                              description: `${item.label} feature is being developed.`,
                            });
                        }
                      }}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 text-sm font-medium rounded-lg transition-all",
                        activeSection === item.id
                          ? "bg-pink-50 dark:bg-pink-950/20 text-pink-600 dark:text-pink-400 shadow-sm"
                          : "text-foreground hover:bg-gray-100 dark:hover:bg-gray-800"
                      )}
                    >
                      {item.icon}
                      <span className="flex-1 text-left">{item.label}</span>
                      {item.badge && (
                        <Badge variant="secondary" className="text-xs px-1.5 py-0.5">
                          {item.badge}
                        </Badge>
                      )}
                    </button>
                  ))}
              </div>
            ))}
          </nav>

          {/* Upgrade Card - Only show for free/guest users */}
          {!isPremium && (
            <Card className="mt-8 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-white border-0">
              <CardContent className="p-4 text-center">
                <Crown className="h-8 w-8 mx-auto mb-2 text-yellow-300" />
                <h3 className="font-semibold text-sm mb-1">Upgrade to Pro</h3>
                <p className="text-xs opacity-90 mb-3">Unlock unlimited AI generations</p>
                <Button 
                  size="sm" 
                  className="bg-white text-indigo-600 hover:bg-gray-100 w-full text-xs font-medium"
                  onClick={() => window.location.href = '/checkout'}
                >
                  Upgrade Now
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className={cn(
        "transition-all duration-300",
        sidebarOpen && !isMobile ? "ml-[240px]" : "ml-0"
      )}>
        {/* Header */}
        <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(!sidebarOpen)}
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
                <p className="text-sm text-muted-foreground">Welcome back! Here's your content overview</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm">
                <Bell className="h-4 w-4 mr-2" />
                Notifications
              </Button>
              {/* Reddit Connection Indicator */}
              {isRedditConnected ? (
                <Badge className="bg-orange-100 text-orange-700 border-orange-200">
                  <FaReddit className="h-3 w-3 mr-1" />
                  Reddit Connected
                </Badge>
              ) : (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={async () => {
                    try {
                      const token = localStorage.getItem('auth_token');
                      const headers: any = {
                        'Content-Type': 'application/json'
                      };
                      
                      // Only add auth header if we have a valid token
                      if (token && token !== 'undefined' && token !== 'null') {
                        headers['Authorization'] = `Bearer ${token}`;
                      }
                      
                      const response = await fetch('/api/reddit/connect', {
                        method: 'GET',
                        headers,
                        credentials: 'include' // Include cookies for session auth
                      });
                      
                      if (response.ok) {
                        const data = await response.json();
                        if (data.authUrl) {
                          window.location.href = data.authUrl;
                        } else if (data.error) {
                          // Reddit connection failed - error handled via toast
                          toast({
                            title: "Connection Failed",
                            description: data.error || "Unable to connect to Reddit",
                            variant: "destructive"
                          });
                        }
                      } else {
                        // Reddit request failed - error handled via toast
                        toast({
                          title: "Connection Failed", 
                          description: "Please try again later",
                          variant: "destructive"
                        });
                      }
                    } catch (error) {
                      // Reddit connection error - handled via toast
                      toast({
                        title: "Connection Error",
                        description: "Unable to connect to Reddit. Please try again.",
                        variant: "destructive"
                      });
                    }
                  }}
                  className="border-orange-200 text-orange-600 hover:bg-orange-50"
                >
                  <FaReddit className="h-4 w-4 mr-2" />
                  Connect Reddit
                </Button>
              )}
              <Button 
                className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700"
                onClick={() => setLocation('/caption-generator')}
              >
                <Plus className="h-4 w-4 mr-2" />
                Create Content
              </Button>
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-500 to-blue-500 rounded-full flex items-center justify-center text-white font-semibold cursor-pointer">
                JD
              </div>
            </div>
          </div>
        </header>

        {/* Dashboard Content */}
        <main className="p-6">
          {/* Stats Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {stats.map((stat, index) => (
              <Card key={index} className="relative overflow-hidden">
                <div 
                  className="absolute top-0 left-0 right-0 h-1"
                  style={{ backgroundColor: stat.color }}
                />
                <CardContent className="p-6">
                  <div className="flex items-center justify-between mb-2">
                    <div style={{ color: stat.color }}>
                      {stat.icon}
                    </div>
                    <span className={cn(
                      "text-sm font-semibold flex items-center gap-1",
                      stat.changeType === "positive" ? "text-green-600" : "text-red-600"
                    )}>
                      {stat.changeType === "positive" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                      {stat.change}
                    </span>
                  </div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white mb-1">
                    {stat.value}
                  </div>
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Main Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
            {/* Quick Upload */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  Quick Upload & Generate
                </CardTitle>
                <CardDescription>Upload an image and let AI create engaging content</CardDescription>
              </CardHeader>
              <CardContent>
                <div 
                  className={cn(
                    "border-2 border-dashed rounded-xl p-8 text-center transition-all cursor-pointer group",
                    isDragging 
                      ? "border-pink-500 bg-pink-50 dark:bg-pink-950/20" 
                      : "border-gray-300 dark:border-gray-600 hover:border-pink-400 dark:hover:border-pink-500"
                  )}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDragging(true);
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDragging(false);
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setIsDragging(false);
                    
                    const files = e.dataTransfer.files;
                    if (files && files[0]) {
                      // Create a synthetic event for the handleFileUpload function
                      if (fileInputRef.current) {
                        const dataTransfer = new DataTransfer();
                        dataTransfer.items.add(files[0]);
                        fileInputRef.current.files = dataTransfer.files;
                        
                        const event = new Event('change', { bubbles: true });
                        fileInputRef.current.dispatchEvent(event);
                      }
                    }
                  }}
                >
                  <div className="w-16 h-16 bg-pink-50 dark:bg-pink-950/20 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:bg-pink-100 dark:group-hover:bg-pink-950/40 transition-colors">
                    <Camera className="h-8 w-8 text-pink-500" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {isDragging ? "Drop your photo now!" : "Drop your photo here"}
                  </h3>
                  <p className="text-muted-foreground mb-6">
                    {isDragging ? "Release to upload" : "or click to browse your files"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Supports: JPEG, PNG, WebP, GIF (Max 10MB)
                  </p>
                  <input
                    ref={fileInputRef}
                    id="file-upload"
                    type="file"
                    accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                    className="hidden"
                    onChange={handleFileUpload}
                    onClick={(e) => {
                      // Reset the input value to allow re-selecting the same file
                      (e.target as HTMLInputElement).value = '';
                      console.log('File input clicked, value reset');
                    }}
                  />
                </div>

                <div className="grid grid-cols-3 gap-3 mt-6">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="flex flex-col gap-1 h-auto py-3"
                    onClick={(e) => {
                      e.preventDefault();
                      console.log('Direct upload button clicked');
                      fileInputRef.current?.click();
                    }}
                  >
                    <Upload className="h-5 w-5 text-pink-500" />
                    <span className="text-xs">Select File</span>
                  </Button>
                  <Button variant="outline" size="sm" className="flex flex-col gap-1 h-auto py-3">
                    <Shield className="h-5 w-5 text-blue-500" />
                    <span className="text-xs">Protect</span>
                  </Button>
                  <Button variant="outline" size="sm" className="flex flex-col gap-1 h-auto py-3">
                    <Clock className="h-5 w-5 text-green-500" />
                    <span className="text-xs">Schedule</span>
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Reddit Quick Post */}
            <RedditQuickPost />

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Recent Activity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {recentActivity.map((activity) => (
                    <div key={activity.id} className="flex items-start gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0",
                        activity.type === "posted" && "bg-green-100 dark:bg-green-950/20 text-green-600",
                        activity.type === "generated" && "bg-blue-100 dark:bg-blue-950/20 text-blue-600", 
                        activity.type === "protected" && "bg-purple-100 dark:bg-purple-950/20 text-purple-600",
                        activity.type === "scheduled" && "bg-orange-100 dark:bg-orange-950/20 text-orange-600"
                      )}>
                        {activity.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {activity.title}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {activity.subtitle}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {activity.time}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Bottom Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Gallery Preview */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <ImageIcon className="h-5 w-5" />
                    Recent Uploads
                  </CardTitle>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setLocation('/gallery');
                    }}
                  >
                    View All
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-3">
                  {[1, 2, 3, 4, 5, 6].map((i) => (
                    <div key={i} className="aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg relative overflow-hidden group cursor-pointer hover:opacity-80 transition-opacity">
                      <div className="absolute inset-0 bg-gradient-to-br from-pink-400/20 to-purple-600/20" />
                      <div className="absolute top-2 right-2 bg-black/80 text-white text-xs px-1.5 py-0.5 rounded">
                        {i === 1 ? 'NEW' : i === 2 ? 'PRO' : ''}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Performance Metrics */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Platform Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {[
                    { platform: "Reddit", posts: 142, engagement: "96.2%", color: "bg-orange-500" },
                    { platform: "Instagram", posts: 89, engagement: "94.1%", color: "bg-pink-500" },
                    { platform: "Twitter", posts: 67, engagement: "89.7%", color: "bg-blue-500" },
                    { platform: "OnlyFans", posts: 34, engagement: "98.5%", color: "bg-purple-500" }
                  ].map((item, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={cn("w-3 h-3 rounded-full", item.color)} />
                        <span className="font-medium text-gray-900 dark:text-white">{item.platform}</span>
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-muted-foreground">{item.posts} posts</span>
                        <span className="font-semibold text-green-600">{item.engagement}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}