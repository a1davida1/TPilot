import { registerProcessor } from "../queue-factory.js";
import { QUEUE_NAMES, type DunningJobData } from "../queue/index.js";
import { db } from "../../db.js";
import { users, eventLogs, subscriptions } from "@shared/schema.js";
import { eq } from "drizzle-orm";
import { logger } from "../logger.js";
import fetch from "node-fetch";

interface RetryResult {
  success: boolean;
  provider: 'stripe' | 'ccbill';
  transactionId?: string;
  error?: string;
}

export class DunningWorker {
  private initialized = false;

  async initialize() {
    if (this.initialized) return;
    
    await registerProcessor<DunningJobData>(
      QUEUE_NAMES.DUNNING,
      this.processJob.bind(this),
      { concurrency: 1 } // Process 1 dunning job at a time to avoid overwhelming payment systems
    );
    
    this.initialized = true;
    logger.info('✅ Dunning worker initialized with queue abstraction');
  }

  private async processJob(jobData: unknown, jobId: string): Promise<void> {
    const { subscriptionId, attempt, maxAttempts = 3 } = jobData as DunningJobData;

    try {
      logger.info(`Processing dunning job for subscription ${subscriptionId}, attempt ${attempt}/${maxAttempts}`);

      // Get subscription details (would query subscriptions table in full implementation)
      const subscription = await this.getSubscriptionDetails(subscriptionId);
      if (!subscription) {
        throw new Error(`Subscription ${subscriptionId} not found`);
      }

      // Get user details
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, subscription.userId));

      if (!user) {
        throw new Error(`User ${subscription.userId} not found`);
      }

      // Attempt to retry payment
      const paymentResult = await this.retryPayment(subscription);

      if (paymentResult.success) {
        // Payment successful - reactivate subscription
        await this.reactivateSubscription(subscriptionId);
        
        // Log success event
        await this.logEvent(subscription.userId, 'dunning.payment_recovered', {
          subscriptionId,
          attempt,
          paymentResult,
        });

        // Send success notification
        await this.sendRecoveryNotification(user, subscription);

        logger.info(`Dunning payment recovered for subscription ${subscriptionId}`);

      } else if (attempt < maxAttempts) {
        // Payment failed but we have more attempts
        const nextAttempt = attempt + 1;
        await this.scheduleNextAttempt(subscriptionId, nextAttempt, maxAttempts);

        // Log retry event
        await this.logEvent(subscription.userId, 'dunning.retry_scheduled', {
          subscriptionId,
          attempt,
          nextAttempt,
          error: paymentResult.error,
        });

        logger.info(`Dunning retry scheduled for subscription ${subscriptionId}, next attempt: ${nextAttempt}`);

      } else {
        // Max attempts reached - suspend subscription
        await this.suspendSubscription(subscriptionId);

        // Log final failure event
        await this.logEvent(subscription.userId, 'dunning.subscription_suspended', {
          subscriptionId,
          totalAttempts: attempt,
          finalError: paymentResult.error,
        });

        // Send suspension notification
        await this.sendSuspensionNotification(user, subscription);

        logger.info(`Subscription ${subscriptionId} suspended after ${attempt} attempts`);
      }

    } catch (error: unknown) {
      logger.error(`Dunning job for subscription ${subscriptionId} failed:`, { error });

      // Log failure event
      await this.logEvent(0, 'dunning.system_error', {
        subscriptionId,
        attempt,
        error: error instanceof Error ? error.message : 'Unknown error',
      });

      throw error;
    }
  }

  private async getSubscriptionDetails(subscriptionId: number) {
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.id, subscriptionId))
      .limit(1);
    return subscription ?? null;
  }

  private async retryPayment(subscription: any): Promise<RetryResult> {
    try {
      logger.info(`Attempting payment retry for subscription ${subscription.id}`);
      
      // Try to process payment using the configured payment provider
      if (process.env.STRIPE_SECRET_KEY && subscription.stripeCustomerId) {
        return await this.retryStripePayment(subscription);
      } else if (process.env.CCBILL_ACCOUNT_NUMBER && subscription.ccbillSubscriptionId) {
        return await this.retryCCBillPayment(subscription);
      } else {
        logger.warn('No payment provider configured for retry');
        return { success: false, provider: 'stripe', error: 'No payment method available for retry' };
      }
    } catch (error: unknown) {
      logger.error('Payment retry error:', { error });
      return { success: false, provider: 'stripe', error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private async retryStripePayment(subscription: any): Promise<RetryResult> {
    try {
      const { default: Stripe } = await import('stripe');
      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
      
      // Attempt to charge the customer's default payment method
      const paymentIntent = await stripe.paymentIntents.create({
        amount: subscription.amount,
        currency: 'usd',
        customer: subscription.stripeCustomerId,
        payment_method: subscription.paymentMethodId,
        confirm: true,
        off_session: true, // Indicates this is for an existing customer
      });

      if (paymentIntent.status === 'succeeded') {
        return { 
          success: true, 
          transactionId: paymentIntent.id,
          provider: 'stripe'
        };
      } else {
        return { 
          success: false, 
          error: `Payment failed: ${paymentIntent.status}`,
          provider: 'stripe'
        };
      }
    } catch (error: any) {
      const errorMessage = error?.decline_code || error?.message || 'Payment failed';
      return { success: false, error: errorMessage, provider: 'stripe' };
    }
  }

  private async retryCCBillPayment(subscription: any): Promise<RetryResult> {
    try {
      const res = await fetch('https://datalink.ccbill.com/', {
        method: 'POST',
        body: new URLSearchParams({
          subscriptionId: subscription.ccbillSubscriptionId,
          amount: String(subscription.amount),
        }),
      });
      if (!res.ok) {
        return { success: false, provider: 'ccbill', error: `HTTP ${res.status}` };
      }
      const data = await res.json();
      return {
        success: Boolean(data.success),
        transactionId: data.id,
        provider: 'ccbill',
      };
    } catch (error: unknown) {
      return {
        success: false,
        provider: 'ccbill',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async reactivateSubscription(subscriptionId: number) {
    // In full implementation, update subscriptions table status to 'active'
    logger.info(`Reactivating subscription ${subscriptionId}`);
    
    // Update user tier if needed
    // await db.update(users).set({ tier: 'pro' }).where(eq(users.id, userId));
  }

  private async suspendSubscription(subscriptionId: number) {
    // In full implementation, update subscriptions table status to 'suspended'
    logger.info(`Suspending subscription ${subscriptionId}`);
    
    // Downgrade user tier
    // await db.update(users).set({ tier: 'free' }).where(eq(users.id, userId));
  }

  private async scheduleNextAttempt(subscriptionId: number, nextAttempt: number, maxAttempts: number) {
    try {
      const { addJob } = await import("../queue/index.js");
      
      // Progressive delay: 1 day, 3 days, 7 days
      const delays = [1, 3, 7]; // days
      const delayDays = delays[nextAttempt - 1] || 7;
      const delayMs = delayDays * 24 * 60 * 60 * 1000;

      await addJob(QUEUE_NAMES.DUNNING, {
        subscriptionId,
        attempt: nextAttempt,
        maxAttempts,
      } as DunningJobData, {
        delay: delayMs,
      });

      logger.info(`Scheduled dunning attempt ${nextAttempt} for subscription ${subscriptionId} in ${delayDays} days`);

    } catch (error) {
      logger.error('Failed to schedule next dunning attempt:', { error });
    }
  }

  private async sendRecoveryNotification(user: unknown, subscription: unknown) {
    // In full implementation, this would send an email
    logger.info(`Sending recovery notification to ${(user as any).email} for subscription ${(subscription as any).id}`);
    
    // Would integrate with email service (SendGrid, etc.)
    // await EmailService.send({
    //   to: user.email,
    //   template: 'payment-recovered',
    //   data: { user, subscription }
    // });
  }

  private async sendSuspensionNotification(user: unknown, subscription: unknown) {
    // In full implementation, this would send an email
    logger.info(`Sending suspension notification to ${(user as any).email} for subscription ${(subscription as any).id}`);
    
    // Would integrate with email service
    // await EmailService.send({
    //   to: user.email,
    //   template: 'subscription-suspended',
    //   data: { user, subscription }
    // });
  }

  private async logEvent(userId: number, type: string, meta: unknown) {
    try {
      await db.insert(eventLogs).values({
        userId,
        type,
        meta,
      });
    } catch (error) {
      logger.error('Failed to log dunning event:', { error });
    }
  }

  async close() {
    this.initialized = false;
  }
}

// Export singleton instance
export const dunningWorker = new DunningWorker();

// Initialize the dunning worker
export async function initializeDunningWorker() {
  await dunningWorker.initialize();
}