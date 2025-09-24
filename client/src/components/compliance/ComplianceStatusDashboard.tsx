import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertCircle, CheckCircle2, Clock3, ShieldAlert, ShieldCheck } from 'lucide-react';

/**
 * Describes a single removal event surfaced by the compliance dashboard.
 * - `id`: Stable identifier that can match the originating moderation log entry.
 * - `removedAt`: ISO timestamp for when the content was removed.
 * - `reason`: Moderation or automated rule reason for the removal.
 * - `actionTaken`: Optional follow-up action performed by moderators.
 */
export interface SubredditRemoval {
  id: string;
  removedAt: string;
  reason: string;
  actionTaken?: string;
}

/**
 * Shape of the subreddit level compliance metrics expected from the backend.
 * The dashboard currently renders an array of these objects while backend
 * integration is pending.
 * - `name`: Subreddit name without the leading `r/`.
 * - `shadowbanned`: Flag indicating if automation detected a shadowban.
 * - `verificationStatus`: Either `pending`, `review`, or `verified`.
 * - `nextPostTime`: ISO timestamp representing the next compliant posting window.
 * - `recentRemovals`: Chronological list of the latest moderation removals.
 */
export interface SubredditComplianceStatus {
  name: string;
  shadowbanned: boolean;
  verificationStatus: 'pending' | 'review' | 'verified';
  nextPostTime: string;
  recentRemovals: SubredditRemoval[];
}

/**
 * Temporary mocked data. Replace this structure with live compliance results
 * once the moderation ingestion pipeline is wired up.
 */
const dummyComplianceData: SubredditComplianceStatus[] = [
  {
    name: 'CreatorSupport',
    shadowbanned: false,
    verificationStatus: 'verified',
    nextPostTime: '2024-03-09T18:30:00Z',
    recentRemovals: [
      {
        id: 'CS-2051',
        removedAt: '2024-03-07T21:15:00Z',
        reason: 'Automod: Affiliate link outside allowed domains',
        actionTaken: 'Auto-removed'
      },
      {
        id: 'CS-2049',
        removedAt: '2024-03-06T16:03:00Z',
        reason: 'Manual: Low-effort promotion',
        actionTaken: 'Warning issued'
      },
      {
        id: 'CS-2045',
        removedAt: '2024-03-05T09:47:00Z',
        reason: 'Automod: Missing flair'
      },
      {
        id: 'CS-2041',
        removedAt: '2024-03-04T22:12:00Z',
        reason: 'Manual: Duplicate submission'
      },
      {
        id: 'CS-2036',
        removedAt: '2024-03-03T14:25:00Z',
        reason: 'Automod: Keyword filter triggered',
        actionTaken: 'Awaiting appeal'
      }
    ]
  },
  {
    name: 'GrowthPlaybook',
    shadowbanned: true,
    verificationStatus: 'review',
    nextPostTime: '2024-03-12T02:00:00Z',
    recentRemovals: [
      {
        id: 'GP-1189',
        removedAt: '2024-03-07T05:51:00Z',
        reason: 'Manual: Moderator removal - off topic'
      },
      {
        id: 'GP-1187',
        removedAt: '2024-03-06T12:29:00Z',
        reason: 'Automod: Prohibited service offering',
        actionTaken: 'Escalated to mods'
      },
      {
        id: 'GP-1181',
        removedAt: '2024-03-05T04:40:00Z',
        reason: 'Automod: Spam pattern detected'
      },
      {
        id: 'GP-1178',
        removedAt: '2024-03-04T19:13:00Z',
        reason: 'Manual: Rule 3 - Pricing disclosure'
      },
      {
        id: 'GP-1175',
        removedAt: '2024-03-04T08:32:00Z',
        reason: 'Automod: External link without verification'
      }
    ]
  },
  {
    name: 'AutomationHub',
    shadowbanned: false,
    verificationStatus: 'pending',
    nextPostTime: '2024-03-08T15:15:00Z',
    recentRemovals: [
      {
        id: 'AH-907',
        removedAt: '2024-03-07T17:05:00Z',
        reason: 'Automod: Flair mismatch',
        actionTaken: 'User notified'
      },
      {
        id: 'AH-905',
        removedAt: '2024-03-07T01:22:00Z',
        reason: 'Manual: Content flagged as duplicate'
      },
      {
        id: 'AH-902',
        removedAt: '2024-03-06T10:10:00Z',
        reason: 'Automod: Link shortener blocked'
      },
      {
        id: 'AH-899',
        removedAt: '2024-03-05T20:18:00Z',
        reason: 'Manual: Violates rule 2 - Provide context'
      },
      {
        id: 'AH-895',
        removedAt: '2024-03-05T06:45:00Z',
        reason: 'Automod: Frequent reposts detected',
        actionTaken: 'Cooldown applied'
      }
    ]
  }
];

const verificationCopy: Record<SubredditComplianceStatus['verificationStatus'], { label: string; tone: string }> = {
  verified: { label: 'Verified', tone: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  review: { label: 'In Review', tone: 'bg-amber-100 text-amber-700 border-amber-200' },
  pending: { label: 'Pending Submission', tone: 'bg-sky-100 text-sky-700 border-sky-200' }
};

const formatDateTime = (isoTimestamp: string) =>
  new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(isoTimestamp));

export function ComplianceStatusDashboard() {
  return (
    <div className="space-y-6">
      {dummyComplianceData.map((subreddit) => {
        const verificationMeta = verificationCopy[subreddit.verificationStatus];

        return (
          <Card key={subreddit.name} className="border border-gray-200 bg-white shadow-sm">
            <CardHeader className="flex flex-col gap-3 border-b border-gray-100 bg-gray-50/80">
              <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <span className="text-gray-900">r/{subreddit.name}</span>
                  <Badge
                    variant={subreddit.shadowbanned ? 'destructive' : 'secondary'}
                    className={`flex items-center gap-1 border ${
                      subreddit.shadowbanned
                        ? 'border-red-200 bg-red-50 text-red-700'
                        : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {subreddit.shadowbanned ? (
                      <ShieldAlert className="h-4 w-4" />
                    ) : (
                      <ShieldCheck className="h-4 w-4" />
                    )}
                    {subreddit.shadowbanned ? 'Shadowbanned' : 'Clear'}
                  </Badge>
                </CardTitle>
                <Badge
                  variant="outline"
                  className={`flex items-center gap-1 text-sm ${verificationMeta.tone}`}
                >
                  <CheckCircle2 className="h-4 w-4" />
                  {verificationMeta.label}
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
                  <p className="mt-2 text-lg font-semibold text-gray-900">
                    {formatDateTime(subreddit.nextPostTime)}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">Local timezone adjusted automatically.</p>
                </div>

                <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-inner">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
                    {subreddit.shadowbanned ? (
                      <AlertCircle className="h-4 w-4 text-red-500" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    )}
                    Shadowban Status
                  </div>
                  <p className={`mt-2 text-lg font-semibold ${subreddit.shadowbanned ? 'text-red-600' : 'text-emerald-600'}`}>
                    {subreddit.shadowbanned ? 'Review required' : 'Healthy'}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    {subreddit.shadowbanned
                      ? 'Coordinate with moderators to lift the current restriction.'
                      : 'Automation sees normal distribution for this community.'}
                  </p>
                </div>

                <div className="rounded-lg border border-gray-200 bg-white p-4 shadow-inner">
                  <div className="flex items-center gap-2 text-sm font-medium text-gray-500">
                    <CheckCircle2 className="h-4 w-4 text-sky-500" />
                    Verification Track
                  </div>
                  <p className="mt-2 text-lg font-semibold text-gray-900">{verificationMeta.label}</p>
                  <p className="mt-1 text-xs text-gray-500">
                    {subreddit.verificationStatus === 'verified'
                      ? 'All automation signals are synced with moderator approvals.'
                      : 'Awaiting reviewer confirmation to unlock advanced automations.'}
                  </p>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-gray-900">Latest removals</h4>
                  <span className="text-xs text-gray-500">Last five moderation events</span>
                </div>
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
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { AlertTriangle, CheckCircle, Clock, Shield } from 'lucide-react';

export interface SubredditRemoval {
  id: string;
  removedAt: string;
  reason: string;
  actionTaken?: string;
}

/**
 * Shape of the subreddit level compliance metrics expected from the backend.
 * The dashboard currently renders an array of these objects while backend
 * integration is pending.
 * - `name`: Subreddit name without the leading `r/`.
 * - `shadowbanned`: Flag indicating if automation detected a shadowban.
 * - `verificationStatus`: Either `pending`, `review`, or `verified`.
 * - `nextPostTime`: ISO timestamp representing the next compliant posting window.
 * - `recentRemovals`: Chronological list of the latest moderation removals.
 */
export interface SubredditComplianceStatus {
  name: string;
  shadowbanned: boolean;
  verificationStatus: 'pending' | 'review' | 'verified';
  nextPostTime: string;
  recentRemovals: SubredditRemoval[];
}

/**
 * Temporary mocked data. Replace this structure with live compliance results
 * once the moderation ingestion pipeline is wired up.
 *
 * Backend teams can refer to `docs/compliance-dashboard-data.md` for the
 * contract powering this dashboard. When the API is ready, swap this array
 * with the fetched response typed as `SubredditComplianceStatus[]` to unlock
 * live telemetry without updating the UI layer.
 */
const dummyComplianceData: SubredditComplianceStatus[] = [
  {
    name: 'CreatorSupport',
    shadowbanned: false,
    verificationStatus: 'verified',
    nextPostTime: '2024-03-09T18:30:00Z',
    recentRemovals: [
      {
        id: 'CS-2051',
        removedAt: '2024-03-07T21:15:00Z',
        reason: 'Automod: Affiliate link outside allowed domains',
        actionTaken: 'Auto-removed'
      },
      {
        id: 'CS-2049',
        removedAt: '2024-03-06T16:03:00Z',
        reason: 'Manual: Low-effort promotion',
        actionTaken: 'Warning issued'
      },
      {
        id: 'CS-2045',
        removedAt: '2024-03-05T09:47:00Z',
        reason: 'Automod: Missing flair'
      },
      {
        id: 'CS-2043',
        removedAt: '2024-03-04T14:22:00Z',
        reason: 'Manual: Rule violation - excessive self-promotion',
        actionTaken: 'Temporary ban'
      },
      {
        id: 'CS-2041',
        removedAt: '2024-03-03T11:30:00Z',
        reason: 'Automod: Title format violation'
      }
    ]
  },
  {
    name: 'OnlyFansPromotion',
    shadowbanned: true,
    verificationStatus: 'review',
    nextPostTime: '2024-03-10T12:00:00Z',
    recentRemovals: [
      {
        id: 'OF-1823',
        removedAt: '2024-03-08T09:15:00Z',
        reason: 'Shadowban detected - posts not visible',
        actionTaken: 'Account review initiated'
      },
      {
        id: 'OF-1821',
        removedAt: '2024-03-07T16:45:00Z',
        reason: 'Automod: Watermark policy violation',
        actionTaken: 'Auto-removed'
      },
      {
        id: 'OF-1819',
        removedAt: '2024-03-06T13:20:00Z',
        reason: 'Manual: Spam filter triggered',
        actionTaken: 'Manual review'
      }
    ]
  },
  {
    name: 'AdultCreators',
    shadowbanned: false,
    verificationStatus: 'pending',
    nextPostTime: '2024-03-09T20:45:00Z',
    recentRemovals: [
      {
        id: 'AC-3456',
        removedAt: '2024-03-08T14:30:00Z',
        reason: 'Manual: Content quality standards',
        actionTaken: 'Feedback provided'
      },
      {
        id: 'AC-3454',
        removedAt: '2024-03-07T10:15:00Z',
        reason: 'Automod: Account age requirement',
        actionTaken: 'Auto-removed'
      }
    ]
  },
  {
    name: 'ContentCreatorHub',
    shadowbanned: false,
    verificationStatus: 'verified',
    nextPostTime: '2024-03-09T15:20:00Z',
    recentRemovals: []
  }
];

const getVerificationStatusBadge = (status: SubredditComplianceStatus['verificationStatus']) => {
  switch (status) {
    case 'verified':
      return (
        <Badge variant="default" className="bg-green-100 text-green-700 border-green-200">
          <CheckCircle className="h-3 w-3 mr-1" />
          Verified
        </Badge>
      );
    case 'review':
      return (
        <Badge variant="secondary" className="bg-yellow-100 text-yellow-700 border-yellow-200">
          <Clock className="h-3 w-3 mr-1" />
          Under Review
        </Badge>
      );
    case 'pending':
      return (
        <Badge variant="outline" className="bg-gray-100 text-gray-700 border-gray-200">
          <Clock className="h-3 w-3 mr-1" />
          Pending
        </Badge>
      );
    default:
      return null;
  }
};

const getShadowbanBadge = (shadowbanned: boolean) => {
  if (shadowbanned) {
    return (
      <Badge variant="destructive" className="bg-red-100 text-red-700 border-red-200">
        <AlertTriangle className="h-3 w-3 mr-1" />
        Shadowbanned
      </Badge>
    );
  }
  return (
    <Badge variant="default" className="bg-green-100 text-green-700 border-green-200">
      <Shield className="h-3 w-3 mr-1" />
      Active
    </Badge>
  );
};

const formatDateTime = (isoString: string) => {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short'
  }).format(new Date(isoString));
};

const formatNextPostTime = (isoString: string) => {
  const now = new Date();
  const postTime = new Date(isoString);
  const diffMs = postTime.getTime() - now.getTime();
  
  if (diffMs <= 0) {
    return 'Available now';
  }
  
  const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
  if (diffHours < 24) {
    return `${diffHours}h remaining`;
  }
  
  const diffDays = Math.ceil(diffHours / 24);
  return `${diffDays}d remaining`;
};

export function ComplianceStatusDashboard() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-gray-900">
            Compliance Dashboard
          </h2>
          <p className="text-gray-600 mt-1">
            Monitor subreddit compliance status and moderation activity
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          Live Data Coming Soon
        </Badge>
      </div>

      {dummyComplianceData.map((subreddit) => {
        const hasRemovals = subreddit.recentRemovals.length > 0;
        
        return (
          <Card key={subreddit.name} className="bg-white/80 backdrop-blur-sm border-0 shadow-xl">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-3">
                  <span className="text-lg font-semibold text-gray-900">
                    r/{subreddit.name}
                  </span>
                  {getShadowbanBadge(subreddit.shadowbanned)}
                  {getVerificationStatusBadge(subreddit.verificationStatus)}
                </CardTitle>
                <div className="text-sm text-gray-500">
                  Next post: {formatNextPostTime(subreddit.nextPostTime)}
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              {!hasRemovals ? (
                <div className="text-center py-8">
                  <CheckCircle className="h-12 w-12 text-green-400 mx-auto mb-3" />
                  <p className="text-gray-500 font-medium">No recent removals</p>
                  <p className="text-sm text-gray-400 mt-1">
                    This subreddit has a clean moderation record
                  </p>
                </div>
              ) : (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    Recent Removals ({subreddit.recentRemovals.length})
                  </h4>
                  <Table>
                    <TableHeader>
                      <TableRow className="border-gray-200">
                        <TableHead className="text-xs uppercase tracking-wide text-gray-500">ID</TableHead>
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
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
