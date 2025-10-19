/**
 * Caption Performance Dashboard
 * Comprehensive analytics for caption A/B testing
 */

import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Award } from 'lucide-react';
import { CaptionInsightsCard } from '@/components/analytics/caption-insights-card';

const COLORS = {
  flirty: '#ec4899',
  slutty: '#a855f7'
};

export default function CaptionPerformanceDashboard() {
  const { data: dashboardData, isLoading } = useQuery({
    queryKey: ['caption-analytics', 'dashboard'],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/caption-analytics/dashboard', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error('Failed to fetch dashboard');
      return res.json();
    }
  });

  const { data: badgesData } = useQuery({
    queryKey: ['caption-analytics', 'badges'],
    queryFn: async () => {
      const token = localStorage.getItem('auth_token');
      const res = await fetch('/api/caption-analytics/badges', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error('Failed to fetch badges');
      return res.json();
    }
  });

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  const captionPerf = dashboardData?.captionPerformance || [];
  const badges = badgesData?.badges || [];
  const earnedBadges = badges.filter((b: any) => b.earned);

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Caption Performance Analytics</h1>
        <p className="text-muted-foreground mt-1">
          Track your caption A/B testing results and optimize your content
        </p>
      </div>

      <CaptionInsightsCard />

      {earnedBadges.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Award className="h-5 w-5 text-yellow-500" />
              Your Achievements ({earnedBadges.length} earned)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {earnedBadges.map((badge: any) => (
                <div key={badge.type} className="p-4 border rounded-lg text-center">
                  <div className="text-4xl mb-2">{badge.icon}</div>
                  <div className="font-semibold">{badge.name}</div>
                  <div className="text-xs text-muted-foreground mt-1">{badge.description}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Style Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left p-2">Style</th>
                  <th className="text-right p-2">Win Rate</th>
                  <th className="text-right p-2">Avg Upvotes</th>
                </tr>
              </thead>
              <tbody>
                {captionPerf.map((item: any) => (
                  <tr key={item.style} className="border-b">
                    <td className="p-2 font-medium capitalize">{item.style}</td>
                    <td className="text-right p-2">{Math.round(parseFloat(item.choice_rate || 0) * 100)}%</td>
                    <td className="text-right p-2">{Math.round(parseFloat(item.avg_upvotes_24h || 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
