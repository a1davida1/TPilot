import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
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
  Clock,
  Search,
  Filter,
  ChevronUp,
  ChevronDown,
  Info,
  CheckCircle,
  XCircle,
  AlertCircle
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

interface RedditCommunity {
  id: string;
  name: string;
  displayName: string;
  members: number;
  engagementRate: number;
  category: 'premium' | 'general' | 'niche' | 'fetish' | 'verification';
  verificationRequired: boolean;
  promotionAllowed: 'yes' | 'limited' | 'no';
  postingLimits: {
    perDay?: number;
    perWeek?: number;
    cooldownHours?: number;
  };
  rules: {
    minKarma?: number;
    minAccountAge?: number;
    watermarksAllowed?: boolean;
    sellingAllowed?: boolean;
  };
  bestPostingTimes: string[];
  averageUpvotes: number;
  description: string;
}

export function RedditCommunities() {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<'members' | 'engagement' | 'upvotes' | 'name'>('engagement');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterPromotion, setFilterPromotion] = useState<string>('all');
  const [filterVerification, setFilterVerification] = useState<string>('all');
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  // Fetch communities data
  const { data: communities = [], isLoading } = useQuery({
    queryKey: ['/api/reddit-communities'],
    queryFn: async () => {
      // In production, this would fetch from the backend
      // For now, using mock data
      const response = await apiRequest('/api/reddit-communities', 'GET');
      return response;
    },
    retry: false
  });

  // Mock data for demonstration (replace with API call)
  const mockCommunities: RedditCommunity[] = [
    {
      id: 'gonewild',
      name: 'r/gonewild',
      displayName: 'Gone Wild',
      members: 3400000,
      engagementRate: 8.5,
      category: 'premium',
      verificationRequired: true,
      promotionAllowed: 'no',
      postingLimits: { perDay: 3, cooldownHours: 8 },
      rules: { minKarma: 100, minAccountAge: 30, watermarksAllowed: false, sellingAllowed: false },
      bestPostingTimes: ['Tue 9PM EST', 'Thu 10PM EST', 'Sat 11PM EST'],
      averageUpvotes: 450,
      description: 'Largest amateur community, strict no selling policy'
    },
    {
      id: 'onlyfansgirls101',
      name: 'r/OnlyFansGirls101',
      displayName: 'OnlyFans Girls 101',
      members: 2100000,
      engagementRate: 6.8,
      category: 'general',
      verificationRequired: false,
      promotionAllowed: 'yes',
      postingLimits: { perDay: 3, cooldownHours: 4 },
      rules: { minKarma: 20, minAccountAge: 7, watermarksAllowed: true, sellingAllowed: true },
      bestPostingTimes: ['Mon 7PM EST', 'Wed 8PM EST', 'Fri 9PM EST'],
      averageUpvotes: 180,
      description: 'Large promotional community for female creators'
    },
    // Add more communities as needed
  ];

  const displayCommunities = communities.length > 0 ? communities : mockCommunities;

  // Filter and sort communities
  const filteredCommunities = useMemo(() => {
    let filtered = [...displayCommunities];

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
          return b.averageUpvotes - a.averageUpvotes;
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
        return <Badge className="bg-green-500/20 text-green-400">Allowed</Badge>;
      case 'limited':
        return <Badge className="bg-yellow-500/20 text-yellow-400">Limited</Badge>;
      case 'no':
        return <Badge className="bg-red-500/20 text-red-400">Not Allowed</Badge>;
      default:
        return null;
    }
  };

  const getCategoryBadge = (category: string) => {
    const colors = {
      premium: 'bg-purple-500/20 text-purple-400',
      general: 'bg-blue-500/20 text-blue-400',
      niche: 'bg-pink-500/20 text-pink-400',
      fetish: 'bg-orange-500/20 text-orange-400',
      verification: 'bg-green-500/20 text-green-400'
    };
    return <Badge className={colors[category as keyof typeof colors] || ''}>{category}</Badge>;
  };

  return (
    <Card className="bg-gray-900/50 backdrop-blur-xl border-purple-500/20">
      <CardHeader>
        <CardTitle className="text-2xl bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
          Reddit Communities Database
        </CardTitle>
        <p className="text-sm text-gray-400">
          50+ communities with engagement metrics, rules, and posting requirements
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Filters and Search */}
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search communities..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-gray-800/50 border-purple-500/20"
            />
          </div>
          
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[180px] bg-gray-800/50 border-purple-500/20">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              <SelectItem value="premium">Premium</SelectItem>
              <SelectItem value="general">General</SelectItem>
              <SelectItem value="niche">Niche</SelectItem>
              <SelectItem value="fetish">Fetish</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterPromotion} onValueChange={setFilterPromotion}>
            <SelectTrigger className="w-[180px] bg-gray-800/50 border-purple-500/20">
              <SelectValue placeholder="Promotion" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Promotion</SelectItem>
              <SelectItem value="yes">Allowed</SelectItem>
              <SelectItem value="limited">Limited</SelectItem>
              <SelectItem value="no">Not Allowed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterVerification} onValueChange={setFilterVerification}>
            <SelectTrigger className="w-[180px] bg-gray-800/50 border-purple-500/20">
              <SelectValue placeholder="Verification" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Verification</SelectItem>
              <SelectItem value="required">Required</SelectItem>
              <SelectItem value="not-required">Not Required</SelectItem>
            </SelectContent>
          </Select>

          <Select value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
            <SelectTrigger className="w-[150px] bg-gray-800/50 border-purple-500/20">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent>
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
                <TableHead className="text-purple-300">Engagement</TableHead>
                <TableHead className="text-purple-300">Category</TableHead>
                <TableHead className="text-purple-300">Verification</TableHead>
                <TableHead className="text-purple-300">Promotion</TableHead>
                <TableHead className="text-purple-300">Posting Limits</TableHead>
                <TableHead className="text-purple-300">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCommunities.map((community) => (
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
                        {community.postingLimits.perDay && `${community.postingLimits.perDay}/day`}
                        {community.postingLimits.cooldownHours && ` (${community.postingLimits.cooldownHours}h cooldown)`}
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
                          
                          <div className="grid md:grid-cols-3 gap-4">
                            <div>
                              <h4 className="text-sm font-semibold text-purple-300 mb-2">Requirements</h4>
                              <div className="space-y-1 text-xs text-gray-400">
                                {community.rules.minKarma && <p>• Min Karma: {community.rules.minKarma}</p>}
                                {community.rules.minAccountAge && <p>• Min Account Age: {community.rules.minAccountAge} days</p>}
                                <p>• Watermarks: {community.rules.watermarksAllowed ? '✓ Allowed' : '✗ Not Allowed'}</p>
                                <p>• Selling: {community.rules.sellingAllowed ? '✓ Allowed' : '✗ Not Allowed'}</p>
                              </div>
                            </div>
                            
                            <div>
                              <h4 className="text-sm font-semibold text-purple-300 mb-2">Best Posting Times</h4>
                              <div className="space-y-1 text-xs text-gray-400">
                                {community.bestPostingTimes.map((time, idx) => (
                                  <p key={idx}>• {time}</p>
                                ))}
                              </div>
                            </div>
                            
                            <div>
                              <h4 className="text-sm font-semibold text-purple-300 mb-2">Performance</h4>
                              <div className="space-y-1 text-xs text-gray-400">
                                <p>• Avg Upvotes: {community.averageUpvotes}</p>
                                <p>• Engagement Rate: {community.engagementRate}%</p>
                                <p>• Total Members: {community.members.toLocaleString()}</p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </React.Fragment>
              ))}
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
                    {(filteredCommunities.reduce((acc, c) => acc + c.engagementRate, 0) / filteredCommunities.length || 0).toFixed(1)}%
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