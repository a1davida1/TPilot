import { getEnvConfig } from './config.js';
export async function verifyTurnstileToken(token, userIP) {
    const config = getEnvConfig();
    // If Turnstile is not configured, bypass in development mode
    if (!config.TURNSTILE_SECRET_KEY) {
        console.warn('⚠️ Turnstile not configured - bypassing verification in development');
        return true;
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
        const result = await response.json();
        if (!result.success) {
            console.warn('Turnstile verification failed:', result['error-codes']);
            return false;
        }
        return true;
    }
    catch (error) {
        console.error('Turnstile verification error:', error);
        return false;
    }
}
export function getTurnstileSiteKey() {
    const config = getEnvConfig();
    return config.TURNSTILE_SITE_KEY;
}
