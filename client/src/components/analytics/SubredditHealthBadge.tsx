/**
 * Subreddit Health Badge Component (QW-6)
 * 
 * Displays health score with color coding and detailed breakdown
 */

import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { TrendingUp, TrendingDown, Minus, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SubredditHealthBadgeProps {
  score: number;
  status: 'excellent' | 'healthy' | 'watch' | 'risky';
  breakdown?: {
    successRate: number;
    successScore: number;
    engagementRate: number;
    engagementScore: number;
    removalRate: number;
    removalScore: number;
  };
  trend?: 'improving' | 'stable' | 'declining' | 'unknown';
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const statusConfig = {
  excellent: {
    color: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
    label: 'Excellent',
    icon: '🟢',
  },
  healthy: {
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
    label: 'Healthy',
    icon: '🔵',
  },
  watch: {
    color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
    label: 'Watch',
    icon: '🟡',
  },
  risky: {
    color: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
    label: 'Risky',
    icon: '🔴',
  },
};

const trendIcons = {
  improving: <TrendingUp className="h-3 w-3 text-green-600" />,
  declining: <TrendingDown className="h-3 w-3 text-red-600" />,
  stable: <Minus className="h-3 w-3 text-gray-600" />,
  unknown: <AlertCircle className="h-3 w-3 text-gray-400" />,
};

export function SubredditHealthBadge({
  score,
  status,
  breakdown,
  trend,
  showLabel = true,
  size = 'md',
}: SubredditHealthBadgeProps) {
  const config = statusConfig[status];

  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-0.5',
    lg: 'text-base px-3 py-1',
  };

  const badge = (
    <Badge
      variant="secondary"
      className={cn(config.color, sizeClasses[size], 'font-medium')}
    >
      <span className="mr-1">{config.icon}</span>
      {score}
      {showLabel && <span className="ml-1">{config.label}</span>}
      {trend && trend !== 'unknown' && (
        <span className="ml-1">{trendIcons[trend]}</span>
      )}
    </Badge>
  );

  if (!breakdown) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{badge}</TooltipTrigger>
        <TooltipContent className="w-64">
          <div className="space-y-2">
            <div className="font-semibold text-sm border-b pb-1">
              Health Score Breakdown
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Success Rate:</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{breakdown.successRate}%</span>
                  <span className="text-muted-foreground">
                    ({breakdown.successScore.toFixed(1)}/40 pts)
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Engagement:</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{breakdown.engagementRate}%</span>
                  <span className="text-muted-foreground">
                    ({breakdown.engagementScore.toFixed(1)}/30 pts)
                  </span>
                </div>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Removal Rate:</span>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{breakdown.removalRate}%</span>
                  <span className="text-muted-foreground">
                    ({breakdown.removalScore.toFixed(1)}/30 pts)
                  </span>
                </div>
              </div>

              <div className="border-t pt-1.5 mt-1.5 flex justify-between items-center font-semibold">
                <span>Total Score:</span>
                <span>{score}/100</span>
              </div>
            </div>

            {trend && trend !== 'unknown' && (
              <div className="text-xs text-muted-foreground border-t pt-1.5 mt-1.5">
                Trend: <span className="capitalize">{trend}</span>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
