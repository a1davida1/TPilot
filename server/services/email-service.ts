import sgMail from '@sendgrid/mail';
import { safeLog } from '../lib/logger-utils.js';

// Initialize SendGrid
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@thottopilot.com';
const FRONTEND_URL = process.env.FRONTEND_URL || 'https://thottopilot.com';

if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

export const emailService = {
  get isEmailServiceConfigured(): boolean {
    return !!SENDGRID_API_KEY;
  },
  
  async sendVerificationEmail(to: string, username: string, token: string) {
    if (!SENDGRID_API_KEY) {
      // SendGrid not configured - email skipped
      return;
    }

    const verificationUrl = `${FRONTEND_URL}/verify-email?token=${token}`;
    
    const msg = {
      to,
      from: FROM_EMAIL,
      subject: 'Verify Your ThottoPilot Account',
      text: `Hi ${username},\n\nPlease verify your email by clicking: ${verificationUrl}\n\nThis link expires in 24 hours.\n\nBest,\nThottoPilot Team`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">ThottoPilot</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">AI-Powered Content Creation</p>
          </div>
          
          <div style="padding: 40px; background: #f7f7f7;">
            <h2 style="color: #333; margin-bottom: 20px;">Welcome, ${username}! 🎉</h2>
            
            <p style="color: #666; line-height: 1.6; margin-bottom: 30px;">
              Thanks for signing up for ThottoPilot! Please verify your email address to get started.
            </p>
            
            <div style="text-align: center; margin: 40px 0;">
              <a href="${verificationUrl}" 
                 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                        color: white; 
                        padding: 15px 40px; 
                        text-decoration: none; 
                        border-radius: 30px; 
                        font-weight: bold;
                        display: inline-block;">
                Verify Email Address
              </a>
            </div>
            
            <p style="color: #999; font-size: 14px; margin-top: 30px;">
              Or copy this link: <br>
              <a href="${verificationUrl}" style="color: #667eea; word-break: break-all;">
                ${verificationUrl}
              </a>
            </p>
            
            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
            
            <p style="color: #999; font-size: 12px; text-align: center;">
              This link expires in 24 hours. If you didn't sign up for ThottoPilot, please ignore this email.
            </p>
          </div>
        </div>
      `,
    };

    try {
      await sgMail.send(msg);
    } catch (error) {
      safeLog('error', 'Verification email send failed', { error: error.message });
      throw error;
    }
  },

  async sendPasswordResetEmail(to: string, username: string) {
    if (!SENDGRID_API_KEY) {
      // SendGrid not configured - email skipped
      return;
    }

    // Generate reset token
    const jwt = await import('jsonwebtoken');
    const JWT_SECRET = process.env.JWT_SECRET;
    if (!JWT_SECRET) {
      throw new Error('JWT_SECRET environment variable is required for password reset tokens');
    }
    
    const resetToken = jwt.default.sign(
      { email: to, type: 'password-reset' },
      JWT_SECRET,
      { expiresIn: '1h' }
    );
    
    const resetUrl = `${FRONTEND_URL}/reset-password?token=${resetToken}`;
    
    const msg = {
      to,
      from: FROM_EMAIL,
      subject: 'Reset Your ThottoPilot Password',
      text: `Hi ${username},\n\nReset your password by clicking: ${resetUrl}\n\nThis link expires in 1 hour.\n\nIf you didn't request this, please ignore this email.\n\nBest,\nThottoPilot Team`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">ThottoPilot</h1>
            <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0;">Password Reset Request</p>
          </div>
          
          <div style="padding: 40px; background: #f7f7f7;">
            <h2 style="color: #333; margin-bottom: 20px;">Hi ${username},</h2>
            
            <p style="color: #666; line-height: 1.6; margin-bottom: 30px;">
              We received a request to reset your password. Click the button below to create a new password.
            </p>
            
            <div style="text-align: center; margin: 40px 0;">
              <a href="${resetUrl}" 
                 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                        color: white; 
                        padding: 15px 40px; 
                        text-decoration: none; 
                        border-radius: 30px; 
                        font-weight: bold;
                        display: inline-block;">
                Reset Password
              </a>
            </div>
            
            <p style="color: #999; font-size: 14px; margin-top: 30px;">
              Or copy this link: <br>
              <a href="${resetUrl}" style="color: #667eea; word-break: break-all;">
                ${resetUrl}
              </a>
            </p>
            
            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
            
            <p style="color: #999; font-size: 12px; text-align: center;">
              This link expires in 1 hour. If you didn't request a password reset, please ignore this email and your password will remain unchanged.
            </p>
          </div>
        </div>
      `,
    };

    try {
      await sgMail.send(msg);
    } catch (error) {
      safeLog('error', 'Password reset email send failed', { error: error.message });
      throw error;
    }
  },

  async sendWelcomeEmail(to: string, username: string) {
    if (!SENDGRID_API_KEY) {
      // SendGrid not configured - email skipped
      return;
    }

    const msg = {
      to,
      from: FROM_EMAIL,
      subject: 'Welcome to ThottoPilot! 🚀',
      text: `Hi ${username},\n\nWelcome to ThottoPilot! Your account is now active.\n\nGet started at: ${FRONTEND_URL}/dashboard\n\nBest,\nThottoPilot Team`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">Welcome to ThottoPilot! 🚀</h1>
          </div>
          
          <div style="padding: 40px; background: #f7f7f7;">
            <h2 style="color: #333; margin-bottom: 20px;">Hi ${username}!</h2>
            
            <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
              Your account is now active and ready to use. Here's what you can do with ThottoPilot:
            </p>
            
            <ul style="color: #666; line-height: 2;">
              <li>🤖 <strong>AI Content Generation</strong> - Create engaging posts instantly</li>
              <li>🛡️ <strong>Image Protection</strong> - Protect your photos from reverse searches</li>
              <li>📊 <strong>Analytics</strong> - Track your content performance</li>
              <li>💰 <strong>Tax Tracker</strong> - Keep track of your earnings</li>
              <li>🎯 <strong>Reddit Automation</strong> - Post to the right subreddits automatically</li>
            </ul>
            
            <div style="text-align: center; margin: 40px 0;">
              <a href="${FRONTEND_URL}/dashboard" 
                 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                        color: white; 
                        padding: 15px 40px; 
                        text-decoration: none; 
                        border-radius: 30px; 
                        font-weight: bold;
                        display: inline-block;">
                Go to Dashboard
              </a>
            </div>
            
            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 30px 0;">
            
            <p style="color: #999; font-size: 12px; text-align: center;">
              Need help? Reply to this email or visit our support center.
            </p>
          </div>
        </div>
      `,
    };

    try {
      await sgMail.send(msg);
    } catch (error) {
      safeLog('error', 'Welcome email send failed', { error: error.message });
      // Don't throw for welcome emails - they're not critical
    }
  },

  async sendUpgradeEmail(to: string, username: string, newTier: string) {
    if (!SENDGRID_API_KEY) {
      // SendGrid not configured - email skipped
      return;
    }

    const msg = {
      to,
      from: FROM_EMAIL,
      subject: `You're now on ThottoPilot ${newTier}! 🎉`,
      text: `Hi ${username},\n\nCongratulations! You've been upgraded to ThottoPilot ${newTier}.\n\nExplore your new features: ${FRONTEND_URL}/dashboard\n\nBest,\nThottoPilot Team`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">Upgrade Complete! 🎉</h1>
          </div>
          
          <div style="padding: 40px; background: #f7f7f7;">
            <h2 style="color: #333; margin-bottom: 20px;">Congratulations, ${username}!</h2>
            
            <p style="color: #666; line-height: 1.6; margin-bottom: 20px;">
              You've been upgraded to <strong>ThottoPilot ${newTier}</strong>!
            </p>
            
            <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0;">
              <h3 style="color: #667eea; margin-top: 0;">Your new features:</h3>
              ${newTier === 'Pro' ? `
                <ul style="color: #666; line-height: 2;">
                  <li>✅ Unlimited AI generations</li>
                  <li>✅ Advanced image protection (no watermark)</li>
                  <li>✅ Priority support</li>
                  <li>✅ Reddit automation</li>
                  <li>✅ Advanced analytics</li>
                  <li>✅ Multiple accounts</li>
                </ul>
              ` : `
                <ul style="color: #666; line-height: 2;">
                  <li>✅ 100 AI generations/month</li>
                  <li>✅ Basic image protection</li>
                  <li>✅ Email support</li>
                </ul>
              `}
            </div>
            
            <div style="text-align: center; margin: 40px 0;">
              <a href="${FRONTEND_URL}/dashboard" 
                 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                        color: white; 
                        padding: 15px 40px; 
                        text-decoration: none; 
                        border-radius: 30px; 
                        font-weight: bold;
                        display: inline-block;">
                Explore New Features
              </a>
            </div>
          </div>
        </div>
      `,
    };

    try {
      await sgMail.send(msg);
    } catch (error) {
      safeLog('error', 'Upgrade email send failed', { error: error.message });
    }
  }
};