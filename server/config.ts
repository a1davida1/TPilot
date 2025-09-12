export const FRONTEND_URL =
  process.env.FRONTEND_URL ||
  (process.env.NODE_ENV === 'production'
    ? 'https://thottopilot.com'
    : 'http://localhost:5000');

export const STRIPE_KEYS = {
  secretKey: process.env.STRIPE_SECRET_KEY,
  publishableKey: process.env.VITE_STRIPE_PUBLIC_KEY,
};