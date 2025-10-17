import React from 'react';
import { AppleCard, AppleCardContent, AppleCardDescription, AppleCardHeader, AppleCardTitle } from '@/components/ui/apple-card';
import { AppleButton } from '@/components/ui/apple-button';
import { 
  TrendingUp, 
  Users, 
  FileText, 
  Calendar,
  Sparkles,
  Shield,
  ArrowRight,
  Activity,
  BarChart3,
  Clock
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';

interface StatCard {
  title: string;
  value: string | number;
  change?: string;
  icon: React.ElementType;
  trend?: 'up' | 'down' | 'neutral';
}

const stats: StatCard[] = [
  {
    title: 'Total Posts',
    value: '1,234',
    change: '+12%',
    icon: FileText,
    trend: 'up'
  },
  {
    title: 'Upvotes',
    value: '45.2K',
    change: '+23%',
    icon: TrendingUp,
    trend: 'up'
  },
  {
    title: 'Followers',
    value: '8,912',
    change: '+5%',
    icon: Users,
    trend: 'up'
  },
  {
    title: 'Scheduled',
    value: '18',
    icon: Calendar,
    trend: 'neutral'
  }
];

interface QuickAction {
  title: string;
  description: string;
  icon: React.ElementType;
  href: string;
  color: string;
}

const quickActions: QuickAction[] = [
  {
    title: 'Generate Content',
    description: 'Create AI-powered captions',
    icon: Sparkles,
    href: '/generate',
    color: 'from-blue-500 to-purple-600'
  },
  {
    title: 'Shield Images',
    description: 'Protect your content',
    icon: Shield,
    href: '/image-shield',
    color: 'from-green-500 to-teal-600'
  },
  {
    title: 'Schedule Posts',
    description: 'Plan your content calendar',
    icon: Calendar,
    href: '/post-scheduling',
    color: 'from-orange-500 to-red-600'
  },
  {
    title: 'View Analytics',
    description: 'Track your performance',
    icon: BarChart3,
    href: '/analytics',
    color: 'from-purple-500 to-pink-600'
  }
];

export function AppleDashboard() {
  return (
    <div className="min-h-screen bg-background">
      <div className="container max-w-7xl mx-auto p-6 space-y-8">
        {/* Welcome Header */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">
            Welcome back
          </h1>
          <p className="text-muted-foreground">
            Here's what's happening with your content today.
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <AppleCard key={stat.title} variant="glass">
                <AppleCardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <AppleCardDescription>{stat.title}</AppleCardDescription>
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </AppleCardHeader>
                <AppleCardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                  {stat.change && (
                    <p className={cn(
                      "text-xs",
                      stat.trend === 'up' ? 'text-green-600 dark:text-green-400' : 
                      stat.trend === 'down' ? 'text-red-600 dark:text-red-400' : 
                      'text-muted-foreground'
                    )}>
                      {stat.change} from last month
                    </p>
                  )}
                </AppleCardContent>
              </AppleCard>
            );
          })}
        </div>

        {/* Quick Actions */}
        <div className="space-y-4">
          <h2 className="text-2xl font-semibold tracking-tight">Quick Actions</h2>
          <div className="grid gap-4 md:grid-cols-2">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link key={action.href} to={action.href}>
                  <AppleCard variant="interactive" className="h-full">
                    <AppleCardContent className="pt-6">
                      <div className="flex items-start space-x-4">
                        <div className={cn(
                          "rounded-lg p-2 bg-gradient-to-br",
                          action.color
                        )}>
                          <Icon className="h-6 w-6 text-white" />
                        </div>
                        <div className="space-y-1 flex-1">
                          <h3 className="font-semibold">{action.title}</h3>
                          <p className="text-sm text-muted-foreground">
                            {action.description}
                          </p>
                        </div>
                        <ArrowRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    </AppleCardContent>
                  </AppleCard>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="grid gap-6 lg:grid-cols-2">
          <AppleCard variant="default">
            <AppleCardHeader>
              <AppleCardTitle>Recent Activity</AppleCardTitle>
              <AppleCardDescription>
                Your latest posts and interactions
              </AppleCardDescription>
            </AppleCardHeader>
            <AppleCardContent>
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center space-x-4">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium">
                        Posted to r/example{i}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        2 hours ago • 124 upvotes
                      </p>
                    </div>
                    <Activity className="h-4 w-4 text-muted-foreground" />
                  </div>
                ))}
              </div>
              <div className="mt-6">
                <AppleButton variant="outline" className="w-full">
                  View All Activity
                </AppleButton>
              </div>
            </AppleCardContent>
          </AppleCard>

          <AppleCard variant="default">
            <AppleCardHeader>
              <AppleCardTitle>Upcoming Schedule</AppleCardTitle>
              <AppleCardDescription>
                Posts scheduled for the next 7 days
              </AppleCardDescription>
            </AppleCardHeader>
            <AppleCardContent>
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center space-x-4">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 space-y-1">
                      <p className="text-sm font-medium">
                        Scheduled for tomorrow
                      </p>
                      <p className="text-xs text-muted-foreground">
                        r/subreddit{i} • 2:00 PM EST
                      </p>
                    </div>
                    <AppleButton size="sm" variant="ghost">
                      Edit
                    </AppleButton>
                  </div>
                ))}
              </div>
              <div className="mt-6">
                <Link to="/post-scheduling">
                  <AppleButton variant="gradient" className="w-full">
                    <Calendar className="mr-2 h-4 w-4" />
                    Manage Schedule
                  </AppleButton>
                </Link>
              </div>
            </AppleCardContent>
          </AppleCard>
        </div>
      </div>
    </div>
  );
}
