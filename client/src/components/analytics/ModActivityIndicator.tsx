/**
 * Mod Activity Indicator Component (QW-1)
 * 
 * Shows moderator activity level and safe posting times for a subreddit
 */

import { useQuery } from '@tanstack/react-query';
import { Shield, Clock, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

interface ModActivityLevel {
  level: 'high' | 'moderate' | 'low' | 'unknown';
  actionsPerDay: number;
  lastActivity: Date | null;
  confidence: 'high' | 'medium' | 'low';
}

interface SafePostingTime {
  dayOfWeek: number;
  hourOfDay: number;
  reason: string;
}

interface ModActivityData {
  subreddit: string;
  activityLevel: ModActivityLevel;
  safePostingTimes: SafePostingTime[];
  recentActions: number;
  lastChecked: Date;
}

interface ModActivityIndicatorProps {
  subreddit: string;
  compact?: boolean;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const activityConfig = {
  high: {
    color: 'text-red-600',
    bgColor: 'bg-red-50 dark:bg-red-950',
    borderColor: 'border-red-500',
    icon: AlertTriangle,
    label: 'High Activity',
    description: 'Mods are very active - post during off-peak hours',
  },
  moderate: {
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50 dark:bg-yellow-950',
    borderColor: 'border-yellow-500',
    icon: Shield,
    label: 'Moderate Activity',
    description: 'Moderate mod activity - avoid peak hours',
  },
  low: {
    color: 'text-green-600',
    bgColor: 'bg-green-50 dark:bg-green-950',
    borderColor: 'border-green-500',
    icon: CheckCircle,
    label: 'Low Activity',
    description: 'Low mod activity - safe to post anytime',
  },
  unknown: {
    color: 'text-gray-600',
    bgColor: 'bg-gray-50 dark:bg-gray-950',
    borderColor: 'border-gray-500',
    icon: Info,
    label: 'Unknown',
    description: 'Unable to determine mod activity level',
  },
};

export function ModActivityIndicator({ subreddit, compact = false }: ModActivityIndicatorProps) {
  const { data, isLoading, error } = useQuery<ModActivityData>({
    queryKey: ['mod-activity', subreddit],
    queryFn: async () => {
      const response = await fetch(`/api/analytics/mod-activity/${subreddit}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch mod activity');
      }

      return response.json();
    },
    enabled: !!subreddit,
    staleTime: 6 * 60 * 60 * 1000, // Cache for 6 hours
  });

  if (error) {
    return null; // Silently fail - this is a nice-to-have feature
  }

  if (isLoading) {
    return compact ? (
      <Skeleton className="h-6 w-32" />
    ) : (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Mod Activity
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-24" />
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const config = activityConfig[data.activityLevel.level];
  const Icon = config.icon;

  // Compact view for inline display
  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className={cn('cursor-help', config.borderColor)}
            >
              <Icon className={cn('h-3 w-3 mr-1', config.color)} />
              {config.label}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-1">
              <p className="font-medium">{config.description}</p>
              <p className="text-xs text-muted-foreground">
                ~{data.activityLevel.actionsPerDay} actions/day
              </p>
              {data.safePostingTimes.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Best time: {DAYS[data.safePostingTimes[0].dayOfWeek]} at{' '}
                  {data.safePostingTimes[0].hourOfDay}:00
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // Full card view
  return (
    <Card className={cn('border-l-4', config.borderColor)}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          Mod Activity
        </CardTitle>
        <CardDescription>r/{subreddit}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Activity Level */}
        <div className={cn('rounded-lg p-4', config.bgColor)}>
          <div className="flex items-center gap-3">
            <Icon className={cn('h-6 w-6', config.color)} />
            <div>
              <div className={cn('text-lg font-semibold', config.color)}>
                {config.label}
              </div>
              <div className="text-sm text-muted-foreground">
                {config.description}
              </div>
            </div>
          </div>
          <div className="mt-3 text-sm text-muted-foreground">
            Estimated ~{data.activityLevel.actionsPerDay} mod actions per day
            <Badge variant="outline" className="ml-2">
              {data.activityLevel.confidence} confidence
            </Badge>
          </div>
        </div>

        {/* Safe Posting Times */}
        {data.safePostingTimes.length > 0 && (
          <div>
            <div className="text-sm font-medium mb-2">Recommended Posting Times:</div>
            <div className="space-y-2">
              {data.safePostingTimes.map((time, idx) => (
                <Alert key={idx}>
                  <Clock className="h-4 w-4" />
                  <AlertDescription>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-medium">
                          {DAYS[time.dayOfWeek]} at {time.hourOfDay}:00
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {time.reason}
                        </div>
                      </div>
                      <Badge variant="outline">Safe</Badge>
                    </div>
                  </AlertDescription>
                </Alert>
              ))}
            </div>
          </div>
        )}

        {/* Last Checked */}
        <div className="text-xs text-muted-foreground text-center">
          Last checked: {new Date(data.lastChecked).toLocaleString()}
        </div>
      </CardContent>
    </Card>
  );
}
