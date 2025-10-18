/**
 * Polished Analytics Dashboard with Apple Design
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  TrendingUp, 
  Users, 
  MessageSquare,
  Activity,
  Calendar,
  ChevronDown,
  Download,
  Filter,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { AppleCard, AppleCardContent, AppleCardDescription, AppleCardHeader, AppleCardTitle } from '@/components/ui/apple-card';
import { AppleButton } from '@/components/ui/apple-button';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest } from '@/lib/queryClient';
import { cn } from '@/lib/utils';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
}

function MetricCard({ title, value, change, icon: Icon, trend = 'neutral' }: MetricCardProps) {
  return (
    <AppleCard variant="glass" className="hover:scale-[1.02] transition-all duration-300">
      <AppleCardContent className="p-6">
        <div className="flex items-start justify-between">
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            <p className="text-3xl font-bold tracking-tight">{value}</p>
            {change !== undefined && (
              <div className={cn(
                "flex items-center gap-1 text-sm font-medium",
                trend === 'up' ? 'text-green-600 dark:text-green-400' :
                trend === 'down' ? 'text-red-600 dark:text-red-400' :
                'text-muted-foreground'
              )}>
                {trend === 'up' ? <ArrowUpRight className="h-4 w-4" /> : 
                 trend === 'down' ? <ArrowDownRight className="h-4 w-4" /> : null}
                {change > 0 ? '+' : ''}{change}%
              </div>
            )}
          </div>
          <div className={cn(
            "p-3 rounded-xl bg-gradient-to-br",
            trend === 'up' ? 'from-green-500 to-emerald-600' :
            trend === 'down' ? 'from-red-500 to-pink-600' :
            'from-blue-500 to-purple-600'
          )}>
            <Icon className="h-5 w-5 text-white" />
          </div>
        </div>
      </AppleCardContent>
    </AppleCard>
  );
}

export function PolishedAnalytics() {
  const { user } = useAuth();
  const [timeRange, setTimeRange] = useState('7d');
  
  // Mock data for now - replace with real API calls
  const metrics = [
    {
      title: 'Total Upvotes',
      value: '24.5K',
      change: 12,
      icon: TrendingUp,
      trend: 'up' as const
    },
    {
      title: 'Active Followers',
      value: '8,234',
      change: 5,
      icon: Users,
      trend: 'up' as const
    },
    {
      title: 'Comments',
      value: '1,892',
      change: -3,
      icon: MessageSquare,
      trend: 'down' as const
    },
    {
      title: 'Engagement Rate',
      value: '4.2%',
      change: 0,
      icon: Activity,
      trend: 'neutral' as const
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-7xl mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold tracking-tight">Analytics</h1>
            <p className="text-muted-foreground mt-1">
              Track your content performance and audience engagement
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Time Range Selector */}
            <div className="relative">
              <AppleButton variant="outline" className="min-w-[120px] justify-between">
                <span>{timeRange === '7d' ? '7 Days' : timeRange === '30d' ? '30 Days' : 'All Time'}</span>
                <ChevronDown className="h-4 w-4 ml-2 opacity-50" />
              </AppleButton>
            </div>
            
            <AppleButton variant="outline" size="icon">
              <Filter className="h-4 w-4" />
            </AppleButton>
            
            <AppleButton variant="gradient">
              <Download className="h-4 w-4 mr-2" />
              Export
            </AppleButton>
          </div>
        </div>

        {/* Metrics Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {metrics.map((metric) => (
            <MetricCard key={metric.title} {...metric} />
          ))}
        </div>

        {/* Charts Section */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Engagement Chart */}
          <AppleCard variant="default">
            <AppleCardHeader>
              <AppleCardTitle>Engagement Over Time</AppleCardTitle>
              <AppleCardDescription>
                Daily upvotes and comments for the selected period
              </AppleCardDescription>
            </AppleCardHeader>
            <AppleCardContent>
              {/* Chart placeholder */}
              <div className="h-64 bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg flex items-center justify-center">
                <p className="text-muted-foreground">Chart visualization here</p>
              </div>
            </AppleCardContent>
          </AppleCard>

          {/* Top Performing Content */}
          <AppleCard variant="default">
            <AppleCardHeader>
              <AppleCardTitle>Top Performing Posts</AppleCardTitle>
              <AppleCardDescription>
                Your best content this period
              </AppleCardDescription>
            </AppleCardHeader>
            <AppleCardContent>
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg hover:bg-accent/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded bg-gradient-to-br from-primary/20 to-primary/10" />
                      <div>
                        <p className="font-medium text-sm">Post Title {i}</p>
                        <p className="text-xs text-muted-foreground">r/subreddit • 2 days ago</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-sm">{1000 - i * 100}</p>
                      <p className="text-xs text-muted-foreground">upvotes</p>
                    </div>
                  </div>
                ))}
              </div>
            </AppleCardContent>
          </AppleCard>
        </div>

        {/* Detailed Stats */}
        <AppleCard variant="glass">
          <AppleCardHeader>
            <AppleCardTitle>Detailed Statistics</AppleCardTitle>
            <AppleCardDescription>
              Deep dive into your performance metrics
            </AppleCardDescription>
          </AppleCardHeader>
          <AppleCardContent>
            <div className="grid gap-6 md:grid-cols-3">
              <div className="space-y-3">
                <h3 className="font-semibold text-sm">Posting Activity</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Posts Today</span>
                    <span className="font-medium">3</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Posts This Week</span>
                    <span className="font-medium">18</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Posts This Month</span>
                    <span className="font-medium">67</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold text-sm">Best Times to Post</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Morning (6-12)</span>
                    <span className="font-medium">32% engagement</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Afternoon (12-6)</span>
                    <span className="font-medium">45% engagement</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Evening (6-12)</span>
                    <span className="font-medium">23% engagement</span>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold text-sm">Top Subreddits</h3>
                <div className="space-y-2">
                  {['r/example1', 'r/example2', 'r/example3'].map((sub, i) => (
                    <div key={sub} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{sub}</span>
                      <span className="font-medium">{100 - i * 20}%</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </AppleCardContent>
        </AppleCard>
      </div>
    </div>
  );
}
