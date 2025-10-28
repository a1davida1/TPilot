'use client';

import { memo } from 'react';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface ContentPerformanceChartProps {
  data: Array<{ day: string; totalViews: number; avgEngagementRate: number }>;
}

const numberFormatter = new Intl.NumberFormat('en-US');

function ContentPerformanceChartComponent({ data }: ContentPerformanceChartProps) {
  const hasData = data.length > 0 && data.some(point => point.totalViews > 0);

  return (
    <section className="rounded-lg border bg-card p-4 shadow-sm">
      <header className="mb-4">
        <h2 className="text-base font-semibold">Daily Content Performance</h2>
        <p className="text-xs text-muted-foreground">
          Views (bars) with engagement rate trend (line).
        </p>
      </header>
      <div className="h-64">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ left: 8, right: 8, top: 16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
              <XAxis dataKey="day" stroke="currentColor" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis
                yAxisId="views"
                stroke="currentColor"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                width={48}
              />
              <YAxis
                yAxisId="engagement"
                orientation="right"
                stroke="currentColor"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                width={48}
                tickFormatter={value => `${value}%`}
              />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                formatter={(value: number, name: string) => {
                  if (name === 'avgEngagementRate') {
                    return [`${value.toFixed(1)}%`, 'Engagement'];
                  }
                  return [numberFormatter.format(value), 'Views'];
                }}
              />
              <Bar yAxisId="views" dataKey="totalViews" fill="#1d4ed8" radius={[4, 4, 0, 0]} />
              <Line
                yAxisId="engagement"
                type="monotone"
                dataKey="avgEngagementRate"
                stroke="#f97316"
                strokeWidth={2}
                dot={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No view activity recorded for this range.
          </div>
        )}
      </div>
    </section>
  );
}

export const ContentPerformanceChart = memo(ContentPerformanceChartComponent);
