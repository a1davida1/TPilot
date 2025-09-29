import { describe, expect, it } from 'vitest';
import { cn } from '../../../client/src/lib/utils';

describe('utility class merging', () => {
  it('merges conditional class names into a single string', () => {
    const result = cn('flex', undefined, ['items-center', false && 'hidden'], {
      'text-foreground': true,
      'bg-card': false,
    });

    expect(result).toBe('flex items-center text-foreground');
  });

  it('deduplicates conflicting tailwind classes', () => {
    const result = cn('px-2 py-2', 'px-4', {
      'py-4': true,
    });

    expect(result).toBe('px-4 py-4');
  });
});