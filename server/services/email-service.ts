import sgMail from '@sendgrid/mail';
import jwt from 'jsonwebtoken';

// Initialize SendGrid with API key
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production';
const APP_URL = process.env.APP_URL || 'http://localhost:5000';

// Only initialize if API key is available
if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
}

interface EmailTemplate {
  subject: string;
  htmlContent: string;
  textContent?: string;
}

// Email templates with ThottoPilot branding
const emailTemplates = {
  welcome: (username: string): EmailTemplate => ({
    subject: 'Welcome to ThottoPilot! 🚀',
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; text-align: center;">Welcome to ThottoPilot!</h1>
        </div>
        <div style="padding: 30px; background: #f7f7f7;">
          <h2 style="color: #333;">Hey ${username}! 👋</h2>
          <p style="color: #666; line-height: 1.6;">
            We're thrilled to have you join the ThottoPilot community! You're now ready to:
          </p>
          <ul style="color: #666; line-height: 1.8;">
            <li>🎨 Generate engaging social media content with AI</li>
            <li>🛡️ Protect your images with ImageShield™</li>
            <li>📈 Optimize your content for multiple platforms</li>
            <li>💎 Access exclusive Pro features</li>
          </ul>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${APP_URL}" style="background: linear-gradient(90deg, #667eea, #764ba2); color: white; padding: 15px 40px; text-decoration: none; border-radius: 25px; display: inline-block;">
              Start Creating Content
            </a>
          </div>
          <p style="color: #999; font-size: 14px; text-align: center;">
            Need help? Reply to this email and we'll assist you!
          </p>
        </div>
        <div style="background: #333; color: #999; padding: 20px; text-align: center; font-size: 12px;">
          © 2025 ThottoPilot. Empowering content creators worldwide.
        </div>
      </div>
    `,
    textContent: `Welcome to ThottoPilot, ${username}! We're excited to have you join our community. Get started creating amazing content at ${APP_URL}`
  }),

  passwordReset: (username: string, resetToken: string): EmailTemplate => ({
    subject: 'Reset Your ThottoPilot Password 🔐',
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; text-align: center;">Password Reset Request</h1>
        </div>
        <div style="padding: 30px; background: #f7f7f7;">
          <h2 style="color: #333;">Hi ${username},</h2>
          <p style="color: #666; line-height: 1.6;">
            We received a request to reset your password. Click the button below to create a new password:
          </p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${APP_URL}/reset-password?token=${resetToken}" style="background: linear-gradient(90deg, #667eea, #764ba2); color: white; padding: 15px 40px; text-decoration: none; border-radius: 25px; display: inline-block;">
              Reset Password
            </a>
          </div>
          <p style="color: #999; font-size: 14px;">
            This link will expire in 1 hour for security reasons.
          </p>
          <p style="color: #999; font-size: 14px;">
            If you didn't request this, please ignore this email. Your password won't be changed.
          </p>
        </div>
        <div style="background: #333; color: #999; padding: 20px; text-align: center; font-size: 12px;">
          © 2025 ThottoPilot. Your security is our priority.
        </div>
      </div>
    `,
    textContent: `Hi ${username}, reset your ThottoPilot password using this link: ${APP_URL}/reset-password?token=${resetToken}. This link expires in 1 hour.`
  }),

  upgradeConfirmation: (username: string, plan: string): EmailTemplate => ({
    subject: '🎉 Welcome to ThottoPilot Pro!',
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #ffd700 0%, #ff6b35 100%); padding: 30px; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; text-align: center;">🌟 You're Now Pro!</h1>
        </div>
        <div style="padding: 30px; background: #f7f7f7;">
          <h2 style="color: #333;">Congratulations ${username}!</h2>
          <p style="color: #666; line-height: 1.6;">
            Your upgrade to ThottoPilot ${plan} is complete! Here's what you've unlocked:
          </p>
          <ul style="color: #666; line-height: 1.8;">
            <li>✅ No watermarks on ImageShield™ protected images</li>
            <li>✅ Unlimited AI content generation</li>
            <li>✅ Advanced protection settings</li>
            <li>✅ Priority support</li>
            <li>✅ Early access to new features</li>
          </ul>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${APP_URL}/dashboard" style="background: linear-gradient(90deg, #ffd700, #ff6b35); color: white; padding: 15px 40px; text-decoration: none; border-radius: 25px; display: inline-block;">
              Explore Pro Features
            </a>
          </div>
        </div>
        <div style="background: #333; color: #999; padding: 20px; text-align: center; font-size: 12px;">
          © 2025 ThottoPilot. Thank you for being a Pro member!
        </div>
      </div>
    `,
    textContent: `Congratulations ${username}! Your upgrade to ThottoPilot ${plan} is complete. Explore your new Pro features at ${APP_URL}/dashboard`
  }),

  contentGenerated: (username: string, platform: string): EmailTemplate => ({
    subject: `Your ${platform} Content is Ready! 📝`,
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; text-align: center;">Content Generated!</h1>
        </div>
        <div style="padding: 30px; background: #f7f7f7;">
          <h2 style="color: #333;">Hi ${username}!</h2>
          <p style="color: #666; line-height: 1.6;">
            Your ${platform} content has been generated successfully and is ready to use!
          </p>
          <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0;">
            <p style="color: #666; margin: 0;">
              <strong>Platform:</strong> ${platform}<br>
              <strong>Generated:</strong> ${new Date().toLocaleString()}<br>
              <strong>Status:</strong> ✅ Ready to post
            </p>
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${APP_URL}/dashboard" style="background: linear-gradient(90deg, #667eea, #764ba2); color: white; padding: 15px 40px; text-decoration: none; border-radius: 25px; display: inline-block;">
              View Your Content
            </a>
          </div>
        </div>
        <div style="background: #333; color: #999; padding: 20px; text-align: center; font-size: 12px;">
          © 2025 ThottoPilot. Creating success, one post at a time.
        </div>
      </div>
    `,
    textContent: `Hi ${username}! Your ${platform} content is ready. View it at ${APP_URL}/dashboard`
  }),

  adminWaitlistNotification: (email: string, platformTags: string[], painPoint: string | null, utmData: any): EmailTemplate => ({
    subject: '🚨 New Waitlist Signup - ThottoPilot',
    htmlContent: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #ff6b35 0%, #f7931e 100%); padding: 30px; border-radius: 10px 10px 0 0;">
          <h1 style="color: white; margin: 0; text-align: center;">🎯 New Waitlist Signup!</h1>
        </div>
        <div style="padding: 30px; background: #f7f7f7;">
          <h2 style="color: #333;">New User Joined ThottoPilot Waitlist</h2>
          
          <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #ff6b35;">
            <h3 style="color: #333; margin: 0 0 15px 0;">Contact Information</h3>
            <p style="color: #666; margin: 5px 0;"><strong>Email:</strong> ${email}</p>
            <p style="color: #666; margin: 5px 0;"><strong>Signup Time:</strong> ${new Date().toLocaleString()}</p>
          </div>

          <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #667eea;">
            <h3 style="color: #333; margin: 0 0 15px 0;">User Interests</h3>
            <p style="color: #666; margin: 5px 0;"><strong>Platforms:</strong> ${platformTags.length > 0 ? platformTags.join(', ') : 'Not specified'}</p>
            <p style="color: #666; margin: 5px 0;"><strong>Pain Point:</strong> ${painPoint || 'Not provided'}</p>
          </div>

          ${utmData.utmSource || utmData.utmMedium || utmData.utmCampaign ? `
          <div style="background: white; padding: 20px; border-radius: 10px; margin: 20px 0; border-left: 4px solid #764ba2;">
            <h3 style="color: #333; margin: 0 0 15px 0;">Marketing Attribution</h3>
            ${utmData.utmSource ? `<p style="color: #666; margin: 5px 0;"><strong>Source:</strong> ${utmData.utmSource}</p>` : ''}
            ${utmData.utmMedium ? `<p style="color: #666; margin: 5px 0;"><strong>Medium:</strong> ${utmData.utmMedium}</p>` : ''}
            ${utmData.utmCampaign ? `<p style="color: #666; margin: 5px 0;"><strong>Campaign:</strong> ${utmData.utmCampaign}</p>` : ''}
            ${utmData.referrer ? `<p style="color: #666; margin: 5px 0;"><strong>Referrer:</strong> ${utmData.referrer}</p>` : ''}
          </div>
          ` : ''}

          <div style="text-align: center; margin: 30px 0;">
            <a href="${APP_URL}/admin/leads" style="background: linear-gradient(90deg, #ff6b35, #f7931e); color: white; padding: 15px 40px; text-decoration: none; border-radius: 25px; display: inline-block;">
              View All Leads
            </a>
          </div>
        </div>
        <div style="background: #333; color: #999; padding: 20px; text-align: center; font-size: 12px;">
          ThottoPilot Admin Notification System
        </div>
      </div>
    `,
    textContent: `New waitlist signup: ${email}. Platforms: ${platformTags.join(', ')}. Pain point: ${painPoint || 'Not provided'}. View details at ${APP_URL}/admin/leads`
  })
};

// Main email service class
export class EmailService {
  private isConfigured: boolean;

  constructor() {
    this.isConfigured = !!SENDGRID_API_KEY;
    if (!this.isConfigured) {
      console.warn('⚠️ SendGrid API key not configured. Email functionality disabled.');
    }
  }

  // Send welcome email to new users
  async sendWelcomeEmail(email: string, username: string): Promise<boolean> {
    if (!this.isConfigured) {
      console.log(`📧 [Mock] Welcome email would be sent to ${email}`);
      return true;
    }

    try {
      const template = emailTemplates.welcome(username);
      await sgMail.send({
        to: email,
        from: 'noreply@thottopilot.com', // Must be verified in SendGrid
        subject: template.subject,
        html: template.htmlContent,
        text: template.textContent
      });
      console.log(`✅ Welcome email sent to ${email}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to send welcome email:', error);
      return false;
    }
  }

  // Send password reset email
  async sendPasswordResetEmail(email: string, username: string): Promise<boolean> {
    if (!this.isConfigured) {
      console.log(`📧 [Mock] Password reset email would be sent to ${email}`);
      return true;
    }

    try {
      // Generate reset token valid for 1 hour
      const resetToken = jwt.sign(
        { email, username, type: 'password-reset' },
        JWT_SECRET,
        { expiresIn: '1h' }
      );

      const template = emailTemplates.passwordReset(username, resetToken);
      await sgMail.send({
        to: email,
        from: 'noreply@thottopilot.com',
        subject: template.subject,
        html: template.htmlContent,
        text: template.textContent
      });
      console.log(`✅ Password reset email sent to ${email}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to send password reset email:', error);
      return false;
    }
  }

  // Send upgrade confirmation
  async sendUpgradeEmail(email: string, username: string, plan: string): Promise<boolean> {
    if (!this.isConfigured) {
      console.log(`📧 [Mock] Upgrade confirmation would be sent to ${email}`);
      return true;
    }

    try {
      const template = emailTemplates.upgradeConfirmation(username, plan);
      await sgMail.send({
        to: email,
        from: 'noreply@thottopilot.com',
        subject: template.subject,
        html: template.htmlContent,
        text: template.textContent
      });
      console.log(`✅ Upgrade confirmation sent to ${email}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to send upgrade email:', error);
      return false;
    }
  }

  // Send content generation notification
  async sendContentNotification(email: string, username: string, platform: string): Promise<boolean> {
    if (!this.isConfigured) {
      console.log(`📧 [Mock] Content notification would be sent to ${email}`);
      return true;
    }

    try {
      const template = emailTemplates.contentGenerated(username, platform);
      await sgMail.send({
        to: email,
        from: 'noreply@thottopilot.com',
        subject: template.subject,
        html: template.htmlContent,
        text: template.textContent
      });
      console.log(`✅ Content notification sent to ${email}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to send content notification:', error);
      return false;
    }
  }

  // Verify email address (for email verification flow)
  async sendVerificationEmail(email: string, username: string): Promise<boolean> {
    if (!this.isConfigured) {
      console.log(`📧 [Mock] Verification email would be sent to ${email}`);
      return true;
    }

    try {
      const verificationToken = jwt.sign(
        { email, username, type: 'email-verification' },
        JWT_SECRET,
        { expiresIn: '24h' }
      );

      await sgMail.send({
        to: email,
        from: 'noreply@thottopilot.com',
        subject: 'Verify Your ThottoPilot Email 📧',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2>Verify Your Email</h2>
            <p>Hi ${username}, please verify your email to unlock all features:</p>
            <a href="${APP_URL}/verify-email?token=${verificationToken}" 
               style="background: linear-gradient(90deg, #667eea, #764ba2); color: white; padding: 15px 30px; text-decoration: none; border-radius: 25px; display: inline-block;">
              Verify Email
            </a>
            <p style="color: #999; font-size: 14px; margin-top: 20px;">
              This link expires in 24 hours.
            </p>
          </div>
        `,
        text: `Hi ${username}, verify your email: ${APP_URL}/verify-email?token=${verificationToken}`
      });
      console.log(`✅ Verification email sent to ${email}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to send verification email:', error);
      return false;
    }
  }

  // Send admin notification for new waitlist signup
  async sendAdminWaitlistNotification(
    userEmail: string, 
    platformTags: string[], 
    painPoint: string | null, 
    utmData: any
  ): Promise<boolean> {
    if (!this.isConfigured) {
      console.log(`📧 [Mock] Admin waitlist notification would be sent for ${userEmail}`);
      return true;
    }

    // Admin email from environment variable, fallback to default
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@thottopilot.com';
    
    try {
      const template = emailTemplates.adminWaitlistNotification(userEmail, platformTags, painPoint, utmData);
      await sgMail.send({
        to: adminEmail,
        from: 'noreply@thottopilot.com',
        subject: template.subject,
        html: template.htmlContent,
        text: template.textContent
      });
      console.log(`✅ Admin waitlist notification sent to ${adminEmail} for user: ${userEmail}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to send admin waitlist notification:', error);
      return false;
    }
  }

  // Check if email service is configured
  isEmailServiceConfigured(): boolean {
    return this.isConfigured;
  }
}

// Export singleton instance
export const emailService = new EmailService();