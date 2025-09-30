import { getEnvConfig } from './config';

interface TurnstileResponse {
  success: boolean;
  'error-codes'?: string[];
  challenge_ts?: string;
  hostname?: string;
}

export async function verifyTurnstileToken(token: string, userIP?: string): Promise<boolean> {
  const config = getEnvConfig();
  const isDevelopment = process.env.NODE_ENV === 'development';

  // If Turnstile is not configured, bypass only in development mode
  if (!config.TURNSTILE_SECRET_KEY) {
    if (isDevelopment) {
      console.warn('⚠️ Turnstile not configured - bypassing verification in development');
      return true;
    }

    console.error('❌ Turnstile secret key is not configured. Rejecting verification request.');
    return false;
  }

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        secret: config.TURNSTILE_SECRET_KEY,
        response: token,
        ...(userIP && { remoteip: userIP }),
      }),
    });

    const result: TurnstileResponse = await response.json();
    
    if (!result.success) {
      console.warn('Turnstile verification failed:', result['error-codes']);
      return false;
    }

    return true;
  } catch (_error) {
    console.error('Turnstile verification error:', error);
    return false;
  }
}

export function getTurnstileSiteKey(): string | undefined {
  const config = getEnvConfig();
  return config.TURNSTILE_SITE_KEY;
}