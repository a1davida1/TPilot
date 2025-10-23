export type RiskWarningType = 'cadence' | 'removal' | 'rule';
export type RiskWarningSeverity = 'low' | 'medium' | 'high';

export interface RiskWarningMetadata {
  scheduledFor?: string;
  cooldownHours?: number;
  hoursSinceLastPost?: number;
  removalReason?: string | null;
  removalAt?: string;
  ruleReference?: string;
  notes?: string;
}

export interface RiskWarning {
  id: string;
  type: RiskWarningType;
  severity: RiskWarningSeverity;
  subreddit: string;
  title: string;
  message: string;
  recommendedAction: string;
  metadata?: RiskWarningMetadata;
}

export interface RiskEvaluationStats {
  upcomingCount: number;
  flaggedSubreddits: number;
  removalCount: number;
  cooldownConflicts: number;
}

export interface RiskSummaryPayload {
  generatedAt: string;
  warnings: RiskWarning[];
  stats: RiskEvaluationStats;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetAt: string;
}

export interface RiskApiSuccess {
  success: true;
  cached: boolean;
  data: RiskSummaryPayload;
  rateLimit: RateLimitInfo;
}

export interface RiskApiError {
  success?: false;
  error: string;
  details?: unknown;
  rateLimit?: RateLimitInfo;
}

export type RiskApiResponse = RiskApiSuccess | RiskApiError;
