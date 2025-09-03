#!/usr/bin/env node
// SendGrid Email Diagnostic Tool for ThottoPilot

const sgMail = require('@sendgrid/mail');
require('dotenv').config();

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m'
};

console.log(`${colors.cyan}${colors.bright}
╔══════════════════════════════════════════════════════╗
║     SendGrid Email Diagnostic Tool for ThottoPilot     ║
╚══════════════════════════════════════════════════════╝
${colors.reset}`);

async function runDiagnostics() {
  const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
  const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@thottopilot.com';
  const TEST_EMAIL = process.argv[2]; // Get test email from command line
  
  console.log(`${colors.bright}1. Environment Check:${colors.reset}`);
  console.log(`   API Key: ${SENDGRID_API_KEY ? `${colors.green}✓ Configured${colors.reset} (${SENDGRID_API_KEY.substring(0, 10)}...)` : `${colors.red}✗ Not configured${colors.reset}`}`);
  console.log(`   FROM_EMAIL: ${colors.cyan}${FROM_EMAIL}${colors.reset}`);
  console.log(`   NODE_ENV: ${process.env.NODE_ENV || 'not set'}`);
  console.log(`   REPLIT_DEPLOYMENT: ${process.env.REPLIT_DEPLOYMENT || 'not set'}`);
  console.log('');
  
  if (!SENDGRID_API_KEY) {
    console.log(`${colors.red}❌ SENDGRID_API_KEY is not configured. Cannot proceed with tests.${colors.reset}`);
    console.log(`${colors.yellow}Please set SENDGRID_API_KEY in your environment variables.${colors.reset}`);
    process.exit(1);
  }
  
  if (!TEST_EMAIL) {
    console.log(`${colors.red}❌ Please provide a test email address${colors.reset}`);
    console.log(`${colors.yellow}Usage: node test-sendgrid-email.js your-email@example.com${colors.reset}`);
    process.exit(1);
  }
  
  // Initialize SendGrid
  sgMail.setApiKey(SENDGRID_API_KEY);
  
  console.log(`${colors.bright}2. SendGrid API Key Validation:${colors.reset}`);
  
  // Test with different FROM emails
  const fromEmailsToTest = [
    FROM_EMAIL,
    'support@thottopilot.com',
    'hello@thottopilot.com',
    'admin@thottopilot.com',
    'no-reply@thottopilot.com'
  ];
  
  console.log(`${colors.bright}3. Testing different FROM addresses:${colors.reset}`);
  console.log('   (SendGrid requires verified senders or domain authentication)');
  console.log('');
  
  for (const fromEmail of fromEmailsToTest) {
    console.log(`   Testing FROM: ${colors.cyan}${fromEmail}${colors.reset}`);
    
    const msg = {
      to: TEST_EMAIL,
      from: fromEmail,
      subject: `ThottoPilot Email Test - FROM: ${fromEmail}`,
      text: `This is a test email from ThottoPilot to verify SendGrid configuration.\n\nFROM address tested: ${fromEmail}\n\nIf you receive this email, this FROM address is properly configured in SendGrid.`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
            <h1 style="color: white; margin: 0;">ThottoPilot Email Test</h1>
          </div>
          <div style="padding: 40px; background: #f7f7f7;">
            <h2 style="color: #333;">SendGrid Configuration Test</h2>
            <p style="color: #666;">This is a test email to verify SendGrid configuration.</p>
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p><strong>FROM address tested:</strong> ${fromEmail}</p>
              <p><strong>TO address:</strong> ${TEST_EMAIL}</p>
              <p><strong>Timestamp:</strong> ${new Date().toISOString()}</p>
            </div>
            <p style="color: #666;">If you receive this email, this FROM address is properly configured in SendGrid.</p>
          </div>
        </div>
      `,
    };
    
    try {
      const result = await sgMail.send(msg);
      console.log(`      ${colors.green}✓ Sent successfully!${colors.reset} Status: ${result[0].statusCode}`);
      console.log(`      ${colors.green}Check ${TEST_EMAIL} for the test email${colors.reset}`);
      
      // If one works, note it as the recommended one
      console.log(`      ${colors.bright}${colors.green}>>> RECOMMENDED: Use "${fromEmail}" as FROM_EMAIL${colors.reset}`);
      console.log('');
      
      // Show how to update the configuration
      console.log(`${colors.bright}4. To fix email delivery, update your environment:${colors.reset}`);
      console.log(`   ${colors.yellow}FROM_EMAIL=${fromEmail}${colors.reset}`);
      console.log('');
      console.log(`${colors.bright}5. SendGrid Configuration Checklist:${colors.reset}`);
      console.log(`   ${colors.cyan}[ ] Domain Authentication${colors.reset} - Verify thottopilot.com domain in SendGrid`);
      console.log(`       → Go to: Settings > Sender Authentication > Authenticate Your Domain`);
      console.log(`   ${colors.cyan}[ ] Single Sender Verification${colors.reset} - Add ${fromEmail} as verified sender`);
      console.log(`       → Go to: Settings > Sender Authentication > Single Sender Verification`);
      console.log(`   ${colors.cyan}[ ] DNS Records${colors.reset} - Add CNAME records to your domain DNS`);
      console.log(`       → Check your domain registrar's DNS settings`);
      console.log('');
      
      // Success - exit after first successful send
      console.log(`${colors.green}${colors.bright}✅ Email test successful with ${fromEmail}!${colors.reset}`);
      console.log(`${colors.green}Password reset emails should work once FROM_EMAIL is updated.${colors.reset}`);
      process.exit(0);
      
    } catch (error) {
      console.log(`      ${colors.red}✗ Failed${colors.reset}: ${error.message}`);
      if (error.response && error.response.body) {
        const errors = error.response.body.errors;
        if (errors && errors.length > 0) {
          errors.forEach(err => {
            console.log(`        ${colors.yellow}→ ${err.message}${colors.reset}`);
            if (err.field) {
              console.log(`          Field: ${err.field}`);
            }
            if (err.help) {
              console.log(`          Help: ${err.help}`);
            }
          });
        }
      }
      console.log('');
    }
  }
  
  console.log(`${colors.red}${colors.bright}❌ All FROM addresses failed!${colors.reset}`);
  console.log('');
  console.log(`${colors.bright}Common SendGrid Issues & Solutions:${colors.reset}`);
  console.log('');
  console.log(`${colors.yellow}1. Domain Not Verified:${colors.reset}`);
  console.log(`   → Log into SendGrid and go to Settings > Sender Authentication`);
  console.log(`   → Click "Authenticate Your Domain" and follow the steps`);
  console.log(`   → Add the provided CNAME records to your domain's DNS`);
  console.log('');
  console.log(`${colors.yellow}2. Single Sender Not Verified:${colors.reset}`);
  console.log(`   → Go to Settings > Sender Authentication > Single Sender Verification`);
  console.log(`   → Add and verify an email address you control`);
  console.log(`   → Use this verified email as FROM_EMAIL`);
  console.log('');
  console.log(`${colors.yellow}3. API Key Permissions:${colors.reset}`);
  console.log(`   → Ensure your API key has "Mail Send" permissions`);
  console.log(`   → Go to Settings > API Keys to check/update permissions`);
  console.log('');
  console.log(`${colors.yellow}4. Account Restrictions:${colors.reset}`);
  console.log(`   → New SendGrid accounts may have sending restrictions`);
  console.log(`   → Check for any account warnings in the SendGrid dashboard`);
  console.log('');
  console.log(`${colors.cyan}For immediate fix, try:${colors.reset}`);
  console.log(`1. Use a Gmail/personal email for Single Sender Verification`);
  console.log(`2. Update FROM_EMAIL to match the verified sender`);
  console.log(`3. Restart your application after updating environment variables`);
}

// Run diagnostics
runDiagnostics().catch(error => {
  console.error(`${colors.red}Unexpected error:${colors.reset}`, error);
  process.exit(1);
});