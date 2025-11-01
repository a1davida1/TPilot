'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { navigationItems, workflowBuckets, type CommandItem as NavigationCommandItem } from '@/config/navigation';
import { useRouter } from 'next/navigation';
import { Search, Sparkles } from 'lucide-react';

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onGenerateCaption?: () => void;
}

interface CommandEntry extends NavigationCommandItem {
  category: 'navigation' | 'workflow' | 'action';
}

export function CommandPalette({ open, onOpenChange, onGenerateCaption }: CommandPaletteProps) {
  const router = useRouter();
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);

  const commands = useMemo<CommandEntry[]>(() => {
    const entries: CommandEntry[] = [];

    for (const item of navigationItems) {
      entries.push({
        id: `nav-${item.key}`,
        label: item.label,
        description: item.description,
        icon: item.icon,
        shortcut: item.shortcut,
        action: () => router.push(item.href),
        keywords: [item.category, item.key],
        category: 'navigation',
      });
    }

    for (const bucket of workflowBuckets) {
      for (const route of bucket.routes) {
        entries.push({
          id: `workflow-${route.key}`,
          label: route.label,
          description: route.description,
          icon: route.icon,
          shortcut: route.shortcut,
          action: () => router.push(route.href),
          keywords: [bucket.key, 'workflow'],
          category: 'workflow',
        });
      }
    }

    if (onGenerateCaption) {
      entries.push({
        id: 'action-generate',
        label: 'Generate caption',
        description: 'Launch AI caption studio',
        icon: Sparkles,
        action: onGenerateCaption,
        keywords: ['caption', 'ai', 'generate'],
        category: 'action',
      });
    }

    return entries;
  }, [onGenerateCaption, router]);

  const filteredCommands = useMemo(() => {
    if (!searchValue) {
      return commands;
    }

    const lowered = searchValue.toLowerCase();
    return commands.filter((command) => {
      const matchesLabel = command.label.toLowerCase().includes(lowered);
      const matchesDescription = command.description?.toLowerCase().includes(lowered);
      const matchesKeyword = command.keywords?.some((keyword) => keyword.toLowerCase().includes(lowered));
      return matchesLabel || matchesDescription || matchesKeyword;
    });
  }, [commands, searchValue]);

  const closePalette = useCallback(() => {
    setSearchValue('');
    setHighlightedIndex(0);
    onOpenChange(false);
  }, [onOpenChange]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        onOpenChange(!open);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onOpenChange, open]);

  useEffect(() => {
    if (open) {
      const timeout = window.setTimeout(() => {
        searchRef.current?.focus();
      }, 0);
      return () => window.clearTimeout(timeout);
    }
    return undefined;
  }, [open]);

  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchValue, commands.length]);

  const handleKeyNavigation = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>) => {
      if (!filteredCommands.length) return;
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlightedIndex((previous) => (previous + 1) % filteredCommands.length);
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlightedIndex((previous) => (previous - 1 + filteredCommands.length) % filteredCommands.length);
      } else if (event.key === 'Enter') {
        event.preventDefault();
        filteredCommands[highlightedIndex]?.action();
        closePalette();
      } else if (event.key === 'Escape') {
        event.preventDefault();
        closePalette();
      }
    },
    [filteredCommands, highlightedIndex, closePalette],
  );

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/60 px-4 py-24 backdrop-blur">
      <div className="w-full max-w-2xl overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/90 shadow-2xl">
        <div className="flex items-center gap-2 border-b border-slate-700 px-4">
          <Search className="h-4 w-4 text-slate-500" />
          <input
            ref={searchRef}
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            onKeyDown={handleKeyNavigation}
            placeholder="Search actions"
            className="flex-1 bg-transparent py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
          />
          <kbd className="hidden rounded border border-slate-600 px-2 py-1 text-[10px] font-medium text-slate-400 sm:block">
            ESC
          </kbd>
        </div>
        <div className="max-h-[420px] overflow-y-auto bg-slate-900">
          {filteredCommands.length === 0 ? (
            <p className="px-6 py-8 text-sm text-slate-400">No commands match “{searchValue}”.</p>
          ) : (
            <ul className="divide-y divide-slate-800">
              {filteredCommands.map((command, index) => {
                const Icon = command.icon;
                const isHighlighted = index === highlightedIndex;
                return (
                  <li key={command.id}>
                    <button
                      type="button"
                      onClick={() => {
                        command.action();
                        closePalette();
                      }}
                      className={`flex w-full items-center gap-3 px-5 py-3 text-left text-sm transition ${
                        isHighlighted ? 'bg-slate-800 text-slate-50' : 'text-slate-200 hover:bg-slate-800'
                      }`}
                      onMouseEnter={() => setHighlightedIndex(index)}
                    >
                      {Icon ? (
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-slate-200">
                          <Icon className="h-5 w-5" />
                        </span>
                      ) : (
                        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-800 text-slate-200">
                          <Sparkles className="h-5 w-5" />
                        </span>
                      )}
                      <span className="flex flex-1 flex-col">
                        <span className="font-medium">{command.label}</span>
                        {command.description && (
                          <span className="text-xs text-slate-400">{command.description}</span>
                        )}
                      </span>
                      {command.shortcut && (
                        <kbd className="rounded border border-slate-600 px-2 py-1 text-[10px] font-medium text-slate-400">
                          {command.shortcut}
                        </kbd>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <div className="flex items-center justify-between border-t border-slate-800 px-4 py-2 text-xs text-slate-500">
          <span>Navigate with ↑ ↓ · Press ↵ to run</span>
          <span className="flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            Cmd + K
          </span>
        </div>
      </div>
    </div>
  );
}
