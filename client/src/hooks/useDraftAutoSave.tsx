import { useEffect, useRef, useState } from 'react';
import { useToast } from './use-toast';

interface DraftAutoSaveOptions<T> {
  key: string;
  data: T;
  enabled?: boolean;
  interval?: number; // milliseconds
  onSave?: (data: T) => void;
  onRestore?: (data: T) => void;
}

/**
 * Auto-save form data to localStorage with periodic saves
 */
export function useDraftAutoSave<T>({
  key,
  data,
  enabled = true,
  interval = 30000, // 30 seconds
  onSave,
  onRestore,
}: DraftAutoSaveOptions<T>) {
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const { toast } = useToast();
  const saveTimeoutRef = useRef<NodeJS.Timeout>();

  // Check for existing draft on mount
  useEffect(() => {
    if (!enabled) return;

    try {
      const stored = localStorage.getItem(`draft:${key}`);
      if (stored) {
        const draft = JSON.parse(stored);
        setHasDraft(true);
        onRestore?.(draft.data);
      }
    } catch (error) {
      console.error('Failed to restore draft:', error);
    }
  }, [key, enabled, onRestore]);

  // Auto-save on interval
  useEffect(() => {
    if (!enabled || !data) return;

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new timeout
    saveTimeoutRef.current = setTimeout(() => {
      saveDraft();
    }, interval);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [data, enabled, interval]);

  const saveDraft = () => {
    if (!enabled || !data) return;

    try {
      const draft = {
        data,
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(`draft:${key}`, JSON.stringify(draft));
      setLastSaved(new Date());
      setHasDraft(true);
      onSave?.(data);
    } catch (error) {
      console.error('Failed to save draft:', error);
      toast({
        title: 'Draft save failed',
        description: 'Unable to save your draft. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const restoreDraft = (): T | null => {
    try {
      const stored = localStorage.getItem(`draft:${key}`);
      if (stored) {
        const draft = JSON.parse(stored);
        return draft.data;
      }
    } catch (error) {
      console.error('Failed to restore draft:', error);
    }
    return null;
  };

  const discardDraft = () => {
    try {
      localStorage.removeItem(`draft:${key}`);
      setHasDraft(false);
      setLastSaved(null);
      toast({
        title: 'Draft discarded',
        description: 'Your draft has been removed.',
      });
    } catch (error) {
      console.error('Failed to discard draft:', error);
    }
  };

  const clearDraft = () => {
    try {
      localStorage.removeItem(`draft:${key}`);
      setHasDraft(false);
      setLastSaved(null);
    } catch (error) {
      console.error('Failed to clear draft:', error);
    }
  };

  return {
    saveDraft,
    restoreDraft,
    discardDraft,
    clearDraft,
    lastSaved,
    hasDraft,
  };
}

/**
 * Draft indicator component
 */
import { CheckCircle, Clock } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

interface DraftIndicatorProps {
  lastSaved: Date | null;
  onDiscard?: () => void;
}

export function DraftIndicator({ lastSaved, onDiscard }: DraftIndicatorProps) {
  if (!lastSaved) return null;

  const timeAgo = getTimeAgo(lastSaved);

  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <CheckCircle className="h-4 w-4 text-green-500" />
      <span>Draft saved {timeAgo}</span>
      {onDiscard && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onDiscard}
          className="h-6 px-2 text-xs"
        >
          Discard
        </Button>
      )}
    </div>
  );
}

export function DraftRestoreBanner({ onRestore, onDiscard }: { onRestore: () => void; onDiscard: () => void }) {
  return (
    <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 p-4 dark:border-blue-900 dark:bg-blue-950/20">
      <div className="flex items-start gap-3">
        <Clock className="h-5 w-5 text-blue-600 dark:text-blue-400" />
        <div className="flex-1">
          <h4 className="mb-1 font-medium text-blue-900 dark:text-blue-100">Draft Available</h4>
          <p className="mb-3 text-sm text-blue-700 dark:text-blue-300">
            You have an unsaved draft. Would you like to restore it?
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={onRestore}>
              Restore Draft
            </Button>
            <Button size="sm" variant="outline" onClick={onDiscard}>
              Discard
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}
