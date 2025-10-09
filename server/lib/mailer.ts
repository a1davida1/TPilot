import { getEnvConfig } from './config';

import { logger } from './../bootstrap/logger.js';
import { formatLogArgs } from './logger-utils.js';
interface EmailService {
  sendEmail(params: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<boolean>;
}

class ResendService implements EmailService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async sendEmail(params: { to: string; subject: string; html: string; text: string }): Promise<boolean> {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'ThottoPilot <noreply@thottopilot.com>',
          to: params.to,
          subject: params.subject,
          html: params.html,
          text: params.text,
        }),
      });

      if (!response.ok) {
        logger.error(...formatLogArgs('Resend API error:', await response.text()));
        return false;
      }

      return true;
    } catch (error) {
      logger.error(...formatLogArgs('Resend service error:', error));
      return false;
    }
  }
}

class SendGridService implements EmailService {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async sendEmail(params: { to: string; subject: string; html: string; text: string }): Promise<boolean> {
    try {
      const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          personalizations: [{
            to: [{ email: params.to }],
            subject: params.subject,
          }],
          from: { email: 'noreply@thottopilot.com', name: 'ThottoPilot' },
          content: [
            { type: 'text/plain', value: params.text },
            { type: 'text/html', value: params.html },
          ],
        }),
      });

      if (!response.ok) {
        logger.error(...formatLogArgs('SendGrid API error:', await response.text()));
        return false;
      }

      return true;
    } catch (error) {
      logger.error(...formatLogArgs('SendGrid service error:', error));
      return false;
    }
  }
}

function getEmailService(): EmailService | null {
  const config = getEnvConfig();

  if (config.RESEND_API_KEY) {
    return new ResendService(config.RESEND_API_KEY);
  }

  if (config.SENDGRID_API_KEY) {
    return new SendGridService(config.SENDGRID_API_KEY);
  }

  logger.warn(...formatLogArgs('⚠️ No email service configured (RESEND_API_KEY or SENDGRID_API_KEY missing))');
  return null;
}

export async function sendDoubleOptInEmail(email: string, confirmToken: string): Promise<boolean> {
  const emailService = getEmailService();
  if (!emailService) {
    return false;
  }

  const config = getEnvConfig();
  const confirmLink = `${config.APP_BASE_URL}/api/leads/confirm?token=${confirmToken}`;

  const subject = 'Please confirm your waitlist signup - ThottoPilot';
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Confirm Your Waitlist Signup</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background-color: #f8fafc;">
      <div style="max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; margin-top: 40px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 32px; text-align: center;">
          <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 700;">ThottoPilot</h1>
          <p style="color: rgba(255, 255, 255, 0.9); margin: 8px 0 0 0; font-size: 16px;">AI Promo Copilot for NSFW Creators</p>
        </div>
        
        <div style="padding: 40px 32px;">
          <h2 style="color: #1a202c; font-size: 24px; margin: 0 0 16px 0; font-weight: 600;">Almost there! 🚀</h2>
          
          <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
            Thanks for joining the ThottoPilot waitlist! We're excited to help you transform your content creation process.
          </p>
          
          <p style="color: #4a5568; font-size: 16px; line-height: 1.6; margin: 0 0 32px 0;">
            Please click the button below to confirm your email and secure your spot:
          </p>
          
          <div style="text-align: center; margin: 32px 0;">
            <a href="${confirmLink}" 
               style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; transition: transform 0.2s;">
              Confirm My Signup
            </a>
          </div>
          
          <p style="color: #718096; font-size: 14px; line-height: 1.6; margin: 24px 0 0 0;">
            This link will expire in 48 hours. If you didn't request this, you can safely ignore this email.
          </p>
        </div>
        
        <div style="background: #f7fafc; padding: 24px 32px; text-align: center; border-top: 1px solid #e2e8f0;">
          <p style="color: #718096; font-size: 14px; margin: 0;">
            © 2025 ThottoPilot. All rights reserved.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Thanks for joining the ThottoPilot waitlist!

Please confirm your email by clicking the link below:
${confirmLink}

This link will expire in 48 hours.

- ThottoPilot Team
  `;

  return emailService.sendEmail({
    to: email,
    subject,
    html,
    text,
  });
}