import { useState } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { ChevronLeft, ChevronRight, Lock, CheckCircle } from 'lucide-react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isToday, isBefore, startOfToday, addDays } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { UploadedImage } from '@/components/upload/BulkUploadZone';

interface ScheduledPost {
  id: string;
  imageUrl: string;
  subreddit: string;
  scheduledFor: Date;
}

interface CalendarDropZoneProps {
  userTier: 'free' | 'starter' | 'pro' | 'premium';
  scheduledPosts?: ScheduledPost[];
  onDateDrop: (date: Date, image: UploadedImage) => void;
  className?: string;
}

const TIER_LIMITS = {
  free: 0, // No scheduling
  starter: 0, // No scheduling
  pro: 7, // 7 days
  premium: 30, // 30 days
};

export function CalendarDropZone({
  userTier,
  scheduledPosts = [],
  onDateDrop,
  className,
}: CalendarDropZoneProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  
  const today = startOfToday();
  const tierLimit = TIER_LIMITS[userTier];
  const maxDate = tierLimit > 0 ? addDays(today, tierLimit) : today;

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const previousMonth = () => {
    setCurrentMonth(subMonths(currentMonth, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(addMonths(currentMonth, 1));
  };

  const getPostsForDate = (date: Date) => {
    return scheduledPosts.filter((post) =>
      isSameDay(new Date(post.scheduledFor), date)
    );
  };

  const isDateDisabled = (date: Date) => {
    // Disable past dates
    if (isBefore(date, today)) return true;
    
    // Disable dates beyond tier limit
    if (tierLimit === 0) return true;
    if (isBefore(maxDate, date)) return true;
    
    return false;
  };

  const isDateInCurrentMonth = (date: Date) => {
    return isSameMonth(date, currentMonth);
  };

  return (
    <Card className={cn('overflow-hidden', className)}>
      <CardHeader className="border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            {format(currentMonth, 'MMMM yyyy')}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={previousMonth}
              className="h-8 w-8"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentMonth(new Date())}
              className="h-8"
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={nextMonth}
              className="h-8 w-8"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Tier Limit Info */}
        <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          {tierLimit === 0 ? (
            <>
              <Lock className="h-4 w-4" />
              <span>Upgrade to Pro for scheduling</span>
            </>
          ) : (
            <>
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>
                Schedule up to {tierLimit} days ahead
              </span>
            </>
          )}
        </div>
      </CardHeader>

      <CardContent className="p-4">
        {/* Calendar Grid */}
        <div className="space-y-2">
          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-2 text-center text-sm font-medium text-muted-foreground">
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>

          {/* Calendar Days */}
          <div className="grid grid-cols-7 gap-2">
            {daysInMonth.map((date) => {
              const posts = getPostsForDate(date);
              const disabled = isDateDisabled(date);
              const inCurrentMonth = isDateInCurrentMonth(date);
              const isCurrentDay = isToday(date);

              return (
                <CalendarDay
                  key={date.toISOString()}
                  date={date}
                  posts={posts}
                  disabled={disabled}
                  inCurrentMonth={inCurrentMonth}
                  isToday={isCurrentDay}
                  onDrop={onDateDrop}
                />
              );
            })}
          </div>
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap items-center gap-4 border-t pt-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-green-500" />
            <span>Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-blue-500" />
            <span>Scheduled</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-muted" />
            <span>Locked</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Individual calendar day cell with drop zone
interface CalendarDayProps {
  date: Date;
  posts: ScheduledPost[];
  disabled: boolean;
  inCurrentMonth: boolean;
  isToday: boolean;
  onDrop: (date: Date, image: UploadedImage) => void;
}

function CalendarDay({
  date,
  posts,
  disabled,
  inCurrentMonth,
  isToday,
  onDrop,
}: CalendarDayProps) {
  const { isOver, setNodeRef } = useDroppable({
    id: `calendar-${date.toISOString()}`,
    disabled,
    data: {
      date,
    },
  });

  const handleDrop = (image: UploadedImage) => {
    if (!disabled) {
      onDrop(date, image);
    }
  };

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'relative aspect-square rounded-lg border-2 p-1 transition-all',
        disabled && 'cursor-not-allowed bg-muted/50',
        !disabled && 'cursor-pointer hover:border-primary/50',
        isOver && !disabled && 'border-primary bg-primary/10 ring-2 ring-primary ring-offset-2',
        !inCurrentMonth && 'opacity-40',
        isToday && 'border-primary bg-primary/5'
      )}
    >
      {/* Date Number */}
      <div className="flex items-start justify-between">
        <span
          className={cn(
            'text-sm font-medium',
            disabled && 'text-muted-foreground',
            isToday && 'text-primary'
          )}
        >
          {format(date, 'd')}
        </span>
        {disabled && <Lock className="h-3 w-3 text-muted-foreground" />}
      </div>

      {/* Scheduled Posts */}
      {posts.length > 0 && (
        <div className="mt-1 space-y-1">
          {posts.slice(0, 2).map((post) => (
            <div
              key={post.id}
              className="truncate rounded bg-blue-500 px-1 py-0.5 text-[10px] text-white"
            >
              r/{post.subreddit}
            </div>
          ))}
          {posts.length > 2 && (
            <div className="text-[10px] text-muted-foreground">
              +{posts.length - 2} more
            </div>
          )}
        </div>
      )}

      {/* Drop Hint */}
      {isOver && !disabled && (
        <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-primary/20">
          <span className="text-xs font-medium text-primary">Drop here</span>
        </div>
      )}
    </div>
  );
}

// Tier upgrade prompt
export function TierUpgradePrompt({ currentTier }: { currentTier: 'free' | 'starter' }) {
  return (
    <Card className="border-orange-500/20 bg-gradient-to-r from-orange-500/10 to-red-500/10">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-500/20">
            <Lock className="h-6 w-6 text-orange-600" />
          </div>
          <div className="flex-1">
            <h3 className="mb-1 font-semibold">Unlock Post Scheduling</h3>
            <p className="mb-3 text-sm text-muted-foreground">
              {currentTier === 'free'
                ? 'Upgrade to Pro to schedule posts up to 7 days in advance'
                : 'Upgrade to Pro to schedule posts up to 7 days in advance'}
            </p>
            <div className="flex items-center gap-2">
              <Button size="sm" className="bg-orange-600 hover:bg-orange-700">
                Upgrade to Pro
              </Button>
              <Badge variant="outline">$29/month</Badge>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
