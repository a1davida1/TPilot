import { useState, useEffect } from 'react';
import { Gift, Users, Copy, Check, TrendingUp, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/useAuth';

interface ReferralData {
  code: string;
  shareUrl: string;
  totalReferrals: number;
  activeReferrals: number;
  earnings: number;
  tier: string;
}

export function ReferralWidget() {
  const [referralData, setReferralData] = useState<ReferralData | null>(null);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const { user } = useAuth();

  useEffect(() => {
    fetchReferralData();
  }, []);

  const fetchReferralData = async () => {
    try {
      const response = await apiRequest('GET', '/api/referral/code');
      const data = await response.json() as {
        code: string;
        totalReferrals?: number;
        activeReferrals?: number;
        earnings?: number;
      };
      setReferralData({
        code: data.code,
        shareUrl: `${window.location.origin}/signup?ref=${data.code}`,
        totalReferrals: data.totalReferrals || 0,
        activeReferrals: data.activeReferrals || 0,
        earnings: data.earnings || 0,
        tier: user?.tier || 'free'
      });
    } catch (_error) {
      // Failed to fetch referral data, will show loading state
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    if (!referralData) return;
    
    try {
      await navigator.clipboard.writeText(referralData.shareUrl);
      setCopied(true);
      toast({
        title: 'Copied!',
        description: 'Referral link copied to clipboard'
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (_error) {
      toast({
        title: 'Failed to copy',
        description: 'Please copy the link manually',
        variant: 'destructive'
      });
    }
  };

  if (loading) {
    return (
      <Card className="w-full">
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-8 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!referralData) return null;

  const rewards = {
    free: { referrer: '$5 credit', referee: '14-day Pro trial' },
    starter: { referrer: '1 month free', referee: '20% off first month' },
    pro: { referrer: '2 months free', referee: '30% off first month' },
    premium: { referrer: '3 months free', referee: '50% off first month' },
    admin: { referrer: 'Unlimited rewards', referee: 'VIP access' }
  };

  return (
    <Card className="w-full bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 border-purple-200 dark:border-purple-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            <CardTitle>Share & Earn Rewards</CardTitle>
          </div>
          {referralData.tier !== 'free' && (
            <Badge variant="secondary" className="bg-purple-100 dark:bg-purple-900">
              {referralData.tier} Tier Bonus Active
            </Badge>
          )}
        </div>
        <CardDescription>
          Invite creators and earn {rewards[referralData.tier as keyof typeof rewards].referrer} per referral
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Referral Link */}
        <div className="space-y-2">
          <label htmlFor="referral-link" className="text-sm font-medium">Your Referral Link</label>
          <div className="flex gap-2">
            <input
              id="referral-link"
              type="text"
              value={referralData.shareUrl}
              readOnly
              aria-label="Your referral link"
              title="Your referral link to share"
              className="flex-1 px-3 py-2 border rounded-md bg-white dark:bg-gray-900 text-sm"
            />
            <Button onClick={copyToClipboard} variant="secondary" size="sm">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              <Users className="h-4 w-4 text-gray-500" />
            </div>
            <div className="text-2xl font-bold">{referralData.totalReferrals}</div>
            <div className="text-xs text-gray-500">Total Referrals</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              <TrendingUp className="h-4 w-4 text-green-500" />
            </div>
            <div className="text-2xl font-bold">{referralData.activeReferrals}</div>
            <div className="text-xs text-gray-500">Active Users</div>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center mb-1">
              <DollarSign className="h-4 w-4 text-purple-500" />
            </div>
            <div className="text-2xl font-bold">${referralData.earnings}</div>
            <div className="text-xs text-gray-500">Earned</div>
          </div>
        </div>

        {/* Rewards Info */}
        <div className="p-3 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
          <div className="text-sm font-medium mb-1">Current Rewards:</div>
          <div className="text-xs space-y-1">
            <div>• You get: <strong>{rewards[referralData.tier as keyof typeof rewards].referrer}</strong></div>
            <div>• They get: <strong>{rewards[referralData.tier as keyof typeof rewards].referee}</strong></div>
          </div>
        </div>

        {/* Share Buttons */}
        <div className="flex gap-2">
          <Button 
            size="sm" 
            className="flex-1"
            onClick={() => {
              window.open(`https://twitter.com/intent/tweet?text=Join%20me%20on%20ThottoPilot!%20${encodeURIComponent(referralData.shareUrl)}`, '_blank');
            }}
          >
            Share on X
          </Button>
          <Button 
            size="sm" 
            variant="outline"
            className="flex-1"
            onClick={() => {
              window.open(`https://reddit.com/submit?url=${encodeURIComponent(referralData.shareUrl)}&title=Check%20out%20ThottoPilot`, '_blank');
            }}
          >
            Share on Reddit
          </Button>
        </div>

        {/* Upgrade CTA for Free Users */}
        {referralData.tier === 'free' && (
          <div className="p-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg">
            <div className="text-sm font-medium mb-1">🚀 Unlock Better Rewards!</div>
            <div className="text-xs mb-2">
              Upgrade to earn up to 3 months free per referral
            </div>
            <Button size="sm" variant="secondary" className="w-full">
              View Upgrade Options
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
