import { stripe } from "../lib/billing/stripe.js";
import { bucketForUser, proPriceIdForBucket } from "../lib/pricing.js";
import { trackEvent } from "../lib/analytics.js";
function getBaseUrl(req) {
    const h = req.headers["x-forwarded-host"] || req.headers.host;
    const proto = req.headers["x-forwarded-proto"] || "https";
    return `${proto}://${h}`;
}
export function mountBillingRoutes(app) {
    // returns which Pro price this user sees (A/B bucket)
    app.get("/api/billing/prices", async (req, res) => {
        const uid = req.user?.id?.toString() || req.ip;
        const bucket = bucketForUser(uid);
        const proPriceId = proPriceIdForBucket(bucket);
        res.json({
            starter: { id: process.env.STRIPE_PRICE_STARTER || null, label: "$9.99" },
            pro: { id: proPriceId, bucket, label: "Pro" }
        });
    });
    // creates a Stripe Checkout Session and returns url
    app.post("/api/billing/checkout", async (req, res) => {
        const user = req.user;
        if (!user)
            return res.status(401).json({ error: "unauthorized" });
        const uid = user.id.toString();
        const bucket = bucketForUser(uid);
        const priceId = req.body?.priceId || proPriceIdForBucket(bucket);
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
    });
}
