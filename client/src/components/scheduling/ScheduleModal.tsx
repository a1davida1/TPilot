import { useState } from 'react';
import { X, Clock, TrendingUp, Calendar as CalendarIcon, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { useMutation, useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useToast } from '@/hooks/use-toast';
import { authenticatedRequest } from '@/lib/authenticated-request';
import type { UploadedImage } from '@/components/upload/BulkUploadZone';

interface SubredditOption {
  name: string;
  subscribers: number;
  nsfw: boolean;
  optimalTime?: string;
}

interface ScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  image: UploadedImage;
  selectedDate: Date;
  onSchedule: (scheduleData: ScheduleData) => void;
}

interface ScheduleData {
  subreddit: string;
  title: string;
  imageUrl: string;
  scheduledFor: string; // ISO datetime
  nsfw: boolean;
  caption?: string;
}

const OPTIMAL_TIMES = [
  { time: '09:00', label: 'Morning', badge: 'Good' },
  { time: '14:00', label: 'Afternoon', badge: 'Best' },
  { time: '18:00', label: 'Evening', badge: 'Good' },
  { time: '21:00', label: 'Night', badge: 'Best' },
];

export function ScheduleModal({
  isOpen,
  onClose,
  image,
  selectedDate,
  onSchedule,
}: ScheduleModalProps) {
  const [selectedSubreddits, setSelectedSubreddits] = useState<string[]>([]);
  const [selectedTime, setSelectedTime] = useState('14:00');
  const [customTime, setCustomTime] = useState('');
  const [nsfw, setNsfw] = useState(true);
  const [subredditSearch, setSubredditSearch] = useState('');
  const [showSubredditPicker, setShowSubredditPicker] = useState(false);
  const { toast } = useToast();

  // Fetch subreddit recommendations
  const { data: subreddits = [] } = useQuery<SubredditOption[]>({
    queryKey: ['/api/reddit/communities'],
    queryFn: async () => {
      const response = await authenticatedRequest<{ communities: SubredditOption[] }>(
        '/api/reddit/communities',
        'GET'
      );
      return response.communities || [];
    },
  });

  // Filter subreddits based on search
  const filteredSubreddits = subreddits.filter((sub) =>
    sub.name.toLowerCase().includes(subredditSearch.toLowerCase())
  );

  const scheduleMutation = useMutation({
    mutationFn: async (scheduleRequests: ScheduleData[]) => {
      // Create multiple scheduled posts (one per subreddit)
      const promises = scheduleRequests.map((data) =>
        authenticatedRequest('/api/scheduled-posts', 'POST', data)
      );
      return await Promise.all(promises);
    },
    onSuccess: (_, variables) => {
      const count = variables.length;
      toast({
        title: 'Posts scheduled',
        description: `${count} post${count > 1 ? 's' : ''} scheduled for ${format(selectedDate, 'MMM d, yyyy')} at ${selectedTime}`,
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: 'Scheduling failed',
        description: error instanceof Error ? error.message : 'Failed to schedule post',
        variant: 'destructive',
      });
    },
  });

  const handleSchedule = () => {
    if (selectedSubreddits.length === 0) {
      toast({
        title: 'No subreddit selected',
        description: 'Please select at least one subreddit',
        variant: 'destructive',
      });
      return;
    }

    if (!image.caption) {
      toast({
        title: 'No caption',
        description: 'Please add a caption to your image',
        variant: 'destructive',
      });
      return;
    }

    const timeToUse = customTime || selectedTime;
    const [hours, minutes] = timeToUse.split(':').map(Number);
    
    // Create schedule requests for each subreddit with staggered times
    const scheduleRequests: ScheduleData[] = selectedSubreddits.map((subreddit, index) => {
      const scheduledDateTime = new Date(selectedDate);
      scheduledDateTime.setHours(hours, minutes, 0, 0);
      
      // Stagger by 10 minutes for each additional subreddit
      if (index > 0) {
        scheduledDateTime.setMinutes(scheduledDateTime.getMinutes() + (index * 10));
      }

      return {
        subreddit,
        title: image.caption || 'Untitled',
        imageUrl: image.url,
        scheduledFor: scheduledDateTime.toISOString(),
        nsfw,
        caption: image.caption,
      };
    });

    scheduleMutation.mutate(scheduleRequests);
  };

  const toggleSubreddit = (subreddit: string) => {
    setSelectedSubreddits((prev) =>
      prev.includes(subreddit)
        ? prev.filter((s) => s !== subreddit)
        : [...prev, subreddit]
    );
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative z-10 w-full max-w-2xl rounded-lg border bg-background shadow-lg">
        {/* Header */}
        <div className="flex items-center justify-between border-b p-6">
          <div>
            <h2 className="text-lg font-semibold">Schedule Post</h2>
            <p className="text-sm text-muted-foreground">
              {format(selectedDate, 'EEEE, MMMM d, yyyy')}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="max-h-[600px] overflow-y-auto p-6">
          <div className="space-y-6">
            {/* Image Preview */}
            <div className="flex gap-4">
              <div className="h-24 w-24 flex-shrink-0 overflow-hidden rounded-lg bg-muted">
                <img
                  src={image.url}
                  alt="Preview"
                  className="h-full w-full object-cover"
                />
              </div>
              <div className="flex-1">
                <Label className="text-sm font-medium">Caption</Label>
                <p className="mt-1 line-clamp-3 text-sm text-muted-foreground">
                  {image.caption || 'No caption'}
                </p>
              </div>
            </div>

            {/* Subreddit Picker */}
            <div className="space-y-2">
              <Label>Subreddits</Label>
              <Popover open={showSubredditPicker} onOpenChange={setShowSubredditPicker}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start"
                  >
                    {selectedSubreddits.length === 0 ? (
                      <span className="text-muted-foreground">Select subreddits...</span>
                    ) : (
                      <span>{selectedSubreddits.length} selected</span>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[400px] p-0" align="start">
                  <Command>
                    <CommandInput
                      placeholder="Search subreddits..."
                      value={subredditSearch}
                      onValueChange={setSubredditSearch}
                    />
                    <CommandList>
                      <CommandEmpty>No subreddits found</CommandEmpty>
                      <CommandGroup>
                        {filteredSubreddits.slice(0, 10).map((sub) => (
                          <CommandItem
                            key={sub.name}
                            onSelect={() => toggleSubreddit(sub.name)}
                          >
                            <div className="flex w-full items-center justify-between">
                              <div className="flex items-center gap-2">
                                <input
                                  type="checkbox"
                                  checked={selectedSubreddits.includes(sub.name)}
                                  onChange={() => toggleSubreddit(sub.name)}
                                  className="h-4 w-4"
                                />
                                <span className="font-medium">r/{sub.name}</span>
                                {sub.nsfw && (
                                  <Badge variant="destructive" className="text-xs">
                                    NSFW
                                  </Badge>
                                )}
                              </div>
                              <span className="text-xs text-muted-foreground">
                                {(sub.subscribers / 1000).toFixed(0)}k
                              </span>
                            </div>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>

              {/* Selected Subreddits */}
              {selectedSubreddits.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {selectedSubreddits.map((sub) => (
                    <Badge
                      key={sub}
                      variant="secondary"
                      className="gap-1"
                    >
                      r/{sub}
                      <button
                        onClick={() => toggleSubreddit(sub)}
                        className="ml-1 rounded-full hover:bg-muted"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            {/* Time Picker */}
            <div className="space-y-2">
              <Label>Posting Time</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {OPTIMAL_TIMES.map((option) => (
                  <button
                    key={option.time}
                    onClick={() => {
                      setSelectedTime(option.time);
                      setCustomTime('');
                    }}
                    className={cn(
                      'relative rounded-lg border-2 p-3 text-left transition-all',
                      selectedTime === option.time && !customTime
                        ? 'border-primary bg-primary/5'
                        : 'border-muted hover:border-primary/50'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4" />
                      <span className="font-medium">{option.time}</span>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {option.label}
                    </p>
                    {option.badge === 'Best' && (
                      <Badge
                        variant="secondary"
                        className="absolute right-2 top-2 bg-green-500 text-white"
                      >
                        <TrendingUp className="mr-1 h-3 w-3" />
                        Best
                      </Badge>
                    )}
                  </button>
                ))}
              </div>

              {/* Custom Time */}
              <div className="flex items-center gap-2">
                <Input
                  type="time"
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                  placeholder="Custom time"
                  className="flex-1"
                />
                {customTime && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCustomTime('')}
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>

            {/* NSFW Toggle */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label className="text-sm font-medium">Mark as NSFW</Label>
                <p className="text-xs text-muted-foreground">
                  Required for adult content
                </p>
              </div>
              <Switch checked={nsfw} onCheckedChange={setNsfw} />
            </div>

            {/* Multi-Subreddit Info */}
            {selectedSubreddits.length > 1 && (
              <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 p-4">
                <div className="flex items-start gap-2">
                  <CalendarIcon className="h-5 w-5 text-blue-600" />
                  <div>
                    <p className="text-sm font-medium">
                      Posting to {selectedSubreddits.length} subreddits
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Posts will be staggered by 10 minutes to avoid spam detection
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between border-t p-6">
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSchedule}
            disabled={
              selectedSubreddits.length === 0 ||
              !image.caption ||
              scheduleMutation.isPending
            }
          >
            {scheduleMutation.isPending ? (
              <>Scheduling...</>
            ) : (
              <>
                <Plus className="mr-2 h-4 w-4" />
                Schedule Post
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
