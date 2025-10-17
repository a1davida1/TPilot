/**
 * Optimal Time Badge
 * Shows recommended posting time with confidence indicator
 */

import { Badge } from '@/components/ui/badge';
import { Clock, TrendingUp, Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface OptimalTimeBadgeProps {
  dayOfWeek: number;
  hourOfDay: number;
  avgUpvotes?: number;
  confidence: 'low' | 'medium' | 'high';
  reason?: string;
  className?: string;
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function OptimalTimeBadge({
  dayOfWeek,
  hourOfDay,
  avgUpvotes,
  confidence,
  reason,
  className = ''
}: OptimalTimeBadgeProps) {
  const dayName = DAY_NAMES[dayOfWeek];
  const hour12 = hourOfDay % 12 || 12;
  const ampm = hourOfDay < 12 ? 'AM' : 'PM';
  const timeStr = `${dayName} ${hour12}${ampm}`;

  const confidenceColor = {
    low: 'bg-gray-100 text-gray-700 border-gray-300',
    medium: 'bg-blue-100 text-blue-700 border-blue-300',
    high: 'bg-green-100 text-green-700 border-green-300'
  }[confidence];

  const confidenceIcon = {
    low: <Info className="h-3 w-3" />,
    medium: <Clock className="h-3 w-3" />,
    high: <TrendingUp className="h-3 w-3" />
  }[confidence];

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={`${confidenceColor} ${className} flex items-center gap-1.5 cursor-help`}
          >
            {confidenceIcon}
            <span className="font-semibold">{timeStr}</span>
            {avgUpvotes && avgUpvotes > 0 && (
              <span className="text-xs opacity-75">
                ~{Math.round(avgUpvotes)}↑
              </span>
            )}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <div className="space-y-1">
            <p className="font-semibold">Optimal Time</p>
            {reason && <p className="text-sm">{reason}</p>}
            {avgUpvotes && avgUpvotes > 0 && (
              <p className="text-xs text-muted-foreground">
                Expected: ~{Math.round(avgUpvotes)} upvotes
              </p>
            )}
            <p className="text-xs text-muted-foreground capitalize">
              Confidence: {confidence}
            </p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Simple inline optimal time indicator (no tooltip)
 */
export function OptimalTimeIndicator({
  dayOfWeek,
  hourOfDay,
  avgUpvotes
}: {
  dayOfWeek: number;
  hourOfDay: number;
  avgUpvotes?: number;
}) {
  const dayName = DAY_NAMES[dayOfWeek];
  const hour12 = hourOfDay % 12 || 12;
  const ampm = hourOfDay < 12 ? 'AM' : 'PM';

  return (
    <span className="inline-flex items-center gap-1 text-sm font-medium text-green-600">
      <TrendingUp className="h-4 w-4" />
      {dayName} {hour12}{ampm}
      {avgUpvotes && avgUpvotes > 0 && (
        <span className="text-xs text-muted-foreground">
          (~{Math.round(avgUpvotes)}↑)
        </span>
      )}
    </span>
  );
}
