import { providers, anyProviderEnabled } from "./payment-providers.js";
export function getDefaultProvider() {
    return providers[0] ?? null;
}
export async function createCheckoutOrExplain(args) {
    const p = getDefaultProvider();
    if (!p) {
        return {
            ok: false,
            reason: "no-provider",
            message: "No payment provider is configured. Add PAXUM_API_KEY or COINBASE_COMMERCE_KEY.",
        };
    }
    const { url } = await p.createCheckout(args);
    return { ok: true, url };
}
export { anyProviderEnabled };
