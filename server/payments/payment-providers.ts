export interface PaymentProvider {
  name: "paxum" | "coinbase";
  enabled: boolean;
  createCheckout(params: { userId: string; planId: string; amountCents?: number; returnUrl?: string }): Promise<{ url: string }>;
}

function disabled(name: PaymentProvider["name"]): PaymentProvider {
  return {
    name,
    enabled: false,
    async createCheckout() {
      throw new Error(`Payment provider "${name}" is disabled (missing secrets).`);
    },
  };
}

// Paxum
export function makePaxum(): PaymentProvider {
  const key = process.env.PAXUM_API_KEY;
  if (!key) return disabled("paxum");
  return {
    name: "paxum",
    enabled: true,
    async createCheckout({ userId, planId, amountCents = 0, returnUrl }) {
      try {
        // Create Paxum checkout session
        const paxumEndpoint = 'https://www.paxum.com/payment/checkout';
        
        const params = new URLSearchParams({
          business: key, // Paxum merchant ID
          button_id: planId,
          currency_code: 'USD',
          amount: (amountCents / 100).toFixed(2),
          item_name: `ThottoPilot ${planId} Plan`,
          custom: userId,
          return_url: returnUrl || `${process.env.APP_BASE_URL}/billing/success`,
          cancel_url: `${process.env.APP_BASE_URL}/billing/cancelled`,
          notify_url: `${process.env.APP_BASE_URL}/api/webhooks/paxum`,
        });

        return { url: `${paxumEndpoint}?${params.toString()}` };
      } catch (error) {
        console.error('Paxum checkout creation failed:', error);
        throw new Error('Failed to create Paxum checkout session');
      }
    },
  };
}

// Coinbase Commerce
export function makeCoinbase(): PaymentProvider {
  const key = process.env.COINBASE_COMMERCE_KEY;
  if (!key) return disabled("coinbase");
  return {
    name: "coinbase",
    enabled: true,
    async createCheckout({ userId, planId, amountCents = 0, returnUrl }) {
      try {
        // Create Coinbase Commerce checkout session
        const response = await fetch('https://api.commerce.coinbase.com/checkouts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-CC-Api-Key': key,
            'X-CC-Version': '2018-03-22'
          },
          body: JSON.stringify({
            name: `ThottoPilot ${planId} Plan`,
            description: `Subscription to ThottoPilot ${planId} plan`,
            pricing_type: 'fixed_price',
            local_price: {
              amount: (amountCents / 100).toFixed(2),
              currency: 'USD'
            },
            metadata: {
              user_id: userId,
              plan_id: planId
            },
            redirect_url: returnUrl || `${process.env.APP_BASE_URL}/billing/success`,
            cancel_url: `${process.env.APP_BASE_URL}/billing/cancelled`,
          })
        });

        if (!response.ok) {
          throw new Error(`Coinbase API error: ${response.status}`);
        }

        const data = await response.json();
        return { url: data.data.hosted_url };
      } catch (error) {
        console.error('Coinbase Commerce checkout creation failed:', error);
        throw new Error('Failed to create Coinbase Commerce checkout session');
      }
    },
  };
}

export const providers: PaymentProvider[] = [makePaxum(), makeCoinbase()].filter(p => p.enabled);
export const anyProviderEnabled = providers.length > 0;