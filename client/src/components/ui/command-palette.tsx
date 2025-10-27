import { useEffect, useState, useMemo } from 'react';
import { Command, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { useLocation } from 'wouter';
import { Search, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { getCommandPaletteItems } from '@/config/navigation';

interface CommandPaletteProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  onGenerateCaption?: () => void;
  onShowUpgrade?: () => void;
}

export function CommandPalette({ 
  open, 
  onOpenChange, 
  onGenerateCaption,
  onShowUpgrade 
}: CommandPaletteProps) {
  const [search, setSearch] = useState('');
  const [, setLocation] = useLocation();
  const { logout } = useAuth();
  const { toast } = useToast();
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Get command items
  const commands = useMemo(() => {
    return getCommandPaletteItems(setLocation, {
      generateCaption: onGenerateCaption,
      showUpgrade: onShowUpgrade,
      logout: logout ? () => {
        logout();
        toast({
          title: 'Signed out',
          description: 'You have been successfully signed out.',
        });
      } : undefined,
    });
  }, [setLocation, onGenerateCaption, onShowUpgrade, logout, toast]);

  // Filter commands based on search
  const filteredCommands = useMemo(() => {
    if (!search) return commands;
    
    const searchLower = search.toLowerCase();
    return commands.filter(cmd => {
      const labelMatch = cmd.label.toLowerCase().includes(searchLower);
      const descMatch = cmd.description?.toLowerCase().includes(searchLower);
      const keywordMatch = cmd.keywords?.some(k => k.toLowerCase().includes(searchLower));
      return labelMatch || descMatch || keywordMatch;
    });
  }, [commands, search]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!open) {
        // Open with Cmd/Ctrl + K
        if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
          e.preventDefault();
          onOpenChange?.(true);
        }
        return;
      }

      switch (e.key) {
        case 'Escape':
          onOpenChange?.(false);
          break;
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => 
            Math.min(prev + 1, filteredCommands.length - 1)
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action();
            onOpenChange?.(false);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [open, onOpenChange, filteredCommands, selectedIndex]);

  // Reset selected index when search changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
        onClick={() => onOpenChange?.(false)}
      />
      
      {/* Command Palette */}
      <div className="fixed left-1/2 top-[20%] z-50 w-full max-w-2xl -translate-x-1/2 px-4">
        <Command className="overflow-hidden rounded-xl border bg-popover shadow-2xl">
          {/* Search Input */}
          <div className="flex items-center border-b px-4">
            <Search className="mr-2 h-4 w-4 shrink-0 opacity-50" />
            <CommandInput
              value={search}
              onValueChange={setSearch}
              placeholder="Type a command or search..."
              className="flex h-14 w-full bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            />
            <kbd className="pointer-events-none ml-auto inline-flex h-6 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-60">
              <span className="text-xs">ESC</span>
            </kbd>
          </div>
          
          {/* Command List */}
          <CommandList className="max-h-[400px] overflow-y-auto p-2">
            {filteredCommands.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                No results found
              </div>
            ) : (
              filteredCommands.map((command, index) => (
                <CommandItem
                  key={command.id}
                  value={command.id}
                  onSelect={() => {
                    command.action();
                    onOpenChange?.(false);
                  }}
                  className={cn(
                    "relative flex cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-sm outline-none",
                    "aria-selected:bg-accent aria-selected:text-accent-foreground",
                    "data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
                    index === selectedIndex && "bg-accent text-accent-foreground"
                  )}
                  onMouseEnter={() => setSelectedIndex(index)}
                >
                  {command.icon && (
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                      <command.icon className="h-5 w-5" />
                    </div>
                  )}
                  <div className="flex flex-1 flex-col">
                    <span className="font-medium">{command.label}</span>
                    {command.description && (
                      <span className="text-xs text-muted-foreground">
                        {command.description}
                      </span>
                    )}
                  </div>
                  {command.shortcut && (
                    <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium opacity-60">
                      <span>{command.shortcut}</span>
                    </kbd>
                  )}
                </CommandItem>
              ))
            )}
          </CommandList>
          
          {/* Help Footer */}
          <div className="flex items-center justify-between border-t px-4 py-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
                <span>↑↓</span>
              </kbd>
              Navigate
              <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium">
                <span>↵</span>
              </kbd>
              Select
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Sparkles className="h-3 w-3" />
              AI powered
            </div>
          </div>
        </Command>
      </div>
    </>
  );
}

// Global keyboard shortcut hook
export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return { open, setOpen };
}
