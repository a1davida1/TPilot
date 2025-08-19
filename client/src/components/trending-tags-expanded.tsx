import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, 
  Hash, 
  Sparkles, 
  Copy, 
  Check,
  Search,
  Filter,
  Clock,
  Zap,
  BarChart3,
  RefreshCw,
  ArrowUp,
  ArrowDown
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface TrendingTag {
  rank: number;
  tag: string;
  posts: number;
  growth: string;
  growthValue: number;
  engagement: number;
  platforms: string[];
  category: string;
  heat: 'explosive' | 'hot' | 'warm' | 'rising' | 'stable';
  peakTime: string;
  description?: string;
}

export function TrendingTagsExpanded() {
  const [copiedTag, setCopiedTag] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [timeRange, setTimeRange] = useState<'1h' | '24h' | '7d' | '30d'>('24h');
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);
  const { toast } = useToast();

  // Comprehensive trending tags data - Top 50
  const generateTrendingData = (): TrendingTag[] => {
    const baseData = [
      { tag: "verified", posts: 28500, growth: 68, engagement: 94, category: "status", platforms: ["Reddit", "OnlyFans", "Twitter"] },
      { tag: "milf", posts: 24200, growth: 45, engagement: 89, category: "demographic", platforms: ["Reddit", "OnlyFans"] },
      { tag: "asian", posts: 21800, growth: 42, engagement: 87, category: "ethnicity", platforms: ["Reddit", "Twitter", "Instagram"] },
      { tag: "curvy", posts: 19500, growth: 38, engagement: 85, category: "body type", platforms: ["Reddit", "OnlyFans"] },
      { tag: "petite", posts: 18900, growth: 35, engagement: 83, category: "body type", platforms: ["Reddit", "Twitter"] },
      { tag: "latina", posts: 17200, growth: 32, engagement: 82, category: "ethnicity", platforms: ["Reddit", "OnlyFans"] },
      { tag: "cosplay", posts: 16800, growth: 30, engagement: 81, category: "niche", platforms: ["Reddit", "Twitter", "TikTok"] },
      { tag: "goth", posts: 15500, growth: 28, engagement: 79, category: "style", platforms: ["Reddit", "OnlyFans"] },
      { tag: "couple", posts: 14900, growth: 26, engagement: 78, category: "content type", platforms: ["Reddit", "OnlyFans"] },
      { tag: "fitness", posts: 14200, growth: 24, engagement: 77, category: "lifestyle", platforms: ["Reddit", "Instagram"] },
      { tag: "tattoo", posts: 13800, growth: 22, engagement: 76, category: "style", platforms: ["Reddit", "Instagram"] },
      { tag: "natural", posts: 13200, growth: 20, engagement: 75, category: "style", platforms: ["Reddit", "OnlyFans"] },
      { tag: "blonde", posts: 12800, growth: 18, engagement: 74, category: "appearance", platforms: ["Reddit", "OnlyFans"] },
      { tag: "brunette", posts: 12400, growth: 16, engagement: 73, category: "appearance", platforms: ["Reddit", "OnlyFans"] },
      { tag: "redhead", posts: 11900, growth: 14, engagement: 72, category: "appearance", platforms: ["Reddit", "OnlyFans"] },
      { tag: "bbw", posts: 11500, growth: 12, engagement: 71, category: "body type", platforms: ["Reddit", "OnlyFans"] },
      { tag: "amateur", posts: 11200, growth: 10, engagement: 70, category: "content type", platforms: ["Reddit"] },
      { tag: "feet", posts: 10800, growth: 8, engagement: 69, category: "niche", platforms: ["Reddit", "OnlyFans"] },
      { tag: "bdsm", posts: 10400, growth: 6, engagement: 68, category: "niche", platforms: ["Reddit", "OnlyFans"] },
      { tag: "trans", posts: 10100, growth: 4, engagement: 67, category: "demographic", platforms: ["Reddit", "Twitter"] },
      { tag: "ebony", posts: 9800, growth: 2, engagement: 66, category: "ethnicity", platforms: ["Reddit", "OnlyFans"] },
      { tag: "lingerie", posts: 9500, growth: 0, engagement: 65, category: "content type", platforms: ["Reddit", "Instagram"] },
      { tag: "yoga", posts: 9200, growth: -2, engagement: 64, category: "lifestyle", platforms: ["Reddit", "Instagram"] },
      { tag: "gaming", posts: 8900, growth: -4, engagement: 63, category: "niche", platforms: ["Reddit", "Twitch"] },
      { tag: "teacher", posts: 8600, growth: 52, engagement: 88, category: "roleplay", platforms: ["Reddit", "OnlyFans"] },
      { tag: "nurse", posts: 8300, growth: 48, engagement: 86, category: "roleplay", platforms: ["Reddit", "OnlyFans"] },
      { tag: "mommy", posts: 8000, growth: 44, engagement: 84, category: "roleplay", platforms: ["Reddit", "OnlyFans"] },
      { tag: "student", posts: 7700, growth: 40, engagement: 82, category: "roleplay", platforms: ["Reddit", "OnlyFans"] },
      { tag: "office", posts: 7400, growth: 36, engagement: 80, category: "roleplay", platforms: ["Reddit", "OnlyFans"] },
      { tag: "outdoor", posts: 7100, growth: 32, engagement: 78, category: "location", platforms: ["Reddit", "OnlyFans"] },
      { tag: "shower", posts: 6800, growth: 28, engagement: 76, category: "location", platforms: ["Reddit", "OnlyFans"] },
      { tag: "beach", posts: 6500, growth: 24, engagement: 74, category: "location", platforms: ["Reddit", "Instagram"] },
      { tag: "gym", posts: 6200, growth: 20, engagement: 72, category: "location", platforms: ["Reddit", "Instagram"] },
      { tag: "car", posts: 5900, growth: 16, engagement: 70, category: "location", platforms: ["Reddit", "OnlyFans"] },
      { tag: "kitchen", posts: 5600, growth: 12, engagement: 68, category: "location", platforms: ["Reddit", "OnlyFans"] },
      { tag: "pool", posts: 5300, growth: 8, engagement: 66, category: "location", platforms: ["Reddit", "Instagram"] },
      { tag: "halloween", posts: 5000, growth: 65, engagement: 92, category: "seasonal", platforms: ["Reddit", "Instagram", "TikTok"] },
      { tag: "christmas", posts: 4700, growth: 4, engagement: 62, category: "seasonal", platforms: ["Reddit", "Instagram"] },
      { tag: "valentine", posts: 4400, growth: 0, engagement: 60, category: "seasonal", platforms: ["Reddit", "Instagram"] },
      { tag: "summer", posts: 4100, growth: -4, engagement: 58, category: "seasonal", platforms: ["Reddit", "Instagram"] },
      { tag: "18plus", posts: 3800, growth: 55, engagement: 90, category: "age", platforms: ["Reddit", "Twitter"] },
      { tag: "mature", posts: 3500, growth: 50, engagement: 88, category: "age", platforms: ["Reddit", "OnlyFans"] },
      { tag: "young", posts: 3200, growth: 45, engagement: 86, category: "age", platforms: ["Reddit", "OnlyFans"] },
      { tag: "hotwife", posts: 2900, growth: 40, engagement: 84, category: "lifestyle", platforms: ["Reddit", "OnlyFans"] },
      { tag: "cuckold", posts: 2600, growth: 35, engagement: 82, category: "lifestyle", platforms: ["Reddit", "OnlyFans"] },
      { tag: "swinger", posts: 2300, growth: 30, engagement: 80, category: "lifestyle", platforms: ["Reddit", "OnlyFans"] },
      { tag: "kinky", posts: 2000, growth: 25, engagement: 78, category: "style", platforms: ["Reddit", "OnlyFans"] },
      { tag: "submissive", posts: 1700, growth: 20, engagement: 76, category: "style", platforms: ["Reddit", "OnlyFans"] },
      { tag: "dominant", posts: 1400, growth: 15, engagement: 74, category: "style", platforms: ["Reddit", "OnlyFans"] },
      { tag: "custom", posts: 1100, growth: 10, engagement: 72, category: "service", platforms: ["OnlyFans"] }
    ];

    return baseData.map((item, index) => ({
      rank: index + 1,
      tag: item.tag,
      posts: item.posts,
      growth: `${item.growth > 0 ? '+' : ''}${item.growth}%`,
      growthValue: item.growth,
      engagement: item.engagement,
      platforms: item.platforms,
      category: item.category,
      heat: getHeatLevel(item.growth),
      peakTime: getPeakTime(index),
      description: getTagDescription(item.tag)
    }));
  };

  const getHeatLevel = (growth: number): TrendingTag['heat'] => {
    if (growth > 50) return 'explosive';
    if (growth > 30) return 'hot';
    if (growth > 15) return 'warm';
    if (growth > 0) return 'rising';
    return 'stable';
  };

  const getPeakTime = (index: number): string => {
    const times = ['2-4 PM EST', '8-10 PM EST', '11 PM-1 AM EST', '6-8 AM EST', '12-2 PM EST'];
    return times[index % times.length];
  };

  const getTagDescription = (tag: string): string => {
    const descriptions: { [key: string]: string } = {
      'verified': 'Verified creator badge increases trust and engagement',
      'milf': 'Mature content with high engagement rates',
      'cosplay': 'Character-based content with creative themes',
      'goth': 'Alternative style with dedicated following',
      'fitness': 'Health and wellness focused content'
    };
    return descriptions[tag] || '';
  };

  const [trendingTags, setTrendingTags] = useState<TrendingTag[]>(generateTrendingData());

  useEffect(() => {
    // Simulate real-time updates
    const interval = setInterval(() => {
      setLastUpdated(new Date());
      setTrendingTags(generateTrendingData());
    }, 300000); // Update every 5 minutes

    return () => clearInterval(interval);
  }, []);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setTrendingTags(generateTrendingData());
      setLastUpdated(new Date());
      setIsRefreshing(false);
      toast({
        title: "Tags refreshed",
        description: "Trending data has been updated"
      });
    }, 1000);
  };

  const copyTag = async (tag: string) => {
    try {
      await navigator.clipboard.writeText(`#${tag}`);
      setCopiedTag(tag);
      setTimeout(() => setCopiedTag(null), 2000);
      toast({
        title: "Tag copied!",
        description: `#${tag} copied to clipboard`
      });
    } catch (error) {
      toast({
        title: "Failed to copy",
        variant: "destructive"
      });
    }
  };

  const getHeatColor = (heat: string) => {
    switch(heat) {
      case 'explosive': return 'text-purple-400 bg-purple-400/10 border-purple-400/20';
      case 'hot': return 'text-red-400 bg-red-400/10 border-red-400/20';
      case 'warm': return 'text-orange-400 bg-orange-400/10 border-orange-400/20';
      case 'rising': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      case 'stable': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      default: return 'text-gray-400';
    }
  };

  const getGrowthIcon = (growth: number) => {
    if (growth > 0) return <ArrowUp className="h-3 w-3 text-green-400" />;
    if (growth < 0) return <ArrowDown className="h-3 w-3 text-red-400" />;
    return null;
  };

  // Filter logic
  const filteredTags = trendingTags.filter(tag => {
    const matchesSearch = tag.tag.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || tag.category === categoryFilter;
    const matchesPlatform = platformFilter === 'all' || tag.platforms.includes(platformFilter);
    return matchesSearch && matchesCategory && matchesPlatform;
  });

  const categories = ['all', ...Array.from(new Set(trendingTags.map(t => t.category)))];
  const platforms = ['all', 'Reddit', 'OnlyFans', 'Twitter', 'Instagram', 'TikTok'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="bg-gradient-to-br from-purple-900/20 to-pink-900/20 border-purple-500/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl flex items-center gap-2">
                <TrendingUp className="h-6 w-6 text-purple-400" />
                Top 50 Trending Tags
              </CardTitle>
              <CardDescription className="text-gray-300 mt-1">
                Real-time hashtag performance across all platforms
              </CardDescription>
            </div>
            <div className="text-right">
              <Button
                size="sm"
                variant="outline"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="border-purple-500/30"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <p className="text-xs text-gray-400 mt-2 flex items-center justify-end gap-1">
                <Clock className="h-3 w-3" />
                Updated {lastUpdated.toLocaleTimeString()}
              </p>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search tags..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-gray-900/50 border-purple-500/20"
          />
        </div>
        
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px] bg-gray-900/50 border-purple-500/20">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            {categories.map(cat => (
              <SelectItem key={cat} value={cat}>
                {cat.charAt(0).toUpperCase() + cat.slice(1)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={platformFilter} onValueChange={setPlatformFilter}>
          <SelectTrigger className="w-[180px] bg-gray-900/50 border-purple-500/20">
            <SelectValue placeholder="Platform" />
          </SelectTrigger>
          <SelectContent>
            {platforms.map(platform => (
              <SelectItem key={platform} value={platform}>
                {platform}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={timeRange} onValueChange={(v) => setTimeRange(v as any)}>
          <SelectTrigger className="w-[140px] bg-gray-900/50 border-purple-500/20">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="1h">Last Hour</SelectItem>
            <SelectItem value="24h">Last 24h</SelectItem>
            <SelectItem value="7d">Last 7 Days</SelectItem>
            <SelectItem value="30d">Last 30 Days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats Cards */}
      <div className="grid md:grid-cols-4 gap-4">
        <Card className="bg-gray-900/50 border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400">Total Volume</p>
                <p className="text-2xl font-bold">482.3K</p>
                <p className="text-xs text-green-400">+23% from yesterday</p>
              </div>
              <BarChart3 className="h-8 w-8 text-purple-400/50" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gray-900/50 border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400">Avg Engagement</p>
                <p className="text-2xl font-bold">76.8%</p>
                <p className="text-xs text-green-400">+5.2% increase</p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-400/50" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gray-900/50 border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400">Hot Tags</p>
                <p className="text-2xl font-bold">12</p>
                <p className="text-xs text-orange-400">Above 30% growth</p>
              </div>
              <Zap className="h-8 w-8 text-orange-400/50" />
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gray-900/50 border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400">New Trending</p>
                <p className="text-2xl font-bold">8</p>
                <p className="text-xs text-purple-400">Since last hour</p>
              </div>
              <Sparkles className="h-8 w-8 text-purple-400/50" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tags List */}
      <Card className="bg-gray-900/50 border-purple-500/20">
        <CardContent className="p-6">
          <div className="space-y-2">
            {filteredTags.map((item) => (
              <div 
                key={item.tag}
                className="group p-4 bg-white/5 rounded-lg hover:bg-white/10 transition-all cursor-pointer"
                onClick={() => copyTag(item.tag)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="text-2xl font-bold text-gray-500">
                      #{item.rank}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <Hash className="h-4 w-4 text-purple-400" />
                        <span className="font-semibold text-lg">{item.tag}</span>
                        <Badge 
                          variant="outline" 
                          className={`text-xs ${getHeatColor(item.heat)}`}
                        >
                          {item.heat}
                        </Badge>
                        {item.platforms.map(platform => (
                          <Badge key={platform} variant="secondary" className="text-xs">
                            {platform}
                          </Badge>
                        ))}
                      </div>
                      {item.description && (
                        <p className="text-xs text-gray-400 mt-1">{item.description}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                        <span>{item.posts.toLocaleString()} posts</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          {getGrowthIcon(item.growthValue)}
                          {item.growth} growth
                        </span>
                        <span>•</span>
                        <span>{item.engagement}% engagement</span>
                        <span>•</span>
                        <span>Peak: {item.peakTime}</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {item.category}
                    </Badge>
                    {copiedTag === item.tag ? (
                      <Check className="h-5 w-5 text-green-400" />
                    ) : (
                      <Copy className="h-5 w-5 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {filteredTags.length === 0 && (
            <div className="text-center py-12 text-gray-400">
              <Hash className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No tags found matching your filters</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Footer */}
      <Card className="bg-gray-900/50 border-purple-500/20">
        <CardContent className="p-4">
          <p className="text-xs text-gray-400 flex items-center gap-2">
            <Sparkles className="h-3 w-3" />
            Data aggregated from Reddit, Twitter, Instagram, OnlyFans, and TikTok engagement metrics
          </p>
        </CardContent>
      </Card>
    </div>
  );
}