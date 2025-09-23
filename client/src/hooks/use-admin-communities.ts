import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import type { RedditCommunitySellingPolicy } from '@shared/schema';
import { 
  type GrowthTrend,
  GROWTH_TRENDS,
  GROWTH_TREND_LABELS,
  getGrowthTrendLabel
} from '@shared/growth-trends';

export type PromotionPolicy = 'yes' | 'no' | 'limited' | 'subtle' | 'strict' | 'unknown';
// GrowthTrend type imported from @shared/growth-trends - uses canonical values: 'up' | 'stable' | 'down'
export type ActivityLevel = 'low' | 'medium' | 'high' | 'unknown';
export type CompetitionLevel = 'low' | 'medium' | 'high' | 'unknown';

// Re-export growth trend constants and labels for use by components
export { GROWTH_TRENDS, GROWTH_TREND_LABELS, getGrowthTrendLabel };

export interface CommunityRules {
  minKarma?: number;
  minAccountAge?: number;
  watermarksAllowed?: boolean;
  sellingAllowed?: RedditCommunitySellingPolicy;
  titleRules?: string[];
  contentRules?: string[];
  linkRestrictions?: string[];
  verificationRequired?: boolean;
  requiresApproval?: boolean;
  nsfwRequired?: boolean;
  maxPostsPerDay?: number;
  cooldownHours?: number;
}

export interface PostingLimits {
  perDay?: number;
  perWeek?: number;
  cooldownHours?: number;
}

export interface AdminCommunity {
  id: string;
  name: string;
  displayName: string;
  category: string;
  members: number;
  engagementRate: number;
  verificationRequired: boolean;
  promotionAllowed: PromotionPolicy;
  postingLimits?: PostingLimits | null;
  rules?: CommunityRules | null;
  bestPostingTimes?: string[] | null;
  averageUpvotes?: number | null;
  successProbability?: number | null;
  growthTrend?: GrowthTrend | null;
  modActivity?: ActivityLevel | null;
  description?: string | null;
  tags?: string[] | null;
  competitionLevel?: CompetitionLevel | null;
}

export interface CommunityPayload {
  id?: string;
  name: string;
  displayName: string;
  category: string;
  members: number;
  engagementRate: number;
  verificationRequired: boolean;
  promotionAllowed: PromotionPolicy;
  postingLimits?: PostingLimits | null;
  rules?: Partial<CommunityRules> | null;
  bestPostingTimes?: string[] | null;
  averageUpvotes?: number | null;
  successProbability?: number | null;
  growthTrend?: GrowthTrend;
  modActivity?: ActivityLevel;
  description?: string | null;
  tags?: string[] | null;
  competitionLevel?: CompetitionLevel;
}

export interface CommunityFilters {
  search?: string;
  category?: string;
  promotionAllowed?: PromotionPolicy | 'all';
  verificationRequired?: 'all' | 'required' | 'not-required';
}

export function useAdminCommunities(filters?: CommunityFilters) {
  const queryParams = new URLSearchParams();

  if (filters?.search) {
    queryParams.set('search', filters.search);
  }
  if (filters?.category && filters.category !== 'all') {
    queryParams.set('category', filters.category);
  }
  if (filters?.promotionAllowed && filters.promotionAllowed !== 'all') {
    queryParams.set('promotionAllowed', filters.promotionAllowed);
  }
  if (filters?.verificationRequired && filters.verificationRequired !== 'all') {
    queryParams.set('verificationRequired', filters.verificationRequired === 'required' ? 'true' : 'false');
  }

  const queryString = queryParams.toString();
  const url = `/api/reddit/communities${queryString ? `?${queryString}` : ''}`;

  return useQuery<AdminCommunity[]>({
    queryKey: ['admin-communities', filters],
    queryFn: () => fetch(url).then(res => {
      if (!res.ok) throw new Error('Failed to fetch communities');
      return res.json();
    }),
  });
}

export function useCreateCommunity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: CommunityPayload) => 
      apiRequest('POST', '/api/reddit/communities', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-communities'] });
    },
  });
}

export function useUpdateCommunity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: CommunityPayload }) => 
      apiRequest('PUT', `/api/reddit/communities/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-communities'] });
    },
  });
}

export function useDeleteCommunity() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) => 
      apiRequest('DELETE', `/api/reddit/communities/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-communities'] });
    },
  });
}