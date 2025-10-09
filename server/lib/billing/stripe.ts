import Stripe from "stripe";
import { deriveStripeConfig } from "../../payments/stripe-config.js";
import { logger } from "../../bootstrap/logger.js";

let stripeConfig: ReturnType<typeof deriveStripeConfig> = null;

try {
  stripeConfig = deriveStripeConfig({
    env: process.env,
    logger,
  });
} catch (error) {
  const isDev = process.env.NODE_ENV === 'development';
  if (isDev) {
    logger.warn('Stripe configuration incomplete - payment features disabled in development');
  } else {
    // In production, Stripe is required
    throw error;
  }
}

export const stripe = stripeConfig ? new Stripe(stripeConfig.secretKey, {
  apiVersion: stripeConfig.apiVersion as Stripe.StripeConfig["apiVersion"],
}) : null;