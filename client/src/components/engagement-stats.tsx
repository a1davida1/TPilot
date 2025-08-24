import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { Flame, TrendingUp, Calendar, Target } from 'lucide-react';

export function EngagementStats() {
  const { user } = useAuth();
  
  const { data: stats, isLoading } = useQuery({
    queryKey: ['/api/user/generation-stats'],
    enabled: !!user,
    refetchInterval: 60000, // Refresh every minute
  });

  if (isLoading || !stats) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <TrendingUp className="mr-2 h-5 w-5" />
            Engagement Statistics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-muted rounded w-3/4"></div>
            <div className="h-4 bg-muted rounded w-1/2"></div>
            <div className="h-4 bg-muted rounded w-2/3"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { total, thisWeek, thisMonth, dailyStreak } = stats;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <TrendingUp className="mr-2 h-5 w-5" />
          Engagement Statistics
        </CardTitle>
        <CardDescription>
          Track your content creation progress and streaks
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Daily Streak */}
        <div className="flex items-center justify-between p-4 bg-gradient-to-r from-orange-500/10 to-red-500/10 rounded-lg border">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-orange-500/20 rounded-full">
              <Flame className="h-5 w-5 text-orange-500" />
            </div>
            <div>
              <p className="text-sm font-medium">Daily Streak</p>
              <p className="text-xs text-muted-foreground">Consecutive days creating</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-orange-500">
              {dailyStreak || 0}
            </div>
            <Badge variant="secondary" className="text-xs">
              {dailyStreak > 7 ? 'ON FIRE! 🔥' : dailyStreak > 3 ? 'Great!' : 'Keep going!'}
            </Badge>
          </div>
        </div>

        {/* Generation Stats Grid */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-center mb-2">
              <Target className="h-4 w-4 text-blue-500" />
            </div>
            <div className="text-lg font-bold text-foreground">{total}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </div>
          
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-center mb-2">
              <Calendar className="h-4 w-4 text-green-500" />
            </div>
            <div className="text-lg font-bold text-foreground">{thisWeek}</div>
            <div className="text-xs text-muted-foreground">This Week</div>
          </div>
          
          <div className="text-center p-3 bg-muted/50 rounded-lg">
            <div className="flex items-center justify-center mb-2">
              <TrendingUp className="h-4 w-4 text-purple-500" />
            </div>
            <div className="text-lg font-bold text-foreground">{thisMonth}</div>
            <div className="text-xs text-muted-foreground">This Month</div>
          </div>
        </div>

        {/* Progress Indicators */}
        <div className="space-y-3">
          <div className="flex justify-between text-sm">
            <span>Weekly Goal (10 generations)</span>
            <span>{thisWeek}/10</span>
          </div>
          <Progress value={Math.min((thisWeek / 10) * 100, 100)} className="h-2" />
          
          <div className="flex justify-between text-sm">
            <span>Monthly Goal (50 generations)</span>
            <span>{thisMonth}/50</span>
          </div>
          <Progress value={Math.min((thisMonth / 50) * 100, 100)} className="h-2" />
        </div>

        {/* Motivational Message */}
        <div className="text-center p-3 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-lg border">
          <p className="text-sm font-medium">
            {dailyStreak === 0 && "Start your streak today! 🚀"}
            {dailyStreak >= 1 && dailyStreak < 3 && "Great start! Keep the momentum going! 💪"}
            {dailyStreak >= 3 && dailyStreak < 7 && "You're building a great habit! 🌟"}
            {dailyStreak >= 7 && dailyStreak < 14 && "Fantastic streak! You're on fire! 🔥"}
            {dailyStreak >= 14 && "Incredible dedication! You're a content machine! 🚀✨"}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}