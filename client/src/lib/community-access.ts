import type { ApiError } from '@/lib/queryClient';

interface CommunityAccessOptions {
  hasFullAccess: boolean;
  isVerified: boolean;
  bannedAt?: string | Date | null;
  suspendedUntil?: string | Date | null;
  error?: ApiError | null;
}

interface CommunityAccessState {
  blocked: boolean;
  title?: string;
  description?: string;
}

function normalizeTimestamp(timestamp?: string | Date | null): Date | null {
  if (!timestamp) {
    return null;
  }

  if (timestamp instanceof Date) {
    return Number.isNaN(timestamp.getTime()) ? null : timestamp;
  }

  const parsedDate = new Date(timestamp);
  return Number.isNaN(parsedDate.getTime()) ? null : parsedDate;
}

function isSuspensionActive(suspendedUntil?: string | Date | null): boolean {
  const normalized = normalizeTimestamp(suspendedUntil);
  if (!normalized) {
    return false;
  }

  return normalized.getTime() > Date.now();
}

export function getCommunityAccessState(options: CommunityAccessOptions): CommunityAccessState {
  const { hasFullAccess, isVerified, bannedAt, suspendedUntil, error } = options;

  const normalizedSuspendedUntil = normalizeTimestamp(suspendedUntil);
  const suspensionActive = isSuspensionActive(normalizedSuspendedUntil);
  const normalizedBannedAt = normalizeTimestamp(bannedAt);
  const isBanned = Boolean(normalizedBannedAt);
  const isForbidden = Boolean(error && error.status === 403);

  if (!hasFullAccess) {
    if (!isVerified) {
      return {
        blocked: true,
        title: 'Verify your email to continue',
        description: 'Verify your email address to unlock Reddit community insights and posting tools.',
      };
    }

    if (isBanned) {
      return {
        blocked: true,
        title: 'Account access restricted',
        description: 'Your account is currently banned. Please contact support to review the restriction.',
      };
    }

    if (suspensionActive) {
      const until = normalizedSuspendedUntil ? normalizedSuspendedUntil.toLocaleString() : null;
      const description = until
        ? `Your account is suspended until ${until}. Resolve the suspension to regain Reddit community access.`
        : 'Your account is suspended. Resolve the suspension to regain Reddit community access.';

      return {
        blocked: true,
        title: 'Account temporarily suspended',
        description,
      };
    }

    return {
      blocked: true,
      title: 'Resolve account restrictions',
      description: 'Please resolve account restrictions to access Reddit communities.',
    };
  }

  if (isForbidden) {
    return {
      blocked: true,
      title: 'Access currently blocked',
      description: 'We could not load communities. Please verify your email or resolve account restrictions and try again.',
    };
  }

  return { blocked: false };
}
