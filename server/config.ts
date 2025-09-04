export const FRONTEND_URL =
  process.env.FRONTEND_URL ||
  (process.env.NODE_ENV === 'production'
    ? 'https://thottopilot.com'
    : 'http://localhost:5000');