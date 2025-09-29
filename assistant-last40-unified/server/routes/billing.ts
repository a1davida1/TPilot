import type { Express, Request, Response } from "express";
import { stripe } from "../lib/billing/stripe.js";
import { bucketForUser, proPriceIdForBucket } from "../lib/pricing.js";
import { trackEvent } from "../lib/analytics.js";
import { logger } from "../middleware/security.js";
import { API_PREFIX, prefixApiPath } from "../lib/api-prefix.js";

function getBaseUrl(req: Request) {
  const h = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = (req.headers["x-forwarded-proto"] as string) || "https";
  return `${proto}://${h}`;
}

export function mountBillingRoutes(app: Express, apiPrefix: string = API_PREFIX) {
  const route = (path: string) => prefixApiPath(path, apiPrefix);
  // returns which Pro price this user sees (A/B bucket)
  app.get(route("/billing/prices"), async (req: Request & { user?: unknown }, res: Response) => {
    const userId = (req.user as { id?: string | number } | undefined)?.id;
    const uid = String(userId ?? req.ip);
    const bucket = bucketForUser(uid);
    const proPriceId = proPriceIdForBucket(bucket);
    res.json({
      starter: { id: process.env.STRIPE_PRICE_STARTER || null, label: "$13.99" },
      pro: { id: proPriceId, bucket, label: "$24.99" }
    });
  });

  // creates a Stripe Checkout Session and returns url
  app.post(route("/billing/checkout"), async (req: Request & { user?: unknown }, res: Response) => {
    try {
      const user = req.user;
      if (!user) return res.status(401).json({ error: "unauthorized" });
      const uid = user.id.toString();
      const bucket = bucketForUser(uid);
      let priceId = req.body?.priceId as string | undefined;
      const allowedPriceIds = [
        process.env.STRIPE_PRICE_STARTER,
        process.env.STRIPE_PRICE_PRO_29,
        process.env.STRIPE_PRICE_PRO_39,
        process.env.STRIPE_PRICE_PRO_49,
      ].filter(Boolean) as string[];
      if (priceId) {
        if (!allowedPriceIds.includes(priceId)) {
          return res.status(400).json({ error: "invalid priceId" });
        }
      } else {
        priceId = proPriceIdForBucket(bucket);
      }

      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        payment_method_types: ["card"],
        line_items: [{ price: priceId, quantity: 1 }],
        customer_email: user.email || undefined,
        success_url: `${getBaseUrl(req)}/billing/success`,
        cancel_url: `${getBaseUrl(req)}/billing/cancel`,
        metadata: { userId: uid, bucket },
      });

      await trackEvent(user.id, "checkout_started", { priceId, bucket });
      res.json({ url: session.url });
    } catch (error) {
      logger.error('Stripe checkout error:', error);
      res.status(502).json({ message: "Checkout unavailable" });
    }
  });
}