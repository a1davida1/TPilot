import Stripe from "stripe";
import { deriveStripeConfig } from "../../payments/stripe-config.js";
import { logger } from "../logger.js";

const stripeConfig = deriveStripeConfig({
  env: process.env,
  logger,
});

if (!stripeConfig) {
  throw new Error("STRIPE_SECRET_KEY is required");
}

export const stripe = new Stripe(stripeConfig.secretKey, {
  apiVersion: stripeConfig.apiVersion as Stripe.StripeConfig["apiVersion"],
});