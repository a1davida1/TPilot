import { Router, type Response } from 'express';
import Stripe from 'stripe';
import { authenticateToken, type AuthRequest } from '../middleware/auth.js';
import { logger } from '../bootstrap/logger.js';
import { db } from '../db.js';
import { users, billingHistory } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';

const router = Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: undefined, // Removed for compatibility
});

const PRICE_IDS = {
  starter: process.env.STRIPE_PRICE_ID_STARTER || '',
  pro: process.env.STRIPE_PRICE_ID_PRO || '',
  premium: process.env.STRIPE_PRICE_ID_PREMIUM || ''
};

/**
 * POST /api/payments/create-intent
 * Create a payment intent for subscription
 */
router.post('/create-intent', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    const { tier, priceId } = req.body;
    
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Get or create Stripe customer
    let customerId = req.user.stripeCustomerId;
    
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: req.user.email || undefined,
        metadata: {
          userId: req.user.id.toString(),
          username: req.user.username
        }
      });
      
      customerId = customer.id;
      
      // Save customer ID
      await db.update(users)
        .set({ stripeCustomerId: customerId })
        .where(eq(users.id, req.user.id));
    }

    // Create subscription
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: priceId || PRICE_IDS[tier as keyof typeof PRICE_IDS] }],
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent']
    });

    const invoice = subscription.latest_invoice as Stripe.Invoice;
    const paymentIntent = (invoice as any).payment_intent as Stripe.PaymentIntent;

    res.json({
      clientSecret: paymentIntent.client_secret,
      subscriptionId: subscription.id
    });

  } catch (error: any) {
    logger.error('Failed to create payment intent', { error, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to create payment' });
  }
});

/**
 * POST /api/payments/webhook
 * Stripe webhook handler
 */
router.post('/webhook', async (req, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || '';

  try {
    const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);

    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSuccess(event.data.object as Stripe.PaymentIntent);
        break;
      
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await handleSubscriptionUpdate(event.data.object as Stripe.Subscription);
        break;
      
      case 'customer.subscription.deleted':
        await handleSubscriptionCancelled(event.data.object as Stripe.Subscription);
        break;
      
      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object as Stripe.Invoice);
        break;
    }

    res.json({ received: true });
  } catch (error: any) {
    logger.error('Webhook error', { error: error.message });
    res.status(400).json({ error: 'Webhook error' });
  }
});

async function handlePaymentSuccess(paymentIntent: Stripe.PaymentIntent) {
  const customerId = paymentIntent.customer as string;
  
  // Find user by Stripe customer ID
  const [user] = await db.select()
    .from(users)
    .where(eq(users.stripeCustomerId, customerId))
    .limit(1);

  if (!user) {
    logger.error('User not found for customer', { customerId });
    return;
  }

  // Log billing history
  await db.insert(billingHistory).values({
    userId: user.id,
    amount: Math.floor(paymentIntent.amount / 100) // Convert from cents to dollars
  });

  logger.info('Payment succeeded', { userId: user.id, amount: paymentIntent.amount });
}

async function handleSubscriptionUpdate(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  
  const [user] = await db.select()
    .from(users)
    .where(eq(users.stripeCustomerId, customerId))
    .limit(1);

  if (!user) return;

  // Determine tier based on price ID
  let tier = 'free';
  const priceId = subscription.items.data[0]?.price.id;
  
  if (priceId === PRICE_IDS.starter) tier = 'starter';
  else if (priceId === PRICE_IDS.pro) tier = 'pro';
  else if (priceId === PRICE_IDS.premium) tier = 'premium';

  // Update user tier
  await db.update(users)
    .set({
      tier,
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status as any,
      updatedAt: new Date()
    })
    .where(eq(users.id, user.id));

  logger.info('Subscription updated', { userId: user.id, tier, status: subscription.status });
}

async function handleSubscriptionCancelled(subscription: Stripe.Subscription) {
  const customerId = subscription.customer as string;
  
  const [user] = await db.select()
    .from(users)
    .where(eq(users.stripeCustomerId, customerId))
    .limit(1);

  if (!user) return;

  // Downgrade to free tier
  await db.update(users)
    .set({
      tier: 'free',
      subscriptionStatus: 'cancelled',
      updatedAt: new Date()
    })
    .where(eq(users.id, user.id));

  logger.info('Subscription cancelled', { userId: user.id });
}

async function handlePaymentFailed(invoice: Stripe.Invoice) {
  const customerId = invoice.customer as string;
  
  const [user] = await db.select()
    .from(users)
    .where(eq(users.stripeCustomerId, customerId))
    .limit(1);

  if (!user) return;

  await db.update(users)
    .set({
      subscriptionStatus: 'past_due',
      updatedAt: new Date()
    })
    .where(eq(users.id, user.id));

  logger.warn('Payment failed', { userId: user.id, invoiceId: invoice.id });
}

/**
 * GET /api/payments/billing
 * Get user's billing history
 */
router.get('/billing', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const history = await db.select()
      .from(billingHistory)
      .where(eq(billingHistory.userId, req.user.id))
      .orderBy(desc(billingHistory.createdAt))
      .limit(20);

    res.json({ history });
  } catch (error: any) {
    logger.error('Failed to fetch billing history', { error, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to fetch billing history' });
  }
});

/**
 * POST /api/payments/cancel
 * Cancel subscription
 */
router.post('/cancel', authenticateToken(true), async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user?.id || !req.user.stripeSubscriptionId) {
      return res.status(400).json({ error: 'No active subscription' });
    }

    await stripe.subscriptions.cancel(req.user.stripeSubscriptionId);

    res.json({ message: 'Subscription cancelled' });
  } catch (error: any) {
    logger.error('Failed to cancel subscription', { error, userId: req.user?.id });
    res.status(500).json({ error: 'Failed to cancel subscription' });
  }
});

export { router as paymentsRouter };
