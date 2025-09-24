
export type VerificationStatus = 'pending' | 'review' | 'verified';

export interface SubredditRemoval {
  id: string;
  removedAt: string;
  reason: string;
  actionTaken?: string;
}

export interface SubredditComplianceStatus {
  name: string;
  shadowbanned: boolean;
  verificationStatus: VerificationStatus;
  nextPostTime: string;
  recentRemovals: SubredditRemoval[];
}
