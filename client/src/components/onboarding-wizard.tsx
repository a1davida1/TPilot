import { useState } from 'react';
// import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronRight, 
  ChevronLeft, 
  Check, 
  Sparkles, 
  Link2, 
  Palette, 
  Rocket,
  Users,
  Shield,
  MessageSquare,
  Image
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Progress } from '@/components/ui/progress';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  component: React.ReactNode;
  isComplete: boolean;
}

interface OnboardingWizardProps {
  onComplete: (preferences: UserPreferences) => void;
  onSkip?: () => void;
}

interface UserPreferences {
  contentType: 'sfw' | 'nsfw' | 'both';
  platforms: string[];
  aiStyle: string;
  aiTone: string;
  protectionLevel: string;
}

interface StepProps {
  preferences: UserPreferences;
  setPreferences: React.Dispatch<React.SetStateAction<UserPreferences>>;
}

export function OnboardingWizard({ onComplete, onSkip }: OnboardingWizardProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [preferences, setPreferences] = useState<UserPreferences>({
    contentType: 'both',
    platforms: [],
    aiStyle: 'playful',
    aiTone: 'friendly',
    protectionLevel: 'standard'
  });
  // TODO: Implement step completion tracking
  const [_completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());
  const { toast } = useToast();

  const steps: OnboardingStep[] = [
    {
      id: 'welcome',
      title: 'Welcome to ThottoPilot! 🚀',
      description: 'Let\'s get you set up in just a few steps',
      icon: <Sparkles className="h-6 w-6" />,
      component: <WelcomeStep preferences={preferences} setPreferences={setPreferences} />,
      isComplete: preferences.contentType !== null
    },
    {
      id: 'platforms',
      title: 'Connect Your Platforms',
      description: 'Choose where you want to share your content',
      icon: <Link2 className="h-6 w-6" />,
      component: <PlatformStep preferences={preferences} setPreferences={setPreferences} />,
      isComplete: preferences.platforms.length > 0
    },
    {
      id: 'ai-setup',
      title: 'Customize Your AI Assistant',
      description: 'Set your preferred tone and style',
      icon: <Palette className="h-6 w-6" />,
      component: <AISetupStep preferences={preferences} setPreferences={setPreferences} />,
      isComplete: preferences.aiStyle !== null && preferences.aiTone !== null
    },
    {
      id: 'tutorial',
      title: 'Quick Tutorial',
      description: 'Learn the basics in 30 seconds',
      icon: <Rocket className="h-6 w-6" />,
      component: <TutorialStep />,
      isComplete: true
    }
  ];

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCompletedSteps(prev => new Set([...prev, currentStep]));
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    toast({
      title: "Setup Complete! 🎉",
      description: "You're all set to start creating amazing content",
    });
    onComplete(preferences);
  };

  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-gray-900 dark:to-gray-800">
      <Card className="w-full max-w-4xl shadow-2xl">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              {steps[currentStep].icon}
              <div>
                <CardTitle>{steps[currentStep].title}</CardTitle>
                <CardDescription>{steps[currentStep].description}</CardDescription>
              </div>
            </div>
            {onSkip && (
              <Button variant="ghost" size="sm" onClick={onSkip}>
                Skip Setup
              </Button>
            )}
          </div>
          <Progress value={progress} className="h-2" />
          <div className="flex gap-1 mt-2">
            {steps.map((step, index) => (
              <div
                key={step.id}
                className={`flex-1 h-1 rounded-full transition-colors ${
                  index <= currentStep ? 'bg-primary' : 'bg-gray-200 dark:bg-gray-700'
                }`}
              />
            ))}
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div key={currentStep}>
            {steps[currentStep].component}
          </div>

          <div className="flex justify-between mt-8">
            <Button
              variant="outline"
              onClick={handleBack}
              disabled={currentStep === 0}
            >
              <ChevronLeft className="h-4 w-4 mr-2" />
              Back
            </Button>
            <Button
              onClick={handleNext}
              disabled={!steps[currentStep].isComplete}
            >
              {currentStep === steps.length - 1 ? (
                <>
                  Complete Setup
                  <Check className="h-4 w-4 ml-2" />
                </>
              ) : (
                <>
                  Next
                  <ChevronRight className="h-4 w-4 ml-2" />
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Step 1: Welcome & Content Type
function WelcomeStep({ preferences, setPreferences }: StepProps) {
  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold mb-2">What type of content will you create?</h2>
        <p className="text-muted-foreground">This helps us customize your experience</p>
      </div>
      
      <RadioGroup
        value={preferences.contentType}
        onValueChange={(value) => setPreferences({ ...preferences, contentType: value as "sfw" | "nsfw" | "both" })}
      >
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <label htmlFor="sfw" className="cursor-pointer">
            <Card className={`p-4 hover:shadow-md transition-all ${
              preferences.contentType === 'sfw' ? 'ring-2 ring-primary' : ''
            }`}>
              <RadioGroupItem value="sfw" id="sfw" className="sr-only" />
              <div className="flex flex-col items-center text-center space-y-2">
                <Users className="h-8 w-8 text-blue-500" />
                <h3 className="font-semibold">Safe for Work</h3>
                <p className="text-sm text-muted-foreground">
                  Professional content, lifestyle, fashion
                </p>
              </div>
            </Card>
          </label>
          
          <label htmlFor="nsfw" className="cursor-pointer">
            <Card className={`p-4 hover:shadow-md transition-all ${
              preferences.contentType === 'nsfw' ? 'ring-2 ring-primary' : ''
            }`}>
              <RadioGroupItem value="nsfw" id="nsfw" className="sr-only" />
              <div className="flex flex-col items-center text-center space-y-2">
                <Shield className="h-8 w-8 text-pink-500" />
                <h3 className="font-semibold">Adult Content</h3>
                <p className="text-sm text-muted-foreground">
                  18+ content with privacy protection
                </p>
              </div>
            </Card>
          </label>
          
          <label htmlFor="both" className="cursor-pointer">
            <Card className={`p-4 hover:shadow-md transition-all ${
              preferences.contentType === 'both' ? 'ring-2 ring-primary' : ''
            }`}>
              <RadioGroupItem value="both" id="both" className="sr-only" />
              <div className="flex flex-col items-center text-center space-y-2">
                <Sparkles className="h-8 w-8 text-purple-500" />
                <h3 className="font-semibold">Mixed Content</h3>
                <p className="text-sm text-muted-foreground">
                  Both types with smart categorization
                </p>
              </div>
            </Card>
          </label>
        </div>
      </RadioGroup>
    </div>
  );
}

// Step 2: Platform Selection
function PlatformStep({ preferences, setPreferences }: StepProps) {
  const platforms = [
    { id: 'reddit', name: 'Reddit', icon: '🔥', description: 'Communities & discussions' },
    { id: 'twitter', name: 'Twitter/X', icon: '🐦', description: 'Quick updates & threads' },
    { id: 'instagram', name: 'Instagram', icon: '📸', description: 'Visual content & stories' },
    { id: 'onlyfans', name: 'OnlyFans', icon: '💎', description: 'Premium content' },
    { id: 'fansly', name: 'Fansly', icon: '⭐', description: 'Subscription content' },
    { id: 'tiktok', name: 'TikTok', icon: '🎵', description: 'Short-form videos' }
  ];

  const togglePlatform = (platformId: string) => {
    const newPlatforms = preferences.platforms.includes(platformId)
      ? preferences.platforms.filter((p: string) => p !== platformId)
      : [...preferences.platforms, platformId];
    setPreferences({ ...preferences, platforms: newPlatforms });
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold mb-2">Where do you share content?</h2>
        <p className="text-muted-foreground">Select all platforms you use (you can add more later)</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {platforms.map(platform => (
          <Card
            key={platform.id}
            className={`p-4 cursor-pointer hover:shadow-md transition-all ${
              preferences.platforms.includes(platform.id) ? 'ring-2 ring-primary' : ''
            }`}
            onClick={() => togglePlatform(platform.id)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{platform.icon}</span>
                <div>
                  <h3 className="font-semibold">{platform.name}</h3>
                  <p className="text-sm text-muted-foreground">{platform.description}</p>
                </div>
              </div>
              <Checkbox
                checked={preferences.platforms.includes(platform.id)}
                onCheckedChange={() => togglePlatform(platform.id)}
              />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

// Step 3: AI Setup
function AISetupStep({ preferences, setPreferences }: StepProps) {
  const styles = [
    { id: 'playful', name: 'Playful & Fun', example: 'Hey babes! 💕 Check out this cutie moment!' },
    { id: 'professional', name: 'Professional', example: 'Excited to share this exclusive content with you.' },
    { id: 'mysterious', name: 'Mysterious', example: 'You won\'t believe what happens next...' },
    { id: 'bold', name: 'Bold & Confident', example: 'Ready to blow your mind? Let\'s go! 🔥' }
  ];

  const tones = [
    { id: 'friendly', name: 'Friendly', icon: '😊' },
    { id: 'flirty', name: 'Flirty', icon: '😉' },
    { id: 'casual', name: 'Casual', icon: '👋' },
    { id: 'exclusive', name: 'Exclusive', icon: '✨' }
  ];

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold mb-2">Customize Your AI Assistant</h2>
        <p className="text-muted-foreground">Choose how you want your content to sound</p>
      </div>
      
      <div>
        <h3 className="font-semibold mb-3">Writing Style</h3>
        <RadioGroup
          value={preferences.aiStyle}
          onValueChange={(value) => setPreferences({ ...preferences, aiStyle: value })}
        >
          <div className="space-y-3">
            {styles.map(style => (
              <label key={style.id} htmlFor={style.id} className="cursor-pointer">
                <Card className={`p-4 hover:shadow-md transition-all ${
                  preferences.aiStyle === style.id ? 'ring-2 ring-primary' : ''
                }`}>
                  <RadioGroupItem value={style.id} id={style.id} className="sr-only" />
                  <div>
                    <h4 className="font-semibold mb-1">{style.name}</h4>
                    <p className="text-sm text-muted-foreground italic">"{style.example}"</p>
                  </div>
                </Card>
              </label>
            ))}
          </div>
        </RadioGroup>
      </div>

      <div>
        <h3 className="font-semibold mb-3">Tone</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {tones.map(tone => (
            <Button
              key={tone.id}
              variant={preferences.aiTone === tone.id ? 'default' : 'outline'}
              onClick={() => setPreferences({ ...preferences, aiTone: tone.id })}
              className="h-auto py-3"
            >
              <span className="mr-2">{tone.icon}</span>
              {tone.name}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Step 4: Tutorial
function TutorialStep() {
  const features = [
    {
      icon: <MessageSquare className="h-6 w-6 text-blue-500" />,
      title: 'Generate Captions',
      description: 'Click "New Post" and our AI will create engaging captions instantly'
    },
    {
      icon: <Image className="h-6 w-6 text-green-500" />,
      title: 'Protect Images',
      description: 'Upload photos and apply protection to prevent reverse image searches'
    },
    {
      icon: <Rocket className="h-6 w-6 text-purple-500" />,
      title: 'Schedule Posts',
      description: 'Queue content across all platforms with optimal timing suggestions'
    }
  ];

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <h2 className="text-2xl font-bold mb-2">You're All Set! 🎉</h2>
        <p className="text-muted-foreground">Here's how to get started</p>
      </div>
      
      <div className="space-y-4">
        {features.map((feature, index) => (
          <div key={index}>
            <Card className="p-4">
              <div className="flex gap-4">
                <div className="flex-shrink-0">{feature.icon}</div>
                <div>
                  <h3 className="font-semibold mb-1">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.description}</p>
                </div>
              </div>
            </Card>
          </div>
        ))}
      </div>

      <div className="bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900 dark:to-pink-900 rounded-lg p-4 text-center">
        <p className="font-semibold mb-2">Pro Tip 💡</p>
        <p className="text-sm">Start with a test post to see how everything works. You can always delete it later!</p>
      </div>
    </div>
  );
}