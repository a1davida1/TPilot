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
  Crown
} from "lucide-react";
import { EnhancedAIGenerator } from "@/components/enhanced-ai-generator";
import { SocialAuth } from "@/components/social-auth";
// import { motion } from "framer-motion";

export function AestheticLanding() {
  const [activeTab, setActiveTab] = useState("generate");
  const [isVisible, setIsVisible] = useState(false);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [metrics, setMetrics] = useState<any>(null);

  useEffect(() => {
    setIsVisible(true);
    fetch('/api/metrics')
      .then(res => (res.ok ? res.json() : null))
      .then(setMetrics)
      .catch(() => {});
    
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  const stats = metrics
    ? [
        { icon: <Users className="h-5 w-5" />, value: "Beta", label: "Early Access" },
        { icon: <Sparkles className="h-5 w-5" />, value: `${metrics.templates}+`, label: "Templates" },
        { icon: <TrendingUp className="h-5 w-5" />, value: metrics.support || "24/7", label: "Support" },
        { icon: <Star className="h-5 w-5" />, value: "New", label: "Platform" }
      ]
    : [];

  const features = [
    {
      icon: <Brain />,
      title: "AI-Powered Content",
      description: "Generate viral posts with advanced AI",
      gradient: "from-purple-500 to-pink-500"
    },
    {
      icon: <Shield />,
      title: "Image Protection",
      description: "Secure your photos from reverse searches",
      gradient: "from-blue-500 to-cyan-500"
    },
    {
      icon: <Target />,
      title: "Platform Optimization",
      description: "Content tailored for each platform",
      gradient: "from-green-500 to-emerald-500"
    },
    {
      icon: <DollarSign />,
      title: "98% Cost Savings",
      description: "Premium features at a fraction of the cost",
      gradient: "from-yellow-500 to-orange-500"
    }
  ];

  return (
    <div className="min-h-screen bg-black text-white overflow-hidden">
      {/* Dynamic gradient background that follows mouse */}
      <div 
        className="fixed inset-0 opacity-30"
        style={{
          background: `radial-gradient(circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(147, 51, 234, 0.3), transparent 50%)`
        }}
      />
      
      {/* Animated gradient orbs */}
      <div className="fixed inset-0">
        <div className="absolute top-20 left-20 w-96 h-96 bg-purple-600/20 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-20 right-20 w-96 h-96 bg-pink-600/20 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '2s' }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '4s' }} />
      </div>

      {/* Main content */}
      <div className="relative z-10">
        {/* Header */}
        <header className="fixed top-0 w-full bg-black/50 backdrop-blur-xl border-b border-white/10 z-50">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-pink-600 rounded-xl flex items-center justify-center neon-purple">
                <Sparkles className="h-6 w-6 text-white" />
              </div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                ThottoPilot
              </h1>
              <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/50">
                BETA
              </Badge>
            </div>
            
            <div className="flex items-center space-x-4">
              <Button 
                variant="ghost" 
                className="text-gray-300 hover:text-white"
                onClick={() => window.location.href = '/login'}
              >
                Sign In
              </Button>
              <Button className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 neon-purple">
                Get Started Free
              </Button>
            </div>
          </div>
        </header>

        <section className="pt-32 pb-20 px-4">
          <div className="max-w-7xl mx-auto">
            <div className={`text-center mb-12 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
              <Badge className="mb-4 bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-300 border-purple-500/50 animate-pulse">
                <Sparkles className="mr-2 h-4 w-4" />
                10,000+ Creators Already Using ThottoPilot
              </Badge>
              
              <h1 className="text-5xl md:text-7xl font-bold mb-6">
                <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-purple-400 bg-clip-text text-transparent animate-gradient">
                  Create Viral Content
                </span>
                <br />
                <span className="text-gray-300">in Seconds</span>
              </h1>
              
              <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-8">
                AI-powered content generation, image protection, and analytics. 
                Everything you need to dominate social media.
              </p>

              {/* Quick stats */}
              <div className="flex justify-center gap-8 mb-12">
                {stats.map((stat, index) => (
                  <div key={index} className="text-center">
                    <div className="flex items-center justify-center text-purple-400 mb-2">
                      {stat.icon}
                    </div>
                    <div className="text-2xl font-bold text-white">{stat.value}</div>
                    <div className="text-sm text-gray-500">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            <Card className="max-w-6xl mx-auto bg-gray-900/50 backdrop-blur-xl border-white/10 shadow-2xl">
              <CardHeader className="border-b border-white/10">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl text-white">Try It Live - No Sign Up Required</CardTitle>
                    <CardDescription className="text-gray-400">
                      Experience the power of ThottoPilot instantly
                    </CardDescription>
                  </div>
                  <Badge className="bg-green-500/20 text-green-300 border-green-500/50">
                    <div className="w-2 h-2 bg-green-400 rounded-full mr-2 animate-pulse" />
                  </Badge>
                </div>
              </CardHeader>
              
              <CardContent className="p-0">
                <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                  <TabsList className="w-full bg-gray-900/50 border-b border-white/10 rounded-none">
                    <TabsTrigger 
                      value="generate" 
                      className="flex-1 data-[state=active]:bg-purple-600/20 data-[state=active]:text-purple-300"
                    >
                      <Brain className="mr-2 h-4 w-4" />
                      AI Generator
                    </TabsTrigger>
                    <TabsTrigger 
                      value="protect" 
                      className="flex-1 data-[state=active]:bg-purple-600/20 data-[state=active]:text-purple-300"
                    >
                      <Shield className="mr-2 h-4 w-4" />
                      Image Protection
                    </TabsTrigger>
                    <TabsTrigger 
                      value="analytics" 
                      className="flex-1 data-[state=active]:bg-purple-600/20 data-[state=active]:text-purple-300"
                    >
                      <TrendingUp className="mr-2 h-4 w-4" />
                      Analytics
                    </TabsTrigger>
                  </TabsList>

                  <div className="p-6">
                    <TabsContent value="generate" className="mt-0">
                      <div className="grid lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2">
                          <EnhancedAIGenerator 
                            isGuestMode={true}
                            onContentGenerated={() => {}}
                          />
                        </div>
                        <div className="space-y-4">
                          <Card className="bg-purple-600/10 border-purple-500/50">
                            <CardHeader>
                            </CardHeader>
                            <CardContent className="space-y-3">
                              <div className="flex items-center text-green-400">
                                <Check className="mr-2 h-4 w-4" />
                                <span className="text-sm">Live AI generation preview</span>
                              </div>
                              <div className="flex items-center text-green-400">
                                <Check className="mr-2 h-4 w-4" />
                                <span className="text-sm">Multiple content styles</span>
                              </div>
                              <div className="flex items-center text-green-400">
                                <Check className="mr-2 h-4 w-4" />
                                <span className="text-sm">Platform optimization</span>
                              </div>
                            </CardContent>
                          </Card>
                          
                          <Button 
                            className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
                            onClick={() => window.location.href = '/login'}
                          >
                            <Crown className="mr-2 h-4 w-4" />
                            Unlock Full Access
                          </Button>
                        </div>
                      </div>
                    </TabsContent>

                    <TabsContent value="protect">
                      <div className="text-center py-12">
                        <Shield className="h-16 w-16 mx-auto text-purple-400 mb-4" />
                        <h3 className="text-xl font-semibold mb-2">Military-Grade Image Protection</h3>
                        <p className="text-gray-400 mb-6">
                          Protect your photos from reverse searches while maintaining quality
                        </p>
                        <Button className="bg-gradient-to-r from-purple-600 to-pink-600">
                          <Lock className="mr-2 h-4 w-4" />
                          Sign Up to Access
                        </Button>
                      </div>
                    </TabsContent>

                    <TabsContent value="analytics">
                      <div className="text-center py-12">
                        <TrendingUp className="h-16 w-16 mx-auto text-purple-400 mb-4" />
                        <h3 className="text-xl font-semibold mb-2">Real-Time Performance Analytics</h3>
                        <p className="text-gray-400 mb-6">
                          Track engagement, optimize posting times, and grow faster
                        </p>
                        <Button className="bg-gradient-to-r from-purple-600 to-pink-600">
                          <Eye className="mr-2 h-4 w-4" />
                          View Full Dashboard
                        </Button>
                      </div>
                    </TabsContent>
                  </div>
                </Tabs>
              </CardContent>
            </Card>

            {/* Sign Up Section */}
            <div className="mt-16 max-w-md mx-auto">
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold mb-4">Ready to Start Creating?</h2>
                <p className="text-gray-400">Join 10,000+ creators who are already growing faster</p>
              </div>
              <SocialAuth />
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="py-20 border-t border-white/10">
          <div className="max-w-7xl mx-auto px-4">
            <h2 className="text-3xl font-bold text-center mb-12">
              Everything You Need to
              <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent"> Succeed</span>
            </h2>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              {features.map((feature, index) => (
                <Card 
                  key={index} 
                  className="bg-gray-900/50 border-white/10 hover:border-purple-500/50 transition-all hover:-translate-y-1 card-hover-glow"
                >
                  <CardHeader>
                    <div className={`w-12 h-12 bg-gradient-to-r ${feature.gradient} rounded-lg flex items-center justify-center mb-4`}>
                      {feature.icon}
                    </div>
                    <CardTitle className="text-white">{feature.title}</CardTitle>
                    <CardDescription className="text-gray-400">
                      {feature.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}