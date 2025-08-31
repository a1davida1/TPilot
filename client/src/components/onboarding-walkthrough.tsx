import { useState, useEffect, useCallback } from 'react';
// import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  ArrowRight, 
  ArrowLeft, 
  X, 
  Play, 
  CheckCircle, 
  Sparkles, 
  Brain, 
  Shield, 
  TrendingUp,
  Target,
  Lightbulb,
  Gift
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface TutorialStep {
  id: string;
  title: string;
  description: string;
  targetElement?: string; // CSS selector for element to highlight
  position: 'top' | 'bottom' | 'left' | 'right' | 'center';
  action?: () => void;
  actionLabel?: string;
  icon: React.ReactNode;
  category: 'getting-started' | 'content-creation' | 'protection' | 'analytics';
}

const tutorialSteps: TutorialStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to ThottoPilot! ✈️',
    description: 'Your complete platform for content creation, protection, and monetization. Let\'s take a quick tour!',
    position: 'center',
    icon: <Sparkles className="h-6 w-6" />,
    category: 'getting-started'
  },
  {
    id: 'generation-counter',
    title: 'Track Your Usage',
    description: 'Keep an eye on your daily generation count and tier limits. Upgrade for unlimited generations!',
    targetElement: '[data-testid="generation-counter"]',
    position: 'bottom',
    icon: <Target className="h-6 w-6" />,
    category: 'getting-started'
  },
  {
    id: 'content-creator',
    title: 'AI Content Generation',
    description: 'Create engaging social media content with our AI-powered generator. Choose from quick styles or custom prompts.',
    targetElement: '[data-testid="nav-content-creator"]',
    position: 'right',
    icon: <Brain className="h-6 w-6" />,
    category: 'content-creation'
  },
  {
    id: 'image-shield',
    title: 'Protect Your Images',
    description: 'Use ImageShield to protect your content from theft. Free users get watermarked protection, Pro gets clean images.',
    targetElement: '[data-testid="nav-image-shield"]',
    position: 'right',
    icon: <Shield className="h-6 w-6" />,
    category: 'protection'
  },
  {
    id: 'reddit-communities',
    title: 'Find Perfect Communities',
    description: 'Discover the best Reddit communities for your content with engagement predictions and posting guidelines.',
    targetElement: '[data-testid="nav-reddit-communities"]',
    position: 'right',
    icon: <TrendingUp className="h-6 w-6" />,
    category: 'analytics'
  },
  {
    id: 'analytics',
    title: 'Track Performance',
    description: 'Monitor your content performance, engagement rates, and growth metrics in your analytics dashboard.',
    targetElement: '[data-testid="nav-analytics"]',
    position: 'right',
    icon: <TrendingUp className="h-6 w-6" />,
    category: 'analytics'
  },
  {
    id: 'pro-perks',
    title: 'Unlock Pro Features',
    description: 'Upgrade to Pro for unlimited generations, watermark-free images, advanced analytics, and more!',
    targetElement: '[data-testid="nav-pro-perks"]',
    position: 'right',
    icon: <Gift className="h-6 w-6" />,
    category: 'getting-started'
  }
];

interface OnboardingWalkthroughProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete: () => void;
}

export function OnboardingWalkthrough({ isOpen, onClose, onComplete }: OnboardingWalkthroughProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [highlightedElement, setHighlightedElement] = useState<HTMLElement | null>(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  const { user } = useAuth();

  const step = tutorialSteps[currentStep];
  const progress = ((currentStep + 1) / tutorialSteps.length) * 100;

  // Highlight target element
  useEffect(() => {
    if (!isOpen || !step?.targetElement) {
      setHighlightedElement(null);
      return;
    }

    const element = document.querySelector(step.targetElement) as HTMLElement;
    if (element) {
      setHighlightedElement(element);
      
      // Calculate tooltip position
      const rect = element.getBoundingClientRect();
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
      
      let x = 0, y = 0;
      
      switch (step.position) {
        case 'top':
          x = rect.left + scrollLeft + rect.width / 2;
          y = rect.top + scrollTop - 20;
          break;
        case 'bottom':
          x = rect.left + scrollLeft + rect.width / 2;
          y = rect.bottom + scrollTop + 20;
          break;
        case 'left':
          x = rect.left + scrollLeft - 20;
          y = rect.top + scrollTop + rect.height / 2;
          break;
        case 'right':
          x = rect.right + scrollLeft + 20;
          y = rect.top + scrollTop + rect.height / 2;
          break;
        case 'center':
          x = window.innerWidth / 2;
          y = window.innerHeight / 2;
          break;
      }
      
      setTooltipPosition({ x, y });
      
      // Scroll element into view
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [currentStep, isOpen, step]);

  const nextStep = useCallback(() => {
    if (currentStep < tutorialSteps.length - 1) {
      setCurrentStep(prev => prev + 1);
    } else {
      onComplete();
    }
  }, [currentStep, onComplete]);

  const previousStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(prev => prev - 1);
    }
  }, [currentStep]);

  const skipTutorial = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  return (
    <>
      {isOpen && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/50 z-50"
            onClick={skipTutorial}
          />

          {/* Highlight circle for targeted elements */}
          {highlightedElement && step.targetElement && (
            <div
              className="fixed z-50 pointer-events-none"
              style={{
                left: highlightedElement.getBoundingClientRect().left + window.pageXOffset - 10,
                top: highlightedElement.getBoundingClientRect().top + window.pageYOffset - 10,
                width: highlightedElement.offsetWidth + 20,
                height: highlightedElement.offsetHeight + 20,
                borderRadius: '12px',
                border: '3px solid #8b5cf6',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                boxShadow: '0 0 0 9999px rgba(0, 0, 0, 0.5)',
              }}
            />
          )}

          {/* Tutorial tooltip */}
          <div
            className="fixed z-50"
            style={{
              left: step.position === 'center' ? '50%' : tooltipPosition.x,
              top: step.position === 'center' ? '50%' : tooltipPosition.y,
              transform: step.position === 'center' ? 'translate(-50%, -50%)' : 
                step.position === 'top' ? 'translate(-50%, -100%)' :
                step.position === 'bottom' ? 'translate(-50%, 0%)' :
                step.position === 'left' ? 'translate(-100%, -50%)' :
                'translate(0%, -50%)',
            }}
          >
            <Card className="w-80 shadow-2xl border-purple-200">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 rounded-lg text-purple-600">
                      {step.icon}
                    </div>
                    <div>
                      <CardTitle className="text-lg">{step.title}</CardTitle>
                      <Badge variant="outline" className="text-xs mt-1">
                        Step {currentStep + 1} of {tutorialSteps.length}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={skipTutorial}
                    className="h-8 w-8 p-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <Progress value={progress} className="h-2 mt-3" />
              </CardHeader>
              
              <CardContent>
                <CardDescription className="text-base mb-6">
                  {step.description}
                </CardDescription>

                {step.action && step.actionLabel && (
                  <Button
                    variant="outline"
                    onClick={step.action}
                    className="w-full mb-4"
                  >
                    <Play className="h-4 w-4 mr-2" />
                    {step.actionLabel}
                  </Button>
                )}

                <div className="flex items-center justify-between">
                  <Button
                    variant="ghost"
                    onClick={previousStep}
                    disabled={currentStep === 0}
                    className="flex items-center gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Previous
                  </Button>

                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      onClick={skipTutorial}
                      className="text-gray-500"
                    >
                      Skip Tour
                    </Button>
                    
                    <Button
                      onClick={nextStep}
                      className="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 flex items-center gap-2"
                    >
                      {currentStep === tutorialSteps.length - 1 ? (
                        <>
                          <CheckCircle className="h-4 w-4" />
                          Finish
                        </>
                      ) : (
                        <>
                          Next
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Floating progress indicator */}
          <div
            className="fixed top-24 right-6 z-50"
          >
            <Card className="p-3 bg-white/95 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="text-sm font-medium">Tutorial Progress</div>
                <div className="flex gap-1">
                  {tutorialSteps.map((_, index) => (
                    <div
                      key={index}
                      className={`w-2 h-2 rounded-full transition-colors ${
                        index <= currentStep ? 'bg-purple-600' : 'bg-gray-300'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </Card>
          </div>
        </>
      )}
    </>
  );
}