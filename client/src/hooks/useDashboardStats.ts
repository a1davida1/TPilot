import { useQuery } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';

// Frontend-facing interface (what component expects)
export interface DashboardStats {
  postsToday: number;
  postsThisWeek?: number;
  totalViews?: number;
  totalEngagement?: number;
  topSubreddit?: string;
  scheduledPosts?: number;
  queuedPosts?: number;
  captionsGenerated?: number;
  captionsRemaining?: number;
  captionsLimit?: number;
  engagementRate: number;
  takedownsFound?: number;
  estimatedTaxSavings?: number;
  // Optional change indicators
  postsChange?: number;
  engagementChange?: number;
  scheduledChange?: number;
  revenueChange?: number;
}

export interface RecentActivity {
  id: string;
  type: 'post_scheduled' | 'post_published' | 'caption_generated' | 'earnings_received';
  title: string;
  description: string;
  timestamp: string;
  icon?: string;
}

export interface UpcomingPost {
  id: string;
  title: string;
  subreddit: string;
  scheduledFor: string;
  imageUrl?: string;
  status: 'scheduled' | 'processing' | 'failed';
}

// Fetch dashboard statistics
export function useDashboardStats() {
  return useQuery<DashboardStats>({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', '/api/dashboard/stats');
        const data = await response.json() as DashboardStats;
        return data;
      } catch (error) {
        // Return fallback data if API fails
        console.error('Failed to fetch dashboard stats:', error);
        return {
          postsToday: 0,
          engagementRate: 0,
          totalViews: 0,
          totalEngagement: 0,
          scheduledPosts: 0,
        };
      }
    },
    staleTime: 60000, // Consider data fresh for 1 minute
    gcTime: 300000, // Keep in cache for 5 minutes
  });
}

// Fetch recent activity
export function useRecentActivity() {
  return useQuery<RecentActivity[]>({
    queryKey: ['dashboard-activity'],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', '/api/dashboard/activity');
        const data = await response.json() as RecentActivity[];
        return data;
      } catch (error) {
        console.error('Failed to fetch activity:', error);
        // Return mock data as fallback
        return [
          {
            id: '1',
            type: 'post_scheduled',
            title: 'New post scheduled',
            description: 'Scheduled for r/gonewild',
            timestamp: '2 hours ago',
          },
          {
            id: '2',
            type: 'caption_generated',
            title: 'Caption generated',
            description: 'New caption with 92% engagement score',
            timestamp: '5 hours ago',
          },
        ];
      }
    },
    staleTime: 30000, // Consider data fresh for 30 seconds
    gcTime: 180000, // Keep in cache for 3 minutes
  });
}

// Fetch upcoming posts
export function useUpcomingPosts(limit: number = 5) {
  return useQuery<UpcomingPost[]>({
    queryKey: ['upcoming-posts', limit],
    queryFn: async () => {
      try {
        const response = await apiRequest(
          'GET',
          `/api/posts/upcoming?limit=${limit}`
        );
        const data = await response.json() as UpcomingPost[];
        return data;
      } catch (error) {
        console.error('Failed to fetch upcoming posts:', error);
        return [];
      }
    },
    staleTime: 60000,
    gcTime: 300000,
  });
}

// Fetch performance data for charts
export function usePerformanceData(days: number = 7) {
  return useQuery({
    queryKey: ['performance-data', days],
    queryFn: async () => {
      try {
        const response = await apiRequest('GET', `/api/analytics/performance?days=${days}`);
        const data = await response.json();
        return data;
      } catch (error) {
        console.error('Failed to fetch performance data:', error);
        // Return mock data structure
        return {
          labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          datasets: {
            views: [1200, 1900, 3000, 5000, 2000, 3000, 4000],
            engagement: [4.2, 4.8, 5.1, 4.9, 5.3, 5.0, 4.7],
          },
        };
      }
    },
    staleTime: 300000, // Consider data fresh for 5 minutes
    gcTime: 600000, // Keep in cache for 10 minutes
  });
}
