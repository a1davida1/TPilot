import { describe, it, expect } from 'vitest';
import { categorizeContent } from '../shared/contentPolicy';

describe('categorizeContent', () => {
  it('flags NSFW words with word boundaries', () => {
    expect(categorizeContent('nude art').isNSFW).toBe(true);
    expect(categorizeContent('adulting 101').isNSFW).toBe(false);
  });

  it('detects URL shorteners', () => {
    const result = categorizeContent('visit goo.gl/xyz');
    expect(result.hasViolations).toBe(true);
    expect(result.violations).toContain('url_shortener');
  });

  it('detects hate speech', () => {
    const result = categorizeContent('you are a kike');
    expect(result.violations).toContain('hate_speech');
  });

  it('keeps clean content clean', () => {
    const result = categorizeContent('hello world');
    expect(result.hasViolations).toBe(false);
  });
});