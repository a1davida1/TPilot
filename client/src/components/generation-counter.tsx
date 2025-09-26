import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';

type GenerationStats = {
  tier?: string | null;
  dailyLimit?: number | null;
  total?: number;
  thisWeek?: number;
  thisMonth?: number;
  today?: number;
  dailyStreak?: number;
  dailyGenerations?: {
    used?: number | null;
    limit?: number | null;
    remaining?: number | null;
  } | null;
};

interface GenerationCounterProps {
  className?: string;
}

export function GenerationCounter({ className }: GenerationCounterProps) {
  const { user } = useAuth();
  
  const { data: stats, isLoading: isStatsLoading } = useQuery({
    queryKey: ['/api/user/generation-stats'],
    enabled: !!user,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: dailyCount, isLoading: isDailyCountLoading } = useQuery<{ count: number }>({
    queryKey: ['/api/user/daily-generation-count'],
    enabled: !!user,
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const statsData = (stats as GenerationStats | undefined) || {};
  const derivedTier = statsData.tier || user?.tier || 'free';

  const normalizeLimit = (value: number | null | undefined) => {
    if (value === undefined) {
      return undefined;
    }
    if (value === null || value < 0) {
      return null;
    }
    return value;
  };

  const apiLimit = normalizeLimit(statsData.dailyGenerations?.limit ?? statsData.dailyLimit);
  const currentCount = statsData.dailyGenerations?.used ?? statsData.today ?? dailyCount?.count ?? 0;

  // Set generation limits based on tier
  const limits = {
    free: 5,
    starter: 25,
    pro: 100,
    admin: null // unlimited
  };

  const fallbackLimit = normalizeLimit((limits[derivedTier as keyof typeof limits] ?? null) as number | null | undefined);
  const resolvedLimit = (apiLimit ?? fallbackLimit ?? null) as number | null;
  const finiteLimit = typeof resolvedLimit === 'number' && resolvedLimit > 0 ? resolvedLimit : null;
  const isUnlimited = finiteLimit === null;
  const progressPercentage = finiteLimit ? Math.min((currentCount / finiteLimit) * 100, 100) : 0;
  const isNearLimit = finiteLimit ? currentCount >= finiteLimit * 0.8 : false;
  const isAtLimit = finiteLimit ? currentCount >= finiteLimit : false;

  const dailyStreak = statsData.dailyStreak ?? 0;
  const streakBadgeCopy = dailyStreak > 0 ? `${dailyStreak}-day streak` : derivedTier.toUpperCase();

  const streakSubline = dailyStreak > 0
    ? dailyStreak >= 7
      ? "You're on fire! Keep it going."
      : 'Nice streak—keep the momentum!'
    : 'Start building your streak today.';

  const monthTotal = statsData.thisMonth;
  const isLoading = isStatsLoading || isDailyCountLoading;

  return (
    <Card className={`border-0 bg-gradient-to-r from-purple-500/10 to-pink-500/10 ${className}`} data-testid="generation-counter">
      <CardContent className="p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="text-sm font-medium text-foreground">
              Generations Today
            </div>
            <Badge
              variant={isAtLimit ? "destructive" : isNearLimit ? "secondary" : "default"}
              className="text-xs"
            >
              {streakBadgeCopy}
            </Badge>
          </div>

          <div className="text-right">
            <div className="text-lg font-bold text-foreground">
              {currentCount}
              {!isUnlimited && finiteLimit !== null && (
                <span className="text-muted-foreground">/{finiteLimit}</span>
              )}
              {isUnlimited && <span className="text-muted-foreground"> ∞</span>}
            </div>

            {!isUnlimited && (
              <Progress
                value={progressPercentage}
                className="w-16 h-1 mt-1"
              />
            )}
          </div>
        </div>

        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
          <div>{streakSubline}</div>
          {typeof monthTotal === 'number' && !Number.isNaN(monthTotal) && (
            <div>{`This month: ${monthTotal} generations`}</div>
          )}
          {isLoading && <div className="animate-pulse h-3 bg-muted rounded" />}
        </div>

        {isAtLimit && (
          <div className="text-xs text-destructive mt-1">
            Daily limit reached. Upgrade for more generations!
          </div>
        )}
      </CardContent>
    </Card>
  );
}