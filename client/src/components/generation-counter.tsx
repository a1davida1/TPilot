import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';

interface GenerationCounterProps {
  className?: string;
}

export function GenerationCounter({ className }: GenerationCounterProps) {
  const { user } = useAuth();
  
  const { data: stats } = useQuery({
    queryKey: ['/api/user/generation-stats'],
    enabled: !!user,
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const { data: dailyCount } = useQuery<{ count: number }>({
    queryKey: ['/api/user/daily-generation-count'],
    enabled: !!user,
    refetchInterval: 10000, // Refresh every 10 seconds
  });

  const userTier = user?.tier || 'free';
  const currentCount = dailyCount?.count || 0;
  
  // Set generation limits based on tier
  const limits = {
    free: 5,
    basic: 5,
    pro: 50,
    premium: null // unlimited
  };
  
  const limit = limits[userTier as keyof typeof limits];
  const isUnlimited = limit === null;
  const progressPercentage = isUnlimited ? 0 : Math.min((currentCount / limit) * 100, 100);
  const isNearLimit = !isUnlimited && currentCount >= limit * 0.8;
  const isAtLimit = !isUnlimited && currentCount >= limit;

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
              {userTier.toUpperCase()}
            </Badge>
          </div>
          
          <div className="text-right">
            <div className="text-lg font-bold text-foreground">
              {currentCount}
              {!isUnlimited && <span className="text-muted-foreground">/{limit}</span>}
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
        
        {isAtLimit && (
          <div className="text-xs text-destructive mt-1">
            Daily limit reached. Upgrade for more generations!
          </div>
        )}
      </CardContent>
    </Card>
  );
}