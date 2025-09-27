import React, { useState, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { 
  Gift,
  Search,
  Sparkles,
  CheckCircle,
  Users,
  TrendingUp,
  ExternalLink,
  Shield,
  Copy,
  Filter,
  Award,
  Clock,
  Bookmark,
  Eye,
  PlayCircle,
  ChevronRight,
  Info,
  Calendar,
  Zap,
  Loader2,
  Coins,
  Globe,
  FileText,
  BookOpen,
  Tag,
  Percent,
  Download,
  Star,
  DollarSign,
  Lock,
  Calculator,
  Heart
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { LucideIcon } from "lucide-react";

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

export function ProPerks({ userTier = "pro" }: ProPerksProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeCategory, setActiveCategory] = useState<CategoryFilter>("all");
  const [selectedPerk, setSelectedPerk] = useState<ProPerk | null>(null);
  const [instructionsByPerk, setInstructionsByPerk] = useState<Record<string, SignupInstructions>>({});
  const [referralCodes, setReferralCodes] = useState<Record<string, string>>({});
  const [instructionsLoading, setInstructionsLoading] = useState<string | null>(null);
  const [referralLoading, setReferralLoading] = useState<string | null>(null);
  const { toast } = useToast();

  const sessionFetch = useCallback(
    async (input: RequestInfo | URL, init?: RequestInit) => {
      const response = await fetch(input, { ...init, credentials: "include" });
      return response;
    },
    []
  );

  // Fetch real resources from API
  const { data, isLoading, isError } = useQuery<ProResourcesResult>({
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
    } catch (error) {
      toast({
        title: "Unable to load instructions",
        description: error instanceof Error ? error.message : "Unexpected error loading perk guidance.",
        variant: "destructive"
      });
    } finally {
      setInstructionsLoading(null);
    }
  }, [instructionsByPerk, sessionFetch, toast]);

  const handleOpenPerk = useCallback((perk: ProPerk) => {
    setSelectedPerk(perk);
    void ensureInstructions(perk);
  }, [ensureInstructions]);

  const handleGenerateReferral = useCallback(async (perk: ProPerk) => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      setReferralLoading(perk.id);
      const response = await sessionFetch(`/api/pro-resources/${perk.id}/referral-code`, {
        method: "POST"
      });

      if (response.status === 401 || response.status === 403) {
        toast({
          title: "Sign in required",
          description: "Log in with your Pro account to generate referral codes.",
          variant: "destructive"
        });
        return;
      }

      if (!response.ok) {
        throw new Error("Failed to generate referral code");
      }

      const payload = await response.json() as { referralCode: string };
      setReferralCodes((previous) => ({
        ...previous,
        [perk.id]: payload.referralCode
      }));

      if (window.navigator && window.navigator.clipboard) {
        await window.navigator.clipboard.writeText(payload.referralCode);
        toast({
          title: "Referral Code Generated",
          description: `Code "${payload.referralCode}" copied to clipboard!`,
        });
      } else {
        toast({
          title: "Referral Code Generated",
          description: `Your code: ${payload.referralCode}`,
        });
      }
    } catch (error) {
      toast({
        title: "Unable to generate referral",
        description: error instanceof Error ? error.message : "Unexpected error generating referral code.",
        variant: "destructive"
      });
    } finally {
      setReferralLoading(null);
    }
  }, [sessionFetch, toast]);

  // Show empty state when no resources available or no access
  if (!isLoading && (!hasAccess || perks.length === 0)) {
    return (
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
        </CardContent>
      </Card>
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
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-br from-purple-900/20 to-pink-900/20 border-purple-500/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-3xl bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
                Pro Perks Library
              </CardTitle>
              <CardDescription className="text-gray-300 mt-2">
                Exclusive affiliate programs, tools, and monetization opportunities for creators
              </CardDescription>
            </div>
            <div className="text-right">
              <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0">
                PRO MEMBER
              </Badge>
              <p className="text-sm text-gray-400 mt-2">
                {perks.length} perks • {affiliateCount} affiliate programs
              </p>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Stats Cards */}
      <div className="grid md:grid-cols-3 gap-4">
        <Card className="bg-emerald-900/20 border-emerald-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-8 w-8 text-emerald-400" />
              <div>
                <p className="text-2xl font-bold text-emerald-400">{availableNowCount}</p>
                <p className="text-sm text-gray-400">Available Now</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-yellow-900/20 border-yellow-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Clock className="h-8 w-8 text-yellow-400" />
              <div>
                <p className="text-2xl font-bold text-yellow-400">{applicationRequiredCount}</p>
                <p className="text-sm text-gray-400">Application Required</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-purple-900/20 border-purple-500/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Sparkles className="h-8 w-8 text-purple-400" />
              <div>
                <p className="text-2xl font-bold text-purple-400">{affiliateCount}</p>
                <p className="text-sm text-gray-400">Affiliate Programs</p>
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
            onChange={(e) => setSearchTerm(e.target.value)}
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
              onClick={() => setActiveCategory(category.id)}
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

                    <Button 
                      className="w-full bg-gradient-to-r from-purple-500 to-pink-500"
                      onClick={() => handleGenerateReferral(selectedPerk)}
                      disabled={referralLoading === selectedPerk.id}
                      data-testid={`generate-referral-${selectedPerk.id}`}
                    >
                      {referralLoading === selectedPerk.id ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-2" />
                          Generate Referral Code
                        </>
                      )}
                    </Button>

                    {referralCodes[selectedPerk.id] && (
                      <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                        <p className="text-green-400 font-mono text-sm text-center">
                          {referralCodes[selectedPerk.id]}
                        </p>
                      </div>
                    )}
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