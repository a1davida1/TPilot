import crypto from "crypto";
import { env } from "./config.js";
import { db } from "../db.js";
import { subscriptions, invoices } from "@shared/schema.js";
import { eq } from "drizzle-orm";

export interface CCBillFormData {
  clientAccnum: string;
  clientSubacc: string;
  formName: string;
  currencyCode: string;
  formPrice: string;
  formPeriod: string;
  customerId: string;
  customerFname?: string;
  customerLname?: string;
  customerEmail?: string;
  formDigest: string;
}

export interface SubscriptionUpdate {
  subscriptionId: string;
  status: 'active' | 'past_due' | 'canceled';
  nextBillDate?: string;
  amount?: number;
  reason?: string;
}

export class CCBillProcessor {
  
  static generateFormData(
    userId: number,
    plan: 'pro' = 'pro',
    customerInfo?: {
      firstName?: string;
      lastName?: string;
      email?: string;
    }
  ): CCBillFormData {
    const price = plan === 'pro' ? '29.99' : '29.99';
    const period = '30'; // 30 days
    const currencyCode = '840'; // USD
    
    const formString = `${price}${period}${currencyCode}${env.CCBILL_SALT}`;
    const formDigest = crypto
      .createHash('md5')
      .update(formString)
      .digest('hex');
    
    return {
      clientAccnum: env.CCBILL_CLIENT_ACCOUNT || '',
      clientSubacc: env.CCBILL_SUBACCOUNT || '',
      formName: env.CCBILL_FLEXFORM_ID || '',
      currencyCode,
      formPrice: price,
      formPeriod: period,
      customerId: userId.toString(),
      customerFname: customerInfo?.firstName || '',
      customerLname: customerInfo?.lastName || '',
      customerEmail: customerInfo?.email || '',
      formDigest,
    };
  }
  
  static generateFormUrl(formData: CCBillFormData): string {
    const params = new URLSearchParams();
    
    Object.entries(formData).forEach(([key, value]) => {
      if (value) params.append(key, value);
    });
    
    return `https://api.ccbill.com/wap-frontflex/flexforms/${formData.formName}?${params.toString()}`;
  }
  
  static async handleWebhook(payload: Record<string, unknown>): Promise<{ success: boolean; message: string }> {
    try {
      const {
        eventType,
        subscription_id,
        customer_id,
        next_billing_date,
        billing_amount,
        reason_desc,
      } = payload;
      
      const userId = parseInt(customer_id);
      if (!userId) {
        return { success: false, message: 'Invalid customer ID' };
      }
      
      switch (eventType) {
        case 'NewSaleSuccess':
          await this.createSubscription(userId, subscription_id, {
            status: 'active',
            plan: 'pro',
            priceCents: Math.round(parseFloat(billing_amount) * 100),
            nextBillDate: next_billing_date ? new Date(next_billing_date) : new Date(),
          });
          break;
          
        case 'RenewalSuccess':
          await this.updateSubscription(subscription_id, {
            status: 'active',
            nextBillDate: next_billing_date,
            amount: Math.round(parseFloat(billing_amount) * 100),
          });
          break;
          
        case 'Cancellation':
        case 'Expiration':
          await this.updateSubscription(subscription_id, {
            status: 'canceled',
            reason: reason_desc,
          });
          break;
          
        case 'RenewalFailure':
          await this.updateSubscription(subscription_id, {
            status: 'past_due',
            reason: reason_desc,
          });
          break;
          
        default:
          console.warn(`Unhandled CCBill event: ${eventType}`);
      }
      
      return { success: true, message: 'Webhook processed successfully' };
      
    } catch (error) {
      console.error('CCBill webhook error:', error);
      return { success: false, message: 'Internal server error' };
    }
  }
  
  private static async createSubscription(
    userId: number,
    processorSubId: string,
    details: {
      status: string;
      plan: string;
      priceCents: number;
      nextBillDate: Date;
    }
  ) {
    await db.insert(subscriptions).values({
      userId,
      status: details.status as any,
      plan: details.plan as any,
      priceCents: details.priceCents,
      processor: 'ccbill',
      processorSubId,
      currentPeriodEnd: details.nextBillDate,
    });
    
    await db.insert(invoices).values({
      subscriptionId: (await this.getSubscriptionByProcessorId(processorSubId)).id,
      amountCents: details.priceCents,
      status: 'paid',
      processor: 'ccbill',
      processorRef: processorSubId,
    });
  }
  
  private static async updateSubscription(
    processorSubId: string,
    updates: Partial<SubscriptionUpdate>
  ) {
    const subscription = await this.getSubscriptionByProcessorId(processorSubId);
    if (!subscription) {
      throw new Error(`Subscription not found: ${processorSubId}`);
    }
    
    const updateData: any = {
      updatedAt: new Date(),
    };
    
    if (updates.status) updateData.status = updates.status;
    if (updates.nextBillDate) updateData.currentPeriodEnd = new Date(updates.nextBillDate);
    
    await db
      .update(subscriptions)
      .set(updateData)
      .where(eq(subscriptions.id, subscription.id));
      
    // Record invoice for successful payments
    if (updates.status === 'active' && updates.amount) {
      await db.insert(invoices).values({
        subscriptionId: subscription.id,
        amountCents: updates.amount,
        status: 'paid',
        processor: 'ccbill',
        processorRef: processorSubId,
      });
    }
  }
  
  private static async getSubscriptionByProcessorId(processorSubId: string) {
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.processorSubId, processorSubId))
      .limit(1);
      
    return subscription;
  }
  
  // Check if user has active subscription
  static async getUserSubscription(userId: number) {
    const [subscription] = await db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.userId, userId))
      .limit(1);
      
    return subscription;
  }
  
  static async isUserPro(userId: number): Promise<boolean> {
    const subscription = await this.getUserSubscription(userId);
    return subscription?.status === 'active' && subscription?.plan === 'pro';
  }
}