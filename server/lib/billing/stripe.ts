import Stripe from "stripe";

const secret = process.env.STRIPE_SECRET_KEY;
if (!secret) {
  throw new Error("STRIPE_SECRET_KEY is required");
}

export const stripe = new Stripe(secret, {
  apiVersion: "2025-08-27.basil",
});