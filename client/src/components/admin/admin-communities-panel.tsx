import { useMemo, useState } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import {
  type AdminCommunity,
  type CommunityPayload,
  type PromotionPolicy,
  type GrowthTrend,
  type ActivityLevel,
  type CompetitionLevel,
  type CommunityRules,
  type PostingLimits,
  useAdminCommunities,
  useCreateCommunity,
  useUpdateCommunity,
  useDeleteCommunity,
  GROWTH_TRENDS,
  GROWTH_TREND_LABELS,
} from '@/hooks/use-admin-communities';
import type {
  LegacyRedditCommunityRuleSet,
  RedditCommunityRuleSet,
  RedditCommunitySellingPolicy,
} from '@shared/schema';
import { CheckCircle, Edit2, Loader2, PlusCircle, ShieldAlert, Trash2 } from 'lucide-react';

interface AdminCommunitiesPanelProps {
  canManage: boolean;
}

type SellingRuleOption = 'unspecified' | RedditCommunitySellingPolicy;
type TriState = 'unspecified' | 'allowed' | 'disallowed';

interface CommunityFormState {
  id: string;
  name: string;
  displayName: string;
  category: string;
  members: string;
  engagementRate: string;
  verificationRequired: boolean;
  promotionAllowed: PromotionPolicy;
  postingLimitsPerDay: string;
  postingLimitsPerWeek: string;
  postingLimitsCooldownHours: string;
  rulesMinKarma: string;
  rulesMinAccountAge: string;
  rulesWatermarksAllowed: TriState;
  rulesSellingAllowed: SellingRuleOption;
  rulesTitleRules: string;
  rulesContentRules: string;
  rulesLinkRestrictions: string;
  bestPostingTimes: string;
  averageUpvotes: string;
  successProbability: string;
  growthTrend: GrowthTrend;
  modActivity: ActivityLevel;
  description: string;
  tags: string;
  competitionLevel: CompetitionLevel;
}

const defaultFormState: CommunityFormState = {
  id: '',
  name: '',
  displayName: '',
  category: '',
  members: '',
  engagementRate: '',
  verificationRequired: false,
  promotionAllowed: 'limited',
  postingLimitsPerDay: '',
  postingLimitsPerWeek: '',
  postingLimitsCooldownHours: '',
  rulesMinKarma: '',
  rulesMinAccountAge: '',
  rulesWatermarksAllowed: 'unspecified',
  rulesSellingAllowed: 'unspecified',
  rulesTitleRules: '',
  rulesContentRules: '',
  rulesLinkRestrictions: '',
  bestPostingTimes: '',
  averageUpvotes: '',
  successProbability: '',
  growthTrend: 'stable',
  modActivity: 'medium',
  description: '',
  tags: '',
  competitionLevel: 'medium',
};

function parseNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  const parsed = Number(trimmed);
  return Number.isNaN(parsed) ? undefined : parsed;
}

function parseList(value: string): string[] | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const items = trimmed
    .split(/\n|,/)
    .map(item => item.trim())
    .filter(Boolean);
  return items.length ? items : undefined;
}

function toStringValue(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') return '';
  return String(value);
}

interface RuleContext {
  eligibility: RedditCommunityRuleSet['eligibility'] | null | undefined;
  content: RedditCommunityRuleSet['content'] | null | undefined;
  posting: RedditCommunityRuleSet['posting'] | null | undefined;
  legacy: LegacyRedditCommunityRuleSet | null | undefined;
}

function getRuleContext(community: AdminCommunity): RuleContext {
  const rules = community.rules ?? null;
  const legacyRules = community.legacyRules ?? null;
  return {
    eligibility: rules?.eligibility ?? legacyRules,
    content: rules?.content ?? legacyRules,
    posting: rules?.posting ?? legacyRules,
    legacy: legacyRules,
  };
}

function formToPayload(formState: CommunityFormState): CommunityPayload {
  const rules: Partial<CommunityRules> = {
    eligibility: {
      minKarma: parseNumber(formState.rulesMinKarma),
      minAccountAgeDays: parseNumber(formState.rulesMinAccountAge),
    },
    content: {
      watermarksAllowed: formState.rulesWatermarksAllowed === 'allowed' ? true : 
                        formState.rulesWatermarksAllowed === 'disallowed' ? false : null,
      sellingPolicy: formState.rulesSellingAllowed === 'unspecified' ? undefined : formState.rulesSellingAllowed as RedditCommunitySellingPolicy,
      titleGuidelines: parseList(formState.rulesTitleRules),
      contentGuidelines: parseList(formState.rulesContentRules),
      linkRestrictions: parseList(formState.rulesLinkRestrictions),
    },
    posting: {
      maxPostsPerDay: parseNumber(formState.postingLimitsPerDay),
      cooldownHours: parseNumber(formState.postingLimitsCooldownHours),
    }
  };

  const postingLimits: PostingLimits = {
    perDay: parseNumber(formState.postingLimitsPerDay),
    perWeek: parseNumber(formState.postingLimitsPerWeek),
    cooldownHours: parseNumber(formState.postingLimitsCooldownHours),
  };

  return {
    id: formState.id || undefined,
    name: formState.name,
    displayName: formState.displayName,
    category: formState.category,
    members: parseNumber(formState.members) || 0,
    engagementRate: parseNumber(formState.engagementRate) || 0,
    verificationRequired: formState.verificationRequired,
    promotionAllowed: formState.promotionAllowed,
    postingLimits: Object.values(postingLimits).some(v => v !== undefined) ? postingLimits : null,
    rules: Object.values(rules).some(section => section && Object.values(section).some(v => v !== undefined && v !== null)) ? rules : null,
    bestPostingTimes: parseList(formState.bestPostingTimes),
    averageUpvotes: parseNumber(formState.averageUpvotes),
    successProbability: parseNumber(formState.successProbability),
    growthTrend: formState.growthTrend,
    modActivity: formState.modActivity,
    description: formState.description || null,
    tags: parseList(formState.tags),
    competitionLevel: formState.competitionLevel,
  };
}

function communityToForm(community: AdminCommunity): CommunityFormState {
  const { eligibility, content, posting, legacy } = getRuleContext(community);
  const postingLimits = community.postingLimits ?? null;
  const titleGuidelines = content?.titleGuidelines ?? legacy?.titleRules ?? [];
  const contentGuidelines = content?.contentGuidelines ?? legacy?.contentRules ?? [];
  const linkRestrictions = content?.linkRestrictions ?? [] as string[];
  const watermarksAllowed = content?.watermarksAllowed ?? legacy?.watermarksAllowed ?? null;
  const sellingPolicy = content?.sellingPolicy ?? legacy?.sellingAllowed ?? undefined;
  const minKarma = eligibility?.minKarma ?? legacy?.minKarma ?? null;
  const minAccountAge =
    eligibility?.minAccountAgeDays ?? legacy?.minAccountAge ?? legacy?.minAccountAgeDays ?? null;
  const maxPostsPerDay =
    postingLimits?.perDay ?? posting?.maxPostsPerDay ?? legacy?.maxPostsPerDay ?? null;
  const maxPostsPerWeek = postingLimits?.perWeek ?? null;
  const cooldownHours =
    postingLimits?.cooldownHours ?? posting?.cooldownHours ?? legacy?.cooldownHours ?? null;

  return {
    id: community.id,
    name: community.name,
    displayName: community.displayName,
    category: community.category,
    members: String(community.members ?? ''),
    engagementRate: String(community.engagementRate ?? ''),
    verificationRequired: community.verificationRequired,
    promotionAllowed: community.promotionAllowed,
    postingLimitsPerDay: toStringValue(maxPostsPerDay),
    postingLimitsPerWeek: toStringValue(maxPostsPerWeek),
    postingLimitsCooldownHours: toStringValue(cooldownHours),
    rulesMinKarma: toStringValue(minKarma),
    rulesMinAccountAge: toStringValue(minAccountAge),
    rulesWatermarksAllowed:
      watermarksAllowed === true
        ? 'allowed'
        : watermarksAllowed === false
          ? 'disallowed'
          : 'unspecified',
    rulesSellingAllowed: sellingPolicy ?? 'unspecified',
    rulesTitleRules: titleGuidelines.join('\n'),
    rulesContentRules: contentGuidelines.join('\n'),
    rulesLinkRestrictions: linkRestrictions.join('\n'),
    bestPostingTimes: (community.bestPostingTimes ?? []).join(', '),
    averageUpvotes: community.averageUpvotes !== null && community.averageUpvotes !== undefined
      ? String(community.averageUpvotes)
      : '',
    successProbability: community.successProbability !== null && community.successProbability !== undefined
      ? String(community.successProbability)
      : '',
    growthTrend: community.growthTrend ?? 'stable',
    modActivity: community.modActivity ?? 'medium',
    description: community.description ?? '',
    tags: (community.tags ?? []).join(', '),
    competitionLevel: community.competitionLevel ?? 'medium',
  };
}

function RuleSummary({ community }: { community: AdminCommunity }) {
  const { eligibility, content, legacy } = getRuleContext(community);
  const ruleItems: string[] = [];

  const minKarma = eligibility?.minKarma ?? legacy?.minKarma;
  if (typeof minKarma === 'number') {
    ruleItems.push(`Min Karma ${minKarma}`);
  }

  const minAccountAge = eligibility?.minAccountAgeDays ?? legacy?.minAccountAge ?? legacy?.minAccountAgeDays;
  if (typeof minAccountAge === 'number') {
    ruleItems.push(`Account ${minAccountAge}d`);
  }

  const watermarksAllowed = content?.watermarksAllowed ?? legacy?.watermarksAllowed ?? null;
  if (watermarksAllowed === true) {
    ruleItems.push('Watermarks allowed');
  }
  if (watermarksAllowed === false) {
    ruleItems.push('No watermarks');
  }

  const sellingPolicy = content?.sellingPolicy ?? legacy?.sellingAllowed;
  if (sellingPolicy === 'allowed') {
    ruleItems.push('Selling allowed');
  } else if (sellingPolicy === 'limited') {
    ruleItems.push('Limited selling');
  } else if (sellingPolicy === 'not_allowed') {
    ruleItems.push('No selling');
  } else if (sellingPolicy === 'unknown') {
    ruleItems.push('Selling policy unknown');
  }

  const titleGuidelines = content?.titleGuidelines ?? legacy?.titleRules ?? [];
  if (titleGuidelines.length > 0) {
    ruleItems.push(`${titleGuidelines.length} title rules`);
  }

  const contentGuidelines = content?.contentGuidelines ?? legacy?.contentRules ?? [];
  if (contentGuidelines.length > 0) {
    ruleItems.push(`${contentGuidelines.length} content rules`);
  }

  const linkRestrictions = content?.linkRestrictions ?? [] as string[];
  if (linkRestrictions.length > 0) {
    ruleItems.push('Link restrictions');
  }
  return (
    <div className="flex flex-wrap gap-1">
      {ruleItems.length ? (
        ruleItems.map(item => (
          <Badge key={item} variant="secondary" className="bg-purple-50 text-purple-700">
            {item}
          </Badge>
        ))
      ) : (
        <span className="text-sm text-muted-foreground">No structured rules</span>
      )}
    </div>
  );
}

export function AdminCommunitiesPanel({ canManage }: AdminCommunitiesPanelProps) {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [promotionFilter, setPromotionFilter] = useState<'all' | PromotionPolicy>('all');
  const [verificationFilter, setVerificationFilter] = useState<'all' | 'required' | 'not-required'>('all');
  const [formState, setFormState] = useState<CommunityFormState>(defaultFormState);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingCommunity, setEditingCommunity] = useState<AdminCommunity | null>(null);

  const filters = useMemo(
    () => ({
      search: searchTerm || undefined,
      category: categoryFilter === 'all' ? undefined : categoryFilter,
      promotionAllowed: promotionFilter === 'all' ? undefined : promotionFilter,
      verificationRequired: verificationFilter === 'all' ? undefined : verificationFilter,
    }),
    [searchTerm, categoryFilter, promotionFilter, verificationFilter],
  );

  const { data: communities, isLoading, error } = useAdminCommunities(filters);
  const createMutation = useCreateCommunity();
  const updateMutation = useUpdateCommunity();
  const deleteMutation = useDeleteCommunity();

  const uniqueCategories = useMemo(() => {
    if (!communities) return [];
    const categories = new Set(communities.map(c => c.category));
    return Array.from(categories).sort();
  }, [communities]);

  const handleCreate = () => {
    setFormState(defaultFormState);
    setEditingCommunity(null);
    setIsCreateOpen(true);
  };

  const handleEdit = (community: AdminCommunity) => {
    setFormState(communityToForm(community));
    setEditingCommunity(community);
    setIsCreateOpen(true);
  };

  const handleSubmit = async () => {
    try {
      const payload = formToPayload(formState);

      if (editingCommunity) {
        await updateMutation.mutateAsync({ id: editingCommunity.id, payload });
        toast({ title: 'Community updated successfully' });
      } else {
        await createMutation.mutateAsync(payload);
        toast({ title: 'Community created successfully' });
      }

      setIsCreateOpen(false);
      setEditingCommunity(null);
      setFormState(defaultFormState);
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save community',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast({ title: 'Community deleted successfully' });
    } catch (error) {
      console.error('Delete error:', _error);
      toast({
        title: 'Error',
        description: 'Failed to delete community',
        variant: 'destructive',
      });
    }
  };

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5 text-red-500" />
            Error Loading Communities
          </CardTitle>
          <CardDescription>
            Failed to load community data. Please check your connection and try again.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <div className="space-y-6" data-testid="admin-communities-panel">
      {/* Header and Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Reddit Communities</h2>
          <p className="text-muted-foreground">
            Manage the subreddit directory and community rules
          </p>
        </div>
        {canManage && (
          <Button onClick={handleCreate} data-testid="button-create">
            <PlusCircle className="mr-2 h-4 w-4" />
            Add Community
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <Input
                id="search"
                placeholder="Search communities..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                data-testid="input-search"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Category</Label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger data-testid="select-category">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {uniqueCategories.map(category => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="promotion">Promotion Policy</Label>
              <Select value={promotionFilter} onValueChange={(value) => setPromotionFilter(value as typeof promotionFilter)}>
                <SelectTrigger data-testid="select-promotion">
                  <SelectValue placeholder="All policies" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All policies</SelectItem>
                  <SelectItem value="yes">Allowed</SelectItem>
                  <SelectItem value="limited">Limited</SelectItem>
                  <SelectItem value="no">Not allowed</SelectItem>
                  <SelectItem value="subtle">Subtle only</SelectItem>
                  <SelectItem value="strict">Strict rules</SelectItem>
                  <SelectItem value="unknown">Unknown</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="verification">Verification</Label>
              <Select value={verificationFilter} onValueChange={(value) => setVerificationFilter(value as typeof verificationFilter)}>
                <SelectTrigger data-testid="select-verification">
                  <SelectValue placeholder="All verification" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="required">Required</SelectItem>
                  <SelectItem value="not-required">Not required</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Communities Table */}
      <Card>
        <CardHeader>
          <CardTitle>Communities ({communities?.length ?? 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span className="ml-2">Loading communities...</span>
            </div>
          ) : communities?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No communities found matching your filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Community</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Members</TableHead>
                    <TableHead>Promotion</TableHead>
                    <TableHead>Rules Summary</TableHead>
                    {canManage && <TableHead>Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {communities?.map((community) => (
                    <TableRow key={community.id} data-testid={`row-community-${community.id}`}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{community.displayName}</div>
                          <div className="text-sm text-muted-foreground">r/{community.name}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{community.category}</Badge>
                      </TableCell>
                      <TableCell>{community.members.toLocaleString()}</TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            community.promotionAllowed === 'yes'
                              ? 'default'
                              : community.promotionAllowed === 'limited'
                                ? 'secondary'
                                : 'destructive'
                          }
                        >
                          {community.promotionAllowed}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <RuleSummary community={community} />
                      </TableCell>
                      {canManage && (
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(community)}
                              data-testid={`button-edit-${community.id}`}
                            >
                              <Edit2 className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  data-testid={`button-delete-${community.id}`}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Community</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete r/{community.name}? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDelete(community.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                  >
                                    Delete
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCommunity ? 'Edit Community' : 'Create Community'}
            </DialogTitle>
            <DialogDescription>
              {editingCommunity
                ? 'Update the community information and rules.'
                : 'Add a new Reddit community to the directory.'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Basic Information</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Subreddit Name</Label>
                  <Input
                    id="name"
                    placeholder="e.g., gonewild"
                    value={formState.name}
                    onChange={(e) => setFormState(prev => ({ ...prev, name: e.target.value }))}
                    data-testid="input-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    placeholder="e.g., Gone Wild"
                    value={formState.displayName}
                    onChange={(e) => setFormState(prev => ({ ...prev, displayName: e.target.value }))}
                    data-testid="input-display-name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Category</Label>
                  <Input
                    id="category"
                    placeholder="e.g., nsfw"
                    value={formState.category}
                    onChange={(e) => setFormState(prev => ({ ...prev, category: e.target.value }))}
                    data-testid="input-category"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="members">Members</Label>
                  <Input
                    id="members"
                    type="number"
                    placeholder="e.g., 500000"
                    value={formState.members}
                    onChange={(e) => setFormState(prev => ({ ...prev, members: e.target.value }))}
                    data-testid="input-members"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="engagementRate">Engagement Rate</Label>
                  <Input
                    id="engagementRate"
                    type="number"
                    step="0.01"
                    placeholder="e.g., 0.05"
                    value={formState.engagementRate}
                    onChange={(e) => setFormState(prev => ({ ...prev, engagementRate: e.target.value }))}
                    data-testid="input-engagement-rate"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="promotionAllowed">Promotion Policy</Label>
                  <Select
                    value={formState.promotionAllowed}
                    onValueChange={(value) => setFormState(prev => ({ ...prev, promotionAllowed: value as PromotionPolicy }))}
                  >
                    <SelectTrigger data-testid="select-promotion-allowed">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="yes">Allowed</SelectItem>
                      <SelectItem value="limited">Limited</SelectItem>
                      <SelectItem value="no">Not allowed</SelectItem>
                      <SelectItem value="subtle">Subtle only</SelectItem>
                      <SelectItem value="strict">Strict rules</SelectItem>
                      <SelectItem value="unknown">Unknown</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="verificationRequired"
                  checked={formState.verificationRequired}
                  onCheckedChange={(checked) => setFormState(prev => ({ ...prev, verificationRequired: checked }))}
                  data-testid="switch-verification-required"
                />
                <Label htmlFor="verificationRequired">Verification Required</Label>
              </div>
            </div>

            {/* Rules Section */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Community Rules</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="rulesMinKarma">Minimum Karma</Label>
                  <Input
                    id="rulesMinKarma"
                    type="number"
                    placeholder="e.g., 100"
                    value={formState.rulesMinKarma}
                    onChange={(e) => setFormState(prev => ({ ...prev, rulesMinKarma: e.target.value }))}
                    data-testid="input-rules-min-karma"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rulesMinAccountAge">Minimum Account Age (days)</Label>
                  <Input
                    id="rulesMinAccountAge"
                    type="number"
                    placeholder="e.g., 30"
                    value={formState.rulesMinAccountAge}
                    onChange={(e) => setFormState(prev => ({ ...prev, rulesMinAccountAge: e.target.value }))}
                    data-testid="input-rules-min-account-age"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rulesWatermarksAllowed">Watermarks</Label>
                  <Select
                    value={formState.rulesWatermarksAllowed}
                    onValueChange={(value) => setFormState(prev => ({ ...prev, rulesWatermarksAllowed: value as TriState }))}
                  >
                    <SelectTrigger data-testid="select-rules-watermarks-allowed">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unspecified">Unspecified</SelectItem>
                      <SelectItem value="allowed">Allowed</SelectItem>
                      <SelectItem value="disallowed">Not allowed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rulesSellingAllowed">Selling</Label>
                  <Select
                    value={formState.rulesSellingAllowed}
                    onValueChange={(value) => setFormState(prev => ({ ...prev, rulesSellingAllowed: value as SellingRuleOption }))}
                  >
                    <SelectTrigger data-testid="select-rules-selling-allowed">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unspecified">Unspecified</SelectItem>
                      <SelectItem value="allowed">Allowed</SelectItem>
                      <SelectItem value="limited">Limited</SelectItem>
                      <SelectItem value="not_allowed">Not Allowed</SelectItem>
                      <SelectItem value="unknown">Unknown</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <Label htmlFor="rulesTitleRules">Title Rules (one per line)</Label>
                  <Textarea
                    id="rulesTitleRules"
                    placeholder="e.g., Must include age&#10;No clickbait"
                    value={formState.rulesTitleRules}
                    onChange={(e) => setFormState(prev => ({ ...prev, rulesTitleRules: e.target.value }))}
                    data-testid="textarea-rules-title-rules"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rulesContentRules">Content Rules (one per line)</Label>
                  <Textarea
                    id="rulesContentRules"
                    placeholder="e.g., OC only&#10;High quality images"
                    value={formState.rulesContentRules}
                    onChange={(e) => setFormState(prev => ({ ...prev, rulesContentRules: e.target.value }))}
                    data-testid="textarea-rules-content-rules"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rulesLinkRestrictions">Link Restrictions (one per line)</Label>
                  <Textarea
                    id="rulesLinkRestrictions"
                    placeholder="e.g., No OnlyFans links&#10;Imgur only"
                    value={formState.rulesLinkRestrictions}
                    onChange={(e) => setFormState(prev => ({ ...prev, rulesLinkRestrictions: e.target.value }))}
                    data-testid="textarea-rules-link-restrictions"
                  />
                </div>
              </div>
            </div>

            {/* Additional Information */}
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Additional Information</h3>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="bestPostingTimes">Best Posting Times (comma separated)</Label>
                  <Input
                    id="bestPostingTimes"
                    placeholder="e.g., morning, evening"
                    value={formState.bestPostingTimes}
                    onChange={(e) => setFormState(prev => ({ ...prev, bestPostingTimes: e.target.value }))}
                    data-testid="input-best-posting-times"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tags">Tags (comma separated)</Label>
                  <Input
                    id="tags"
                    placeholder="e.g., adult, verification, high-traffic"
                    value={formState.tags}
                    onChange={(e) => setFormState(prev => ({ ...prev, tags: e.target.value }))}
                    data-testid="input-tags"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="averageUpvotes">Average Upvotes</Label>
                  <Input
                    id="averageUpvotes"
                    type="number"
                    placeholder="e.g., 150"
                    value={formState.averageUpvotes}
                    onChange={(e) => setFormState(prev => ({ ...prev, averageUpvotes: e.target.value }))}
                    data-testid="input-average-upvotes"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="successProbability">Success Probability (%)</Label>
                  <Input
                    id="successProbability"
                    type="number"
                    step="0.01"
                    placeholder="e.g., 75.5"
                    value={formState.successProbability}
                    onChange={(e) => setFormState(prev => ({ ...prev, successProbability: e.target.value }))}
                    data-testid="input-success-probability"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="growthTrend">Growth Trend</Label>
                  <Select
                    value={formState.growthTrend}
                    onValueChange={(value) => setFormState(prev => ({ ...prev, growthTrend: value as GrowthTrend }))}
                  >
                    <SelectTrigger data-testid="select-growth-trend">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {GROWTH_TRENDS.map(trend => (
                        <SelectItem key={trend} value={trend}>
                          {GROWTH_TREND_LABELS[trend]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="competitionLevel">Competition Level</Label>
                  <Select
                    value={formState.competitionLevel}
                    onValueChange={(value) => setFormState(prev => ({ ...prev, competitionLevel: value as CompetitionLevel }))}
                  >
                    <SelectTrigger data-testid="select-competition-level">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="unknown">Unknown</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Community description..."
                  value={formState.description}
                  onChange={(e) => setFormState(prev => ({ ...prev, description: e.target.value }))}
                  data-testid="textarea-description"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setIsCreateOpen(false)}
                data-testid="button-cancel"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={createMutation.isPending || updateMutation.isPending}
                data-testid="button-submit"
              >
                {createMutation.isPending || updateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {editingCommunity ? 'Updating...' : 'Creating...'}
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    {editingCommunity ? 'Update Community' : 'Create Community'}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}