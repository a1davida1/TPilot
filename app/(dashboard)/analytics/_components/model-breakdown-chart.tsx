'use client';

import { memo } from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface ModelBreakdownChartProps {
  data: Array<{ model: string; count: number }>;
}

const numberFormatter = new Intl.NumberFormat('en-US');

function ModelBreakdownChartComponent({ data }: ModelBreakdownChartProps) {
  const hasData = data.length > 0 && data.some(entry => entry.count > 0);
  const chartData = data.map(entry => ({ ...entry, label: entry.model.replace('x-ai/', '') }));

  return (
    <section className="rounded-lg border bg-card p-4 shadow-sm">
      <header className="mb-4">
        <h2 className="text-base font-semibold">Model Utilization</h2>
        <p className="text-xs text-muted-foreground">
          Relative share of AI models used for caption and prompt generation.
        </p>
      </header>
      <div className="h-72">
        {hasData ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <XAxis type="number" stroke="currentColor" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis
                type="category"
                dataKey="label"
                stroke="currentColor"
                fontSize={12}
                width={140}
              />
              <Tooltip formatter={(value: number) => [numberFormatter.format(value), 'Generations']} />
              <Bar dataKey="count" fill="#0ea5e9" radius={[4, 4, 4, 4]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
            No AI model usage detected for this timeframe.
          </div>
        )}
      </div>
    </section>
  );
}

export const ModelBreakdownChart = memo(ModelBreakdownChartComponent);
