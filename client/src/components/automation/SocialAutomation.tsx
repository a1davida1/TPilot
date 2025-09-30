import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Clock, Zap, Target, TrendingUp, Settings, Users, BarChart3, Calendar } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type PlatformStatus = 'connected' | 'pending' | 'available';

type PlatformSummary = {
  id: string;
  name: string;
  defaultStatus: PlatformStatus;
  posts: number;
  engagement: number;
};

const PLATFORM_SUMMARIES: PlatformSummary[] = [
  { id: 'reddit', name: 'Reddit', defaultStatus: 'connected', posts: 234, engagement: 4.2 },
  { id: 'twitter', name: 'Twitter/X', defaultStatus: 'connected', posts: 189, engagement: 3.8 },
  { id: 'instagram', name: 'Instagram', defaultStatus: 'pending', posts: 0, engagement: 0 },
  { id: 'tiktok', name: 'TikTok', defaultStatus: 'available', posts: 0, engagement: 0 }
];

export function SocialAutomation() {
  const [autoPostingEnabled, setAutoPostingEnabled] = useState(false);
  const [engagementOptimization, setEngagementOptimization] = useState(true);
  const [trendAnalysis, setTrendAnalysis] = useState(true);
  const [postFrequency, setPostFrequency] = useState([3]);
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [jobId, setJobId] = useState<string | null>(null);
  const [posts, setPosts] = useState<{ id: string; content: string; platform: string; status: string; timestamp: string }[]>([]);
  const [accounts, setAccounts] = useState<
    { id: string; platform: string; displayName?: string | null; username?: string | null; isActive: boolean }[]
  >([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | undefined>(undefined);
  const [accountsError, setAccountsError] = useState<string | null>(null);
  const [isFetchingAccounts, setIsFetchingAccounts] = useState(false);
  const [quickPostError, setQuickPostError] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const loadAccounts = async () => {
      try {
        setIsFetchingAccounts(true);
        setAccountsError(null);
        const response = await fetch('/api/social-media/accounts', {
          method: 'GET',
          credentials: 'include',
          signal: controller.signal,
        });
        const payload: unknown = await response.json().catch(() => null);
        if (!response.ok) {
          const message =
            payload && typeof payload === 'object' && payload !== null && 'message' in payload
              ? String((payload as { message: unknown }).message)
              : 'Unable to load accounts';
          setAccountsError(message);
          setAccounts([]);
          return;
        }

        if (
          !payload ||
          typeof payload !== 'object' ||
          !('accounts' in payload) ||
          !Array.isArray((payload as { accounts: unknown }).accounts)
        ) {
          setAccounts([]);
          return;
        }

        const parsedAccounts = (payload as { accounts: unknown[] }).accounts
          .map(account => {
            if (!account || typeof account !== 'object') {
              return null;
            }
            const accountRecord = account as {
              id?: unknown;
              platform?: unknown;
              displayName?: unknown;
              username?: unknown;
              isActive?: unknown;
            };
            if (typeof accountRecord.id !== 'number' && typeof accountRecord.id !== 'string') {
              return null;
            }
            if (typeof accountRecord.platform !== 'string') {
              return null;
            }
            return {
              id: String(accountRecord.id),
              platform: accountRecord.platform,
              displayName:
                typeof accountRecord.displayName === 'string' ? accountRecord.displayName : null,
              username: typeof accountRecord.username === 'string' ? accountRecord.username : null,
              isActive: accountRecord.isActive === true,
            };
          })
          .filter((account): account is { id: string; platform: string; displayName: string | null; username: string | null; isActive: boolean } =>
            account !== null
          );

        setAccounts(parsedAccounts);
      } catch (error: unknown) {
        if (!(error instanceof DOMException && error.name === 'AbortError')) {
          const message = error instanceof Error ? error.message : 'Unable to load accounts';
          setAccountsError(message);
          setAccounts([]);
        }
      } finally {
        setIsFetchingAccounts(false);
      }
    };

    void loadAccounts();

    return () => {
      controller.abort();
    };
  }, []);

  const activeAccounts = useMemo(() => accounts.filter(account => account.isActive), [accounts]);

  useEffect(() => {
    if (activeAccounts.length === 0) {
      setSelectedAccountId(undefined);
      setSelectedPlatforms([]);
      return;
    }

    const selectionMatches = selectedAccountId
      ? activeAccounts.some(account => account.id === selectedAccountId)
      : false;

    if (!selectionMatches) {
      const firstAccount = activeAccounts[0];
      if (firstAccount) {
        setSelectedAccountId(firstAccount.id);
        setSelectedPlatforms([firstAccount.platform]);
      }
      return;
    }

    if (selectedAccountId) {
      return;
    }
  }, [activeAccounts, selectedAccountId]);

  const handleQuickPost = async () => {
    const caption = localStorage.getItem('latestCaption') || '';
    const image = localStorage.getItem('latestImage');
    setQuickPostError(null);

    if (!selectedAccountId) {
      setQuickPostError('Select an account before posting.');
      return;
    }

    const account = accounts.find(acc => acc.id === selectedAccountId);
    if (!account) {
      setQuickPostError('The selected account could not be found.');
      return;
    }

    setIsPosting(true);
    try {
      const res = await fetch('/api/social-media/quick-post', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          platform: account.platform,
          accountId: Number.parseInt(account.id, 10) || account.id,
          content: { text: caption, mediaUrls: image ? [image] : [] },
        }),
      });
      const data: unknown = await res.json().catch(() => null);

      if (!res.ok) {
        const message =
          data && typeof data === 'object' && data !== null && 'message' in data
            ? String((data as { message: unknown }).message)
            : 'Quick post failed. Please try again.';
        setQuickPostError(message);
        return;
      }

      if (data && typeof data === 'object' && data !== null) {
        if ('jobId' in data && typeof (data as { jobId: unknown }).jobId === 'string') {
          setJobId((data as { jobId: string }).jobId);
        } else if ('postId' in data) {
          const postId = (data as { postId: unknown }).postId;
          if (typeof postId === 'string') {
            setJobId(postId);
          } else if (typeof postId === 'number') {
            setJobId(String(postId));
          }
        }
      }
    } catch (err) {
      console.error('Quick post failed:', err);
      const message = err instanceof Error ? err.message : 'Quick post failed. Please try again.';
      setQuickPostError(message);
    } finally {
      setIsPosting(false);
    }
  };

  useEffect(() => {
    if (!jobId) return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/social-media/posts', {
          credentials: 'include',
        });
        const data: unknown = await res.json().catch(() => null);
        if (!res.ok) {
          return;
        }

        const postsArray: unknown[] = Array.isArray(data)
          ? data
          : data && typeof data === 'object' && 'posts' in data && Array.isArray((data as { posts: unknown }).posts)
          ? (data as { posts: unknown[] }).posts
          : [];

        const parsedPosts = postsArray
          .map(post => {
            if (!post || typeof post !== 'object') {
              return null;
            }
            const postRecord = post as {
              id?: unknown;
              content?: unknown;
              platform?: unknown;
              status?: unknown;
              timestamp?: unknown;
            };
            if (typeof postRecord.id !== 'string' && typeof postRecord.id !== 'number') {
              return null;
            }
            return {
              id: String(postRecord.id),
              content: typeof postRecord.content === 'string' ? postRecord.content : '',
              platform: typeof postRecord.platform === 'string' ? postRecord.platform : 'unknown',
              status: typeof postRecord.status === 'string' ? postRecord.status : 'pending',
              timestamp: typeof postRecord.timestamp === 'string' ? postRecord.timestamp : '',
            };
          })
          .filter((post): post is { id: string; content: string; platform: string; status: string; timestamp: string } => post !== null);

        setPosts(parsedPosts);
      } catch (err) {
        console.error('Failed to fetch posts:', err);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [jobId]);

  const activePlatforms = useMemo(() => {
    return new Set(activeAccounts.map(account => account.platform));
  }, [activeAccounts]);

  const platforms = useMemo(
    () =>
      PLATFORM_SUMMARIES.map(platform => ({
        id: platform.id,
        name: platform.name,
        posts: platform.posts,
        engagement: platform.engagement,
        status: activePlatforms.has(platform.id) ? ('connected' as PlatformStatus) : platform.defaultStatus,
      })),
    [activePlatforms]
  );

  const automationFeatures = [
    {
      id: 'auto-posting',
      title: 'Smart Auto-Posting',
      description: 'AI-powered posting at optimal times across platforms',
      icon: Clock,
      enabled: autoPostingEnabled,
      toggle: setAutoPostingEnabled,
      stats: { success: '94%', posts: '847', engagement: '+23%' }
    },
    {
      id: 'engagement-opt',
      title: 'Engagement Optimization',
      description: 'Real-time optimization of content for maximum engagement',
      icon: Target,
      enabled: engagementOptimization,
      toggle: setEngagementOptimization,
      stats: { boost: '+45%', reach: '156K', interactions: '2.3K' }
    },
    {
      id: 'trend-analysis',
      title: 'Trend Intelligence',
      description: 'AI-powered trend detection and content suggestions',
      icon: TrendingUp,
      enabled: trendAnalysis,
      toggle: setTrendAnalysis,
      stats: { trends: '23', accuracy: '89%', suggestions: '156' }
    }
  ];

  const automationRules = [
    {
      id: 'peak-times',
      name: 'Peak Time Posting',
      description: "Post during your audience's most active hours",
      platforms: ['reddit', 'twitter'],
      status: 'active'
    },
    {
      id: 'trending-hashtags',
      name: 'Trending Hashtag Integration',
      description: 'Automatically include trending hashtags relevant to your content',
      platforms: ['twitter', 'instagram'],
      status: 'active'
    },
    {
      id: 'cross-platform',
      name: 'Cross-Platform Optimization',
      description: 'Adapt content format and messaging for each platform',
      platforms: ['reddit', 'twitter', 'instagram'],
      status: 'learning'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Social Automation
          </h2>
          <p className="text-muted-foreground mt-1">
            Advanced AI-powered social media automation and optimization
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={handleQuickPost} disabled={isPosting || !selectedAccountId}>
            {isPosting ? 'Posting…' : 'Quick Post'}
          </Button>
          <Badge variant="secondary" className="bg-purple-500/10 text-purple-400 border-purple-500/20">
            Phase 4 • Automation
          </Badge>
        </div>
      </div>

      {(quickPostError || accountsError) && (
        <Alert variant="destructive" className="bg-red-500/10 border-red-500/30 text-red-200">
          <AlertTitle>Action required</AlertTitle>
          <AlertDescription>
            {quickPostError ?? accountsError ?? 'Please review the account requirements.'}
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="platforms" data-testid="tab-platforms">Platforms</TabsTrigger>
          <TabsTrigger value="rules" data-testid="tab-rules">Rules</TabsTrigger>
          <TabsTrigger value="analytics" data-testid="tab-analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          {/* Automation Features */}
          <div className="grid gap-4">
            {automationFeatures.map((feature) => {
              const IconComponent = feature.icon;
              return (
                <Card key={feature.id} className="bg-gradient-to-r from-gray-900/50 to-gray-800/50 border-gray-700/50">
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
                    <div className="flex items-center space-x-3">
                      <div className="p-2 rounded-lg bg-purple-500/20">
                        <IconComponent className="h-5 w-5 text-purple-400" />
                      </div>
                      <div>
                        <CardTitle className="text-lg text-white">{feature.title}</CardTitle>
                        <p className="text-sm text-gray-400">{feature.description}</p>
                      </div>
                    </div>
                    <Switch
                      checked={feature.enabled}
                      onCheckedChange={feature.toggle}
                      data-testid={`switch-${feature.id}`}
                    />
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex items-center space-x-6 text-sm">
                      {Object.entries(feature.stats).map(([key, value]) => (
                        <div key={key} className="text-center">
                          <div className="font-semibold text-purple-400">{value}</div>
                          <div className="text-gray-500 capitalize">{key}</div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Quick Settings */}
          <Card className="bg-gradient-to-r from-gray-900/50 to-gray-800/50 border-gray-700/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-white">
                <Settings className="h-5 w-5 text-purple-400" />
                Quick Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Posting account</label>
                <Select
                  value={selectedAccountId}
                  onValueChange={value => {
                    setSelectedAccountId(value);
                    const accountForSelection = activeAccounts.find(account => account.id === value);
                    if (accountForSelection) {
                      setSelectedPlatforms(prev =>
                        prev.includes(accountForSelection.platform)
                          ? prev
                          : [...prev, accountForSelection.platform]
                      );
                    }
                  }}
                >
                  <SelectTrigger className="w-full bg-gray-900/60 border-gray-700 text-gray-200">
                    <SelectValue
                      placeholder={
                        isFetchingAccounts ? 'Loading accounts…' : 'Select a connected account'
                      }
                    />
                  </SelectTrigger>
                  <SelectContent className="bg-gray-900/95 border-gray-700 text-gray-100">
                    {activeAccounts.map(account => {
                      const label = account.displayName ?? account.username ?? account.platform;
                      return (
                        <SelectItem key={account.id} value={account.id} className="capitalize">
                          {label}
                        </SelectItem>
                      );
                    })}
                    {activeAccounts.length === 0 && !isFetchingAccounts && (
                      <SelectItem value="" disabled>
                        No connected accounts available
                      </SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Posts per day</label>
                <Slider
                  value={postFrequency}
                  onValueChange={setPostFrequency}
                  max={10}
                  min={1}
                  step={1}
                  className="w-full"
                  data-testid="slider-post-frequency"
                />
                <p className="text-xs text-gray-500">{postFrequency[0]} posts per day</p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-300">Active Platforms</label>
                <div className="flex flex-wrap gap-2">
                  {platforms.map((platform) => (
                    <Badge
                      key={platform.id}
                      variant={selectedPlatforms.includes(platform.id) ? 'default' : 'outline'}
                      className={`cursor-pointer ${
                        selectedPlatforms.includes(platform.id)
                          ? 'bg-purple-500 hover:bg-purple-600'
                          : 'border-gray-600 hover:border-purple-500'
                      }`}
                      onClick={() => {
                        setSelectedPlatforms(prev =>
                          prev.includes(platform.id)
                            ? prev.filter(p => p !== platform.id)
                            : [...prev, platform.id]
                        );
                      }}
                      data-testid={`platform-${platform.id}`}
                    >
                      {platform.name}
                    </Badge>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
          {posts.length > 0 && (
            <Card className="bg-gradient-to-r from-gray-900/50 to-gray-800/50 border-gray-700/50">
              <CardHeader>
                <CardTitle className="text-white">Post Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {posts.map(post => (
                  <div key={post.id} className="flex justify-between text-sm text-gray-400">
                    <span>{post.platform}</span>
                    <span>{post.status}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="platforms" className="space-y-4">
          <div className="grid gap-4">
            {platforms.map((platform) => (
              <Card key={platform.id} className="bg-gradient-to-r from-gray-900/50 to-gray-800/50 border-gray-700/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="text-white">{platform.name}</CardTitle>
                    <p className="text-sm text-gray-400">
                      {platform.posts} posts • {platform.engagement.toFixed(1)}% avg engagement
                    </p>
                  </div>
                  <Badge
                    variant={
                      platform.status === 'connected' ? 'default' :
                      platform.status === 'pending' ? 'secondary' : 'outline'
                    }
                    className={
                      platform.status === 'connected' ? 'bg-green-500/20 text-green-400 border-green-500/20' :
                      platform.status === 'pending' ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/20' :
                      'border-gray-600'
                    }
                  >
                    {platform.status}
                  </Badge>
                </CardHeader>
                <CardContent>
                  {platform.status === 'connected' ? (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 text-sm">
                        <div className="flex items-center gap-1">
                          <BarChart3 className="h-4 w-4 text-purple-400" />
                          <span className="text-gray-400">Performance: Good</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4 text-purple-400" />
                          <span className="text-gray-400">Next post: 2h 15m</span>
                        </div>
                      </div>
                      <Button variant="outline" size="sm" data-testid={`manage-${platform.id}`}>
                        Manage
                      </Button>
                    </div>
                  ) : (
                    <Button 
                      className="w-full bg-purple-600 hover:bg-purple-700"
                      data-testid={`connect-${platform.id}`}
                    >
                      {platform.status === 'pending' ? 'Complete Setup' : 'Connect Platform'}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="rules" className="space-y-4">
          <div className="grid gap-4">
            {automationRules.map((rule) => (
              <Card key={rule.id} className="bg-gradient-to-r from-gray-900/50 to-gray-800/50 border-gray-700/50">
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="text-white">{rule.name}</CardTitle>
                    <p className="text-sm text-gray-400">{rule.description}</p>
                  </div>
                  <Badge
                    variant={rule.status === 'active' ? 'default' : 'secondary'}
                    className={
                      rule.status === 'active' ? 'bg-green-500/20 text-green-400 border-green-500/20' :
                      'bg-blue-500/20 text-blue-400 border-blue-500/20'
                    }
                  >
                    {rule.status}
                  </Badge>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-gray-400">Platforms:</span>
                      <div className="flex space-x-1">
                        {rule.platforms.map((platform) => (
                          <Badge key={platform} variant="outline" className="text-xs border-gray-600">
                            {platform}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <Button variant="outline" size="sm" data-testid={`edit-rule-${rule.id}`}>
                      Edit Rule
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="bg-gradient-to-r from-gray-900/50 to-gray-800/50 border-gray-700/50">
            <CardHeader>
              <CardTitle className="text-white">Create New Rule</CardTitle>
              <p className="text-sm text-gray-400">Set up custom automation rules for your content</p>
            </CardHeader>
            <CardContent>
              <Button className="w-full bg-purple-600 hover:bg-purple-700" data-testid="create-rule">
                <Zap className="h-4 w-4 mr-2" />
                Create Automation Rule
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-gradient-to-r from-gray-900/50 to-gray-800/50 border-gray-700/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">Total Automated Posts</CardTitle>
                <Users className="h-4 w-4 text-purple-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">1,847</div>
                <p className="text-xs text-green-400">+12% from last month</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-gray-900/50 to-gray-800/50 border-gray-700/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">Avg Engagement</CardTitle>
                <Target className="h-4 w-4 text-purple-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">4.2%</div>
                <p className="text-xs text-green-400">+0.8% from manual posts</p>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-r from-gray-900/50 to-gray-800/50 border-gray-700/50">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-400">Time Saved</CardTitle>
                <Clock className="h-4 w-4 text-purple-400" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-white">89h</div>
                <p className="text-xs text-green-400">This month</p>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-gradient-to-r from-gray-900/50 to-gray-800/50 border-gray-700/50">
            <CardHeader>
              <CardTitle className="text-white">Automation Performance</CardTitle>
              <p className="text-sm text-gray-400">Detailed analytics coming soon in Phase 4</p>
            </CardHeader>
            <CardContent>
              <div className="h-64 flex items-center justify-center text-gray-500">
                <div className="text-center">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 text-purple-400" />
                  <p>Advanced analytics dashboard in development</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}