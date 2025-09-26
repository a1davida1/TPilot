
import { describe, it, expect } from 'vitest';
import { normalizeRulesToStructured, type LegacyRedditCommunityRuleSet } from '../../shared/schema';

describe('normalizeRulesToStructured', () => {
  it('preserves legacy link restrictions when present', () => {
    const legacyRules: NonNullable<LegacyRedditCommunityRuleSet> = {
      linkRestrictions: ['no shortened urls', 'no affiliate links']
    };

    const normalized = normalizeRulesToStructured(legacyRules);

    expect(normalized?.content?.linkRestrictions).toEqual([
      'no shortened urls',
      'no affiliate links'
    ]);
  });
});
