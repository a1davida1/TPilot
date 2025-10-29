import { useEffect, useRef } from 'react';

interface AriaLiveProps {
  message: string;
  priority?: 'polite' | 'assertive' | 'off';
  clearAfter?: number; // milliseconds
}

/**
 * ARIA Live Region for screen reader announcements
 * Use for dynamic content updates that should be announced
 */
export function AriaLive({ message, priority = 'polite', clearAfter = 5000 }: AriaLiveProps) {
  const timeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    if (clearAfter && message) {
      timeoutRef.current = setTimeout(() => {
        // Message will be cleared by parent component
      }, clearAfter);
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [message, clearAfter]);

  if (!message) return null;

  return (
    <div
      role="status"
      aria-live={priority}
      aria-atomic="true"
      className="sr-only"
    >
      {message}
    </div>
  );
}

/**
 * Hook for managing live region announcements
 */
import { useState, useCallback } from 'react';

export function useAriaLive() {
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<'polite' | 'assertive'>('polite');

  const announce = useCallback((text: string, level: 'polite' | 'assertive' = 'polite') => {
    setMessage(text);
    setPriority(level);

    // Clear after announcement
    setTimeout(() => {
      setMessage('');
    }, 5000);
  }, []);

  return {
    message,
    priority,
    announce,
    LiveRegion: () => <AriaLive message={message} priority={priority} />,
  };
}
