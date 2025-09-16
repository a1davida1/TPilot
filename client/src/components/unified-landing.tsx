import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { 
  Sparkles, 
  Shield,
  Brain,
  TrendingUp,
  Zap,
  Users,
  CheckCircle,
  ArrowRight,
  Star,
  Calendar,
  Image as _ImageIcon,
  Target,
  Clock,
  Globe,
  BarChart3,
  DollarSign,
  Crown,
  Play
} from "lucide-react";

export function UnifiedLanding() {
  const [scrollY, setScrollY] = useState(0);
  const [metrics, setMetrics] = useState<{ creators: number; posts: number; engagement: number } | null>(null);
  const { toast } = useToast();
  
  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    
    fetch('/api/metrics')
      .then(res => (res.ok ? res.json() : null))
      .then(setMetrics)
      .catch(() => {});
      
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleTryFeatures = () => {
    toast({
      description: "Try our features without signing up!",
    });
  };

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        {/* Background Elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div 
            className="absolute -top-40 -right-32 w-80 h-80 rounded-full bg-gradient-to-br from-purple-400/20 to-pink-400/20 blur-3xl"
            style={{ transform: `translate(${scrollY * 0.3}px, ${scrollY * 0.1}px)` }}
          />
          <div 
            className="absolute -bottom-40 -left-32 w-80 h-80 rounded-full bg-gradient-to-br from-blue-400/20 to-cyan-400/20 blur-3xl"
            style={{ transform: `translate(${-scrollY * 0.2}px, ${-scrollY * 0.1}px)` }}
          />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 py-20">
          {/* Hero Content */}
          <div className="text-center max-w-4xl mx-auto">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 dark:bg-purple-900/30 rounded-full text-purple-700 dark:text-purple-300 text-sm font-semibold mb-8">
              <Crown className="h-4 w-4" />
              {metrics ? `Trusted by ${metrics.creators.toLocaleString()} Content Creators` : 'Trusted by creators'}
            </div>
            
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 dark:text-white mb-8 leading-tight">
              Create, Protect,{' '}
              <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                and Promote
              </span>
              {' '}All in One
            </h1>
            
            <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-12 leading-relaxed max-w-3xl mx-auto">
              Smart captions, automated scheduling, and bulletproof image protection. 
              Transform your content creation workflow with our advanced platform.
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Link to="/login">
                <Button size="lg" className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-black font-semibold text-lg px-8 py-4">
                  <Sparkles className="h-5 w-5 mr-2" />
                  Start Creating Free
                </Button>
              </Link>
              <Button 
                size="lg" 
                variant="outline" 
                className="font-semibold text-lg px-8 py-4 border-2"
              >
                <Play className="h-5 w-5 mr-2" />
              </Button>
            </div>

            {/* Social Proof */}
            <div className="flex justify-center items-center gap-8 text-sm text-gray-500 dark:text-gray-400 mb-16">
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {[1,2,3,4].map((i) => (
                    <div key={i} className="w-8 h-8 bg-gradient-to-br from-purple-400 to-pink-400 rounded-full border-2 border-white" />
                  ))}
                </div>
                <span className="font-semibold">{metrics ? `${metrics.creators.toLocaleString()} creators` : '—'}</span>
              </div>
              <div className="flex items-center gap-1">
                <TrendingUp className="h-4 w-4 text-green-400" />
                <span className="font-semibold">
                  {metrics ? `${metrics.engagement}% avg engagement` : 'Engagement data'}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <BarChart3 className="h-4 w-4" />
                <span className="font-semibold">{metrics ? `${metrics.posts.toLocaleString()} posts created` : '—'}</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-gray-50 dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-6">
              Everything you need to{' '}
              <span className="bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
                succeed
              </span>
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
              Powerful tools designed specifically for content creators who want to maximize their impact and earnings.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: <Brain className="h-8 w-8" />,
                title: "AI Content Generation",
                description: "Generate viral captions and posts with advanced machine learning that understands your audience.",
                gradient: "from-purple-500 to-pink-500",
                badge: "MOST POPULAR"
              },
              {
                icon: <Shield className="h-8 w-8" />,
                title: "ImageShield Protection",
                description: "Protect your photos from reverse searches and unauthorized use with military-grade security.",
                gradient: "from-blue-500 to-cyan-500",
                badge: "ENTERPRISE"
              },
              {
                icon: <Target className="h-8 w-8" />,
                title: "Platform Optimization",
                description: "Content automatically tailored for each platform's algorithm and audience preferences.",
                gradient: "from-green-500 to-emerald-500",
                badge: "SMART"
              },
              {
                icon: <Calendar className="h-8 w-8" />,
                title: "Smart Scheduling",
                description: "Post at optimal times across all platforms with intelligent queue management.",
                gradient: "from-orange-500 to-red-500",
                badge: "AUTOMATED"
              },
              {
                icon: <BarChart3 className="h-8 w-8" />,
                title: "Advanced Analytics",
                description: "Track performance, engagement, and earnings with detailed insights and recommendations.",
                gradient: "from-indigo-500 to-purple-500",
                badge: "PRO"
              },
              {
                icon: <DollarSign className="h-8 w-8" />,
                title: "Tax & Finance Tools",
                description: "Apple-level expense tracking with automatic receipt management and tax optimization.",
                gradient: "from-yellow-500 to-orange-500",
                badge: "BUSINESS"
              }
            ].map((feature, index) => (
              <Card key={index} className="relative overflow-hidden hover:shadow-xl transition-all duration-300 group">
                {feature.badge && (
                  <Badge className={`absolute top-4 right-4 bg-gradient-to-r ${feature.gradient} text-white border-none text-xs`}>
                    {feature.badge}
                  </Badge>
                )}
                <CardHeader>
                  <div className={`w-16 h-16 bg-gradient-to-br ${feature.gradient} rounded-2xl flex items-center justify-center text-white mb-4 group-hover:scale-110 transition-transform`}>
                    {feature.icon}
                  </div>
                  <CardTitle className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                    {feature.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-gray-600 dark:text-gray-300 leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-orange-200 via-orange-300 to-orange-400">
        <div className="max-w-4xl mx-auto text-center px-6">
          <h2 className="text-4xl md:text-5xl font-bold text-gray-800 mb-6">
            Ready to transform your content?
          </h2>
          <p className="text-xl text-gray-700 mb-8">
            Join thousands of creators who've already upgraded their workflow
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/login">
              <Button size="lg" className="bg-white text-black hover:bg-gray-100 font-semibold text-lg px-8 py-4">
                <Sparkles className="h-5 w-5 mr-2" />
                Get Started Free
              </Button>
            </Link>
            <Button 
              size="lg" 
              variant="outline" 
              className="border-white text-white hover:bg-white/10 font-semibold text-lg px-8 py-4"
            >
              <ArrowRight className="h-5 w-5 ml-2" />
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center gap-3 mb-4 md:mb-0">
              <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold">
                ✨
              </div>
              <span className="text-xl font-bold">ThottoPilot</span>
            </div>
            
            <div className="flex items-center gap-6 text-sm text-gray-400">
              <span>© 2025 ThottoPilot. All rights reserved.</span>
              <Link to="/privacy" className="hover:text-white transition-colors">
                Privacy Policy
              </Link>
              <Link to="/terms" className="hover:text-white transition-colors">
                Terms of Service
              </Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default UnifiedLanding;