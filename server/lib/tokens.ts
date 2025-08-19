import crypto from 'crypto';

const SECRET_KEY = process.env.JWT_SECRET || 'dev-secret-key';

export function createConfirmToken(email: string): string {
  const timestamp = Date.now();
  const payload = `${email}:${timestamp}`;
  const signature = crypto
    .createHmac('sha256', SECRET_KEY)
    .update(payload)
    .digest('hex');
  
  // Encode as base64 for URL safety
  return Buffer.from(`${payload}:${signature}`).toString('base64url');
}

export function verifyConfirmToken(token: string): { valid: boolean; email?: string; expired?: boolean } {
  try {
    // Decode from base64
    const decoded = Buffer.from(token, 'base64url').toString('utf8');
    const [email, timestampStr, signature] = decoded.split(':');
    
    if (!email || !timestampStr || !signature) {
      return { valid: false };
    }

    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(timestamp)) {
      return { valid: false };
    }

    // Check if token is expired (48 hours)
    const now = Date.now();
    const maxAge = 48 * 60 * 60 * 1000; // 48 hours in milliseconds
    if (now - timestamp > maxAge) {
      return { valid: false, expired: true, email };
    }

    // Verify signature
    const payload = `${email}:${timestampStr}`;
    const expectedSignature = crypto
      .createHmac('sha256', SECRET_KEY)
      .update(payload)
      .digest('hex');

    if (signature !== expectedSignature) {
      return { valid: false };
    }

    return { valid: true, email };
  } catch (error) {
    console.error('Token verification error:', error);
    return { valid: false };
  }
}