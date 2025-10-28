import type { TopContentEntry } from '../../../../server/services/analytics-insights';

const numberFormatter = new Intl.NumberFormat('en-US');
const percentFormatter = new Intl.NumberFormat('en-US', { maximumFractionDigits: 1 });

interface TopContentTableProps {
  rows: TopContentEntry[];
}

export function TopContentTable({ rows }: TopContentTableProps) {
  if (rows.length === 0) {
    return (
      <section className="rounded-lg border bg-card p-4 shadow-sm">
        <header className="mb-4">
          <h2 className="text-base font-semibold">Top Performing Content</h2>
          <p className="text-xs text-muted-foreground">We will highlight your highest performing posts once data is available.</p>
        </header>
        <div className="text-sm text-muted-foreground">No tracked content in this timeframe.</div>
      </section>
    );
  }

  return (
    <section className="rounded-lg border bg-card p-4 shadow-sm">
      <header className="mb-4">
        <h2 className="text-base font-semibold">Top Performing Content</h2>
        <p className="text-xs text-muted-foreground">Highest performing posts ranked by view volume.</p>
      </header>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-border text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Title</th>
              <th className="px-3 py-2 font-medium">Platform</th>
              <th className="px-3 py-2 font-medium">Subreddit</th>
              <th className="px-3 py-2 font-medium text-right">Views</th>
              <th className="px-3 py-2 font-medium text-right">Engagement</th>
              <th className="px-3 py-2 font-medium text-right">Last Activity</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map(row => (
              <tr key={row.contentId} className="hover:bg-muted/30">
                <td className="px-3 py-2 font-medium text-foreground">
                  {row.primaryTitle ?? 'Untitled content'}
                </td>
                <td className="px-3 py-2 text-muted-foreground">{row.platform}</td>
                <td className="px-3 py-2 text-muted-foreground">{row.subreddit ?? '—'}</td>
                <td className="px-3 py-2 text-right font-medium">
                  {numberFormatter.format(row.totalViews)}
                </td>
                <td className="px-3 py-2 text-right text-muted-foreground">
                  {percentFormatter.format(row.avgEngagementRate)}%
                </td>
                <td className="px-3 py-2 text-right text-muted-foreground">
                  {row.lastDay ? new Date(row.lastDay).toLocaleDateString() : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
