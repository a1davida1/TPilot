import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MobileOptimization } from '@/components/mobile-optimization-v2';
import { StickyRail } from '@/components/ui/sticky-rail';
import { ImageGallery } from '@/components/image-gallery';
import { navigationItems } from '@/config/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import {
  Download,
  CalendarIcon,
  Upload,
  Tag,
  Shield,
  RefreshCw,
} from 'lucide-react';

// Filter Types
interface GalleryFilters {
  dateRange: { from: Date | undefined; to: Date | undefined };
  subreddits: string[];
  protection: 'all' | 'protected' | 'unprotected';
  sortBy: 'newest' | 'oldest' | 'most-viewed' | 'most-liked';
  tags: string[];
}

// Gallery Statistics
interface GalleryStats {
  totalImages: number;
  protectedImages: number;
  totalViews: number;
  storageUsed: string;
}

export default function GalleryPage() {
  const [filters, setFilters] = useState<GalleryFilters>({
    dateRange: { from: undefined, to: undefined },
    subreddits: [],
    protection: 'all',
    sortBy: 'newest',
    tags: [],
  });

  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [_showDatePicker, _setShowDatePicker] = useState(false);

  // Fetch real gallery stats from API
  const { data: stats, isLoading: _statsLoading } = useQuery<GalleryStats>({
    queryKey: ['/api/gallery/stats'],
    staleTime: 60000, // Cache for 1 minute
  });

  const availableSubreddits = [
    'r/FitAndNatural',
    'r/GymGirls',
    'r/FitnessMotivation',
    'r/Workouts',
    'r/HealthyLifestyle',
  ];

  const availableTags = [
    'workout',
    'gym',
    'fitness',
    'motivation',
    'progress',
    'transformation',
  ];

  // Handlers
  const handleFilterChange = (key: keyof GalleryFilters, value: any) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubredditToggle = (subreddit: string) => {
    setFilters((prev) => ({
      ...prev,
      subreddits: prev.subreddits.includes(subreddit)
        ? prev.subreddits.filter((s) => s !== subreddit)
        : [...prev.subreddits, subreddit],
    }));
  };

  const handleTagToggle = (tag: string) => {
    setFilters((prev) => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter((t) => t !== tag)
        : [...prev.tags, tag],
    }));
  };

  const _handleBulkAction = (action: string) => {
    // Bulk action handler - prefix with _ to satisfy unused var lint
    void action; // Acknowledge parameter usage
  };

  const clearFilters = () => {
    setFilters({
      dateRange: { from: undefined, to: undefined },
      subreddits: [],
      protection: 'all',
      sortBy: 'newest',
      tags: [],
    });
  };

  const activeFilterCount = 
    (filters.dateRange.from ? 1 : 0) +
    filters.subreddits.length +
    (filters.protection !== 'all' ? 1 : 0) +
    (filters.sortBy !== 'newest' ? 1 : 0) +
    filters.tags.length;

  return (
    <MobileOptimization 
      navigationItems={navigationItems}
      onQuickAction={() => {
        // Handle upload new image
      }}
    >
      <div className="min-h-screen bg-gradient-to-br from-background via-primary-50/60 to-primary-100/50 dark:from-background dark:via-primary-900/40 dark:to-primary-950/40">
        {/* Animated Background */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-card/10 via-transparent to-[hsl(var(--accent-yellow)/0.12)] opacity-60" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(var(--accent-pink)/0.12),transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,hsl(var(--accent-yellow)/0.08),transparent_55%)]" />
        </div>

        <div className="relative z-10 container mx-auto px-4 py-8">
          {/* Header */}
          <div className="mb-8">
            <h1 className="bg-gradient-to-r from-primary-600 via-accent-rose to-primary-700 bg-clip-text text-4xl font-bold text-transparent drop-shadow-sm dark:from-primary-400 dark:via-accent-rose dark:to-primary-500">
              Media Gallery
            </h1>
            <p className="max-w-2xl text-lg text-muted-foreground">
              Upload, organize, and protect your images. Apply advanced protection to prevent reverse searches.
            </p>
          </div>

          {/* Main Content with Sticky Rail */}
          <StickyRail
            rail={
              <div className="space-y-4">
                {/* Quick Actions */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <Button className="w-full justify-start" variant="default">
                      <Upload className="mr-2 h-4 w-4" />
                      Upload Images
                    </Button>
                    <Button className="w-full justify-start" variant="outline">
                      <Shield className="mr-2 h-4 w-4" />
                      Bulk Protect
                    </Button>
                    <Button className="w-full justify-start" variant="outline">
                      <Download className="mr-2 h-4 w-4" />
                      Export Selected
                    </Button>
                    <Button 
                      className="w-full justify-start" 
                      variant="outline"
                      onClick={() => setSelectedItems([])}
                      disabled={selectedItems.length === 0}
                    >
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Clear Selection ({selectedItems.length})
                    </Button>
                  </CardContent>
                </Card>

                {/* Filters */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">Filters</CardTitle>
                      {activeFilterCount > 0 && (
                        <Button 
                          variant="ghost" 
                          size="sm"
                          onClick={clearFilters}
                        >
                          Clear ({activeFilterCount})
                        </Button>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Date Range */}
                    <div>
                      <Label className="text-sm font-medium mb-2">Date Range</Label>
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            className={cn(
                              "w-full justify-start text-left font-normal",
                              !filters.dateRange.from && "text-muted-foreground"
                            )}
                          >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {filters.dateRange.from ? (
                              filters.dateRange.to ? (
                                <>
                                  {format(filters.dateRange.from, "LLL dd")} -{" "}
                                  {format(filters.dateRange.to, "LLL dd, y")}
                                </>
                              ) : (
                                format(filters.dateRange.from, "PPP")
                              )
                            ) : (
                              <span>Pick a date</span>
                            )}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0" align="start">
                          <Calendar
                            initialFocus
                            mode="range"
                            selected={{
                              from: filters.dateRange.from,
                              to: filters.dateRange.to,
                            }}
                            onSelect={(range: any) => 
                              handleFilterChange('dateRange', range || { from: undefined, to: undefined })
                            }
                            numberOfMonths={2}
                          />
                        </PopoverContent>
                      </Popover>
                    </div>

                    {/* Protection Status */}
                    <div>
                      <Label className="text-sm font-medium mb-2">Protection</Label>
                      <RadioGroup 
                        value={filters.protection} 
                        onValueChange={(value) => handleFilterChange('protection', value)}
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="all" id="all" />
                          <Label htmlFor="all" className="text-sm font-normal">All Images</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="protected" id="protected" />
                          <Label htmlFor="protected" className="text-sm font-normal">Protected Only</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="unprotected" id="unprotected" />
                          <Label htmlFor="unprotected" className="text-sm font-normal">Unprotected Only</Label>
                        </div>
                      </RadioGroup>
                    </div>

                    {/* Sort By */}
                    <div>
                      <Label className="text-sm font-medium mb-2">Sort By</Label>
                      <Select 
                        value={filters.sortBy} 
                        onValueChange={(value) => handleFilterChange('sortBy', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="newest">Newest First</SelectItem>
                          <SelectItem value="oldest">Oldest First</SelectItem>
                          <SelectItem value="most-viewed">Most Viewed</SelectItem>
                          <SelectItem value="most-liked">Most Liked</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Subreddits */}
                    <div>
                      <Label className="text-sm font-medium mb-2">Subreddits</Label>
                      <div className="space-y-2">
                        {availableSubreddits.map((subreddit) => (
                          <div key={subreddit} className="flex items-center space-x-2">
                            <Checkbox 
                              id={subreddit}
                              checked={filters.subreddits.includes(subreddit)}
                              onCheckedChange={() => handleSubredditToggle(subreddit)}
                            />
                            <Label 
                              htmlFor={subreddit} 
                              className="text-sm font-normal cursor-pointer"
                            >
                              {subreddit}
                            </Label>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Tags */}
                    <div>
                      <Label className="text-sm font-medium mb-2">Tags</Label>
                      <div className="flex flex-wrap gap-2">
                        {availableTags.map((tag) => (
                          <Badge
                            key={tag}
                            variant={filters.tags.includes(tag) ? "default" : "outline"}
                            className="cursor-pointer"
                            onClick={() => handleTagToggle(tag)}
                          >
                            <Tag className="mr-1 h-3 w-3" />
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Statistics */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Statistics</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total Images</span>
                        <span className="font-semibold">{stats?.totalImages || 0}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Protected</span>
                        <span className="font-semibold">{stats?.protectedImages || 0}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total Views</span>
                        <span className="font-semibold">{(stats?.totalViews || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Storage Used</span>
                        <span className="font-semibold">{stats?.storageUsed || '0 MB'}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            }
            railPosition="end"
            stickyOnMobile={false}
          >
            {/* Gallery Component */}
            <div className="min-h-[600px]">
              <ImageGallery />
            </div>
          </StickyRail>
        </div>
      </div>
    </MobileOptimization>
  );
}
