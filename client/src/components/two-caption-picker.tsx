/**
 * Two-Caption Picker Component
 * Displays Flirty and Slutty caption options with keyboard shortcuts and auto-select
 */

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw } from 'lucide-react';

export interface Caption {
  id: string;
  text: string;
  style: 'flirty' | 'slutty';
}

interface TwoCaptionPickerProps {
  captions: [Caption, Caption];
  onSelect: (caption: Caption, metadata: { timeToChoice: number; autoSelected: boolean; edited: boolean }) => void;
  onRegenerate?: () => void;
  autoSelectTimeout?: number;
  className?: string;
}

export function TwoCaptionPicker({
  captions,
  onSelect,
  onRegenerate,
  autoSelectTimeout = 6000,
  className = ''
}: TwoCaptionPickerProps) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [timeRemaining, setTimeRemaining] = useState(autoSelectTimeout);
  const [startTime] = useState(Date.now());
  const [editedText, setEditedText] = useState<Record<string, string>>({});

  useEffect(() => {
    // Auto-select timer
    const interval = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 100) {
          // Auto-select the first caption (Flirty) after timeout
          handleSelect(0, true);
          return 0;
        }
        return prev - 100;
      });
    }, 100);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Keyboard shortcuts
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === '1') {
        handleSelect(0, false);
      } else if (e.key === '2') {
        handleSelect(1, false);
      } else if (e.key === 'Enter' && selectedIndex !== null) {
        confirmSelection();
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [selectedIndex, editedText]);

  const handleSelect = (index: number, autoSelected: boolean) => {
    setSelectedIndex(index);
    if (autoSelected) {
      confirmSelection(index, autoSelected);
    }
  };

  const confirmSelection = (index: number = selectedIndex ?? 0, autoSelected: boolean = false) => {
    if (index === null) return;

    const caption = captions[index];
    const timeToChoice = Date.now() - startTime;
    const edited = editedText[caption.id] !== undefined && editedText[caption.id] !== caption.text;

    const finalCaption = edited
      ? { ...caption, text: editedText[caption.id] }
      : caption;

    onSelect(finalCaption, {
      timeToChoice,
      autoSelected,
      edited
    });
  };

  const handleEdit = (captionId: string, newText: string) => {
    setEditedText((prev) => ({ ...prev, [captionId]: newText }));
  };

  const progressPercentage = ((autoSelectTimeout - timeRemaining) / autoSelectTimeout) * 100;

  return (
    <div className={`space-y-4 ${className}`}>
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Pick your vibe</h3>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">
            Auto-selecting in {Math.ceil(timeRemaining / 1000)}s
          </span>
          {onRegenerate && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRegenerate}
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Regenerate
            </Button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-1 bg-secondary rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all duration-100"
          style={{ width: `${progressPercentage}%` }}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {captions.map((caption, index) => (
          <Card
            key={caption.id}
            className={`cursor-pointer transition-all ${
              selectedIndex === index
                ? 'ring-2 ring-primary shadow-lg'
                : 'hover:shadow-md'
            }`}
            onClick={() => handleSelect(index, false)}
          >
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Badge
                  variant={caption.style === 'flirty' ? 'secondary' : 'default'}
                  className="capitalize"
                >
                  {caption.style}
                </Badge>
                <kbd className="px-2 py-1 text-xs border rounded bg-muted">
                  {index + 1}
                </kbd>
              </div>

              <textarea
                value={editedText[caption.id] ?? caption.text}
                onChange={(e) => handleEdit(caption.id, e.target.value)}
                className="w-full min-h-[80px] p-2 text-sm border rounded resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Edit caption..."
                onClick={(e) => e.stopPropagation()}
              />

              <div className="text-xs text-muted-foreground">
                {(editedText[caption.id] ?? caption.text).length} / 200 chars
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {selectedIndex !== null && (
        <div className="flex justify-center">
          <Button
            size="lg"
            onClick={() => confirmSelection()}
            className="min-w-[200px]"
          >
            Confirm & Post
            <kbd className="ml-2 px-2 py-1 text-xs border rounded bg-background/20">
              Enter
            </kbd>
          </Button>
        </div>
      )}

      <p className="text-xs text-center text-muted-foreground">
        Tip: Press <kbd className="px-1 border rounded">1</kbd> or{' '}
        <kbd className="px-1 border rounded">2</kbd> to quickly select, then{' '}
        <kbd className="px-1 border rounded">Enter</kbd> to confirm
      </p>
    </div>
  );
}
