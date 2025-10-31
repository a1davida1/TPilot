/**
 * Engagement Heatmap Component (QW-9)
 * 
 * Visual heatmap showing best posting times
 */

import { useQuery } from '@tanstack/react-query';
import { Clock, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface HeatmapCell {
  day: number;
  hour: number;
  engagement: number;
  postCount: number;
  avgUpvotes: number;
  avgComments: number;
  classification: 'best' | 'good' | 'average' | 'avoid';
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const classificationColors = {
  best: 'bg-green-500 hover:bg-green-600 text-white',
  good: 'bg-blue-400 hover:bg-blue-500 text-white',
  average: 'bg-yellow-300 hover:bg-yellow-400 text-gray-900',
  avoid: 'bg-red-200 hover:bg-red-300 text-gray-700',
};

export function EngagementHeatmap() {
  const [selectedSubreddit, setSelectedSubreddit] = useState<string>('all');

  const { data, isLoading } = useQuery<{ heatmap: HeatmapCell[] }>({
    queryKey: ['engagement-heatmap', selectedSubreddit === 'all' ? undefined : selectedSubreddit],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedSubreddit !== 'all') {
        params.append('subreddit', selectedSubreddit);
      }

      const response = await fetch(`/api/analytics/engagement-heatmap?${params}`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to fetch heatmap');
      }

      return response.json();
    },
    staleTime: 300000, // Cache for 5 minutes
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Engagement Heatmap
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-96" />
        </CardContent>
      </Card>
    );
  }

  if (!data || data.heatmap.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Engagement Heatmap
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center text-muted-foreground py-8">
            Not enough data to generate heatmap. Post more to see your best times!
          </div>
        </CardContent>
      </Card>
    );
  }

  // Organize data into 2D grid
  const grid: HeatmapCell[][] = [];
  for (let day = 0; day < 7; day++) {
    const dayRow: HeatmapCell[] = [];
    for (let hour = 0; hour < 24; hour++) {
      const cell = data.heatmap.find((c) => c.day === day && c.hour === hour);
      dayRow.push(
        cell || {
          day,
          hour,
          engagement: 0,
          postCount: 0,
          avgUpvotes: 0,
          avgComments: 0,
          classification: 'average',
        }
      );
    }
    grid.push(dayRow);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Engagement Heatmap
            </CardTitle>
            <CardDescription>
              Best posting times based on your historical performance
            </CardDescription>
          </div>

          {/* Subreddit Filter */}
          <Select value={selectedSubreddit} onValueChange={setSelectedSubreddit}>
            <SelectTrigger className="w-48">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subreddits</SelectItem>
              {/* TODO: Add user's subreddits dynamically */}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {/* Heatmap Grid */}
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            {/* Hour Labels */}
            <div className="flex mb-2">
              <div className="w-12"></div>
              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="w-8 text-center text-xs text-muted-foreground"
                >
                  {hour % 3 === 0 ? `${hour}` : ''}
                </div>
              ))}
            </div>

            {/* Grid Rows */}
            {grid.map((dayRow, dayIndex) => (
              <div key={dayIndex} className="flex items-center mb-1">
                {/* Day Label */}
                <div className="w-12 text-xs font-medium text-muted-foreground">
                  {DAYS[dayIndex]}
                </div>

                {/* Hour Cells */}
                {dayRow.map((cell) => {
                  const hasData = cell.postCount > 0;

                  return (
                    <div
                      key={`${cell.day}-${cell.hour}`}
                      className={cn(
                        'w-8 h-8 rounded-sm cursor-pointer transition-all',
                        hasData
                          ? classificationColors[cell.classification]
                          : 'bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700'
                      )}
                      title={
                        hasData
                          ? `${DAYS[cell.day]} ${cell.hour}:00\n${cell.postCount} posts\n${cell.avgUpvotes} avg upvotes\n${cell.avgComments} avg comments\nEngagement: ${Math.round(cell.engagement)}`
                          : `${DAYS[cell.day]} ${cell.hour}:00\nNo data`
                      }
                    >
                      {hasData && cell.classification === 'best' && (
                        <div className="flex items-center justify-center h-full">
                          <TrendingUp className="h-3 w-3" />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center justify-center gap-6 mt-6 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-green-500"></div>
            <span>Best</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-blue-400"></div>
            <span>Good</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-yellow-300"></div>
            <span>Average</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-200"></div>
            <span>Avoid</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-gray-100 dark:bg-gray-800 border"></div>
            <span>No Data</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
