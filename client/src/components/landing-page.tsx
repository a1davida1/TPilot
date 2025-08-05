import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  Star
} from "lucide-react";

export function LandingPage() {
  const [isHovered, setIsHovered] = useState<string | null>(null);

  const features = [
    {
      icon: <Brain className="h-6 w-6" />,
      title: "AI-Powered Content Generation",
      description: "Create engaging Reddit posts with personalized titles, content, and photo instructions tailored to your brand",
      benefit: "Save 10+ hours per week"
    },
    {
      icon: <Shield className="h-6 w-6" />,
      title: "Advanced Image Protection",
      description: "Protect your photos from reverse image searches while maintaining visual quality",
      benefit: "100% privacy protection"
    },
    {
      icon: <Zap className="h-6 w-6" />,
      title: "Smart Subreddit Optimization",
      description: "Automatically adapts content based on subreddit promotion rules and audience preferences",
      benefit: "3x engagement rates"
    },
    {
      icon: <TrendingUp className="h-6 w-6" />,
      title: "Performance Analytics",
      description: "Track your content performance and optimize your strategy with detailed insights",
      benefit: "Data-driven growth"
    }
  ];

  const testimonials = [
    {
      name: "Sarah M.",
      role: "Content Creator",
      content: "ThottoPilot transformed my Reddit strategy. I went from spending hours crafting posts to generating perfect content in minutes.",
      rating: 5
    },
    {
      name: "Alex K.",
      role: "Social Media Manager",
      content: "The image protection feature is a game-changer. Finally, I can share content without worrying about privacy.",
      rating: 5
    },
    {
      name: "Jordan L.",
      role: "Digital Creator",
      content: "The AI understands my brand voice perfectly. It's like having a personal content writer who never sleeps.",
      rating: 5
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-pink-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-2xl font-bold text-primary flex items-center">
                <Sparkles className="mr-2 h-6 w-6" />
                ThottoPilot
              </h1>
            </div>
            <nav className="flex items-center space-x-4">
              <Link href="/dashboard?guest=true">
                <Button variant="outline" className="flex items-center">
                  Try Free Demo
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/login">
                <Button className="bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-700 hover:to-pink-700">
                  Get Started
                </Button>
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-20 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <Badge className="mb-4 bg-gradient-to-r from-indigo-100 to-pink-100 text-indigo-800 border-indigo-200">
              🚀 AI-Powered Content Creation Platform
            </Badge>
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
              Create Viral Content
              <br />
              <span className="bg-gradient-to-r from-indigo-600 to-pink-600 bg-clip-text text-transparent">
                in Minutes, Not Hours
              </span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              ThottoPilot empowers content creators with AI-driven tools to generate engaging Reddit posts, 
              protect images from reverse searches, and optimize content strategy for maximum engagement.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/dashboard?guest=true">
                <Button 
                  size="lg" 
                  className="bg-gradient-to-r from-indigo-600 to-pink-600 hover:from-indigo-700 hover:to-pink-700 text-white px-8 py-4 text-lg"
                >
                  Start Free Trial
                  <Sparkles className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Button 
                variant="outline" 
                size="lg" 
                className="px-8 py-4 text-lg border-gray-300 hover:border-indigo-300"
              >
                Watch Demo
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Everything You Need to Succeed
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Comprehensive tools designed specifically for content creators who want to scale their presence.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <Card 
                key={index}
                className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 bg-white/80 backdrop-blur-sm"
                onMouseEnter={() => setIsHovered(feature.title)}
                onMouseLeave={() => setIsHovered(null)}
              >
                <CardHeader>
                  <div className={`w-12 h-12 rounded-lg bg-gradient-to-r from-indigo-100 to-pink-100 flex items-center justify-center mb-4 transition-transform duration-300 ${
                    isHovered === feature.title ? 'scale-110' : ''
                  }`}>
                    <div className="text-indigo-600">
                      {feature.icon}
                    </div>
                  </div>
                  <CardTitle className="text-lg">{feature.title}</CardTitle>
                  <CardDescription>{feature.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Badge variant="secondary" className="bg-green-100 text-green-800">
                    {feature.benefit}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Loved by Content Creators
            </h2>
            <p className="text-xl text-gray-600">
              Join thousands of creators who've transformed their content strategy
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            {testimonials.map((testimonial, index) => (
              <Card key={index} className="border-0 shadow-lg bg-white/80 backdrop-blur-sm">
                <CardHeader>
                  <div className="flex items-center space-x-1 mb-4">
                    {[...Array(testimonial.rating)].map((_, i) => (
                      <Star key={i} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                    ))}
                  </div>
                  <CardDescription className="text-base italic">
                    "{testimonial.content}"
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div>
                    <p className="font-medium text-gray-900">{testimonial.name}</p>
                    <p className="text-sm text-gray-600">{testimonial.role}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-indigo-600 to-pink-600">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-6">
            Ready to Transform Your Content Strategy?
          </h2>
          <p className="text-xl text-indigo-100 mb-8">
            Join thousands of creators who are already using ThottoPilot to scale their presence and engagement.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="/dashboard?guest=true">
              <Button 
                size="lg" 
                className="bg-white text-indigo-600 hover:bg-gray-50 px-8 py-4 text-lg font-medium"
              >
                Start Free Trial
                <CheckCircle className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/login">
              <Button 
                variant="outline" 
                size="lg" 
                className="border-white text-white hover:bg-white/10 px-8 py-4 text-lg"
              >
                Sign Up Now
                <Users className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-lg font-bold mb-4 flex items-center">
                <Sparkles className="mr-2 h-5 w-5" />
                ThottoPilot
              </h3>
              <p className="text-gray-400">
                AI-powered content creation platform for the modern creator.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-4">Features</h4>
              <ul className="space-y-2 text-gray-400">
                <li>AI Content Generation</li>
                <li>Image Protection</li>
                <li>Subreddit Optimization</li>
                <li>Performance Analytics</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-4">Support</h4>
              <ul className="space-y-2 text-gray-400">
                <li>Documentation</li>
                <li>Community</li>
                <li>Contact Support</li>
                <li>Feature Requests</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-4">Legal</h4>
              <ul className="space-y-2 text-gray-400">
                <li>Privacy Policy</li>
                <li>Terms of Service</li>
                <li>Cookie Policy</li>
                <li>GDPR Compliance</li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2025 ThottoPilot. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}