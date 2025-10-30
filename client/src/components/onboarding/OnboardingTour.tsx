import { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { X, ArrowRight, CheckCircle, Sparkles, Upload, Wand2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useLocation } from 'wouter';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  action?: {
    label: string;
    href: string;
  };
  completed?: boolean;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'connect-reddit',
    title: 'Connect Your Reddit Account',
    description: 'Link your Reddit account to start posting',
    icon: <Upload className="h-5 w-5" />,
    action: {
      label: 'Connect Reddit',
      href: '/settings#connections',
    },
  },
  {
    id: 'upload-image',
    title: 'Upload Your First Image',
    description: 'Upload an image to get started',
    icon: <Upload className="h-5 w-5" />,
    action: {
      label: 'Upload Image',
      href: '/quick-post',
    },
  },
  {
    id: 'generate-caption',
    title: 'Generate AI Caption',
    description: 'Let AI create the perfect caption',
    icon: <Wand2 className="h-5 w-5" />,
  },
  {
    id: 'first-post',
    title: 'Create Your First Post',
    description: 'Post to Reddit and start growing',
    icon: <Send className="h-5 w-5" />,
  },
];

interface OnboardingTourProps {
  onComplete?: () => void;
  onDismiss?: () => void;
}

export function OnboardingTour({ onComplete, onDismiss }: OnboardingTourProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());
  const [isVisible, setIsVisible] = useState(true);
  const [, setLocation] = useLocation();

  // Load progress from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('onboarding-progress');
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setCompletedSteps(new Set(data.completedSteps || []));
        setCurrentStep(data.currentStep || 0);
      } catch (error) {
        console.error('Failed to load onboarding progress:', error);
      }
    }
  }, []);

  // Save progress to localStorage
  useEffect(() => {
    localStorage.setItem(
      'onboarding-progress',
      JSON.stringify({
        completedSteps: Array.from(completedSteps),
        currentStep,
      })
    );
  }, [completedSteps, currentStep]);

  const handleNext = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const _handleStepComplete = (stepId: string) => {
    setCompletedSteps((prev) => new Set([...prev, stepId]));
    
    // If this is the last step, trigger celebration
    if (stepId === 'first-post') {
      triggerCelebration();
      setTimeout(() => {
        handleComplete();
      }, 2000);
    }
  };

  const handleComplete = () => {
    localStorage.setItem('onboarding-completed', 'true');
    setIsVisible(false);
    onComplete?.();
  };

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  const handleAction = (href: string) => {
    setLocation(href);
    handleDismiss();
  };

  const triggerCelebration = () => {
    const duration = 3000;
    const animationEnd = Date.now() + duration;

    const randomInRange = (min: number, max: number) => {
      return Math.random() * (max - min) + min;
    };

    const interval = setInterval(() => {
      const timeLeft = animationEnd - Date.now();

      if (timeLeft <= 0) {
        clearInterval(interval);
        return;
      }

      const particleCount = 50;

      confetti({
        particleCount,
        startVelocity: 30,
        spread: 360,
        origin: {
          x: randomInRange(0.1, 0.9),
          y: Math.random() - 0.2,
        },
        colors: ['#EC4899', '#8B5CF6', '#3B82F6', '#10B981', '#F59E0B'],
      });
    }, 250);
  };

  const progress = (completedSteps.size / ONBOARDING_STEPS.length) * 100;
  const step = ONBOARDING_STEPS[currentStep];

  if (!isVisible) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 px-4">
        <Card className="border-2 border-primary/20 shadow-2xl">
          <CardContent className="p-6">
            {/* Close Button */}
            <button
              onClick={handleDismiss}
              className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Progress */}
            <div className="mb-6">
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="font-medium">Getting Started</span>
                <span className="text-muted-foreground">
                  {completedSteps.size} of {ONBOARDING_STEPS.length} complete
                </span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            {/* Step Icon */}
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary to-purple-600 text-white">
              {step.icon}
            </div>

            {/* Step Content */}
            <div className="mb-6">
              <h2 className="mb-2 text-2xl font-bold">{step.title}</h2>
              <p className="text-muted-foreground">{step.description}</p>
            </div>

            {/* Step Checklist */}
            <div className="mb-6 space-y-2">
              {ONBOARDING_STEPS.map((s, index) => (
                <div
                  key={s.id}
                  className={cn(
                    'flex items-center gap-3 rounded-lg p-3 transition-colors',
                    index === currentStep && 'bg-primary/10',
                    completedSteps.has(s.id) && 'opacity-60'
                  )}
                >
                  <div
                    className={cn(
                      'flex h-6 w-6 items-center justify-center rounded-full border-2',
                      completedSteps.has(s.id)
                        ? 'border-green-500 bg-green-500 text-white'
                        : index === currentStep
                        ? 'border-primary bg-primary text-white'
                        : 'border-muted-foreground/30'
                    )}
                  >
                    {completedSteps.has(s.id) ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <span className="text-xs font-medium">{index + 1}</span>
                    )}
                  </div>
                  <span
                    className={cn(
                      'text-sm font-medium',
                      completedSteps.has(s.id) && 'line-through'
                    )}
                  >
                    {s.title}
                  </span>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-2">
              <Button
                variant="ghost"
                onClick={handlePrevious}
                disabled={currentStep === 0}
              >
                Previous
              </Button>

              <div className="flex gap-2">
                {step.action && (
                  <Button
                    variant="outline"
                    onClick={() => handleAction(step.action!.href)}
                  >
                    {step.action.label}
                  </Button>
                )}
                <Button onClick={handleNext}>
                  {currentStep === ONBOARDING_STEPS.length - 1 ? (
                    'Finish'
                  ) : (
                    <>
                      Next
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

// Welcome Modal (shown on first login)
export function WelcomeModal({ onStart, onDismiss }: { onStart: () => void; onDismiss: () => void }) {
  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" />

      {/* Modal */}
      <div className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 px-4">
        <Card className="border-2 border-primary/20 shadow-2xl">
          <CardContent className="p-8 text-center">
            <div className="mb-4 flex justify-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary to-purple-600">
                <Sparkles className="h-10 w-10 text-white" />
              </div>
            </div>

            <h1 className="mb-2 text-3xl font-bold">Welcome to ThottoPilot!</h1>
            <p className="mb-6 text-muted-foreground">
              Your AI-powered content management platform for Reddit. Let's get you started in just a few steps.
            </p>

            <div className="mb-6 space-y-3 text-left">
              <div className="flex items-start gap-3">
                <CheckCircle className="mt-0.5 h-5 w-5 text-green-500" />
                <div>
                  <p className="font-medium">AI Caption Generation</p>
                  <p className="text-sm text-muted-foreground">Create engaging captions instantly</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="mt-0.5 h-5 w-5 text-green-500" />
                <div>
                  <p className="font-medium">Smart Scheduling</p>
                  <p className="text-sm text-muted-foreground">Post at optimal times automatically</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <CheckCircle className="mt-0.5 h-5 w-5 text-green-500" />
                <div>
                  <p className="font-medium">Analytics & Insights</p>
                  <p className="text-sm text-muted-foreground">Track performance and grow faster</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <Button onClick={onStart} size="lg" className="w-full">
                Start Tour
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button variant="ghost" onClick={onDismiss} size="sm">
                Skip for now
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}

// Hook to manage onboarding state
export function useOnboarding() {
  const [showWelcome, setShowWelcome] = useState(false);
  const [showTour, setShowTour] = useState(false);

  useEffect(() => {
    const completed = localStorage.getItem('onboarding-completed');
    const dismissed = localStorage.getItem('onboarding-dismissed');

    if (!completed && !dismissed) {
      setShowWelcome(true);
    }
  }, []);

  const startTour = () => {
    setShowWelcome(false);
    setShowTour(true);
  };

  const dismissWelcome = () => {
    setShowWelcome(false);
    localStorage.setItem('onboarding-dismissed', 'true');
  };

  const completeTour = () => {
    setShowTour(false);
    localStorage.setItem('onboarding-completed', 'true');
  };

  const dismissTour = () => {
    setShowTour(false);
  };

  const replayTour = () => {
    localStorage.removeItem('onboarding-completed');
    localStorage.removeItem('onboarding-progress');
    setShowWelcome(true);
  };

  return {
    showWelcome,
    showTour,
    startTour,
    dismissWelcome,
    completeTour,
    dismissTour,
    replayTour,
  };
}
