import { useStripe, Elements, PaymentElement, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useEffect, useState } from 'react';
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Shield, CheckCircle, Zap } from "lucide-react";
import { Link } from "wouter";

// Load Stripe
if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
  console.error('Missing required Stripe key: VITE_STRIPE_PUBLIC_KEY');
}
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || '');

interface CheckoutFormProps {
  plan: 'pro' | 'pro_plus';
}

const CheckoutForm = ({ plan }: CheckoutFormProps) => {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [isProcessing, setIsProcessing] = useState(false);
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsProcessing(true);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/dashboard?payment=success&plan=${plan}`,
      },
    });

    if (error) {
      toast({
        title: "Payment Failed",
        description: error.message,
        variant: "destructive",
      });
      setIsProcessing(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      <Button 
        type="submit" 
        disabled={!stripe || !elements || isProcessing}
        className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700"
      >
        {isProcessing ? (
          <>Processing...</>
        ) : (
          <>
            <Shield className="mr-2 h-4 w-4" />
            Subscribe to {plan === 'pro_plus' ? 'Pro Plus' : 'Pro'}
          </>
        )}
      </Button>
    </form>
  );
};

export default function Checkout() {
  // Get plan from URL params or default to 'pro'
  const urlParams = new URLSearchParams(window.location.search);
  const plan = (urlParams.get('plan') as 'pro' | 'pro_plus') || 'pro';
  const [clientSecret, setClientSecret] = useState("");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Plan details
  const planDetails = {
    pro: {
      name: "Pro",
      price: "$19.99",
      period: "month",
      features: [
        "Unlimited AI captions",
        "Advanced image protection",
        "Priority support",
        "Post scheduling",
        "Analytics dashboard",
        "Reddit & Twitter integration"
      ]
    },
    pro_plus: {
      name: "Pro Plus",
      price: "$49.99",
      period: "month",
      features: [
        "Everything in Pro",
        "White-label options",
        "API access",
        "Custom branding",
        "Team collaboration",
        "Advanced analytics",
        "Priority processing"
      ]
    }
  };

  const currentPlan = planDetails[plan];

  useEffect(() => {
    // Create subscription payment intent
    const setupPayment = async () => {
      try {
        const response = await apiRequest("POST", "/api/create-subscription", { 
          plan,
          amount: plan === 'pro_plus' ? 4999 : 1999 // in cents
        });
        const data = await response.json();
        
        if (data.clientSecret) {
          setClientSecret(data.clientSecret);
        } else {
          throw new Error('Failed to setup payment');
        }
      } catch (error) {
        console.error('Payment setup error:', error);
        toast({
          title: "Setup Failed",
          description: "Failed to initialize payment. Please try again.",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    setupPayment();
  }, [plan, toast]);

  if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="text-red-600 text-lg font-semibold">
                Payment System Not Configured
              </div>
              <p className="text-gray-600">
                Please contact support to enable payments.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-pink-500 border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!clientSecret) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <div className="text-red-600 text-lg font-semibold">
                Payment initialization failed
              </div>
              <Link href="/settings">
                <Button variant="outline">
                  <ArrowLeft className="mr-2 h-4 w-4" />
                  Back to Settings
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <Link href="/settings">
          <Button variant="ghost" className="mb-6">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Settings
          </Button>
        </Link>

        <div className="grid lg:grid-cols-2 gap-8">
          {/* Plan Details */}
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl flex items-center">
                <Zap className="mr-2 h-6 w-6 text-yellow-500" />
                {currentPlan.name} Plan
              </CardTitle>
              <CardDescription>
                <span className="text-3xl font-bold text-gray-900">{currentPlan.price}</span>
                <span className="text-gray-600">/{currentPlan.period}</span>
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {currentPlan.features.map((feature, index) => (
                  <div key={index} className="flex items-start">
                    <CheckCircle className="h-5 w-5 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                    <span className="text-gray-700">{feature}</span>
                  </div>
                ))}
              </div>
              
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>30-day money-back guarantee</strong><br />
                  Cancel anytime, no questions asked.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Payment Form */}
          <Card>
            <CardHeader>
              <CardTitle>Payment Details</CardTitle>
              <CardDescription>
                Enter your payment information to complete subscription
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Elements stripe={stripePromise} options={{ clientSecret }}>
                <CheckoutForm plan={plan} />
              </Elements>
              
              <div className="mt-6 flex items-center justify-center text-sm text-gray-500">
                <Shield className="h-4 w-4 mr-2" />
                Secured by Stripe
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}