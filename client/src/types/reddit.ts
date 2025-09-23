export interface ShadowbanStatusResponse {
  isShadowbanned: boolean;
  statusMessage: string;
  checkedAt: string;
  publicCount: number;
  totalSelfPosts: number;
  hiddenPosts: Array<{
    id: string;
    title: string;
    createdUtc: number;
  }>;
  error?: string;
}

export interface RedditAccount {
  id: number;
  username: string;
  isActive: boolean;
  connectedAt: string;
  karma: number;
  verified: boolean;
  accountAgeDays?: number;
}

export interface SubredditCommunity {
  id: string;
  name: string;
  displayName: string;
  members: number;
  engagementRate: number;
  category: string;
  promotionAllowed: string;
  bestPostingTimes: string[];
  averageUpvotes: number;
  successProbability: number;
  description: string;
  rules?: {
    minKarma?: number;
    minAccountAge?: number;
    watermarksAllowed?: boolean;
    sellingAllowed?: boolean;
    titleRules?: string[];
    contentRules?: string[];
  };
}

export interface ConnectionTestResponse {
  connected: boolean;
  profile?: {
    username: string;
    karma: number;
  };
}

export interface ConnectRedditResponse {
  authUrl: string;
}

export interface ContentValidationResponse {
  policyState: 'allow' | 'warn' | 'block';
}

export interface PostSubmissionResponse {
  success: boolean;
  error?: string;
}