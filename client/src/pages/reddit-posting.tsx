import React, { useState, useEffect, useMemo } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { apiRequest, type ApiError } from '@/lib/queryClient';
import { AuthModal } from '@/components/auth-modal';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator
} from '@/components/ui/command';
import {
  Send,
  Calendar,
  User,
  Eye,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Link as LinkIcon,
  Globe,
  Clock,
  BarChart3,
  Users,
  TrendingUp,
  Zap,
  Shield,
  FileText,
  TestTube,
  ImageIcon,
  Images,
  LogIn,
  UserCheck,
  ChevronsUpDown,
  RefreshCcw,
  Loader2
} from 'lucide-react';
import { MediaLibrarySelector } from '@/components/MediaLibrarySelector';
import type { 
  ShadowbanStatusType, 
  ShadowbanCheckApiResponse,
  ShadowbanSubmissionSummary 
} from '@shared/schema';
import type { SubredditCommunity } from '@/types/reddit';

function isApiError(error: unknown): error is ApiError {
  return error instanceof Error && 'status' in error && typeof (error as { status?: unknown }).status === 'number';
}

interface RedditAccount {
  id: number;
  username: string;
  isActive: boolean;
  connectedAt: string;
  karma: number;
  verified: boolean;
  accountAgeDays?: number;
}

// SubredditCommunity type now imported from @/types/reddit

// API response interfaces
interface ConnectionTestResponse {
  connected: boolean;
  profile?: {
    username: string;
    karma: number;
  };
}

interface ConnectRedditResponse {
  authUrl: string;
}

interface ContentValidationResponse {
  policyState: 'allow' | 'warn' | 'block' | 'pass';
  warnings?: string[];
}

interface PostSubmissionResponse {
  success: boolean;
  error?: string;
}

interface SchedulePostResponse {
  success: boolean;
  postJobId: number;
  scheduledAt: string;
}

interface MediaAsset {
  id: number;
  filename: string;
  signedUrl?: string;
  downloadUrl?: string;
  createdAt: string;
}

interface PostData {
  subreddit: string;
  title: string;
  nsfw: boolean;
  spoiler: boolean;
  postType: 'text' | 'link' | 'image' | 'gallery';
  body?: string;
  url?: string;
  imageData?: string;
  images?: Array<{
    url: string;
    caption?: string;
  }>;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;

interface CommunityEligibility {
  community: SubredditCommunity;
  isEligible: boolean;
  reasons: string[];
  badges: {
    karmaOk: boolean;
    ageOk: boolean;
    sellingOk: boolean;
    watermarkOk: boolean;
  };
}

function checkCommunityEligibility(
  community: SubredditCommunity,
  account: RedditAccount | null
): CommunityEligibility {
  const reasons: string[] = [];
  let isEligible = true;

  const badges = {
    karmaOk: true,
    ageOk: true,
    sellingOk: true,
    watermarkOk: true,
  };

  if (!account) {
    reasons.push('Account not connected');
    return {
      community,
      isEligible: false,
      reasons,
      badges: {
        karmaOk: false,
        ageOk: false,
        sellingOk: false,
        watermarkOk: false,
      },
    };
  }

  if (community.rules?.eligibility?.minKarma && account.karma < community.rules.eligibility.minKarma) {
    reasons.push(`Requires ${community.rules.eligibility.minKarma} karma (you have ${account.karma})`);
    isEligible = false;
    badges.karmaOk = false;
  }

  if (community.rules?.eligibility?.minAccountAgeDays && account.accountAgeDays) {
    if (account.accountAgeDays < community.rules?.eligibility?.minAccountAgeDays) {
      reasons.push(`Account must be ${community.rules?.eligibility?.minAccountAgeDays} days old (yours is ${account.accountAgeDays} days)`);
      isEligible = false;
      badges.ageOk = false;
    }
  }

  // Include selling and watermark restrictions in eligibility
  if (community.rules?.content?.sellingPolicy === 'not_allowed') {
    badges.sellingOk = false;
    reasons.push('Selling not allowed in this community');
    isEligible = false;
  }

  if (community.rules?.content?.sellingPolicy === 'unknown') {
    badges.sellingOk = false;
    reasons.push('Selling policy unclear - check community rules');
  }

  if (community.rules?.content?.watermarksAllowed === false) {
    badges.watermarkOk = false;
    reasons.push('Watermarks not allowed in this community');
    isEligible = false;
  }

  return {
    community,
    isEligible,
    reasons,
    badges,
  };
}

export default function RedditPostingPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { isAuthenticated, user, isLoading: authLoading } = useAuth();
  const [, setLocation] = useLocation();
  
  // Redirect to landing page if not authenticated
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      toast({
        title: "Authentication Required",
        description: "Please log in to access Reddit posting features",
        variant: "destructive"
      });
      setLocation('/?showAuth=true');
    }
  }, [authLoading, isAuthenticated, setLocation, toast]);
  
  // Show loading while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <p className="mt-2 text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }
  
  // Don't render anything if not authenticated (will redirect)
  if (!isAuthenticated) {
    return null;
  }

  // Form state
  const [subreddit, setSubreddit] = useState('');
  const [communityPickerOpen, setCommunityPickerOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('');
  const [nsfw, setNsfw] = useState(false);
  const [spoiler, setSpoiler] = useState(false);
  const [postType, setPostType] = useState<'text' | 'link' | 'image' | 'gallery'>('image');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string>('');
  const [selectedMediaIds, setSelectedMediaIds] = useState<number[]>([]);
  const [mediaCaptions, setMediaCaptions] = useState<Record<number, string>>({});
  const [scheduledAt, setScheduledAt] = useState('');
  const isGalleryFeatureEnabled = false;

  // UI state
  const [selectedAccount, setSelectedAccount] = useState<string>('');
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Add image handling functions
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const toggleMediaSelection = (assetId: number) => {
    setSelectedMediaIds((prev) => {
      if (prev.includes(assetId)) {
        return prev.filter((id) => id !== assetId);
      }
      return [...prev, assetId];
    });
  };

  const handleCaptionChange = (assetId: number, caption: string) => {
    setMediaCaptions((prev) => ({ ...prev, [assetId]: caption }));
  };

  // Fetch Reddit accounts
  const { data: accounts = [], isLoading: accountsLoading } = useQuery<RedditAccount[]>({
    queryKey: ['/api/reddit/accounts'],
    enabled: isAuthenticated,
    retry: false,
  });

  // Fetch subreddit communities data
  const { data: communities = [] } = useQuery<SubredditCommunity[]>({
    queryKey: ['/api/reddit/communities'],
    retry: false,
  });

  // Fetch media assets
  const { data: mediaAssets = [], isLoading: mediaLoading } = useQuery<MediaAsset[]>({
    queryKey: ['/api/media'],
    enabled: isAuthenticated,
    retry: false,
  });

  const activeAccount = useMemo(
    () => accounts.find((account) => account.isActive) ?? null,
    [accounts]
  );

  const hasActiveAccount = Boolean(activeAccount);

  // Fetch shadowban status for authenticated users with Reddit accounts
  const {
    data: shadowbanStatus,
    isLoading: shadowbanLoading,
    isFetching: shadowbanFetching,
    error: shadowbanError,
    refetch: refetchShadowban,
  } = useQuery<ShadowbanCheckApiResponse>({
    queryKey: ['/api/reddit/shadowban-status'],
    enabled: isAuthenticated && hasActiveAccount,
    retry: false,
  });

  const isShadowbanChecking = shadowbanLoading || shadowbanFetching;

  const shadowbanErrorMessage = shadowbanError instanceof Error
    ? ((shadowbanError as ApiError).userMessage ?? shadowbanError.message)
    : undefined;

  const shadowbanStatusLevel: ShadowbanStatusType | 'error' = shadowbanError
    ? 'error'
    : shadowbanStatus?.status ?? 'unknown';

  const shadowbanCardStyles = shadowbanStatusLevel === 'suspected'
    ? 'border-destructive/20 bg-destructive/5'
    : shadowbanStatusLevel === 'clear'
      ? 'border-success/20 bg-success/5'
      : shadowbanStatusLevel === 'error'
        ? 'border-destructive/20 bg-destructive/5'
        : 'border-primary/20 bg-primary/5';

  const shadowbanIcon = shadowbanStatusLevel === 'clear'
    ? <CheckCircle className="h-4 w-4 text-success" />
    : shadowbanStatusLevel === 'suspected'
      ? <AlertTriangle className="h-4 w-4 text-destructive" />
      : shadowbanStatusLevel === 'error'
        ? <XCircle className="h-4 w-4 text-destructive" />
        : <Eye className="h-4 w-4 text-primary" />;

  const shadowbanButtonStyles = shadowbanStatusLevel === 'suspected' || shadowbanStatusLevel === 'error'
    ? 'border-destructive/20 text-destructive hover:bg-destructive/5'
    : shadowbanStatusLevel === 'clear'
      ? 'border-success/20 text-success hover:bg-success/5'
      : 'border-primary/20 text-primary hover:bg-primary/5';

  const lastShadowbanCheck = shadowbanStatus?.evidence.checkedAt
    ? new Date(shadowbanStatus.evidence.checkedAt).toLocaleString()
    : undefined;

  const hiddenSubmissions = useMemo<ShadowbanSubmissionSummary[]>(() => {
    if (!shadowbanStatus) {
      return [];
    }

    const missingIds = new Set(shadowbanStatus.evidence.missingSubmissionIds);
    return shadowbanStatus.evidence.privateSubmissions.filter(submission => missingIds.has(submission.id));
  }, [shadowbanStatus]);

  const selectedAssets = mediaAssets.filter((asset) => selectedMediaIds.includes(asset.id));

  // Sort communities by eligibility and karma requirements
  const sortedCommunities = useMemo(() => {
    if (!communities || communities.length === 0) return [];

    const communitiesWithEligibility = communities.map((community) => 
      checkCommunityEligibility(community, activeAccount)
    );

    // Sort: eligible first, then by karma requirement (ascending)
    return communitiesWithEligibility.sort((a, b) => {
      if (a.isEligible !== b.isEligible) {
        return a.isEligible ? -1 : 1; // Eligible first
      }

      // Within same eligibility, sort by karma requirement
      const aKarma = a.community.rules?.eligibility?.minKarma || 0;
      const bKarma = b.community.rules?.eligibility?.minKarma || 0;
      return aKarma - bKarma;
    });
  }, [communities, activeAccount]);

  // Set default community to first eligible one (only if no selection made yet)
  useEffect(() => {
    if (sortedCommunities.length > 0 && !subreddit) {
      const firstEligible = sortedCommunities.find(sc => sc.isEligible);
      if (firstEligible) {
        setSubreddit(firstEligible.community.id);
      }
    }
  }, [sortedCommunities]); // Remove subreddit dependency to prevent fighting user choice

  // Test Reddit connection
  const { mutate: testConnection, isPending: testingConnection } = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/reddit/test');
      return response.json();
    },
    onSuccess: (data: ConnectionTestResponse) => {
      void queryClient.invalidateQueries({ queryKey: ['/api/reddit/shadowban-status'] });
      toast({
        title: "✅ Connection Test",
        description: data.connected ? 
          `Connected as ${data.profile?.username} (${data.profile?.karma} karma)` : 
          "Connection failed",
        variant: data.connected ? "default" : "destructive"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Connection Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Connect Reddit account
  const { mutate: connectReddit, isPending: connectingReddit } = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('GET', '/api/reddit/connect?intent=posting&queue=reddit-posting');
      return response.json();
    },
    onSuccess: (data: ConnectRedditResponse) => {
      if (data.authUrl) {
        window.open(data.authUrl, '_blank');
        toast({
          title: "🔗 Reddit Authorization",
          description: "Complete the authorization in the popup window"
        });
      }
    },
    onError: (error: Error) => {
      if (isApiError(error) && error.isAuthError) {
        setShowAuthModal(true);
        toast({
          title: "Authentication required",
          description: error.userMessage ?? "Please log in to connect Reddit.",
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "❌ Connection Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Content policy validation
  const { mutate: validateContent, isPending: validating, data: validation } = useMutation({
    mutationFn: async (data: { subreddit: string; title: string; body: string; hasLink: boolean }) => {
      const response = await apiRequest('POST', '/api/preview', data);
      return response.json();
    },
    onSuccess: (data: ContentValidationResponse) => {
      toast({
        title: "🔍 Content Validated",
        description: `Policy check: ${data.policyState}`,
        variant: data.policyState === 'block' ? 'destructive' : 'default'
      });
    }
  });

  // Submit post
  const { mutate: submitPost, isPending: submitting } = useMutation({
    mutationFn: async (data: PostData) => {
      const response = await apiRequest('POST', '/api/reddit/submit', data);
      return response.json();
    },
    onSuccess: (data: PostSubmissionResponse) => {
      if (data.success) {
        toast({
          title: "🎉 Post Published!",
          description: `Successfully posted to r/${subreddit}`,
          variant: "default"
        });
        // Reset form
        setTitle('');
        setBody('');
        setUrl('');
        setSubreddit('');
        setSelectedMediaIds([]);
        setMediaCaptions({});
        queryClient.invalidateQueries({ queryKey: ['/api/reddit/posts'] });
        void queryClient.invalidateQueries({ queryKey: ['/api/reddit/shadowban-status'] });
      } else {
        toast({
          title: "❌ Posting Failed",
          description: data.error || 'Unknown error occurred',
          variant: "destructive"
        });
      }
    },
    onError: (error: Error) => {
      toast({
        title: "❌ Posting Failed",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Schedule post
  const { mutate: schedulePost, isPending: scheduling } = useMutation<SchedulePostResponse, unknown, { subreddit: string; title: string; body: string; scheduledAt?: string }>({
    mutationFn: async (data) => {
      const response = await apiRequest('POST', '/api/posts/schedule', data);
      return response.json();
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({
          title: "📅 Post Scheduled!",
          description: `Post will be published at ${new Date(data.scheduledAt).toLocaleString()}`,
          variant: "default"
        });
        // Reset form
        setTitle('');
        setBody('');
        setSubreddit('');
        setScheduledAt('');
        return;
      }

      toast({
        title: "Failed to schedule post",
        description: "The scheduler did not confirm the job creation. Please try again.",
        variant: "destructive",
      });
    },
    onError: (error) => {
      if (isApiError(error) && error.isAuthError) {
        setShowAuthModal(true);
        toast({
          title: "Authentication required",
          description: error.userMessage ?? "Please log in to schedule posts.",
          variant: "destructive",
        });
        return;
      }

      const fallbackMessage = error instanceof Error
        ? error.message
        : 'Failed to schedule post. Please try again later.';

      toast({
        title: "Failed to schedule post",
        description: fallbackMessage,
        variant: "destructive",
      });
    }
  });

  // Handle content validation
  const handleValidateContent = () => {
    if (!subreddit || !title) {
      toast({
        title: "⚠️ Missing Required Fields",
        description: "Please enter subreddit and title",
        variant: "destructive"
      });
      return;
    }

    validateContent({
      subreddit,
      title,
      body,
      hasLink: postType === 'link' && !!url
    });
  };

  // Handle post submission - Enhanced for multiple post types
  const handleSubmitPost = async () => {
    if (!subreddit || !title) {
      toast({
        title: "⚠️ Missing Required Fields",
        description: "Please enter subreddit and title",
        variant: "destructive"
      });
      return;
    }

    const postData: PostData = {
      subreddit,
      title,
      nsfw,
      spoiler,
      postType
    };

    // Handle different post types
    if (postType === 'image' && imageFile) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        postData.imageData = reader.result as string | undefined;
        submitPost(postData);
      };
      reader.readAsDataURL(imageFile);
    } else if (postType === 'gallery' && selectedAssets.length > 0) {
      const assetsWithUrls = selectedAssets
        .map((asset) => {
          const url = asset.downloadUrl ?? asset.signedUrl;
          if (!url) {
            return null;
          }
          return {
            url,
            caption: mediaCaptions[asset.id]?.trim() || asset.filename
          };
        })
        .filter((value): value is { url: string; caption: string } => value !== null);

      if (assetsWithUrls.length !== selectedAssets.length) {
        toast({
          title: "⚠️ Media unavailable",
          description: "One or more selected media files could not be resolved. Please refresh your media library and try again.",
          variant: "destructive"
        });
        return;
      }

      postData.images = assetsWithUrls;
      submitPost(postData);
    } else if (postType === 'link') {
      postData.url = url;
      submitPost(postData);
    } else {
      postData.body = body;
      submitPost(postData);
    }
  };

  // Handle post scheduling
  const handleSchedulePost = () => {
    if (!subreddit || !title) {
      toast({
        title: "⚠️ Missing Required Fields",
        description: "Please enter subreddit and title",
        variant: "destructive"
      });
      return;
    }

    schedulePost({
      subreddit,
      title,
      body,
      scheduledAt: scheduledAt || undefined
    });
  };

  // Find community data for selected subreddit (normalized case-insensitive matching)
  const selectedCommunity = communities.find((c) => 
    c.id.toLowerCase() === subreddit.toLowerCase()
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background to-muted p-6">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <Card className="bg-card/90 backdrop-blur-sm border-accent/20 shadow-xl">
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="p-2 bg-accent rounded-lg">
                <Globe className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-2xl bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  Reddit Posting Hub
                </CardTitle>
                <CardDescription className="text-muted-foreground">
                  Create, validate, and publish content to Reddit communities with intelligent optimization
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        <div className="grid lg:grid-cols-3 gap-6">

          {/* Main Posting Interface */}
          <div className="lg:col-span-2 space-y-6">

            {/* Account Status */}
            <Card className="bg-white/90 backdrop-blur-sm border-pink-200 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Reddit Account Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {!isAuthenticated ? (
                    <div className="text-center p-6 bg-muted/50 rounded-lg border border-border">
                      <UserCheck className="h-12 w-12 text-primary mx-auto mb-3" />
                      <h3 className="font-medium text-foreground mb-2">Sign in to manage Reddit accounts</h3>
                      <p className="text-sm text-muted-foreground mb-4">
                        Create an account or log in to connect Reddit profiles and manage posting permissions.
                      </p>
                      <Button
                        onClick={() => setShowAuthModal(true)}
                        className="bg-purple-600 hover:bg-purple-700 text-white"
                      >
                        <LogIn className="h-4 w-4 mr-2" />
                        Sign in to continue
                      </Button>
                    </div>
                  ) : accountsLoading ? (
                    <div className="flex items-center gap-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-orange-500 border-t-transparent" />
                      <span className="text-sm text-gray-600">Loading accounts...</span>
                    </div>
                  ) : accounts?.length > 0 ? (
                    <div className="space-y-3">
                      {accounts.map((account) => {
                        const isActive = account.isActive;
                        const rowAccent = isActive ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200';
                        const indicatorAccent = isActive ? 'bg-green-500' : 'bg-gray-400';
                        const nameAccent = isActive ? 'text-green-800' : 'text-gray-700';
                        const metaAccent = isActive ? 'text-green-600' : 'text-gray-500';
                        const badgeAccent = isActive ? 'text-green-700 border-green-300' : 'text-gray-600 border-gray-300';
                        const testButtonAccent = isActive
                          ? 'border-green-300 text-green-700 hover:bg-green-50'
                          : 'border-gray-300 text-gray-500 cursor-not-allowed opacity-60';

                        return (
                          <div
                            key={account.id}
                            data-testid={`reddit-account-${account.id}`}
                            className={`flex items-center justify-between p-3 rounded-lg border ${rowAccent}`}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-3 h-3 rounded-full ${indicatorAccent}`} />
                              <div>
                                <p className={`font-medium ${nameAccent}`}>u/{account.username}</p>
                                <p className={`text-sm ${metaAccent}`}>
                                  {account.karma} karma • Connected {new Date(account.connectedAt).toLocaleDateString()}
                                </p>
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <Badge
                                variant="outline"
                                className={badgeAccent}
                                data-testid={`reddit-account-${account.id}-status`}
                              >
                                {isActive ? (account.verified ? 'Verified' : 'Active') : 'Inactive'}
                              </Badge>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => testConnection()}
                                disabled={testingConnection || !isActive}
                                className={testButtonAccent}
                                data-testid={`reddit-account-${account.id}-test`}
                              >
                                <TestTube className="h-4 w-4 mr-1" />
                                Test
                              </Button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center p-6 bg-orange-50 rounded-lg border border-orange-200">
                      <Globe className="h-12 w-12 text-orange-500 mx-auto mb-3" />
                      <h3 className="font-medium text-orange-800 mb-2">No Reddit Account Connected</h3>
                      <p className="text-sm text-orange-600 mb-4">Connect your Reddit account to start posting</p>
                      <Button 
                        onClick={() => connectReddit()}
                        disabled={connectingReddit}
                        className="bg-orange-500 hover:bg-orange-600 text-white"
                      >
                        {connectingReddit ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                        ) : (
                          <LinkIcon className="h-4 w-4 mr-2" />
                        )}
                        Connect Reddit Account
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Shadowban Status */}
            {hasActiveAccount && (
              <Card
                data-testid="shadowban-card"
                className={`bg-white/90 backdrop-blur-sm shadow-lg ${shadowbanCardStyles}`}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {shadowbanIcon}
                    Shadowban Detection
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {isShadowbanChecking ? (
                      <div className="flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
                        <span className="text-sm text-gray-600">Checking shadowban status...</span>
                      </div>
                    ) : shadowbanError ? (
                      <div className="space-y-2">
                        <p className="text-sm text-red-700 font-medium">Unable to check shadowban status</p>
                        <p className="text-xs text-red-600">{shadowbanErrorMessage}</p>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => refetchShadowban()}
                          className={shadowbanButtonStyles}
                        >
                          <RefreshCcw className="h-4 w-4 mr-1" />
                          Retry Check
                        </Button>
                      </div>
                    ) : shadowbanStatus ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">
                            Status: {shadowbanStatus.status === 'clear' 
                              ? 'Account appears normal' 
                              : shadowbanStatus.status === 'suspected'
                                ? 'Possible shadowban detected'
                                : 'Status unknown'}
                          </p>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => refetchShadowban()}
                            className={shadowbanButtonStyles}
                          >
                            <RefreshCcw className="h-4 w-4 mr-1" />
                            Recheck
                          </Button>
                        </div>

                        {shadowbanStatus.reason && (
                          <p className="text-xs text-gray-600">{shadowbanStatus.reason}</p>
                        )}

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div className="bg-gray-50 p-2 rounded">
                            <p className="font-medium">Private submissions</p>
                            <p className="text-gray-600">{shadowbanStatus.evidence.privateCount}</p>
                          </div>
                          <div className="bg-gray-50 p-2 rounded">
                            <p className="font-medium">Public submissions</p>
                            <p className="text-gray-600">{shadowbanStatus.evidence.publicCount}</p>
                          </div>
                        </div>

                        {lastShadowbanCheck && (
                          <p className="text-xs text-gray-500">Last checked: {lastShadowbanCheck}</p>
                        )}

                        {shadowbanStatus.status === 'suspected' && (
                          <Alert className="border-red-200 bg-red-50">
                            <AlertTriangle className="h-4 w-4 text-red-600" />
                            <div className="space-y-2">
                              <AlertDescription className="text-red-700 text-sm">
                                Some of your recent submissions are hidden from public listings. Reduce posting activity until visibility recovers.
                              </AlertDescription>
                              <ul className="list-disc list-inside text-xs text-red-700 space-y-1">
                                <li>Pause scheduled Reddit posts for at least 24 hours to avoid additional visibility penalties.</li>
                                <li>Review subreddit guidelines and adjust queued content to ensure it aligns with community rules.</li>
                                <li>Reach out to subreddit moderators or Reddit Support if the issue persists for more than a day.</li>
                              </ul>
                              {hiddenSubmissions.length > 0 && (
                                <div className="rounded border border-red-200 bg-white/70 p-2">
                                  <p className="text-xs font-semibold text-red-700">Hidden submissions</p>
                                  <ul className="mt-1 space-y-1">
                                    {hiddenSubmissions.map((submission) => {
                                      const permalink = submission.permalink && submission.permalink.startsWith('http')
                                        ? submission.permalink
                                        : `https://www.reddit.com${submission.permalink ?? ''}`;
                                      return (
                                        <li key={submission.id}>
                                          <a
                                            href={permalink}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1 text-xs text-red-600 underline"
                                          >
                                            <Eye className="h-3 w-3" />
                                            {submission.title ?? submission.id}
                                          </a>
                                        </li>
                                      );
                                    })}
                                  </ul>
                                </div>
                              )}
                            </div>
                          </Alert>
                        )}
                      </div>
                    ) : (
                      <div className="text-center text-sm text-gray-500">
                        Shadowban status checking is available for connected Reddit accounts
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Post Creation */}
            <Card className="bg-white/90 backdrop-blur-sm border-pink-200 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Create Post
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">

                {/* Post Type Selection */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                  <Button
                    variant={postType === 'image' ? 'default' : 'outline'}
                    onClick={() => setPostType('image')}
                    className="flex-1"
                    data-testid="button-post-type-image"
                  >
                    <ImageIcon className="h-4 w-4 mr-2" />
                    Image
                  </Button>
                  <Button
                    variant={postType === 'gallery' ? 'default' : 'outline'}
                    onClick={() => setPostType('gallery')}
                    className="flex-1"
                    data-testid="button-post-type-gallery"
                  >
                    <Images className="h-4 w-4 mr-2" />
                    Gallery
                  </Button>
                  <Button
                    variant={postType === 'text' ? 'default' : 'outline'}
                    onClick={() => setPostType('text')}
                    className="flex-1"
                    data-testid="button-post-type-text"
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Text
                  </Button>
                  <Button
                    variant={postType === 'link' ? 'default' : 'outline'}
                    onClick={() => setPostType('link')}
                    className="flex-1"
                    data-testid="button-post-type-link"
                  >
                    <LinkIcon className="h-4 w-4 mr-2" />
                    Link
                  </Button>
                </div>

                {/* Community Picker */}
                <div className="space-y-2">
                  <Label>Subreddit</Label>
                  <Popover open={communityPickerOpen} onOpenChange={setCommunityPickerOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={communityPickerOpen}
                        className="w-full justify-between"
                        data-testid="community-picker-trigger"
                      >
                        {subreddit ? (
                          (() => {
                            const selected = sortedCommunities.find(sc => sc.community.id === subreddit);
                            return selected ? selected.community.displayName : subreddit;
                          })()
                        ) : (
                          'Select community...'
                        )}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-full p-0">
                      <Command>
                        <CommandInput placeholder="Search communities..." />
                        <CommandEmpty>No communities found.</CommandEmpty>
                        <CommandList>
                          <CommandGroup heading="Eligible Communities">
                            {sortedCommunities
                              .filter(sc => sc.isEligible)
                              .map((sc) => (
                                <CommandItem
                                  key={sc.community.id}
                                  value={sc.community.id}
                                  onSelect={(currentValue) => {
                                    setSubreddit(currentValue === subreddit ? '' : currentValue);
                                    setCommunityPickerOpen(false);
                                  }}
                                  data-testid={`community-option-${sc.community.id}`}
                                  disabled={false}
                                  aria-disabled={false}
                                  data-disabled={false}
                                >
                                  <div className="flex items-center justify-between w-full">
                                    <div className="flex-1">
                                      <div className="font-medium">{sc.community.displayName}</div>
                                      <div className="text-xs text-gray-500 truncate">
                                        {sc.community.members.toLocaleString()} members • {sc.community.successProbability}% success
                                      </div>
                                    </div>
                                    <div className="flex gap-1 ml-2">
                                      {sc.badges.karmaOk && <Badge variant="secondary" className="text-xs">Karma OK</Badge>}
                                      {sc.badges.ageOk && <Badge variant="secondary" className="text-xs">Age OK</Badge>}
                                      {sc.badges.sellingOk && <Badge variant="secondary" className="text-xs">Selling OK</Badge>}
                                    </div>
                                  </div>
                                </CommandItem>
                              ))}
                          </CommandGroup>

                          {sortedCommunities.some(sc => !sc.isEligible) && (
                            <>
                              <CommandSeparator />
                              <CommandGroup heading="Requires Qualification">
                                {sortedCommunities
                                  .filter(sc => !sc.isEligible)
                                  .map((sc) => (
                                    <CommandItem
                                      key={sc.community.id}
                                      value={sc.community.id}
                                      disabled={true}
                                      aria-disabled={true}
                                      data-disabled={true}
                                      data-testid={`community-option-${sc.community.id}`}
                                    >
                                      <div className="flex items-center justify-between w-full opacity-50">
                                        <div className="flex-1">
                                          <div className="font-medium">{sc.community.displayName}</div>
                                          <div className="text-xs text-red-600" data-testid={`community-option-${sc.community.id}-reasons`}>
                                            {sc.reasons.join(', ')}
                                          </div>
                                        </div>
                                        <div className="flex gap-1 ml-2">
                                          {!sc.badges.karmaOk && <Badge variant="destructive" className="text-xs">Karma</Badge>}
                                          {!sc.badges.ageOk && <Badge variant="destructive" className="text-xs">Age</Badge>}
                                        </div>
                                      </div>
                                    </CommandItem>
                                  ))}
                              </CommandGroup>
                            </>
                          )}
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>

                  {/* Enhanced Community Insights */}
                  {selectedCommunity && (() => {
                    const eligibility = checkCommunityEligibility(selectedCommunity, activeAccount);
                    return (
                      <div className="text-sm text-gray-600 bg-blue-50 p-3 rounded-lg border border-blue-200">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium text-blue-800" data-testid="selected-community-name">
                            {selectedCommunity.displayName}
                          </span>
                          <Badge variant="outline" className="text-blue-700 border-blue-300">
                            {selectedCommunity.members.toLocaleString()} members
                          </Badge>
                        </div>
                        <p className="text-blue-700 mb-2">{selectedCommunity.description}</p>

                        {/* Eligibility Badges */}
                        <div className="flex gap-2 mb-2" data-testid="selected-community-eligibility">
                          {eligibility.badges.karmaOk ? (
                            <Badge variant="secondary" className="text-green-700 bg-green-50 border-green-200">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Karma OK
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-red-700 bg-red-50 border-red-200">
                              <XCircle className="h-3 w-3 mr-1" />
                              Karma Required
                            </Badge>
                          )}

                          {eligibility.badges.ageOk ? (
                            <Badge variant="secondary" className="text-green-700 bg-green-50 border-green-200">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Age OK
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-red-700 bg-red-50 border-red-200">
                              <XCircle className="h-3 w-3 mr-1" />
                              Age Required
                            </Badge>
                          )}

                          {(() => {
                            const policy = selectedCommunity.rules?.content?.sellingPolicy;
                            if (policy === 'allowed') {
                              return (
                                <Badge variant="secondary" className="text-green-700 bg-green-50 border-green-200">
                                  <CheckCircle className="h-3 w-3 mr-1" />
                                  Selling OK
                                </Badge>
                              );
                            } else if (policy === 'limited') {
                              return (
                                <Badge variant="outline" className="text-yellow-700 bg-yellow-50 border-yellow-200">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Limited Selling
                                </Badge>
                              );
                            } else if (policy === 'not_allowed') {
                              return (
                                <Badge variant="outline" className="text-red-700 bg-red-50 border-red-200">
                                  <XCircle className="h-3 w-3 mr-1" />
                                  No Selling
                                </Badge>
                              );
                            } else {
                              return (
                                <Badge variant="outline" className="text-gray-700 bg-gray-50 border-gray-200">
                                  <AlertTriangle className="h-3 w-3 mr-1" />
                                  Selling Unknown
                                </Badge>
                              );
                            }
                          })()}

                          {selectedCommunity.rules?.content?.watermarksAllowed !== false ? (
                            <Badge variant="secondary" className="text-green-700 bg-green-50 border-green-200">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Watermarks OK
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-orange-700 bg-orange-50 border-orange-200">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              No Watermarks
                            </Badge>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-xs">
                          <div>Success Rate: <span className="font-medium text-green-600">{selectedCommunity.successProbability}%</span></div>
                          <div>Avg Upvotes: <span className="font-medium text-blue-600">{selectedCommunity.averageUpvotes}</span></div>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Title Input */}
                <div className="space-y-2">
                  <Label htmlFor="title">Title</Label>
                  <Input
                    id="title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    maxLength={300}
                    data-testid="input-title"
                  />
                  <div className="text-xs text-gray-500 text-right">{title.length}/300</div>
                </div>

                {/* Content Input */}
                {postType === 'image' && (
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="image">Select Image</Label>
                      <Input
                        id="image"
                        type="file"
                        accept="image/*"
                        onChange={handleImageSelect}
                        className="cursor-pointer"
                        data-testid="input-image-upload"
                      />
                    </div>
                    {imagePreview && (
                      <div className="space-y-2">
                        <Label>Preview</Label>
                        <div className="border-2 border-dashed border-pink-300 rounded-lg p-4">
                          <img 
                            src={imagePreview} 
                            alt="Preview" 
                            className="max-w-full h-auto max-h-64 mx-auto rounded" 
                            data-testid="img-preview"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {postType === 'gallery' && (
                  !isAuthenticated ? (
                    <div className="text-center py-8 bg-purple-50 border border-purple-200 rounded-lg">
                      <Images className="h-12 w-12 text-purple-500 mx-auto mb-3" />
                      <p className="font-medium text-purple-800 mb-2">Sign in to access your media library</p>
                      <p className="text-sm text-purple-600 mb-4">
                        Log in to browse saved media assets and build rich gallery posts faster.
                      </p>
                      <Button
                        onClick={() => setShowAuthModal(true)}
                        className="bg-purple-600 hover:bg-purple-700 text-white"
                      >
                        <LogIn className="h-4 w-4 mr-2" />
                        Sign in to continue
                      </Button>
                    </div>
                  ) : (
                    <MediaLibrarySelector
                      assets={mediaAssets}
                      selectedIds={selectedMediaIds}
                      onToggle={toggleMediaSelection}
                      captions={mediaCaptions}
                      onCaptionChange={handleCaptionChange}
                      maxSelection={20}
                      isLoading={mediaLoading}
                      showCaptions={true}
                    />
                  )
                )}


                {postType === 'text' && (
                  <div className="space-y-2">
                    <Label htmlFor="body">Content (Optional)</Label>
                    <Textarea
                      id="body"
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      rows={6}
                      maxLength={10000}
                      data-testid="textarea-body"
                    />
                    <div className="text-xs text-gray-500 text-right">{body.length}/10,000</div>
                  </div>
                )}

                {postType === 'link' && (
                  <div className="space-y-2">
                    <Label htmlFor="url">URL</Label>
                    <Input
                      id="url"
                      value={url}
                      onChange={(e) => setUrl(e.target.value)}
                      type="url"
                      data-testid="input-url"
                    />
                  </div>
                )}

                {/* Post Options */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="nsfw"
                      checked={nsfw}
                      onCheckedChange={setNsfw}
                      data-testid="switch-nsfw"
                    />
                    <Label htmlFor="nsfw" className="text-sm">Mark as NSFW</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Switch
                      id="spoiler"
                      checked={spoiler}
                      onCheckedChange={setSpoiler}
                      data-testid="switch-spoiler"
                    />
                    <Label htmlFor="spoiler" className="text-sm">Mark as Spoiler</Label>
                  </div>
                </div>

                {/* Content Validation */}
                {validation && (
                  <div className={`p-4 rounded-lg border ${
                    validation?.policyState === 'pass' ? 'bg-green-50 border-green-200' :
                    validation?.policyState === 'warn' ? 'bg-yellow-50 border-yellow-200' :
                    'bg-red-50 border-red-200'
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      {validation?.policyState === 'pass' ? (
                        <CheckCircle className="h-5 w-5 text-green-600" />
                      ) : validation?.policyState === 'warn' ? (
                        <AlertTriangle className="h-5 w-5 text-yellow-600" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-600" />
                      )}
                      <span className={`font-medium ${
                        validation?.policyState === 'pass' ? 'text-green-800' :
                        validation?.policyState === 'warn' ? 'text-yellow-800' :
                        'text-red-800'
                      }`}>
                        Policy Check: {(validation?.policyState || 'unknown').toUpperCase()}
                      </span>
                    </div>
                    {validation?.warnings && validation?.warnings.length > 0 && (
                      <ul className={`text-sm space-y-1 ${
                        validation?.policyState === 'pass' ? 'text-green-700' :
                        validation?.policyState === 'warn' ? 'text-yellow-700' :
                        'text-red-700'
                      }`}>
                        {validation?.warnings.map((warning, index: number) => (
                          <li key={index}>• {warning}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}

                {/* Rate Limiting Warning */}
                <Alert className="bg-yellow-50 border-yellow-200">
                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                  <AlertDescription className="text-yellow-800">
                    <strong>Rate Limit Notice:</strong> Reddit enforces a 10-15 minute cooldown between posts. 
                    Wait between submissions to avoid restrictions.
                  </AlertDescription>
                </Alert>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <Button
                    onClick={handleValidateContent}
                    disabled={validating || !subreddit || !title}
                    variant="outline"
                    className="flex-1"
                    data-testid="button-validate"
                  >
                    {validating ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-500 border-t-transparent mr-2" />
                    ) : (
                      <Shield className="h-4 w-4 mr-2" />
                    )}
                    Validate Content
                  </Button>
                  <Button
                    onClick={handleSubmitPost}
                    disabled={submitting || !subreddit || !title || accounts?.length === 0}
                    className="flex-1 bg-orange-500 hover:bg-orange-600"
                    data-testid="button-submit"
                  >
                    {submitting ? (
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Post Now
                  </Button>
                </div>

                {/* Scheduling Section */}
                <div className="border-t pt-4 space-y-4">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-gray-500" />
                    <Label className="text-sm font-medium">Schedule for Later</Label>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Input
                        type="datetime-local"
                        value={scheduledAt}
                        onChange={(e) => setScheduledAt(e.target.value)}
                        min={new Date().toISOString().slice(0, 16)}
                        data-testid="input-schedule-time"
                      />
                    </div>
                    <Button
                      onClick={handleSchedulePost}
                      disabled={scheduling || !subreddit || !title}
                      variant="outline"
                      className="border-purple-300 text-purple-700 hover:bg-purple-50"
                      data-testid="button-schedule"
                    >
                      {scheduling ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-purple-500 border-t-transparent mr-2" />
                      ) : (
                        <Clock className="h-4 w-4 mr-2" />
                      )}
                      Schedule Post
                    </Button>
                  </div>
                  {selectedCommunity?.bestPostingTimes && (
                    <div className="text-sm text-gray-600 bg-purple-50 p-3 rounded-lg border border-purple-200">
                      <span className="font-medium text-purple-800">💡 Best posting times for r/{subreddit}: </span>
                      <span className="text-purple-700">{selectedCommunity.bestPostingTimes.join(', ')}</span>
                    </div>
                  )}
                </div>

              </CardContent>
            </Card>

          </div>

          {/* Sidebar */}
          <div className="space-y-6">

            {/* Community Insights */}
            {selectedCommunity && (
              <Card className="bg-white/90 backdrop-blur-sm border-pink-200 shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-lg">
                    <BarChart3 className="h-5 w-5" />
                    Community Insights
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                      <Users className="h-4 w-4 text-blue-600 mb-1" />
                      <p className="font-medium text-blue-800">{selectedCommunity.members.toLocaleString()}</p>
                      <p className="text-blue-600">Members</p>
                    </div>
                    <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                      <TrendingUp className="h-4 w-4 text-green-600 mb-1" />
                      <p className="font-medium text-green-800">{selectedCommunity.engagementRate}%</p>
                      <p className="text-green-600">Engagement</p>
                    </div>
                    <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                      <Zap className="h-4 w-4 text-purple-600 mb-1" />
                      <p className="font-medium text-purple-800">{selectedCommunity.successProbability}%</p>
                      <p className="text-purple-600">Success Rate</p>
                    </div>
                    <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
                      <TrendingUp className="h-4 w-4 text-orange-600 mb-1" />
                      <p className="font-medium text-orange-800">{selectedCommunity.averageUpvotes}</p>
                      <p className="text-orange-600">Avg Upvotes</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <h4 className="font-medium text-gray-800 mb-2">Community Rules</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-600">Min Karma:</span>
                          <span className="font-medium">{selectedCommunity.rules?.eligibility?.minKarma}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Min Account Age:</span>
                          <span className="font-medium">{selectedCommunity.rules?.eligibility?.minAccountAgeDays} days</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Watermarks:</span>
                          <Badge variant={selectedCommunity.rules?.content?.watermarksAllowed ? 'default' : 'destructive'} className="text-xs">
                            {selectedCommunity.rules?.content?.watermarksAllowed ? 'Allowed' : 'Not Allowed'}
                          </Badge>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-600">Selling:</span>
                          {(() => {
                            const policy = selectedCommunity.rules?.content?.sellingPolicy;
                            switch (policy) {
                              case 'allowed':
                                return <Badge variant="default" className="text-xs">Allowed</Badge>;
                              case 'limited':
                                return <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-800">Limited</Badge>;
                              case 'not_allowed':
                                return <Badge variant="destructive" className="text-xs">Not Allowed</Badge>;
                              case 'unknown':
                              default:
                                return <Badge variant="outline" className="text-xs bg-gray-100 text-gray-800">Unknown</Badge>;
                            }
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Quick Tips */}
            <Card className="bg-white/90 backdrop-blur-sm border-pink-200 shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Eye className="h-5 w-5" />
                  Quick Tips
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="font-medium text-blue-800 mb-1">📝 Title Optimization</p>
                  <p className="text-blue-700">Include your age/gender and be descriptive but not clickbait-y</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <p className="font-medium text-green-800 mb-1">⏰ Timing Matters</p>
                  <p className="text-green-700">Post during peak hours for maximum engagement</p>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg border border-purple-200">
                  <p className="font-medium text-purple-800 mb-1">🛡️ Stay Safe</p>
                  <p className="text-purple-700">Always validate content before posting to avoid rule violations</p>
                </div>
                <div className="p-3 bg-orange-50 rounded-lg border border-orange-200">
                  <p className="font-medium text-orange-800 mb-1">💬 Engage</p>
                  <p className="text-orange-700">Reply to comments to boost your post's visibility</p>
                </div>
              </CardContent>
            </Card>

          </div>

        </div>

        {/* Authentication Prompt for Unauthenticated Users */}
        {!isAuthenticated && (
          <div className="max-w-4xl mx-auto mt-8">
            <Alert className="border-purple-200 bg-purple-50 dark:bg-purple-900/20">
              <UserCheck className="h-4 w-4 text-purple-600" />
              <AlertDescription className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-purple-800 dark:text-purple-200">Ready to start posting to Reddit?</p>
                  <p className="text-sm text-purple-600 dark:text-purple-300 mt-1">
                    Sign up for free to connect your Reddit account and start automated posting
                  </p>
                </div>
                <Button 
                  onClick={() => setShowAuthModal(true)}
                  className="ml-4 bg-purple-600 hover:bg-purple-700 text-white"
                  data-testid="button-reddit-posting-auth-prompt"
                >
                  <LogIn className="h-4 w-4 mr-1" />
                  Get Started
                </Button>
              </AlertDescription>
            </Alert>
          </div>
        )}
      </div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => {
          setShowAuthModal(false);
          toast({
            title: "🎉 Welcome to ThottoPilot!",
            description: "You can now connect your Reddit account and start posting.",
          });
        }}
        initialMode="signup"
      />
    </div>
  );
}