/**
 * Quick Post Page
 * One-click workflow: Upload → Configure → 2 Captions → Auto-Protect → Post Now
 */

import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Zap,
  Sparkles,
  Shield,
  Send,
  CheckCircle,
  Loader2,
  RefreshCw,
  Plus,
  Settings2,
  BadgeCheck,
  AlertTriangle,
  ChevronsUpDown,
  Pencil,
  Save,
  X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { ProgressWithLabel } from '@/components/ui/progress-with-label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { RedditNativeUploadPortal } from '@/components/RedditNativeUploadPortal';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { StatusBanner } from '@/components/ui/status-banner';
import { cn } from '@/lib/utils';
import type { CaptionObject } from '@shared/types/caption';
import type { SubredditCommunity } from '@/types/reddit';
import {
  generatePairId,
  getDeviceBucket,
  trackCaptionChoice,
  trackCaptionShown
} from '@/lib/caption-telemetry';
import { TwoPane } from '@/components/layouts/TwoPane';
import { PerformancePrediction } from '@/components/analytics/PerformancePrediction';
import { SubredditHealthBadge } from '@/components/analytics/SubredditHealthBadge';

interface CaptionOption {
  id: 'A' | 'B';
  text: string;
  style: string;
  captionId: string;
  styleKey: 'flirty' | 'slutty';
}

type PromotionMode = 'none' | 'subtle' | 'explicit';
type PlatformService = 'reddit' | 'instagram' | 'fansly' | 'x' | 'tiktok';

interface GenerationApiResponse {
  topVariants?: CaptionObject[];
  final?: string | CaptionObject;
  captions?: Array<CaptionObject & { id?: string; text?: string; label?: string }>;
}

interface GenerationRequest {
  url: string;
  service: PlatformService;
  tone: string;
  promotionMode: PromotionMode;
  nsfwFlag: boolean;
}

interface RedditPostSuccessResponse {
  success?: boolean;
  postId?: string;
  url?: string;
  message?: string;
  warnings?: string[];
}

// interface RedditPostErrorResponse {
//   error?: string;
//   message?: string;
//   reason?: string;
//   reasons?: string[];
// }

interface SubredditLintResponse {
  ok: boolean;
  warnings: string[];
  blockers: string[]; // NEW: Hard blockers that prevent posting
  rule: {
    subreddit: string;
    nsfwRequired: boolean;
    minKarma: number | null;
    minAccountAgeDays: number | null;
    verificationRequired: boolean;
    promotionalLinks: string | null;
    linkRestrictions: string[];
    bannedContent: string[];
  } | null;
}

const SERVICE_OPTIONS: Array<{ value: PlatformService; label: string; description: string }> = [
  { value: 'reddit', label: 'Reddit', description: 'Instant post with ImageShield' },
  { value: 'instagram', label: 'Instagram', description: 'Copy caption for manual posting' },
  { value: 'x', label: 'X (Twitter)', description: 'Short-form spicy hooks' },
  { value: 'fansly', label: 'Fansly', description: 'Promo-ready CTA captions' },
  { value: 'tiktok', label: 'TikTok', description: 'High-energy short captions' }
];

const SFW_TONES = [
  { value: 'flirty_playful', label: 'Flirty & Playful' },
  { value: 'gamer_nerdy', label: 'Gamer & Nerdy' },
  { value: 'luxury_minimal', label: 'Luxury Minimal' },
  { value: 'arts_muse', label: 'Artistic Muse' },
  { value: 'gym_energy', label: 'Gym Energy' },
  { value: 'cozy_girl', label: 'Cozy Girl' }
] as const;

const NSFW_TONES = [
  { value: 'seductive_goddess', label: 'Seductive Goddess' },
  { value: 'intimate_girlfriend', label: 'Intimate Girlfriend' },
  { value: 'bratty_tease', label: 'Bratty Tease' },
  { value: 'submissive_kitten', label: 'Submissive Kitten' }
] as const;

const DEFAULT_MODEL = 'openrouter:grok-4-fast';
const DEFAULT_PROTECTION_PRESET = 'imageshield_auto';

interface NormalizedCaption {
  text: string;
  label: string;
  id?: string;
}

type CaptionSource =
  | string
  | CaptionObject
  | (CaptionObject & { id?: string; text?: string; label?: string })
  | undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function normalizeCaption(value: CaptionSource, fallbackLabel: string): NormalizedCaption {
  if (!value) {
    return { text: '', label: fallbackLabel };
  }

  if (typeof value === 'string') {
    const text = value.trim();
    return { text, label: fallbackLabel };
  }

  if (isRecord(value)) {
    const captionText =
      typeof value.caption === 'string'
        ? value.caption
        : typeof value.text === 'string'
          ? value.text
          : '';
    const normalizedText = captionText.trim();
    const label =
      typeof value.style === 'string'
        ? value.style
        : typeof value.label === 'string'
          ? value.label
          : fallbackLabel;
    const id = typeof value.id === 'string' ? value.id : undefined;

    return { text: normalizedText, label, id };
  }

  return { text: '', label: fallbackLabel };
}

function truncateTitle(text: string): string {
  if (text.length <= 280) {
    return text;
  }
  return `${text.slice(0, 277)}...`;
}

// Restrict allowed image URLs to safe schemes and optionally safe hosts
function sanitizeImageUrl(url: string): string | null {
  try {
    const parsed = new URL(url, window.location.origin);

    // Allow same-origin URLs (for local uploads like /uploads/token)
    if (parsed.origin === window.location.origin) {
      return parsed.toString();
    }

    // Define explicit allowed hosts for images.
    const allowedHosts = [
      // Imgur (primary)
      'imgur.com',
      'i.imgur.com',
      // Catbox
      'catbox.moe',
      'files.catbox.moe',
      // Imgbox
      'imgbox.com',
      'i.imgbox.com',
      // PostImages
      'postimages.org',
      'i.postimg.cc',
      // Uguu (WorkingUpload) - includes all subdomains
      'uguu.se',
      'o.uguu.se',
      'd.uguu.se',
      'a.uguu.se',
      // Other WorkingUpload services
      'file.io',
      '0x0.st',
      'litterbox.catbox.moe',
      // Discord
      'discord.com',
      'cdn.discordapp.com',
      'discordapp.com',
      // Reddit
      'reddit.com',
      'www.reddit.com',
      'redditmedia.com',
      'i.redd.it',
      'preview.redd.it'
    ];

    // Only allow http(s) URLs and whitelisted hosts (exact or valid subdomain).
    if (
      (parsed.protocol === "https:" || parsed.protocol === "http:") &&
      allowedHosts.some(h => parsed.hostname === h || parsed.hostname.endsWith('.' + h))
    ) {
      return url;
    }
    // Block data: URIs
    if (parsed.protocol === "data:") return null;
    // Reject any other protocol or host
    return null;
  } catch (_e) {
    return null;
  }
}

export default function QuickPostPage() {
  const { toast } = useToast();

  const [imageUrl, setImageUrl] = useState<string>('');
  const [assetId, setAssetId] = useState<number | undefined>(undefined);
  const [protectedImageUrl, setProtectedImageUrl] = useState<string>('');
  const [captionOptions, setCaptionOptions] = useState<CaptionOption[]>([]);
  const [selectedCaption, setSelectedCaption] = useState<'A' | 'B' | ''>('');
  const [confirmedCaptionId, setConfirmedCaptionId] = useState<'A' | 'B' | null>(null);
  const [subreddit, setSubreddit] = useState<string>('');
  const [nsfw, setNsfw] = useState<boolean>(true);
  const [selectedService, setSelectedService] = useState<PlatformService>('reddit');
  const [selectedTone, setSelectedTone] = useState<string>('seductive_goddess');
  const [promotionEnabled, setPromotionEnabled] = useState<boolean>(false);
  const promotionMode: PromotionMode = promotionEnabled ? 'explicit' : 'none';
  const [captionPairId, setCaptionPairId] = useState<string>('');
  const [captionShownAt, setCaptionShownAt] = useState<number | null>(null);
  const [validationStatus, setValidationStatus] = useState<'idle' | 'valid' | 'warning' | 'error'>('idle');
  const [validationWarnings, setValidationWarnings] = useState<string[]>([]);
  const [validationBlockers, setValidationBlockers] = useState<string[]>([]); // NEW: Hard blockers
  const [posted, setPosted] = useState(false);
  const [communityPickerOpen, setCommunityPickerOpen] = useState(false);
  const [isEditingCaption, setIsEditingCaption] = useState(false);
  const [editedCaptionText, setEditedCaptionText] = useState('');
  const [captionBeingEdited, setCaptionBeingEdited] = useState<'A' | 'B' | null>(null);
  const [captionProgress, setCaptionProgress] = useState(0);
  const [protectionProgress, setProtectionProgress] = useState(0);
  const [postingProgress, setPostingProgress] = useState(0);

  const toneOptions = useMemo(() => (nsfw ? NSFW_TONES : SFW_TONES), [nsfw]);

  // Fetch available subreddit communities
  const {
    data: communities = [],
    isLoading: communitiesLoading,
    error: communitiesError
  } = useQuery<SubredditCommunity[]>({
    queryKey: ['/api/reddit/communities'],
    retry: 1
  });

  // Fetch health scores for all subreddits (Pro/Premium only)
  const { data: healthScoresData } = useQuery<{
    healthScores: Array<{
      subreddit: string;
      healthScore: number;
      status: 'excellent' | 'healthy' | 'watch' | 'risky';
      breakdown: {
        successRate: number;
        successScore: number;
        engagementRate: number;
        engagementScore: number;
        removalRate: number;
        removalScore: number;
      };
      trend: 'improving' | 'stable' | 'declining' | 'unknown';
    }>;
  }>({
    queryKey: ['/api/analytics/subreddit-health'],
    retry: 1,
    enabled: communities.length > 0, // Only fetch if we have communities
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Create a map of subreddit health scores for quick lookup
  const healthScoresMap = useMemo(() => {
    const map = new Map();
    healthScoresData?.healthScores?.forEach((health) => {
      map.set(health.subreddit.toLowerCase(), health);
    });
    return map;
  }, [healthScoresData]);

  // Sort communities by success probability for easy selection
  const sortedCommunities = useMemo(() => {
    return [...communities].sort((a, b) => (b.successProbability ?? 0) - (a.successProbability ?? 0));
  }, [communities]);

  const hasCommunityError = Boolean(communitiesError);
  const communityErrorMessage = communitiesError instanceof Error
    ? communitiesError.message
    : 'We could not load your saved communities.';

  useEffect(() => {
    if (!toneOptions.some((option) => option.value === selectedTone)) {
      const defaultTone = toneOptions[0]?.value ?? 'flirty_playful';
      setSelectedTone(defaultTone);
    }
  }, [selectedTone, toneOptions]);

  useEffect(() => {
    setValidationStatus('idle');
    setValidationWarnings([]);
    setValidationBlockers([]);
  }, [subreddit, confirmedCaptionId]);

  // Debug effect to monitor caption options state
  useEffect(() => {
    if (captionOptions.length > 0) {
      console.warn('[Quick Post] Caption options updated:', {
        count: captionOptions.length,
        first: captionOptions[0]?.text?.substring(0, 50) + '...',
        selectedCaption
      });
    }
  }, [captionOptions, selectedCaption]);

  const generateCaptions = useMutation<GenerationApiResponse, Error, GenerationRequest>({
    mutationFn: async ({ url, service, tone, promotionMode: promoMode, nsfwFlag }) => {
      // Reset and start progress
      setCaptionProgress(0);
      const progressInterval = setInterval(() => {
        setCaptionProgress(prev => Math.min(prev + 5, 90));
      }, 200);

      try {
        const style = nsfwFlag ? 'explicit' : 'authentic';
        const mood = nsfwFlag ? 'seductive' : 'engaging';

        const response = await apiRequest<GenerationApiResponse>('POST', '/api/caption/generate', {
          imageUrl: url,
          platform: service,
          voice: tone,
          style,
          mood,
          nsfw: nsfwFlag,
          promotionMode: promoMode
        });

        clearInterval(progressInterval);
        setCaptionProgress(100);
        return response;
      } catch (error) {
        clearInterval(progressInterval);
        setCaptionProgress(0);
        throw error;
      }
    },
    onSuccess: (result, variables) => {
      // Check what we received
      if (!result) {
        console.error('[Quick Post] No result received from API');
        toast({
          title: 'Caption generation failed',
          description: 'No response received from the server.',
          variant: 'destructive'
        });
        return;
      }

      // Try to extract captions from various possible locations
      const variantSources: CaptionSource[] = [];

      if (Array.isArray(result.topVariants) && result.topVariants.length > 0) {
        variantSources.push(...result.topVariants.slice(0, 2));
      } else if (Array.isArray(result.captions) && result.captions.length > 0) {
        variantSources.push(...result.captions.slice(0, 2));
      } else if (result.final) {
        variantSources.push(result.final);
      }

      if (variantSources.length === 0) {
        console.error('[Quick Post] Invalid API response format:', {
          hasTopVariants: 'topVariants' in result,
          hasCaptions: 'captions' in result,
          hasFinal: 'final' in result,
          keys: Object.keys(result)
        });
        toast({
          title: 'Caption generation failed',
          description: 'No caption text was returned by the AI. Try regenerating with different settings.',
          variant: 'destructive'
        });
        return;
      }

      const primary = normalizeCaption(variantSources[0], 'Top Choice');
      const secondarySource = variantSources[1] ?? variantSources[0];
      const secondary = normalizeCaption(secondarySource, 'Alternative');

      if (!primary.text) {
        toast({
          title: 'Caption generation failed',
          description: 'No caption text was returned by the AI. Try regenerating with different settings.',
          variant: 'destructive'
        });
        return;
      }

      const normalizedVariants: NormalizedCaption[] = [
        primary,
        secondary.text ? secondary : { ...primary, label: 'Alternative' }
      ];

      const pairId = generatePairId();
      const options: CaptionOption[] = [];

      normalizedVariants.forEach((variant, index) => {
        if (!variant.text) {
          return;
        }

        const baseId = variant.id ?? `${pairId}_caption_${index === 0 ? 'a' : 'b'}`;
        const previousId = options[0]?.captionId;
        const dedupedId = index === 1 && previousId === baseId ? `${baseId}_alt` : baseId;

        options.push({
          id: index === 0 ? 'A' : 'B',
          text: variant.text,
          style: variant.label,
          captionId: dedupedId,
          styleKey: index === 0 ? 'flirty' : 'slutty'
        });
      });

      if (options.length === 1) {
        options.push({
          id: 'B',
          text: options[0].text,
          style: options[0].style,
          captionId: `${options[0].captionId}_alt`,
          styleKey: 'slutty'
        });
      }

      setCaptionOptions(options);
      setSelectedCaption(options[0]?.id ?? '');
      setConfirmedCaptionId(null);
      setCaptionPairId(pairId);
      setCaptionShownAt(Date.now());

      trackCaptionShown({
        pairId,
        captionIds: [options[0].captionId, options[1].captionId],
        captionTexts: [options[0].text, options[1].text],
        styles: [options[0].styleKey, options[1].styleKey],
        model: DEFAULT_MODEL,
        protectionPreset: DEFAULT_PROTECTION_PRESET,
        deviceBucket: getDeviceBucket()
      });

      protectImage.mutate(variables.url);
    },
    onError: (error) => {
      console.error('[Quick Post] Caption generation error:', error);
      setCaptionProgress(0);
      toast({
        title: 'Caption generation failed',
        description: error instanceof Error ? error.message : 'Could not generate captions. Please adjust your settings and try again.',
        variant: 'destructive'
      });
      // Ensure UI state is reset on error
      setCaptionOptions([]);
      setSelectedCaption('');
    }
  });

  const protectImage = useMutation<string, Error, string>({
    mutationFn: async (url: string) => {
      setProtectionProgress(0);
      const progressInterval = setInterval(() => {
        setProtectionProgress(prev => Math.min(prev + 10, 90));
      }, 150);

      try {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        clearInterval(progressInterval);
        setProtectionProgress(100);
        return `${url}?protected=true`;
      } catch (error) {
        clearInterval(progressInterval);
        setProtectionProgress(0);
        throw error;
      }
    },
    onSuccess: (protectedUrl) => {
      setProtectedImageUrl(protectedUrl);
      toast({
        title: 'Image protected',
        description: 'ImageShield protection applied automatically'
      });
      setTimeout(() => setProtectionProgress(0), 1000);
    }
  });

  const subredditLint = useMutation<SubredditLintResponse, Error, { subreddit: string; title: string; caption: string; nsfwFlag: boolean }>({
    mutationFn: async ({ subreddit: targetSubreddit, title, caption, nsfwFlag }) => {
      return await apiRequest<SubredditLintResponse>('POST', '/api/subreddit-lint', {
        subreddit: targetSubreddit,
        title,
        caption, // NEW: Pass caption for validation
        nsfw: nsfwFlag
      });
    },
    onSuccess: (data) => {
      const hasBlockers = (data.blockers ?? []).length > 0;
      const hasWarnings = (data.warnings ?? []).length > 0;

      // Set status: error if blockers exist, warning if only warnings, valid if clean
      if (hasBlockers) {
        setValidationStatus('error');
      } else if (hasWarnings) {
        setValidationStatus('warning');
      } else {
        setValidationStatus('valid');
      }

      setValidationWarnings(data.warnings ?? []);
      setValidationBlockers(data.blockers ?? []);

      toast({
        title: hasBlockers
          ? 'Cannot post to this subreddit'
          : data.ok
            ? 'Subreddit validated'
            : 'Warnings detected',
        description: hasBlockers
          ? 'You don\'t meet the requirements for this subreddit.'
          : data.ok
            ? 'Ready to post. Reddit rule check looks good.'
            : 'Review subreddit warnings before posting.',
        variant: hasBlockers ? 'destructive' : 'default'
      });
    },
    onError: (error) => {
      setValidationStatus('error');
      toast({
        title: 'Validation failed',
        description: error instanceof Error ? error.message : 'Could not validate subreddit rules',
        variant: 'destructive'
      });
    }
  });

  const postToReddit = useMutation({
    mutationFn: async () => {
      if (selectedService !== 'reddit') {
        throw new Error('Quick Post currently supports Reddit posting only.');
      }

      const chosen = captionOptions.find((option) => option.id === confirmedCaptionId);
      const captionText = chosen?.text ?? '';
      const normalizedSubreddit = subreddit.trim();

      if (!captionText || !normalizedSubreddit) {
        throw new Error('Missing caption or subreddit');
      }

      setPostingProgress(0);
      const progressInterval = setInterval(() => {
        setPostingProgress(prev => Math.min(prev + 8, 90));
      }, 200);

      try {
        const response = await apiRequest<RedditPostSuccessResponse>('POST', '/api/reddit/post', {
          title: truncateTitle(captionText),
          subreddit: normalizedSubreddit,
          assetId: assetId,
          imageUrl: protectedImageUrl || imageUrl,
          text: captionText,
          nsfw,
          sendReplies: true
        });

        clearInterval(progressInterval);
        setPostingProgress(100);
        return response;
      } catch (error) {
        clearInterval(progressInterval);
        setPostingProgress(0);
        throw error;
      }
    },
    onSuccess: (result) => {
      setTimeout(() => setPostingProgress(0), 1000);
      setPosted(true);
      const postUrl = result?.url;
      const warnings = Array.isArray(result?.warnings)
        ? (result?.warnings ?? []).filter((value): value is string => Boolean(value?.trim()))
        : [];
      const safeSubreddit = subreddit.trim();
      const baseDescription = postUrl
        ? `Your post is now live: ${postUrl}`
        : safeSubreddit
          ? `Your post is now live on r/${safeSubreddit}`
          : 'Your post is now live on Reddit';
      const warningSuffix = warnings.length > 0 ? ` Warnings: ${warnings.join(' • ')}` : '';

      toast({
        title: result?.message ?? '🎉 Posted successfully!',
        description: `${baseDescription}${warningSuffix}`
      });
    },
    onError: (error: unknown) => {
      setPostingProgress(0);
      toast({
        title: 'Post failed',
        description: error instanceof Error ? error.message : 'Could not post to Reddit',
        variant: 'destructive'
      });
    }
  });

  const handleImageUpload = (result: { imageUrl: string; assetId?: number }) => {
    setImageUrl(result.imageUrl);
    setAssetId(result.assetId);
    setPosted(false);
    setCaptionOptions([]);
    setSelectedCaption('');
    setConfirmedCaptionId(null);
    setProtectedImageUrl('');
    setCaptionPairId('');
    setCaptionShownAt(null);
    setValidationStatus('idle');
    setValidationWarnings([]);
    setValidationBlockers([]);

    runCaptionGeneration(result.imageUrl, selectedService, selectedTone, promotionMode, nsfw);
  };

  const runCaptionGeneration = (
    url: string,
    service: PlatformService,
    tone: string,
    promoMode: PromotionMode,
    nsfwFlag: boolean
  ) => {
    if (!url) {
      return;
    }

    setCaptionOptions([]);
    setSelectedCaption('');
    setConfirmedCaptionId(null);
    setCaptionShownAt(null);
    setValidationStatus('idle');
    setValidationWarnings([]);
    setValidationBlockers([]);

    generateCaptions.mutate({
      url,
      service,
      tone,
      promotionMode: promoMode,
      nsfwFlag
    });
  };

  const handleConfirmCaption = () => {
    if (!selectedCaption || captionOptions.length === 0 || !captionPairId) {
      return;
    }

    const chosenOption = captionOptions.find((option) => option.id === selectedCaption);
    if (!chosenOption) {
      return;
    }

    setConfirmedCaptionId(chosenOption.id);

    const decisionTime = captionShownAt ? Date.now() - captionShownAt : 0;
    trackCaptionChoice({
      pairId: captionPairId,
      chosenCaptionId: chosenOption.captionId,
      timeToChoiceMs: Math.max(decisionTime, 0),
      edited: false,
      editDeltaChars: 0,
      autoSelected: false
    });
  };

  const handleValidateSubreddit = () => {
    if (!confirmedCaptionId) {
      toast({
        title: 'Confirm a caption first',
        description: 'Pick the caption you want to use before validating subreddit rules.',
        variant: 'destructive'
      });
      return;
    }

    if (!subreddit.trim()) {
      toast({
        title: 'Enter a subreddit',
        description: 'Add the subreddit you want to post to before validating.',
        variant: 'destructive'
      });
      return;
    }

    const chosen = captionOptions.find((option) => option.id === confirmedCaptionId);
    if (!chosen) {
      return;
    }

    subredditLint.mutate({
      subreddit: subreddit.trim(),
      title: truncateTitle(chosen.text),
      caption: chosen.text, // NEW: Pass full caption for link validation
      nsfwFlag: nsfw
    });
  };

  const startNewPost = () => {
    setImageUrl('');
    setAssetId(undefined);
    setProtectedImageUrl('');
    setCaptionOptions([]);
    setSelectedCaption('');
    setConfirmedCaptionId(null);
    setPosted(false);
    setSubreddit('');
    setCaptionPairId('');
    setCaptionShownAt(null);
    setValidationStatus('idle');
    setValidationWarnings([]);
    setValidationBlockers([]);
  };

  const isReadyToPost = Boolean(
    imageUrl &&
    confirmedCaptionId &&
    subreddit &&
    subreddit.trim() &&
    selectedService === 'reddit' &&
    !postToReddit.isPending
  );

  const selectedServiceDetails = SERVICE_OPTIONS.find((option) => option.value === selectedService);

  const selectedCaptionOption = confirmedCaptionId
    ? captionOptions.find((option) => option.id === confirmedCaptionId)
    : null;

  return (
    <>
      {/* Status Banner for Quick Actions */}
      {!posted && imageUrl && (
        <StatusBanner
          message={captionOptions.length > 0 ? "✨ Captions ready! Select one to continue" : "⚡ Upload complete - generating captions..."}
          variant={captionOptions.length > 0 ? "success" : "info"}
        />
      )}

      <div className="container mx-auto px-4 py-4 sm:py-8 max-w-7xl">
        <TwoPane
          leftWidth="30%"
          sticky={true}
          leftPane={
            <div className="p-6 space-y-4">
              <div>
                <h2 className="text-lg font-semibold mb-1">Progress</h2>
                <p className="text-xs text-muted-foreground">Track your workflow</p>
              </div>

              <div className="space-y-3">
                <div className={cn(
                  "flex items-center justify-between p-3 rounded-lg transition-colors",
                  imageUrl ? "bg-green-50 dark:bg-green-950/20" : "bg-muted/50"
                )}>
                  <span className="text-sm font-medium">1. Upload</span>
                  {imageUrl ? (
                    <Badge variant="default" className="bg-green-600">✓</Badge>
                  ) : (
                    <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
                  )}
                </div>

                <div className={cn(
                  "flex items-center justify-between p-3 rounded-lg transition-colors",
                  protectedImageUrl ? "bg-green-50 dark:bg-green-950/20" : "bg-muted/50"
                )}>
                  <span className="text-sm font-medium">2. Protect</span>
                  {protectedImageUrl ? (
                    <Badge variant="default" className="bg-green-600">✓</Badge>
                  ) : (
                    <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
                  )}
                </div>

                <div className={cn(
                  "flex items-center justify-between p-3 rounded-lg transition-colors",
                  confirmedCaptionId ? "bg-green-50 dark:bg-green-950/20" : "bg-muted/50"
                )}>
                  <span className="text-sm font-medium">3. Caption</span>
                  {confirmedCaptionId ? (
                    <Badge variant="default" className="bg-green-600">✓</Badge>
                  ) : (
                    <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
                  )}
                </div>

                <div className={cn(
                  "flex items-center justify-between p-3 rounded-lg transition-colors",
                  posted ? "bg-green-50 dark:bg-green-950/20" : "bg-muted/50"
                )}>
                  <span className="text-sm font-medium">4. Post</span>
                  {posted ? (
                    <Badge variant="default" className="bg-green-600">✓</Badge>
                  ) : (
                    <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
                  )}
                </div>
              </div>

              <Card className="border-yellow-200 bg-yellow-50 dark:bg-yellow-950/20">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Zap className="h-4 w-4" />
                    Quick Post Benefits
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-0">
                  <ul className="text-xs space-y-1 text-muted-foreground">
                    <li>• 24-hour ephemeral storage</li>
                    <li>• AI voices & promo toggles</li>
                    <li>• 2 Grok-generated captions</li>
                    <li>• Auto ImageShield protection</li>
                    <li>• One-click Reddit posting</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          }
          rightPane={
            <div className="p-6">
              <div className="mb-4 sm:mb-8 text-center">
                <div className="inline-flex items-center gap-2 mb-2 sm:mb-4">
                  <div className="p-1.5 sm:p-2 bg-yellow-500 text-white rounded-full">
                    <Zap className="h-5 w-5 sm:h-6 sm:w-6" />
                  </div>
                  <h1 className="text-2xl sm:text-3xl font-bold">Quick Post</h1>
                </div>
                <p className="text-sm sm:text-base text-muted-foreground px-4">
                  Upload, generate captions, protect, and post in minutes
                </p>
              </div>

              <Card>
                <CardContent className="p-4 sm:p-6">
                  {!posted ? (
                    <div className="space-y-6">
                      <div>
                        <div className="flex items-center gap-2 mb-4">
                          <Badge variant={imageUrl ? 'default' : 'outline'}>
                            {imageUrl ? <CheckCircle className="h-3 w-3 mr-1" /> : '1'}
                          </Badge>
                          <Label>Upload Image</Label>
                        </div>

                        {!imageUrl ? (
                          <RedditNativeUploadPortal onComplete={handleImageUpload} />
                        ) : (
                          <div className="flex items-center gap-4">
                            {sanitizeImageUrl(imageUrl) ? (
                              <img
                                src={sanitizeImageUrl(imageUrl) ?? ''}
                                alt="Uploaded"
                                className="w-32 h-32 object-cover rounded-lg"
                              />
                            ) : (
                              <div className="w-32 h-32 bg-gray-100 flex items-center justify-center rounded-lg text-sm text-muted-foreground">
                                Invalid image URL
                              </div>
                            )}
                            <div>
                              <p className="text-sm text-muted-foreground mb-2">Image stored for Reddit native posting</p>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={startNewPost}
                              >
                                Upload Different Image
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>

                      {imageUrl && (
                        <div>
                          <div className="flex items-center gap-2 mb-4">
                            <Badge variant="outline">2</Badge>
                            <Label>Configure Generation Settings</Label>
                            <Settings2 className="h-4 w-4 text-muted-foreground" />
                          </div>

                          <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-2">
                              <Label htmlFor="service">Service</Label>
                              <Select
                                value={selectedService}
                                onValueChange={(value) => {
                                  const nextService = value as PlatformService;
                                  setSelectedService(nextService);
                                  if (imageUrl) {
                                    runCaptionGeneration(imageUrl, nextService, selectedTone, promotionMode, nsfw);
                                  }
                                }}
                              >
                                <SelectTrigger id="service">
                                  <SelectValue placeholder="Select service" />
                                </SelectTrigger>
                                <SelectContent>
                                  {SERVICE_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      <div className="flex flex-col">
                                        <span className="font-medium">{option.label}</span>
                                        <span className="text-xs text-muted-foreground">{option.description}</span>
                                      </div>
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="space-y-2">
                              <Label htmlFor="tone">Tone</Label>
                              <Select
                                value={selectedTone}
                                onValueChange={(value) => {
                                  setSelectedTone(value);
                                  if (imageUrl) {
                                    runCaptionGeneration(imageUrl, selectedService, value, promotionMode, nsfw);
                                  }
                                }}
                              >
                                <SelectTrigger id="tone">
                                  <SelectValue placeholder="Select tone" />
                                </SelectTrigger>
                                <SelectContent>
                                  {toneOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>

                            <div className="flex items-center space-x-3">
                              <Switch
                                id="promotion"
                                checked={promotionEnabled}
                                onCheckedChange={(checked) => {
                                  setPromotionEnabled(checked);
                                  if (imageUrl) {
                                    runCaptionGeneration(
                                      imageUrl,
                                      selectedService,
                                      selectedTone,
                                      checked ? 'explicit' : 'none',
                                      nsfw
                                    );
                                  }
                                }}
                              />
                              <Label htmlFor="promotion" className="flex-1">
                                Include promo CTA
                                <span className="block text-xs text-muted-foreground">
                                  Adds a soft plug when enabled
                                </span>
                              </Label>
                            </div>

                            <div className="flex items-center space-x-3">
                              <Switch
                                id="nsfw"
                                checked={nsfw}
                                onCheckedChange={(checked) => {
                                  const availableTones = checked ? NSFW_TONES : SFW_TONES;
                                  const nextTone = availableTones.some((option) => option.value === selectedTone)
                                    ? selectedTone
                                    : availableTones[0]?.value ?? selectedTone;
                                  setNsfw(checked);
                                  setSelectedTone(nextTone);
                                  if (imageUrl) {
                                    runCaptionGeneration(
                                      imageUrl,
                                      selectedService,
                                      nextTone,
                                      promotionMode,
                                      checked
                                    );
                                  }
                                }}
                              />
                              <Label htmlFor="nsfw" className="flex-1">
                                Mark caption as NSFW
                                <span className="block text-xs text-muted-foreground">
                                  Switch tones & safety filters automatically
                                </span>
                              </Label>
                            </div>
                          </div>
                        </div>
                      )}

                      {imageUrl && (
                        <div>
                          <div className="flex items-center gap-2 mb-4">
                            <Badge variant={captionOptions.length > 0 ? 'default' : 'outline'}>
                              {captionOptions.length > 0 ? <CheckCircle className="h-3 w-3 mr-1" /> : '3'}
                            </Badge>
                            <Label>Choose Caption</Label>
                            {generateCaptions.isPending && (
                              <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
                            )}
                          </div>

                          {/* Caption Generation Progress */}
                          {generateCaptions.isPending && captionProgress > 0 && (
                            <div className="mb-4">
                              <ProgressWithLabel
                                value={captionProgress}
                                label="Generating captions..."
                                className="mb-2"
                              />
                            </div>
                          )}

                          {/* Image Protection Progress */}
                          {protectImage.isPending && protectionProgress > 0 && (
                            <div className="mb-4">
                              <ProgressWithLabel
                                value={protectionProgress}
                                label="Applying ImageShield protection..."
                                className="mb-2"
                              />
                            </div>
                          )}

                          {captionOptions.length > 0 ? (
                            <>
                              {confirmedCaptionId ? (
                                <Card className="border-purple-500 bg-purple-50 dark:bg-purple-950/20">
                                  <CardHeader className="pb-2">
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <Badge variant="secondary">Selected</Badge>
                                        <span className="text-sm text-muted-foreground">Caption {confirmedCaptionId}</span>
                                      </div>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-6 w-6"
                                        onClick={() => {
                                          setIsEditingCaption(true);
                                          setCaptionBeingEdited(confirmedCaptionId);
                                          setEditedCaptionText(selectedCaptionOption?.text || '');
                                        }}
                                      >
                                        <Pencil className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  </CardHeader>
                                  <CardContent>
                                    {isEditingCaption && captionBeingEdited === confirmedCaptionId ? (
                                      <div className="space-y-2">
                                        <Textarea
                                          value={editedCaptionText}
                                          onChange={(e) => setEditedCaptionText(e.target.value)}
                                          className="min-h-[60px] text-sm"
                                          placeholder="Edit your caption..."
                                        />
                                        <div className="flex gap-2">
                                          <Button
                                            size="sm"
                                            onClick={() => {
                                              const updatedOptions = captionOptions.map(opt =>
                                                opt.id === confirmedCaptionId ? { ...opt, text: editedCaptionText } : opt
                                              );
                                              setCaptionOptions(updatedOptions);
                                              setIsEditingCaption(false);
                                              setCaptionBeingEdited(null);
                                            }}
                                          >
                                            <Save className="h-3 w-3 mr-1" />
                                            Save
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => {
                                              setIsEditingCaption(false);
                                              setCaptionBeingEdited(null);
                                              setEditedCaptionText('');
                                            }}
                                          >
                                            <X className="h-3 w-3 mr-1" />
                                            Cancel
                                          </Button>
                                        </div>
                                      </div>
                                    ) : (
                                      <p className="text-sm">{selectedCaptionOption?.text}</p>
                                    )}
                                  </CardContent>
                                </Card>
                              ) : (
                                <RadioGroup value={selectedCaption} onValueChange={(value) => setSelectedCaption(value as 'A' | 'B')}>
                                  <div className="space-y-4">
                                    {captionOptions.map((option) => (
                                      <Card
                                        key={option.id}
                                        className={cn(
                                          'cursor-pointer transition-all',
                                          selectedCaption === option.id && 'border-purple-500 bg-purple-50 dark:bg-purple-950/20'
                                        )}
                                        onClick={() => setSelectedCaption(option.id)}
                                      >
                                        <CardHeader className="pb-2">
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                              <RadioGroupItem value={option.id} />
                                              <Badge variant="secondary">{option.style}</Badge>
                                              <span className="text-xs text-muted-foreground">Caption {option.id}</span>
                                            </div>
                                            {selectedCaption === option.id && (
                                              <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  setIsEditingCaption(true);
                                                  setCaptionBeingEdited(option.id);
                                                  setEditedCaptionText(option.text);
                                                }}
                                              >
                                                <Pencil className="h-3 w-3" />
                                              </Button>
                                            )}
                                          </div>
                                        </CardHeader>
                                        <CardContent>
                                          {isEditingCaption && captionBeingEdited === option.id ? (
                                            <div className="space-y-2">
                                              <Textarea
                                                value={editedCaptionText}
                                                onChange={(e) => setEditedCaptionText(e.target.value)}
                                                className="min-h-[60px] text-sm"
                                                placeholder="Edit your caption..."
                                              />
                                              <div className="flex gap-2">
                                                <Button
                                                  size="sm"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    const updatedOptions = captionOptions.map(opt =>
                                                      opt.id === option.id ? { ...opt, text: editedCaptionText } : opt
                                                    );
                                                    setCaptionOptions(updatedOptions);
                                                    setIsEditingCaption(false);
                                                    setCaptionBeingEdited(null);
                                                  }}
                                                >
                                                  <Save className="h-3 w-3 mr-1" />
                                                  Save
                                                </Button>
                                                <Button
                                                  size="sm"
                                                  variant="outline"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setIsEditingCaption(false);
                                                    setCaptionBeingEdited(null);
                                                    setEditedCaptionText('');
                                                  }}
                                                >
                                                  <X className="h-3 w-3 mr-1" />
                                                  Cancel
                                                </Button>
                                              </div>
                                            </div>
                                          ) : (
                                            <p className="text-sm">{option.text}</p>
                                          )}
                                        </CardContent>
                                      </Card>
                                    ))}
                                  </div>
                                </RadioGroup>
                              )}

                              {!confirmedCaptionId && (
                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3 mt-4">
                                  <Button
                                    onClick={handleConfirmCaption}
                                    disabled={!selectedCaption}
                                    className="bg-purple-600 hover:bg-purple-700 min-h-[44px]"
                                  >
                                    <BadgeCheck className="h-4 w-4 mr-2" />
                                    Use Selected Caption
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => runCaptionGeneration(imageUrl, selectedService, selectedTone, promotionMode, nsfw)}
                                    disabled={generateCaptions.isPending}
                                    className="min-h-[44px]"
                                  >
                                    <RefreshCw className="h-3 w-3 mr-1" />
                                    <span className="hidden sm:inline">Regenerate Captions</span>
                                    <span className="sm:hidden">Regenerate</span>
                                  </Button>
                                </div>
                              )}
                            </>
                          ) : generateCaptions.isPending ? (
                            <div className="flex items-center justify-center py-8">
                              <div className="text-center">
                                <Sparkles className="h-8 w-8 mx-auto mb-2 text-purple-500 animate-pulse" />
                                <p className="text-sm text-muted-foreground">Generating captions with Grok...</p>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      )}

                      {imageUrl && (
                        <div>
                          <div className="flex items-center gap-2 mb-4">
                            <Badge variant={protectedImageUrl ? 'default' : 'outline'}>
                              {protectedImageUrl ? <CheckCircle className="h-3 w-3 mr-1" /> : '4'}
                            </Badge>
                            <Label>ImageShield Protection</Label>
                            {protectImage.isPending && (
                              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                            )}
                          </div>

                          {protectedImageUrl ? (
                            <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20">
                              <Shield className="h-4 w-4 text-green-600" />
                              <AlertDescription className="text-green-700 dark:text-green-400">
                                Image protected against reverse search
                              </AlertDescription>
                            </Alert>
                          ) : protectImage.isPending ? (
                            <Alert>
                              <Shield className="h-4 w-4 animate-pulse" />
                              <AlertDescription>Applying protection...</AlertDescription>
                            </Alert>
                          ) : null}
                        </div>
                      )}

                      {/* Performance Prediction - Show after caption is confirmed */}
                      {confirmedCaptionId && selectedCaptionOption && subreddit && (
                        <div>
                          <div className="flex items-center gap-2 mb-4">
                            <Badge variant="outline">
                              <Sparkles className="h-3 w-3 mr-1" />
                            </Badge>
                            <Label>Performance Prediction</Label>
                          </div>
                          <PerformancePrediction
                            subreddit={subreddit}
                            title={selectedCaptionOption.text}
                            scheduledTime={new Date()}
                          />
                        </div>
                      )}

                      {captionOptions.length > 0 && (
                        <div>
                          <div className="flex items-center gap-2 mb-4">
                            <Badge variant="outline">5</Badge>
                            <Label>Post Details</Label>
                          </div>

                          {selectedService !== 'reddit' && (
                            <Alert variant="destructive" className="mb-4">
                              <AlertTriangle className="h-4 w-4" />
                              <AlertDescription>
                                Quick Post currently supports direct Reddit submissions. Use the generated caption for
                                {selectedServiceDetails ? ` ${selectedServiceDetails.label}` : 'this platform'} manually.
                              </AlertDescription>
                            </Alert>
                          )}

                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="subreddit">Subreddit</Label>
                              {hasCommunityError ? (
                                <Alert variant="destructive" className="mt-2">
                                  <AlertDescription>
                                    Unable to load your saved communities. {communityErrorMessage} You can still type a subreddit manually below.
                                  </AlertDescription>
                                </Alert>
                              ) : null}
                              <Popover open={communityPickerOpen} onOpenChange={setCommunityPickerOpen}>
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    role="combobox"
                                    aria-expanded={communityPickerOpen}
                                    className="w-full justify-between mt-1"
                                    disabled={communitiesLoading || hasCommunityError}
                                  >
                                    <div className="flex items-center gap-2 flex-1 min-w-0">
                                      {communitiesLoading ? (
                                        'Loading communities...'
                                      ) : subreddit ? (
                                        (() => {
                                          const selected = sortedCommunities.find((community) => community.id.toLowerCase() === subreddit.toLowerCase());
                                          const healthData = healthScoresMap.get(subreddit.toLowerCase());
                                          return (
                                            <>
                                              <span className="truncate">{selected ? `r/${selected.displayName}` : `r/${subreddit}`}</span>
                                              {healthData && (
                                                <SubredditHealthBadge
                                                  score={healthData.healthScore}
                                                  status={healthData.status}
                                                  breakdown={healthData.breakdown}
                                                  trend={healthData.trend}
                                                  showLabel={false}
                                                  size="sm"
                                                />
                                              )}
                                            </>
                                          );
                                        })()
                                      ) : sortedCommunities.length > 0 ? (
                                        'Select subreddit...'
                                      ) : (
                                        'No saved communities yet'
                                      )}
                                    </div>
                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-full p-0">
                                  <Command>
                                    <CommandInput
                                      placeholder="Search subreddits..."
                                      disabled={communitiesLoading}
                                    />
                                    <CommandEmpty>
                                      {communitiesLoading
                                        ? 'Loading communities...'
                                        : hasCommunityError
                                          ? 'Communities unavailable. Use the manual input below.'
                                          : 'No subreddit found.'}
                                    </CommandEmpty>
                                    <CommandList>
                                      {communitiesLoading ? (
                                        <div className="py-6 text-center text-sm text-muted-foreground">
                                          <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
                                          Fetching communities...
                                        </div>
                                      ) : (
                                        <CommandGroup>
                                          {sortedCommunities.map((community) => {
                                            const healthData = healthScoresMap.get(community.id.toLowerCase());
                                            return (
                                              <CommandItem
                                                key={community.id}
                                                value={community.id}
                                                onSelect={(currentValue) => {
                                                  setSubreddit(currentValue === subreddit ? '' : currentValue);
                                                  setCommunityPickerOpen(false);
                                                }}
                                              >
                                                <div className="flex items-center justify-between w-full gap-2">
                                                  <div className="flex-1 min-w-0">
                                                    <div className="font-medium">r/{community.displayName}</div>
                                                    <div className="text-xs text-muted-foreground">
                                                      {community.members.toLocaleString()} members • {Math.round(community.successProbability ?? 0)}% success
                                                    </div>
                                                  </div>
                                                  {healthData && (
                                                    <SubredditHealthBadge
                                                      score={healthData.healthScore}
                                                      status={healthData.status}
                                                      breakdown={healthData.breakdown}
                                                      trend={healthData.trend}
                                                      showLabel={false}
                                                      size="sm"
                                                    />
                                                  )}
                                                </div>
                                              </CommandItem>
                                            );
                                          })}
                                        </CommandGroup>
                                      )}
                                    </CommandList>
                                  </Command>
                                </PopoverContent>
                              </Popover>
                              <Input
                                id="subreddit"
                                value={subreddit}
                                onChange={(event) => setSubreddit(event.target.value.replace(/^r\//i, ''))}
                                onBlur={() => setSubreddit((current) => current.trim().replace(/^r\//i, ''))}
                                placeholder="Type a subreddit (e.g., gonewild)"
                                className="mt-3"
                                autoComplete="off"
                              />
                              <p className="mt-1 text-xs text-muted-foreground">
                                Pick from your saved list or type any subreddit manually.
                              </p>
                            </div>

                            <div className="flex items-center space-x-2">
                              <Switch
                                id="nsfw-post"
                                checked={nsfw}
                                onCheckedChange={(checked) => setNsfw(checked)}
                              />
                              <Label htmlFor="nsfw-post">Mark as NSFW</Label>
                            </div>

                            {confirmedCaptionId && (
                              <div className="space-y-3">
                                {/* Posting Progress */}
                                {postToReddit.isPending && postingProgress > 0 && (
                                  <div className="mb-4">
                                    <ProgressWithLabel
                                      value={postingProgress}
                                      label="Posting to Reddit..."
                                      className="mb-2"
                                    />
                                  </div>
                                )}

                                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                  <Button
                                    variant="outline"
                                    onClick={handleValidateSubreddit}
                                    disabled={subredditLint.isPending}
                                    className="min-h-[44px] w-full sm:w-auto"
                                  >
                                    {subredditLint.isPending ? (
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    ) : (
                                      <BadgeCheck className="h-4 w-4 mr-2" />
                                    )}
                                    <span className="hidden sm:inline">Validate Subreddit Rules</span>
                                    <span className="sm:hidden">Validate Rules</span>
                                  </Button>

                                  <Button
                                    onClick={() => postToReddit.mutate()}
                                    disabled={!isReadyToPost}
                                    className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 min-h-[44px] w-full sm:w-auto"
                                    size="lg"
                                  >
                                    {postToReddit.isPending ? (
                                      <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        Posting...
                                      </>
                                    ) : (
                                      <>
                                        <Send className="mr-2 h-4 w-4" />
                                        Post to Reddit Now
                                      </>
                                    )}
                                  </Button>
                                </div>

                                {validationStatus !== 'idle' && (
                                  <Alert
                                    variant={validationStatus === 'valid' ? 'default' : validationStatus === 'error' ? 'destructive' : 'default'}
                                  >
                                    {validationStatus === 'valid' ? (
                                      <CheckCircle className="h-4 w-4 text-green-600" />
                                    ) : validationStatus === 'error' ? (
                                      <X className="h-4 w-4 text-red-600" />
                                    ) : (
                                      <AlertTriangle className="h-4 w-4 text-orange-500" />
                                    )}
                                    <AlertDescription className="space-y-2 text-sm">
                                      {validationStatus === 'valid' && 'Subreddit check passed. You are good to go!'}

                                      {validationStatus === 'error' && validationBlockers.length > 0 && (
                                        <div className="space-y-1">
                                          <p className="font-semibold text-red-600">Cannot Post - Requirements Not Met:</p>
                                          <ul className="list-disc list-inside space-y-1">
                                            {validationBlockers.map((blocker) => (
                                              <li key={blocker} className="text-red-800">{blocker}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}

                                      {validationStatus === 'warning' && validationWarnings.length > 0 && (
                                        <div className="space-y-1">
                                          <p className="font-medium text-orange-600">Warnings:</p>
                                          <ul className="list-disc list-inside space-y-1">
                                            {validationWarnings.map((warning) => (
                                              <li key={warning} className="text-orange-800">{warning}</li>
                                            ))}
                                          </ul>
                                        </div>
                                      )}
                                    </AlertDescription>
                                  </Alert>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="text-center py-12">
                      <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 text-green-600 rounded-full mb-4">
                        <CheckCircle className="h-8 w-8" />
                      </div>
                      <h2 className="text-2xl font-bold mb-2">Posted Successfully!</h2>
                      <p className="text-muted-foreground mb-6">
                        Your post is now live on r/{subreddit}
                      </p>
                      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
                        <Button
                          variant="outline"
                          onClick={() => window.open(`https://reddit.com/r/${subreddit}`, '_blank')}
                          className="min-h-[44px]"
                        >
                          View on Reddit
                        </Button>
                        <Button onClick={startNewPost} className="min-h-[44px]">
                          <Plus className="mr-2 h-4 w-4" />
                          Create Another Post
                        </Button>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          }
        />
      </div>
    </>
  );
}
