import { getEnvConfig } from './config.js';
export function trackEvent(eventName, properties = {}, userId) {
    const config = getEnvConfig();
    if (!config.ANALYTICS_WRITE_KEY) {
        console.log(`📊 Analytics event (no key configured): ${eventName}`, properties);
        return;
    }
    // For demonstration - in production you'd integrate with your analytics service
    // Example: Segment, Mixpanel, PostHog, etc.
    const event = {
        event: eventName,
        properties: {
            ...properties,
            timestamp: new Date().toISOString(),
        },
        ...(userId && { userId }),
        ...(!userId && { anonymousId: generateAnonymousId() }),
    };
    // In a real implementation, you'd send this to your analytics service
    console.log('📊 Analytics event:', event);
    // Example: Send to analytics service
    // fetch('https://api.segment.io/v1/track', {
    //   method: 'POST',
    //   headers: {
    //     'Authorization': `Bearer ${config.ANALYTICS_WRITE_KEY}`,
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify(event),
    // }).catch(console.error);
}
function generateAnonymousId() {
    return 'anon_' + Math.random().toString(36).substr(2, 9);
}
