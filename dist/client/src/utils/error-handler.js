// User-friendly error message mapping and retry logic
export const errorMessages = {
    // Authentication errors
    'auth/invalid-credentials': 'Incorrect email or password. Please try again.',
    'auth/user-not-found': 'No account found with this email. Want to sign up?',
    'auth/email-already-in-use': 'This email is already registered. Try logging in instead.',
    'auth/weak-password': 'Password should be at least 8 characters with a mix of letters and numbers.',
    'auth/session-expired': 'Your session has expired. Please log in again.',
    // Quota and limits
    'quota_exceeded': "You've reached your daily limit. Upgrade to Pro for unlimited generations! 🚀",
    'rate_limit': 'Whoa! Slow down a bit. Try again in a few seconds.',
    'storage_limit': 'Storage limit reached. Delete some old content or upgrade your plan.',
    // Platform errors
    'reddit_not_connected': 'Connect your Reddit account first to post there.',
    'twitter_not_connected': 'Link your Twitter account to share content.',
    'platform_api_error': 'Having trouble connecting to the platform. Please try again.',
    'subreddit_banned': "You're banned from this subreddit. Try posting elsewhere.",
    'nsfw_not_allowed': "This community doesn't allow NSFW content. Try a different one.",
    // Content errors
    'image_too_large': 'Image is too large (max 10MB). Try compressing it first.',
    'invalid_image_format': 'Please upload a valid image (JPG, PNG, GIF, or WebP).',
    'content_too_long': 'Your content exceeds the platform limit. Let me shorten it for you.',
    'inappropriate_content': 'Content flagged as inappropriate. Please review and try again.',
    // AI errors
    'ai_unavailable': 'Our AI is taking a coffee break ☕ Try again in a moment.',
    'ai_generation_failed': 'Content generation hiccup! Try a different style or prompt.',
    'ai_timeout': 'Generation is taking longer than expected. Please try again.',
    // Payment errors
    'payment_failed': 'Payment couldn\'t be processed. Please check your card details.',
    'subscription_expired': 'Your subscription has expired. Renew to continue using Pro features.',
    'card_declined': 'Your card was declined. Try a different payment method.',
    // Network errors
    'network_error': 'Connection issues detected. Check your internet and try again.',
    'server_error': 'Our servers are having a moment. We\'re on it! Try again shortly.',
    'timeout': 'Request timed out. The servers might be busy. Please retry.',
    // Generic fallback
    'unknown_error': 'Something unexpected happened. Our team has been notified.'
};
/**
 * Retry a function with exponential backoff
 */
export async function retryWithBackoff(fn, options = {}) {
    const { maxRetries = 3, initialDelay = 1000, maxDelay = 10000, backoffFactor = 2, shouldRetry = () => true, onRetry = () => { } } = options;
    let lastError;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await fn();
        }
        catch (error) {
            lastError = error;
            // Check if we should retry this error
            if (!shouldRetry(error)) {
                throw error;
            }
            // Don't delay after the last attempt
            if (attempt < maxRetries - 1) {
                const delay = Math.min(initialDelay * Math.pow(backoffFactor, attempt), maxDelay);
                onRetry(attempt + 1, error);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    throw lastError;
}
/**
 * Get user-friendly error message
 */
export function getUserFriendlyError(error) {
    // Check for known error codes
    if (error?.code && errorMessages[error.code]) {
        return errorMessages[error.code];
    }
    // Check for error message patterns
    const errorString = error?.message || error?.toString() || '';
    // Pattern matching for common errors
    if (errorString.includes('quota') || errorString.includes('limit exceeded')) {
        return errorMessages['quota_exceeded'];
    }
    if (errorString.includes('rate limit')) {
        return errorMessages['rate_limit'];
    }
    if (errorString.includes('network') || errorString.includes('fetch')) {
        return errorMessages['network_error'];
    }
    if (errorString.includes('timeout')) {
        return errorMessages['timeout'];
    }
    if (errorString.includes('500') || errorString.includes('internal server')) {
        return errorMessages['server_error'];
    }
    // Return the original message if it's already user-friendly
    if (errorString.length < 100 && !errorString.includes('Error:')) {
        return errorString;
    }
    // Fallback to generic message
    return errorMessages['unknown_error'];
}
/**
 * Determine if an error is retryable
 */
export function isRetryableError(error) {
    const errorString = error?.message || error?.toString() || '';
    const code = error?.code || '';
    // Don't retry client errors
    if (error?.status >= 400 && error?.status < 500) {
        return false;
    }
    // Retry network and server errors
    if (errorString.includes('network') ||
        errorString.includes('timeout') ||
        errorString.includes('fetch') ||
        error?.status >= 500 ||
        code === 'ECONNRESET' ||
        code === 'ETIMEDOUT') {
        return true;
    }
    return false;
}
/**
 * Enhanced fetch with retry logic
 */
export async function fetchWithRetry(url, options = {}, retryOptions = {}) {
    return retryWithBackoff(async () => {
        const response = await fetch(url, options);
        // Throw error for non-OK responses to trigger retry
        if (!response.ok && response.status >= 500) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        return response;
    }, {
        ...retryOptions,
        shouldRetry: (error) => {
            // Custom retry logic for fetch
            if (retryOptions.shouldRetry) {
                return retryOptions.shouldRetry(error);
            }
            return isRetryableError(error);
        }
    });
}
/**
 * Error recovery suggestions
 */
export function getErrorRecoverySuggestion(error) {
    const errorString = error?.message || error?.code || '';
    if (errorString.includes('quota') || errorString.includes('limit')) {
        return 'Consider upgrading to Pro for unlimited access';
    }
    if (errorString.includes('network') || errorString.includes('offline')) {
        return 'Check your internet connection and try again';
    }
    if (errorString.includes('auth') || errorString.includes('unauthorized')) {
        return 'Try logging out and back in';
    }
    if (errorString.includes('payment') || errorString.includes('card')) {
        return 'Update your payment method in settings';
    }
    return null;
}
/**
 * Create a toast-friendly error object
 */
export function createErrorToast(error) {
    const message = getUserFriendlyError(error);
    const suggestion = getErrorRecoverySuggestion(error);
    return {
        title: 'Oops!',
        description: message,
        action: suggestion ? {
            label: 'Fix it',
            onClick: () => {
                // Navigate to appropriate page based on error type
                if (suggestion.includes('upgrading')) {
                    window.location.href = '/pricing';
                }
                else if (suggestion.includes('payment')) {
                    window.location.href = '/settings/billing';
                }
                else if (suggestion.includes('logging')) {
                    window.location.href = '/logout';
                }
            }
        } : undefined
    };
}
