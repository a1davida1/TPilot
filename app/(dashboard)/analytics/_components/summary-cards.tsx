import type { AiSummary, ContentSummary } from '../../../../server/services/analytics-insights';

const numberFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 });
const percentFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

interface SummaryCardsProps {
  contentSummary: ContentSummary;
  aiSummary: AiSummary;
}

export function SummaryCards({ contentSummary, aiSummary }: SummaryCardsProps) {
  const cards = [
    {
      title: 'Total Views',
      value: numberFormatter.format(contentSummary.totalViews),
      description: 'Aggregate impressions captured across all platforms.',
    },
    {
      title: 'Unique Viewers',
      value: numberFormatter.format(contentSummary.uniqueViewers),
      description: 'Distinct sessions engaging with your posts.',
    },
    {
      title: 'Avg. Engagement Rate',
      value: `${percentFormatter.format(contentSummary.avgEngagementRate)}%`,
      description: 'Likes, comments, and shares relative to view volume.',
    },
    {
      title: 'AI Generations',
      value: numberFormatter.format(aiSummary.totalGenerations),
      description: `Daily average ${percentFormatter.format(aiSummary.averagePerDay)} per day.`,
    },
  ];

  return (
    <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {cards.map(card => (
        <article key={card.title} className="rounded-lg border bg-card p-5 shadow-sm">
          <h3 className="text-sm font-medium text-muted-foreground">{card.title}</h3>
          <p className="mt-2 text-2xl font-semibold tracking-tight">{card.value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{card.description}</p>
        </article>
      ))}
    </section>
  );
}
