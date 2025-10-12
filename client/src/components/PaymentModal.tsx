import { useState } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { Loader2, CreditCard, Shield, Check } from 'lucide-react';

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || '');

const TIER_PRICES = {
  starter: { price: 9, priceId: import.meta.env.VITE_STRIPE_PRICE_STARTER },
  pro: { price: 29, priceId: import.meta.env.VITE_STRIPE_PRICE_PRO },
  premium: { price: 99, priceId: import.meta.env.VITE_STRIPE_PRICE_PREMIUM }
};

interface PaymentFormProps {
  tier: 'starter' | 'pro' | 'premium';
  onSuccess: () => void;
  onCancel: () => void;
}

function PaymentForm({ tier, onSuccess, onCancel }: PaymentFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setIsProcessing(true);

    try {
      // Create payment intent
      const response = await apiRequest('POST', '/api/payments/create-intent', {
        tier,
        priceId: TIER_PRICES[tier].priceId
      });
      const { clientSecret } = await response.json();

      // Confirm payment
      const { error } = await stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: elements.getElement(CardElement)!,
        }
      });

      if (error) {
        toast({
          title: 'Payment failed',
          description: error.message,
          variant: 'destructive'
        });
      } else {
        toast({
          title: 'Payment successful!',
          description: `Welcome to ${tier.charAt(0).toUpperCase() + tier.slice(1)} tier!`
        });
        onSuccess();
      }
    } catch (error) {
      toast({
        title: 'Payment error',
        description: 'Failed to process payment',
        variant: 'destructive'
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="p-4 border rounded-lg">
        <CardElement 
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: '#424770',
                '::placeholder': { color: '#aab7c4' }
              }
            }
          }}
        />
      </div>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Shield className="h-4 w-4" />
        <span>Secure payment powered by Stripe</span>
      </div>

      <div className="flex gap-3">
        <Button 
          type="submit" 
          disabled={!stripe || isProcessing}
          className="flex-1"
        >
          {isProcessing ? (
            <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processing...</>
          ) : (
            <><CreditCard className="mr-2 h-4 w-4" />Pay ${TIER_PRICES[tier].price}/month</>
          )}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function PaymentModal({ tier, onClose }: { tier: 'starter' | 'pro' | 'premium', onClose: () => void }) {
  const tierFeatures = {
    starter: ['10 posts/day', '50 captions/day', 'Basic analytics'],
    pro: ['100 posts/day', '500 captions/day', '7-day scheduling', 'Advanced analytics'],
    premium: ['Unlimited posts', 'Unlimited captions', '30-day scheduling', 'All features']
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Upgrade to {tier.charAt(0).toUpperCase() + tier.slice(1)}</CardTitle>
        <CardDescription>
          ${TIER_PRICES[tier].price}/month • Cancel anytime
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-6 space-y-2">
          {tierFeatures[tier].map((feature) => (
            <div key={feature} className="flex items-center gap-2 text-sm">
              <Check className="h-4 w-4 text-green-500" />
              <span>{feature}</span>
            </div>
          ))}
        </div>
        
        <Elements stripe={stripePromise}>
          <PaymentForm tier={tier} onSuccess={onClose} onCancel={onClose} />
        </Elements>
      </CardContent>
    </Card>
  );
}
