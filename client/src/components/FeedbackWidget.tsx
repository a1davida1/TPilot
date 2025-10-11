import { useState } from 'react';
import { MessageSquare, X, Send, Bug, Lightbulb, Heart, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { useMutation } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';

type FeedbackType = 'bug' | 'feature' | 'general' | 'praise';

interface FeedbackData {
  type: FeedbackType;
  message: string;
  userEmail?: string;
  userId?: number;
  url: string;
  userAgent: string;
}

export function FeedbackWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState<FeedbackType>('general');
  const [message, setMessage] = useState('');
  const { toast } = useToast();
  const { user } = useAuth();

  const submitFeedback = useMutation({
    mutationFn: async (data: FeedbackData) => {
      return apiRequest('POST', '/api/feedback', data);
    },
    onSuccess: () => {
      toast({
        title: 'Thank you for your feedback!',
        description: 'We appreciate you helping us improve ThottoPilot.',
      });
      setMessage('');
      setIsOpen(false);
    },
    onError: () => {
      toast({
        title: 'Failed to send feedback',
        description: 'Please try again or email support@thottopilot.com',
        variant: 'destructive',
      });
    },
  });

  const handleSubmit = () => {
    if (!message.trim()) {
      toast({
        title: 'Please enter your feedback',
        description: 'We need to know what you\'re thinking!',
        variant: 'destructive',
      });
      return;
    }

    const feedbackData: FeedbackData = {
      type: feedbackType,
      message: message.trim(),
      userEmail: user?.email || undefined,
      userId: user?.id || undefined,
      url: window.location.href,
      userAgent: navigator.userAgent,
    };

    submitFeedback.mutate(feedbackData);
  };

  const getFeedbackIcon = () => {
    switch (feedbackType) {
      case 'bug':
        return <Bug className="h-4 w-4" />;
      case 'feature':
        return <Lightbulb className="h-4 w-4" />;
      case 'praise':
        return <Heart className="h-4 w-4" />;
      default:
        return <MessageSquare className="h-4 w-4" />;
    }
  };

  const getFeedbackColor = () => {
    switch (feedbackType) {
      case 'bug':
        return 'text-red-500';
      case 'feature':
        return 'text-blue-500';
      case 'praise':
        return 'text-pink-500';
      default:
        return 'text-purple-500';
    }
  };

  return (
    <>
      {/* Floating Feedback Button */}
      <div className="fixed bottom-6 right-6 z-50">
        {!isOpen && (
          <Button
            onClick={() => setIsOpen(true)}
            className="rounded-full h-14 w-14 shadow-lg bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
            aria-label="Open feedback form"
          >
            <MessageSquare className="h-6 w-6" />
          </Button>
        )}
      </div>

      {/* Feedback Modal */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5">
          <Card className="w-96 shadow-2xl border-purple-200 dark:border-purple-800">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <span className={cn('transition-colors', getFeedbackColor())}>
                    {getFeedbackIcon()}
                  </span>
                  Send Feedback
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsOpen(false)}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <CardDescription>
                Help us improve ThottoPilot - we read everything!
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Feedback Type Selection */}
              <div className="space-y-2">
                <Label>What's on your mind?</Label>
                <RadioGroup
                  value={feedbackType}
                  onValueChange={(value) => setFeedbackType(value as FeedbackType)}
                  className="grid grid-cols-2 gap-2"
                >
                  <div className="flex items-center space-x-2 border rounded-lg p-2 hover:bg-accent cursor-pointer">
                    <RadioGroupItem value="bug" id="bug" />
                    <Label htmlFor="bug" className="flex items-center gap-1 cursor-pointer">
                      <Bug className="h-3 w-3 text-red-500" />
                      Bug Report
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 border rounded-lg p-2 hover:bg-accent cursor-pointer">
                    <RadioGroupItem value="feature" id="feature" />
                    <Label htmlFor="feature" className="flex items-center gap-1 cursor-pointer">
                      <Lightbulb className="h-3 w-3 text-blue-500" />
                      Feature Idea
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 border rounded-lg p-2 hover:bg-accent cursor-pointer">
                    <RadioGroupItem value="general" id="general" />
                    <Label htmlFor="general" className="flex items-center gap-1 cursor-pointer">
                      <MessageSquare className="h-3 w-3 text-purple-500" />
                      General
                    </Label>
                  </div>
                  <div className="flex items-center space-x-2 border rounded-lg p-2 hover:bg-accent cursor-pointer">
                    <RadioGroupItem value="praise" id="praise" />
                    <Label htmlFor="praise" className="flex items-center gap-1 cursor-pointer">
                      <Heart className="h-3 w-3 text-pink-500" />
                      Praise
                    </Label>
                  </div>
                </RadioGroup>
              </div>

              {/* Feedback Message */}
              <div className="space-y-2">
                <Label htmlFor="feedback-message">
                  {feedbackType === 'bug' && "Describe the issue you're experiencing"}
                  {feedbackType === 'feature' && "What feature would you like to see?"}
                  {feedbackType === 'praise' && "What do you love about ThottoPilot?"}
                  {feedbackType === 'general' && "Share your thoughts"}
                </Label>
                <Textarea
                  id="feedback-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder={
                    feedbackType === 'bug' 
                      ? "Steps to reproduce the issue..."
                      : feedbackType === 'feature'
                      ? "It would be great if..."
                      : feedbackType === 'praise'
                      ? "I really love how..."
                      : "Your feedback here..."
                  }
                  className="min-h-[120px] resize-none"
                  maxLength={1000}
                />
                <p className="text-xs text-muted-foreground text-right">
                  {message.length}/1000
                </p>
              </div>

              {/* Beta Notice */}
              <div className="flex items-start gap-2 p-2 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg">
                <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-500 mt-0.5" />
                <p className="text-xs text-yellow-700 dark:text-yellow-400">
                  <strong>Beta Notice:</strong> Your feedback directly shapes ThottoPilot's development. 
                  We typically respond within 24 hours.
                </p>
              </div>

              {/* Submit Button */}
              <Button
                onClick={handleSubmit}
                disabled={submitFeedback.isPending || !message.trim()}
                className="w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white"
              >
                {submitFeedback.isPending ? (
                  <>
                    <Send className="h-4 w-4 mr-2 animate-pulse" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-2" />
                    Send Feedback
                  </>
                )}
              </Button>

              {/* Alternative Contact */}
              <p className="text-xs text-center text-muted-foreground">
                Need immediate help? Email{' '}
                <a href="mailto:support@thottopilot.com" className="text-primary hover:underline">
                  support@thottopilot.com
                </a>
              </p>
            </CardContent>
          </Card>
        </div>
      )}
    </>
  );
}
