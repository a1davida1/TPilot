import type { Express, Request, Response } from "express";
import { stripe } from "../lib/billing/stripe.js";
import { db } from "../db.js";
import { subscriptions, invoices, users } from "../../shared/schema.js";
import { eq } from "drizzle-orm";

export function mountStripeWebhook(app: Express) {
  // IMPORTANT: raw body for Stripe signature verification. Ensure your server uses express.raw on this path.
  app.post("/api/webhooks/stripe", async (req: Request, res: Response) => {
    const sig = req.headers["stripe-signature"] as string;
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body as Buffer, sig, process.env.STRIPE_WEBHOOK_SECRET!);
    } catch (err: unknown) {
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    switch (event.type) {
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as any;
        const uid = Number(sub.metadata?.userId);
        const plan = (sub.items?.data?.[0]?.price?.nickname || sub.items?.data?.[0]?.price?.metadata?.plan || "pro").toLowerCase();

        if (uid) {
          // upsert subscription
          await db.insert(subscriptions).values({
            userId: uid,
            status: sub.status,
            plan: plan,
            priceCents: (sub.items?.data?.[0]?.price?.unit_amount ?? 0),
            processor: "stripe",
            processorSubId: sub.id
          }).onConflictDoUpdate({
            target: subscriptions.userId,
            set: {
              status: sub.status, plan,
              priceCents: (sub.items?.data?.[0]?.price?.unit_amount ?? 0),
              processor: "stripe",
              processorSubId: sub.id
            }
          });

          // mirror to users.tier for quick checks
          const newTier = sub.status === "active" ? plan : "starter";
          await db.update(users).set({ tier: newTier }).where(eq(users.id, uid));
        }
        break;
      }

      case "invoice.paid":
      case "invoice.payment_failed": {
        const inv = event.data.object as any;
        const uid = Number(inv.metadata?.userId);
        if (uid) {
          await db.insert(invoices).values({
            subscriptionId: 0, // unknown without join; keep 0 or extend schema/lookup if needed
            amountCents: inv.amount_paid ?? 0,
            status: inv.paid ? "paid" : "failed",
            processor: "stripe",
            processorRef: inv.id
          }).catch(()=>{});
        }
        break;
      }
    }
    res.json({ received: true });
  });
}