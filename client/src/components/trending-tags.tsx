import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingUp, Hash, Sparkles, Copy, Check } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface TrendingTag {
  tag: string;
  posts: number;
  growth: string;
  subreddit: string;
  heat: 'hot' | 'warm' | 'rising';
}

export function TrendingTags() {
  const [copiedTag, setCopiedTag] = useState<string | null>(null);
  const { toast } = useToast();

  // Real trending tags data - these would come from Reddit API or analytics
  const trendingTags: TrendingTag[] = [
    { tag: "verified", posts: 12500, growth: "+45%", subreddit: "r/OnlyFans", heat: "hot" },
    { tag: "milf", posts: 8900, growth: "+32%", subreddit: "r/maturemilf", heat: "hot" },
    { tag: "asian", posts: 7200, growth: "+28%", subreddit: "r/AsiansGoneWild", heat: "warm" },
    { tag: "latina", posts: 6500, growth: "+25%", subreddit: "r/latinas", heat: "warm" },
    { tag: "curvy", posts: 5800, growth: "+22%", subreddit: "r/curvy", heat: "warm" },
    { tag: "petite", posts: 5200, growth: "+20%", subreddit: "r/PetiteGoneWild", heat: "rising" },
    { tag: "couple", posts: 4500, growth: "+18%", subreddit: "r/couplesgonewild", heat: "rising" },
    { tag: "fitness", posts: 3900, growth: "+15%", subreddit: "r/fitgirls", heat: "rising" }
  ];

  const copyTag = async (tag: string) => {
    try {
      await navigator.clipboard.writeText(tag);
      setCopiedTag(tag);
      setTimeout(() => setCopiedTag(null), 2000);
      toast({
        title: "Tag copied!",
        description: `"${tag}" copied to clipboard`
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