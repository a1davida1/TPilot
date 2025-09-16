import { describe, expect, test } from "vitest";
import { deriveStripeConfig, stripeErrorMessages } from "../../../server/payments/stripe-config.ts";

describe("deriveStripeConfig", () => {
  test("returns null when secret key is absent", () => {
    const errors: string[] = [];
    const logger = {
      error(message: string): any {
        errors.push(message);
        return {} as any;
      },
    };

    const config = deriveStripeConfig({
      env: {},
      logger,
    });

    expect(config).toBeNull();
    expect(errors).toHaveLength(0);
  });

  test("returns configuration when key and version are valid", () => {
    const errors: string[] = [];
    const logger = {
      error(message: string): any {
        errors.push(message);
        return {} as any;
      },
    };

    const config = deriveStripeConfig({
      env: {
        STRIPE_SECRET_KEY: "sk_test_123",
        STRIPE_API_VERSION: "2023-10-16",
      },
      logger,
    });

    expect(config).toEqual({
      secretKey: "sk_test_123",
      apiVersion: "2023-10-16",
    });
    expect(errors).toHaveLength(0);
  });

  test("throws when secret key exists but version is missing", () => {
    const errors: string[] = [];
    const logger = {
      error(message: string): any {
        errors.push(message);
        return {} as any;
      },
    };

    expect(() => {
      deriveStripeConfig({
        env: {
          STRIPE_SECRET_KEY: "sk_test_123",
        },
        logger,
      });
    }).toThrow(stripeErrorMessages.missingVersion);

    expect(errors).toContain(stripeErrorMessages.missingVersion);
  });

  test("throws when version format is invalid", () => {
    const errors: string[] = [];
    const logger = {
      error(message: string): any {
        errors.push(message);
        return {} as any;
      },
    };

    expect(() => {
      deriveStripeConfig({
        env: {
          STRIPE_SECRET_KEY: "sk_test_123",
          STRIPE_API_VERSION: "invalid-format",
        },
        logger,
      });
    }).toThrow(/must match the YYYY-MM-DD format/);

    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('STRIPE_API_VERSION "invalid-format" must match the YYYY-MM-DD format');
  });

  test("accepts valid date formats", () => {
    const logger = { error: (): any => ({} as any) };
    const validVersions = ["2023-10-16", "2024-01-01", "2025-12-31"];

    for (const version of validVersions) {
      const config = deriveStripeConfig({
        env: {
          STRIPE_SECRET_KEY: "sk_test_123",
          STRIPE_API_VERSION: version,
        },
        logger,
      });

      expect(config?.apiVersion).toBe(version);
    }
  });
});