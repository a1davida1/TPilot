import Stripe from "stripe";

// Use placeholder key if STRIPE_SECRET_KEY is not configured
const stripeSecretKey = process.env.STRIPE_SECRET_KEY || "sk_test_placeholder_key_for_development_only";

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn("⚠️ STRIPE_SECRET_KEY not configured. Stripe billing functionality disabled.");
}

export const stripe = new Stripe(stripeSecretKey, {
  apiVersion: "2024-06-20",
});