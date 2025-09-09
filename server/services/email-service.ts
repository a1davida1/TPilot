import sgMail from '@sendgrid/mail';
import jwt from 'jsonwebtoken';
import { safeLog } from '../lib/logger-utils.js';

const FROM_EMAIL = process.env.FROM_EMAIL ?? '';
const FRONTEND_URL = process.env.FRONTEND_URL ?? '';
const apiKey = process.env.SENDGRID_API_KEY;

export const isEmailServiceConfigured = Boolean(apiKey);

if (apiKey) {
  sgMail.setApiKey(apiKey);
}

async function sendMail(msg: sgMail.MailDataRequired) {
  if (!apiKey) {
    safeLog('warn', 'SendGrid not configured, skipping email', {});
    return { skipped: true };
  }
  try {
    return await sgMail.send(msg);
  } catch (error) {
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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    safeLog('error', 'Verification email send failed', { error: message });
    throw error;
  }
}

async function sendPasswordResetEmail(to: string, username: string) {
  if (!isEmailServiceConfigured) return;
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET environment variable is required for password reset tokens');
  }
  const token = jwt.sign({ email: to }, secret, { expiresIn: '1h' });
  const resetUrl = `${FRONTEND_URL}/reset-password?token=${token}`;
  const msg: sgMail.MailDataRequired = {
    to,
    from: FROM_EMAIL,
    subject: 'Reset Your ThottoPilot Password',
    text: `Hi ${username}, reset your password: ${resetUrl}`,
    html: `<p>Hi ${username},</p><p><a href="${resetUrl}">Reset your password</a></p>`,
  };
  try {
    await sendMail(msg);
  } catch (error) {
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
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    safeLog('error', 'Welcome email send failed', { error: message });
  }
}

export const emailService = {
  isEmailServiceConfigured,
  sendMail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendWelcomeEmail,
};