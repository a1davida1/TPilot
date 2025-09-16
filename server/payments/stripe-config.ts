import type { Logger } from "winston";

const STRIPE_VERSION_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

export interface StripeEnvironment {
  STRIPE_SECRET_KEY?: string;
  STRIPE_API_VERSION?: string;
  [key: string]: string | undefined;
}

export interface StripeConfiguration {
  secretKey: string;
  apiVersion: string;
}

export interface StripeConfigOptions {
  env: StripeEnvironment;
  logger: Pick<Logger, "error">;
}

const missingVersionMessage =
  "STRIPE_API_VERSION is required when STRIPE_SECRET_KEY is set. Provide a date in YYYY-MM-DD format (e.g. 2023-10-16).";

export function deriveStripeConfig({ env, logger }: StripeConfigOptions): StripeConfiguration | null {
  const secretKey = env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    return null;
  }

  const apiVersion = env.STRIPE_API_VERSION;

  if (!apiVersion) {
    logger.error(missingVersionMessage);
    throw new Error(missingVersionMessage);
  }

  if (!STRIPE_VERSION_PATTERN.test(apiVersion)) {
    const message = `STRIPE_API_VERSION "${apiVersion}" must match the YYYY-MM-DD format (e.g. 2023-10-16).`;
    logger.error(message);
    throw new Error(message);
  }

  return { secretKey, apiVersion };
}

export const stripeErrorMessages = {
  missingVersion: missingVersionMessage,
};