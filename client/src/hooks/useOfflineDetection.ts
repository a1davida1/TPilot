import { useState, useEffect, useCallback } from 'react';
import { useToast } from './use-toast';

interface QueuedAction {
  id: string;
  action: () => Promise<void>;
  timestamp: number;
}

/**
 * Detect offline/online status and queue actions for retry
 */
export function useOfflineDetection() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [queuedActions, setQueuedActions] = useState<QueuedAction[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast({
        title: 'Back online',
        description: 'Your connection has been restored.',
      });

      // Retry queued actions
      retryQueuedActions();
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast({
        title: 'You\'re offline',
        description: 'Changes will be saved locally and synced when you\'re back online.',
        variant: 'destructive',
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [toast]);

  const queueAction = useCallback((action: () => Promise<void>) => {
    const queuedAction: QueuedAction = {
      id: `${Date.now()}-${Math.random()}`,
      action,
      timestamp: Date.now(),
    };

    setQueuedActions((prev) => [...prev, queuedAction]);

    toast({
      title: 'Action queued',
      description: 'This action will be retried when you\'re back online.',
    });
  }, [toast]);

  const retryQueuedActions = useCallback(async () => {
    if (queuedActions.length === 0) return;

    const actions = [...queuedActions];
    setQueuedActions([]);

    for (const queuedAction of actions) {
      try {
        await queuedAction.action();
      } catch (error) {
        console.error('Failed to retry queued action:', error);
        // Re-queue if still failing
        setQueuedActions((prev) => [...prev, queuedAction]);
      }
    }

    if (queuedActions.length > 0) {
      toast({
        title: 'Some actions failed',
        description: `${queuedActions.length} action(s) will be retried later.`,
        variant: 'destructive',
      });
    }
  }, [queuedActions, toast]);

  return {
    isOnline,
    queuedActions,
    queueAction,
    retryQueuedActions,
  };
}

/**
 * Offline indicator banner component
 */
import { WifiOff, Wifi } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

export function OfflineBanner({ isOnline, queuedCount = 0 }: { isOnline: boolean; queuedCount?: number }) {
  if (isOnline) return null;

  return (
    <Alert variant="destructive" className="border-orange-500 bg-orange-50 dark:bg-orange-950/20">
      <WifiOff className="h-4 w-4" />
      <AlertTitle>You're Offline</AlertTitle>
      <AlertDescription>
        {queuedCount > 0
          ? `${queuedCount} action(s) queued. They'll be synced when you're back online.`
          : 'Your changes will be saved locally and synced when you\'re back online.'}
      </AlertDescription>
    </Alert>
  );
}

export function OnlineIndicator({ show }: { show: boolean }) {
  if (!show) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-5">
      <Alert className="border-green-500 bg-green-50 dark:bg-green-950/20">
        <Wifi className="h-4 w-4 text-green-600" />
        <AlertTitle className="text-green-900 dark:text-green-100">Back Online</AlertTitle>
        <AlertDescription className="text-green-700 dark:text-green-300">
          Your connection has been restored.
        </AlertDescription>
      </Alert>
    </div>
  );
}
