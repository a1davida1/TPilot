import { useState } from 'react';
import { Copy, Check, Share2, Users, DollarSign, Gift, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

export default function ReferralPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  // Generate referral code from user ID (simple example)
  const referralCode = user?.id ? `THOTTO${user.id.toString().padStart(6, '0')}` : 'THOTTO000000';
  const referralUrl = `${window.location.origin}/signup?ref=${referralCode}`;

  const handleCopyReferralCode = async () => {
    try {
      await navigator.clipboard.writeText(referralCode);
      setCopied(true);
      toast({
        title: 'Copied!',
        description: 'Referral code copied to clipboard',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast({
        title: 'Failed to copy',
        description: 'Please try selecting and copying manually',
        variant: 'destructive',
      });
    }
  };

  const handleCopyReferralUrl = async () => {
    try {
      await navigator.clipboard.writeText(referralUrl);
      toast({
        title: 'Copied!',
        description: 'Referral link copied to clipboard',
      });
    } catch (err) {
      toast({
        title: 'Failed to copy',
        description: 'Please try selecting and copying manually',
        variant: 'destructive',
      });
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join ThottoPilot with my referral code!',
          text: 'Get exclusive content creation tools and earn rewards with my referral code.',
          url: referralUrl,
        });
      } catch (err) {
        // User cancelled share or sharing failed
        handleCopyReferralUrl();
      }
    } else {
      // Fallback to copying URL
      handleCopyReferralUrl();
    }
  };

  // Mock data for referral stats (would come from API in real implementation)
  const referralStats = {
    totalReferrals: 12,
    activeReferrals: 8,
    totalEarnings: 240.00,
    pendingEarnings: 60.00,
    thisMonthReferrals: 3,
    thisMonthEarnings: 75.00
  };

  const rewardTiers = [
    { referrals: 1, reward: '$20 credit', bonus: 'Welcome bonus' },
    { referrals: 5, reward: '$50 credit', bonus: '1 month free Pro' },
    { referrals: 10, reward: '$120 credit', bonus: 'Exclusive features access' },
    { referrals: 25, reward: '$300 credit', bonus: 'VIP support tier' },
    { referrals: 50, reward: '$650 credit', bonus: 'Lifetime Pro features' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 via-rose-50 to-purple-100 dark:from-gray-900 dark:via-purple-950/20 dark:to-pink-950/20">
      {/* Animated Background */}
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-yellow-400/5 opacity-60"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(255,192,203,0.1),transparent_50%)]"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,rgba(255,235,59,0.05),transparent_50%)]"></div>
      </div>

      <div className="relative container mx-auto px-4 py-8 z-10 max-w-6xl">
        {/* Page Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-pink-600 via-rose-500 to-purple-600 dark:from-pink-400 dark:via-rose-400 dark:to-purple-400 bg-clip-text text-transparent drop-shadow-sm mb-4">
            <Gift className="inline-block h-10 w-10 mr-3 text-pink-500" />
            Referral Program
          </h1>
          <p className="text-lg text-gray-700 dark:text-gray-300 max-w-2xl mx-auto">
            Share ThottoPilot with friends and earn rewards for every successful referral. The more you share, the more you earn!
          </p>
          <Badge className="mt-4 bg-gradient-to-r from-blue-500 to-cyan-500 text-white px-4 py-2">
            <Sparkles className="h-4 w-4 mr-2" />
            Pro Member Exclusive
          </Badge>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-pink-200/50 dark:border-pink-800/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Referrals</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-pink-600 dark:text-pink-400 flex items-center">
                <Users className="h-5 w-5 mr-2" />
                {referralStats.totalReferrals}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                {referralStats.activeReferrals} active this month
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-pink-200/50 dark:border-pink-800/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Earnings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600 dark:text-green-400 flex items-center">
                <DollarSign className="h-5 w-5 mr-2" />
                ${referralStats.totalEarnings.toFixed(2)}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                ${referralStats.pendingEarnings.toFixed(2)} pending
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-pink-200/50 dark:border-pink-800/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">This Month</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                {referralStats.thisMonthReferrals}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                ${referralStats.thisMonthEarnings.toFixed(2)} earned
              </p>
            </CardContent>
          </Card>

          <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-pink-200/50 dark:border-pink-800/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600 dark:text-gray-400">Next Reward</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600 dark:text-orange-400">
                {Math.max(5 - referralStats.totalReferrals, 0)}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                referrals away from $50 bonus
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Referral Code Section */}
          <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-pink-200/50 dark:border-pink-800/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Share2 className="h-5 w-5 text-pink-500" />
                Your Referral Code
              </CardTitle>
              <CardDescription>
                Share this code with friends to earn rewards when they sign up
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-2">
                <Input
                  value={referralCode}
                  readOnly
                  className="font-mono text-lg text-center bg-pink-50 dark:bg-pink-950/20 border-pink-200 dark:border-pink-800"
                  data-testid="input-referral-code"
                />
                <Button
                  onClick={handleCopyReferralCode}
                  variant="outline"
                  size="icon"
                  className="flex-shrink-0"
                  data-testid="button-copy-code"
                >
                  {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Referral Link
                </label>
                <div className="flex items-center gap-2">
                  <Input
                    value={referralUrl}
                    readOnly
                    className="font-mono text-sm bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-700"
                    data-testid="input-referral-url"
                  />
                  <Button
                    onClick={handleCopyReferralUrl}
                    variant="outline"
                    size="icon"
                    className="flex-shrink-0"
                    data-testid="button-copy-url"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <Button
                onClick={handleShare}
                className="w-full bg-gradient-to-r from-pink-500 to-purple-500 hover:from-pink-600 hover:to-purple-600 text-white"
                data-testid="button-share-referral"
              >
                <Share2 className="h-4 w-4 mr-2" />
                Share Referral Link
              </Button>
            </CardContent>
          </Card>

          {/* Reward Tiers */}
          <Card className="bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-pink-200/50 dark:border-pink-800/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Gift className="h-5 w-5 text-pink-500" />
                Reward Tiers
              </CardTitle>
              <CardDescription>
                Unlock bigger rewards as you refer more friends
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {rewardTiers.map((tier, index) => (
                <div
                  key={index}
                  className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                    referralStats.totalReferrals >= tier.referrals
                      ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800'
                      : 'bg-gray-50 dark:bg-gray-950/20 border-gray-200 dark:border-gray-700'
                  }`}
                  data-testid={`reward-tier-${tier.referrals}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                      referralStats.totalReferrals >= tier.referrals
                        ? 'bg-green-500 text-white'
                        : 'bg-gray-300 dark:bg-gray-600 text-gray-600 dark:text-gray-300'
                    }`}>
                      {tier.referrals}
                    </div>
                    <div>
                      <div className="font-semibold text-gray-900 dark:text-gray-100">
                        {tier.reward}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {tier.bonus}
                      </div>
                    </div>
                  </div>
                  {referralStats.totalReferrals >= tier.referrals && (
                    <Check className="h-5 w-5 text-green-500" />
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* How It Works */}
        <Card className="mt-8 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm border-pink-200/50 dark:border-pink-800/30">
          <CardHeader>
            <CardTitle>How It Works</CardTitle>
            <CardDescription>
              Earn rewards by sharing ThottoPilot with your network
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="w-12 h-12 bg-pink-100 dark:bg-pink-900/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Share2 className="h-6 w-6 text-pink-500" />
                </div>
                <h3 className="font-semibold mb-2">1. Share Your Code</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Share your unique referral code or link with friends and followers
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Users className="h-6 w-6 text-purple-500" />
                </div>
                <h3 className="font-semibold mb-2">2. Friends Sign Up</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  They use your code to create their ThottoPilot account
                </p>
              </div>
              
              <div className="text-center">
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-3">
                  <DollarSign className="h-6 w-6 text-green-500" />
                </div>
                <h3 className="font-semibold mb-2">3. Earn Rewards</h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Get account credits and bonuses when they upgrade to Pro
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}