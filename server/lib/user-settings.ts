import { type UserPreference, type User } from '@shared/schema';

type ThemeOption = 'light' | 'dark' | 'auto';
export type PreferredPlatform = 'reddit' | 'twitter' | 'instagram' | 'onlyfans' | 'fansly';

export interface UserSettingsViewModel {
  theme: ThemeOption;
  notifications: boolean;
  emailUpdates: boolean;
  autoSave: boolean;
  defaultPlatform: PreferredPlatform;
  onlyFansUrl: string;
  fanslyUrl: string;
  displayName: string;
  email: string;
  bio: string;
}

const DEFAULT_SETTINGS: UserSettingsViewModel = {
  theme: 'light',
  notifications: true,
  emailUpdates: true,
  autoSave: true,
  defaultPlatform: 'reddit',
  onlyFansUrl: '',
  fanslyUrl: '',
  displayName: '',
  email: '',
  bio: ''
};

const PROMOTIONAL_DOMAINS: Record<'onlyfans' | 'fansly', string> = {
  onlyfans: 'onlyfans.com',
  fansly: 'fansly.com'
};

export function normalizePromotionalUrl(url: string, platform: 'onlyfans' | 'fansly'): string {
  const trimmed = url.trim();
  if (!trimmed) {
    throw new Error(`A ${platform} URL cannot be empty.`);
  }

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(withProtocol);
  } catch (_error) {
    throw new Error(`Invalid ${platform} URL format.`);
  }

  const hostname = parsed.hostname.toLowerCase();
  const allowedDomain = PROMOTIONAL_DOMAINS[platform];
  if (!hostname.endsWith(allowedDomain)) {
    throw new Error(`URL must be hosted on ${allowedDomain}.`);
  }

  const sanitizedPath = parsed.pathname.replace(/\/+$/, '');
  if (!sanitizedPath || sanitizedPath === '/') {
    throw new Error('URL must include a profile path.');
  }

  return `https://${hostname}${sanitizedPath}`;
}

function extractDefaultPlatform(preferences: UserPreference | undefined | null): PreferredPlatform {
  const platformSettings = (preferences?.platformSettings ?? {}) as Record<string, unknown>;
  const candidate = typeof platformSettings.defaultPlatform === 'string'
    ? platformSettings.defaultPlatform.toLowerCase()
    : undefined;

  switch (candidate) {
    case 'twitter':
    case 'instagram':
    case 'onlyfans':
    case 'fansly':
      return candidate;
    default:
      return 'reddit';
  }
}

export function buildUserSettingsResponse(
  user: User | undefined,
  preferences: UserPreference | undefined
): UserSettingsViewModel {
  const settings: UserSettingsViewModel = {
    ...DEFAULT_SETTINGS,
    theme: (preferences?.theme as ThemeOption | undefined) ?? DEFAULT_SETTINGS.theme,
    notifications: preferences?.pushNotifications ?? DEFAULT_SETTINGS.notifications,
    emailUpdates: preferences?.emailNotifications ?? DEFAULT_SETTINGS.emailUpdates,
    autoSave: preferences?.autoSchedulePosts ?? DEFAULT_SETTINGS.autoSave,
    defaultPlatform: extractDefaultPlatform(preferences),
    onlyFansUrl: preferences?.onlyFansUrl?.trim() ?? DEFAULT_SETTINGS.onlyFansUrl,
    fanslyUrl: preferences?.fanslyUrl?.trim() ?? DEFAULT_SETTINGS.fanslyUrl,
    displayName: user?.username ?? DEFAULT_SETTINGS.displayName,
    email: user?.email ?? DEFAULT_SETTINGS.email,
    bio: user?.bio ?? DEFAULT_SETTINGS.bio
  };

  return settings;
}
