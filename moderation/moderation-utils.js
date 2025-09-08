// Utilities supporting validateContent

export async function getSubredditRules(subreddit) {
  // TODO: replace with real datastore lookup
  return { bannedDomains: ['spam.com', 'badsite.org'] };
}

export async function getUserRecentPosts(userId) {
  // TODO: fetch recent posts from persistence layer
  return [];
}

export function calculateSimilarity(content, posts) {
  if (!posts.length) return 0;
  const tokens = new Set(content.toLowerCase().split(/\W+/));
  const scores = posts.map(p => {
    const pTokens = new Set(p.toLowerCase().split(/\W+/));
    const intersection = [...tokens].filter(t => pTokens.has(t));
    return intersection.length / pTokens.size;
  });
  return Math.max(...scores);
}

export async function getUserPostingStats(userId) {
  // TODO: integrate with rate-limit store
  return { requests: 0, allowed: 10 };
}

export async function mlSafetyCheck(content) {
  // TODO: hook up to ML service
  return { nsfw: 0 };
}

export function generateSuggestions(violations) {
  if (!violations.length) return [];
  return violations.map(v => `Please avoid ${v.type}`);
}

export function detectBenignKeywords(content) {
  const whitelist = [/medical/i, /education/i];
  return whitelist.some(rx => rx.test(content));
}