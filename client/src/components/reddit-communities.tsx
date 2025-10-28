import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Users,
  TrendingUp,
  Shield,
  Megaphone,
  Search,
  ChevronUp,
  ChevronDown,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { ApiError } from "@/lib/queryClient";
import { getCommunityAccessState } from "@/lib/community-access";
import { useAuth } from "@/hooks/useAuth";

type RuleAllowance = 'allowed' | 'limited' | 'not_allowed' | 'unknown' | 'yes' | 'no';

interface _RedditCommunity {
  id: string;
  name: string;
  displayName: string;
  members: number;
  engagementRate: number;
  category: 'premium' | 'general' | 'niche' | 'fetish' | 'verification' | 'gonewild' | 'selling';
  verificationRequired: boolean;
  promotionAllowed: 'yes' | 'limited' | 'subtle' | 'no';
  postingLimits?: {
    perDay?: number;
    perWeek?: number;
    cooldownHours?: number;
    daily?: number;
    weekly?: number;
  };
  rules?: {
    minKarma?: number;
    minAccountAge?: number;
    minAccountAgeDays?: number;
    watermarksAllowed?: boolean;
    sellingAllowed?: RuleAllowance;
    promotionalLinksAllowed?: RuleAllowance;
    bannedContent?: string[];
    formattingRequirements?: string[];
    titleRules?: string[];
    contentRules?: string[];
    requiresOriginalContent?: boolean;
    notes?: string[];
  };
  bestPostingTimes: string[];
  averageUpvotes: number;
  successProbability: number;
  growthTrend: 'up' | 'stable' | 'down';
  modActivity: 'high' | 'medium' | 'low';
  description: string;
  tags: string[];
  competitionLevel: 'low' | 'medium' | 'high';
}

const isApiError = (error: unknown): error is ApiError =>
  Boolean(
    error &&
    typeof error === 'object' &&
    'status' in (error as Record<string, unknown>) &&
    typeof (error as { status?: unknown }).status === 'number'
  );

export function RedditCommunities() {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<'members' | 'engagement' | 'upvotes' | 'name' | 'success'>('success');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterPromotion, setFilterPromotion] = useState<string>('all');
  const [filterVerification, setFilterVerification] = useState<string>('all');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const { hasFullAccess, isVerified, user, isLoading: _authLoading } = useAuth();

  // Fetch communities data - Available to all users
  const {
    data: communities = [],
    isLoading: _communitiesLoading,
    error: communitiesError,
  } = useQuery({
    queryKey: ['/api/reddit/communities', filterCategory, searchTerm],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterCategory !== 'all') params.append('category', filterCategory);
      if (searchTerm) params.append('search', searchTerm);

      const data = await apiRequest<unknown>('GET', `/api/reddit/communities?${params.toString()}`);
      
      // Ensure we always return an array
      if (Array.isArray(data)) {
        return data;
      }
      
      // Handle error responses
      if (data.error && data.items) {
        return data.items;
      }
      
      // Fallback to empty array if response is unexpected
      return [];
    },
    retry: false,
    enabled: true, // Changed from hasFullAccess to allow all users
  });

  const communityAccessState = getCommunityAccessState({
    hasFullAccess,
    isVerified,
    bannedAt: user?.bannedAt ?? null,
    suspendedUntil: user?.suspendedUntil ?? null,
    error: isApiError(communitiesError) ? communitiesError : null,
  });

  const displayCommunities = communities;

  const _formatAllowance = (value?: RuleAllowance) => {
    switch (value) {
      case 'allowed':
      case 'yes':
        return 'Allowed';
      case 'limited':
        return 'Limited';
      case 'not_allowed':
      case 'no':
        return 'Not allowed';
      case 'unknown':
      default:
        return 'Unknown';
    }
  };

  const _formatBoolean = (value?: boolean) => {
    if (typeof value !== 'boolean') return 'Unknown';
    return value ? 'Allowed' : 'Not allowed';
  };

  // Filter and sort communities
  const filteredCommunities = useMemo(() => {
    let filtered = Array.isArray(displayCommunities) ? [...displayCommunities] : [];

    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(c => 
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Category filter
    if (filterCategory !== 'all') {
      filtered = filtered.filter(c => c.category === filterCategory);
    }

    // Promotion filter
    if (filterPromotion !== 'all') {
      filtered = filtered.filter(c => c.promotionAllowed === filterPromotion);
    }

    // Verification filter
    if (filterVerification !== 'all') {
      filtered = filtered.filter(c => 
        filterVerification === 'required' ? c.verificationRequired : !c.verificationRequired
      );
    }

    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'members':
          return b.members - a.members;
        case 'engagement':
          return b.engagementRate - a.engagementRate;
        case 'upvotes':
          // Safe handling of nullable averageUpvotes
          return (b.averageUpvotes ?? 0) - (a.averageUpvotes ?? 0);
        case 'success':
          // Safe handling of nullable successProbability
          return (b.successProbability ?? 0) - (a.successProbability ?? 0);
        case 'name':
          return a.name.localeCompare(b.name);
        default:
          return 0;
      }
    });

    return filtered;
  }, [displayCommunities, searchTerm, filterCategory, filterPromotion, filterVerification, sortBy]);

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(0)}K`;
    return num.toString();
  };

  const getPromotionBadge = (promotion: string) => {
    switch (promotion) {
      case 'yes':
        return <Badge className="bg-success/15 text-success">Allowed</Badge>;
      case 'limited':
        return <Badge className="bg-warning/15 text-warning">Limited</Badge>;
      case 'no':
        return <Badge className="bg-destructive/15 text-destructive">Not Allowed</Badge>;
      default:
        return null;
    }
  };

  const _getSellingPolicyBadge = (policy: string | undefined) => {
    switch (policy) {
      case 'allowed':
        return <Badge className="bg-success/15 text-success">Selling allowed</Badge>;
      case 'limited':
        return <Badge className="bg-warning/15 text-warning">Limited selling</Badge>;
      case 'not_allowed':
        return <Badge className="bg-destructive/15 text-destructive">No selling</Badge>;
      case 'unknown':
      default:
        return <Badge className="bg-muted/20 text-muted-foreground">Selling policy unknown</Badge>;
    }
  };

  const getCategoryBadge = (category: string) => {
    const colors: Record<string, string> = {
      // Primary categories
      premium: 'bg-primary-500/15 text-primary-300',
      gonewild: 'bg-accent-pink/15 text-accent-foreground',
      general: 'bg-secondary/15 text-secondary',
      niche: 'bg-accent-rose/15 text-accent-foreground',
      fetish: 'bg-accent-rose/15 text-accent-foreground',
      selling: 'bg-success/15 text-success',
      verification: 'bg-warning/15 text-warning',

      // Additional categories from seed data
      amateur: 'bg-secondary/15 text-secondary',
      age: 'bg-primary-500/10 text-primary-200',
      appearance: 'bg-accent-rose/15 text-accent-foreground',
      body_type: 'bg-primary-500/10 text-primary-200',
      cam: 'bg-primary-500/10 text-primary-200',
      clothing: 'bg-secondary/15 text-secondary',
      comparison: 'bg-muted/20 text-muted-foreground',
      content_type: 'bg-warning/15 text-warning',
      cosplay: 'bg-primary-500/10 text-primary-200',
      couples: 'bg-destructive/15 text-destructive',
      dancer: 'bg-accent-rose/15 text-accent-foreground',
      ethnicity: 'bg-success/15 text-success',
      fitness: 'bg-success/15 text-success',
      gaming: 'bg-secondary/15 text-secondary',
      lifestyle: 'bg-muted/20 text-muted-foreground',
      natural: 'bg-success/15 text-success',
      reveal: 'bg-warning/15 text-warning',
      social: 'bg-secondary/15 text-secondary',
      specific: 'bg-muted/20 text-muted-foreground',
      style: 'bg-secondary/15 text-secondary',
      theme: 'bg-primary-500/10 text-primary-200'
    };
    return <Badge className={colors[category] || 'bg-muted/20 text-muted-foreground'}>{category}</Badge>;
  };

  const getSuccessProbabilityColor = (probability: number | null | undefined) => {
    if (!probability) return 'text-muted-foreground/70';
    if (probability >= 85) return 'text-success';
    if (probability >= 70) return 'text-warning';
    return 'text-destructive';
  };

  const getGrowthTrendIcon = (trend: string | undefined) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-3 w-3 text-success" />;
      case 'down':
        return <ChevronDown className="h-3 w-3 text-destructive" />;
      case 'stable':
        return <div className="h-3 w-3 bg-warning rounded-full" />;
      default:
        return <div className="h-3 w-3 bg-muted-foreground rounded-full" />;
    }
  };

  // Helper to display mod activity with appropriate styling
  const getModActivityDisplay = (modActivity: string | null | undefined) => {
    switch (modActivity) {
      case 'active':
        return { label: 'Active', className: 'text-success' };
      case 'moderate':
        return { label: 'Moderate', className: 'text-warning' };
      case 'inactive':
        return { label: 'Inactive', className: 'text-destructive' };
      default:
        return { label: 'Unknown', className: 'text-muted-foreground/70' };
    }
  };

  return (
    <Card className="bg-pink-100 dark:bg-pink-900/30 backdrop-blur-xl border-purple-600 border-2 shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl font-bold text-purple-900 dark:text-purple-300">
          🏠 Reddit Community Directory
        </CardTitle>
        <p className="text-sm text-purple-800 dark:text-purple-200">
          Find the perfect subreddits for your content. See member counts, success rates, and posting rules at a glance.
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {communityAccessState.blocked && (
          <Alert variant="destructive" data-testid="alert-access-blocked">
            <AlertTitle>{communityAccessState.title}</AlertTitle>
            <AlertDescription>{communityAccessState.description}</AlertDescription>
          </Alert>
        )}
        
        {/* Filters and Search */}
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white border-purple-600 focus:border-purple-700 text-purple-900 placeholder:text-purple-500"
              placeholder="Search communities..."
            />
          </div>

          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger variant="overlay" className="w-[180px]">
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="age">Age</SelectItem>
              <SelectItem value="amateur">Amateur</SelectItem>
              <SelectItem value="appearance">Appearance</SelectItem>
              <SelectItem value="body_type">Body Type</SelectItem>
              <SelectItem value="cam">Cam</SelectItem>
              <SelectItem value="clothing">Clothing</SelectItem>
              <SelectItem value="comparison">Comparison</SelectItem>
              <SelectItem value="content_type">Content Type</SelectItem>
              <SelectItem value="cosplay">Cosplay</SelectItem>
              <SelectItem value="couples">Couples</SelectItem>
              <SelectItem value="dancer">Dancer</SelectItem>
              <SelectItem value="ethnicity">Ethnicity</SelectItem>
              <SelectItem value="fetish">Fetish</SelectItem>
              <SelectItem value="fitness">Fitness</SelectItem>
              <SelectItem value="gaming">Gaming</SelectItem>
              <SelectItem value="general">General</SelectItem>
              <SelectItem value="gonewild">Gonewild</SelectItem>
              <SelectItem value="lifestyle">Lifestyle</SelectItem>
              <SelectItem value="natural">Natural</SelectItem>
              <SelectItem value="niche">Niche</SelectItem>
              <SelectItem value="reveal">Reveal</SelectItem>
              <SelectItem value="selling">Selling</SelectItem>
              <SelectItem value="social">Social</SelectItem>
              <SelectItem value="specific">Specific</SelectItem>
              <SelectItem value="style">Style</SelectItem>
              <SelectItem value="theme">Theme</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterPromotion} onValueChange={setFilterPromotion}>
            <SelectTrigger variant="overlay" className="w-[180px]">
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Promotion</SelectItem>
              <SelectItem value="yes">Allowed</SelectItem>
              <SelectItem value="limited">Limited</SelectItem>
              <SelectItem value="no">Not Allowed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterVerification} onValueChange={setFilterVerification}>
            <SelectTrigger variant="overlay" className="w-[180px]">
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Verification</SelectItem>
              <SelectItem value="required">Required</SelectItem>
              <SelectItem value="not-required">Not Required</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(v: 'success' | 'engagement' | 'members' | 'upvotes' | 'name') => setSortBy(v)}>
            <SelectTrigger variant="overlay" className="w-[150px]">
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="success">Success Rate</SelectItem>
              <SelectItem value="engagement">Engagement</SelectItem>
              <SelectItem value="members">Members</SelectItem>
              <SelectItem value="upvotes">Avg Upvotes</SelectItem>
              <SelectItem value="name">Name</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Debug info - remove after fixing */}
        {communitiesError && (
          <Alert variant="destructive">
            <AlertTitle>Error Loading Communities</AlertTitle>
            <AlertDescription>
              {communitiesError instanceof Error ? communitiesError.message : 'Failed to load communities'}
            </AlertDescription>
          </Alert>
        )}

        {/* Results count */}
        <div className="text-sm text-purple-800 dark:text-purple-200 font-medium">
          {_communitiesLoading ? (
            <span>🔄 Loading communities...</span>
          ) : (
            <span>📊 Found {filteredCommunities.length} {filteredCommunities.length === 1 ? 'community' : 'communities'}</span>
          )}
        </div>

        {/* Communities Table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-purple-600">
                <TableHead className="text-purple-900 dark:text-purple-200 font-semibold">🏠 Subreddit</TableHead>
                <TableHead className="text-purple-900 dark:text-purple-200 font-semibold">👥 Size</TableHead>
                <TableHead className="text-purple-900 dark:text-purple-200 font-semibold">🎯 Success</TableHead>
                <TableHead className="text-purple-900 dark:text-purple-200 font-semibold">📈 Activity</TableHead>
                <TableHead className="text-purple-900 dark:text-purple-200 font-semibold">🏷️ Type</TableHead>
                <TableHead className="text-purple-900 dark:text-purple-200 font-semibold">✓ Verified</TableHead>
                <TableHead className="text-purple-900 dark:text-purple-200 font-semibold">📢 Promo</TableHead>
                <TableHead className="text-purple-900 dark:text-purple-200 font-semibold">ℹ️ More</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCommunities.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <div className="text-purple-700 dark:text-purple-300">
                      <p className="text-lg mb-2 font-semibold">😕 No communities match your filters</p>
                      <p className="text-sm">
                        {_communitiesLoading 
                          ? "🔄 Loading communities from database..." 
                          : searchTerm 
                            ? "Try a different search term or remove some filters" 
                            : "The community database might be empty"}
                      </p>
                      {!_communitiesLoading && !searchTerm && (
                        <p className="text-xs mt-4 text-purple-600 dark:text-purple-400">
                          💡 Contact support if this issue persists
                        </p>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredCommunities.map((community) => {
                const modActivityDisplay = getModActivityDisplay(community.modActivity);
                const watermarkStatus = _formatBoolean(community.rules?.watermarksAllowed);
                const sellingStatus = _formatAllowance(community.rules?.sellingAllowed);
                const promotionalLinksStatus = _formatAllowance(community.rules?.promotionalLinksAllowed);
                return (
                  <React.Fragment key={community.id}>
                    <TableRow 
                      className="border-purple-600 hover:bg-pink-200/50 dark:hover:bg-pink-800/30 cursor-pointer"
                      onClick={() => setExpandedRow(expandedRow === community.id ? null : community.id)}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium text-purple-900 dark:text-purple-100">{community.name}</p>
                          <p className="text-xs text-purple-700 dark:text-purple-300">{community.displayName}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                          <span className="text-purple-800 dark:text-purple-200">{formatNumber(community.members)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className={`font-semibold ${getSuccessProbabilityColor(community.successProbability)}`}>
                            {community.successProbability !== null && community.successProbability !== undefined ? `${community.successProbability}%` : '—'}
                          </span>
                          {getGrowthTrendIcon(community.growthTrend)}
                        </div>
                        {community.successProbability && community.successProbability >= 85 && (
                          <span className="text-[10px] text-green-400">Hot! 🔥</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span className={`font-medium ${
                            community.engagementRate > 5 ? 'text-green-400' :
                            community.engagementRate > 2 ? 'text-yellow-400' : 'text-gray-400'
                          }`}>
                            {community.engagementRate}%
                          </span>
                        </div>
                        <span className="text-[10px] text-gray-500">
                          {community.engagementRate > 5 ? 'Very active' : community.engagementRate > 2 ? 'Active' : 'Quiet'}
                        </span>
                      </TableCell>
                      <TableCell>{getCategoryBadge(community.category)}</TableCell>
                      <TableCell>
                        <div className="flex flex-col items-start">
                          {community.verificationRequired ? (
                            <><CheckCircle className="h-4 w-4 text-yellow-400" /><span className="text-[10px] text-yellow-400 mt-0.5">Required</span></>
                          ) : (
                            <><XCircle className="h-4 w-4 text-green-400" /><span className="text-[10px] text-green-400 mt-0.5">Not needed</span></>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{getPromotionBadge(community.promotionAllowed)}</TableCell>
                      <TableCell>
                        <div className="text-xs text-gray-400">
                          {(() => {
                            const limits = community.postingLimits as Record<string, unknown> | null;
                            const postsPerDay = limits?.perDay ?? limits?.daily;
                            const cooldown = limits?.cooldownHours;

                            return (
                              <>
                                {postsPerDay !== undefined && postsPerDay !== null && `${postsPerDay}/day`}
                                {cooldown !== undefined && cooldown !== null && ` (${cooldown}h cooldown)`}
                              </>
                            );
                          })()}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button 
                          size="sm" 
                          variant="ghost"
                          className="text-purple-700 hover:text-purple-900 dark:text-purple-300 dark:hover:text-purple-100"
                        >
                          {expandedRow === community.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                    </TableRow>

                    {/* Expanded Details Row */}
                    {expandedRow === community.id && (
                      <TableRow>
                        <TableCell colSpan={8} className="bg-pink-50 dark:bg-pink-900/20 border-purple-600">
                          <div className="p-4 space-y-4">
                            <p className="text-sm text-purple-800 dark:text-purple-200">{community.description}</p>

                            <div className="grid md:grid-cols-4 gap-4">
                              <div>
                                <h4 className="text-sm font-semibold text-purple-900 dark:text-purple-200 mb-2">📋 Entry Requirements</h4>
                                <div className="space-y-1 text-xs text-purple-800 dark:text-purple-300">
                                  {community.rules?.minKarma !== undefined && community.rules?.minKarma !== null && <p>⚡ Need at least <strong>{community.rules.minKarma}</strong> karma</p>}
                                  {community.rules?.minAccountAge !== undefined && community.rules?.minAccountAge !== null && <p>📅 Account must be <strong>{community.rules.minAccountAge} days</strong> old</p>}
                                  <p>{watermarkStatus === 'Allowed'
                                    ? '✅ Watermarks are OK'
                                    : watermarkStatus === 'Not allowed'
                                      ? '❌ No watermarks allowed'
                                      : '❓ Watermark policy unknown'}</p>
                                  <p>{sellingStatus === 'Allowed'
                                    ? '💰 Selling links allowed'
                                    : sellingStatus === 'Limited'
                                      ? '⚠️ Limited selling allowed'
                                      : sellingStatus === 'Not allowed'
                                        ? '🚫 No selling allowed'
                                        : '❓ Selling policy unclear'}</p>
                                  <p>{promotionalLinksStatus === 'Allowed'
                                    ? '🔗 Promotional links allowed'
                                    : promotionalLinksStatus === 'Limited'
                                      ? '⚠️ Promotional links limited'
                                      : promotionalLinksStatus === 'Not allowed'
                                        ? '🚫 Promotional links not allowed'
                                        : '❓ Promotional link policy unknown'}</p>
                                </div>
                              </div>

                              <div>
                                <h4 className="text-sm font-semibold text-purple-900 dark:text-purple-200 mb-2">📊 Performance Metrics</h4>
                                <div className="space-y-1 text-xs text-purple-800 dark:text-purple-300">
                                  <p>🎯 <strong>{community.successProbability !== null && community.successProbability !== undefined ? `${community.successProbability}%` : 'Unknown'}</strong> success rate</p>
                                  <p>👤 Competition: <span className={community.competitionLevel === 'low' ? 'text-green-400 font-semibold' : community.competitionLevel === 'medium' ? 'text-yellow-400' : 'text-red-400 font-semibold'}>{community.competitionLevel === 'low' ? 'Easy to stand out' : community.competitionLevel === 'medium' ? 'Moderate' : community.competitionLevel === 'high' ? 'Very competitive' : 'Unknown'}</span></p>
                                  <p>📈 Growth: <span className={community.growthTrend === 'up' ? 'text-green-400 font-semibold' : community.growthTrend === 'stable' ? 'text-yellow-400' : 'text-red-400'}>{community.growthTrend === 'up' ? 'Growing fast' : community.growthTrend === 'stable' ? 'Steady' : community.growthTrend === 'down' ? 'Declining' : 'Unknown'}</span></p>
                                  <p>🛡️ Moderators: <span className={modActivityDisplay.className}>{modActivityDisplay.label === 'Active' ? 'Very active (strict rules)' : modActivityDisplay.label === 'Moderate' ? 'Moderately active' : modActivityDisplay.label === 'Inactive' ? 'Rarely active' : 'Unknown'}</span>
                                  </p>
                                </div>
                              </div>

                              <div>
                                <h4 className="text-sm font-semibold text-purple-900 dark:text-purple-200 mb-2">⏰ Best Times to Post</h4>
                                <div className="space-y-1 text-xs text-purple-800 dark:text-purple-300">
                                  {community.bestPostingTimes?.slice(0, 3).map((time: string, idx: number) => (
                                    <p key={idx} className="flex items-center gap-1"><span className="text-purple-400">▸</span> {time}</p>
                                  )) ?? <p>📊 No timing data yet</p>}
                                </div>
                              </div>

                              <div>
                                <h4 className="text-sm font-semibold text-purple-900 dark:text-purple-200 mb-2">📊 Typical Results</h4>
                                <div className="space-y-1 text-xs text-purple-800 dark:text-purple-300">
                                  <p>⬆️ Avg <strong>{community.averageUpvotes !== null && community.averageUpvotes !== undefined ? community.averageUpvotes.toLocaleString() : '—'}</strong> upvotes per post</p>
                                  <p>💬 <strong>{community.engagementRate}%</strong> of viewers engage</p>
                                  <p>👥 <strong>{formatNumber(community.members)}</strong> potential viewers</p>
                                </div>
                              </div>
                            </div>

                            {/* Rules and Tags */}
                            <div className="grid md:grid-cols-2 gap-4 mt-4">
                              {(community.rules?.titleRules || community.rules?.contentRules) && (
                                <div>
                                  <h4 className="text-sm font-semibold text-purple-900 dark:text-purple-200 mb-2">⚠️ Important Rules</h4>
                                  <div className="space-y-1 text-xs text-purple-800 dark:text-purple-300">
                                    {community.rules?.titleRules && community.rules.titleRules.map((rule: string, idx: number) => (
                                      <p key={idx} className="flex items-start gap-1"><span className="text-yellow-400 mt-0.5">📝</span> Title must: {rule}</p>
                                    ))}
                                    {community.rules?.contentRules && community.rules.contentRules.map((rule: string, idx: number) => (
                                      <p key={idx} className="flex items-start gap-1"><span className="text-yellow-400 mt-0.5">🖼️</span> Content must: {rule}</p>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {community.tags && community.tags.length > 0 && (
                                <div>
                                  <h4 className="text-sm font-semibold text-purple-900 dark:text-purple-200 mb-2">🏷️ Tags</h4>
                                  <div className="flex flex-wrap gap-1">
                                    {community.tags.map((tag: string, idx: number) => (
                                      <Badge key={idx} className="bg-purple-200 dark:bg-purple-700/50 text-purple-900 dark:text-purple-200 text-xs border border-purple-600">
                                        {tag}
                                      </Badge>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                );
              })
              )}
            </TableBody>
          </Table>
        </div>

        {/* Summary Stats */}
        <div className="grid md:grid-cols-4 gap-4 pt-4 border-t-2 border-purple-600">
          <Card className="bg-white dark:bg-pink-800/30 border-purple-600 border-2">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-purple-800 dark:text-purple-200 font-medium">Available Subreddits</p>
                  <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">{filteredCommunities.length}</p>
                  <p className="text-[10px] text-purple-700 dark:text-purple-300 mt-0.5">communities found</p>
                </div>
                <Users className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-pink-800/30 border-purple-600 border-2">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-purple-800 dark:text-purple-200 font-medium">Average Activity</p>
                  <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                    {(filteredCommunities.reduce((acc, c) => acc + c.engagementRate, 0) / (filteredCommunities.length || 1)).toFixed(1)}%
                  </p>
                  <p className="text-[10px] text-purple-700 dark:text-purple-300 mt-0.5">engagement rate</p>
                </div>
                <TrendingUp className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-pink-800/30 border-purple-600 border-2">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-purple-800 dark:text-purple-200 font-medium">Promo-Friendly</p>
                  <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                    {filteredCommunities.filter(c => c.promotionAllowed === 'yes').length}
                  </p>
                  <p className="text-[10px] text-purple-700 dark:text-purple-300 mt-0.5">allow promotion</p>
                </div>
                <Megaphone className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white dark:bg-pink-800/30 border-purple-600 border-2">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-purple-800 dark:text-purple-200 font-medium">Need Verification</p>
                  <p className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                    {filteredCommunities.filter(c => c.verificationRequired).length}
                  </p>
                  <p className="text-[10px] text-purple-700 dark:text-purple-300 mt-0.5">require verification</p>
                </div>
                <Shield className="h-8 w-8 text-purple-600 dark:text-purple-400" />
              </div>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
}