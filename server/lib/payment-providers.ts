/**
 * Phase 5: Multi-Payment Provider Rails
 * Scaffolds for additional payment processors beyond CCBill
 */

import { env } from './config';
import crypto from 'crypto';

export interface PaymentProvider {
  name: string;
  isConfigured: boolean;
  supportedCurrencies: string[];
  features: {
    subscriptions: boolean;
    oneTime: boolean;
    cryptocurrencies?: boolean;
    regionalSupport?: string[];
  };
}

export interface PaymentLinkOptions {
  amount: number;
  currency: string;
  description: string;
  userId: number;
  subscriptionType?: 'pro' | 'pro_plus';
  isRecurring?: boolean;
  returnUrl?: string;
  cancelUrl?: string;
}

export interface PaymentResult {
  success: boolean;
  paymentUrl?: string;
  transactionId?: string;
  error?: string;
  provider: string;
}

/**
 * Abstract base class for payment providers
 */
abstract class BasePaymentProvider {
  abstract name: string;
  abstract isConfigured: boolean;
  
  abstract generatePaymentLink(options: PaymentLinkOptions): Promise<PaymentResult>;
  abstract verifyWebhook(signature: string, payload: Record<string, unknown>): Promise<boolean>;
  abstract processWebhook(payload: Record<string, unknown>): Promise<{
    userId: number;
    subscriptionType: string;
    status: 'active' | 'cancelled' | 'failed';
    transactionId: string;
  }>;
}

/**
 * SegPay Payment Provider (Adult Industry Focus)
 */
export class SegPayProvider extends BasePaymentProvider {
  name = 'SegPay';
  
  get isConfigured(): boolean {
    return !!(env.SEGPAY_MERCHANT_ID && env.SEGPAY_API_KEY && 
      typeof env.SEGPAY_MERCHANT_ID === 'string' && env.SEGPAY_MERCHANT_ID.length > 0 &&
      typeof env.SEGPAY_API_KEY === 'string' && env.SEGPAY_API_KEY.length > 0);
  }

  async generatePaymentLink(options: PaymentLinkOptions): Promise<PaymentResult> {
    if (!this.isConfigured) {
      return {
        success: false,
        error: 'SegPay not configured',
        provider: this.name,
      };
    }

    try {
      // SegPay API integration would go here
      // This is a scaffold implementation
      const paymentUrl = `https://segpay.com/checkout?merchant=${env.SEGPAY_MERCHANT_ID}&amount=${options.amount}&user=${options.userId}`;
      
      return {
        success: true,
        paymentUrl,
        transactionId: `segpay_${Date.now()}_${options.userId}`,
        provider: this.name,
      };
    } catch (_error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'SegPay payment failed',
        provider: this.name,
      };
    }
  }

  async verifyWebhook(signature: string, payload: unknown): Promise<boolean> {
    // SegPay webhook verification would go here
    return true; // Scaffold implementation
  }

  async processWebhook(payload: Record<string, unknown>) {
    // SegPay webhook processing would go here
    return {
      userId: Number(payload.userId),
      subscriptionType: String(payload.subscriptionType),
      status: String(payload.status) as 'active' | 'failed' | 'cancelled',
      transactionId: String(payload.transactionId),
    };
  }
}

/**
 * Epoch Payment Provider (Adult Industry Focus)
 */
export class EpochProvider extends BasePaymentProvider {
  name = 'Epoch';
  
  get isConfigured(): boolean {
    return !!(env.EPOCH_MERCHANT_ID && env.EPOCH_API_KEY && 
      typeof env.EPOCH_MERCHANT_ID === 'string' && env.EPOCH_MERCHANT_ID.length > 0 &&
      typeof env.EPOCH_API_KEY === 'string' && env.EPOCH_API_KEY.length > 0);
  }

  async generatePaymentLink(options: PaymentLinkOptions): Promise<PaymentResult> {
    if (!this.isConfigured) {
      return {
        success: false,
        error: 'Epoch not configured',
        provider: this.name,
      };
    }

    try {
      // Epoch API integration would go here
      const paymentUrl = `https://epoch.com/checkout?merchant=${env.EPOCH_MERCHANT_ID}&amount=${options.amount}&user=${options.userId}`;
      
      return {
        success: true,
        paymentUrl,
        transactionId: `epoch_${Date.now()}_${options.userId}`,
        provider: this.name,
      };
    } catch (_error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Epoch payment failed',
        provider: this.name,
      };
    }
  }

  async verifyWebhook(signature: string, payload: unknown): Promise<boolean> {
    return true; // Scaffold implementation
  }

  async processWebhook(payload: Record<string, unknown>) {
    return {
      userId: Number(payload.userId),
      subscriptionType: String(payload.subscriptionType),
      status: String(payload.status) as 'active' | 'failed' | 'cancelled',
      transactionId: String(payload.transactionId),
    };
  }
}

/**
 * Paxum Payment Provider (Adult Industry & Crypto)
 */
export class PaxumProvider extends BasePaymentProvider {
  name = 'Paxum';
  
  get isConfigured(): boolean {
    return !!(env.PAXUM_API_KEY && 
      typeof env.PAXUM_API_KEY === 'string' && env.PAXUM_API_KEY.length > 0);
  }

  async generatePaymentLink(options: PaymentLinkOptions): Promise<PaymentResult> {
    if (!this.isConfigured) {
      return {
        success: false,
        error: 'Paxum not configured',
        provider: this.name,
      };
    }

    try {
      const response = await fetch('https://www.paxum.com/payment/api/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${env.PAXUM_API_KEY}`,
        },
        body: JSON.stringify({
          amount: options.amount,
          currency: options.currency,
          description: options.description,
          custom: options.userId,
          return_url: options.returnUrl,
          cancel_url: options.cancelUrl,
        }),
      });
      if (!response.ok) {
        throw new Error(`Paxum responded with ${response.status}`);
      }
      const data = await response.json();
      return {
        success: true,
        paymentUrl: data.url,
        transactionId: data.transactionId,
        provider: this.name,
      };
    } catch (_error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Paxum payment failed',
        provider: this.name,
      };
    }
  }

  async verifyWebhook(signature: string, payload: Record<string, unknown>): Promise<boolean> {
    const hmac = crypto.createHmac('sha256', env.PAXUM_API_KEY || '');
    hmac.update(JSON.stringify(payload));
    return hmac.digest('hex') === signature;
  }

  async processWebhook(payload: Record<string, unknown>): Promise<{ userId: number; subscriptionType: string; status: 'active' | 'cancelled' | 'failed'; transactionId: string; }> {
    return {
      userId: Number((payload as Record<string, unknown>).custom),
      subscriptionType: String((payload as Record<string, unknown>).plan || ''),
      status: (payload as Record<string, unknown>).status as 'active' | 'cancelled' | 'failed',
      transactionId: String((payload as Record<string, unknown>).transactionId || ''),
    };
  }
}

/**
 * Coinbase Commerce Provider (Cryptocurrency)
 */
export class CoinbaseProvider extends BasePaymentProvider {
  name = 'Coinbase Commerce';
  
  get isConfigured(): boolean {
    return !!(env.COINBASE_COMMERCE_KEY && 
      typeof env.COINBASE_COMMERCE_KEY === 'string' && env.COINBASE_COMMERCE_KEY.length > 0);
  }

  async generatePaymentLink(options: PaymentLinkOptions): Promise<PaymentResult> {
    if (!this.isConfigured) {
      return {
        success: false,
        error: 'Coinbase Commerce not configured',
        provider: this.name,
      };
    }

    try {
      const response = await fetch('https://api.commerce.coinbase.com/charges', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CC-Api-Key': env.COINBASE_COMMERCE_KEY || '',
          'X-CC-Version': '2018-03-22',
        },
        body: JSON.stringify({
          name: 'Subscription',
          description: options.description,
          pricing_type: 'fixed_price',
          local_price: { amount: options.amount, currency: options.currency },
          metadata: { userId: options.userId, subscriptionType: options.subscriptionType },
          redirect_url: options.returnUrl,
          cancel_url: options.cancelUrl,
        }),
      });
      if (!response.ok) {
        throw new Error(`Coinbase responded with ${response.status}`);
      }
      const data = await response.json();
      return {
        success: true,
        paymentUrl: data.data.hosted_url,
        transactionId: data.data.id,
        provider: this.name,
      };
    } catch (_error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Coinbase payment failed',
        provider: this.name,
      };
    }
  }

  async verifyWebhook(signature: string, payload: Record<string, unknown>): Promise<boolean> {
    const hmac = crypto.createHmac('sha256', env.COINBASE_COMMERCE_KEY || '');
    hmac.update(JSON.stringify(payload));
    return hmac.digest('hex') === signature;
  }

  async processWebhook(payload: Record<string, unknown>): Promise<{ userId: number; subscriptionType: string; status: 'active' | 'cancelled' | 'failed'; transactionId: string; }> {
    const event = (payload as { event?: { data?: Record<string, unknown>; } }).event;
    const data = event?.data ?? {};
    const timeline = (data as { timeline?: Array<{ status: string }> }).timeline || [];
    const status = timeline.length ? timeline[timeline.length - 1].status : 'failed';
    return {
      userId: Number((data as { metadata?: Record<string, unknown> }).metadata?.userId),
      subscriptionType: String((data as { metadata?: Record<string, unknown> }).metadata?.subscriptionType || ''),
      status: status as 'active' | 'cancelled' | 'failed',
      transactionId: String((data as { id?: unknown }).id || ''),
    };
  }
}

/**
 * Payment Provider Manager
 */
export class PaymentProviderManager {
  private providers: BasePaymentProvider[] = [
    new SegPayProvider(),
    new EpochProvider(), 
    new PaxumProvider(),
    new CoinbaseProvider(),
  ];

  /**
   * Get all available payment providers
   */
  getAvailableProviders(): PaymentProvider[] {
    return this.providers.map(p => ({
      name: p.name,
      isConfigured: p.isConfigured,
      supportedCurrencies: this.getSupportedCurrencies(p.name),
      features: this.getProviderFeatures(p.name),
    }));
  }

  /**
   * Get configured providers only
   */
  getConfiguredProviders(): BasePaymentProvider[] {
    return this.providers.filter(p => p.isConfigured);
  }

  /**
   * Generate payment link using the best available provider
   */
  async generatePaymentLink(options: PaymentLinkOptions): Promise<PaymentResult> {
    const configuredProviders = this.getConfiguredProviders();
    
    if (configuredProviders.length === 0) {
      return {
        success: false,
        error: 'No payment providers configured',
        provider: 'none',
      };
    }

    // Try providers in priority order
    for (const provider of configuredProviders) {
      try {
        const result = await provider.generatePaymentLink(options);
        if (result.success) {
          return result;
        }
      } catch (_error) {
        console.error(`Payment provider ${provider.name} failed:`, error);
        continue;
      }
    }

    return {
      success: false,
      error: 'All payment providers failed',
      provider: 'multiple',
    };
  }

  /**
   * Get provider by name
   */
  getProvider(name: string): BasePaymentProvider | undefined {
    return this.providers.find(p => p.name.toLowerCase() === name.toLowerCase());
  }

  private getSupportedCurrencies(providerName: string): string[] {
    switch (providerName) {
      case 'SegPay':
      case 'Epoch':
        return ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];
      case 'Paxum':
        return ['USD', 'EUR', 'BTC', 'ETH'];
      case 'Coinbase Commerce':
        return ['BTC', 'ETH', 'LTC', 'BCH', 'USDC'];
      default:
        return ['USD'];
    }
  }

  private getProviderFeatures(providerName: string) {
    switch (providerName) {
      case 'SegPay':
        return {
          subscriptions: true,
          oneTime: true,
          regionalSupport: ['US', 'EU', 'UK', 'CA'],
        };
      case 'Epoch':
        return {
          subscriptions: true,
          oneTime: true,
          regionalSupport: ['US', 'EU', 'UK', 'AU'],
        };
      case 'Paxum':
        return {
          subscriptions: true,
          oneTime: true,
          cryptocurrencies: true,
          regionalSupport: ['Global'],
        };
      case 'Coinbase Commerce':
        return {
          subscriptions: false,
          oneTime: true,
          cryptocurrencies: true,
          regionalSupport: ['Global'],
        };
      default:
        return {
          subscriptions: false,
          oneTime: true,
        };
    }
  }
}

// Export singleton instance
export const paymentManager = new PaymentProviderManager();