import {
  getSubredditRules,
  getUserRecentPosts,
  calculateSimilarity,
  mlSafetyCheck,
  generateSuggestions,
  getUserPostingStats,
  detectBenignKeywords
} from './moderation-utils.js';

export async function validateContent(content, context = {}) {
  const violations = [];
  const { subreddit, userId, allowNSFW = false } = context;

  /* length check */
  if (content.length > 280) {
    violations.push({ type: 'length', severity: 'block' });
  }

  /* subreddit rules */
  if (subreddit) {
    const rules = await getSubredditRules(subreddit);
    if (rules?.bannedDomains?.some(domain => content.includes(domain))) {
      violations.push({ type: 'banned_domain', severity: 'block' });
    }
  }

  /* disguised links */
  const shorteners = [/bit\.ly/i, /tinyurl\.com/i, /goo\.gl/i, /t\.co/i, /is\.gd/i, /ow\.ly/i];
  if (shorteners.some(rx => rx.test(content))) {
    violations.push({ type: 'url_shortener', severity: 'warn' });
  }

  /* repetitive/spam */
  if (userId) {
    const recent = await getUserRecentPosts(userId);
    const score = calculateSimilarity(content, recent);
    if (score > 0.8) {
      violations.push({ type: 'repetitive_content', severity: 'throttle' });
    }
  }

  /* rate‑limit circumvention */
  if (userId) {
    const stats = await getUserPostingStats(userId);
    if (stats.requests > stats.allowed) {
      violations.push({ type: 'rate_limit', severity: 'throttle' });
    }
  }

  /* ML safety check */
  try {
    const safety = await mlSafetyCheck(content);
    if (safety.nsfw > 0.7 && !allowNSFW) {
      violations.push({ type: 'nsfw_content', severity: 'block' });
    }
  } catch (err) {
    violations.push({ type: 'ml_error', severity: 'warn', detail: err.message });
  }

  /* context-aware filtering */
  if (detectBenignKeywords(content)) {
    const idx = violations.findIndex(v => v.type === 'nsfw_content');
    if (idx !== -1) violations.splice(idx, 1);
  }

  return {
    allowed: !violations.some(v => v.severity === 'block'),
    violations,
    suggestions: generateSuggestions(violations)
  };
}