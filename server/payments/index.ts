import { providers, anyProviderEnabled, type PaymentProvider } from "./payment-providers.js";

export function getDefaultProvider(): PaymentProvider | null {
  return providers[0] ?? null;
}

export async function createCheckoutOrExplain(args: Parameters<PaymentProvider["createCheckout"]>[0]) {
  const p = getDefaultProvider();
  if (!p) {
    return {
      ok: false as const,
      reason: "no-provider",
      message: "No payment provider is configured. Add PAXUM_API_KEY or COINBASE_COMMERCE_KEY.",
    };
  }
  const { url } = await p.createCheckout(args);
  return { ok: true as const, url };
}

export { anyProviderEnabled };