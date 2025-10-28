import React, { useState, useEffect } from 'react';
import { Sparkles, Loader2, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/lib/utils';

interface CaptionProgressProps {
  status: 'idle' | 'analyzing' | 'generating' | 'refining' | 'complete' | 'error';
  progress?: number;
  message?: string;
  error?: string;
  captions?: Array<{ text: string; style: string }>;
  onRetry?: () => void;
  onCancel?: () => void;
  className?: string;
}

const PROGRESS_STAGES = {
  idle: { min: 0, max: 0, label: 'Ready to generate' },
  analyzing: { min: 0, max: 30, label: 'Analyzing image...' },
  generating: { min: 30, max: 70, label: 'Creating captions...' },
  refining: { min: 70, max: 90, label: 'Refining suggestions...' },
  complete: { min: 100, max: 100, label: 'Complete!' },
  error: { min: 0, max: 0, label: 'Generation failed' }
};

export function CaptionProgress({
  status,
  progress: manualProgress,
  message,
  error,
  captions,
  onRetry,
  onCancel,
  className
}: CaptionProgressProps) {
  const [animatedProgress, setAnimatedProgress] = useState(0);
  const [currentTip, setCurrentTip] = useState(0);

  const tips = [
    "AI is analyzing your image composition...",
    "Detecting key elements and mood...",
    "Generating personalized captions...",
    "Optimizing for engagement...",
    "Adding the perfect touch of personality..."
  ];

  useEffect(() => {
    const stage = PROGRESS_STAGES[status];
    
    if (manualProgress !== undefined) {
      setAnimatedProgress(manualProgress);
    } else {
      // Auto-animate progress based on status
      const targetProgress = stage.min + (stage.max - stage.min) * 0.5;
      const interval = setInterval(() => {
        setAnimatedProgress(prev => {
          if (prev >= targetProgress) return targetProgress;
          return Math.min(prev + 1, targetProgress);
        });
      }, 50);
      return () => clearInterval(interval);
    }
  }, [status, manualProgress]);

  useEffect(() => {
    if (status === 'generating' || status === 'analyzing' || status === 'refining') {
      const interval = setInterval(() => {
        setCurrentTip((prev) => (prev + 1) % tips.length);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [status]);

  const getStatusIcon = () => {
    switch (status) {
      case 'analyzing':
      case 'generating':
      case 'refining':
        return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
      case 'complete':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'error':
        return <AlertCircle className="h-5 w-5 text-destructive" />;
      default:
        return <Sparkles className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const isProcessing = ['analyzing', 'generating', 'refining'].includes(status);

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <CardTitle className="text-lg">
              {message || PROGRESS_STAGES[status].label}
            </CardTitle>
          </div>
          {isProcessing && onCancel && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onCancel}
              className="h-8 px-2"
            >
              Cancel
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Progress Bar */}
        {isProcessing && (
          <div className="space-y-3">
            <Progress 
              value={animatedProgress} 
              className="h-2"
              aria-label={`Generation progress: ${animatedProgress}%`}
            />
            
            {/* Progress Details */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground animate-pulse">
                {tips[currentTip]}
              </span>
              <span className="text-muted-foreground font-medium">
                {Math.round(animatedProgress)}%
              </span>
            </div>

            {/* Stage Indicators */}
            <div className="flex items-center gap-2">
              {Object.entries(PROGRESS_STAGES).slice(1, -1).map(([key, stage]) => (
                <div
                  key={key}
                  className={cn(
                    "flex-1 text-center py-1 rounded-full text-xs transition-colors",
                    animatedProgress >= stage.min 
                      ? "bg-primary/10 text-primary" 
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {stage.label.replace('...', '')}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error State */}
        {status === 'error' && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="ml-2">
              {error || 'Failed to generate captions. Please try again.'}
            </AlertDescription>
          </Alert>
        )}

        {/* Retry Button */}
        {status === 'error' && onRetry && (
          <Button 
            onClick={onRetry} 
            variant="outline" 
            className="w-full"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        )}

        {/* Success State with Captions Preview */}
        {status === 'complete' && captions && captions.length > 0 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm font-medium">
                Generated {captions.length} captions!
              </span>
            </div>
            
            {/* Caption Previews */}
            <div className="space-y-2">
              {captions.slice(0, 2).map((caption, index) => (
                <div 
                  key={index}
                  className="p-3 rounded-lg bg-muted/50 border"
                >
                  <p className="text-sm line-clamp-2">{caption.text}</p>
                  <span className="text-xs text-muted-foreground mt-1">
                    {caption.style}
                  </span>
                </div>
              ))}
              {captions.length > 2 && (
                <p className="text-xs text-muted-foreground text-center">
                  +{captions.length - 2} more captions
                </p>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Inline caption generation indicator (for buttons/forms)
export function InlineCaptionProgress({ 
  isGenerating = false,
  message = "Generating captions..."
}: {
  isGenerating?: boolean;
  message?: string;
}) {
  if (!isGenerating) return null;

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>{message}</span>
    </div>
  );
}
