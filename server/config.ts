
const DEFAULT_API_PREFIX = '/api';

const ensureLeadingSlash = (value: string): string =>
  value.startsWith('/') ? value : `/${value}`;

const stripTrailingSlash = (value: string): string =>
  value.length > 1 && value.endsWith('/') ? value.slice(0, -1) : value;

export const normalizeApiPrefix = (prefix: string | undefined): string => {
  const trimmed = prefix?.trim();
  if (!trimmed) {
    return DEFAULT_API_PREFIX;
  }

  const withLeading = ensureLeadingSlash(trimmed);
  const normalized = stripTrailingSlash(withLeading);
  return normalized || DEFAULT_API_PREFIX;
};

export const API_PREFIX = normalizeApiPrefix(process.env.API_PREFIX);

export const withApiPrefix = (path: string, prefix: string = API_PREFIX): string => {
  const base = normalizeApiPrefix(prefix);
  const trimmedPath = path.startsWith('/') ? path.slice(1) : path;

  if (!trimmedPath) {
    return base;
  }

  return `${base}/${trimmedPath}`;
};

export const FRONTEND_URL =
  process.env.FRONTEND_URL ||
  (process.env.NODE_ENV === 'production'
    ? 'https://thottopilot.com'
    : 'http://localhost:5000');

export const STRIPE_KEYS = {
  secretKey: process.env.STRIPE_SECRET_KEY,
  publishableKey: process.env.VITE_STRIPE_PUBLIC_KEY,
};
