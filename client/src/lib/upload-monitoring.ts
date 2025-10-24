/**
 * Upload monitoring utilities for production
 * Tracks upload success/failure rates without exposing sensitive data
 */

interface UploadMetrics {
  provider: 'catbox' | 'imgbox' | 'proxy' | 'external' | 'reddit-native';
  success: boolean;
  duration?: number;
  fileSize?: number;
  errorType?: 'cors' | 'network' | 'server' | 'unknown';
}

/**
 * Track upload attempt for monitoring
 */
export function trackUpload(metrics: UploadMetrics): void {
  // In production, send to analytics service
  if (process.env.NODE_ENV === 'production') {
    // Send to Sentry or analytics service
    if (window.gtag) {
      window.gtag('event', 'file_upload', {
        event_category: 'uploads',
        event_label: metrics.provider,
        value: metrics.success ? 1 : 0,
        custom_dimension_1: metrics.errorType || 'none',
        custom_dimension_2: Math.round((metrics.duration || 0) / 1000) // seconds
      });
    }
  }
  
  // Store metrics in session for debugging (without sensitive data)
  const uploadStats = sessionStorage.getItem('upload_stats');
  const stats = uploadStats ? JSON.parse(uploadStats) : { 
    attempts: 0, 
    successes: 0, 
    failures: 0,
    lastError: null 
  };
  
  stats.attempts++;
  if (metrics.success) {
    stats.successes++;
  } else {
    stats.failures++;
    stats.lastError = {
      type: metrics.errorType,
      provider: metrics.provider,
      timestamp: new Date().toISOString()
    };
  }
  
  sessionStorage.setItem('upload_stats', JSON.stringify(stats));
}

/**
 * Get upload statistics for debugging
 */
export function getUploadStats(): {
  successRate: number;
  failureRate: number;
  lastError: {
    type?: string;
    provider?: string;
    timestamp?: string;
  } | null;
} {
  const uploadStats = sessionStorage.getItem('upload_stats');
  if (!uploadStats) {
    return { successRate: 0, failureRate: 0, lastError: null };
  }
  
  const stats = JSON.parse(uploadStats);
  const successRate = stats.attempts > 0 
    ? (stats.successes / stats.attempts) * 100 
    : 0;
  const failureRate = stats.attempts > 0
    ? (stats.failures / stats.attempts) * 100
    : 0;
    
  return {
    successRate: Math.round(successRate),
    failureRate: Math.round(failureRate),
    lastError: stats.lastError
  };
}

// Add window type for gtag
declare global {
  interface Window {
    gtag?: (
      command: string,
      ...parameters: Array<string | number | Record<string, unknown>>
    ) => void;
  }
}
