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
  await getTransport(configuration).sendMail({
    from: { name: configuration.senderName, address: configuration.senderEmail },
    to,
    subject: `MyAgriSETA: ${title}`,
    text,
    html,
  });
  return { status: 'sent' };
}

function closeBrevoTransport() {
  if (transporter) {
    transporter.close();
    transporter = undefined;
  }
}

module.exports = {
  assertBrevoConfiguration,
  closeBrevoTransport,
  getBrevoDeliveryErrorMessage,
  getBrevoConfiguration,
  sendBrevoNotification,
};
