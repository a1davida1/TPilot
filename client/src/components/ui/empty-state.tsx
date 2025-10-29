import { LucideIcon, Image, Calendar, BarChart3, FileText, Inbox, Upload } from 'lucide-react';
import { Button } from './button';
import { Card, CardContent } from './card';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  variant?: 'default' | 'compact';
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  secondaryAction,
  className,
  variant = 'default',
}: EmptyStateProps) {
  const isCompact = variant === 'compact';

  return (
    <Card className={cn('border-dashed', className)}>
      <CardContent className={cn(
        'flex flex-col items-center justify-center text-center',
        isCompact ? 'p-8' : 'p-12'
      )}>
        <div className={cn(
          'mb-4 flex items-center justify-center rounded-full bg-muted',
          isCompact ? 'h-12 w-12' : 'h-16 w-16'
        )}>
          <Icon className={cn(
            'text-muted-foreground',
            isCompact ? 'h-6 w-6' : 'h-8 w-8'
          )} />
        </div>

        <h3 className={cn(
          'font-semibold text-foreground',
          isCompact ? 'mb-1 text-base' : 'mb-2 text-lg'
        )}>
          {title}
        </h3>

        <p className={cn(
          'text-muted-foreground',
          isCompact ? 'mb-4 text-sm' : 'mb-6 text-sm max-w-md'
        )}>
          {description}
        </p>

        {(action || secondaryAction) && (
          <div className="flex flex-col sm:flex-row gap-2">
            {action && (
              <Button onClick={action.onClick}>
                {action.label}
              </Button>
            )}
            {secondaryAction && (
              <Button variant="outline" onClick={secondaryAction.onClick}>
                {secondaryAction.label}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// Preset empty states for common scenarios
export function NoImagesEmptyState({ onUpload }: { onUpload: () => void }) {
  return (
    <EmptyState
      icon={Image}
      title="No images yet"
      description="Upload your first image to get started with AI-powered captions and scheduling"
      action={{
        label: 'Upload Image',
        onClick: onUpload,
      }}
    />
  );
}

export function NoPostsEmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <EmptyState
      icon={FileText}
      title="No posts yet"
      description="Create your first post to start building your Reddit presence"
      action={{
        label: 'Create Post',
        onClick: onCreate,
      }}
    />
  );
}

export function NoScheduledPostsEmptyState({ onSchedule }: { onSchedule: () => void }) {
  return (
    <EmptyState
      icon={Calendar}
      title="No scheduled posts"
      description="Schedule your posts in advance to maintain a consistent posting schedule"
      action={{
        label: 'Schedule Post',
        onClick: onSchedule,
      }}
    />
  );
}

export function NoAnalyticsDataEmptyState() {
  return (
    <EmptyState
      icon={BarChart3}
      title="No analytics data yet"
      description="Analytics will appear here once you start posting. Create your first post to see insights."
      variant="compact"
    />
  );
}

export function NoResultsEmptyState({ onClear }: { onClear?: () => void }) {
  return (
    <EmptyState
      icon={Inbox}
      title="No results found"
      description="Try adjusting your search or filters to find what you're looking for"
      action={onClear ? {
        label: 'Clear Filters',
        onClick: onClear,
      } : undefined}
      variant="compact"
    />
  );
}

export function UpgradeRequiredEmptyState({ onUpgrade }: { onUpgrade: () => void }) {
  return (
    <Card className="border-orange-500/20 bg-gradient-to-r from-orange-500/10 to-red-500/10">
      <CardContent className="flex flex-col items-center justify-center p-12 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-orange-500/20">
          <Upload className="h-8 w-8 text-orange-600" />
        </div>

        <h3 className="mb-2 text-lg font-semibold">Upgrade Required</h3>

        <p className="mb-6 max-w-md text-sm text-muted-foreground">
          This feature is available on Pro and Premium plans. Upgrade now to unlock advanced scheduling and analytics.
        </p>

        <Button onClick={onUpgrade} className="bg-orange-600 hover:bg-orange-700">
          Upgrade to Pro
        </Button>
      </CardContent>
    </Card>
  );
}
