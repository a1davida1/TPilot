import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Crown, CreditCard, CheckCircle2, XCircle, ExternalLink } from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';

interface Subscription {
  id: number;
  status: 'active' | 'cancelled' | 'expired';
  plan: 'pro' | 'premium';
  amount: number;
  nextBillDate: string;
  createdAt: string;
}

export default function BillingDashboard() {
  const { toast } = useToast();

  // Fetch subscription status
  const { data: subscriptionData, isLoading } = useQuery({
    queryKey: ['/api/subscription'],
  });

  // Generate payment link mutation
  const paymentLinkMutation = useMutation({
    mutationFn: async (plan: string) => {
      const response = await apiRequest('POST', '/api/billing/payment-link', { plan });
      return response.json();
    },
    onSuccess: (data: unknown) => {
      const paymentData = data as { paymentUrl: string };
      window.open(paymentData.paymentUrl, '_blank');
      toast({
        title: "Redirecting to payment",
        description: "Complete your subscription upgrade in the new window",
      });
    },
    onError: (error: unknown) => {
      const errorMessage = error instanceof Error ? error.message : "Unable to generate payment link";
      toast({
        title: "Payment link failed",
        description: errorMessage,
        variant: "destructive",
      });
    },
  });

  const getTierBadge = (tier: string) => {
    switch (tier) {
      case 'premium':
        return <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">Premium</Badge>;
      case 'pro':
        return <Badge className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white">Pro</Badge>;
      default:
        return <Badge variant="outline">Free</Badge>;
    }
  };

  const formatPrice = (cents: number) => {
    return `$${(cents / 100).toFixed(2)}`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="grid gap-6 md:grid-cols-2">
          <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  const subscription = (subscriptionData as { subscription?: Subscription; tier?: string })?.subscription || null;
  const tier = (subscriptionData as { tier?: string })?.tier || 'free';

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Billing & Subscription</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-gray-600">Current plan:</span>
            {getTierBadge(tier)}
          </div>
        </div>
        <Crown className="h-8 w-8 text-yellow-500" />
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Current Subscription */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Current Subscription
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {subscription ? (
              <>
                <div className="flex items-center justify-between">
                  <span className="font-medium capitalize">{subscription.plan} Plan</span>
                  <div className="flex items-center gap-1">
                    {subscription.status === 'active' ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span className="capitalize text-sm">{subscription.status}</span>
                  </div>
                </div>
                
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span>Amount:</span>
                    <span className="font-medium">{formatPrice(subscription.amount)}/month</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Next billing:</span>
                    <span>{formatDate(subscription.nextBillDate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Started:</span>
                    <span>{formatDate(subscription.createdAt)}</span>
                  </div>
                </div>

                {subscription.status === 'active' && (
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                    <p className="text-sm text-green-700 dark:text-green-300">
                      Your subscription is active and all premium features are available.
                    </p>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-6">
                <p className="text-gray-500 mb-4">No active subscription</p>
                <p className="text-sm text-gray-400">
                  Upgrade to access premium features like unlimited AI generation, 
                  advanced scheduling, and premium media storage.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Upgrade Options */}
        <Card>
          <CardHeader>
            <CardTitle>Upgrade Plans</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {tier === 'free' && (
              <>
                {/* Starter Plan */}
                <div className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">Starter Plan</h3>
                      <p className="text-2xl font-bold">$13.99<span className="text-sm font-normal">/mo</span></p>
                    </div>
                    <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white">Popular</Badge>
                  </div>
                  
                  <ul className="text-sm space-y-1 text-gray-600">
                    <li>• 50 AI generations per day</li>
                    <li>• Basic post scheduling</li>
                    <li>• 10GB media storage</li>
                    <li>• Email support</li>
                    <li>• Remove watermarks</li>
                  </ul>
                  
                  <Button 
                    className="w-full" 
                    onClick={() => paymentLinkMutation.mutate('starter')}
                    disabled={paymentLinkMutation.isPending}
                    data-testid="button-upgrade-starter"
                  >
                    {paymentLinkMutation.isPending ? 'Loading...' : 'Upgrade to Starter'}
                    <ExternalLink className="h-4 w-4 ml-2" />
                  </Button>
                </div>

                {/* Pro Plan */}
                <div className="border rounded-lg p-4 space-y-3 relative">
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-gradient-to-r from-blue-500 to-cyan-500 text-white">Best Value</Badge>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold">Pro Plan</h3>
                      <p className="text-2xl font-bold">$24.99<span className="text-sm font-normal">/mo</span></p>
                    </div>
                  </div>
                  
                  <ul className="text-sm space-y-1 text-gray-600">
                    <li>• Unlimited AI generations</li>
                    <li>• 50GB media storage</li>
                    <li>• Advanced image protection</li>
                    <li>• Priority support</li>
                    <li>• Unlimited Reddit accounts</li>
                    <li>• Analytics dashboard</li>
                    <li>• API access</li>
                  </ul>
                  
                  <Button 
                    className="w-full bg-gradient-to-r from-blue-500 to-cyan-500 hover:from-blue-600 hover:to-cyan-600" 
                    onClick={() => paymentLinkMutation.mutate('pro')}
                    disabled={paymentLinkMutation.isPending}
                    data-testid="button-upgrade-pro"
                  >
                    {paymentLinkMutation.isPending ? 'Loading...' : 'Upgrade to Pro'}
                    <ExternalLink className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </>
            )}

            {(tier === 'starter' || tier === 'pro') && (
              <div className="text-center py-6">
                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <p className="font-medium mb-2">You&apos;re on the {tier} plan!</p>
                <p className="text-sm text-gray-500">
                  Enjoying all the features. Thank you for your support!
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Features Comparison */}
      <Card>
        <CardHeader>
          <CardTitle>Feature Comparison</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2">Feature</th>
                  <th className="text-center py-2">Free</th>
                  <th className="text-center py-2">Starter</th>
                  <th className="text-center py-2">Pro</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                <tr>
                  <td className="py-2">AI Content Generation</td>
                  <td className="text-center">5/day</td>
                  <td className="text-center">50/day</td>
                  <td className="text-center">Unlimited</td>
                </tr>
                <tr>
                  <td className="py-2">Media Storage</td>
                  <td className="text-center">2GB</td>
                  <td className="text-center">10GB</td>
                  <td className="text-center">50GB</td>
                </tr>
                <tr>
                  <td className="py-2">Post Scheduling</td>
                  <td className="text-center">Basic</td>
                  <td className="text-center">Basic</td>
                  <td className="text-center">Advanced</td>
                </tr>
                <tr>
                  <td className="py-2">Watermarks</td>
                  <td className="text-center">Always</td>
                  <td className="text-center">Optional</td>
                  <td className="text-center">Optional</td>
                </tr>
                <tr>
                  <td className="py-2">Reddit Accounts</td>
                  <td className="text-center">1</td>
                  <td className="text-center">3</td>
                  <td className="text-center">Unlimited</td>
                </tr>
                <tr>
                  <td className="py-2">Analytics</td>
                  <td className="text-center">Basic</td>
                  <td className="text-center">Basic</td>
                  <td className="text-center">Advanced</td>
                </tr>
                <tr>
                  <td className="py-2">API Access</td>
                  <td className="text-center">❌</td>
                  <td className="text-center">❌</td>
                  <td className="text-center">✅</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}