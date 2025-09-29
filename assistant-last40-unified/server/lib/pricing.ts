import crypto from "crypto";

export type ProBucket = "a"|"b"|"c";

export function bucketForUser(userId: string): ProBucket {
  const h = crypto.createHash("sha1").update(userId).digest();
  const n = h[0]; // 0..255
  if (n < 85) return "a";   // ~33%
  if (n < 170) return "b";  // ~33%
  return "c";               // ~33%
}

export function proPriceIdForBucket(b: ProBucket): string {
  const map: Record<ProBucket,string> = {
    a: process.env.STRIPE_PRICE_PRO_29!,
    b: process.env.STRIPE_PRICE_PRO_39!,
    c: process.env.STRIPE_PRICE_PRO_49!,
  };
  return map[b];
}