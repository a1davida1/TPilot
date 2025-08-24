import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  CheckCircle, 
  Circle, 
  PlayCircle, 
  BookOpen, 
  Zap, 
  Shield, 
  TrendingUp,
  Calculator,
  Sparkles,
  ArrowRight,
  Users,
  Crown,
  FileText,
  Camera
} from 'lucide-react';
import { ThottoPilotLogo } from '@/components/thottopilot-logo';
import { motion, AnimatePresence } from 'framer-motion';

interface GettingStartedProps {
  userTier?: 'guest' | 'free' | 'pro' | 'premium';
  onSectionSelect?: (section: string) => void;
}

export function GettingStarted({ userTier = 'free', onSectionSelect }: GettingStartedProps) {
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [activeStep, setActiveStep] = useState<string | null>(null);

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
  };

  const handleStepAction = (step: any) => {
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

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-8">
      {/* Welcome Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-4"
      >
        <div className="flex items-center justify-center space-x-3">
          <div className="p-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl shadow-lg">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
          <div className="flex items-center space-x-3">
            <ThottoPilotLogo size="lg" className="h-10 w-10" />
            <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Welcome to ThottoPilot
            </h1>
          </div>
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
      </motion.div>

      {/* Progress Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card className="bg-gradient-to-r from-purple-50 to-pink-50 border-purple-200">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Your Setup Progress</span>
              <span className="text-sm font-normal text-gray-600">
                {completedCount} of {steps.length} completed
              </span>
            </CardTitle>
            <Progress value={progressPercentage} className="h-3" />
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              Complete these steps to unlock the full power of ThottoPilot
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Setup Steps */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              <span>Setup Checklist</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {steps.map((step, index) => {
              const IconComponent = step.icon;
              const isCompleted = completedSteps.has(step.id);
              const isDisabled = step.proOnly && (userTier === 'guest' || userTier === 'free');
              
              return (
                <motion.div
                  key={step.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={`p-4 rounded-xl border-2 transition-all duration-300 ${
                    isCompleted 
                      ? 'bg-green-50 border-green-200' 
                      : isDisabled 
                        ? 'bg-gray-50 border-gray-200 opacity-60' 
                        : 'bg-white border-gray-200 hover:border-purple-300 hover:shadow-md'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4">
                      <button
                        onClick={() => toggleStep(step.id)}
                        className="flex-shrink-0"
                        disabled={isDisabled}
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
                        <div className="flex items-center space-x-2">
                          <h3 className="font-semibold text-gray-900">{step.title}</h3>
                          {step.proOnly && (
                            <Badge className="bg-yellow-100 text-yellow-700 text-xs">Pro Feature</Badge>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{step.description}</p>
                        {(step as any).details && (
                          <p className="text-xs text-gray-500 mb-2 italic">{(step as any).details}</p>
                        )}
                        <div className="flex items-center space-x-2 mt-1">
                          <Badge variant="outline" className="text-xs">
                            {step.difficulty}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            {step.time}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    
                    <Button
                      onClick={() => handleStepAction(step)}
                      disabled={isDisabled}
                      className={isCompleted ? 'bg-green-500 hover:bg-green-600' : 'bg-purple-500 hover:bg-purple-600'}
                    >
                      {isCompleted ? 'Completed' : step.action}
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </motion.div>
              );
            })}
          </CardContent>
        </Card>
      </motion.div>

      {/* Key Features Overview */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Zap className="h-5 w-5 text-purple-500" />
              <span>Key Features</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {features.map((feature, index) => {
                const IconComponent = feature.icon;
                return (
                  <motion.div
                    key={feature.title}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 * index }}
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
                  </motion.div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </motion.div>


      {/* Pro Upgrade CTA for Free Users */}
      {(userTier === 'free' || userTier === 'guest') && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
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
        </motion.div>
      )}
    </div>
  );
}