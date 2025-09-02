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
    if (!key)
        return disabled("paxum");
    return {
        name: "paxum",
        enabled: true,
        async createCheckout({ userId, planId, amountCents = 0, returnUrl }) {
            // TODO: real Paxum API call. Keep typed return.
            // Placeholder reachable only when enabled:
            const q = new URLSearchParams({ userId, planId, amountCents: String(amountCents), returnUrl: returnUrl || "" });
            return { url: `https://paxum.example/checkout?${q.toString()}` };
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
            // TODO: real Coinbase Commerce API call.
            const q = new URLSearchParams({ userId, planId, amountCents: String(amountCents), returnUrl: returnUrl || "" });
            return { url: `https://commerce.coinbase.com/checkout?${q.toString()}` };
        },
    };
}
export const providers = [makePaxum(), makeCoinbase()].filter(p => p.enabled);
export const anyProviderEnabled = providers.length > 0;
