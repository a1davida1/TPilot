import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ShieldAlert, ShieldCheck, CheckCircle2, Clock3, AlertCircle, RotateCw, CalendarClock } from 'lucide-react';

type Removal = { id: string; removedAt: string; reason: string; actionTaken?: string };
type SubredditComplianceStatus = {
  name: string;
  shadowbanned: boolean;
  verificationStatus: 'pending' | 'review' | 'verified';
  nextPostTime: string;
  recentRemovals: Removal[];
};
type ComplianceDashboardResponse = {
  generatedAt: string;
  subreddits: SubredditComplianceStatus[];
};

const formatDateTime = (iso: string) =>
  new Intl.DateTimeFormat('en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(iso));

export default function ComplianceStatusDashboard() {
  const { data, isLoading, isError, error, refetch, isFetching } =
    useQuery<ComplianceDashboardResponse>({
      queryKey: ['/api/admin/compliance/dashboard'],
      queryFn: async () => {
        const res = await fetch('/api/admin/compliance/dashboard');
        if (!res.ok) throw new Error('Failed to load compliance insights');
        return res.json();
      },
      staleTime: 60_000,
      refetchInterval: 120_000,
    });

  if (isLoading) {
    return <div className="text-sm text-gray-500">Loading compliance insights…</div>;
  }
  if (isError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
        <div className="flex items-start gap-3">
          <AlertCircle className="mt-1 h-5 w-5" />
          <div className="space-y-2">
            <div>
              <p className="text-sm font-semibold">Unable to load compliance insights</p>
              <p className="text-sm text-red-600">{(error as Error).message || 'The service did not return a response.'}</p>
            </div>
            <button className="inline-flex items-center gap-2 text-sm" onClick={() => refetch()} disabled={isFetching}>
              <RotateCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  const generatedAt = data?.generatedAt;
  const subreddits = data?.subreddits ?? [];

  if (subreddits.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
        <ShieldCheck className="h-10 w-10 text-emerald-500" />
        <div className="space-y-1">
          <p className="text-base font-semibold text-gray-700">No moderation flags recorded yet</p>
          <p className="text-sm text-gray-500">Once posting runs, this dashboard will surface removal trends in real time.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold text-gray-900">Compliance Telemetry</h2>
          <p className="text-sm text-gray-500">Synthesized from recent Reddit posting outcomes.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <CalendarClock className="h-4 w-4 text-purple-500" />
          <span>Last refresh:</span>
          <span className="font-medium text-gray-700">{generatedAt ? formatDateTime(generatedAt) : '—'}</span>
          <button className="inline-flex items-center gap-2" onClick={() => refetch()} disabled={isFetching}>
            <RotateCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {subreddits.map((s) => {
        const statusBadge = s.shadowbanned
          ? { tone: 'border-red-200 bg-red-50 text-red-700', label: 'Shadowbanned', icon: <ShieldAlert className="h-4 w-4" /> }
          : { tone: 'border-emerald-200 bg-emerald-50 text-emerald-700', label: 'Clear', icon: <ShieldCheck className="h-4 w-4" /> };

        return (
          <Card key={s.name} className="border border-gray-200 bg-white shadow-sm">
            <CardHeader className="flex flex-col gap-3 border-b border-gray-100 bg-gray-50/80">
              <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <span className="text-gray-900">r/{s.name}</span>
                  <Badge variant="secondary" className={`flex items-center gap-1 border ${statusBadge.tone}`}>
                    {statusBadge.icon}
                    {statusBadge.label}
                  </Badge>
                </CardTitle>
                <Badge variant="outline" className="flex items-center gap-1 text-sm">
                  <CheckCircle2 className="h-4 w-4" />
                  {s.verificationStatus}
                </Badge>
              </div>
              <CardDescription className="text-sm text-gray-500">
                Automated compliance health snapshot with the most recent moderation context.
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6 pt-6">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-inner">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
                    <Clock3 className="h-4 w-4 text-purple-500" />
                    Next Post Window
                  </div>
                  <p className="mt-2 text-lg font-semibold text-gray-900">{formatDateTime(s.nextPostTime)}</p>
                  <p className="mt-1 text-xs text-gray-500">Local timezone adjusted automatically.</p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-inner">
                  <div className="mb-2 text-sm font-medium text-gray-500">Recent Removals</div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>When</TableHead>
                        <TableHead>Reason</TableHead>
                        <TableHead>Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {s.recentRemovals.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="text-sm text-gray-700">{formatDateTime(r.removedAt)}</TableCell>
                          <TableCell className="text-sm text-gray-700">{r.reason}</TableCell>
                          <TableCell className="text-sm text-gray-500">{r.actionTaken || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}