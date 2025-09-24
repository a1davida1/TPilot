
import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  AlertCircle,
  ArrowClockwise,
  CalendarClock,
  CheckCircle2,
  CircleAlert,
  Clock3,
  ShieldAlert,
  ShieldCheck
} from 'lucide-react';
import { SubredditComplianceStatus, SubredditRemoval } from '@shared/types/compliance';

interface ComplianceDashboardResponse {
  generatedAt: string;
  subreddits: SubredditComplianceStatus[];
}

interface VerificationCopyMeta {
  label: string;
  tone: string;
  icon: JSX.Element;
  description: string;
}

const verificationCopy: Record<SubredditComplianceStatus['verificationStatus'], VerificationCopyMeta> = {
  verified: {
    label: 'Verified',
    tone: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    icon: <CheckCircle2 className="h-4 w-4" />,
    description: 'All automation signals are aligned with moderator approvals.'
  },
  review: {
    label: 'Under Review',
    tone: 'bg-amber-100 text-amber-700 border-amber-200',
    icon: <AlertCircle className="h-4 w-4" />,
    description: 'High removal rates detected. Compliance engineers are reviewing telemetry.'
  },
  pending: {
    label: 'Pending',
    tone: 'bg-sky-100 text-sky-700 border-sky-200',
    icon: <Clock3 className="h-4 w-4" />,
    description: 'Awaiting sustained healthy activity before unlocking verification tier.'
  }
};

const formatDateTime = (isoTimestamp: string) =>
  new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(isoTimestamp));

const formatRelativeWindow = (isoTimestamp: string) => {
  const now = Date.now();
  const target = new Date(isoTimestamp).getTime();
  if (Number.isNaN(target)) {
    return 'Scheduling unavailable';
  }

  const diff = target - now;
  if (diff <= 0) {
    return 'Available now';
  }

  const diffHours = Math.round(diff / (60 * 60 * 1000));
  if (diffHours < 24) {
    return `${diffHours}h remaining`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d remaining`;
};

const buildShadowbanCopy = (shadowbanned: boolean) =>
  shadowbanned
    ? {
        badgeTone: 'border-red-200 bg-red-50 text-red-700',
        label: 'Shadowbanned',
        icon: <ShieldAlert className="h-4 w-4" />,
        summary: 'Immediate outreach required. Posts are hidden from public feeds.'
      }
    : {
        badgeTone: 'border-emerald-200 bg-emerald-50 text-emerald-700',
        label: 'Clear',
        icon: <ShieldCheck className="h-4 w-4" />,
        summary: 'Distribution healthy. Automation sees expected engagement levels.'
      };

export function ComplianceStatusDashboard() {
  const {
    data,
    error,
    isError,
    isLoading,
    refetch,
    isFetching
  } = useQuery<ComplianceDashboardResponse>({
    queryKey: ['/api/admin/compliance/dashboard'],
    staleTime: 60_000,
    refetchInterval: 120_000
  });

  const subreddits = data?.subreddits ?? [];

  const generatedAtCopy = useMemo(() => {
    if (!data?.generatedAt) {
      return null;
    }
    return formatDateTime(data.generatedAt);
  }, [data?.generatedAt]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-12 text-gray-500">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 animate-spin rounded-full border-b-2 border-purple-500" />
          <span>Compiling moderation telemetry…</span>
        </div>
        <p className="text-sm text-gray-400">Pulling recent Reddit outcomes to hydrate the dashboard.</p>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
        <div className="flex items-start gap-3">
          <CircleAlert className="mt-1 h-5 w-5" />
          <div className="space-y-2">
            <div>
              <p className="text-sm font-semibold">Unable to load compliance insights</p>
              <p className="text-sm text-red-600">
                {(error as Error).message || 'The compliance service did not return a response.'}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <ArrowClockwise className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (subreddits.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-gray-300 bg-gray-50 p-8 text-center">
        <ShieldCheck className="h-10 w-10 text-emerald-500" />
        <div className="space-y-1">
          <p className="text-base font-semibold text-gray-700">No moderation flags recorded yet</p>
          <p className="text-sm text-gray-500">
            Once Reddit posting runs, this dashboard will surface removal trends and cooldown windows in real time.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold text-gray-900">Compliance Telemetry</h2>
          <p className="text-sm text-gray-500">
            Synthesized from recent Reddit posting outcomes across all managed accounts.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <CalendarClock className="h-4 w-4 text-purple-500" />
          <span>Last refresh:</span>
          <span className="font-medium text-gray-700">{generatedAtCopy ?? 'pending'}</span>
          <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <ArrowClockwise className={`mr-2 h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {subreddits.map((subreddit) => {
        const shadowbanCopy = buildShadowbanCopy(subreddit.shadowbanned);
        const verificationMeta = verificationCopy[subreddit.verificationStatus];

        return (
          <Card key={subreddit.name} className="border border-gray-200 bg-white shadow-sm">
            <CardHeader className="flex flex-col gap-3 border-b border-gray-100 bg-gray-50/60">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <span className="text-gray-900">r/{subreddit.name}</span>
                  <Badge variant="outline" className={`flex items-center gap-1 border ${shadowbanCopy.badgeTone}`}>
                    {shadowbanCopy.icon}
                    {shadowbanCopy.label}
                  </Badge>
                  <Badge variant="outline" className={`flex items-center gap-1 ${verificationMeta.tone}`}>
                    {verificationMeta.icon}
                    {verificationMeta.label}
                  </Badge>
                </CardTitle>
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Clock3 className="h-4 w-4 text-purple-500" />
                  <span>Next safe posting window:</span>
                  <span className="font-medium text-gray-800">{formatRelativeWindow(subreddit.nextPostTime)}</span>
                </div>
              </div>
              <CardDescription className="flex flex-col gap-1 text-sm text-gray-500 md:flex-row md:items-center md:justify-between">
                <span>{shadowbanCopy.summary}</span>
                <span>{verificationMeta.description}</span>
              </CardDescription>
            </CardHeader>

            <CardContent className="space-y-6 pt-6">
              <div>
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-900">Latest removals</h4>
                  <span className="text-xs text-gray-500">Showing up to five recent events</span>
                </div>
                {subreddit.recentRemovals.length === 0 ? (
                  <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50/70 p-4 text-sm text-emerald-700">
                    <CheckCircle2 className="h-5 w-5" />
                    <span>Moderation clear &mdash; no removals logged in the recent window.</span>
                  </div>
                ) : (
                  <Table className="mt-3">
                    <TableHeader>
                      <TableRow className="bg-gray-50/60">
                        <TableHead className="text-xs uppercase tracking-wide text-gray-500">Removal ID</TableHead>
                        <TableHead className="text-xs uppercase tracking-wide text-gray-500">Removed At</TableHead>
                        <TableHead className="text-xs uppercase tracking-wide text-gray-500">Reason</TableHead>
                        <TableHead className="text-xs uppercase tracking-wide text-gray-500">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {subreddit.recentRemovals.map((removal) => (
                        <TableRow key={removal.id} className="border-gray-100">
                          <TableCell className="font-mono text-xs text-gray-600">{removal.id}</TableCell>
                          <TableCell className="text-sm text-gray-700">{formatDateTime(removal.removedAt)}</TableCell>
                          <TableCell className="text-sm text-gray-700">{removal.reason}</TableCell>
                          <TableCell className="text-sm text-gray-500">
                            {removal.actionTaken || '—'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
