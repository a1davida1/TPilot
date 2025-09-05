import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SocialAuth } from "@/components/social-auth";
import { 
  Sparkles, 
  Brain, 
  Shield, 
  TrendingUp, 
  Users, 
  Star,
  Check,
  ArrowRight,
  Zap,
  Target,
  Heart,
  Eye,
  DollarSign,
  Clock
} from "lucide-react";

export function PremiumLanding() {
  const [isVisible, setIsVisible] = useState(false);
  const [currentTestimonial, setCurrentTestimonial] = useState(0);
  const [metrics, setMetrics] = useState<{ creators: number; posts: number; engagement: number } | null>(null);

  useEffect(() => {
    setIsVisible(true);
    fetch('/api/metrics')
      .then(res => (res.ok ? res.json() : null))
      .then(setMetrics)
      .catch(() => {});
    
    // Rotate testimonials
    const interval = setInterval(() => {
      setCurrentTestimonial((prev) => (prev + 1) % testimonials.length);
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const features = [
    {
      icon: <Brain className="h-6 w-6" />,
      title: "AI Content Generation",
      description: "Create viral Reddit posts with advanced AI that understands your audience",
      highlight: "98% cost savings"
    },
    {
      icon: <Shield className="h-6 w-6" />,
      title: "Image Protection",
      description: "Protect your photos from reverse searches while maintaining quality",
      highlight: "Military-grade"
    },
    {
      icon: <TrendingUp className="h-6 w-6" />,
      title: "Analytics Dashboard",
      description: "Track performance and optimize your content strategy",
      highlight: "Real-time insights"
    },
    {
      icon: <Target className="h-6 w-6" />,
      title: "Platform Optimization",
      description: "Content tailored for each platform's algorithms and rules",
      highlight: "Multi-platform"
    }
  ];

  const testimonials = [
    {
      name: "Sarah M.",
      role: "Content Creator",
      content: "ThottoPilot increased my engagement by 340% in just 2 weeks. The AI understands exactly what my audience wants!",
      rating: 5,
      verified: true
    },
    {
      name: "Alex K.",
      role: "Digital Creator",
      content: "The image protection feature is incredible. My content stays unique while I build my brand confidently.",
      rating: 5,
      verified: true
    },
    {
      name: "Jamie L.",
      role: "Social Media Manager",
      content: "From 50 to 10K followers in 3 months. The analytics help me understand what works and what doesn't.",
      rating: 5,
      verified: true
    }
  ];

  const stats = metrics
    ? [
        { number: metrics.creators.toLocaleString(), label: "Active Creators", icon: <Users className="h-5 w-5" /> },
        { number: metrics.posts.toLocaleString(), label: "Posts Generated", icon: <Sparkles className="h-5 w-5" /> },
        { number: `${metrics.engagement}%`, label: "Avg. Engagement Boost", icon: <TrendingUp className="h-5 w-5" /> },
        { number: "98%", label: "Cost Reduction vs Competitors", icon: <DollarSign className="h-5 w-5" /> }
      ]
    : [];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-pink-500/10 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }} />
        <div className="absolute top-1/2 left-1/2 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '2s' }} />
      </div>

      <div className="relative z-10">
        {/* Hero Section */}
        <section className="pt-20 pb-16 px-4">
          <div className="max-w-7xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* Left Column - Hero Content */}
              <div className={`space-y-8 transition-all duration-1000 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
                <div className="space-y-4">
                  <Badge className="bg-purple-100 text-purple-800 border-purple-200 px-4 py-2">
                    <Sparkles className="mr-2 h-4 w-4" />
                    #1 Creator Platform
                  </Badge>
                  
                  <h1 className="text-5xl lg:text-7xl font-bold text-white leading-tight">
                    Create
                    <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent animate-gradient">
                      {" "}Viral{" "}
                    </span>
                    Content
                  </h1>
                  
                  <p className="text-xl text-gray-300 leading-relaxed max-w-xl">
                    Generate engaging Reddit posts with AI, protect your images from reverse searches, 
                    and grow your audience 10x faster than competitors.
                  </p>
                </div>

                {/* Key Benefits */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2 text-green-400">
                    <Check className="h-5 w-5" />
                    <span>98% Cost Savings</span>
                  </div>
                  <div className="flex items-center space-x-2 text-green-400">
                    <Check className="h-5 w-5" />
                    <span>No Email Required</span>
                  </div>
                  <div className="flex items-center space-x-2 text-green-400">
                    <Check className="h-5 w-5" />
                    <span>Instant Setup</span>
                  </div>
                  <div className="flex items-center space-x-2 text-green-400">
                    <Check className="h-5 w-5" />
                    <span>Military-Grade Security</span>
                  </div>
                </div>

                {/* CTA Buttons */}
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button 
                    size="lg"
                    className="btn-premium text-lg px-8 py-4 h-auto shadow-glow"
                    onClick={() => document.getElementById('signup-section')?.scrollIntoView({ behavior: 'smooth' })}
                  >
                    <Zap className="mr-2 h-5 w-5" />
                    Start Creating Free
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    size="lg"
                    className="border-2 border-white/20 text-white hover:bg-white/10 text-lg px-8 py-4 h-auto"
                    onClick={() => window.location.href = '/dashboard?guest=true'}
                  >
                    <Eye className="mr-2 h-5 w-5" />
                    Try Demo
                  </Button>
                </div>

                {/* Trust Indicators */}
                <div className="flex items-center space-x-6 text-sm text-gray-400">
                  <div className="flex items-center space-x-2">
                    <div className="flex -space-x-1">
                      {[1,2,3,4].map((i) => (
                        <div key={i} className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-400 to-pink-400 border-2 border-white/20" />
                      ))}
                    </div>
                    <span>10,000+ creators</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    {[1,2,3,4,5].map((i) => (
                      <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    ))}
                    <span className="ml-1">4.9/5 rating</span>
                  </div>
                </div>
              </div>

              {/* Right Column - Signup Form */}
              <div className={`transition-all duration-1000 delay-300 ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'}`}>
                <div id="signup-section">
                  <SocialAuth />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-16 border-y border-white/10">
          <div className="max-w-7xl mx-auto px-4">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
              {stats.map((stat, index) => (
                <div key={index} className="text-center">
                  <div className="flex justify-center mb-2 text-purple-400">
                    {stat.icon}
                  </div>
                  <div className="text-3xl font-bold text-white mb-1">{stat.number}</div>
                  <div className="text-gray-400 text-sm">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20">
          <div className="max-w-7xl mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold text-white mb-4">
                Everything You Need to 
                <span className="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent"> Dominate</span>
              </h2>
              <p className="text-xl text-gray-300 max-w-2xl mx-auto">
                Professional-grade tools that give you an unfair advantage over competitors
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8">
              {features.map((feature, index) => (
                <Card key={index} className="glass border-white/20 hover-lift transition-all-smooth group">
                  <CardHeader>
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-purple-400 group-hover:text-pink-400 transition-colors">
                        {feature.icon}
                      </div>
                      <Badge className="bg-purple-100 text-purple-800">
                        {feature.highlight}
                      </Badge>
                    </div>
                    <CardTitle className="text-white text-xl">{feature.title}</CardTitle>
                    <CardDescription className="text-gray-300 text-base">
                      {feature.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section className="py-20 bg-black/20">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <h2 className="text-3xl font-bold text-white mb-12">
              Loved by <span className="text-purple-400">10,000+</span> Creators
            </h2>
            
            <div className="relative">
              <Card className="glass border-white/20 p-8">
                <CardContent className="space-y-6">
                  <div className="flex justify-center">
                    {[1,2,3,4,5].map((i) => (
                      <Star key={i} className="h-6 w-6 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  
                  <blockquote className="text-xl text-white leading-relaxed">
                    "{testimonials[currentTestimonial].content}"
                  </blockquote>
                  
                  <div className="flex items-center justify-center space-x-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-r from-purple-400 to-pink-400" />
                    <div className="text-left">
                      <div className="font-semibold text-white flex items-center">
                        {testimonials[currentTestimonial].name}
                        {testimonials[currentTestimonial].verified && (
                          <Check className="ml-2 h-4 w-4 text-green-400" />
                        )}
                      </div>
                      <div className="text-gray-400 text-sm">
                        {testimonials[currentTestimonial].role}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Final CTA Section */}
        <section className="py-20">
          <div className="max-w-4xl mx-auto px-4 text-center">
            <Card className="glass border-white/20 p-12 hover-glow">
              <div className="space-y-6">
                <h2 className="text-4xl font-bold text-white">
                  Ready to 10x Your Content Game?
                </h2>
                <p className="text-xl text-gray-300">
                  Join thousands of successful creators. Setup takes less than 30 seconds.
                </p>
                
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <Button 
                    size="lg"
                    className="btn-premium text-lg px-12 py-4 h-auto shadow-glow-pink"
                    onClick={() => document.getElementById('signup-section')?.scrollIntoView({ behavior: 'smooth' })}
                  >
                    <Sparkles className="mr-2 h-5 w-5" />
                    Get Started Free
                  </Button>
                  
                  <div className="flex items-center justify-center space-x-2 text-green-400">
                    <Check className="h-5 w-5" />
                    <span>No credit card required</span>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </section>
      </div>
    </div>
  );
}