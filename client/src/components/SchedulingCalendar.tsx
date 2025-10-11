import React, { useState, useMemo } from 'react';
import { format, addDays, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, isAfter, isBefore, startOfDay, setHours, setMinutes } from 'date-fns';
import { ChevronLeft, ChevronRight, Clock, Calendar as CalendarIcon, AlertCircle, Check, X, Loader2, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface ScheduledPost {
  id: string;
  date: Date;
  time: string;
  subreddit: string;
  imageUrl: string;
  caption: string;
  status: 'pending' | 'scheduled' | 'published' | 'failed';
}

interface TimeSlot {
  time: string;
  available: boolean;
  optimal?: boolean;
  posts?: ScheduledPost[];
}

interface SchedulingCalendarProps {
  selectedImages: Array<{
    id: string;
    url: string;
    caption?: string;
    subreddit?: string;
  }>;
  onSchedule: (data: {
    imageUrl: string;
    caption: string;
    subreddit: string;
    scheduledFor: string;
  }[]) => void;
  existingPosts?: ScheduledPost[];
  userTier?: 'free' | 'starter' | 'pro' | 'premium';
}

const OPTIMAL_POSTING_TIMES = [
  { hour: 6, label: '6:00 AM - Early Birds' },
  { hour: 9, label: '9:00 AM - Morning Peak' },
  { hour: 12, label: '12:00 PM - Lunch Break' },
  { hour: 17, label: '5:00 PM - After Work' },
  { hour: 20, label: '8:00 PM - Evening Peak' },
  { hour: 22, label: '10:00 PM - Night Owls' },
];

const TIME_SLOTS = Array.from({ length: 24 }, (_, i) => ({
  hour: i,
  label: format(setHours(new Date(), i), 'h:mm a')
}));

export function SchedulingCalendar({ 
  selectedImages, 
  onSchedule, 
  existingPosts = [],
  userTier = 'free' 
}: SchedulingCalendarProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<Map<string, string>>(new Map());
  const [scheduledPosts, setScheduledPosts] = useState<ScheduledPost[]>(existingPosts);
  const [viewMode, setViewMode] = useState<'month' | 'week'>('month');
  const [showTimeSlotDialog, setShowTimeSlotDialog] = useState(false);
  const [selectedSubreddit, setSelectedSubreddit] = useState('');
  const [bulkScheduleMode, setBulkScheduleMode] = useState(false);
  
  // Calculate tier restrictions
  const maxScheduleDays = useMemo(() => {
    switch (userTier) {
      case 'premium': return 30;
      case 'pro': return 7;
      case 'starter': return 0;
      case 'free': return 0;
      default: return 0;
    }
  }, [userTier]);

  const canSchedule = maxScheduleDays > 0;
  const maxScheduleDate = useMemo(() => {
    return addDays(new Date(), maxScheduleDays);
  }, [maxScheduleDays]);

  // Get calendar days
  const calendarDays = useMemo(() => {
    const start = viewMode === 'month' 
      ? startOfMonth(currentMonth)
      : startOfWeek(currentMonth);
    const end = viewMode === 'month'
      ? endOfMonth(currentMonth)
      : endOfWeek(currentMonth);
    
    return eachDayOfInterval({ start, end });
  }, [currentMonth, viewMode]);

  // Check if a date can be scheduled
  const canScheduleDate = (date: Date) => {
    if (!canSchedule) return false;
    const today = startOfDay(new Date());
    const target = startOfDay(date);
    return !isBefore(target, today) && !isAfter(target, maxScheduleDate);
  };

  // Get posts for a specific date
  const getPostsForDate = (date: Date) => {
    return scheduledPosts.filter(post => isSameDay(post.date, date));
  };

  // Handle date selection
  const handleDateSelect = (date: Date) => {
    if (!canScheduleDate(date)) {
      toast({
        title: 'Cannot schedule',
        description: userTier === 'free' || userTier === 'starter' 
          ? 'Upgrade to Pro to unlock scheduling'
          : `You can only schedule up to ${maxScheduleDays} days in advance`,
        variant: 'destructive'
      });
      return;
    }
    setSelectedDate(date);
    setShowTimeSlotDialog(true);
  };

  // Handle time slot selection
  const handleTimeSlotSelect = (hour: number, minute: number = 0) => {
    if (!selectedDate) return;

    const scheduledTime = setMinutes(setHours(selectedDate, hour), minute);
    
    if (bulkScheduleMode) {
      // Schedule all images at once
      const scheduleData = selectedImages.map(img => ({
        imageUrl: img.url,
        caption: img.caption || '',
        subreddit: img.subreddit || selectedSubreddit,
        scheduledFor: scheduledTime.toISOString()
      }));
      onSchedule(scheduleData);
      setShowTimeSlotDialog(false);
    } else {
      // Individual scheduling
      const dateKey = format(scheduledTime, 'yyyy-MM-dd HH:mm');
      setSelectedTimeSlots(new Map(selectedTimeSlots.set(dateKey, selectedSubreddit)));
    }
  };

  // Navigation handlers
  const navigateMonth = (direction: 'prev' | 'next') => {
    setCurrentMonth(prev => 
      direction === 'prev' 
        ? new Date(prev.getFullYear(), prev.getMonth() - 1)
        : new Date(prev.getFullYear(), prev.getMonth() + 1)
    );
  };

  // Schedule all selected posts
  const scheduleAllPosts = () => {
    const scheduleData: any[] = [];
    
    selectedTimeSlots.forEach((subreddit, dateTimeKey) => {
      selectedImages.forEach(img => {
        scheduleData.push({
          imageUrl: img.url,
          caption: img.caption || '',
          subreddit: subreddit,
          scheduledFor: new Date(dateTimeKey).toISOString()
        });
      });
    });

    if (scheduleData.length === 0) {
      toast({
        title: 'No posts to schedule',
        description: 'Please select at least one time slot',
        variant: 'destructive'
      });
      return;
    }

    onSchedule(scheduleData);
  };

  if (!canSchedule) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Scheduling Not Available</CardTitle>
          <CardDescription>
            Upgrade to Pro to unlock post scheduling
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {userTier === 'free' && "Free tier doesn't include scheduling. Upgrade to Pro for 7-day scheduling or Premium for 30-day scheduling."}
              {userTier === 'starter' && "Starter tier doesn't include scheduling. Upgrade to Pro for 7-day scheduling or Premium for 30-day scheduling."}
            </AlertDescription>
          </Alert>
          <Button className="mt-4 w-full" onClick={() => window.location.href = '/settings'}>
            Upgrade to Pro
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Calendar Header */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Schedule Posts</CardTitle>
              <CardDescription>
                Schedule up to {maxScheduleDays} days in advance
                {userTier === 'pro' && " (Pro: 7 days)"}
                {userTier === 'premium' && " (Premium: 30 days)"}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as 'month' | 'week')}>
                <TabsList>
                  <TabsTrigger value="month">Month</TabsTrigger>
                  <TabsTrigger value="week">Week</TabsTrigger>
                </TabsList>
              </Tabs>
              <Button
                variant={bulkScheduleMode ? "default" : "outline"}
                size="sm"
                onClick={() => setBulkScheduleMode(!bulkScheduleMode)}
              >
                {bulkScheduleMode ? 'Individual' : 'Bulk'} Mode
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Calendar Navigation */}
          <div className="flex justify-between items-center mb-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateMonth('prev')}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <h3 className="text-lg font-semibold">
              {format(currentMonth, 'MMMM yyyy')}
            </h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigateMonth('next')}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Day headers */}
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="text-center text-sm font-medium text-muted-foreground p-2">
                {day}
              </div>
            ))}
            
            {/* Calendar days */}
            {calendarDays.map((day, idx) => {
              const isToday = isSameDay(day, new Date());
              const isCurrentMonth = isSameMonth(day, currentMonth);
              const isSchedulable = canScheduleDate(day);
              const postsForDay = getPostsForDate(day);
              const hasSelectedSlot = Array.from(selectedTimeSlots.keys()).some(key => 
                isSameDay(new Date(key), day)
              );

              return (
                <div
                  key={idx}
                  onClick={() => isSchedulable && handleDateSelect(day)}
                  className={cn(
                    "min-h-[80px] p-2 border rounded-lg cursor-pointer transition-all",
                    isCurrentMonth ? "bg-background" : "bg-muted/30",
                    isToday && "border-primary ring-2 ring-primary/20",
                    isSchedulable && "hover:bg-accent hover:border-accent-foreground/50",
                    !isSchedulable && "opacity-50 cursor-not-allowed",
                    hasSelectedSlot && "bg-primary/10 border-primary"
                  )}
                >
                  <div className="flex justify-between items-start">
                    <span className={cn(
                      "text-sm font-medium",
                      !isCurrentMonth && "text-muted-foreground",
                      isToday && "text-primary font-bold"
                    )}>
                      {format(day, 'd')}
                    </span>
                    {postsForDay.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {postsForDay.length}
                      </Badge>
                    )}
                  </div>
                  
                  {/* Show scheduled posts preview */}
                  {postsForDay.slice(0, 2).map((post, i) => (
                    <div key={i} className="mt-1">
                      <div className="text-xs text-muted-foreground truncate">
                        {format(post.date, 'h:mm a')} - r/{post.subreddit}
                      </div>
                    </div>
                  ))}
                  
                  {postsForDay.length > 2 && (
                    <div className="text-xs text-muted-foreground">
                      +{postsForDay.length - 2} more
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Optimal Posting Times */}
          <div className="mt-6">
            <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Optimal Posting Times
            </h4>
            <div className="grid grid-cols-3 gap-2">
              {OPTIMAL_POSTING_TIMES.map(time => (
                <Button
                  key={time.hour}
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => {
                    if (selectedDate) {
                      handleTimeSlotSelect(time.hour);
                    } else {
                      toast({
                        title: 'Select a date first',
                        description: 'Please select a date from the calendar',
                        variant: 'destructive'
                      });
                    }
                  }}
                >
                  <Clock className="h-3 w-3 mr-1" />
                  {time.label}
                </Button>
              ))}
            </div>
          </div>

          {/* Selected Time Slots Summary */}
          {selectedTimeSlots.size > 0 && (
            <div className="mt-6 p-4 bg-muted rounded-lg">
              <h4 className="text-sm font-medium mb-2">Selected Time Slots</h4>
              <div className="space-y-2">
                {Array.from(selectedTimeSlots.entries()).map(([dateTime, subreddit]) => (
                  <div key={dateTime} className="flex justify-between items-center">
                    <span className="text-sm">
                      {format(new Date(dateTime), 'MMM d, h:mm a')} - r/{subreddit}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        const newSlots = new Map(selectedTimeSlots);
                        newSlots.delete(dateTime);
                        setSelectedTimeSlots(newSlots);
                      }}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
              <Button
                className="w-full mt-4"
                onClick={scheduleAllPosts}
                disabled={selectedTimeSlots.size === 0}
              >
                Schedule {selectedTimeSlots.size * selectedImages.length} Posts
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Time Slot Selection Dialog */}
      <Dialog open={showTimeSlotDialog} onOpenChange={setShowTimeSlotDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              Select Time for {selectedDate && format(selectedDate, 'MMMM d, yyyy')}
            </DialogTitle>
            <DialogDescription>
              Choose the best time to post your content
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Subreddit Selection */}
            <div>
              <label className="text-sm font-medium mb-2 block">Target Subreddit</label>
              <input
                type="text"
                placeholder="e.g., gonewild"
                value={selectedSubreddit}
                onChange={(e) => setSelectedSubreddit(e.target.value)}
                className="w-full px-3 py-2 border rounded-lg"
              />
            </div>

            {/* Time Grid */}
            <div className="grid grid-cols-4 gap-2 max-h-96 overflow-y-auto">
              {TIME_SLOTS.map(slot => {
                const isOptimal = OPTIMAL_POSTING_TIMES.some(t => t.hour === slot.hour);
                return (
                  <Button
                    key={slot.hour}
                    variant={isOptimal ? "default" : "outline"}
                    size="sm"
                    onClick={() => handleTimeSlotSelect(slot.hour)}
                    disabled={!selectedSubreddit}
                  >
                    {slot.label}
                    {isOptimal && <TrendingUp className="h-3 w-3 ml-1" />}
                  </Button>
                );
              })}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowTimeSlotDialog(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
