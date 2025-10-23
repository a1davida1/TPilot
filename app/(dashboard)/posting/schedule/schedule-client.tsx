'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RateLimitInfo, RiskApiResponse, RiskApiSuccess, RiskEvaluationStats, RiskWarning } from './types';

interface ScheduleClientProps { initialResponse: RiskApiSuccess | null; }
interface ToastMessage { id: number; title: string; description: string; variant: 'info' | 'success' | 'warning'; }

const emptyStats: RiskEvaluationStats = { upcomingCount: 0, flaggedSubreddits: 0, removalCount: 0, cooldownConflicts: 0 };
const severityStyles: Record<string, string> = { high: 'border-red-200 bg-red-50 text-red-800', medium: 'border-amber-200 bg-amber-50 text-amber-800', low: 'border-blue-200 bg-blue-50 text-blue-800' };
const severityAccent: Record<string, string> = { high: 'text-red-600', medium: 'text-amber-600', low: 'text-blue-600' };

function formatDate(value: string | null): string {
  if (!value) return '—';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '—' : new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(parsed);
}

function formatCooldownHours(hours?: number): string {
  if (typeof hours !== 'number' || Number.isNaN(hours)) return 'unknown';
  if (hours < 1) return `${Math.round(hours * 60)} minutes`;
  return Number.isInteger(hours) ? `${hours} hours` : `${hours.toFixed(1)} hours`;
}

function highestSeverity(warnings: RiskWarning[]): 'none' | 'low' | 'medium' | 'high' {
  if (warnings.length === 0) return 'none';
  if (warnings.some((warning) => warning.severity === 'high')) return 'high';
  if (warnings.some((warning) => warning.severity === 'medium')) return 'medium';
  return 'low';
}

function buildActionMessages(warning: RiskWarning): Array<{ label: string; message: string; variant: ToastMessage['variant'] }> {
  switch (warning.type) {
    case 'cadence':
      return [{ label: 'Delay post', message: warning.recommendedAction, variant: warning.severity === 'high' ? 'warning' : 'info' }, { label: 'Open scheduler', message: 'Scheduler adjustments coming soon — manually update the slot for now.', variant: 'info' }];
    case 'removal':
      return [{ label: 'Review moderator note', message: warning.metadata?.removalReason ?? 'No moderator reason provided. Double-check your caption before reposting.', variant: 'warning' }, { label: 'Tweak title & caption', message: warning.recommendedAction, variant: 'info' }];
    case 'rule':
    default:
      return [{ label: 'Review subreddit rules', message: warning.metadata?.notes ?? 'Open the subreddit wiki and confirm your post matches current rules.', variant: 'info' }, { label: 'Adjust creative', message: warning.recommendedAction, variant: 'success' }];
  }
}

function ToastStack({ toasts, onDismiss }: { toasts: ToastMessage[]; onDismiss: (id: number) => void }) {
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none fixed bottom-6 right-6 z-50 flex flex-col gap-3">
      {toasts.map((toast) => (
        <div key={toast.id} className={`pointer-events-auto w-72 rounded-lg border bg-white p-4 shadow-lg ${toast.variant === 'warning' ? 'border-amber-300' : toast.variant === 'success' ? 'border-emerald-300' : 'border-blue-200'}`}>
          <div className="flex items-start justify-between">
            <p className="text-sm font-semibold text-slate-900">{toast.title}</p>
            <button type="button" onClick={() => onDismiss(toast.id)} className="ml-2 text-xs font-medium text-slate-500 transition hover:text-slate-700">Dismiss</button>
          </div>
          <p className="mt-2 text-sm text-slate-700">{toast.description}</p>
        </div>
      ))}
    </div>
  );
}

export function ScheduleClient({ initialResponse }: ScheduleClientProps) {
  const [warnings, setWarnings] = useState<RiskWarning[]>(initialResponse?.data.warnings ?? []);
  const [stats, setStats] = useState<RiskEvaluationStats>(initialResponse?.data.stats ?? emptyStats);
  const [generatedAt, setGeneratedAt] = useState<string | null>(initialResponse?.data.generatedAt ?? null);
  const [rateLimit, setRateLimit] = useState<RateLimitInfo | null>(initialResponse?.rateLimit ?? null);
  const [cached, setCached] = useState<boolean>(initialResponse?.cached ?? false);
  const [loading, setLoading] = useState<boolean>(!initialResponse);
  const [error, setError] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const timeoutMap = useRef<Map<number, number>>(new Map());
  const topSeverity = useMemo(() => highestSeverity(warnings), [warnings]);

  const pushToast = useCallback((toast: Omit<ToastMessage, 'id'>) => {
    const id = Number((Date.now() + Math.random()).toFixed(0));
    setToasts((previous) => [...previous, { ...toast, id }]);
    const timeout = window.setTimeout(() => { setToasts((previous) => previous.filter((item) => item.id !== id)); timeoutMap.current.delete(id); }, 6000);
    timeoutMap.current.set(id, timeout);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((previous) => previous.filter((toast) => toast.id !== id));
    const timeoutId = timeoutMap.current.get(id);
    if (timeoutId) { window.clearTimeout(timeoutId); timeoutMap.current.delete(id); }
  }, []);

  useEffect(() => () => { for (const timeoutId of timeoutMap.current.values()) { window.clearTimeout(timeoutId); } timeoutMap.current.clear(); }, []);

  const handleFetch = useCallback(async (forceRefresh: boolean) => {
    try {
      setLoading(true);
      setError(null);
      const query = forceRefresh ? '?refresh=true' : '';
      const response = await fetch(`/api/reddit/risk${query}`, { credentials: 'include', cache: 'no-store' });
      const payload = (await response.json()) as RiskApiResponse;
      if (!response.ok || !('success' in payload) || !payload.success) {
        const message = 'error' in payload && typeof payload.error === 'string' ? payload.error : 'Unable to load risk warnings';
        setError(message);
        setRateLimit('rateLimit' in payload ? payload.rateLimit ?? null : null);
        return;
      }
      setWarnings(payload.data.warnings);
      setStats(payload.data.stats);
      setGeneratedAt(payload.data.generatedAt);
      setRateLimit(payload.rateLimit);
      setCached(payload.cached);
      pushToast({ title: payload.cached ? 'Risk cache used' : 'Risk assessment updated', description: payload.cached ? 'No new risk factors since the last check. Cached safeguards applied.' : 'Latest moderation signals loaded. Review warnings before you publish.', variant: payload.cached ? 'info' : 'success' });
    } catch (fetchError) {
      setError(fetchError instanceof Error ? fetchError.message : 'Unexpected error loading warnings');
    } finally {
      setLoading(false);
    }
  }, [pushToast]);

  useEffect(() => { if (!initialResponse) void handleFetch(false); else setLoading(false); }, [initialResponse, handleFetch]);

  const severityBanner = useMemo(() => {
    if (topSeverity === 'none') return null;
    const style = severityStyles[topSeverity] ?? severityStyles.low;
    const accent = severityAccent[topSeverity] ?? severityAccent.low;
    const headline = topSeverity === 'high' ? 'High risk of moderator action' : topSeverity === 'medium' ? 'Moderate posting risks detected' : 'Heads up: low risk warnings';
    return (
      <section className={`rounded-xl border px-6 py-5 shadow-sm ${style}`}>
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold">{headline}</h2>
            <span className={`text-sm font-medium uppercase tracking-wide ${accent}`}>{warnings.length} warning{warnings.length === 1 ? '' : 's'}</span>
          </div>
          <p className="text-sm">Throttle risky posts before moderators do. Use the targeted actions below to delay, adjust messaging, or rework the asset so your queue stays live.</p>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
            <span>Last generated: {formatDate(generatedAt)}</span>
            {cached && <span className="rounded-full bg-slate-200 px-2 py-1 text-xs text-slate-700">Cached assessment</span>}
            {rateLimit && <span>{rateLimit.remaining} of {rateLimit.limit} safety checks remaining · resets {formatDate(rateLimit.resetAt)}</span>}
          </div>
        </div>
      </section>
    );
  }, [cached, generatedAt, rateLimit, topSeverity, warnings.length]);

  const statsSection = (
    <section className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h3 className="text-lg font-semibold text-slate-900">Risk overview</h3><p className="text-sm text-slate-600">Spot cooldown conflicts and recent moderator trends before publishing.</p></div>
        <div className="flex items-center gap-2">
          <button type="button" className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2" onClick={() => handleFetch(true)} disabled={loading}>{loading ? 'Refreshing…' : 'Run risk check'}</button>
          <button type="button" className="inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2" onClick={() => handleFetch(false)} disabled={loading}>{loading ? 'Loading…' : 'Use cached data'}</button>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <article className="rounded-lg border bg-white p-4 shadow-sm"><p className="text-sm font-medium text-slate-500">Upcoming posts</p><p className="mt-2 text-2xl font-semibold text-slate-900">{stats.upcomingCount}</p><p className="text-xs text-slate-500">Pending or processing posts in the queue.</p></article>
        <article className="rounded-lg border bg-white p-4 shadow-sm"><p className="text-sm font-medium text-slate-500">Cooldown conflicts</p><p className="mt-2 text-2xl font-semibold text-amber-600">{stats.cooldownConflicts}</p><p className="text-xs text-slate-500">Subreddits that need spacing or time buffers.</p></article>
        <article className="rounded-lg border bg-white p-4 shadow-sm"><p className="text-sm font-medium text-slate-500">Recent removals</p><p className="mt-2 text-2xl font-semibold text-red-600">{stats.removalCount}</p><p className="text-xs text-slate-500">Mod actions in the last 30 days.</p></article>
        <article className="rounded-lg border bg-white p-4 shadow-sm"><p className="text-sm font-medium text-slate-500">Communities flagged</p><p className="mt-2 text-2xl font-semibold text-slate-900">{stats.flaggedSubreddits}</p><p className="text-xs text-slate-500">Unique subreddits needing special handling.</p></article>
      </div>
    </section>
  );

  if (loading && !initialResponse) {
    return (<div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10"><div className="animate-pulse rounded-xl border border-slate-200 bg-slate-100 px-6 py-12"><div className="h-4 w-1/3 rounded bg-slate-200" /><div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => (<div key={index} className="h-24 rounded-lg bg-slate-200" />))}</div></div></div>);
  }

  if (error) {
    return (<div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10"><div className="flex flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 px-6 py-16 text-center text-red-700"><h2 className="text-lg font-semibold">Risk service unavailable</h2><p className="mt-2 max-w-md text-sm">{error}</p><button type="button" className="mt-6 inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2" onClick={() => handleFetch(true)}>Try again</button></div><ToastStack toasts={toasts} onDismiss={dismissToast} /></div>);
  }

  if (!loading && warnings.length === 0) {
    return (<div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10">{statsSection}<div className="flex flex-col items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 px-6 py-16 text-center text-emerald-700"><h2 className="text-xl font-semibold">No risk warnings detected</h2><p className="mt-3 max-w-xl text-sm">Your upcoming Reddit posts look compliant based on recent moderator activity and cadence checks. Keep spacing posts 72 hours apart per subreddit and stay within community rules to maintain this streak.</p><button type="button" className="mt-6 inline-flex items-center justify-center rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2" onClick={() => handleFetch(true)}>Re-run safety check</button></div><ToastStack toasts={toasts} onDismiss={dismissToast} /></div>);
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10">
      {severityBanner}
      {statsSection}
      <section className="flex flex-col gap-4">
        <h3 className="text-lg font-semibold text-slate-900">Actionable risk warnings</h3>
        <div className="grid gap-5 lg:grid-cols-2">
          {warnings.map((warning) => {
            const actionMessages = buildActionMessages(warning);
            return (
              <article key={warning.id} className="flex h-full flex-col justify-between rounded-xl border bg-white p-5 shadow-sm">
                <div>
                  <div className="flex items-center justify-between gap-3">
                    <h4 className="text-base font-semibold text-slate-900">{warning.title}</h4>
                    <span className={`rounded-full px-3 py-1 text-xs font-medium uppercase ${severityStyles[warning.severity] ?? severityStyles.low}`}>{warning.severity} risk</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-700">{warning.message}</p>
                  <div className="mt-3 rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-700">
                    <p className="font-medium text-slate-900">Recommended action</p>
                    <p className="mt-1 text-sm">{warning.recommendedAction}</p>
                    <dl className="mt-3 grid gap-1 text-xs text-slate-600">
                      <div className="flex justify-between gap-2"><dt>Subreddit</dt><dd className="font-medium text-slate-800">r/{warning.subreddit}</dd></div>
                      {warning.metadata?.cooldownHours && <div className="flex justify-between gap-2"><dt>Cooldown</dt><dd className="font-medium text-slate-800">{formatCooldownHours(warning.metadata.cooldownHours)}</dd></div>}
                      {warning.metadata?.scheduledFor && <div className="flex justify-between gap-2"><dt>Scheduled for</dt><dd className="font-medium text-slate-800">{formatDate(warning.metadata.scheduledFor)}</dd></div>}
                      {warning.metadata?.removalReason && <div className="flex justify-between gap-2"><dt>Last removal</dt><dd className="font-medium text-slate-800">{warning.metadata.removalReason}</dd></div>}
                    </dl>
                  </div>
                </div>
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  {actionMessages.map((action) => (<button key={`${warning.id}-${action.label}`} type="button" className="rounded-md border px-4 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60" onClick={() => pushToast({ title: action.label, description: action.message, variant: action.variant })}>{action.label}</button>))}
                </div>
              </article>
            );
          })}
        </div>
      </section>
      <ToastStack toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}
