'use client';

import { memo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

interface AiUsageChartProps {
  data: Array<{ day: string; generationCount: number }>;
  totalGenerations: number;
}

const numberFormatter = new Intl.NumberFormat('en-US');

function AiUsageChartComponent({ data, totalGenerations }: AiUsageChartProps) {
  const hasData = data.length > 0 && data.some(point => point.generationCount > 0);

  return (
    <section className="rounded-lg border bg-card p-4 shadow-sm">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">AI Generation Activity</h2>
          <p className="text-xs text-muted-foreground">
            Daily breakdown of prompts executed ({numberFormatter.format(totalGenerations)} total).
          </p>
        </div>
      </header>
      <div className="h-64">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ left: 8, right: 8, top: 16, bottom: 0 }}>
              <defs>
                <linearGradient id="aiUsageGradient" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} />
              <XAxis dataKey="day" stroke="currentColor" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis stroke="currentColor" fontSize={12} tickLine={false} axisLine={false} width={48} />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                formatter={(value: number) => [numberFormatter.format(value), 'Generations']}
              />
              <Area
                type="monotone"
                dataKey="generationCount"
                stroke="#4f46e5"
                strokeWidth={2}
                fill="url(#aiUsageGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No AI usage recorded for this range.
          </div>
        )}
      </div>
    </section>
  );
}

export const AiUsageChart = memo(AiUsageChartComponent);
