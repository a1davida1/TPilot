/**
 * Caption telemetry module
 * Tracks caption A/B testing, user choices, protection metrics, and post outcomes
 * Privacy-safe: logs metadata only, never image bytes
 */

import { trackFeatureUsage } from '@/lib/analytics-tracker';

// Helper to send analytics to backend
async function sendAnalytics(endpoint: string, data: unknown): Promise<void> {
  try {
    const token = localStorage.getItem('auth_token');
    if (!token) return; // Skip if not authenticated

    await fetch(`/api/caption-analytics/${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(data)
    });
  } catch (error) {
    console.warn(`Analytics tracking failed for ${endpoint}:`, error);
  }
}

export interface CaptionShownEvent {
  pairId: string;
  captionIds: [string, string];
  captionTexts: [string, string];
  styles: [string, string];
  model: string;
  category?: string;
  tags?: string[];
  protectionPreset: string;
  deviceBucket: string;
}

export interface CaptionChoiceEvent {
  pairId: string;
  chosenCaptionId: string;
  timeToChoiceMs: number;
  edited: boolean;
  editDeltaChars?: number;
  autoSelected: boolean;
}

export interface ProtectionMetricsEvent {
  ssim: number;
  phashDelta: number;
  preset: string;
  durationMs: number;
  downscaled: boolean;
}

export interface PostSubmitEvent {
  redditPostId: string;
  subreddit: string;
  captionId: string;
  pairId: string;
  nsfwFlag: boolean;
  flair?: string;
  protectionPreset: string;
  metricsSSIM: number;
  metricsPhashDelta: number;
  uploadLatencyMs: number;
  redditApiLatencyMs?: number;
}

/**
 * Track when caption pair is shown to user
 */
export function trackCaptionShown(event: CaptionShownEvent): void {
  // Send to generic analytics
  trackFeatureUsage('one_click_posting', 'caption_shown', {
    pair_id: event.pairId,
    caption_ids: event.captionIds.join(','),
    styles: event.styles.join(','),
    protection_preset: event.protectionPreset,
    device_bucket: event.deviceBucket
  });

  // Send to database for A/B tracking
  void sendAnalytics('caption-shown', event);
}

/**
 * Track user's caption choice
 */
export function trackCaptionChoice(event: CaptionChoiceEvent): void {
  // Send to generic analytics
  trackFeatureUsage('one_click_posting', 'caption_choice', {
    pair_id: event.pairId,
    chosen_caption_id: event.chosenCaptionId,
    time_to_choice_ms: event.timeToChoiceMs,
    edited: event.edited,
    auto_selected: event.autoSelected
  });

  // Send to database for A/B tracking
  void sendAnalytics('caption-choice', event);
}

/**
 * Track ImageShield protection metrics
 */
export function trackProtectionMetrics(event: ProtectionMetricsEvent): void {
  // Send to generic analytics
  trackFeatureUsage('imageshield', 'protection_metrics', {
    ssim: event.ssim,
    phash_delta: event.phashDelta,
    preset: event.preset,
    duration_ms: event.durationMs,
    downscaled: event.downscaled
  });

  // Send to database for quality tracking
  void sendAnalytics('protection-metrics', event);
}

/**
 * Track Reddit post submission
 */
export function trackPostSubmit(event: PostSubmitEvent): void {
  // Send to generic analytics
  trackFeatureUsage('one_click_posting', 'post_submit', {
    reddit_post_id: event.redditPostId,
    subreddit: event.subreddit,
    nsfw_flag: event.nsfwFlag,
    upload_latency_ms: event.uploadLatencyMs
  });

  // Send to database for outcome tracking
  void sendAnalytics('post-submit', event);
}

/**
 * Get device bucket for analytics segmentation
 */
export function getDeviceBucket(): string {
  const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
  const isTablet = /iPad/i.test(navigator.userAgent) || 
    (navigator.userAgent.includes('Android') && !navigator.userAgent.includes('Mobile'));
  
  if (isMobile && !isTablet) return 'mobile';
  if (isTablet) return 'tablet';
  return 'desktop';
}

/**
 * Generate unique pair ID for tracking caption sessions
 */
export function generatePairId(): string {
  return `pair_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
