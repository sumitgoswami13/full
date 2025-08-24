// mailer.js
const nodemailer = require('nodemailer');

/**
 * Build the Nodemailer transporter from environment variables.
 * Required: EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS
 * Optional: EMAIL_SECURE (true/false), EMAIL_FROM, EMAIL_FROM_NAME
 */
function createTransporter() {
  const {
    EMAIL_HOST,
    EMAIL_PORT,
    EMAIL_USER,
    EMAIL_PASS,
    EMAIL_SECURE,
  } = process.env;

  if (!EMAIL_HOST || !EMAIL_PORT || !EMAIL_USER || !EMAIL_PASS) {
    throw new Error(
      'Missing SMTP configuration. Please set EMAIL_HOST, EMAIL_PORT, EMAIL_USER, and EMAIL_PASS.'
    );
  }

  const port = Number(EMAIL_PORT);
  const secure =
    typeof EMAIL_SECURE !== 'undefined'
      ? String(EMAIL_SECURE).toLowerCase() === 'true'
      : port === 465; // default: secure for 465

  return nodemailer.createTransport({
    host: EMAIL_HOST,
    port,
    secure,
    auth: {
      user: EMAIL_USER,
      pass: EMAIL_PASS,
    },
    // Uncomment if you need to allow self-signed certs in dev
    // tls: { rejectUnauthorized: false },
  });
}

/**
 * Send an email.
 * @param {Object} options
 * @param {string|string[]} options.to
 * @param {string} options.subject
 * @param {string} [options.html]
 * @param {string} [options.text]
 * @param {string|string[]} [options.cc]
 * @param {string|string[]} [options.bcc]
 * @param {string} [options.replyTo]
 * @param {Array} [options.attachments] - Nodemailer attachments array
 * @param {Object} [options.headers]
 * @returns {Promise<import('nodemailer').SentMessageInfo>}
 */
async function sendEmail(options = {}) {
  const transporter = createTransporter();

  // Build "from"
  const fromEmail = process.env.EMAIL_FROM || process.env.EMAIL_USER;
  const fromName = process.env.EMAIL_FROM_NAME || 'UDIN System';
  const from = `"${fromName}" <${fromEmail}>`;

  // Provide a plain-text fallback if only HTML is supplied
  const textFallback =
    options.text ||
    (options.html ? options.html.replace(/<[^>]+>/g, ' ') : undefined);

  const mailOptions = {
    from,
    to: options.to,
    cc: options.cc,
    bcc: options.bcc,
    subject: options.subject,
    text: textFallback,
    html: options.html,
    replyTo: options.replyTo,
    attachments: options.attachments,
    headers: options.headers,
  };

  try {
    // Optional but helpful: verify once to catch bad creds/host quickly
    // await transporter.verify();

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    return info;
  } catch (err) {
    // Keep logs useful but avoid leaking secrets
    console.error('Email sending error:', err?.message || err);
    throw err;
  }
}

module.exports = {
  createTransporter,
  sendEmail,
};
