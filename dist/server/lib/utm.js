import { getEnvConfig } from './config.js';
export function parseUTMFromURL(url) {
    try {
        const urlObj = new URL(url);
        const params = urlObj.searchParams;
        return {
            utmSource: params.get('utm_source') || undefined,
            utmMedium: params.get('utm_medium') || undefined,
            utmCampaign: params.get('utm_campaign') || undefined,
            utmContent: params.get('utm_content') || undefined,
            utmTerm: params.get('utm_term') || undefined,
        };
    }
    catch {
        return {};
    }
}
export function parseUTMFromCookie(cookieValue) {
    try {
        return JSON.parse(decodeURIComponent(cookieValue));
    }
    catch {
        return {};
    }
}
export function encodeUTMToCookie(params) {
    return encodeURIComponent(JSON.stringify(params));
}
export function mergeUTMParams(cookieParams, queryParams) {
    // Query params take precedence over cookie params
    return {
        utmSource: queryParams.utmSource || cookieParams.utmSource,
        utmMedium: queryParams.utmMedium || cookieParams.utmMedium,
        utmCampaign: queryParams.utmCampaign || cookieParams.utmCampaign,
        utmContent: queryParams.utmContent || cookieParams.utmContent,
        utmTerm: queryParams.utmTerm || cookieParams.utmTerm,
        referrer: queryParams.referrer || cookieParams.referrer,
    };
}
export function getUTMCookieName() {
    return 'utm_params';
}
export function getUTMCookieMaxAge() {
    const config = getEnvConfig();
    return config.UTM_COOKIE_TTL_DAYS * 24 * 60 * 60 * 1000; // Convert days to milliseconds
}
// Helper to generate cookie options for setting UTM cookie
export function getUTMCookieOptions() {
    return {
        maxAge: getUTMCookieMaxAge(),
        httpOnly: false, // Allow client-side access for updating
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
    };
}
