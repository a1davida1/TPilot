import { redirect } from 'next/navigation';

import { getServerUserId } from '../../lib/server-auth';
import { getAnalyticsDashboardData } from '../../../server/services/analytics-insights';

import { SummaryCards } from './_components/summary-cards';
import { ContentPerformanceChart } from './_components/content-performance-chart';
import { AiUsageChart } from './_components/ai-usage-chart';
import { ModelBreakdownChart } from './_components/model-breakdown-chart';
import { TopContentTable } from './_components/top-content-table';

export const revalidate = 60;

function getDateRange(days: number): { startDate: Date; endDate: Date } {
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setHours(0, 0, 0, 0);
  endDate.setHours(23, 59, 59, 999);
  startDate.setDate(startDate.getDate() - (days - 1));
  return { startDate, endDate };
}

const LOOKBACK_DAYS = 30;

export default async function AnalyticsPage() {
  const userId = getServerUserId();
  if (!userId) {
    redirect('/login');
  }

  const { startDate, endDate } = getDateRange(LOOKBACK_DAYS);
  const dashboardData = await getAnalyticsDashboardData(userId, {
    startDate,
    endDate,
    topLimit: 8,
  });

  const contentSeries = dashboardData.contentSeries.map(point => ({
    day: point.day.toISOString().slice(0, 10),
    totalViews: point.totalViews,
    avgEngagementRate: Number(point.avgEngagementRate.toFixed(2)),
  }));

  const aiSeries = dashboardData.aiSeries.map(point => ({
    day: point.day.toISOString().slice(0, 10),
    generationCount: point.generationCount,
  }));

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Performance Analytics</h1>
        <p className="text-muted-foreground">
          Insight into your content reach, viewer engagement, and AI usage over the past {LOOKBACK_DAYS} days.
        </p>
      </header>

      <SummaryCards
        contentSummary={dashboardData.contentSummary}
        aiSummary={dashboardData.aiSummary}
      />

      <section className="grid gap-6 lg:grid-cols-2">
        <ContentPerformanceChart data={contentSeries} />
        <AiUsageChart data={aiSeries} totalGenerations={dashboardData.aiSummary.totalGenerations} />
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <ModelBreakdownChart data={dashboardData.modelBreakdown} />
        <TopContentTable rows={dashboardData.topContent} />
      </section>
    </div>
  );
}
