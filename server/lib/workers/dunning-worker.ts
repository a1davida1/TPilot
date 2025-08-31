import { registerProcessor } from "../queue-factory.js";
import { QUEUE_NAMES, type DunningJobData } from "../queue/index.js";
import { db } from "../../db.js";
import { users, eventLogs } from "@shared/schema.js";
import { eq } from "drizzle-orm";
import { logger } from "../logger.js";

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

  private async processJob(jobData: unknown, jobId: string) {
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

        return { success: true, recovered: true };

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

        return { success: true, retry: true, nextAttempt };

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

        return { success: true, suspended: true };
      }

    } catch (error: any) {
      console.error(`Dunning job for subscription ${subscriptionId} failed:`, error);

      // Log failure event
      await this.logEvent(0, 'dunning.system_error', {
        subscriptionId,
        attempt,
        error: error.message,
      });

      throw error;
    }
  }

  private async getSubscriptionDetails(subscriptionId: number) {
    // In full implementation, this would query a subscriptions table
    // For now, return mock data
    return {
      id: subscriptionId,
      userId: 1, // Mock user ID
      plan: 'pro',
      status: 'past_due',
      paymentMethodId: 'pm_123',
      amount: 2999, // $29.99
    };
  }

  private async retryPayment(subscription: any) {
    try {
      console.log(`Attempting payment retry for subscription ${subscription.id}`);
      
      // Try to process payment using the configured payment provider
      if (process.env.STRIPE_SECRET_KEY && subscription.stripeCustomerId) {
        return await this.retryStripePayment(subscription);
      } else if (process.env.CCBILL_ACCOUNT_NUMBER && subscription.ccbillSubscriptionId) {
        return await this.retryCCBillPayment(subscription);
      } else {
        console.warn('No payment provider configured for retry');
        return { success: false, error: 'No payment method available for retry' };
      }
    } catch (error: any) {
      console.error('Payment retry error:', error);
      return { success: false, error: error.message };
    }
  }

  private async retryStripePayment(subscription: any) {
    try {
      const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
      
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
      const errorMessage = error.decline_code || error.message || 'Payment failed';
      return { success: false, error: errorMessage, provider: 'stripe' };
    }
  }

  private async retryCCBillPayment(subscription: any) {
    try {
      // CCBill retry would use their API to process a new transaction
      console.log(`Retrying CCBill payment for subscription ${subscription.ccbillSubscriptionId}`);
      
      // For now, log that CCBill retry is not yet implemented
      return { 
        success: false, 
        error: 'CCBill retry not yet implemented',
        provider: 'ccbill'
      };
    } catch (error: any) {
      return { success: false, error: error.message, provider: 'ccbill' };
    }
  }

  private async reactivateSubscription(subscriptionId: number) {
    // In full implementation, update subscriptions table status to 'active'
    console.log(`Reactivating subscription ${subscriptionId}`);
    
    // Update user tier if needed
    // await db.update(users).set({ tier: 'pro' }).where(eq(users.id, userId));
  }

  private async suspendSubscription(subscriptionId: number) {
    // In full implementation, update subscriptions table status to 'suspended'
    console.log(`Suspending subscription ${subscriptionId}`);
    
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

      console.log(`Scheduled dunning attempt ${nextAttempt} for subscription ${subscriptionId} in ${delayDays} days`);

    } catch (error) {
      console.error('Failed to schedule next dunning attempt:', error);
    }
  }

  private async sendRecoveryNotification(user: any, subscription: any) {
    // In full implementation, this would send an email
    console.log(`Sending recovery notification to ${user.email} for subscription ${subscription.id}`);
    
    // Would integrate with email service (SendGrid, etc.)
    // await EmailService.send({
    //   to: user.email,
    //   template: 'payment-recovered',
    //   data: { user, subscription }
    // });
  }

  private async sendSuspensionNotification(user: any, subscription: any) {
    // In full implementation, this would send an email
    console.log(`Sending suspension notification to ${user.email} for subscription ${subscription.id}`);
    
    // Would integrate with email service
    // await EmailService.send({
    //   to: user.email,
    //   template: 'subscription-suspended',
    //   data: { user, subscription }
    // });
  }

  private async logEvent(userId: number, type: string, meta: any) {
    try {
      await db.insert(eventLogs).values({
        userId,
        type,
        meta,
      });
    } catch (error) {
      console.error('Failed to log dunning event:', error);
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