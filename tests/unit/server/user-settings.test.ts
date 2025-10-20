import { describe, expect, it } from 'vitest';
import { buildUserSettingsResponse, normalizePromotionalUrl } from '../../../server/lib/user-settings.js';
import type { UserPreference, User } from '../../../shared/schema.js';

describe('user settings helpers', () => {
  describe('normalizePromotionalUrl', () => {
    it('normalizes OnlyFans URLs without protocol', () => {
      const result = normalizePromotionalUrl('onlyfans.com/creator', 'onlyfans');
      expect(result).toBe('https://onlyfans.com/creator');
    });

    it('keeps subdomain hostnames and enforces https', () => {
      const result = normalizePromotionalUrl('http://www.fansly.com/creatorx', 'fansly');
      expect(result).toBe('https://www.fansly.com/creatorx');
    });

    it('throws when domain is not allowed', () => {
      expect(() => normalizePromotionalUrl('example.com/user', 'onlyfans')).toThrowError('URL must be hosted on onlyfans.com.');
    });

    it('throws when profile path is missing', () => {
      expect(() => normalizePromotionalUrl('https://onlyfans.com/', 'onlyfans')).toThrowError('URL must include a profile path.');
    });
  });

  describe('buildUserSettingsResponse', () => {
    it('provides defaults when no data is available', () => {
      const result = buildUserSettingsResponse(undefined, undefined);
      expect(result).toEqual({
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
      });
    });

    it('merges user and preference data into a view model', () => {
      const user = {
        username: 'creator',
        email: 'creator@example.com',
        bio: 'Creator bio'
      } satisfies Partial<User>;

      const preference = {
        theme: 'dark',
        pushNotifications: false,
        emailNotifications: false,
        autoSchedulePosts: false,
        platformSettings: { defaultPlatform: 'twitter', unsupported: true },
        onlyFansUrl: ' https://onlyfans.com/creator ',
        fanslyUrl: 'https://fansly.com/creator-fansly'
      } satisfies Partial<UserPreference>;

      const result = buildUserSettingsResponse(user as User, preference as UserPreference);

      expect(result.theme).toBe('dark');
      expect(result.notifications).toBe(false);
      expect(result.emailUpdates).toBe(false);
      expect(result.autoSave).toBe(false);
      expect(result.defaultPlatform).toBe('twitter');
      expect(result.onlyFansUrl).toBe('https://onlyfans.com/creator');
      expect(result.fanslyUrl).toBe('https://fansly.com/creator-fansly');
      expect(result.displayName).toBe('creator');
      expect(result.email).toBe('creator@example.com');
      expect(result.bio).toBe('Creator bio');
    });

    it('falls back to reddit when default platform is unknown', () => {
      const preference = {
        platformSettings: { defaultPlatform: 'unknown-platform' }
      } satisfies Partial<UserPreference>;

      const result = buildUserSettingsResponse(undefined, preference as UserPreference);
      expect(result.defaultPlatform).toBe('reddit');
    });
  });
});
