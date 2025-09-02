function disabled(name) {
    return {
        name,
        enabled: false,
        async createCheckout() {
            throw new Error(`Payment provider "${name}" is disabled (missing secrets).`);
        },
    };
}
// Paxum
export function makePaxum() {
    const key = process.env.PAXUM_API_KEY;
    const baseUrl = process.env.APP_BASE_URL;
    if (!key)
        return disabled("paxum");
    if (!baseUrl) {
        throw new Error('APP_BASE_URL environment variable is required');
    }
    return {
        name: "paxum",
        enabled: true,
        async createCheckout({ userId, planId, amountCents = 0, returnUrl }) {
            // Input validation
            if (!userId || !planId) {
                throw new Error('userId and planId are required');
            }
            try {
                // Sanitize amount (handle negative values, ensure reasonable limits)
                const sanitizedAmount = Math.max(0, Math.min(amountCents || 0, 99999999999));
                // Create Paxum checkout session
                const paxumEndpoint = 'https://www.paxum.com/payment/checkout';
                const params = new URLSearchParams({
                    business: key, // Paxum merchant ID
                    button_id: planId,
                    currency_code: 'USD',
                    amount: (sanitizedAmount / 100).toFixed(2),
                    item_name: `ThottoPilot ${planId} Plan`,
                    custom: userId,
                    return_url: returnUrl || `${baseUrl}/billing/success`,
                    cancel_url: `${baseUrl}/billing/cancelled`,
                    notify_url: `${baseUrl}/api/webhooks/paxum`,
                });
                return { url: `${paxumEndpoint}?${params.toString()}` };
            }
            catch (error) {
                console.error('Paxum checkout creation failed:', error);
                throw new Error('Failed to create Paxum checkout session');
            }
        },
    };
}
// Coinbase Commerce
export function makeCoinbase() {
    const key = process.env.COINBASE_COMMERCE_KEY;
    if (!key)
        return disabled("coinbase");
    return {
        name: "coinbase",
        enabled: true,
        async createCheckout({ userId, planId, amountCents = 0, returnUrl }) {
            try {
                // Create Coinbase Commerce checkout session
                // Input validation
                if (!userId || !planId) {
                    throw new Error('userId and planId are required');
                }
                // Sanitize amount (handle negative values, ensure reasonable limits)
                const sanitizedAmount = Math.max(0, Math.min(amountCents || 0, 99999999999));
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
                            amount: (sanitizedAmount / 100).toFixed(2),
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
                // Validate response structure
                if (!data || !data.data || !data.data.hosted_url) {
                    throw new Error('Invalid response from Coinbase Commerce API');
                }
                return { url: data.data.hosted_url };
            }
            catch (error) {
                console.error('Coinbase Commerce checkout creation failed:', error);
                // Re-throw specific validation errors
                if (error.message === 'Invalid response from Coinbase Commerce API') {
                    throw error;
                }
                throw new Error('Failed to create Coinbase Commerce checkout session');
            }
        },
    };
}
// Stripe
export function makeStripe() {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    const baseUrl = process.env.APP_BASE_URL;
    if (!secretKey)
        return disabled("stripe");
    if (!baseUrl) {
        throw new Error('APP_BASE_URL environment variable is required');
    }
    return {
        name: "stripe",
        enabled: true,
        async createCheckout({ userId, planId, amountCents = 0, returnUrl }) {
            // Input validation
            if (!userId || !planId) {
                throw new Error('userId and planId are required');
            }
            try {
                // Use the existing Stripe integration from billing.ts
                // This creates a checkout session URL for the payment
                const checkoutUrl = `${baseUrl}/api/billing/checkout`;
                // Return the checkout initiation URL
                // The actual Stripe session creation happens in billing.ts
                const params = new URLSearchParams({
                    userId,
                    planId,
                    amount: amountCents.toString(),
                    returnUrl: returnUrl || `${baseUrl}/billing/success`
                });
                return { url: `${checkoutUrl}?${params.toString()}` };
            }
            catch (error) {
                console.error('Stripe checkout creation failed:', error);
                throw new Error('Failed to create Stripe checkout session');
            }
        },
    };
}
// CONSOLIDATION: Only enable Stripe for production readiness
export const providers = [makeStripe()].filter(p => p.enabled);
export const anyProviderEnabled = providers.length > 0;
