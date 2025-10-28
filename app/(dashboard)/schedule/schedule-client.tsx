'use client';

import { useMemo, useState, type FormEvent } from 'react';
import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import type { SerializedScheduleJob } from '@shared/schedule-job-types';

const JOB_QUERY_KEY = ['schedule-jobs'];

interface ScheduleClientProps {
  initialJobs: SerializedScheduleJob[] | null;
}

interface CreateJobPayload {
  jobType: string;
  runAt: string;
  priority: number;
  maxAttempts: number;
  retryBackoffSeconds: number;
  notes: string | null;
  scheduledPost: {
    title: string;
    caption: string | null;
    subreddit: string;
    mediaUrls: string[];
    nsfw: boolean;
    spoiler: boolean;
    flairId: string | null;
    flairText: string | null;
    sendReplies: boolean;
    timezone: string;
  };
}

type JobAction = 'cancel' | 'reschedule' | 'force-run';

interface JobActionVariables {
  jobId: number;
  action: JobAction;
  runAt?: string;
  reason?: string;
}

function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  return fetch(url, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
    },
    ...init,
  }).then(async (response) => {
    if (!response.ok) {
      const message = await response.text();
      throw new Error(message || 'Request failed');
    }
    return response.json() as Promise<T>;
  });
}

async function loadJobs(): Promise<SerializedScheduleJob[]> {
  const data = await fetchJson<{ jobs: SerializedScheduleJob[] }>('/api/schedule/jobs');
  return data.jobs ?? [];
}

async function createJobRequest(payload: CreateJobPayload): Promise<SerializedScheduleJob> {
  const data = await fetchJson<{ job: SerializedScheduleJob }>('/api/schedule/jobs', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.job;
}

async function updateJobRequest(variables: JobActionVariables): Promise<SerializedScheduleJob> {
  const data = await fetchJson<{ job: SerializedScheduleJob }>(`/api/schedule/jobs/${variables.jobId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      action: variables.action,
      runAt: variables.runAt,
      reason: variables.reason,
    }),
  });
  return data.job;
}

function toDateTimeLocal(value: string): string {
  const date = new Date(value);
  const pad = (input: number) => String(input).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function formatRelative(targetIso: string): string {
  const target = new Date(targetIso);
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  const absSeconds = Math.abs(Math.round(diff / 1000));

  const formatter = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' });
  const thresholds: Array<{ unit: Intl.RelativeTimeFormatUnit; divisor: number }> = [
    { unit: 'year', divisor: 1000 * 60 * 60 * 24 * 365 },
    { unit: 'month', divisor: 1000 * 60 * 60 * 24 * 30 },
    { unit: 'day', divisor: 1000 * 60 * 60 * 24 },
    { unit: 'hour', divisor: 1000 * 60 * 60 },
    { unit: 'minute', divisor: 1000 * 60 },
  ];

  for (const threshold of thresholds) {
    const value = diff / threshold.divisor;
    if (Math.abs(Math.round(value)) >= 1) {
      return formatter.format(Math.round(value), threshold.unit);
    }
  }

  if (absSeconds < 30) {
    return 'now';
  }

  return formatter.format(Math.round(diff / 1000), 'seconds');
}

function buildOptimisticJob(payload: CreateJobPayload): SerializedScheduleJob {
  const optimisticId = Math.floor(Math.random() * -1000000);
  const nowIso = new Date().toISOString();

  return {
    id: optimisticId,
    jobType: payload.jobType,
    status: 'pending',
    priority: payload.priority,
    runAt: payload.runAt,
    retryAt: null,
    lockedAt: null,
    lockedBy: null,
    attempts: 0,
    maxAttempts: payload.maxAttempts,
    retryBackoffSeconds: payload.retryBackoffSeconds,
    lastError: null,
    lastRunAt: null,
    payload: {
      mediaCount: payload.scheduledPost.mediaUrls.length,
      notes: payload.notes ?? undefined,
      lastAction: 'create',
      lastActionAt: nowIso,
    },
    createdAt: nowIso,
    updatedAt: nowIso,
    scheduledPost: {
      id: optimisticId,
      title: payload.scheduledPost.title,
      caption: payload.scheduledPost.caption,
      subreddit: payload.scheduledPost.subreddit,
      scheduledFor: payload.runAt,
      status: 'pending',
      nsfw: payload.scheduledPost.nsfw,
      flairId: payload.scheduledPost.flairId,
      flairText: payload.scheduledPost.flairText,
      sendReplies: payload.scheduledPost.sendReplies,
      mediaUrls: payload.scheduledPost.mediaUrls,
    },
    attemptHistory: [],
  };
}

function parseMediaInput(value: string): string[] {
  if (!value.trim()) {
    return [];
  }
  const candidates = value
    .split(/[\s,;\n]+/gu)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

  const unique = new Set<string>();
  const normalised: string[] = [];
  for (const entry of candidates) {
    if (!unique.has(entry)) {
      unique.add(entry);
      normalised.push(entry);
    }
  }
  return normalised;
}

function deriveStatusColour(status: SerializedScheduleJob['status']): string {
  switch (status) {
    case 'succeeded':
      return 'text-emerald-600 bg-emerald-50 border border-emerald-200';
    case 'failed':
      return 'text-rose-600 bg-rose-50 border border-rose-200';
    case 'running':
      return 'text-blue-600 bg-blue-50 border border-blue-200';
    case 'queued':
      return 'text-amber-600 bg-amber-50 border border-amber-200';
    case 'cancelled':
      return 'text-gray-500 bg-gray-100 border border-gray-200';
    default:
      return 'text-sky-700 bg-sky-50 border border-sky-200';
  }
}

function JobsTable({
  jobs,
  onCancel,
  onReschedule,
  onForceRun,
  processingJobId,
}: {
  jobs: SerializedScheduleJob[];
  onCancel: (jobId: number) => void;
  onReschedule: (jobId: number, runAt: string) => void;
  onForceRun: (jobId: number) => void;
  processingJobId: number | null;
}) {
  if (jobs.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 bg-white p-12 text-center text-sm text-gray-600">
        No scheduled jobs yet. Create your first scheduled post to see it here.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {jobs.map((job) => {
        const scheduledFor = job.scheduledPost?.scheduledFor ?? job.runAt;
        const jobIsProcessing = processingJobId === job.id;
        const isTerminal = job.status === 'succeeded' || job.status === 'failed' || job.status === 'cancelled';

        return (
          <article
            key={job.id}
            className="rounded-lg border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md"
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold text-gray-900">{job.scheduledPost?.title ?? job.jobType}</h3>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${deriveStatusColour(job.status)}`}>
                    {job.status.toUpperCase()}
                  </span>
                  {job.status === 'running' && (
                    <span className="text-xs font-medium text-blue-600">Processing…</span>
                  )}
                </div>
                <div className="text-sm text-gray-600">
                  <span className="font-medium text-gray-700">Subreddit:</span> r/{job.scheduledPost?.subreddit ?? 'unknown'}
                </div>
                <div className="text-sm text-gray-600">
                  <span className="font-medium text-gray-700">Scheduled:</span>{' '}
                  {new Date(scheduledFor).toLocaleString()} ({formatRelative(scheduledFor)})
                </div>
                <div className="text-sm text-gray-600">
                  <span className="font-medium text-gray-700">Attempts:</span> {job.attempts} / {job.maxAttempts}
                </div>
                {job.lastError && (
                  <div className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                    {job.lastError}
                  </div>
                )}
                {(() => {
                  const rawNotes = job.payload?.notes;
                  return typeof rawNotes === 'string' ? (
                    <div className="rounded-md border border-blue-100 bg-blue-50 p-3 text-sm text-blue-700">
                      {rawNotes}
                    </div>
                  ) : null;
                })()}
              </div>

              <div className="flex flex-col items-start gap-3 md:items-end">
                <button
                  type="button"
                  onClick={() => onForceRun(job.id)}
                  disabled={jobIsProcessing || isTerminal}
                  className="inline-flex items-center justify-center rounded-md border border-blue-200 px-3 py-2 text-sm font-medium text-blue-600 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Force run now
                </button>
                <RescheduleControl
                  disabled={jobIsProcessing || isTerminal}
                  defaultRunAt={scheduledFor}
                  onReschedule={(newRunAt) => onReschedule(job.id, newRunAt)}
                />
                <button
                  type="button"
                  onClick={() => onCancel(job.id)}
                  disabled={jobIsProcessing || isTerminal}
                  className="inline-flex items-center justify-center rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel job
                </button>
              </div>
            </div>

            {job.attemptHistory.length > 0 && (
              <details className="mt-4 space-y-2 text-sm text-gray-600">
                <summary className="cursor-pointer font-medium text-gray-700">Attempt history</summary>
                <ul className="space-y-2 pt-2">
                  {job.attemptHistory.map((attempt) => (
                    <li key={attempt.id} className="rounded-md border border-gray-200 bg-gray-50 p-3">
                      <div className="font-medium text-gray-700">Attempt #{attempt.attemptNumber}</div>
                      <div>Started: {new Date(attempt.startedAt).toLocaleString()}</div>
                      {attempt.finishedAt && <div>Finished: {new Date(attempt.finishedAt).toLocaleString()}</div>}
                      {attempt.error && (
                        <div className="text-rose-600">Error: {attempt.error}</div>
                      )}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </article>
        );
      })}
    </div>
  );
}

function RescheduleControl({
  disabled,
  defaultRunAt,
  onReschedule,
}: {
  disabled: boolean;
  defaultRunAt: string;
  onReschedule: (runAt: string) => void;
}) {
  const [value, setValue] = useState(toDateTimeLocal(defaultRunAt));

  return (
    <div className="flex flex-col gap-2">
      <input
        type="datetime-local"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        disabled={disabled}
        className="w-56 rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:cursor-not-allowed disabled:bg-gray-100"
      />
      <button
        type="button"
        onClick={() => onReschedule(new Date(value).toISOString())}
        disabled={disabled}
        className="inline-flex items-center justify-center rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
      >
        Reschedule
      </button>
    </div>
  );
}

function ScheduleView({ initialJobs }: { initialJobs: SerializedScheduleJob[] | null }) {
  const queryClient = useQueryClient();
  const [formState, setFormState] = useState({
    jobType: 'reddit-post',
    title: '',
    subreddit: '',
    caption: '',
    runAt: toDateTimeLocal(new Date(Date.now() + 60 * 60 * 1000).toISOString()),
    mediaInput: '',
    nsfw: false,
    sendReplies: true,
    notes: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [processingJobId, setProcessingJobId] = useState<number | null>(null);

  const jobsQuery = useQuery({
    queryKey: JOB_QUERY_KEY,
    queryFn: loadJobs,
    initialData: initialJobs ?? undefined,
    staleTime: 10_000,
  });

  const createMutation = useMutation({
    mutationFn: createJobRequest,
    onMutate: async (variables: CreateJobPayload) => {
      setFormError(null);
      await queryClient.cancelQueries({ queryKey: JOB_QUERY_KEY });
      const previous = queryClient.getQueryData<SerializedScheduleJob[]>(JOB_QUERY_KEY) ?? [];
      const optimisticJob = buildOptimisticJob(variables);
      queryClient.setQueryData<SerializedScheduleJob[]>(JOB_QUERY_KEY, [optimisticJob, ...previous]);
      return { previous, optimisticId: optimisticJob.id };
    },
    onError: (error, _variables, context) => {
      if (context) {
        queryClient.setQueryData<SerializedScheduleJob[]>(JOB_QUERY_KEY, context.previous);
      }
      const message = error instanceof Error ? error.message : 'Unable to create job.';
      setFormError(message);
    },
    onSuccess: (job, _variables, context) => {
      queryClient.setQueryData<SerializedScheduleJob[]>(JOB_QUERY_KEY, (current = []) => {
        const withoutOptimistic = context
          ? current.filter((existing) => existing.id !== context.optimisticId)
          : current;
        return [job, ...withoutOptimistic];
      });
      setFormState((state) => ({
        ...state,
        title: '',
        caption: '',
        mediaInput: '',
        notes: '',
      }));
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: JOB_QUERY_KEY, exact: true }).catch(() => null);
    },
  });

  const actionMutation = useMutation({
    mutationFn: updateJobRequest,
    onMutate: async (variables: JobActionVariables) => {
      setActionError(null);
      setProcessingJobId(variables.jobId);
      await queryClient.cancelQueries({ queryKey: JOB_QUERY_KEY });
      const previous = queryClient.getQueryData<SerializedScheduleJob[]>(JOB_QUERY_KEY) ?? [];
      const updated = previous.map((job) => {
        if (job.id !== variables.jobId) {
          return job;
        }
        const nowIso = new Date().toISOString();
        if (variables.action === 'cancel') {
          return {
            ...job,
            status: 'cancelled',
            lastError: variables.reason ?? job.lastError ?? 'Cancelled by user',
            payload: {
              ...job.payload,
              lastAction: 'cancel',
              lastActionAt: nowIso,
              lastActionNote: variables.reason ?? job.payload.lastActionNote,
            },
          };
        }
        if (variables.action === 'reschedule' && variables.runAt) {
          return {
            ...job,
            status: 'pending',
            runAt: variables.runAt,
            payload: {
              ...job.payload,
              lastAction: 'reschedule',
              lastActionAt: nowIso,
            },
            scheduledPost: job.scheduledPost
              ? {
                  ...job.scheduledPost,
                  scheduledFor: variables.runAt,
                  status: 'pending',
                }
              : null,
          };
        }
        if (variables.action === 'force-run') {
          return {
            ...job,
            status: 'queued',
            runAt: nowIso,
            payload: {
              ...job.payload,
              lastAction: 'force-run',
              lastActionAt: nowIso,
            },
            scheduledPost: job.scheduledPost
              ? {
                  ...job.scheduledPost,
                  scheduledFor: nowIso,
                  status: 'pending',
                }
              : null,
          };
        }
        return job;
      });
      queryClient.setQueryData<SerializedScheduleJob[]>(JOB_QUERY_KEY, updated);
      return { previous };
    },
    onError: (error, _variables, context) => {
      if (context) {
        queryClient.setQueryData<SerializedScheduleJob[]>(JOB_QUERY_KEY, context.previous);
      }
      const message = error instanceof Error ? error.message : 'Failed to update job.';
      setActionError(message);
    },
    onSuccess: (job) => {
      queryClient.setQueryData<SerializedScheduleJob[]>(JOB_QUERY_KEY, (current = []) =>
        current.map((existing) => (existing.id === job.id ? job : existing)),
      );
    },
    onSettled: () => {
      setProcessingJobId(null);
      queryClient.invalidateQueries({ queryKey: JOB_QUERY_KEY, exact: true }).catch(() => null);
    },
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (createMutation.isPending) {
      return;
    }

    const mediaUrls = parseMediaInput(formState.mediaInput);
    const runAtIso = new Date(formState.runAt).toISOString();

    const payload: CreateJobPayload = {
      jobType: formState.jobType.trim() || 'reddit-post',
      runAt: runAtIso,
      priority: 0,
      maxAttempts: 5,
      retryBackoffSeconds: 120,
      notes: formState.notes.trim() ? formState.notes.trim() : null,
      scheduledPost: {
        title: formState.title.trim(),
        caption: formState.caption.trim() ? formState.caption.trim() : null,
        subreddit: formState.subreddit.trim(),
        mediaUrls,
        nsfw: formState.nsfw,
        spoiler: false,
        flairId: null,
        flairText: null,
        sendReplies: formState.sendReplies,
        timezone: 'UTC',
      },
    };

    if (!payload.scheduledPost.title || !payload.scheduledPost.subreddit) {
      setFormError('Title and subreddit are required.');
      return;
    }

    createMutation.mutate(payload);
  };

  const jobs = jobsQuery.data ?? [];

  const statusCounts = useMemo(() => {
    return jobs.reduce<Record<string, number>>((accumulator, job) => {
      accumulator[job.status] = (accumulator[job.status] ?? 0) + 1;
      return accumulator;
    }, {});
  }, [jobs]);

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-10">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-gray-900">Scheduling queue</h1>
        <p className="text-sm text-gray-600">
          Monitor and manage your scheduled Reddit posts. Create new jobs, adjust run times, or trigger urgent posts with a
          single click. Optimistic updates keep the dashboard feeling instant while actions complete securely in the background.
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {['pending', 'queued', 'running', 'succeeded'].map((status) => (
          <div key={status} className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <p className="text-xs uppercase tracking-wide text-gray-500">{status}</p>
            <p className="mt-2 text-2xl font-semibold text-gray-900">{statusCounts[status] ?? 0}</p>
          </div>
        ))}
      </section>

      <section className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-gray-900">Schedule a new job</h2>
        <p className="mt-1 text-sm text-gray-600">
          Provide the details for your scheduled Reddit post. Jobs respect your plan&apos;s scheduling window automatically.
        </p>

        <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={handleSubmit}>
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">Job type</label>
            <input
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formState.jobType}
              onChange={(event) => setFormState((state) => ({ ...state, jobType: event.target.value }))}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">Subreddit</label>
            <input
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formState.subreddit}
              onChange={(event) => setFormState((state) => ({ ...state, subreddit: event.target.value }))}
              placeholder="e.g. GoneWild"
            />
          </div>

          <div className="flex flex-col gap-2 md:col-span-2">
            <label className="text-sm font-medium text-gray-700">Title</label>
            <input
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formState.title}
              onChange={(event) => setFormState((state) => ({ ...state, title: event.target.value }))}
              placeholder="Post headline"
            />
          </div>

          <div className="flex flex-col gap-2 md:col-span-2">
            <label className="text-sm font-medium text-gray-700">Caption</label>
            <textarea
              className="h-24 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formState.caption}
              onChange={(event) => setFormState((state) => ({ ...state, caption: event.target.value }))}
              placeholder="Optional supporting copy"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">Run at</label>
            <input
              type="datetime-local"
              className="rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formState.runAt}
              onChange={(event) => setFormState((state) => ({ ...state, runAt: event.target.value }))}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">Media URLs</label>
            <textarea
              className="h-24 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formState.mediaInput}
              onChange={(event) => setFormState((state) => ({ ...state, mediaInput: event.target.value }))}
              placeholder="One URL per line"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              id="nsfw-toggle"
              type="checkbox"
              checked={formState.nsfw}
              onChange={(event) => setFormState((state) => ({ ...state, nsfw: event.target.checked }))}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="nsfw-toggle" className="text-sm text-gray-700">
              Mark as NSFW
            </label>
          </div>

          <div className="flex items-center gap-2">
            <input
              id="send-replies-toggle"
              type="checkbox"
              checked={formState.sendReplies}
              onChange={(event) => setFormState((state) => ({ ...state, sendReplies: event.target.checked }))}
              className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="send-replies-toggle" className="text-sm text-gray-700">
              Allow subreddit replies
            </label>
          </div>

          <div className="flex flex-col gap-2 md:col-span-2">
            <label className="text-sm font-medium text-gray-700">Internal notes</label>
            <textarea
              className="h-20 rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              value={formState.notes}
              onChange={(event) => setFormState((state) => ({ ...state, notes: event.target.value }))}
              placeholder="Visible only to you. Helpful for campaign context."
            />
          </div>

          {formError && (
            <div className="md:col-span-2">
              <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{formError}</div>
            </div>
          )}

          <div className="md:col-span-2 flex items-center justify-between">
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {createMutation.isPending ? 'Scheduling…' : 'Schedule post'}
            </button>
            {jobsQuery.isFetching && (
              <span className="text-xs text-gray-500">Refreshing jobs…</span>
            )}
          </div>
        </form>
      </section>

      {actionError && (
        <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{actionError}</div>
      )}

      {jobsQuery.isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="animate-pulse rounded-lg border border-gray-200 bg-white p-5">
              <div className="h-5 w-1/3 rounded bg-gray-200" />
              <div className="mt-3 h-4 w-2/3 rounded bg-gray-200" />
              <div className="mt-3 h-3 w-1/2 rounded bg-gray-200" />
              <div className="mt-6 h-8 w-32 rounded bg-gray-200" />
            </div>
          ))}
        </div>
      ) : (
        <JobsTable
          jobs={jobs}
          onCancel={(jobId) => actionMutation.mutate({ jobId, action: 'cancel' })}
          onReschedule={(jobId, runAt) => actionMutation.mutate({ jobId, action: 'reschedule', runAt })}
          onForceRun={(jobId) => actionMutation.mutate({ jobId, action: 'force-run' })}
          processingJobId={processingJobId}
        />
      )}
    </div>
  );
}

export function ScheduleClient({ initialJobs }: ScheduleClientProps) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
          },
          mutations: {
            retry: 0,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ScheduleView initialJobs={initialJobs} />
    </QueryClientProvider>
  );
}

