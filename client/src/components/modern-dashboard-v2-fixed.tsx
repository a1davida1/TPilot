import React, { useState } from 'react';
import { 
  LayoutDashboard, 
  Image, 
  Calendar, 
  BarChart3,
  Settings,
  Users,
  TrendingUp,
  Clock,
  DollarSign,
  Activity,
  ArrowUp,
  ArrowDown,
  MoreVertical,
  Plus,
  Bell,
  Search
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useLocation } from 'wouter';
import { ErrorBoundary } from './ui/error-boundary';
import { 
  DashboardStatsSkeleton, 
  ActivitySkeleton, 
  TableSkeleton,
  Spinner 
} from './ui/loading-states';
import { 
  useDashboardStats, 
  useRecentActivity, 
  useUpcomingPosts,
  usePerformanceData 
} from '@/hooks/useDashboardStats';

// Stat card with loading state
function StatCard({ 
  title, 
  value, 
  change, 
  icon: Icon,
  loading = false 
}: {
  title: string;
  value: string | number;
  change?: number;
  icon: React.ElementType;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div className="h-4 bg-muted rounded w-24 animate-pulse" />
          <div className="h-8 w-8 bg-muted rounded animate-pulse" />
        </CardHeader>
        <CardContent>
          <div className="h-8 bg-muted rounded w-32 mb-1 animate-pulse" />
          <div className="h-3 bg-muted rounded w-20 animate-pulse" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {change !== undefined && (
          <p className="text-xs text-muted-foreground flex items-center mt-1">
            {change >= 0 ? (
              <ArrowUp className="h-3 w-3 mr-1 text-green-500" aria-label="Increase" />
            ) : (
              <ArrowDown className="h-3 w-3 mr-1 text-red-500" aria-label="Decrease" />
            )}
            <span className={cn(change >= 0 ? 'text-green-500' : 'text-red-500')}>
              {Math.abs(change)}%
            </span>
            <span className="ml-1">from last month</span>
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export function ModernDashboardV2() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Fetch real data using hooks
  const { data: stats, isLoading: statsLoading, error: statsError } = useDashboardStats();
  const { data: activity, isLoading: activityLoading } = useRecentActivity();
  const { data: upcomingPosts, isLoading: postsLoading } = useUpcomingPosts(5);
  const { data: performanceData } = usePerformanceData(7);

  const navItems = [
    { icon: LayoutDashboard, label: 'Overview', path: '/dashboard', badge: null },
    { icon: Image, label: 'Create', path: '/create', badge: null },
    { icon: Calendar, label: 'Content', path: '/content', badge: null },
    { icon: BarChart3, label: 'Analytics', path: '/analytics', badge: null },
    { icon: Users, label: 'Communities', path: '/communities', badge: '12' },
    { icon: Bell, label: 'Notifications', path: '/notifications', badge: '3' },
    { icon: Settings, label: 'Settings', path: '/settings', badge: null },
  ];

  return (
    <ErrorBoundary>
      <div className="flex h-screen overflow-hidden">
        {/* Sidebar */}
        <aside 
          className={cn(
            "border-r bg-background transition-all duration-300 overflow-y-auto",
            sidebarCollapsed ? "w-16" : "w-64"
          )}
          role="navigation"
          aria-label="Main navigation"
        >
          <div className="flex h-full flex-col">
            {/* Logo */}
            <div className="flex h-14 items-center border-b px-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                className="mr-2"
              >
                <LayoutDashboard className="h-5 w-5" />
              </Button>
              {!sidebarCollapsed && (
                <span className="text-lg font-semibold">TPilot</span>
              )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 space-y-1 p-2">
              {navItems.map((item) => {
                const isActive = location === item.path;
                return (
                  <Button
                    key={item.path}
                    variant={isActive ? 'secondary' : 'ghost'}
                    className={cn(
                      "w-full justify-start",
                      sidebarCollapsed && "px-2"
                    )}
                    onClick={() => setLocation(item.path)}
                    aria-current={isActive ? 'page' : undefined}
                    aria-label={item.label}
                  >
                    <item.icon className="h-4 w-4" aria-hidden="true" />
                    {!sidebarCollapsed && (
                      <>
                        <span className="ml-2">{item.label}</span>
                        {item.badge && (
                          <Badge variant="secondary" className="ml-auto">
                            {item.badge}
                          </Badge>
                        )}
                      </>
                    )}
                  </Button>
                );
              })}
            </nav>

            {/* User section */}
            <div className="border-t p-4">
              <div className={cn("flex items-center", sidebarCollapsed && "justify-center")}>
                <Avatar className="h-8 w-8">
                  <AvatarFallback>
                    {user?.firstName?.[0]?.toUpperCase() || 'U'}
                  </AvatarFallback>
                </Avatar>
                {!sidebarCollapsed && (
                  <div className="ml-2 flex-1">
                    <p className="text-sm font-medium">{user?.firstName || 'User'}</p>
                    <p className="text-xs text-muted-foreground">Free Plan</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="container py-6 px-4 lg:px-8">
            {/* Header */}
            <div className="mb-8">
              <h1 className="text-3xl font-bold tracking-tight">
                Welcome back, {user?.firstName || 'there'}
              </h1>
              <p className="text-muted-foreground mt-2">
                Let's create something amazing today
              </p>
            </div>

            {/* Stats Cards */}
            {statsError ? (
              <div className="mb-8 p-4 border rounded-lg bg-destructive/10">
                <p className="text-sm text-destructive">Failed to load statistics. Please try again later.</p>
              </div>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
                <StatCard 
                  title="Total Posts" 
                  value={stats?.totalPosts || 0}
                  change={stats?.postsChange}
                  icon={Image}
                  loading={statsLoading}
                />
                <StatCard 
                  title="Engagement Rate" 
                  value={`${stats?.engagementRate || 0}%`}
                  change={stats?.engagementChange}
                  icon={TrendingUp}
                  loading={statsLoading}
                />
                <StatCard 
                  title="Scheduled" 
                  value={stats?.scheduled || 0}
                  change={stats?.scheduledChange}
                  icon={Clock}
                  loading={statsLoading}
                />
                <StatCard 
                  title="Revenue" 
                  value={stats?.revenue || '$0'}
                  change={stats?.revenueChange}
                  icon={DollarSign}
                  loading={statsLoading}
                />
              </div>
            )}

            {/* Main Grid */}
            <div className="grid gap-6 lg:grid-cols-7">
              {/* Recent Activity */}
              <Card className="lg:col-span-4">
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                  <CardDescription>Your latest actions and updates</CardDescription>
                </CardHeader>
                <CardContent>
                  {activityLoading ? (
                    <ActivitySkeleton />
                  ) : activity?.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      No recent activity
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {activity?.map((item) => (
                        <div key={item.id} className="flex items-start gap-3">
                          <Avatar className="h-8 w-8">
                            <AvatarFallback>
                              {item.type === 'post_scheduled' ? 'S' : 
                               item.type === 'post_published' ? 'P' :
                               item.type === 'caption_generated' ? 'C' : 'E'}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <p className="text-sm font-medium">{item.title}</p>
                            <p className="text-xs text-muted-foreground">
                              {item.description}
                            </p>
                          </div>
                          <span className="text-xs text-muted-foreground">
                            {item.timestamp}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Upcoming Posts */}
              <Card className="lg:col-span-3">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle>Upcoming Posts</CardTitle>
                  <Button 
                    size="icon" 
                    variant="ghost"
                    aria-label="More options"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </CardHeader>
                <CardContent>
                  {postsLoading ? (
                    <div className="space-y-3">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="h-16 bg-muted rounded animate-pulse" />
                      ))}
                    </div>
                  ) : upcomingPosts?.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-muted-foreground mb-4">No scheduled posts</p>
                      <Button size="sm" onClick={() => setLocation('/create')}>
                        <Plus className="h-4 w-4 mr-2" />
                        Schedule Post
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {upcomingPosts?.slice(0, 5).map((post) => (
                        <div key={post.id} className="flex items-center gap-3">
                          <div className="h-12 w-12 rounded bg-muted" />
                          <div className="flex-1">
                            <p className="text-sm font-medium line-clamp-1">
                              {post.title}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              r/{post.subreddit} • {post.scheduledFor}
                            </p>
                          </div>
                          <Badge 
                            variant={post.status === 'scheduled' ? 'default' : 'secondary'}
                          >
                            {post.status}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Performance Chart Placeholder */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle>Performance</CardTitle>
                <CardDescription>Your content performance over time</CardDescription>
              </CardHeader>
              <CardContent>
                {performanceData ? (
                  <div className="h-64 flex items-center justify-center border rounded">
                    <p className="text-muted-foreground">Chart implementation pending</p>
                  </div>
                ) : (
                  <div className="h-64 flex items-center justify-center">
                    <Spinner />
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </ErrorBoundary>
  );
}
