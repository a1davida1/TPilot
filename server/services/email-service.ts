import sgMail from '@sendgrid/mail';

const apiKey = process.env.SENDGRID_API_KEY;
if (apiKey) sgMail.setApiKey(apiKey);

export const emailService = {
  async sendMail(msg: sgMail.MailDataRequired) {
    if (!apiKey) return { skipped: true };
    return sgMail.send(msg);
  },
};