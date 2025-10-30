import { useState, useEffect } from 'react';
import { X, Sparkles, Calendar, Shield, Trash2, Copy, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface BatchAction {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  onClick: () => void;
  variant?: 'default' | 'destructive';
  disabled?: boolean;
}

interface BatchActionsBarProps {
  selectedCount: number;
  selectedItems?: any[];
  actions?: BatchAction[];
  onClearSelection: () => void;
  className?: string;
}

export function BatchActionsBar({
  selectedCount,
  selectedItems: _selectedItems = [],
  actions,
  onClearSelection,
  className,
}: BatchActionsBarProps) {
  const [isVisible, setIsVisible] = useState(false);

  // Default actions if none provided
  const defaultActions: BatchAction[] = [
    {
      id: 'generate-captions',
      label: 'Generate Captions',
      icon: Sparkles,
      onClick: () => {
        // Generate for selected items functionality
      },
    },
    {
      id: 'schedule',
      label: 'Schedule All',
      icon: Calendar,
      onClick: () => {
        // Scheduling posts functionality
      },
    },
    {
      id: 'protect',
      label: 'Apply Protection',
      icon: Shield,
      onClick: () => {
        // Apply protection to selected items functionality
      },
    },
    {
      id: 'duplicate',
      label: 'Duplicate',
      icon: Copy,
      onClick: () => {
        // Duplicate selected items functionality
      },
    },
    {
      id: 'export',
      label: 'Export',
      icon: Download,
      onClick: () => {
        // Apply tags functionality
      },
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: Trash2,
      onClick: () => {
        // Delete selected items functionality
      },
      variant: 'destructive',
    },
  ];

  const finalActions = actions || defaultActions;

  // Show/hide animation
  useEffect(() => {
    if (selectedCount > 0) {
      setIsVisible(true);
    } else {
      const timeout = setTimeout(() => setIsVisible(false), 300);
      return () => clearTimeout(timeout);
    }
  }, [selectedCount]);

  if (!isVisible && selectedCount === 0) return null;

  return (
    <div
      className={cn(
        'fixed bottom-0 left-0 right-0 z-40',
        'bg-gray-900 text-white',
        'transform transition-transform duration-300 ease-in-out',
        selectedCount > 0 ? 'translate-y-0' : 'translate-y-full',
        className
      )}
    >
      <div className="mx-auto max-w-7xl px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Selection count */}
          <div className="flex items-center gap-4">
            <span className="text-sm font-medium">
              {selectedCount} {selectedCount === 1 ? 'item' : 'items'} selected
            </span>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {finalActions.map((action) => {
              const Icon = action.icon;
              return (
                <Button
                  key={action.id}
                  onClick={action.onClick}
                  disabled={action.disabled}
                  variant={action.variant === 'destructive' ? 'destructive' : 'secondary'}
                  size="sm"
                  className={cn(
                    'gap-2',
                    action.variant === 'destructive' 
                      ? 'bg-red-600/20 hover:bg-red-600/30 text-red-300 hover:text-red-200'
                      : 'bg-white/10 hover:bg-white/20 text-white'
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{action.label}</span>
                </Button>
              );
            })}
            
            {/* Cancel button */}
            <div className="ml-4 border-l border-gray-700 pl-4">
              <Button
                onClick={onClearSelection}
                variant="ghost"
                size="sm"
                className="gap-2 text-gray-300 hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
                Cancel
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Hook for managing batch selection
export function useBatchSelection<T extends { id: string }>() {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);

  const isSelected = (id: string) => selectedItems.has(id);
  
  const toggleSelection = (id: string, index?: number) => {
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    
    if (index !== undefined) {
      setLastSelectedIndex(index);
    }
  };

  const toggleRangeSelection = (items: T[], endIndex: number) => {
    if (lastSelectedIndex === null) {
      toggleSelection(items[endIndex].id, endIndex);
      return;
    }

    const start = Math.min(lastSelectedIndex, endIndex);
    const end = Math.max(lastSelectedIndex, endIndex);
    
    setSelectedItems((prev) => {
      const next = new Set(prev);
      for (let i = start; i <= end; i++) {
        next.add(items[i].id);
      }
      return next;
    });
    
    setLastSelectedIndex(endIndex);
  };

  const selectAll = (items: T[]) => {
    setSelectedItems(new Set(items.map(item => item.id)));
  };

  const clearSelection = () => {
    setSelectedItems(new Set());
    setLastSelectedIndex(null);
  };

  const getSelectedItems = (items: T[]) => {
    return items.filter(item => selectedItems.has(item.id));
  };

  return {
    selectedItems,
    selectedCount: selectedItems.size,
    isSelected,
    toggleSelection,
    toggleRangeSelection,
    selectAll,
    clearSelection,
    getSelectedItems,
  };
}

// Checkbox component for batch selection
interface BatchCheckboxProps {
  checked: boolean;
  indeterminate?: boolean;
  onChange: () => void;
  className?: string;
}

export function BatchCheckbox({ 
  checked, 
  indeterminate = false, 
  onChange, 
  className 
}: BatchCheckboxProps) {
  return (
    <div className={cn('relative', className)}>
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        aria-label={indeterminate ? "Select some items" : checked ? "Deselect all items" : "Select all items"}
        className={cn(
          'h-4 w-4 rounded border-gray-300',
          'text-purple-600 focus:ring-purple-500',
          'cursor-pointer'
        )}
        ref={(input) => {
          if (input) {
            input.indeterminate = indeterminate;
          }
        }}
      />
    </div>
  );
}
