import { AlertTriangle, RefreshCw, WifiOff, ServerCrash, ShieldAlert } from 'lucide-react';
import { Button } from './button';
import { Alert, AlertDescription, AlertTitle } from './alert';
import { Card, CardContent } from './card';
import { cn } from '@/lib/utils';

interface ErrorStateProps {
  title?: string;
  message: string;
  error?: Error | unknown;
  onRetry?: () => void;
  retrying?: boolean;
  recoveryInstructions?: string[];
  variant?: 'inline' | 'card' | 'page';
  className?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  error,
  onRetry,
  retrying = false,
  recoveryInstructions,
  variant = 'card',
  className,
}: ErrorStateProps) {
  const errorMessage = error instanceof Error ? error.message : message;

  if (variant === 'inline') {
    return (
      <Alert variant="destructive" className={className}>
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription className="mt-2">
          <p>{errorMessage}</p>
          {onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              disabled={retrying}
              className="mt-3"
            >
              {retrying ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Retrying...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Try Again
                </>
              )}
            </Button>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  const content = (
    <div className="flex flex-col items-center justify-center text-center p-8">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
        <AlertTriangle className="h-8 w-8 text-red-600 dark:text-red-400" />
      </div>

      <h3 className="mb-2 text-lg font-semibold">{title}</h3>
      <p className="mb-4 max-w-md text-sm text-muted-foreground">{errorMessage}</p>

      {recoveryInstructions && recoveryInstructions.length > 0 && (
        <div className="mb-4 w-full max-w-md rounded-lg bg-muted p-4 text-left">
          <p className="mb-2 text-sm font-medium">Try these steps:</p>
          <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
            {recoveryInstructions.map((instruction, index) => (
              <li key={index}>{instruction}</li>
            ))}
          </ol>
        </div>
      )}

      {onRetry && (
        <Button onClick={onRetry} disabled={retrying}>
          {retrying ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Retrying...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </>
          )}
        </Button>
      )}
    </div>
  );

  if (variant === 'page') {
    return <div className={cn('min-h-[400px] flex items-center justify-center', className)}>{content}</div>;
  }

  return (
    <Card className={cn('border-red-200 dark:border-red-900', className)}>
      <CardContent className="p-0">{content}</CardContent>
    </Card>
  );
}

// Specific error states
export function NetworkErrorState({ onRetry, retrying }: { onRetry: () => void; retrying?: boolean }) {
  return (
    <ErrorState
      title="Connection Error"
      message="Unable to connect to the server. Please check your internet connection."
      onRetry={onRetry}
      retrying={retrying}
      recoveryInstructions={[
        'Check your internet connection',
        'Try refreshing the page',
        'Wait a moment and try again',
      ]}
    />
  );
}

export function ServerErrorState({ onRetry, retrying }: { onRetry: () => void; retrying?: boolean }) {
  return (
    <Card className="border-red-200 dark:border-red-900">
      <CardContent className="flex flex-col items-center justify-center p-8 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/20">
          <ServerCrash className="h-8 w-8 text-red-600 dark:text-red-400" />
        </div>
        <h3 className="mb-2 text-lg font-semibold">Server Error</h3>
        <p className="mb-4 max-w-md text-sm text-muted-foreground">
          Our servers are experiencing issues. We're working on it!
        </p>
        <Button onClick={onRetry} disabled={retrying}>
          {retrying ? (
            <>
              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
              Retrying...
            </>
          ) : (
            <>
              <RefreshCw className="mr-2 h-4 w-4" />
              Try Again
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

export function OfflineState() {
  return (
    <Alert variant="destructive" className="border-orange-500 bg-orange-50 dark:bg-orange-950/20">
      <WifiOff className="h-4 w-4" />
      <AlertTitle>You're Offline</AlertTitle>
      <AlertDescription>
        Your changes will be saved locally and synced when you're back online.
      </AlertDescription>
    </Alert>
  );
}

export function PermissionErrorState({ onUpgrade }: { onUpgrade?: () => void }) {
  return (
    <Card className="border-orange-200 dark:border-orange-900">
      <CardContent className="flex flex-col items-center justify-center p-8 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/20">
          <ShieldAlert className="h-8 w-8 text-orange-600 dark:text-orange-400" />
        </div>
        <h3 className="mb-2 text-lg font-semibold">Permission Required</h3>
        <p className="mb-4 max-w-md text-sm text-muted-foreground">
          This feature requires a Pro or Premium subscription.
        </p>
        {onUpgrade && (
          <Button onClick={onUpgrade} className="bg-orange-600 hover:bg-orange-700">
            Upgrade Now
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
