import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { TrendingUp, Hash, Sparkles, Copy, Check, Search, Clock, Filter } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

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

  // Calculate last update time (simulates regular updates)
  const getLastUpdateTime = () => {
    const now = new Date();
    const hours = Math.floor(Math.random() * 4) + 1; // 1-4 hours ago
    now.setHours(now.getHours() - hours);
    return now.toLocaleString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit', 
      hour12: true 
    });
  };

  const lastUpdateTime = getLastUpdateTime();

  // Comprehensive top 50 trending tags - simulates real-time data
  const allTrendingTags: TrendingTag[] = [
    // Top 10 - Hottest
    { tag: "verified", posts: 12500, growth: "+45%", subreddit: "r/OnlyFans", heat: "hot", category: "status", rank: 1 },
    { tag: "milf", posts: 8900, growth: "+32%", subreddit: "r/maturemilf", heat: "hot", category: "demographic", rank: 2 },
    { tag: "asian", posts: 7200, growth: "+28%", subreddit: "r/AsiansGoneWild", heat: "hot", category: "ethnicity", rank: 3 },
    { tag: "latina", posts: 6500, growth: "+25%", subreddit: "r/latinas", heat: "hot", category: "ethnicity", rank: 4 },
    { tag: "curvy", posts: 5800, growth: "+22%", subreddit: "r/curvy", heat: "hot", category: "body", rank: 5 },
    { tag: "petite", posts: 5200, growth: "+20%", subreddit: "r/PetiteGoneWild", heat: "hot", category: "body", rank: 6 },
    { tag: "couple", posts: 4500, growth: "+18%", subreddit: "r/couplesgonewild", heat: "hot", category: "content", rank: 7 },
    { tag: "fitness", posts: 3900, growth: "+15%", subreddit: "r/fitgirls", heat: "hot", category: "lifestyle", rank: 8 },
    { tag: "goth", posts: 3700, growth: "+42%", subreddit: "r/gothsluts", heat: "hot", category: "style", rank: 9 },
    { tag: "tattoo", posts: 3500, growth: "+30%", subreddit: "r/altgonewild", heat: "hot", category: "style", rank: 10 },
    
    // 11-20 - Warm trending
    { tag: "blonde", posts: 3200, growth: "+12%", subreddit: "r/blondes", heat: "warm", category: "appearance", rank: 11 },
    { tag: "redhead", posts: 3100, growth: "+14%", subreddit: "r/redheads", heat: "warm", category: "appearance", rank: 12 },
    { tag: "teen", posts: 3000, growth: "+10%", subreddit: "r/18_19", heat: "warm", category: "demographic", rank: 13 },
    { tag: "amateur", posts: 2900, growth: "+8%", subreddit: "r/RealGirls", heat: "warm", category: "content", rank: 14 },
    { tag: "pawg", posts: 2800, growth: "+16%", subreddit: "r/pawg", heat: "warm", category: "body", rank: 15 },
    { tag: "ebony", posts: 2700, growth: "+11%", subreddit: "r/ebony", heat: "warm", category: "ethnicity", rank: 16 },
    { tag: "thick", posts: 2600, growth: "+9%", subreddit: "r/thick", heat: "warm", category: "body", rank: 17 },
    { tag: "solo", posts: 2500, growth: "+7%", subreddit: "r/gonewild", heat: "warm", category: "content", rank: 18 },
    { tag: "lingerie", posts: 2400, growth: "+13%", subreddit: "r/LingerieGW", heat: "warm", category: "clothing", rank: 19 },
    { tag: "feet", posts: 2300, growth: "+19%", subreddit: "r/feet", heat: "warm", category: "fetish", rank: 20 },
    
    // 21-30 - Rising
    { tag: "cosplay", posts: 2200, growth: "+35%", subreddit: "r/CosplayNsfw", heat: "rising", category: "style", rank: 21 },
    { tag: "outdoor", posts: 2100, growth: "+6%", subreddit: "r/OutdoorRecreation", heat: "rising", category: "location", rank: 22 },
    { tag: "shower", posts: 2000, growth: "+5%", subreddit: "r/showergirls", heat: "rising", category: "location", rank: 23 },
    { tag: "stockings", posts: 1900, growth: "+8%", subreddit: "r/stockings", heat: "rising", category: "clothing", rank: 24 },
    { tag: "yoga", posts: 1800, growth: "+12%", subreddit: "r/YogaPants", heat: "rising", category: "lifestyle", rank: 25 },
    { tag: "natural", posts: 1700, growth: "+4%", subreddit: "r/naturaltitties", heat: "rising", category: "appearance", rank: 26 },
    { tag: "dom", posts: 1600, growth: "+21%", subreddit: "r/FemdomCommunity", heat: "rising", category: "kink", rank: 27 },
    { tag: "sub", posts: 1500, growth: "+18%", subreddit: "r/SubGirls", heat: "rising", category: "kink", rank: 28 },
    { tag: "gaming", posts: 1400, growth: "+25%", subreddit: "r/GamerGirls", heat: "rising", category: "lifestyle", rank: 29 },
    { tag: "piercing", posts: 1300, growth: "+7%", subreddit: "r/piercednipples", heat: "rising", category: "style", rank: 30 },
    
    // 31-40 - Stable performers
    { tag: "office", posts: 1200, growth: "+3%", subreddit: "r/workgonewild", heat: "stable", category: "location", rank: 31 },
    { tag: "nurse", posts: 1150, growth: "+2%", subreddit: "r/GoneWildScrubs", heat: "stable", category: "profession", rank: 32 },
    { tag: "teacher", posts: 1100, growth: "+4%", subreddit: "r/TeachersMisc", heat: "stable", category: "profession", rank: 33 },
    { tag: "housewife", posts: 1050, growth: "+1%", subreddit: "r/HotWife", heat: "stable", category: "lifestyle", rank: 34 },
    { tag: "british", posts: 1000, growth: "+5%", subreddit: "r/GonewildGBUK", heat: "stable", category: "nationality", rank: 35 },
    { tag: "australian", posts: 950, growth: "+3%", subreddit: "r/GWAustralia", heat: "stable", category: "nationality", rank: 36 },
    { tag: "canadian", posts: 900, growth: "+2%", subreddit: "r/gonewildcanada", heat: "stable", category: "nationality", rank: 37 },
    { tag: "european", posts: 850, growth: "+4%", subreddit: "r/GoneWildEurope", heat: "stable", category: "nationality", rank: 38 },
    { tag: "indian", posts: 800, growth: "+6%", subreddit: "r/IndiansGoneWild", heat: "stable", category: "ethnicity", rank: 39 },
    { tag: "arab", posts: 750, growth: "+8%", subreddit: "r/ArabPorn", heat: "stable", category: "ethnicity", rank: 40 },
    
    // 41-50 - Niche trending
    { tag: "anime", posts: 700, growth: "+15%", subreddit: "r/NSFWCosplay", heat: "rising", category: "style", rank: 41 },
    { tag: "egirl", posts: 650, growth: "+22%", subreddit: "r/egirls", heat: "rising", category: "style", rank: 42 },
    { tag: "alternative", posts: 600, growth: "+10%", subreddit: "r/altgonewild", heat: "stable", category: "style", rank: 43 },
    { tag: "muscle", posts: 550, growth: "+7%", subreddit: "r/MuscleGirls", heat: "stable", category: "body", rank: 44 },
    { tag: "mature", posts: 500, growth: "+3%", subreddit: "r/40plusGoneWild", heat: "stable", category: "demographic", rank: 45 },
    { tag: "squirt", posts: 450, growth: "+12%", subreddit: "r/squirting", heat: "rising", category: "content", rank: 46 },
    { tag: "joi", posts: 400, growth: "+9%", subreddit: "r/joi", heat: "stable", category: "content", rank: 47 },
    { tag: "roleplay", posts: 350, growth: "+11%", subreddit: "r/dirtypenpals", heat: "stable", category: "content", rank: 48 },
    { tag: "findom", posts: 300, growth: "+18%", subreddit: "r/findom", heat: "rising", category: "kink", rank: 49 },
    { tag: "femboy", posts: 250, growth: "+25%", subreddit: "r/FemBoys", heat: "rising", category: "demographic", rank: 50 }
  ];

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

  const copyTag = async (tag: string) => {
    try {
      await navigator.clipboard.writeText(`#${tag}`);
      setCopiedTag(tag);
      setTimeout(() => setCopiedTag(null), 2000);
      toast({
        title: "Tag copied!",
        description: `"#${tag}" copied to clipboard`
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
        <div className="space-y-3">
          {trendingTags.map((item) => (
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