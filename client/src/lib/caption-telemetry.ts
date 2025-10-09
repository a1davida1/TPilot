/**
 * Caption telemetry tracking
 * Privacy-safe: logs metadata only, never image bytes
 */

import { trackFeatureUsage } from './analytics-tracker';

export interface CaptionShownEvent {
  pairId: string;
  captionIds: [string, string];
  styles: [string, string];
  protectionPreset: string;
  deviceBucket: string;
}

export interface CaptionChoiceEvent {
  pairId: string;
  chosenCaptionId: string;
  timeToChoiceMs: number;
  edited: boolean;
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
  postKind: string;
  subreddit: string;
  nsfwFlag: boolean;
  uploadLatencyMs: number;
}

/**
 * Track when caption pair is shown to user
 */
export function trackCaptionShown(event: CaptionShownEvent): void {
  trackFeatureUsage('one_click_posting', 'caption_shown', {
    pair_id: event.pairId,
    caption_ids: event.captionIds.join(','),
    styles: event.styles.join(','),
    protection_preset: event.protectionPreset,
    device_bucket: event.deviceBucket
  });
}

/**
 * Track user's caption choice
 */
export function trackCaptionChoice(event: CaptionChoiceEvent): void {
  trackFeatureUsage('one_click_posting', 'caption_choice', {
    pair_id: event.pairId,
    chosen_caption_id: event.chosenCaptionId,
    time_to_choice_ms: event.timeToChoiceMs,
    edited: event.edited,
    auto_selected: event.autoSelected
  });
}

/**
 * Track ImageShield protection metrics
 */
export function trackProtectionMetrics(event: ProtectionMetricsEvent): void {
  trackFeatureUsage('imageshield', 'protection_metrics', {
    ssim: event.ssim,
    phash_delta: event.phashDelta,
    preset: event.preset,
    duration_ms: event.durationMs,
    downscaled: event.downscaled
  });
}

/**
 * Track Reddit post submission
 */
export function trackPostSubmit(event: PostSubmitEvent): void {
  trackFeatureUsage('one_click_posting', 'post_submit', {
    post_kind: event.postKind,
    subreddit: event.subreddit,
    nsfw_flag: event.nsfwFlag,
    upload_latency_ms: event.uploadLatencyMs
  });
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
