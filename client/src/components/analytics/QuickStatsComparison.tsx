/**
 * Quick Stats Comparison Component (QW-10)
 * 
 * Displays current vs previous period metrics with percentage changes
 */

import { useQuery } from '@tanstack/react-query';
import { TrendingUp, TrendingDown, Minus, Loader2 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

interface ComparisonMetric {
  label: string;
  current: number;
  previous: number;
  change: number;
  format: 'number' | 'percentage' | 'decimal';
}

interface StatsComparisonData {
  metrics: ComparisonMetric[];
  overallTrend: 'improving' | 'declining' | 'stable';
}

interface QuickStatsComparisonProps {
  range?: '7d' | '30d' | '90d';
}

export function QuickStatsComparison({ range = '30d' }: QuickStatsComparisonProps) {
  const { data, isLoading, error } = useQuery<StatsComparisonData>({
    queryKey: ['/api/analytics/stats-comparison', { range }],
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  const formatValue = (value: number, format: 'number' | 'percentage' | 'decimal') => {
    switch (format) {
      case 'percentage':
        return `${value.toFixed(1)}%`;
      case 'decimal':
        return value.toFixed(2);
      case 'number':
      default:
        return value.toLocaleString();
    }
  };

  const getTrendIcon = (change: number) => {
    if (change > 0) return <TrendingUp className="h-4 w-4 text-green-600" />;
    if (change < 0) return <TrendingDown className="h-4 w-4 text-red-600" />;
    return <Minus className="h-4 w-4 text-gray-600" />;
  };

  const getTrendColor = (change: number) => {
    if (change > 0) return 'text-green-600';
    if (change < 0) return 'text-red-600';
    return 'text-gray-600';
  };

  const getOverallTrendBadge = (trend: 'improving' | 'declining' | 'stable') => {
    switch (trend) {
      case 'improving':
        return (
          <Badge variant="default" className="bg-green-600">
            <TrendingUp className="h-3 w-3 mr-1" />
            Improving
          </Badge>
        );
      case 'declining':
        return (
          <Badge variant="destructive">
            <TrendingDown className="h-3 w-3 mr-1" />
            Declining
          </Badge>
        );
      case 'stable':
      default:
        return (
          <Badge variant="secondary">
            <Minus className="h-3 w-3 mr-1" />
            Stable
          </Badge>
        );
    }
  };

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Quick Stats Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Failed to load comparison data</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Quick Stats Comparison</CardTitle>
          <CardDescription>Current vs previous period</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.metrics.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Quick Stats Comparison</CardTitle>
          <CardDescription>Current vs previous period</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-8">
            Not enough data to compare periods. Keep posting to see your trends!
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Quick Stats Comparison</CardTitle>
            <CardDescription>
              Current vs previous {range === '7d' ? '7 days' : range === '30d' ? '30 days' : '90 days'}
            </CardDescription>
          </div>
          {getOverallTrendBadge(data.overallTrend)}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {data.metrics.map((metric: ComparisonMetric, index: number) => (
            <div
              key={index}
              className="border rounded-lg p-4 hover:bg-accent/50 transition-colors"
            >
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-muted-foreground">
                  {metric.label}
                </span>
                {getTrendIcon(metric.change)}
              </div>

              <div className="flex items-baseline gap-3">
                <div className="text-2xl font-bold">
                  {formatValue(metric.current, metric.format)}
                </div>
                <div className="flex items-center gap-1">
                  <span className={cn('text-sm font-medium', getTrendColor(metric.change))}>
                    {metric.change > 0 ? '+' : ''}
                    {metric.change.toFixed(1)}%
                  </span>
                </div>
              </div>

              <div className="text-xs text-muted-foreground mt-1">
                Previous: {formatValue(metric.previous, metric.format)}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
