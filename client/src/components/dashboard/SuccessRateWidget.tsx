/**
 * Success Rate Dashboard Widget (QW-4)
 * 
 * Displays user's success rate with animated counter and trend indicator
 */

import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

interface SuccessRateData {
  successRate: number;
  totalPosts: number;
  successfulPosts: number;
  trend: number;
}

interface SuccessRateWidgetProps {
  daysBack?: number;
  onClick?: () => void;
}

export function SuccessRateWidget({ daysBack = 30, onClick }: SuccessRateWidgetProps) {
  const [animatedRate, setAnimatedRate] = useState(0);

  const { data, isLoading, error } = useQuery<SuccessRateData>({
    queryKey: ['/api/analytics/success-rate', { daysBack }],
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Animate the counter when data changes
  useEffect(() => {
    if (data?.successRate !== undefined) {
      const targetRate = data.successRate;
      const duration = 1000; // 1 second animation
      const steps = 30;
      const increment = targetRate / steps;
      let currentStep = 0;

      const timer = setInterval(() => {
        currentStep++;
        if (currentStep >= steps) {
          setAnimatedRate(targetRate);
          clearInterval(timer);
        } else {
          setAnimatedRate(increment * currentStep);
        }
      }, duration / steps);

      return () => clearInterval(timer);
    }
  }, [data?.successRate]);

  // Color coding based on success rate
  const getColorClass = (rate: number) => {
    if (rate >= 80) return 'text-green-600 dark:text-green-400';
    if (rate >= 50) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getTrendIcon = (trend: number) => {
    if (trend > 5) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (trend < -5) return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-gray-600" />;
  };

  const getTrendBadge = (trend: number) => {
    if (trend > 5) return <Badge variant="default" className="bg-green-600">+{trend}%</Badge>;
    if (trend < -5) return <Badge variant="destructive">{trend}%</Badge>;
    return <Badge variant="secondary">{trend}%</Badge>;
  };

  if (error) {
    return (
      <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={onClick}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Failed to load success rate</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card 
      className={cn(
        "cursor-pointer hover:shadow-md transition-shadow",
        onClick && "hover:border-primary"
      )} 
      onClick={onClick}
    >
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center justify-between">
          <span>Success Rate</span>
          {data && (
            <div className="flex items-center gap-1">
              {getTrendIcon(data.trend)}
            </div>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : data ? (
          <div className="space-y-2">
            <div className={cn("text-4xl font-bold", getColorClass(data.successRate))}>
              {animatedRate.toFixed(1)}%
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {data.successfulPosts} / {data.totalPosts} posts
              </span>
              {getTrendBadge(data.trend)}
            </div>
            {onClick && (
              <p className="text-xs text-muted-foreground mt-2">
                Click for detailed analytics →
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No data available</p>
        )}
      </CardContent>
    </Card>
  );
}
