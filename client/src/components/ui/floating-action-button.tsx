import { useState, useEffect } from 'react';
import { Plus, Sparkles, Upload, Shield, Calendar } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocation } from 'wouter';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface FABAction {
  id: string;
  label: string;
  description?: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  color?: string;
}

interface FloatingActionButtonProps {
  className?: string;
  hideOnPaths?: string[];
}

export function FloatingActionButton({
  className,
  hideOnPaths = ['/quick-post', '/bulk-caption', '/post-scheduling']
}: FloatingActionButtonProps) {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const [currentPath] = useLocation();

  // Keyboard shortcut: Cmd+N / Ctrl+N
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Check for Cmd+N (Mac) or Ctrl+N (Windows/Linux)
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault(); // Prevent browser's default "New Window"
        setOpen((prev) => !prev);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Hide FAB on specific paths
  if (hideOnPaths.some(path => currentPath.startsWith(path))) {
    return null;
  }

  const actions: FABAction[] = [
    {
      id: 'quick-post',
      label: 'Quick Post',
      description: 'Create a single post',
      icon: Sparkles,
      onClick: () => {
        setLocation('/quick-post');
        setOpen(false);
      },
      color: 'hover:bg-purple-100 dark:hover:bg-purple-900/30',
    },
    {
      id: 'bulk-upload',
      label: 'Bulk Upload',
      description: 'Upload multiple images',
      icon: Upload,
      onClick: () => {
        setLocation('/bulk-caption');
        setOpen(false);
      },
      color: 'hover:bg-blue-100 dark:hover:bg-blue-900/30',
    },
    {
      id: 'imageshield',
      label: 'Protect Media',
      description: 'Apply watermarks',
      icon: Shield,
      onClick: () => {
        setLocation('/imageshield');
        setOpen(false);
      },
      color: 'hover:bg-green-100 dark:hover:bg-green-900/30',
    },
    {
      id: 'schedule',
      label: 'Schedule Post',
      description: 'Plan future posts',
      icon: Calendar,
      onClick: () => {
        setLocation('/post-scheduling');
        setOpen(false);
      },
      color: 'hover:bg-orange-100 dark:hover:bg-orange-900/30',
    },
  ];

  // Detect OS for keyboard shortcut hint
  const isMac = typeof navigator !== 'undefined' && navigator.userAgent.includes('Mac');
  const shortcutHint = isMac ? '⌘N' : 'Ctrl+N';

  return (
    <>
      {/* Main FAB */}
      <TooltipProvider>
        <Popover open={open} onOpenChange={setOpen}>
          <Tooltip>
            <TooltipTrigger asChild>
              <PopoverTrigger asChild>
                <button
                  className={cn(
                    'fixed bottom-6 right-6 z-50',
                    'h-14 w-14 rounded-full',
                    'bg-gradient-to-r from-purple-600 to-pink-600',
                    'shadow-lg shadow-purple-600/30',
                    'flex items-center justify-center',
                    'transition-all duration-200',
                    'hover:scale-110 hover:shadow-xl hover:shadow-purple-600/40',
                    'focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2',
                    'group',
                    className
                  )}
                  aria-label="Quick actions"
                >
                  <Plus
                    className={cn(
                      'h-6 w-6 text-white transition-transform duration-200',
                      open && 'rotate-45'
                    )}
                  />
                </button>
              </PopoverTrigger>
            </TooltipTrigger>
            <TooltipContent side="left" sideOffset={8}>
              <p className="text-sm">
                Quick Actions <kbd className="ml-2 text-xs bg-white/20 px-1.5 py-0.5 rounded">{shortcutHint}</kbd>
              </p>
            </TooltipContent>
          </Tooltip>

        <PopoverContent 
          align="end" 
          side="top" 
          sideOffset={12}
          className="w-64 p-2"
        >
          <div className="space-y-1">
            {actions.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.id}
                  onClick={action.onClick}
                  className={cn(
                    'flex w-full items-center gap-3 rounded-lg px-3 py-2.5',
                    'text-left transition-colors',
                    action.color || 'hover:bg-gray-100 dark:hover:bg-gray-800'
                  )}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-r from-purple-100 to-pink-100 dark:from-purple-900/30 dark:to-pink-900/30">
                    <Icon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium">{action.label}</div>
                    {action.description && (
                      <div className="text-xs text-muted-foreground">
                        {action.description}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
      </TooltipProvider>
    </>
  );
}

// Mini FAB for specific actions
interface MiniFABProps {
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  label?: string;
  variant?: 'primary' | 'secondary' | 'success' | 'warning';
  className?: string;
  position?: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right';
}

const variantStyles = {
  primary: 'from-purple-600 to-pink-600 shadow-purple-600/30',
  secondary: 'from-gray-600 to-gray-700 shadow-gray-600/30',
  success: 'from-green-600 to-emerald-600 shadow-green-600/30',
  warning: 'from-amber-600 to-orange-600 shadow-amber-600/30',
};

const positionStyles = {
  'bottom-left': 'bottom-6 left-6',
  'bottom-right': 'bottom-6 right-6',
  'top-left': 'top-20 left-6',
  'top-right': 'top-20 right-6',
};

export function MiniFAB({
  icon: Icon,
  onClick,
  label,
  variant = 'primary',
  className,
  position = 'bottom-right',
}: MiniFABProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'fixed z-40',
        positionStyles[position],
        'h-12 w-12 rounded-full',
        'bg-gradient-to-r',
        variantStyles[variant],
        'shadow-lg',
        'flex items-center justify-center',
        'transition-all duration-200',
        'hover:scale-110 hover:shadow-xl',
        'focus:outline-none focus:ring-2 focus:ring-offset-2',
        className
      )}
      aria-label={label}
      title={label}
    >
      <Icon className="h-5 w-5 text-white" />
    </button>
  );
}
