const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  assertRecipientAccepted,
  getBrevoConfiguration,
  getBrevoDeliveryErrorMessage,
  maskEmailAddress,
} = require('../src/email-notifications');

const brevoVariables = [
  'BREVO_EMAIL_ENABLED',
  'BREVO_SMTP_HOST',
  'BREVO_SMTP_PORT',
  'BREVO_SMTP_LOGIN',
  'BREVO_SMTP_KEY',
  'BREVO_SENDER_EMAIL',
  'BREVO_SENDER_NAME',
];

function withEnvironment(values, callback) {
  const previous = Object.fromEntries(brevoVariables.map((name) => [name, process.env[name]]));
  for (const name of brevoVariables) delete process.env[name];
  Object.assign(process.env, values);
  try {
    callback();
  } finally {
    for (const name of brevoVariables) {
      if (previous[name] === undefined) delete process.env[name];
      else process.env[name] = previous[name];
    }
  }
}

test('Brevo email configuration is disabled unless explicitly enabled', () => {
  withEnvironment({}, () => {
    assert.deepEqual(getBrevoConfiguration(), { enabled: false });
  });
});

test('enabled Brevo email validates required SMTP settings without exposing secrets', () => {
  withEnvironment({ BREVO_EMAIL_ENABLED: 'true' }, () => {
    assert.throws(getBrevoConfiguration, /BREVO_SMTP_HOST.*BREVO_SMTP_PORT/);
  });
  withEnvironment({
    BREVO_EMAIL_ENABLED: 'true',
    BREVO_SMTP_HOST: 'smtp-relay.brevo.com',
    BREVO_SMTP_PORT: '587',
    BREVO_SMTP_LOGIN: 'smtp-login@example.test',
    BREVO_SMTP_KEY: 'test-secret',
    BREVO_SENDER_EMAIL: 'notifications@example.test',
    BREVO_SENDER_NAME: 'MyAgriSETA',
  }, () => {
    const configuration = getBrevoConfiguration();
    assert.equal(configuration.enabled, true);
    assert.equal(configuration.port, 587);
    assert.equal(configuration.host, 'smtp-relay.brevo.com');
  });
});

test('Brevo SMTP failures expose actionable messages without leaking provider responses', () => {
  assert.match(
    getBrevoDeliveryErrorMessage({ code: 'ERECIPIENT' }),
    /did not accept the recipient address/
  );
  assert.match(
    getBrevoDeliveryErrorMessage({ code: 'EAUTH', responseCode: 525 }),
    /Authorize the backend public IP/
  );
  assert.match(
    getBrevoDeliveryErrorMessage({ code: 'EAUTH', responseCode: 535 }),
    /SMTP login, SMTP key/
  );
  assert.match(
    getBrevoDeliveryErrorMessage({ code: 'ETIMEDOUT' }),
    /could not connect/
  );
});

test('Brevo delivery is successful only when SMTP explicitly accepts the recipient', () => {
  assert.deepEqual(
    assertRecipientAccepted({
      accepted: ['learner@example.test'],
      messageId: '<message-123@example.test>',
    }, 'Learner@example.test'),
    { status: 'sent', messageId: '<message-123@example.test>' }
  );
  assert.throws(
    () => assertRecipientAccepted({
      accepted: [],
      rejected: ['learner@example.test'],
    }, 'learner@example.test'),
    { code: 'ERECIPIENT' }
  );
  assert.throws(
    () => assertRecipientAccepted({}, 'learner@example.test'),
    { code: 'ERECIPIENT' }
  );
});

test('email addresses are masked before showing the delivery destination', () => {
  assert.equal(maskEmailAddress('learner@example.test'), 'l***@example.test');
  assert.equal(maskEmailAddress('invalid-address'), '');
});
