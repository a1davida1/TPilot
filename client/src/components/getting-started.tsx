import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle, 
  Circle, 
  Zap, 
  Shield, 
  TrendingUp,
  Calculator,
  Sparkles,
  ArrowRight,
  Users,
  Crown,
  FileText,
  ChevronUp,
  ChevronDown,
  EyeOff
} from 'lucide-react';
import { ThottoPilotLogo } from '@/components/thottopilot-logo';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { useOnboardingState } from '@/hooks/use-onboarding-state';

interface GettingStartedProps {
  userTier?: 'guest' | 'free' | 'pro' | 'premium';
  onSectionSelect?: (section: string) => void;
  isAtBottom?: boolean;
  onSetupLater?: () => void;
}

export function GettingStarted({ userTier = 'free', onSectionSelect, isAtBottom: _isAtBottom = false, onSetupLater }: GettingStartedProps) {
  const { data: savedState, isLoading: isLoadingState, updateState } = useOnboardingState();
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [expandedStep, setExpandedStep] = useState<string>("");
  const [isMinimized, setIsMinimized] = useState(false);

  // Load saved state when available
  useEffect(() => {
    if (savedState && !isLoadingState) {
      setCompletedSteps(new Set(savedState.completedSteps));
      setIsMinimized(savedState.isMinimized);
    }
  }, [savedState, isLoadingState]);

  const steps = [
    {
      id: 'profile',
      title: 'Set Up Your Profile',
      description: 'Complete your creator profile, set preferences, and personalize your workspace for optimal content creation',
      icon: Users,
      action: 'Go to Profile',
      section: 'profile',
      difficulty: 'Easy',
      time: '2 min',
      details: 'Add your username, bio, preferred platforms, and content style preferences to help our system generate better content for you.'
    },
    {
      id: 'first-content',
      title: 'Create Your First Content',
      description: 'Learn to generate engaging posts with our content creator using templates or custom prompts',
      icon: Sparkles,
      action: 'Start Creating',
      section: 'generator',
      difficulty: 'Easy',
      time: '3 min',
      details: 'Choose from Quick Styles for instant content or use Custom mode to write your own prompts. Try different text tones and photo types.'
    },
    {
      id: 'image-protection',
      title: 'Protect Your Images',
      description: 'Use ImageShield to protect your content from theft with advanced anti-reverse search algorithms',
      icon: Shield,
      action: 'Protect Images',
      section: 'protect',
      difficulty: 'Easy',
      time: '1 min',
      proOnly: false,
      details: 'Upload images and apply protection levels (Light, Standard, Heavy). All users get watermark-free protected images.'
    },
    {
      id: 'reddit-connect',
      title: 'Connect Reddit Accounts',
      description: 'Link your Reddit accounts for automated posting and community discovery',
      icon: TrendingUp,
      action: 'Connect Reddit',
      section: 'reddit-accounts',
      difficulty: 'Medium',
      time: '5 min',
      details: 'Connect multiple Reddit accounts, discover relevant subreddits, and automate your posting schedule across communities.'
    },
    {
      id: 'tax-setup',
      title: 'Set Up Tax Tracking',
      description: 'Start tracking business expenses, receipts, and income for accurate tax deductions',
      icon: Calculator,
      action: 'Setup Taxes',
      section: 'tax',
      difficulty: 'Easy',
      time: '3 min',
      details: 'Add your first business expense, upload receipts, and set up expense categories. View calendar and analytics.'
    },
    {
      id: 'analytics',
      title: 'View Your Analytics',
      description: 'Monitor your content performance, growth metrics, and revenue tracking across platforms',
      icon: TrendingUp,
      action: 'View Analytics',
      section: 'analytics',
      difficulty: 'Easy',
      time: '2 min',
      proOnly: false,
      details: 'Track post engagement, follower growth, revenue trends, and optimize your content strategy with detailed insights.'
    },
    {
      id: 'reddit-communities',
      title: 'Discover Reddit Communities',
      description: 'Find and join relevant subreddits for your content niche and understand posting rules',
      icon: TrendingUp,
      action: 'Find Communities',
      section: 'reddit',
      difficulty: 'Medium',
      time: '10 min',
      details: 'Browse curated subreddit lists, understand community rules, and identify the best posting times for maximum engagement.'
    },
    {
      id: 'trending-tags',
      title: 'Explore Trending Tags',
      description: 'Research popular hashtags and trending topics to maximize your content reach',
      icon: Zap,
      action: 'View Trends',
      section: 'trending',
      difficulty: 'Easy',
      time: '5 min',
      details: 'See trending hashtags, popular topics, and seasonal content ideas to stay ahead of the curve.'
    },
    {
      id: 'perks-setup',
      title: 'Explore Pro Perks',
      description: 'Discover monetization opportunities, affiliate programs, and growth strategies worth $1,247+',
      icon: Crown,
      action: 'View Perks',
      section: 'perks',
      difficulty: 'Easy',
      time: '10 min',
      details: 'Learn about payment platforms, affiliate programs, content protection tools, and business growth strategies.'
    }
  ];

  const completedCount = completedSteps.size;
  const progressPercentage = (completedCount / steps.length) * 100;

  const toggleStep = (stepId: string) => {
    const newCompleted = new Set(completedSteps);
    if (newCompleted.has(stepId)) {
      newCompleted.delete(stepId);
    } else {
      newCompleted.add(stepId);
    }
    setCompletedSteps(newCompleted);
    
    // Persist to backend
    updateState({ completedSteps: Array.from(newCompleted) });
  };

  const handleMinimize = (minimized: boolean) => {
    setIsMinimized(minimized);
    // Persist to backend
    updateState({ isMinimized: minimized });
  };

  const handleStepAction = (step: { section?: string }) => {
    if (onSectionSelect && step.section) {
      onSectionSelect(step.section);
    }
  };

  const features = [
    {
      title: 'Content Creation',
      description: 'Generate engaging posts for multiple platforms',
      icon: FileText,
      color: 'from-purple-500 to-pink-500'
    },
    {
      title: 'Image Protection',
      description: 'Protect your content with advanced algorithms',
      icon: Shield,
      color: 'from-blue-500 to-cyan-500'
    },
    {
      title: 'Reddit Integration',
      description: 'Automate posting to Reddit communities',
      icon: TrendingUp,
      color: 'from-green-500 to-emerald-500'
    },
    {
      title: 'Tax Tracking',
      description: 'Track business expenses for tax deductions',
      icon: Calculator,
      color: 'from-orange-500 to-red-500'
    }
  ];

  // Minimized version for experienced users
  if (isMinimized) {
    return (
      <div className="fixed bottom-4 left-4 z-30">
        <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200 shadow-lg max-w-xs">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <ThottoPilotLogo size="sm" />
                <div>
                  <h4 className="font-semibold text-sm text-gray-900">Setup Guide</h4>
                  <p className="text-xs text-gray-600">
                    {completedCount} of {steps.length} completed
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleMinimize(false)}
                className="h-8 w-8 p-0 hover:bg-purple-100"
                data-testid="button-expand-guide"
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
            </div>
            <Progress value={progressPercentage} className="h-2 mt-2" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Welcome Header */}
      <div className="text-center space-y-4">
        <div className="flex flex-col items-center justify-center space-y-4">
          <img
            src="/thottopilot-logo.png"
            alt="ThottoPilot"
            className="h-16 w-16 object-contain"
          />
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Welcome to ThottoPilot
          </h1>
        </div>
        <p className="text-lg text-gray-600 max-w-2xl mx-auto">
          Your complete platform for content creation, protection, and monetization. Let's get you started!
        </p>
        <div className="flex items-center justify-center space-x-2">
          <Badge className="bg-purple-100 text-purple-700">
            {userTier === 'guest' ? 'Guest Mode' : `${userTier.charAt(0).toUpperCase() + userTier.slice(1)} Plan`}
          </Badge>
          {userTier === 'guest' && (
            <Badge className="bg-green-100 text-green-700">
              ✨ Sign up for free features
            </Badge>
          )}
        </div>
      </div>

      {/* Progress Overview */}
      <div>
        <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Your Setup Progress</span>
              <div className="flex items-center space-x-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onSetupLater?.();
                  }}
                  className="h-8 px-3 text-xs hover:bg-purple-100 flex items-center space-x-1"
                >
                  <EyeOff className="h-3 w-3" />
                  <span>Setup Later</span>
                </Button>
                <span className="text-sm font-normal text-gray-600">
                  {completedCount} of {steps.length} completed
                </span>
              </div>
            </CardTitle>
            <Progress value={progressPercentage} className="h-3" />
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              Complete these steps to unlock the full power of ThottoPilot
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Setup Steps */}
      <div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span>Setup Checklist</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Accordion 
              type="single" 
              collapsible 
              value={expandedStep}
              onValueChange={(value) => setExpandedStep(value || "")}
              data-testid="getting-started-accordion"
            >
              {steps.map((step, _index) => {
                const IconComponent = step.icon;
                const isCompleted = completedSteps.has(step.id);
                const isDisabled = step.proOnly && (userTier === 'guest' || userTier === 'free');
                const isExpanded = expandedStep === step.id;
                
                return (
                  <AccordionItem
                    key={step.id}
                    value={step.id}
                    className={`rounded-xl border-2 transition-all duration-300 mb-2 ${
                      isCompleted 
                        ? 'bg-green-50 border-green-200' 
                        : isDisabled 
                          ? 'bg-gray-50 border-gray-200 opacity-60' 
                          : 'bg-white border-gray-200 hover:border-purple-300'
                    }`}
                    data-testid={`step-${step.id}`}
                  >
                    <div className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-4 flex-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleStep(step.id);
                            }}
                            className="flex-shrink-0"
                            disabled={isDisabled}
                            data-testid={`checkbox-${step.id}`}
                          >
                            {isCompleted ? (
                              <CheckCircle className="h-6 w-6 text-green-500" />
                            ) : (
                              <Circle className="h-6 w-6 text-gray-300" />
                            )}
                          </button>
                          
                          <div className="p-2 bg-purple-100 rounded-lg">
                            <IconComponent className="h-5 w-5 text-purple-600" />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1">
                              <h3 className="font-semibold text-gray-900">{step.title}</h3>
                              {step.proOnly && (
                                <Badge className="bg-yellow-100 text-yellow-700 text-xs">Pro Feature</Badge>
                              )}
                            </div>
                            <p className="text-sm text-gray-600">{step.description}</p>
                            <div className="flex items-center space-x-2 mt-2">
                              <Badge variant="outline" className="text-xs">
                                {step.difficulty}
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                {step.time}
                              </Badge>
                            </div>
                          </div>
                          
                          <AccordionTrigger 
                            className="hover:no-underline p-2"
                            data-testid={`expand-${step.id}`}
                          >
                            {isExpanded ? (
                              <ChevronUp className="h-5 w-5 text-purple-500" />
                            ) : (
                              <ChevronDown className="h-5 w-5 text-gray-400" />
                            )}
                          </AccordionTrigger>
                        </div>
                        
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStepAction(step);
                          }}
                          disabled={isDisabled}
                          className={isCompleted ? 'bg-green-500 hover:bg-green-600' : 'bg-purple-500 hover:bg-purple-600'}
                          data-testid={`action-${step.id}`}
                        >
                          {isCompleted ? 'Completed' : step.action}
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </div>
                      
                      <AccordionContent>
                        {(step as typeof step & { details?: string }).details && (
                          <div 
                            className="mt-4 p-4 bg-purple-50 rounded-lg border border-purple-100"
                            data-testid={`details-${step.id}`}
                          >
                            <p className="text-sm text-gray-700 leading-relaxed">
                              {(step as typeof step & { details?: string }).details}
                            </p>
                          </div>
                        )}
                      </AccordionContent>
                    </div>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </CardContent>
        </Card>
      </div>

      {/* Key Features Overview */}
      <div>
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Zap className="h-5 w-5 text-purple-500" />
              <span>Key Features</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {features.map((feature, _index) => {
                const IconComponent = feature.icon;
                return (
                  <div
                    key={feature.title}
                    className="p-4 rounded-xl bg-gradient-to-r from-gray-50 to-gray-100 hover:shadow-md transition-all duration-300"
                  >
                    <div className="flex items-center space-x-3">
                      <div className={`p-2 rounded-lg bg-gradient-to-r ${feature.color}`}>
                        <IconComponent className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{feature.title}</h3>
                        <p className="text-sm text-gray-600">{feature.description}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>


      {/* Pro Upgrade CTA for Free Users */}
      {(userTier === 'free' || userTier === 'guest') && (
        <div>
          <Card className="bg-gradient-to-r from-yellow-400 via-orange-500 to-pink-500 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <Crown className="h-12 w-12 text-yellow-200" />
                  <div>
                    <h3 className="text-xl font-bold">Upgrade to Pro</h3>
                    <p className="text-white/90">Unlock advanced features, unlimited generations, and premium support</p>
                  </div>
                </div>
                <Button 
                  size="lg"
                  className="bg-white text-orange-600 hover:bg-gray-100 font-semibold"
                >
                  Upgrade Now
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}