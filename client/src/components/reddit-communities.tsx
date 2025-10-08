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

type RuleAllowance = 'yes' | 'limited' | 'no';

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

      const response = await apiRequest('GET', `/api/reddit/communities?${params.toString()}`);
      return response.json();
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
      case 'yes':
        return 'Allowed';
      case 'limited':
        return 'Limited';
      case 'no':
        return 'Not allowed';
      default:
        return undefined;
    }
  };

  const _formatBoolean = (value?: boolean) => {
    if (typeof value !== 'boolean') return undefined;
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
    <Card className="bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-pink-200/50 dark:border-pink-500/20 shadow-xl">
      <CardHeader>
        <CardTitle className="text-2xl bg-gradient-to-r from-pink-600 via-rose-500 to-purple-600 dark:from-pink-400 dark:via-rose-400 dark:to-purple-400 bg-clip-text text-transparent">
          Reddit Communities Database
        </CardTitle>
        <p className="text-sm text-gray-600 dark:text-gray-300">
          100+ communities with success probability scoring, growth trends, and intelligent recommendations
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
              className="pl-10 bg-white/60 dark:bg-gray-800/60 border-pink-200 dark:border-pink-500/30 focus:border-pink-400 dark:focus:border-pink-400"
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

        {/* Results count */}
        <div className="text-sm text-gray-400">
          Showing {filteredCommunities.length} communities
        </div>

        {/* Communities Table */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-purple-500/20">
                <TableHead className="text-purple-300">Community</TableHead>
                <TableHead className="text-purple-300">Members</TableHead>
                <TableHead className="text-purple-300">Success Rate</TableHead>
                <TableHead className="text-purple-300">Engagement</TableHead>
                <TableHead className="text-purple-300">Category</TableHead>
                <TableHead className="text-purple-300">Verification</TableHead>
                <TableHead className="text-purple-300">Promotion</TableHead>
                <TableHead className="text-purple-300">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCommunities.map((community) => {
                const modActivityDisplay = getModActivityDisplay(community.modActivity);
                return (
                  <React.Fragment key={community.id}>
                    <TableRow 
                      className="border-purple-500/10 hover:bg-purple-500/5 cursor-pointer"
                      onClick={() => setExpandedRow(expandedRow === community.id ? null : community.id)}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium text-white">{community.name}</p>
                          <p className="text-xs text-gray-400">{community.displayName}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Users className="h-4 w-4 text-gray-400" />
                          <span className="text-gray-300">{formatNumber(community.members)}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <span className={`font-medium ${getSuccessProbabilityColor(community.successProbability)}`}>
                            {community.successProbability !== null && community.successProbability !== undefined ? `${community.successProbability}%` : 'N/A'}
                          </span>
                          {getGrowthTrendIcon(community.growthTrend)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <TrendingUp className="h-4 w-4 text-green-400" />
                          <span className="text-gray-300">{community.engagementRate}%</span>
                        </div>
                      </TableCell>
                      <TableCell>{getCategoryBadge(community.category)}</TableCell>
                      <TableCell>
                        {community.verificationRequired ? (
                          <CheckCircle className="h-4 w-4 text-green-400" />
                        ) : (
                          <XCircle className="h-4 w-4 text-gray-400" />
                        )}
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
                          className="text-purple-400 hover:text-purple-300"
                        >
                          {expandedRow === community.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </Button>
                      </TableCell>
                    </TableRow>

                    {/* Expanded Details Row */}
                    {expandedRow === community.id && (
                      <TableRow>
                        <TableCell colSpan={8} className="bg-gray-800/30">
                          <div className="p-4 space-y-4">
                            <p className="text-sm text-gray-300">{community.description}</p>

                            <div className="grid md:grid-cols-4 gap-4">
                              <div>
                                <h4 className="text-sm font-semibold text-purple-300 mb-2">Requirements</h4>
                                <div className="space-y-1 text-xs text-gray-400">
                                  {community.rules?.minKarma !== undefined && community.rules?.minKarma !== null && <p>• Min Karma: {community.rules.minKarma}</p>}
                                  {community.rules?.minAccountAge !== undefined && community.rules?.minAccountAge !== null && <p>• Min Account Age: {community.rules.minAccountAge} days</p>}
                                  <p>• Watermarks: {community.rules?.watermarksAllowed ? '✓ Allowed' : '✗ Not Allowed'}</p>
                                  <p>• Selling: {(() => {
                                    const policy = community.rules?.sellingAllowed;
                                    switch (policy) {
                                      case 'allowed': return '✓ Allowed';
                                      case 'limited': return '⚠ Limited';
                                      case 'not_allowed': return '✗ Not Allowed';
                                      case 'unknown': return '? Unknown';
                                      default: return '? Unknown';
                                    }
                                  })()}</p>
                                </div>
                              </div>

                              <div>
                                <h4 className="text-sm font-semibold text-purple-300 mb-2">Intelligence</h4>
                                <div className="space-y-1 text-xs text-gray-400">
                                  <p>• Success Rate: <span className={getSuccessProbabilityColor(community.successProbability)}>{community.successProbability !== null && community.successProbability !== undefined ? `${community.successProbability}%` : 'N/A'}</span></p>
                                  <p>• Competition: <span className={community.competitionLevel === 'low' ? 'text-green-400' : community.competitionLevel === 'medium' ? 'text-yellow-400' : 'text-red-400'}>{community.competitionLevel ?? 'Unknown'}</span></p>
                                  <p>• Growth: <span className={community.growthTrend === 'up' ? 'text-green-400' : community.growthTrend === 'stable' ? 'text-yellow-400' : 'text-red-400'}>{community.growthTrend || 'Unknown'}</span></p>
                                  <p>
                                    • Mod Activity: <span className={modActivityDisplay.className}>{modActivityDisplay.label}</span>
                                  </p>
                                </div>
                              </div>

                              <div>
                                <h4 className="text-sm font-semibold text-purple-300 mb-2">Best Posting Times</h4>
                                <div className="space-y-1 text-xs text-gray-400">
                                  {community.bestPostingTimes?.slice(0, 3).map((time: string, idx: number) => (
                                    <p key={idx}>• {time}</p>
                                  )) ?? <p>No data</p>}
                                </div>
                              </div>

                              <div>
                                <h4 className="text-sm font-semibold text-purple-300 mb-2">Performance</h4>
                                <div className="space-y-1 text-xs text-gray-400">
                                  <p>• Avg Upvotes: {community.averageUpvotes !== null && community.averageUpvotes !== undefined ? community.averageUpvotes.toLocaleString() : 'N/A'}</p>
                                  <p>• Engagement Rate: {community.engagementRate}%</p>
                                  <p>• Total Members: {community.members.toLocaleString()}</p>
                                </div>
                              </div>
                            </div>

                            {/* Rules and Tags */}
                            <div className="grid md:grid-cols-2 gap-4 mt-4">
                              {(community.rules?.titleRules || community.rules?.contentRules) && (
                                <div>
                                  <h4 className="text-sm font-semibold text-purple-300 mb-2">Community Rules</h4>
                                  <div className="space-y-1 text-xs text-gray-400">
                                    {community.rules?.titleRules && community.rules.titleRules.map((rule: string, idx: number) => (
                                      <p key={idx}>• Title: {rule}</p>
                                    ))}
                                    {community.rules?.contentRules && community.rules.contentRules.map((rule: string, idx: number) => (
                                      <p key={idx}>• Content: {rule}</p>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {community.tags && community.tags.length > 0 && (
                                <div>
                                  <h4 className="text-sm font-semibold text-purple-300 mb-2">Tags</h4>
                                  <div className="flex flex-wrap gap-1">
                                    {community.tags.map((tag: string, idx: number) => (
                                      <Badge key={idx} className="bg-gray-700/50 text-gray-300 text-xs">
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
              })}
            </TableBody>
          </Table>
        </div>

        {/* Summary Stats */}
        <div className="grid md:grid-cols-4 gap-4 pt-4 border-t border-purple-500/20">
          <Card className="bg-gray-800/50 border-purple-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400">Total Communities</p>
                  <p className="text-2xl font-bold text-purple-400">{filteredCommunities.length}</p>
                </div>
                <Users className="h-8 w-8 text-purple-400/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800/50 border-purple-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400">Avg Engagement</p>
                  <p className="text-2xl font-bold text-green-400">
                    {(filteredCommunities.reduce((acc, c) => acc + c.engagementRate, 0) / (filteredCommunities.length || 1)).toFixed(1)}%
                  </p>
                </div>
                <TrendingUp className="h-8 w-8 text-green-400/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800/50 border-purple-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400">Allow Promotion</p>
                  <p className="text-2xl font-bold text-pink-400">
                    {filteredCommunities.filter(c => c.promotionAllowed === 'yes').length}
                  </p>
                </div>
                <Megaphone className="h-8 w-8 text-pink-400/50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gray-800/50 border-purple-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-400">Require Verification</p>
                  <p className="text-2xl font-bold text-orange-400">
                    {filteredCommunities.filter(c => c.verificationRequired).length}
                  </p>
                </div>
                <Shield className="h-8 w-8 text-orange-400/50" />
              </div>
            </CardContent>
          </Card>
        </div>
      </CardContent>
    </Card>
  );
}