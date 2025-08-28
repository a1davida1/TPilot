import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { 
  Sparkles, 
  Shield, 
  Brain, 
  Zap, 
  Users, 
  TrendingUp, 
  CheckCircle,
  ArrowRight,
  Star,
  Calendar,
  Image as ImageIcon,
  Target,
  Clock,
  Globe,
  BarChart3
} from "lucide-react";
import { ThemeToggle } from "@/components/theme-toggle";

export function LandingPage() {
  const [scrollY, setScrollY] = useState(0);
  
  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 overflow-hidden">
      {/* Fixed Header */}
      <header className="fixed top-0 w-full bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-700/50 z-50">
        <nav className="max-w-7xl mx-auto flex justify-between items-center px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
              <img 
                src="/logo.png" 
                alt="ThottoPilot" 
                className="w-8 h-8 rounded-lg"
              />
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-pink-500 to-pink-600 dark:from-pink-400 dark:to-pink-500 bg-clip-text text-transparent">
              ThottoPilot
            </span>
          </div>
          <div className="flex items-center gap-3">
            <ThemeToggle />
            <Link to="/login">
              <Button variant="ghost" className="font-semibold text-indigo-600 hover:text-indigo-700">
                Sign In
              </Button>
            </Link>
            <Link to="/demo">
              <Button className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-semibold shadow-lg">
                Get Started
              </Button>
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero Section */}
      <section className="relative bg-gradient-to-br from-indigo-600 via-purple-600 to-indigo-800 text-white pt-24 pb-16 px-6 overflow-hidden">
        {/* Animated Background */}
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-white/5 via-transparent to-white/5 opacity-50"></div>
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 bg-white/10 rounded-full animate-pulse"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                animationDelay: `${Math.random() * 3}s`,
              }}
            />
          ))}
        </div>

        <div className="relative max-w-4xl mx-auto text-center z-10">
          <h1 className="text-6xl md:text-7xl font-black mb-6 leading-tight tracking-tight">
            Turn Content Into 
            <span className="block bg-gradient-to-r from-yellow-300 to-pink-300 bg-clip-text text-transparent">
              Cash in Seconds
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl font-medium mb-6 opacity-95 max-w-3xl mx-auto leading-relaxed">
            Create, Protect, and Promote - All in One
          </p>
          
          <p className="text-lg mb-12 opacity-90 max-w-2xl mx-auto">
            Smart captions, automated scheduling, and bulletproof image protection. 
            Transform your content creation workflow with AI-powered optimization.
          </p>

          {/* Social Proof */}
          <div className="flex justify-center gap-8 mb-12 text-sm opacity-90 flex-wrap">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span>10K+ Creators</span>
            </div>
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              <span>5M+ Posts Generated</span>
            </div>
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4" />
              <span>100% Safe & Secure</span>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="flex gap-6 justify-center mb-16 flex-wrap">
            <Link to="/demo">
              <Button 
                size="lg" 
                className="bg-white text-indigo-600 hover:bg-gray-50 font-bold px-8 py-4 text-lg shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105"
              >
                <Zap className="mr-2 h-5 w-5" />
                Try Demo - Free
              </Button>
            </Link>
            <Link to="/login">
              <Button 
                size="lg" 
                variant="outline" 
                className="border-2 border-white/30 text-white hover:bg-white/10 font-bold px-8 py-4 text-lg backdrop-blur-sm transition-all duration-300"
              >
                <ArrowRight className="mr-2 h-5 w-5" />
                Sign In
              </Button>
            </Link>
          </div>

          <div className="text-center">
            <p className="text-white/80 mb-2">
              <Link to="/demo" className="underline underline-offset-4 hover:text-white transition-colors">
                Continue as Guest - Try Demo
              </Link>
            </p>
          </div>

          {/* Demo Flow */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto bg-white/10 backdrop-blur-xl rounded-3xl p-8 border border-white/20">
            <div className="text-center">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                1
              </div>
              <h3 className="text-lg font-bold mb-2">Upload Photo</h3>
              <p className="text-sm opacity-90">Drop your image and let AI do the magic</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                2
              </div>
              <h3 className="text-lg font-bold mb-2">AI Creates Caption</h3>
              <p className="text-sm opacity-90">Smart captions with trending hashtags</p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 text-2xl font-bold">
                3
              </div>
              <h3 className="text-lg font-bold mb-2">Schedule & Post</h3>
              <p className="text-sm opacity-90">Automated posting at optimal times</p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-6 bg-gray-50 dark:bg-gray-800">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-black text-gray-900 dark:text-white mb-6">
              Everything You Need to Scale
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300 max-w-3xl mx-auto">
              Powerful tools designed specifically for content creators who want to automate their workflow and maximize engagement
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: <Brain className="w-8 h-8" />,
                title: "AI Caption Generator",
                description: "Generate engaging captions with trending hashtags that boost your reach and engagement rates",
                highlight: "5x Faster Creation"
              },
              {
                icon: <Shield className="w-8 h-8" />,
                title: "ImageShield Protection", 
                description: "Military-grade image protection that prevents reverse searches and unauthorized use of your content",
                highlight: "100% Privacy"
              },
              {
                icon: <Clock className="w-8 h-8" />,
                title: "Smart Scheduling",
                description: "AI-powered optimal timing that analyzes your audience to schedule posts when engagement is highest",
                highlight: "3x More Engagement"
              },
              {
                icon: <Target className="w-8 h-8" />,
                title: "Platform Optimization",
                description: "Automatically adapt content for each platform's requirements and best practices for maximum visibility",
                highlight: "Cross-Platform Ready"
              },
              {
                icon: <BarChart3 className="w-8 h-8" />,
                title: "Analytics Dashboard",
                description: "Track performance across all platforms with detailed insights and growth recommendations",
                highlight: "Data-Driven Growth"
              },
              {
                icon: <Globe className="w-8 h-8" />,
                title: "Multi-Platform Support",
                description: "Seamlessly post to Reddit, X (Twitter), OnlyFans, Fansly and more from a single dashboard",
                highlight: "All-in-One Solution"
              }
            ].map((feature, index) => (
              <Card 
                key={index} 
                className="bg-white dark:bg-gray-900 p-8 text-center border-0 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 group"
              >
                <div className="w-20 h-20 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-6 text-white shadow-lg group-hover:scale-110 transition-transform duration-300">
                  {feature.icon}
                </div>
                <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-300 mb-4 leading-relaxed">
                  {feature.description}
                </p>
                <Badge className="bg-gradient-to-r from-indigo-500 to-purple-600 text-white border-0 font-semibold">
                  {feature.highlight}
                </Badge>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-20 px-6 bg-white dark:bg-gray-900">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-black text-gray-900 dark:text-white mb-6">
              Choose Your Plan
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-300">
              Start free, upgrade when you're ready to scale
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            {/* Free Plan */}
            <Card className="border-2 border-gray-200 dark:border-gray-700 p-8 text-center relative">
              <CardHeader className="pb-6">
                <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Free</CardTitle>
                <div className="text-4xl font-black text-indigo-600 mb-2">$0</div>
                <p className="text-gray-600 dark:text-gray-300">Perfect for trying out</p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 mb-8 text-left">
                  <li className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-gray-700 dark:text-gray-300">5 AI captions per month</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-gray-700 dark:text-gray-300">Basic image protection</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-gray-700 dark:text-gray-300">1 platform connection</span>
                  </li>
                </ul>
                <Link to="/demo">
                  <Button className="w-full font-semibold">
                    Get Started Free
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Pro Plan */}
            <Card className="border-2 border-indigo-500 p-8 text-center relative transform scale-105 bg-gradient-to-b from-indigo-50 to-purple-50 dark:from-indigo-950/20 dark:to-purple-950/20 shadow-xl">
              <Badge className="absolute -top-3 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white px-6 py-1 font-bold">
                Most Popular
              </Badge>
              <CardHeader className="pb-6">
                <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Pro</CardTitle>
                <div className="text-4xl font-black text-indigo-600 mb-2">$29</div>
                <p className="text-gray-600 dark:text-gray-300">per month</p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 mb-8 text-left">
                  <li className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-gray-700 dark:text-gray-300">Unlimited AI captions</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-gray-700 dark:text-gray-300">Advanced ImageShield</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-gray-700 dark:text-gray-300">All platform connections</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-gray-700 dark:text-gray-300">Smart scheduling</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-gray-700 dark:text-gray-300">Analytics dashboard</span>
                  </li>
                </ul>
                <Link to="/login">
                  <Button className="w-full bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 font-semibold">
                    Start Pro Trial
                  </Button>
                </Link>
              </CardContent>
            </Card>

            {/* Enterprise Plan */}
            <Card className="border-2 border-gray-200 dark:border-gray-700 p-8 text-center relative">
              <CardHeader className="pb-6">
                <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Enterprise</CardTitle>
                <div className="text-4xl font-black text-indigo-600 mb-2">$99</div>
                <p className="text-gray-600 dark:text-gray-300">per month</p>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 mb-8 text-left">
                  <li className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-gray-700 dark:text-gray-300">Everything in Pro</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-gray-700 dark:text-gray-300">Team collaboration</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-gray-700 dark:text-gray-300">Priority support</span>
                  </li>
                  <li className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                    <span className="text-gray-700 dark:text-gray-300">Custom integrations</span>
                  </li>
                </ul>
                <Link to="/login">
                  <Button variant="outline" className="w-full font-semibold">
                    Contact Sales
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6 bg-gradient-to-br from-gray-900 to-indigo-900 text-white">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-5xl font-black mb-6">
            Ready to Transform Your Content Game?
          </h2>
          <p className="text-xl opacity-90 mb-12 max-w-2xl mx-auto leading-relaxed">
            Join thousands of creators who've already automated their workflow and 3x'd their engagement with ThottoPilot
          </p>
          <div className="flex gap-6 justify-center flex-wrap">
            <Link to="/demo">
              <Button 
                size="lg" 
                className="bg-white text-indigo-600 hover:bg-gray-50 font-bold px-8 py-4 text-lg shadow-xl hover:shadow-2xl transition-all duration-300 hover:scale-105"
              >
                <Star className="mr-2 h-5 w-5" />
                Start Free Trial
              </Button>
            </Link>
            <Link to="/login">
              <Button 
                size="lg" 
                variant="outline" 
                className="border-2 border-white/30 text-white hover:bg-white/10 font-bold px-8 py-4 text-lg backdrop-blur-sm"
              >
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex justify-center items-center gap-3 mb-6">
            <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center">
              <img 
                src="/logo.png" 
                alt="ThottoPilot" 
                className="w-8 h-8 rounded-lg"
              />
            </div>
            <span className="text-3xl font-black bg-gradient-to-r from-pink-400 to-pink-500 bg-clip-text text-transparent">
              ThottoPilot
            </span>
          </div>
          <p className="text-gray-400 mb-8 text-lg">
            Create, Protect, and Promote - All in One
          </p>
          <div className="flex justify-center space-x-8 text-gray-400 text-sm">
            <a href="#" className="hover:text-white transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-white transition-colors">Contact</a>
          </div>
        </div>
      </footer>

    </div>
  );
}