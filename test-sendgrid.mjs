import dotenv from 'dotenv';
import sgMail from '@sendgrid/mail';

// Load environment variables
dotenv.config();

const apiKey = process.env.SENDGRID_API_KEY;
const fromEmail = process.env.FROM_EMAIL || 'support@thottopilot.com';
const testEmail = 'davidolsonwg@gmail.com'; // Test email

console.log('Testing SendGrid email configuration...');
console.log('API Key exists:', !!apiKey);
console.log('API Key length:', apiKey ? apiKey.length : 0);
console.log('From email:', fromEmail);
console.log('Sending test email to:', testEmail);

if (!apiKey) {
  console.error('❌ SENDGRID_API_KEY is not set in environment variables!');
  console.log('\nTo fix this in production:');
  console.log('1. Go to your Replit deployment settings');
  console.log('2. Add SENDGRID_API_KEY to your App Secrets');
  console.log('3. Use your actual SendGrid API key from sendgrid.com');
  process.exit(1);
}

// Set the API key
sgMail.setApiKey(apiKey);

const msg = {
  to: testEmail,
  from: fromEmail,
  subject: 'ThottoPilot Test Email',
  text: 'This is a test email from ThottoPilot to verify SendGrid configuration.',
  html: '<strong>This is a test email from ThottoPilot to verify SendGrid configuration.</strong>',
};

try {
  const result = await sgMail.send(msg);
  console.log('✅ Email sent successfully!');
  console.log('Status code:', result[0].statusCode);
  console.log('Response headers:', result[0].headers);
} catch (error) {
  console.error('❌ Failed to send email:', error);
  
  if (error.response) {
    console.error('Error response body:', error.response.body);
    console.error('Status code:', error.response.statusCode);
    
    if (error.response.body?.errors) {
      error.response.body.errors.forEach((err, index) => {
        console.error(`Error ${index + 1}:`, err.message);
        if (err.field) {
          console.error(`  Field: ${err.field}`);
        }
        if (err.help) {
          console.error(`  Help: ${err.help}`);
        }
      });
    }
  }
  
  console.log('\n📝 Troubleshooting tips:');
  console.log('1. Verify your SendGrid API key is valid');
  console.log('2. Check that the sender email is verified in SendGrid');
  console.log('3. Ensure your SendGrid account is not in sandbox mode');
  console.log('4. Check SendGrid activity logs at app.sendgrid.com');
}