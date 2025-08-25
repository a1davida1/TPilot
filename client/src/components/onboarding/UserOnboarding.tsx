import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Play, CheckCircle, ArrowRight, ArrowLeft, Star, Trophy, Target,
  Sparkles, Brain, Clock, Shield, Heart, Zap, BookOpen, Users
} from 'lucide-react';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  component: React.ReactNode;
  completed: boolean;
  optional: boolean;
}

interface Tutorial {
  id: string;
  title: string;
  description: string;
  duration: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  category: string;
  icon: React.ReactNode;
  steps: Array<{
    title: string;
    description: string;
    action?: string;
  }>;
}

// Clean onboarding steps generator function (outside component for performance)
const getOnboardingSteps = (completedSteps: Set<string>): OnboardingStep[] => [
  {
    id: 'welcome',
    title: 'Welcome to ThottoPilot',
    description: 'Let\'s get you started with creating amazing content',
    completed: completedSteps.has('welcome'),
    optional: false,
    component: (
      <div className="text-center space-y-4">
        <div className="w-24 h-24 mx-auto flex items-center justify-center">
          <img 
            src="/thottopilot-full-logo.png" 
            alt="ThottoPilot - Pilot Content Creation Platform" 
            className="h-24 w-24 object-contain"
          />
        </div>
        <div>
          <h3 className="text-xl font-semibold text-white mb-2">
            🚀 Welcome to the Future of Content Creation!
          </h3>
          <p className="text-gray-300 mb-4">
            You're about to join thousands of creators who've transformed their content game with our advanced platform.
          </p>
          <div className="grid gap-2 text-sm">
            <div className="flex items-center justify-center space-x-2 text-purple-300">
              <Star className="h-4 w-4" />
              <span>Generate content 10x faster</span>
            </div>
            <div className="flex items-center justify-center space-x-2 text-pink-300">
              <Shield className="h-4 w-4" />
              <span>Protect your images with advanced technology</span>
            </div>
            <div className="flex items-center justify-center space-x-2 text-green-300">
              <Trophy className="h-4 w-4" />
              <span>Maximize your reach and revenue</span>
            </div>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'profile',
    title: 'Complete Your Profile',
    description: 'Tell us about your content style to personalize your experience',
    completed: completedSteps.has('profile'),
    optional: false,
    component: (
      <div className="space-y-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-white mb-2">Content Style</label>
            <select className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white">
              <option>Playful & Fun</option>
              <option>Professional & Classy</option>
              <option>Bold & Provocative</option>
              <option>Sweet & Romantic</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-white mb-2">Primary Platform</label>
            <select className="w-full bg-gray-700 border border-gray-600 rounded-lg p-3 text-white">
              <option>Reddit</option>
              <option>Twitter/X</option>
              <option>Instagram</option>
              <option>Multiple Platforms</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-white mb-2">Content Goals</label>
          <div className="grid gap-2 md:grid-cols-2">
            <label className="flex items-center space-x-2 text-gray-300">
              <input type="checkbox" className="rounded border-gray-600" />
              <span>Increase engagement</span>
            </label>
            <label className="flex items-center space-x-2 text-gray-300">
              <input type="checkbox" className="rounded border-gray-600" />
              <span>Drive traffic to profile</span>
            </label>
            <label className="flex items-center space-x-2 text-gray-300">
              <input type="checkbox" className="rounded border-gray-600" />
              <span>Boost sales/subscriptions</span>
            </label>
            <label className="flex items-center space-x-2 text-gray-300">
              <input type="checkbox" className="rounded border-gray-600" />
              <span>Build brand awareness</span>
            </label>
          </div>
        </div>
      </div>
    )
  },
  {
    id: 'content-creation',
    title: 'Create Your First Content',
    description: 'Learn how to generate engaging posts with our advanced system',
    completed: completedSteps.has('content-creation'),
    optional: false,
    component: (
      <div className="space-y-4">
        <Alert className="border-blue-500/20 bg-blue-500/10">
          <Brain className="h-4 w-4" />
          <AlertDescription className="text-blue-300">
            Our system generates content based on your photos and preferences. Let's create your first post!
          </AlertDescription>
        </Alert>
        
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="bg-gray-700 border-purple-500/20 p-4">
            <Heart className="h-8 w-8 text-purple-400 mb-3" />
            <h4 className="font-medium text-white text-sm">Choose Style</h4>
            <p className="text-xs text-gray-400 mb-3">Pick your content tone</p>
            <Button size="sm" variant="outline" className="w-full">
              Select Style
            </Button>
          </Card>
          <Card className="bg-gray-700 border-pink-500/20 p-4">
            <Zap className="h-8 w-8 text-pink-400 mb-3" />
            <h4 className="font-medium text-white text-sm">Add Photos</h4>
            <p className="text-xs text-gray-400 mb-3">Upload your content</p>
            <Button size="sm" variant="outline" className="w-full">
              Upload Images
            </Button>
          </Card>
          <Card className="bg-gray-700 border-green-500/20 p-4">
            <Trophy className="h-8 w-8 text-green-400 mb-3" />
            <h4 className="font-medium text-white text-sm">Generate</h4>
            <p className="text-xs text-gray-400 mb-3">Create your post</p>
            <Button size="sm" className="w-full bg-gradient-to-r from-purple-500 to-pink-500">
              Start Tutorial
            </Button>
          </Card>
        </div>
      </div>
    )
  },
  {
    id: 'image-protection',
    title: 'Set Up Image Protection',
    description: 'Enable advanced security features to protect your content',
    completed: completedSteps.has('image-protection'),
    optional: true,
    component: (
      <div className="space-y-4">
        <div className="text-center">
          <Shield className="h-16 w-16 text-green-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">ImageShield Protection</h3>
          <p className="text-gray-400 mb-4">
            Our advanced protection system makes your images nearly impossible to steal or reverse-search.
          </p>
        </div>
        
        <div className="grid gap-3 md:grid-cols-3">
          <Card className="bg-gray-700 border-green-500/20 p-4">
            <div className="text-center">
              <div className="w-8 h-8 bg-green-500/20 rounded-full mx-auto mb-2 flex items-center justify-center">
                <Shield className="h-4 w-4 text-green-400" />
              </div>
              <h4 className="font-medium text-white text-xs">Light Protection</h4>
              <p className="text-xs text-gray-400">Basic security</p>
            </div>
          </Card>
          <Card className="bg-gray-700 border-yellow-500/20 p-4">
            <div className="text-center">
              <div className="w-8 h-8 bg-yellow-500/20 rounded-full mx-auto mb-2 flex items-center justify-center">
                <Shield className="h-4 w-4 text-yellow-400" />
              </div>
              <h4 className="font-medium text-white text-xs">Standard Protection</h4>
              <p className="text-xs text-gray-400">Recommended</p>
            </div>
          </Card>
          <Card className="bg-gray-700 border-red-500/20 p-4">
            <div className="text-center">
              <div className="w-8 h-8 bg-red-500/20 rounded-full mx-auto mb-2 flex items-center justify-center">
                <Shield className="h-4 w-4 text-red-400" />
              </div>
              <h4 className="font-medium text-white text-xs">Heavy Protection</h4>
              <p className="text-xs text-gray-400">Maximum security</p>
            </div>
          </Card>
        </div>
      </div>
    )
  },
  {
    id: 'analytics',
    title: 'Explore Analytics',
    description: 'Learn how to track and optimize your content performance',
    completed: completedSteps.has('analytics'),
    optional: true,
    component: (
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-white">Performance Dashboard</h3>
        <p className="text-gray-400">
          Track performance, understand your audience, and optimize for better results.
        </p>
        
        <div className="grid gap-3 md:grid-cols-2">
          <Card className="bg-gray-700 border-purple-500/20 p-4">
            <Target className="h-8 w-8 text-purple-400 mb-3" />
            <h4 className="font-medium text-white text-sm">Performance Tracking</h4>
            <p className="text-xs text-gray-400 mb-3">Monitor views, engagement, and revenue</p>
            <div className="space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Views</span>
                <span className="text-white">12.8k</span>
              </div>
              <Progress value={75} className="h-1" />
            </div>
          </Card>
          <Card className="bg-gray-700 border-green-500/20 p-4">
            <Brain className="h-8 w-8 text-green-400 mb-3" />
            <h4 className="font-medium text-white text-sm">AI Insights</h4>
            <p className="text-xs text-gray-400 mb-3">Get intelligent recommendations</p>
            <div className="space-y-1 text-xs">
              <div className="text-green-400">• Post at 9 AM for +23% engagement</div>
              <div className="text-blue-400">• Video content performs 40% better</div>
            </div>
          </Card>
        </div>
      </div>
    )
  }
];

export default function UserOnboarding() {
  const [currentStep, setCurrentStep] = useState(0);
  const [showTutorial, setShowTutorial] = useState<string | null>(null);
  const [completedTutorials, setCompletedTutorials] = useState<Set<string>>(new Set());
  
  // Hybrid approach: Performance + Robustness
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(() => {
    // Load from localStorage on mount (performance optimized)
    const saved = localStorage.getItem('onboarding_completed');
    return saved ? new Set(JSON.parse(saved)) : new Set();
  });
  
  // useMemo prevents recreation unless completedSteps changes (performance optimization)
  const onboardingSteps = useMemo(
    () => getOnboardingSteps(completedSteps),
    [completedSteps]
  );
  
  // Robust auto-saving with useEffect (saves on ANY state change)
  useEffect(() => {
    localStorage.setItem('onboarding_completed', JSON.stringify(Array.from(completedSteps)));
  }, [completedSteps]);
  
  // Load current step from localStorage (robustness)
  useEffect(() => {
    const savedStep = localStorage.getItem('onboarding_current_step');
    if (savedStep) {
      setCurrentStep(parseInt(savedStep, 10));
    }
  }, []);
  
  // Save current step to localStorage (robustness)
  useEffect(() => {
    localStorage.setItem('onboarding_current_step', currentStep.toString());
  }, [currentStep]);
  
  // Reset onboarding function (useful for testing/resetting)
  const resetOnboarding = () => {
    setCompletedSteps(new Set());
    setCurrentStep(0);
    localStorage.removeItem('onboarding_completed');
    localStorage.removeItem('onboarding_current_step');
  };

  const tutorials: Tutorial[] = [
    {
      id: 'profile',
      title: 'Complete Your Profile',
      description: 'Tell us about your content style to personalize your experience',

      optional: false,
      component: (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Let's personalize your experience</h3>
          <div className="grid gap-3 md:grid-cols-2">
            <Card className="bg-gray-700 border-purple-500/20 p-4 cursor-pointer hover:border-purple-500/40 transition-colors">
              <div className="flex items-center space-x-3">
                <Heart className="h-5 w-5 text-pink-400" />
                <div>
                  <h4 className="font-medium text-white">Lifestyle & Fitness</h4>
                  <p className="text-xs text-gray-400">Wellness, workouts, daily routines</p>
                </div>
              </div>
            </Card>
            <Card className="bg-gray-700 border-purple-500/20 p-4 cursor-pointer hover:border-purple-500/40 transition-colors">
              <div className="flex items-center space-x-3">
                <Sparkles className="h-5 w-5 text-purple-400" />
                <div>
                  <h4 className="font-medium text-white">Fashion & Beauty</h4>
                  <p className="text-xs text-gray-400">Style tips, beauty content, aesthetics</p>
                </div>
              </div>
            </Card>
            <Card className="bg-gray-700 border-purple-500/20 p-4 cursor-pointer hover:border-purple-500/40 transition-colors">
              <div className="flex items-center space-x-3">
                <Zap className="h-5 w-5 text-yellow-400" />
                <div>
                  <h4 className="font-medium text-white">Entertainment</h4>
                  <p className="text-xs text-gray-400">Fun content, personality-driven posts</p>
                </div>
              </div>
            </Card>
            <Card className="bg-gray-700 border-purple-500/20 p-4 cursor-pointer hover:border-purple-500/40 transition-colors">
              <div className="flex items-center space-x-3">
                <Users className="h-5 w-5 text-blue-400" />
                <div>
                  <h4 className="font-medium text-white">Community Building</h4>
                  <p className="text-xs text-gray-400">Engagement-focused content strategy</p>
                </div>
              </div>
            </Card>
          </div>
          <Alert className="bg-blue-500/10 border-blue-500/20">
            <Brain className="h-4 w-4 text-blue-400" />
            <AlertDescription className="text-blue-400">
              <strong>AI Tip:</strong> Selecting your content category helps our AI generate more targeted and relevant content suggestions.
            </AlertDescription>
          </Alert>
        </div>
      )
    },
    {
      id: 'first-content',
      title: 'Create Your First Content',
      description: 'Let\'s generate your first piece of content together',

      optional: false,
      component: (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Ready to create something amazing?</h3>
          <p className="text-gray-400">We'll walk you through creating your first AI-generated content piece.</p>
          
          <Card className="bg-gray-700 border-purple-500/20 p-4">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center">
                <Play className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium text-white">Interactive Content Generator</h4>
                <p className="text-sm text-gray-400">Follow our guided process to create your first post</p>
              </div>
              <Button 
                size="sm"
                className="bg-gradient-to-r from-purple-500 to-pink-500"
                onClick={startTutorial}
              >
                Start Tutorial
              </Button>
            </div>
          </Card>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="p-3 bg-gray-700 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-400 mb-2" />
              <h4 className="font-medium text-white text-sm">1. Choose Your Style</h4>
              <p className="text-xs text-gray-400">Select from 8 preset content styles</p>
            </div>
            <div className="p-3 bg-gray-700 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-400 mb-2" />
              <h4 className="font-medium text-white text-sm">2. Add Details</h4>
              <p className="text-xs text-gray-400">Describe what you want to create</p>
            </div>
            <div className="p-3 bg-gray-700 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-400 mb-2" />
              <h4 className="font-medium text-white text-sm">3. AI Generation</h4>
              <p className="text-xs text-gray-400">Watch AI create your content in real-time</p>
            </div>
            <div className="p-3 bg-gray-700 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-400 mb-2" />
              <h4 className="font-medium text-white text-sm">4. Customize & Export</h4>
              <p className="text-xs text-gray-400">Fine-tune and download your content</p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'image-protection',
      title: 'Protect Your Images',
      description: 'Learn how to use ImageShield to protect your content',

      optional: true,
      component: (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Keep your content safe with ImageShield</h3>
          <p className="text-gray-400">
            Our advanced image protection prevents unauthorized use while maintaining visual quality.
          </p>
          
          <div className="grid gap-3 md:grid-cols-3">
            <Card className="bg-gray-700 border-blue-500/20 p-4">
              <Shield className="h-8 w-8 text-blue-400 mb-3" />
              <h4 className="font-medium text-white text-sm">Anti-Reverse Search</h4>
              <p className="text-xs text-gray-400">Prevents image theft through search engines</p>
            </Card>
            <Card className="bg-gray-700 border-green-500/20 p-4">
              <Star className="h-8 w-8 text-green-400 mb-3" />
              <h4 className="font-medium text-white text-sm">Quality Preservation</h4>
              <p className="text-xs text-gray-400">Maintains visual appeal while adding protection</p>
            </Card>
            <Card className="bg-gray-700 border-purple-500/20 p-4">
              <Zap className="h-8 w-8 text-purple-400 mb-3" />
              <h4 className="font-medium text-white text-sm">Batch Processing</h4>
              <p className="text-xs text-gray-400">Protect multiple images simultaneously</p>
            </Card>
          </div>

          <Alert className="bg-yellow-500/10 border-yellow-500/20">
            <Shield className="h-4 w-4 text-yellow-400" />
            <AlertDescription className="text-yellow-400">
              <strong>Pro Tip:</strong> Use ImageShield on all your content before posting to maximize protection while maintaining engagement.
            </AlertDescription>
          </Alert>
        </div>
      )
    },
    {
      id: 'analytics',
      title: 'Understanding Analytics',
      description: 'Learn how to track and improve your content performance',

      optional: true,
      component: (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-white">Master your content analytics</h3>
          <p className="text-gray-400">
            Track performance, understand your audience, and optimize for better results.
          </p>
          
          <div className="grid gap-3 md:grid-cols-2">
            <Card className="bg-gray-700 border-purple-500/20 p-4">
              <Target className="h-8 w-8 text-purple-400 mb-3" />
              <h4 className="font-medium text-white text-sm">Performance Tracking</h4>
              <p className="text-xs text-gray-400 mb-3">Monitor views, engagement, and revenue</p>
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-gray-400">Views</span>
                  <span className="text-white">12.8k</span>
                </div>
                <Progress value={75} className="h-1" />
              </div>
            </Card>
            <Card className="bg-gray-700 border-green-500/20 p-4">
              <Brain className="h-8 w-8 text-green-400 mb-3" />
              <h4 className="font-medium text-white text-sm">AI Insights</h4>
              <p className="text-xs text-gray-400 mb-3">Get intelligent recommendations</p>
              <div className="space-y-1 text-xs">
                <div className="text-green-400">• Post at 9 AM for +23% engagement</div>
                <div className="text-blue-400">• Video content performs 40% better</div>
              </div>
            </Card>
          </div>
        </div>
      )
    }
  ];
    {
      id: 'content-creation',
      title: 'Content Creation Mastery',
      description: 'Learn advanced techniques for creating engaging content',
      duration: '5 min',
      difficulty: 'beginner',
      category: 'Content',
      icon: <Brain className="h-5 w-5" />,
      steps: [
        {
          title: 'Choose Your Content Style',
          description: 'Select from 8 different content styles that match your brand',
          action: 'Navigate to Content Creator'
        },
        {
          title: 'Optimize for Your Audience',
          description: 'Use audience insights to tailor your content tone and messaging'
        },
        {
          title: 'Generate Multiple Variations',
          description: 'Create several versions and A/B test for best performance'
        }
      ]
    },
    {
      id: 'image-protection',
      title: 'Advanced Image Protection',
      description: 'Master the ImageShield protection system',
      duration: '3 min',
      difficulty: 'intermediate',
      category: 'Security',
      icon: <Shield className="h-5 w-5" />,
      steps: [
        {
          title: 'Upload Your Images',
          description: 'Drag and drop or select images to protect'
        },
        {
          title: 'Choose Protection Level',
          description: 'Select from Light, Standard, or Heavy protection presets'
        },
        {
          title: 'Custom Settings',
          description: 'Fine-tune blur, noise, and resize settings for optimal results'
        }
      ]
    },
    {
      id: 'analytics-deep-dive',
      title: 'Analytics Deep Dive',
      description: 'Understand every metric and how to improve them',
      duration: '8 min',
      difficulty: 'advanced',
      category: 'Analytics',
      icon: <Target className="h-5 w-5" />,
      steps: [
        {
          title: 'Key Performance Indicators',
          description: 'Learn which metrics matter most for your content strategy'
        },
        {
          title: 'Audience Behavior Analysis',
          description: 'Understand when and how your audience engages'
        },
        {
          title: 'ROI Optimization',
          description: 'Track revenue per post and optimize for maximum returns'
        }
      ]
    }
  ];

  // Fixed progress calculation using hybrid approach
  const progress = ((currentStep + 1) / onboardingSteps.length) * 100;
  const completedCount = onboardingSteps.filter(step => step.completed).length;
  
  // Updated handleNext using hybrid approach
  const handleNext = () => {
    if (currentStep < onboardingSteps.length - 1) {
      // Mark current step as completed using new state management
      const currentStepId = onboardingSteps[currentStep].id;
      const newCompleted = new Set([...completedSteps, currentStepId]);
      setCompletedSteps(newCompleted);
      
      // Move to next step
      setCurrentStep(currentStep + 1);
    }
  };
  
  const handleComplete = () => {
    // Mark current step as completed
    const currentStepId = onboardingSteps[currentStep].id;
    setCompletedSteps(prev => new Set([...prev, currentStepId]));
  };
  
  const handleSkip = () => {
    if (currentStep < onboardingSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };
  
  const startTutorial = () => {
    // Mark step as completed and provide user feedback
    const currentStepId = onboardingSteps[currentStep].id;
    setCompletedSteps(prev => new Set([...prev, currentStepId]));
    // In a real implementation, this would navigate to the content creator
    // or open a guided tutorial overlay
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner': return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'intermediate': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'advanced': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Getting Started</h2>
          <p className="text-gray-400">Welcome to ThottoPilot - let's get you set up for success</p>
        </div>
        <Badge className="bg-gradient-to-r from-purple-500 to-pink-500">Phase 3</Badge>
      </div>

      {/* Progress Overview */}
      <Card className="bg-gray-800 border-purple-500/20">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Setup Progress</h3>
            <span className="text-sm text-gray-400">{completedCount}/{onboardingSteps.length} completed</span>
          </div>
          <Progress value={progress} className="h-2 mb-4" />
          <div className="grid gap-2 md:grid-cols-5">
            {onboardingSteps.map((step, index) => (
              <div
                key={step.id}
                className={`p-2 rounded-lg text-center cursor-pointer transition-colors ${
                  index === currentStep 
                    ? 'bg-purple-600/30 border border-purple-500' 
                    : step.completed 
                      ? 'bg-green-600/20 border border-green-500/30' 
                      : 'bg-gray-700 border border-gray-600'
                }`}
                onClick={() => setCurrentStep(index)}
              >
                <div className="flex items-center justify-center mb-1">
                  {step.completed ? (
                    <CheckCircle className="h-4 w-4 text-green-400" />
                  ) : index === currentStep ? (
                    <div className="w-4 h-4 bg-purple-400 rounded-full" />
                  ) : (
                    <div className="w-4 h-4 border border-gray-400 rounded-full" />
                  )}
                </div>
                <span className="text-xs text-gray-300">{step.title}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Current Step */}
      <Card className="bg-gray-800 border-purple-500/20">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-white">{onboardingSteps[currentStep].title}</CardTitle>
              <CardDescription>{onboardingSteps[currentStep].description}</CardDescription>
            </div>
            {onboardingSteps[currentStep].optional && (
              <Badge variant="outline" className="border-yellow-400 text-yellow-400">
                Optional
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {onboardingSteps[currentStep].component}
          
          <div className="flex justify-between">
            <Button
              variant="outline"
              onClick={handlePrevious}
              disabled={currentStep === 0}
              className="border-purple-500/20"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Previous
            </Button>
            <Button
              onClick={handleNext}
              disabled={currentStep === onboardingSteps.length - 1}
              className="bg-gradient-to-r from-purple-500 to-pink-500"
            >
              {currentStep === onboardingSteps.length - 1 ? 'Complete' : 'Next'}
              <ArrowRight className="h-4 w-4 ml-2" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tutorials Section */}
      <Card className="bg-gray-800 border-purple-500/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center space-x-2">
            <BookOpen className="h-5 w-5 text-blue-400" />
            <span>Interactive Tutorials</span>
          </CardTitle>
          <CardDescription>Master ThottoPilot with these guided tutorials</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {tutorials.map((tutorial) => (
              <Card key={tutorial.id} className="bg-gray-700 border-purple-500/20 cursor-pointer hover:border-purple-500/40 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="p-2 bg-purple-600/20 rounded-lg">
                      {tutorial.icon}
                    </div>
                    <div className="flex items-center space-x-2">
                      <Badge className={getDifficultyColor(tutorial.difficulty)} variant="outline">
                        {tutorial.difficulty}
                      </Badge>
                      {completedTutorials.has(tutorial.id) && (
                        <CheckCircle className="h-4 w-4 text-green-400" />
                      )}
                    </div>
                  </div>
                  <h4 className="font-medium text-white mb-1">{tutorial.title}</h4>
                  <p className="text-sm text-gray-400 mb-3">{tutorial.description}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-xs text-gray-400">
                      <Clock className="h-3 w-3" />
                      <span>{tutorial.duration}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowTutorial(tutorial.id)}
                      className="text-purple-400 hover:text-purple-300"
                    >
                      {completedTutorials.has(tutorial.id) ? 'Review' : 'Start'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tutorial Modal */}
      {showTutorial && (
        <Dialog open={!!showTutorial} onOpenChange={() => setShowTutorial(null)}>
          <DialogContent className="bg-gray-800 border-purple-500/20 max-w-2xl">
            <DialogHeader>
              <DialogTitle className="text-white">
                {tutorials.find(t => t.id === showTutorial)?.title}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {tutorials.find(t => t.id === showTutorial)?.steps.map((step, index) => (
                <div key={index} className="flex items-start space-x-4 p-4 bg-gray-700 rounded-lg">
                  <div className="flex items-center justify-center w-8 h-8 bg-purple-600 rounded-full text-white text-sm font-bold">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <h4 className="font-medium text-white mb-1">{step.title}</h4>
                    <p className="text-sm text-gray-400 mb-2">{step.description}</p>
                    {step.action && (
                      <Button size="sm" variant="outline" className="border-purple-500/20 text-xs">
                        {step.action}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              <div className="flex justify-end space-x-2">
                <Button
                  variant="outline"
                  onClick={() => setShowTutorial(null)}
                  className="border-purple-500/20"
                >
                  Close
                </Button>
                <Button
                  onClick={() => {
                    if (showTutorial) {
                      setCompletedTutorials(prev => new Set([...Array.from(prev), showTutorial]));
                      setShowTutorial(null);
                    }
                  }}
                  className="bg-gradient-to-r from-purple-500 to-pink-500"
                >
                  <Trophy className="h-4 w-4 mr-2" />
                  Mark Complete
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}