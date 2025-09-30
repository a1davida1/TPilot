import sgMail from '@sendgrid/mail';
import { safeLog } from '../lib/logger-utils.js';
import type { UTMParams } from '../lib/utm.js';

const FROM_EMAIL = process.env.FROM_EMAIL ?? '';
const FRONTEND_URL = process.env.FRONTEND_URL ?? '';
const apiKey = process.env.SENDGRID_API_KEY;

export const isEmailServiceConfigured = Boolean(apiKey);

if (apiKey) {
  sgMail.setApiKey(apiKey);
} else if (process.env.NODE_ENV === 'production') {
  throw new Error('SENDGRID_API_KEY missing in production environment');
}

async function sendMail(msg: sgMail.MailDataRequired) {
  if (!apiKey) {
    safeLog('warn', 'SendGrid not configured, skipping email', {});
    return { skipped: true };
  }
  try {
    return await sgMail.send(msg);
  } catch (_error) {
    const message = error instanceof Error ? error.message : String(error);
    safeLog('error', 'SendGrid send failed', { error: message });
    throw error;
  }
}

async function sendVerificationEmail(to: string, username: string, token: string) {
  if (!isEmailServiceConfigured) return;
  const verifyUrl = `${FRONTEND_URL}/verify-email?token=${token}`;
  const msg: sgMail.MailDataRequired = {
    to,
    from: FROM_EMAIL,
    subject: 'Verify Your ThottoPilot Account',
    text: `Hi ${username}, please verify your email: ${verifyUrl}`,
    html: `<p>Welcome, ${username}! <a href="${verifyUrl}">Verify your email</a></p>`,
  };
  try {
    await sendMail(msg);
  } catch (_error) {
    const message = error instanceof Error ? error.message : String(error);
    safeLog('error', 'Verification email send failed', { error: message });
    throw error;
  }
}

async function sendPasswordResetEmail(to: string, username: string, token: string) {
  if (!isEmailServiceConfigured) return;
  
  // Use the JWT token passed from the forgot-password endpoint
  const resetUrl = `${FRONTEND_URL}/reset-password?token=${encodeURIComponent(token)}`;
  const msg: sgMail.MailDataRequired = {
    to,
    from: FROM_EMAIL,
    subject: 'Reset Your ThottoPilot Password',
    text: `Hi ${username}, reset your password: ${resetUrl}`,
    html: `<p>Hi ${username},</p><p><a href="${resetUrl}">Reset your password</a></p>`,
  };
  try {
    await sendMail(msg);
  } catch (_error) {
    const message = error instanceof Error ? error.message : String(error);
    safeLog('error', 'Password reset email send failed', { error: message });
    throw error;
  }
}

async function sendWelcomeEmail(to: string, username: string) {
  if (!isEmailServiceConfigured) return;
  const msg: sgMail.MailDataRequired = {
    to,
    from: FROM_EMAIL,
    subject: 'Welcome to ThottoPilot! 🚀',
    text: `Hi ${username}, welcome to ThottoPilot!`,
    html: `<p>Hi ${username}!</p><p>Welcome to ThottoPilot!</p>`,
  };
  try {
    await sendMail(msg);
  } catch (_error) {
    const message = error instanceof Error ? error.message : String(error);
    safeLog('error', 'Welcome email send failed', { error: message });
  }
}

async function sendUpgradeEmail(to: string, username: string, planOrTier: string) {
  if (!isEmailServiceConfigured) return;
  const accountUrl = `${FRONTEND_URL}/account/billing`;
  const msg: sgMail.MailDataRequired = {
    to,
    from: FROM_EMAIL,
    subject: `Your plan has been updated to ${planOrTier}`,
    text: `Hi ${username}, your plan is now ${planOrTier}. Manage your subscription at ${accountUrl}.`,
    html: `<p>Hi ${username},</p><p>Your plan is now <strong>${planOrTier}</strong>.</p><p><a href="${accountUrl}">Manage your subscription</a></p>`,
  };
  await sendMail(msg);
}

export const sendEmail = async (msg: sgMail.MailDataRequired) => {
  if (!isEmailServiceConfigured) throw new Error("Email service not configured");
  return sgMail.send({ ...msg, from: FROM_EMAIL });
};

export const emailService = {
  isEmailServiceConfigured,
  sendMail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
  sendUpgradeEmail,
  async sendAdminWaitlistNotification(
    email: string,
    platforms: string[],
    painPoint: string | null,
    utm: UTMParams
  ) {
    if (!isEmailServiceConfigured) return { skipped: true };
    const msg: sgMail.MailDataRequired = {
      to: process.env.ADMIN_EMAIL || FROM_EMAIL,
      from: FROM_EMAIL,
      subject: 'New waitlist signup',
      text: `Email: ${email}\nPlatforms: ${platforms.join(', ')}\nPain point: ${painPoint ?? 'n/a'}\nUTM: ${JSON.stringify(utm)}`
    };
    return sendMail(msg);
  }
};