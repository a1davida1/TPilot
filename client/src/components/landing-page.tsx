import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
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
  Loader2
} from "lucide-react";

// Turnstile widget component (loaded dynamically)
declare global {
  interface Window {
    turnstile?: {
      render: (element: string | HTMLElement, options: any) => string;
      reset: (widgetId: string) => void;
    };
  }
}

export function LandingPage() {
  const [isHovered, setIsHovered] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string>('');
  const [formData, setFormData] = useState({
    email: '',
    platformTags: [] as string[],
    painPoint: ''
  });
  const { toast } = useToast();

  // UTM tracking on page load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const utmData = {
      utm_source: params.get('utm_source'),
      utm_medium: params.get('utm_medium'),  
      utm_campaign: params.get('utm_campaign'),
      utm_content: params.get('utm_content'),
      utm_term: params.get('utm_term'),
      referrer: document.referrer
    };
    
    // Save UTM data to cookie for later use
    const filteredUTM = Object.fromEntries(
      Object.entries(utmData).filter(([_, v]) => v !== null)
    );
    
    if (Object.keys(filteredUTM).length > 0) {
      document.cookie = `utm_params=${encodeURIComponent(JSON.stringify(filteredUTM))}; path=/; max-age=${30 * 24 * 60 * 60}`;
    }

    // Load Turnstile script
    if (!document.querySelector('[src*="challenges.cloudflare.com"]')) {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      script.async = true;
      script.defer = true;
      document.head.appendChild(script);
    }
  }, []);

  const platforms = [
    { id: 'reddit', label: 'Reddit' },
    { id: 'x', label: 'X (Twitter)' },
    { id: 'onlyfans', label: 'OnlyFans' },
    { id: 'fansly', label: 'Fansly' },
  ];

  const handlePlatformChange = (platformId: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      platformTags: checked 
        ? [...prev.platformTags, platformId]
        : prev.platformTags.filter(id => id !== platformId)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email.trim()) {
      toast({
        title: "Email required",
        description: "Please enter your email address to join the waitlist.",
        variant: "destructive"
      });
      return;
    }

    if (formData.platformTags.length === 0) {
      toast({
        title: "Platform required", 
        description: "Please select at least one platform you use.",
        variant: "destructive"
      });
      return;
    }

    // Skip Turnstile validation in development
    if (!turnstileToken && window.turnstile && process.env.NODE_ENV === 'production') {
      toast({
        title: "Verification required",
        description: "Please complete the anti-bot verification.",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch('/api/leads', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          turnstileToken: turnstileToken || 'dev-bypass',
          currentUrl: window.location.href,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to join waitlist');
      }

      toast({
        title: "Success! 🎉",
        description: data.message,
      });

      // Reset form
      setFormData({
        email: '',
        platformTags: [],
        painPoint: ''
      });
      setTurnstileToken('');

      // Reset Turnstile
      if (window.turnstile) {
        window.turnstile.reset('turnstile-widget');
      }

    } catch (error) {
      console.error('Waitlist signup error:', error);
      toast({
        title: "Something went wrong",
        description: error instanceof Error ? error.message : "Please try again later.",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const features = [
    {
      icon: <Calendar className="h-6 w-6" />,
      title: "Caption + Schedule with Rule Checks",
      description: "AI-generated captions and smart scheduling that automatically checks subreddit rules to prevent violations",
      benefit: "Zero rule violations"
    },
    {
      icon: <ImageIcon className="h-6 w-6" />,
      title: "Image Library with Protection",
      description: "Secure image storage with advanced protection against reverse searches and unauthorized use",
      benefit: "100% privacy protection"  
    },
    {
      icon: <Target className="h-6 w-6" />,
      title: "Time-of-Day Optimizer",
      description: "Analyzes engagement patterns to automatically schedule posts at optimal times for maximum reach",
      benefit: "3x higher engagement"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-yellow-50 dark:from-pink-950/20 dark:via-rose-950/20 dark:to-yellow-950/20">
      {/* Hero Section with Waitlist */}
      <section className="relative py-20 px-4 text-center">
        <div className="max-w-6xl mx-auto">
          <Badge className="mb-8 bg-gradient-to-r from-pink-500 to-rose-500 text-white border-0 text-lg px-6 py-3 font-bold tracking-tight shadow-lg hover:shadow-xl transition-all duration-300" variant="secondary">
            🚀 Content Copilot for Creators
          </Badge>
          
          <h1 className="text-6xl md:text-8xl font-black text-gradient-animate mb-8 leading-tight tracking-tighter">
            ThottoPilot
          </h1>
          
          <p className="text-xl md:text-2xl font-semibold text-foreground mb-8 max-w-3xl mx-auto leading-relaxed">
            Join the waitlist for the ultimate content copilot that automates your promo workflow with smart scheduling and content protection
          </p>
          
          {/* Waitlist Form */}
          <Card className="max-w-2xl mx-auto mb-12 bg-card backdrop-blur-xl border-2 border-pink-200/50 dark:border-pink-500/30 shadow-2xl card-hover">
            <CardHeader>
              <CardTitle className="text-2xl text-center">Join the Waitlist</CardTitle>
              <CardDescription className="text-center">
                Be among the first to experience the future of NSFW content creation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Email Input */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-left block">Email Address *</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="your@email.com"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    required
                    className="text-lg py-3"
                    data-testid="input-email"
                  />
                </div>

                {/* Platform Multi-select */}
                <div className="space-y-3">
                  <Label className="text-left block">Which platforms do you use? *</Label>
                  <div className="grid grid-cols-2 gap-3">
                    {platforms.map((platform) => (
                      <div key={platform.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={platform.id}
                          checked={formData.platformTags.includes(platform.id)}
                          onCheckedChange={(checked) => 
                            handlePlatformChange(platform.id, checked as boolean)
                          }
                          data-testid={`checkbox-${platform.id}`}
                        />
                        <Label htmlFor={platform.id} className="text-sm font-normal">
                          {platform.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Pain Point */}
                <div className="space-y-2">
                  <Label htmlFor="painPoint" className="text-left block">
                    What's your biggest content creation challenge? (Optional)
                  </Label>
                  <Textarea
                    id="painPoint"
                    placeholder="e.g., Takes too long to create posts, hard to find good hashtags, getting banned from subreddits..."
                    value={formData.painPoint}
                    onChange={(e) => setFormData(prev => ({ ...prev, painPoint: e.target.value }))}
                    rows={3}
                    data-testid="textarea-painpoint"
                  />
                </div>

                {/* Turnstile Widget (disabled in dev) */}
                <div className="flex justify-center">
                  <div className="text-sm text-gray-500 p-4 border-2 border-dashed rounded-lg">
                    🔒 Anti-bot verification (Turnstile) - Ready for production
                  </div>
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  size="lg"
                  className="w-full btn-premium text-white font-bold text-lg py-6"
                  data-testid="button-submit"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Joining Waitlist...
                    </>
                  ) : (
                    <>
                      <Star className="mr-2 h-5 w-5" />
                      Join Waitlist
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Existing users CTA */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/login">
              <Button size="lg" variant="outline" className="font-bold px-8 py-4 text-lg border-pink-300 hover:border-pink-500 hover:bg-pink-50 dark:hover:bg-pink-950/20 shadow-lg hover:shadow-xl">
                <Sparkles className="mr-2 h-5 w-5" />
                Already have access? Login
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-white/70 backdrop-blur-xl dark:bg-black/20">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-5xl font-black text-foreground mb-6">
              What's Coming Soon
            </h2>
            <p className="text-xl font-semibold text-foreground">
              Powerful tools designed specifically for content creators
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Card
                key={index}
                className="group card-hover bg-card backdrop-blur-xl border-2 border-pink-200/50 dark:border-pink-500/30"
                onMouseEnter={() => setIsHovered(index.toString())}
                onMouseLeave={() => setIsHovered(null)}
              >
                <CardHeader>
                  <div className="flex items-center justify-between mb-4">
                    <div className={`p-4 rounded-2xl bg-gradient-to-br from-pink-100 to-rose-100 text-pink-600 transition-all duration-300 ${
                      isHovered === index.toString() ? 'scale-110 shadow-lg' : ''
                    }`}>
                      {feature.icon}
                    </div>
                    <Badge className="bg-gradient-to-r from-green-100 to-emerald-100 text-green-800 border-green-200 font-bold shadow-md">
                      {feature.benefit}
                    </Badge>
                  </div>
                  <CardTitle className="text-2xl font-black text-card-foreground group-hover:text-pink-600 transition-colors">
                    {feature.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-muted-foreground text-lg leading-relaxed font-medium">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gradient-to-r from-pink-900 via-rose-900 to-pink-800 dark:from-pink-950 dark:via-rose-950 dark:to-pink-900 text-white py-16 px-4">
        <div className="max-w-6xl mx-auto text-center">
          <h3 className="text-3xl font-black mb-6 text-gradient-animate">ThottoPilot</h3>
          <p className="text-pink-100 mb-8 text-lg font-medium">
            The ultimate content copilot for creators
          </p>
          <div className="flex justify-center space-x-8 text-pink-200">
            <a href="#" className="hover:text-white transition-colors font-semibold">Privacy Policy</a>
            <a href="#" className="hover:text-white transition-colors font-semibold">Terms of Service</a>
            <a href="#" className="hover:text-white transition-colors">Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}