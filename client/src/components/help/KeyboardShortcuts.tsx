import { Command } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';

interface Shortcut {
  keys: string[];
  description: string;
  category: string;
}

const SHORTCUTS: Shortcut[] = [
  // Navigation
  { keys: ['Cmd', 'K'], description: 'Open command palette', category: 'Navigation' },
  { keys: ['Cmd', 'N'], description: 'New post (open FAB menu)', category: 'Navigation' },
  { keys: ['Esc'], description: 'Close modal/dialog', category: 'Navigation' },
  { keys: ['?'], description: 'Show keyboard shortcuts', category: 'Navigation' },

  // Actions
  { keys: ['Cmd', 'S'], description: 'Save draft', category: 'Actions' },
  { keys: ['Cmd', 'Enter'], description: 'Submit form', category: 'Actions' },
  { keys: ['Cmd', 'Z'], description: 'Undo', category: 'Actions' },
  { keys: ['Cmd', 'Shift', 'Z'], description: 'Redo', category: 'Actions' },

  // Content
  { keys: ['Cmd', 'G'], description: 'Generate caption', category: 'Content' },
  { keys: ['Cmd', 'U'], description: 'Upload image', category: 'Content' },
  { keys: ['Cmd', 'P'], description: 'Post now', category: 'Content' },

  // Navigation (Arrow Keys)
  { keys: ['↑', '↓'], description: 'Navigate lists', category: 'Lists' },
  { keys: ['Enter'], description: 'Select item', category: 'Lists' },
  { keys: ['Tab'], description: 'Next field', category: 'Forms' },
  { keys: ['Shift', 'Tab'], description: 'Previous field', category: 'Forms' },
];

interface KeyboardShortcutsProps {
  isOpen: boolean;
  onClose: () => void;
}

export function KeyboardShortcuts({ isOpen, onClose }: KeyboardShortcutsProps) {
  const categories = Array.from(new Set(SHORTCUTS.map((s) => s.category)));

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Command className="h-5 w-5" />
            Keyboard Shortcuts
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {categories.map((category) => (
            <div key={category}>
              <h3 className="mb-3 text-sm font-semibold text-muted-foreground">{category}</h3>
              <div className="space-y-2">
                {SHORTCUTS.filter((s) => s.category === category).map((shortcut, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between rounded-lg border p-3"
                  >
                    <span className="text-sm">{shortcut.description}</span>
                    <div className="flex gap-1">
                      {shortcut.keys.map((key, i) => (
                        <span key={i} className="flex items-center gap-1">
                          <Badge variant="outline" className="font-mono text-xs">
                            {key}
                          </Badge>
                          {i < shortcut.keys.length - 1 && (
                            <span className="text-xs text-muted-foreground">+</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 rounded-lg bg-muted p-3 text-sm text-muted-foreground">
          <p>
            <strong>Tip:</strong> Press <Badge variant="outline" className="mx-1 font-mono text-xs">?</Badge> 
            anytime to see this list.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Hook to show shortcuts on ? key
import { useEffect } from 'react';

export function useKeyboardShortcutsHelp(onOpen: () => void) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '?' && !e.metaKey && !e.ctrlKey) {
        // Only trigger if not in an input field
        const target = e.target as HTMLElement;
        if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
          e.preventDefault();
          onOpen();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onOpen]);
}
