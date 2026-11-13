const nodemailer = require('nodemailer');

let transporter;

function getBrevoConfiguration() {
  const enabled = process.env.BREVO_EMAIL_ENABLED === 'true';
  if (!enabled) return { enabled: false };

  const required = [
    'BREVO_SMTP_HOST',
    'BREVO_SMTP_PORT',
    'BREVO_SMTP_LOGIN',
    'BREVO_SMTP_KEY',
    'BREVO_SENDER_EMAIL',
    'BREVO_SENDER_NAME',
  ];
  const missing = required.filter((name) => !process.env[name]?.trim());
  if (missing.length) {
    throw new Error(`Brevo email is enabled, but these settings are missing: ${missing.join(', ')}.`);
  }

  const port = Number(process.env.BREVO_SMTP_PORT);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('BREVO_SMTP_PORT must be a valid TCP port.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(process.env.BREVO_SENDER_EMAIL.trim())) {
    throw new Error('BREVO_SENDER_EMAIL must be a valid sender address.');
  }

  return {
    enabled: true,
    host: process.env.BREVO_SMTP_HOST.trim(),
    port,
    login: process.env.BREVO_SMTP_LOGIN.trim(),
    key: process.env.BREVO_SMTP_KEY,
    senderEmail: process.env.BREVO_SENDER_EMAIL.trim(),
    senderName: process.env.BREVO_SENDER_NAME.trim(),
  };
}

function assertBrevoConfiguration() {
  getBrevoConfiguration();
}

function getBrevoDeliveryErrorMessage(error) {
  if (error?.code === 'ERECIPIENT') {
    return 'Brevo did not accept the recipient address. Check the account email and Brevo transactional settings.';
  }
  if (error?.code === 'EAUTH' && Number(error.responseCode) === 525) {
    return 'Brevo rejected the backend IP address. Authorize the backend public IP in Brevo.';
  }
  if (error?.code === 'EAUTH') {
    return 'Brevo rejected SMTP authentication. Check the SMTP login, SMTP key, and authorized IP settings.';
  }
  if (error?.code === 'ETIMEDOUT' || error?.code === 'ESOCKET') {
    return 'The backend could not connect to Brevo SMTP. Check network access and SMTP port settings.';
  }
  if (Number(error?.responseCode) >= 500) {
    return 'Brevo rejected this message. Check the verified sender and recipient address in Brevo.';
  }
  return 'Brevo could not accept this message. Check the backend delivery log and Brevo transaction history.';
}

function maskEmailAddress(email) {
  const [localPart, domain] = String(email || '').split('@');
  if (!localPart || !domain) return '';
  return `${localPart[0]}***@${domain}`;
}

function assertRecipientAccepted(info, recipient) {
  const normalizeAddress = (address) => String(
    typeof address === 'string' ? address : address?.address || ''
  ).trim().toLowerCase();
  const accepted = Array.isArray(info?.accepted) &&
    info.accepted.some((address) => normalizeAddress(address) === normalizeAddress(recipient));
  if (!accepted) {
    const error = new Error('SMTP did not accept the recipient address.');
    error.code = 'ERECIPIENT';
    throw error;
  }
  return { status: 'sent', messageId: info.messageId };
}

function getTransport(configuration) {
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: configuration.host,
      port: configuration.port,
      secure: configuration.port === 465,
      requireTLS: configuration.port !== 465,
      auth: {
        user: configuration.login,
        pass: configuration.key,
      },
      tls: { rejectUnauthorized: true },
      pool: true,
      maxConnections: 3,
      maxMessages: 100,
    });
  }
  return transporter;
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

async function sendBrevoNotification({ to, title, message }) {
  const configuration = getBrevoConfiguration();
  if (!configuration.enabled) return { status: 'disabled' };

  const text = `${title}\n\n${message}\n\nSign in to MyAgriSETA to view your account.`;
  const html = `<h2>${escapeHtml(title)}</h2><p>${escapeHtml(message).replace(/\r?\n/g, '<br>')}</p><p>Sign in to MyAgriSETA to view your account.</p>`;
  const info = await getTransport(configuration).sendMail({
    from: { name: configuration.senderName, address: configuration.senderEmail },
    to,
    subject: `MyAgriSETA: ${title}`,
    text,
    html,
  });
  return assertRecipientAccepted(info, to);
}

// The reset token is a secret: it is placed only in the email body and is
// never logged. The link and the code are the same value so users on a phone
// can paste the code into the app if the link opens in a browser instead.
async function sendPasswordResetEmail({ to, firstName, resetUrl, resetCode, expiresInMinutes }) {
  const configuration = getBrevoConfiguration();
  if (!configuration.enabled) return { status: 'disabled' };

  const greeting = firstName ? `Hello ${firstName},` : 'Hello,';
  const text = [
    greeting,
    '',
    'We received a request to reset the password for your MyAgriSETA account.',
    '',
    `Open this link to choose a new password: ${resetUrl}`,
    '',
    `Or enter this reset code in the app: ${resetCode}`,
    '',
    `The link and code expire in ${expiresInMinutes} minutes and can be used once.`,
    'If you did not ask for this, you can ignore this email. Your password will not change.',
  ].join('\n');
  const html = `<p>${escapeHtml(greeting)}</p>
<p>We received a request to reset the password for your MyAgriSETA account.</p>
<p><a href="${escapeHtml(resetUrl)}" style="display:inline-block;padding:12px 20px;background:#0A4532;color:#ffffff;border-radius:8px;text-decoration:none;font-weight:bold">Choose a new password</a></p>
<p>Or enter this reset code in the app:</p>
<p style="font-family:monospace;font-size:14px;word-break:break-all;background:#F0F5F2;padding:10px;border-radius:6px">${escapeHtml(resetCode)}</p>
<p>The link and code expire in ${expiresInMinutes} minutes and can be used once.</p>
<p>If you did not ask for this, you can ignore this email. Your password will not change.</p>`;

  const info = await getTransport(configuration).sendMail({
    from: { name: configuration.senderName, address: configuration.senderEmail },
    to,
    subject: 'MyAgriSETA: Reset your password',
    text,
    html,
  });
  return assertRecipientAccepted(info, to);
}

function closeBrevoTransport() {
  if (transporter) {
    transporter.close();
    transporter = undefined;
  }
}

module.exports = {
  assertBrevoConfiguration,
  assertRecipientAccepted,
  closeBrevoTransport,
  getBrevoDeliveryErrorMessage,
  getBrevoConfiguration,
  maskEmailAddress,
  sendBrevoNotification,
  sendPasswordResetEmail,
};
