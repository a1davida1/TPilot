import React from 'react';
import { 
  AlertCircle, 
  WifiOff, 
  ServerCrash, 
  Clock, 
  ShieldAlert,
  FileX,
  UserX,
  CreditCard,
  RefreshCw,
  Home,
  HelpCircle,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

export interface FriendlyErrorProps {
  error: Error | string | unknown;
  variant?: 'inline' | 'card' | 'fullscreen';
  showDetails?: boolean;
  onRetry?: () => void;
  onGoHome?: () => void;
  onContactSupport?: () => void;
  className?: string;
}

// Map common error types to user-friendly messages
const ERROR_MESSAGES: Record<string, {
  title: string;
  message: string;
  icon: React.ElementType;
  actions?: string[];
}> = {
  // Network errors
  'NETWORK_ERROR': {
    title: 'Connection Problem',
    message: "We're having trouble connecting to our servers. Please check your internet connection and try again.",
    icon: WifiOff,
    actions: ['retry', 'home']
  },
  'TIMEOUT': {
    title: 'Request Timed Out',
    message: "This is taking longer than expected. The server might be busy. Please try again in a moment.",
    icon: Clock,
    actions: ['retry']
  },
  
  // Auth errors
  'UNAUTHORIZED': {
    title: 'Authentication Required',
    message: "You need to sign in to access this feature. Please log in and try again.",
    icon: UserX,
    actions: ['login', 'home']
  },
  'FORBIDDEN': {
    title: 'Access Denied',
    message: "You don't have permission to access this resource. Contact support if you believe this is an error.",
    icon: ShieldAlert,
    actions: ['support', 'home']
  },
  
  // Upload errors
  'FILE_TOO_LARGE': {
    title: 'File Too Large',
    message: "The file you're trying to upload exceeds the maximum size limit of 10MB. Please choose a smaller file.",
    icon: FileX,
    actions: ['retry']
  },
  'INVALID_FILE_TYPE': {
    title: 'Invalid File Type',
    message: "Only image files (JPG, PNG, GIF, WebP) are supported. Please choose a different file.",
    icon: FileX,
    actions: ['retry']
  },
  
  // Payment errors
  'PAYMENT_REQUIRED': {
    title: 'Subscription Required',
    message: "This feature requires an active subscription. Upgrade your plan to continue.",
    icon: CreditCard,
    actions: ['upgrade', 'home']
  },
  'PAYMENT_FAILED': {
    title: 'Payment Failed',
    message: "We couldn't process your payment. Please check your payment details and try again.",
    icon: CreditCard,
    actions: ['retry', 'support']
  },
  
  // API errors
  'RATE_LIMIT': {
    title: 'Too Many Requests',
    message: "You've made too many requests. Please wait a moment before trying again.",
    icon: Clock,
    actions: ['retry']
  },
  'SERVER_ERROR': {
    title: 'Server Error',
    message: "Something went wrong on our end. Our team has been notified. Please try again later.",
    icon: ServerCrash,
    actions: ['retry', 'home', 'support']
  },
  
  // Generation errors
  'GENERATION_FAILED': {
    title: 'Generation Failed',
    message: "We couldn't generate captions for your image. This might be due to image quality or content. Try a different image.",
    icon: AlertCircle,
    actions: ['retry', 'support']
  },
  'NSFW_BLOCKED': {
    title: 'Content Blocked',
    message: "The content appears to violate our guidelines. Please review our content policy and try again.",
    icon: ShieldAlert,
    actions: ['home']
  },
  
  // Default
  'UNKNOWN': {
    title: 'Something Went Wrong',
    message: "An unexpected error occurred. Please try again or contact support if the problem persists.",
    icon: AlertCircle,
    actions: ['retry', 'home', 'support']
  }
};

// Parse error to determine type
function getErrorInfo(error: Error | string | unknown) {
  let errorCode = 'UNKNOWN';
  let technicalDetails = '';
  
  if (typeof error === 'string') {
    technicalDetails = error;
    // Try to match common error patterns
    if (error.includes('Network') || error.includes('fetch')) errorCode = 'NETWORK_ERROR';
    else if (error.includes('401') || error.includes('Unauthorized')) errorCode = 'UNAUTHORIZED';
    else if (error.includes('403') || error.includes('Forbidden')) errorCode = 'FORBIDDEN';
    else if (error.includes('413') || error.includes('too large')) errorCode = 'FILE_TOO_LARGE';
    else if (error.includes('429') || error.includes('rate limit')) errorCode = 'RATE_LIMIT';
    else if (error.includes('500') || error.includes('Internal')) errorCode = 'SERVER_ERROR';
    else if (error.includes('timeout')) errorCode = 'TIMEOUT';
  } else if (error instanceof Error) {
    technicalDetails = error.message;
    const errorName = error.name.toUpperCase();
    
    // Check for specific error types
    if (errorName.includes('NETWORK')) errorCode = 'NETWORK_ERROR';
    else if (errorName.includes('TIMEOUT')) errorCode = 'TIMEOUT';
    else if (error.message.includes('401')) errorCode = 'UNAUTHORIZED';
    else if (error.message.includes('403')) errorCode = 'FORBIDDEN';
    else if (error.message.includes('payment')) errorCode = 'PAYMENT_REQUIRED';
    
    // Check for custom error codes
    if ('code' in error && typeof error.code === 'string') {
      errorCode = error.code;
    }
  }
  
  return {
    errorCode,
    technicalDetails,
    ...ERROR_MESSAGES[errorCode] || ERROR_MESSAGES.UNKNOWN
  };
}

export function FriendlyError({
  error,
  variant = 'card',
  showDetails = false,
  onRetry,
  onGoHome,
  onContactSupport,
  className
}: FriendlyErrorProps) {
  const [detailsOpen, setDetailsOpen] = React.useState(false);
  const errorInfo = getErrorInfo(error);
  const Icon = errorInfo.icon;

  // Inline variant (for forms/small spaces)
  if (variant === 'inline') {
    return (
      <Alert variant="destructive" className={cn('mb-4', className)}>
        <Icon className="h-4 w-4" />
        <AlertTitle>{errorInfo.title}</AlertTitle>
        <AlertDescription>
          {errorInfo.message}
          {onRetry && (
            <Button
              size="sm"
              variant="outline"
              onClick={onRetry}
              className="mt-2 h-7"
            >
              Try Again
            </Button>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  // Full screen variant (for page errors)
  if (variant === 'fullscreen') {
    return (
      <div className={cn('min-h-[60vh] flex items-center justify-center p-4', className)}>
        <div className="max-w-md w-full space-y-4 text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
            <Icon className="h-8 w-8 text-destructive" />
          </div>
          
          <div>
            <h1 className="text-2xl font-bold mb-2">{errorInfo.title}</h1>
            <p className="text-muted-foreground">{errorInfo.message}</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            {errorInfo.actions?.includes('retry') && onRetry && (
              <Button onClick={onRetry} size="lg">
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
            )}
            {errorInfo.actions?.includes('home') && onGoHome && (
              <Button onClick={onGoHome} variant="outline" size="lg">
                <Home className="mr-2 h-4 w-4" />
                Go Home
              </Button>
            )}
            {errorInfo.actions?.includes('support') && onContactSupport && (
              <Button onClick={onContactSupport} variant="outline" size="lg">
                <HelpCircle className="mr-2 h-4 w-4" />
                Get Help
              </Button>
            )}
          </div>

          {showDetails && (
            <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="mt-4">
                  {detailsOpen ? (
                    <>
                      <ChevronUp className="mr-2 h-4 w-4" />
                      Hide Details
                    </>
                  ) : (
                    <>
                      <ChevronDown className="mr-2 h-4 w-4" />
                      Show Details
                    </>
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="mt-4 p-4 rounded-lg bg-muted text-left">
                  <p className="text-xs font-mono break-all">
                    {errorInfo.technicalDetails}
                  </p>
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      </div>
    );
  }

  // Card variant (default)
  return (
    <Card className={cn('border-destructive/50', className)}>
      <CardHeader>
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-destructive/10">
            <Icon className="h-5 w-5 text-destructive" />
          </div>
          <div className="flex-1">
            <CardTitle className="text-lg">{errorInfo.title}</CardTitle>
            <CardDescription className="mt-1">
              {errorInfo.message}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {errorInfo.actions?.includes('retry') && onRetry && (
            <Button onClick={onRetry} size="sm">
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </Button>
          )}
          {errorInfo.actions?.includes('home') && onGoHome && (
            <Button onClick={onGoHome} variant="outline" size="sm">
              <Home className="mr-2 h-4 w-4" />
              Go Home
            </Button>
          )}
          {errorInfo.actions?.includes('support') && onContactSupport && (
            <Button onClick={onContactSupport} variant="outline" size="sm">
              <HelpCircle className="mr-2 h-4 w-4" />
              Contact Support
            </Button>
          )}
        </div>

        {showDetails && (
          <Collapsible open={detailsOpen} onOpenChange={setDetailsOpen} className="mt-4">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 text-xs">
                {detailsOpen ? (
                  <>Hide Details</>
                ) : (
                  <>Show Technical Details</>
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="mt-2 p-3 rounded-md bg-muted">
                <code className="text-xs break-all">
                  {errorInfo.technicalDetails}
                </code>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </CardContent>
    </Card>
  );
}

// Hook for easy error handling
export function useErrorHandler() {
  const [error, setError] = React.useState<Error | null>(null);
  
  const handleError = React.useCallback((error: unknown) => {
    console.error('Error handled:', error);
    
    if (error instanceof Error) {
      setError(error);
    } else {
      setError(new Error(String(error)));
    }
  }, []);
  
  const clearError = React.useCallback(() => {
    setError(null);
  }, []);
  
  return { error, handleError, clearError };
}
