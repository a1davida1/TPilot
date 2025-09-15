import { Request, Response } from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { leads, insertLeadSchema } from '@shared/schema';
import { verifyTurnstileToken } from '../lib/turnstile.js';
import { parseUTMFromCookie, parseUTMFromURL, mergeUTMParams, UTMParams } from '../lib/utm.js';
import { sendDoubleOptInEmail } from '../lib/mailer.js';
import { emailService } from '../services/email-service.js';
import { createConfirmToken, verifyConfirmToken } from '../lib/tokens.js';
import { trackEvent } from '../lib/analytics.js';
import { eq } from 'drizzle-orm';

// Validation schema for lead creation
const createLeadSchema = z.object({
  email: z.string().email(),
  platformTags: z.array(z.string()),
  painPoint: z.string().optional(),
  turnstileToken: z.string().min(1, 'Anti-bot verification required'),
  currentUrl: z.string().url().optional(),
}) as z.ZodTypeAny;

export async function createLead(req: Request, res: Response) {
  try {
    // Parse and validate request body
    const validation = createLeadSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: validation.error.issues,
      });
    }

    const { turnstileToken, currentUrl, email, platformTags, painPoint } = validation.data;

    // Verify Turnstile token
    const userIP = req.ip || req.connection.remoteAddress;
    const turnstileValid = await verifyTurnstileToken(turnstileToken, userIP);
    if (!turnstileValid) {
      return res.status(400).json({ error: 'Anti-bot verification failed' });
    }

    // Parse UTM parameters from cookie and current URL - handle missing cookies
    let cookieUTM: Partial<UTMParams> = {};
    try {
      if (req.cookies && req.cookies.utm_params) {
        cookieUTM = JSON.parse(decodeURIComponent(req.cookies.utm_params));
      }
    } catch (error) {
      console.log('Failed to parse UTM cookie:', error);
      cookieUTM = {};
    }
    
    const urlUTM = currentUrl ? parseUTMFromURL(currentUrl) : {};
    
    // Add referrer from headers
    const referrer = req.get('Referer') || req.get('Referrer');
    if (referrer) {
      urlUTM.referrer = referrer;
    }

    const mergedUTM = mergeUTMParams(cookieUTM as UTMParams, urlUTM as UTMParams);

    // Generate unique ID for lead (under 25 chars for DB)
    const leadId = `L${Date.now().toString(36).substr(-8)}${Math.random().toString(36).substr(2, 4)}`;
    
    // Prepare lead data - ensure platformTags is proper string array
    const leadData = {
      id: leadId,
      email,
      platformTags: Array.isArray(platformTags) ? [...platformTags] : (platformTags ? [String(platformTags)] : []),
      painPoint,
      ...mergedUTM,
    };

    // Upsert lead (update if exists, create if not)
    const [lead] = await db
      .insert(leads)
      .values(leadData)
      .onConflictDoUpdate({
        target: leads.email,
        set: {
          platformTags: Array.isArray(leadData.platformTags) ? leadData.platformTags as string[] : [],
          painPoint: leadData.painPoint || null,
          utmSource: leadData.utmSource || null,
          utmMedium: leadData.utmMedium || null,
          utmCampaign: leadData.utmCampaign || null,
          utmContent: leadData.utmContent || null,
          utmTerm: leadData.utmTerm || null,
          referrer: leadData.referrer || null,
          // Keep original createdAt, don't update it
        },
      })
      .returning();

    // Create confirmation token
    const confirmToken = createConfirmToken(email);

    // Send double opt-in email
    const emailSent = await sendDoubleOptInEmail(email, confirmToken);
    if (!emailSent) {
      console.error('Failed to send confirmation email for:', email);
    }

    // Send admin notification
    const adminNotificationSent = await emailService.sendAdminWaitlistNotification(
      email,
      leadData.platformTags,
      painPoint || null,
      mergedUTM
    );

    // Track analytics event
    trackEvent(null, 'lead_created', {
      email,
      platformTags,
      painPoint: painPoint ? 'provided' : 'not_provided',
      utmSource: mergedUTM.utmSource,
      utmMedium: mergedUTM.utmMedium,
      utmCampaign: mergedUTM.utmCampaign,
      emailSent,
      adminNotificationSent,
    });

    res.json({
      success: true,
      message: 'Thank you for joining our waitlist! Please check your email to confirm your signup.',
    });

  } catch (error) {
    console.error('Create lead error:', error);
    res.status(500).json({ error: 'Failed to process waitlist signup' });
  }
}

export async function confirmLead(req: Request, res: Response) {
  try {
    const { token } = req.query;
    
    if (!token || typeof token !== 'string') {
      return res.status(400).send(`
        <html>
          <head><title>Invalid Link</title></head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; text-align: center; padding: 50px;">
            <h1>❌ Invalid confirmation link</h1>
            <p>The confirmation link is malformed or missing.</p>
          </body>
        </html>
      `);
    }

    // Verify token
    const verification = verifyConfirmToken(token);
    if (!verification.valid) {
      const message = verification.expired 
        ? 'This confirmation link has expired. Please sign up again.'
        : 'This confirmation link is invalid or has been used already.';
        
      return res.status(400).send(`
        <html>
          <head><title>Link Issue</title></head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; text-align: center; padding: 50px;">
            <h1>⚠️ ${verification.expired ? 'Link Expired' : 'Invalid Link'}</h1>
            <p>${message}</p>
            <a href="/" style="color: #667eea; text-decoration: none;">← Return to homepage</a>
          </body>
        </html>
      `);
    }

    // Update lead confirmation
    const [updatedLead] = await db
      .update(leads)
      .set({ confirmedAt: new Date() })
      .where(eq(leads.email, verification.email!))
      .returning();

    if (!updatedLead) {
      return res.status(404).send(`
        <html>
          <head><title>Lead Not Found</title></head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; text-align: center; padding: 50px;">
            <h1>❌ Lead not found</h1>
            <p>We couldn't find your waitlist signup. Please try signing up again.</p>
            <a href="/" style="color: #667eea; text-decoration: none;">← Return to homepage</a>
          </body>
        </html>
      `);
    }

    // Track analytics event
    trackEvent(null, 'lead_confirmed', {
      email: verification.email,
      confirmedAt: updatedLead.confirmedAt,
    });

    // Return thank you page with survey link
    res.send(`
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Email Confirmed - ThottoPilot</title>
      </head>
      <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
        <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; margin-top: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 32px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">🎉 Welcome to ThottoPilot!</h1>
          </div>
          
          <div style="padding: 40px 32px; text-align: center;">
            <h2 style="color: #1a202c; font-size: 24px; margin: 0 0 16px 0; font-weight: 600;">Email Confirmed Successfully!</h2>
            
            <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
              Thank you for confirming your email! You're now on the waitlist for ThottoPilot.
            </p>
            
            <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin: 0 0 32px 0;">
              We'll notify you as soon as we launch. In the meantime, help us build the perfect product for you:
            </p>
            
            <div style="margin: 32px 0;">
              <a href="https://forms.gle/thottopilot-launch-survey" 
                 style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Take 30-Second Survey
              </a>
            </div>
            
            <p style="color: #718096; font-size: 14px; line-height: 1.6; margin: 24px 0 0 0;">
              Want to learn more? <a href="/" style="color: #667eea;">Visit our homepage</a>
            </p>
          </div>
        </div>
      </body>
      </html>
    `);

  } catch (error) {
    console.error('Confirm lead error:', error);
    res.status(500).send(`
      <html>
        <head><title>Server Error</title></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, sans-serif; text-align: center; padding: 50px;">
          <h1>❌ Server Error</h1>
          <p>Something went wrong. Please try again later.</p>
          <a href="/" style="color: #667eea; text-decoration: none;">← Return to homepage</a>
        </body>
      </html>
    `);
  }
}