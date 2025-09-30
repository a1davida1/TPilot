import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, Hash, Sparkles, Copy, Check, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';

interface TrendingTag {
  tag: string;
  posts: number;
  growth: string;
  subreddit: string;
  heat: 'hot' | 'warm' | 'rising' | 'stable';
  category: string;
  rank: number;
}

export function TrendingTags() {
  const [copiedTag, setCopiedTag] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [timeRange, setTimeRange] = useState("24h");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const { toast } = useToast();

  // Fetch real trending tags from API
  const { data: trendingData, isLoading } = useQuery({
    queryKey: ['trending-tags', timeRange, categoryFilter],
    queryFn: async () => {
      const response = await fetch(`/api/trending-tags?timeRange=${timeRange}&category=${categoryFilter}`, {
        credentials: 'include'
      });
      if (!response.ok) {
        throw new Error('Failed to fetch trending tags');
      }
      return response.json();
    }
  });

  const lastUpdateTime = trendingData?.lastUpdated ? 
    new Date(trendingData.lastUpdated).toLocaleString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    }) : 'Never';

  const allTrendingTags: TrendingTag[] = trendingData?.tags || [];

  // Filter tags based on search and category
  const filteredTags = allTrendingTags.filter(item => {
    const matchesSearch = searchTerm === "" || 
      item.tag.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.subreddit.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = categoryFilter === "all" || item.category === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });

  // Get unique categories for filter
  const categories = Array.from(new Set(allTrendingTags.map(t => t.category))).sort();

  const avgGrowth =
    filteredTags.length > 0
      ? (filteredTags.reduce((sum, t) => sum + parseFloat(t.growth), 0) / filteredTags.length).toFixed(1) + '%'
      : 'N/A';

  const copyTag = async (tag: string) => {
    try {
      await navigator.clipboard.writeText(`#${tag}`);
      setCopiedTag(tag);
      setTimeout(() => setCopiedTag(null), 2000);
      toast({
        title: "Tag copied!",
        description: `"#${tag}" copied to clipboard`
      });
    } catch (_error) {
      toast({
        title: "Failed to copy",
        variant: "destructive"
      });
    }
  };

  const getHeatColor = (heat: string) => {
    switch(heat) {
      case 'hot': return 'text-red-400 bg-red-400/10 border-red-400/20';
      case 'warm': return 'text-orange-400 bg-orange-400/10 border-orange-400/20';
      case 'rising': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20';
      case 'stable': return 'text-blue-400 bg-blue-400/10 border-blue-400/20';
      default: return 'text-gray-400';
    }
  };

  return (
    <Card className="bg-gray-900/50 backdrop-blur-xl border-white/10">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-purple-400" />
          Trending Tags
        </CardTitle>
        <CardDescription>
          Most engaging tags in the last 24 hours
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Search and Filter Controls */}
        <div className="flex flex-col lg:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-gray-900/50 border-white/10"
            />
          </div>
          
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger variant="overlay" className="w-[180px]">
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map(cat => (
                <SelectItem key={cat} value={cat}>
                  {cat.charAt(0).toUpperCase() + cat.slice(1)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger variant="overlay" className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="24h">Last 24h</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="p-3 bg-purple-900/20 rounded-lg border border-purple-500/20">
            <p className="text-xs text-gray-400">Total Tags</p>
            <p className="text-xl font-bold">{filteredTags.length}</p>
          </div>
          <div className="p-3 bg-orange-900/20 rounded-lg border border-orange-500/20">
            <p className="text-xs text-gray-400">Hot Trending</p>
            <p className="text-xl font-bold">{filteredTags.filter(t => t.heat === 'hot').length}</p>
          </div>
          <div className="p-3 bg-green-900/20 rounded-lg border border-green-500/20">
            <p className="text-xs text-gray-400">Avg Growth</p>
            <p className="text-xl font-bold">{avgGrowth}</p>
          </div>
        </div>

        {/* Tags List */}
        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
          {filteredTags.map((item) => (
            <div 
              key={item.tag}
              className="group p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-all cursor-pointer"
              onClick={() => copyTag(item.tag)}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Hash className="h-4 w-4 text-gray-500" />
                  <span className="font-medium">{item.tag}</span>
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${getHeatColor(item.heat)}`}
                  >
                    {item.heat}
                  </Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {item.growth}
                  </Badge>
                  {copiedTag === item.tag ? (
                    <Check className="h-4 w-4 text-green-400" />
                  ) : (
                    <Copy className="h-4 w-4 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </div>
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{item.subreddit}</span>
                <span>{item.posts.toLocaleString()} posts</span>
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-4 pt-4 border-t border-white/10">
          <p className="text-xs text-gray-400 flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
            Updates every hour based on Reddit engagement
          </p>
        </div>
      </CardContent>
    </Card>
  );
}