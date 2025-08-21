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
      // TODO: real Paxum API call. Keep typed return.
      // Placeholder reachable only when enabled:
      const q = new URLSearchParams({ userId, planId, amountCents: String(amountCents), returnUrl: returnUrl || "" });
      return { url: `https://paxum.example/checkout?${q.toString()}` };
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
      // TODO: real Coinbase Commerce API call.
      const q = new URLSearchParams({ userId, planId, amountCents: String(amountCents), returnUrl: returnUrl || "" });
      return { url: `https://commerce.coinbase.com/checkout?${q.toString()}` };
    },
  };
}

export const providers: PaymentProvider[] = [makePaxum(), makeCoinbase()].filter(p => p.enabled);
export const anyProviderEnabled = providers.length > 0;