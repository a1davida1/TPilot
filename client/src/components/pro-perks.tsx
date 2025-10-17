import React, { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious, type CarouselApi } from "@/components/ui/carousel";
import { 
  Gift,
  Search,
  Sparkles,
  CheckCircle,
  Users,
  ExternalLink,
  Shield,
  Clock,
  Eye,
  Info,
  Loader2,
  Globe,
  BookOpen,
  Percent,
  Star,
  DollarSign,
  Copy,
  RefreshCw
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { LucideIcon } from "lucide-react";
import { trackFeatureUsage } from "@/lib/analytics-tracker";
import { ThottoPilotLogo } from "@/components/thottopilot-logo";
import { cn } from "@/lib/utils";

interface ProPerk {
  id: string;
  name: string;
  category: "affiliate" | "integration" | "tools" | "community" | "pro";
  tier: "starter" | "pro";
  description: string;
  commissionRate?: string;
  requirements?: string[];
  signupProcess: string;
  estimatedEarnings: string;
  status: "available" | "application-required" | "coming-soon";
  officialLink?: string;
  features: string[];
}

interface SignupInstructions {
  steps: string[];
  requirements: string[];
  timeline: string;
  support: string;
}

interface ProResourcesResult {
  perks: ProPerk[];
  accessGranted: boolean;
}

interface ProPerksProps {
  userTier?: "guest" | "free" | "pro" | "premium";
}

type CategoryFilter = "all" | ProPerk["category"];

const BEST_EXCLUSIVE_PERK_IDS = [
  "onlyfans-referral",
  "fansly-affiliate",
  "lovense-affiliate",
  "streamate-affiliate",
  "whop-monetization"
];

const highlightCopy: Record<string, { reason: string; bonus: string }> = {
  "onlyfans-referral": {
    reason: "Lock in higher revshare for onlyfans recruits without extra paperwork.",
    bonus: "T-Perks ask: extend payouts to 18 months so your roster keeps compounding."
  },
  "fansly-affiliate": {
    reason: "Diversify income on a platform actively poaching premium creators.",
    bonus: "T-Perks ask: +2% revshare lift for the first 6 months when you migrate."
  },
  "lovense-affiliate": {
    reason: "Bundle interactive toys with your live schedule for higher AOV per fan.",
    bonus: "T-Perks ask: guaranteed 30% commission floor plus branded starter kits."
  },
  "streamate-affiliate": {
    reason: "Recruit cam talent with an industry-best CPA and lifetime override.",
    bonus: "T-Perks ask: $120 CPA floor on your first 100 ThottoPilot-sourced signups."
  },
  "whop-monetization": {
    reason: "Stand up paid Discords and digital offers with automated fulfillment.",
    bonus: "T-Perks ask: waive Whop fees for 90 days and add concierge onboarding."
  }
};

const categoryMetadata: Record<ProPerk["category"], {
  label: string;
  description: string;
  icon: LucideIcon;
  gradient: string;
}> = {
  affiliate: {
    label: "Affiliate Programs",
    description: "Earn recurring revenue by promoting aligned creator platforms.",
    icon: Sparkles,
    gradient: "from-purple-500/20 to-pink-500/20"
  },
  integration: {
    label: "Platform Integrations",
    description: "Connect your brand with high-impact distribution channels.",
    icon: Globe,
    gradient: "from-blue-500/20 to-cyan-500/20"
  },
  tools: {
    label: "Creator Tools",
    description: "Software and services that automate workflow and monetization.",
    icon: Shield,
    gradient: "from-amber-500/20 to-orange-500/20"
  },
  community: {
    label: "Community & Partnerships",
    description: "Grow influence with verified partner and ambassador programs.",
    icon: Users,
    gradient: "from-emerald-500/20 to-lime-500/20"
  },
  pro: {
    label: "Pro Exclusives",
    description: "Premium perks curated exclusively for ThottoPilot Pro members.",
    icon: Gift,
    gradient: "from-rose-500/20 to-red-500/20"
  }
};

const statusStyles: Record<ProPerk["status"], { label: string; className: string }> = {
  available: {
    label: "Available",
    className: "bg-emerald-500/20 text-emerald-300 border-emerald-500/30"
  },
  "application-required": {
    label: "Application Required",
    className: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30"
  },
  "coming-soon": {
    label: "Coming Soon",
    className: "bg-slate-500/20 text-slate-300 border-slate-500/30"
  }
};

export function ProPerks({ userTier: _userTier = "pro" }: ProPerksProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");
  const [selectedPerk, setSelectedPerk] = useState<ProPerk | null>(null);
  const [instructionsByPerk, setInstructionsByPerk] = useState<Record<string, SignupInstructions>>({});
  const [_instructionsLoading, setInstructionsLoading] = useState<string | null>(null);
  const [referralCodesByPerk, setReferralCodesByPerk] = useState<Record<string, string>>({});
  const { toast } = useToast();
  const _queryClient = useQueryClient();
  const [carouselApi, setCarouselApi] = useState<CarouselApi | null>(null);
  const [activeSlide, setActiveSlide] = useState(0);
  const loadTrackedRef = useRef(false);

  const sessionFetch = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await fetch(input, { ...init, credentials: "include" });
      return response;
    },
    []
  );

  // Fetch real resources from API
  const { data, isLoading, isError: _isError } = useQuery<ProResourcesResult>({
    queryKey: ["pro-resources"],
    queryFn: async () => {
      if (typeof window === "undefined") {
        return { perks: [], accessGranted: false } satisfies ProResourcesResult;
      }

      try {
        const response = await sessionFetch("/api/pro-resources");

        if (response.status === 401 || response.status === 403) {
          return { perks: [], accessGranted: false } satisfies ProResourcesResult;
        }

        if (!response.ok) {
          throw new Error("Failed to fetch pro resources");
        }

        const payload = await response.json() as { perks: ProPerk[] };
        return { perks: payload.perks, accessGranted: true } satisfies ProResourcesResult;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to fetch pro resources";
        throw new Error(message);
      }
    }
  });

  const perks = data?.perks ?? [];
  const hasAccess = data?.accessGranted ?? false;

  useEffect(() => {
    if (!isLoading && !loadTrackedRef.current) {
      trackFeatureUsage("pro_perks", "load", {
        accessGranted: hasAccess,
        perkCount: perks.length,
      });
      loadTrackedRef.current = true;
    }
  }, [isLoading, hasAccess, perks.length]);

  useEffect(() => {
    if (!carouselApi) {
      return;
    }

    const onSelect = () => {
      setActiveSlide(carouselApi.selectedScrollSnap());
    };

    onSelect();
    carouselApi.on("select", onSelect);

    return () => {
      carouselApi.off("select", onSelect);
    };
  }, [carouselApi]);

  const referralDescription = hasAccess
    ? "Invite creators to unlock T-Perks and ride along on their upgrade revenue."
    : "Share ThottoPilot and earn whenever your audience joins Pro and unlocks the T-Perks vault.";

  const referralCta = (
    <Card className="bg-gradient-to-br from-emerald-900/30 via-emerald-800/10 to-teal-900/20 border-emerald-500/30 shadow-[0_0_25px_rgba(16,185,129,0.2)]">
      <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-2">
          <CardTitle className="flex items-center gap-2 text-emerald-300">
            <Users className="h-5 w-5" />
            Referral Hub
          </CardTitle>
          <CardDescription className="text-gray-200">
            {referralDescription}
          </CardDescription>
        </div>
        <Button
          asChild
          className="w-full md:w-auto bg-gradient-to-r from-emerald-500 to-cyan-500 border-0 text-white shadow-lg"
          data-testid="referral-hub-cta"
        >
          <Link to="/referral">Open referral hub</Link>
        </Button>
      </CardHeader>
      <CardContent className="text-sm text-emerald-100/80">
        <p>Track referrals, generate codes, and route bonuses with a single-click workspace.</p>
      </CardContent>
    </Card>
  );

  const categories = useMemo(() => {
    const uniqueCategories = new Set<ProPerk["category"]>(perks.map((perk) => perk.category));
    const baseCategory = {
      id: "all" as const,
      label: "All Perks",
      description: "Every curated partner program in one view.",
      icon: Sparkles,
      gradient: "from-purple-500/20 to-pink-500/20"
    };

    const mapped = Array.from(uniqueCategories).map((category) => ({
      id: category,
      ...categoryMetadata[category]
    }));

    return [baseCategory, ...mapped];
  }, [perks]);

  const filteredPerks = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return perks.filter((perk) => {
      const matchesCategory = activeCategory === "all" || perk.category === activeCategory;
      if (!matchesCategory) {
        return false;
      }

      if (!term) {
        return true;
      }

      const searchableFields = [
        perk.name,
        perk.description,
        perk.commissionRate ?? "",
        perk.estimatedEarnings,
        perk.features.join(" ")
      ];

      return searchableFields.some((field) => field.toLowerCase().includes(term));
    });
  }, [perks, activeCategory, searchTerm]);

  const affiliateCount = useMemo(
    () => perks.filter((perk) => perk.category === "affiliate").length,
    [perks]
  );

  const applicationRequiredCount = useMemo(
    () => perks.filter((perk) => perk.status === "application-required").length,
    [perks]
  );

  const availableNowCount = useMemo(
    () => perks.filter((perk) => perk.status === "available").length,
    [perks]
  );

  const ensureInstructions = useCallback(async (perk: ProPerk) => {
    if (instructionsByPerk[perk.id]) {
      return;
    }

    if (typeof window === "undefined") {
      return;
    }

    try {
      setInstructionsLoading(perk.id);
      const response = await sessionFetch(`/api/pro-resources/${perk.id}/signup-instructions`);

      if (response.status === 401 || response.status === 403) {
        toast({
          title: "Sign in required",
          description: "Log in with your Pro account to view detailed signup steps.",
          variant: "destructive"
        });
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to load signup instructions");
      }

      const payload = await response.json() as { instructions: SignupInstructions };
      setInstructionsByPerk((previous) => ({
        ...previous,
        [perk.id]: payload.instructions
      }));
      trackFeatureUsage("pro_perks", "load_instructions", { perkId: perk.id });
    } catch (error) {
      toast({
        title: "Unable to load instructions",
        description: error instanceof Error ? error.message : "Unexpected error loading perk guidance.",
        variant: "destructive"
      });
      trackFeatureUsage("pro_perks", "load_instructions_error", {
        perkId: perk.id,
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setInstructionsLoading(null);
    }
  }, [instructionsByPerk, sessionFetch, toast]);

  const generateReferralMutation = useMutation({
    mutationFn: async (perkId: string) => {
      const response = await sessionFetch(`/api/pro-resources/${perkId}/referral-code`, {
        method: 'POST'
      });

      if (response.status === 401 || response.status === 403) {
        throw new Error("Authentication required");
      }

      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage;
        try {
          const errorJson = JSON.parse(errorText);
          errorMessage = errorJson.error || errorText;
        } catch {
          errorMessage = errorText || response.statusText;
        }
        throw new Error(errorMessage);
      }

      const data = await response.json() as { referralCode: string };
      return data.referralCode;
    },
    onSuccess: (referralCode, perkId) => {
      setReferralCodesByPerk((prev) => ({
        ...prev,
        [perkId]: referralCode
      }));
      toast({
        title: "Referral code generated",
        description: "Your referral code is ready to share!"
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to generate referral code",
        description: error.message || "Unable to generate referral code. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleGenerateReferralCode = useCallback((perkId: string) => {
    if (!referralCodesByPerk[perkId]) {
      trackFeatureUsage("pro_perks", "generate_referral_start", { perkId });
      generateReferralMutation.mutate(perkId);
    }
  }, [referralCodesByPerk, generateReferralMutation]);

  const handleCopyReferralCode = useCallback(async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast({
        title: "Copied to clipboard",
        description: "Referral code copied successfully!"
      });
    } catch {
      toast({
        title: "Copy failed",
        description: "Unable to copy to clipboard. Please copy manually.",
        variant: "destructive"
      });
      trackFeatureUsage("pro_perks", "copy_referral_code_error");
    }
  }, [toast]);

  const handleOpenPerk = useCallback((perk: ProPerk) => {
    setSelectedPerk(perk);
    trackFeatureUsage("pro_perks", "open_perk", { perkId: perk.id });
    void ensureInstructions(perk);
    handleGenerateReferralCode(perk.id);
  }, [ensureInstructions, handleGenerateReferralCode]);

  const _handleClosePerk = useCallback(() => {
    if (selectedPerk) {
      trackFeatureUsage("pro_perks", "close_perk", { perkId: selectedPerk.id });
    }
    setSelectedPerk(null);
  }, [selectedPerk]);

  // Show empty state when no resources available or no access
  if (!isLoading && (!hasAccess || perks.length === 0)) {
    return (
      <div className="space-y-6">
        {referralCta}
        <Card className="bg-gray-900/50 backdrop-blur-xl border-white/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-purple-400" />
              Pro Perks & Resources
            </CardTitle>
            <CardDescription>
              {!hasAccess
                ? "Upgrade to Pro to access exclusive affiliate programs and monetization tools"
                : "Exclusive resources and discounts for Pro users"
              }
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <Gift className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-400">
                {!hasAccess ? "Pro subscription required" : "Resources coming soon!"}
              </p>
              <p className="text-sm text-gray-500 mt-2">
                {!hasAccess
                  ? "Unlock access to high-value affiliate programs and monetization tools"
                  : "We're partnering with top platforms to bring you exclusive opportunities"
                }
              </p>
              {!hasAccess && (
                <Button className="mt-4 bg-gradient-to-r from-purple-500 to-pink-500">
                  Upgrade to Pro
                </Button>
              )}
            </div>
            {!hasAccess && (
              <p className="text-sm text-gray-500 mt-6">
                Prefer to stay on the free plan? Share ThottoPilot using the referral hub above and still earn payouts.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }


  if (isLoading) {
    return (
      <Card className="bg-gray-900/50 backdrop-blur-xl border-white/10">
        <CardContent className="p-8">
          <div className="flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-purple-400" />
            <span className="ml-2 text-gray-400">Loading pro resources...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <Card className="bg-gradient-to-br from-primary-900/50 via-purple-900/40 to-rose-900/30 border-primary-500/40 shadow-[0_0_45px_rgba(168,85,247,0.25)]">
        <CardHeader>
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-3">
              <CardTitle className="text-3xl bg-gradient-to-r from-teal-300 via-primary-200 to-rose-300 bg-clip-text text-transparent">
                T-Perks Command Center
              </CardTitle>
              <CardDescription className="text-gray-200 max-w-2xl">
                Swipe through the flagship perks we’ve already negotiated for creators, then dive into the full catalog by category. Every T-Perk spells out the baseline offer and the bonus you unlock through ThottoPilot.
              </CardDescription>
            </div>
            <div className="flex flex-col items-start lg:items-end gap-2">
              <Badge className="bg-gradient-to-r from-teal-500 to-primary-500 text-white border-0 shadow-lg">
                T-PERKS ACCESS
              </Badge>
              <p className="text-sm text-gray-300">
                {perks.length} curated perks • {affiliateCount} affiliate funnels • {availableNowCount} live today
              </p>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Featured Carousel */}
      <div className="relative">
        <Carousel
          setApi={setCarouselApi}
          className="w-full"
          opts={{ align: "start", loop: true }}
        >
          <CarouselContent className="-ml-4">
            {perks.map((perk) => (
              <CarouselItem key={perk.id} className="pl-4 md:basis-1/2 xl:basis-1/3">
                <Card
                  className="relative h-full bg-gradient-to-br from-slate-950/70 via-slate-900/40 to-slate-950/30 border-white/10 backdrop-blur-xl overflow-hidden group"
                  data-testid={`perk-carousel-${perk.id}`}
                >
                  <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 bg-[radial-gradient(circle_at_top_left,rgba(56,189,248,0.6),transparent_60%),radial-gradient(circle_at_bottom_right,rgba(244,114,182,0.45),transparent_60%)]" />
                  <CardHeader className="relative z-10 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-2">
                        <Badge className={statusStyles[perk.status].className}>
                          {statusStyles[perk.status].label}
                        </Badge>
                        <Badge variant="outline" className="border-white/20 text-white/80">
                          {categoryMetadata[perk.category].label}
                        </Badge>
                      </div>
                      {BEST_EXCLUSIVE_PERK_IDS.includes(perk.id) && (
                        <div className={cn(
                          "transition-transform duration-500",
                          selectedPerk?.id === perk.id || perks[activeSlide % perks.length]?.id === perk.id
                            ? "translate-y-0"
                            : "-translate-y-3 opacity-80"
                        )}>
                          <div className="flex items-center gap-2 rounded-full bg-gradient-to-r from-sky-500 to-indigo-500 px-3 py-1 text-xs font-semibold text-white shadow-lg">
                            <ThottoPilotLogo className="h-4 w-4" size="sm" />
                            Best Exclusive T-Perk
                          </div>
                        </div>
                      )}
                    </div>
                    <CardTitle className="text-2xl text-white">
                      {perk.name}
                    </CardTitle>
                    <CardDescription className="text-slate-200 text-sm">
                      {perk.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="relative z-10 space-y-5">
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2 text-teal-300">
                        <Percent className="h-4 w-4" />
                        <span>{perk.commissionRate ?? "See bonus details"}</span>
                      </div>
                      <div className="flex items-center gap-2 text-rose-300">
                        <DollarSign className="h-4 w-4" />
                        <span>{perk.estimatedEarnings}</span>
                      </div>
                    </div>

                    {highlightCopy[perk.id] ? (
                      <div className="rounded-xl border border-white/10 bg-white/5 p-4 shadow-inner space-y-3">
                        <p className="text-sm text-white/90">
                          {highlightCopy[perk.id].reason}
                        </p>
                        <p className="text-sm font-semibold text-sky-300">
                          {highlightCopy[perk.id].bonus}
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-white/10 bg-white/5 p-4 space-y-2">
                        <p className="text-sm text-white/90">
                          {perk.description}
                        </p>
                        <p className="text-sm font-semibold text-sky-300">
                          {perk.commissionRate
                            ? `T-Perks bonus: ${perk.commissionRate}`
                            : `T-Perks target: ${perk.estimatedEarnings}`}
                        </p>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <Button
                        variant="outline"
                        className="border-white/30 text-white hover:bg-white/10"
                        onClick={() => handleOpenPerk(perk)}
                        data-testid={`view-carousel-perk-${perk.id}`}
                      >
                        Explore Details
                      </Button>
                      {perk.officialLink && (
                        <Button
                          variant="ghost"
                          className="text-sky-300 hover:text-sky-200"
                          onClick={() => window.open(perk.officialLink, "_blank")}
                          data-testid={`visit-carousel-${perk.id}`}
                        >
                          Visit Site
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </CarouselItem>
              
            ))}
          </CarouselContent>
          <CarouselPrevious className="-left-6 bg-white/10 text-white border-white/20 hover:bg-white/20" />
          <CarouselNext className="-right-6 bg-white/10 text-white border-white/20 hover:bg-white/20" />
        </Carousel>
      </div>

      {referralCta}

      {/* Stats Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="bg-emerald-900/30 border-emerald-500/40 shadow-[0_0_30px_rgba(16,185,129,0.25)]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-emerald-300" />
              <div>
                <p className="text-2xl font-bold text-emerald-100">{availableNowCount}</p>
                <p className="text-sm text-emerald-200/80">Available Now</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-amber-900/30 border-amber-500/40 shadow-[0_0_30px_rgba(251,191,36,0.18)]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-amber-200" />
              <div>
                <p className="text-2xl font-bold text-amber-100">{applicationRequiredCount}</p>
                <p className="text-sm text-amber-100/80">Application Required</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-fuchsia-900/30 border-fuchsia-500/40 shadow-[0_0_30px_rgba(217,70,239,0.22)]">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Sparkles className="h-8 w-8 text-fuchsia-200" />
              <div>
                <p className="text-2xl font-bold text-fuchsia-100">{affiliateCount}</p>
                <p className="text-sm text-fuchsia-100/80">Affiliate Programs</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search affiliate programs, tools, or earnings potential..."
            value={searchTerm}
            onChange={(e) => {
              const value = e.target.value;
              setSearchTerm(value);
              if (value.trim().length > 0) {
                trackFeatureUsage("pro_perks", "search", { term: value.trim() });
              }
            }}
            className="pl-10 bg-gray-900/50 border-purple-500/20"
            data-testid="search-perks"
          />
        </div>
      </div>

      {/* Category Filters */}
      <div className="flex flex-wrap gap-2">
        {categories.map((category) => {
          const Icon = category.icon;
          return (
            <Button
              key={category.id}
              variant={activeCategory === category.id ? "default" : "outline"}
              size="sm"
              onClick={() => {
                setActiveCategory(category.id);
                trackFeatureUsage("pro_perks", "filter", { category: category.id });
              }}
              className={activeCategory === category.id 
                ? "bg-gradient-to-r from-purple-500 to-pink-500 border-0"
                : "border-purple-500/30 hover:bg-purple-500/10"
              }
              data-testid={`filter-${category.id}`}
            >
              <Icon className="h-4 w-4 mr-2" />
              {category.label}
            </Button>
          );
        })}
      </div>

      <Card className="bg-slate-950/70 border-white/10">
        <CardContent className="space-y-3 p-6 text-xs text-slate-300">
          <p>ThottoPilot may receive affiliate commissions on certain T-Perks when creators activate partner offers.</p>
          <p><em>Creator-first, never sponsored.</em> None of these vendors approached us first—we scouted them because they help you build faster and smarter, or at the very least live your life happier whether you're on or off the digital clock.</p>
          <p>And as a bonus, many of these expenses potentially qualify to be used as a tax write-off.</p>
          <p>We only fight for perks we genuinely believe will upgrade your workflow and life, on the clock or off.</p>
        </CardContent>
      </Card>

      {/* Perks Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredPerks.map((perk) => (
          <Card 
            key={perk.id} 
            className="bg-gray-900/50 border-purple-500/20 hover:border-purple-500/40 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl group cursor-pointer"
            onClick={() => handleOpenPerk(perk)}
            data-testid={`perk-card-${perk.id}`}
          >
            <CardHeader>
              <div className="flex items-start justify-between mb-3">
                <Badge 
                  className={statusStyles[perk.status].className}
                  data-testid={`status-${perk.id}`}
                >
                  {statusStyles[perk.status].label}
                </Badge>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-purple-500/50 text-purple-300">
                    {categoryMetadata[perk.category].label}
                  </Badge>
                </div>
              </div>
              <CardTitle className="text-xl group-hover:text-purple-300 transition-colors">
                {perk.name}
              </CardTitle>
              <CardDescription className="text-gray-400 text-sm">
                {perk.description}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Commission/Earnings Info */}
              <div className="space-y-2">
                {perk.commissionRate && (
                  <div className="flex items-center gap-2 text-sm">
                    <Percent className="h-4 w-4 text-green-400" />
                    <span className="text-green-400 font-medium">{perk.commissionRate}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign className="h-4 w-4 text-purple-400" />
                  <span className="text-purple-400 font-medium">{perk.estimatedEarnings}</span>
                </div>
              </div>

              {/* Features Preview */}
              <div className="space-y-1">
                {perk.features.slice(0, 2).map((feature, index) => (
                  <div key={index} className="flex items-center gap-2 text-xs text-gray-400">
                    <CheckCircle className="h-3 w-3 text-emerald-400" />
                    {feature}
                  </div>
                ))}
                {perk.features.length > 2 && (
                  <p className="text-xs text-gray-500">+{perk.features.length - 2} more features</p>
                )}
              </div>

              {/* Action Button */}
              <Button 
                className="w-full mt-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenPerk(perk);
                }}
                data-testid={`view-perk-${perk.id}`}
              >
                <Eye className="h-4 w-4 mr-2" />
                View Details
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Perk Detail Modal */}
      <Dialog open={!!selectedPerk} onOpenChange={() => setSelectedPerk(null)}>
        <DialogContent className="max-w-4xl bg-gray-900 border-purple-500/30">
          {selectedPerk && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-4 mb-4">
                  <div className="p-3 bg-purple-500/20 rounded-lg">
                    {React.createElement(categoryMetadata[selectedPerk.category].icon, {
                      className: "h-8 w-8 text-purple-400"
                    })}
                  </div>
                  <div className="flex-1">
                    <DialogTitle className="text-2xl">{selectedPerk.name}</DialogTitle>
                    <DialogDescription className="text-lg mt-1">
                      {selectedPerk.description}
                    </DialogDescription>
                  </div>
                  <Badge className={statusStyles[selectedPerk.status].className}>
                    {statusStyles[selectedPerk.status].label}
                  </Badge>
                </div>
              </DialogHeader>

              <div className="grid md:grid-cols-2 gap-6">
                {/* Left Column - Details */}
                <div className="space-y-6">
                  {/* Commission & Earnings */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-green-400" />
                      Earning Potential
                    </h3>
                    {selectedPerk.commissionRate && (
                      <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                        <p className="text-green-400 font-medium">{selectedPerk.commissionRate}</p>
                      </div>
                    )}
                    <div className="p-3 bg-purple-500/10 border border-purple-500/20 rounded-lg">
                      <p className="text-purple-400 font-medium">{selectedPerk.estimatedEarnings}</p>
                    </div>
                  </div>

                  {/* Features */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <Star className="h-5 w-5 text-yellow-400" />
                      Key Features
                    </h3>
                    <div className="space-y-2">
                      {selectedPerk.features.map((feature, index) => (
                        <div key={index} className="flex items-start gap-3">
                          <CheckCircle className="h-4 w-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                          <span className="text-sm text-gray-300">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Requirements */}
                  {selectedPerk.requirements && selectedPerk.requirements.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="font-semibold text-lg flex items-center gap-2">
                        <Shield className="h-5 w-5 text-blue-400" />
                        Requirements
                      </h3>
                      <div className="space-y-2">
                        {selectedPerk.requirements.map((req, index) => (
                          <div key={index} className="flex items-start gap-3">
                            <Info className="h-4 w-4 text-blue-400 mt-0.5 flex-shrink-0" />
                            <span className="text-sm text-gray-300">{req}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Right Column - Actions */}
                <div className="space-y-6">
                  {/* Signup Instructions */}
                  {instructionsByPerk[selectedPerk.id] && (
                    <div className="space-y-3">
                      <h3 className="font-semibold text-lg flex items-center gap-2">
                        <BookOpen className="h-5 w-5 text-purple-400" />
                        Signup Instructions
                      </h3>
                      <div className="p-4 bg-purple-500/10 border border-purple-500/20 rounded-lg space-y-3">
                        <div>
                          <h4 className="font-medium text-purple-300 mb-2">Steps:</h4>
                          <ol className="list-decimal list-inside space-y-1 text-sm text-gray-300">
                            {instructionsByPerk[selectedPerk.id].steps.map((step, index) => (
                              <li key={index}>{step}</li>
                            ))}
                          </ol>
                        </div>
                        <div>
                          <h4 className="font-medium text-purple-300 mb-2">Timeline:</h4>
                          <p className="text-sm text-gray-300">{instructionsByPerk[selectedPerk.id].timeline}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Referral Code Section */}
                  <div className="space-y-3">
                    <h3 className="font-semibold text-lg flex items-center gap-2">
                      <Users className="h-5 w-5 text-emerald-400" />
                      Your Referral Code
                    </h3>
                    {generateReferralMutation.isPending && generateReferralMutation.variables === selectedPerk.id ? (
                      <div className="p-4 bg-gray-800 border border-gray-700 rounded-lg flex items-center justify-center">
                        <Loader2 className="h-5 w-5 animate-spin text-purple-400 mr-2" />
                        <span className="text-sm text-gray-400">Generating code...</span>
                      </div>
                    ) : referralCodesByPerk[selectedPerk.id] ? (
                      <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg space-y-3">
                        <div className="flex items-center justify-between">
                          <code className="text-emerald-400 font-mono text-lg">
                            {referralCodesByPerk[selectedPerk.id]}
                          </code>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleCopyReferralCode(referralCodesByPerk[selectedPerk.id])}
                            className="border-emerald-500/50 hover:bg-emerald-500/10"
                            data-testid={`copy-referral-code-${selectedPerk.id}`}
                          >
                            <Copy className="h-4 w-4 mr-1" />
                            Copy
                          </Button>
                        </div>
                        <p className="text-xs text-gray-400">
                          Share this code with your audience to earn commissions from referrals.
                        </p>
                      </div>
                    ) : (
                      <Button
                        onClick={() => handleGenerateReferralCode(selectedPerk.id)}
                        className="w-full bg-emerald-600 hover:bg-emerald-700"
                        data-testid={`generate-referral-code-${selectedPerk.id}`}
                      >
                        <RefreshCw className="h-4 w-4 mr-2" />
                        Generate Referral Code
                      </Button>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="space-y-3">
                    {selectedPerk.officialLink && (
                      <Button 
                        className="w-full bg-gradient-to-r from-blue-500 to-cyan-500"
                        onClick={() => window.open(selectedPerk.officialLink, '_blank')}
                        data-testid={`visit-official-${selectedPerk.id}`}
                      >
                        <ExternalLink className="h-4 w-4 mr-2" />
                        Visit Official Site
                      </Button>
                    )}

                    <div className="space-y-2">
                      <Button
                        asChild
                        className="w-full bg-gradient-to-r from-purple-500 to-pink-500"
                        data-testid={`manage-referral-${selectedPerk.id}`}
                      >
                        <Link href="/referral">Manage your referral program</Link>
                      </Button>
                      <p className="text-xs text-gray-400 text-center">
                        Create and share referral codes from your dedicated referral dashboard.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}