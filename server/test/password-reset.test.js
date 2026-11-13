const assert = require('node:assert/strict');
const { after, before, beforeEach, test } = require('node:test');

const app = require('../src/server');

let server;
let baseUrl;
let sentEmails;
let nextEmail;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  delete app.locals.passwordResetMailer;
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

// Stand-in for Brevo: records what would have been emailed so the test can
// read the reset code without any real email being sent.
beforeEach(() => {
  sentEmails = [];
  nextEmail = null;
  app.locals.passwordResetMailer = async (message) => {
    sentEmails.push(message);
    if (nextEmail) nextEmail(message);
    return { status: 'sent' };
  };
});

function waitForEmail() {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('No reset email was sent.')), 2000);
    nextEmail = (message) => {
      clearTimeout(timer);
      resolve(message);
    };
  });
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const text = await response.text();
  return { response, body: text ? JSON.parse(text) : {} };
}

const post = (path, body, headers = {}) => request(path, { method: 'POST', body: JSON.stringify(body), headers });

test('reset request gives the same response for known and unknown emails', async () => {
  const unknown = await post('/auth/password-reset/request', { email: 'nobody@myagriseta.local' });
  assert.equal(unknown.response.status, 200);

  const emailPromise = waitForEmail();
  const known = await post('/auth/password-reset/request', { email: 'employer@myagriseta.local' });
  assert.equal(known.response.status, 200);
  assert.equal(known.body.message, unknown.body.message);

  const email = await emailPromise;
  assert.equal(email.to, 'employer@myagriseta.local');
  assert.match(email.resetCode, /^[a-f0-9]{64}$/);
  assert.ok(email.resetUrl.includes(`token=${email.resetCode}`));
  assert.equal(sentEmails.length, 1);
});

test('reset request validates the email address', async () => {
  const { response } = await post('/auth/password-reset/request', { email: 'not-an-email' });
  assert.equal(response.status, 400);
});

test('reset is unavailable when no email provider is configured', async () => {
  delete app.locals.passwordResetMailer;
  const { response, body } = await post('/auth/password-reset/request', { email: 'farmer@myagriseta.local' });
  assert.equal(response.status, 503);
  assert.match(body.message, /administrator/);
});

test('a reset code changes the password once, signs out old sessions, and is audited', async () => {
  const oldLogin = await post('/auth/login', { identifier: 'sdf@myagriseta.local', password: 'Mpho123!' });
  assert.equal(oldLogin.response.status, 200);
  const oldToken = oldLogin.body.token;

  const emailPromise = waitForEmail();
  await post('/auth/password-reset/request', { email: 'sdf@myagriseta.local' });
  const { resetCode } = await emailPromise;

  const weak = await post('/auth/password-reset/confirm', { token: resetCode, password: 'short' });
  assert.equal(weak.response.status, 400);

  const confirmed = await post('/auth/password-reset/confirm', { token: resetCode, password: 'NewSdfPass123!' });
  assert.equal(confirmed.response.status, 200);

  const reused = await post('/auth/password-reset/confirm', { token: resetCode, password: 'AnotherPass123!' });
  assert.equal(reused.response.status, 400);

  const newLogin = await post('/auth/login', { identifier: 'sdf@myagriseta.local', password: 'NewSdfPass123!' });
  assert.equal(newLogin.response.status, 200);

  const oldPassword = await post('/auth/login', { identifier: 'sdf@myagriseta.local', password: 'Mpho123!' });
  assert.equal(oldPassword.response.status, 401);

  const me = await request('/me', { headers: { Authorization: `Bearer ${oldToken}` } });
  assert.equal(me.response.status, 401);

  const adminLogin = await post('/auth/login', { identifier: 'admin@myagriseta.local', password: 'Admin123!' });
  const audit = await request('/admin/audit', { headers: { Authorization: `Bearer ${adminLogin.body.token}` } });
  assert.equal(audit.response.status, 200);
  assert.ok(audit.body.entries.some((entry) =>
    entry.user === 'sdf@myagriseta.local' && /reset account password/i.test(entry.action)));
});

test('invalid or malformed reset codes are rejected without detail', async () => {
  const malformed = await post('/auth/password-reset/confirm', { token: 'abc', password: 'ValidPass123!' });
  assert.equal(malformed.response.status, 400);
  const unknown = await post('/auth/password-reset/confirm', { token: 'a'.repeat(64), password: 'ValidPass123!' });
  assert.equal(unknown.response.status, 400);
  assert.equal(unknown.body.message, malformed.body.message);
});

test('reset response never exposes reset fields through the user API', async () => {
  const emailPromise = waitForEmail();
  await post('/auth/password-reset/request', { email: 'provider@myagriseta.local' });
  await emailPromise;
  const adminLogin = await post('/auth/login', { identifier: 'admin@myagriseta.local', password: 'Admin123!' });
  const usersResponse = await request('/users',{ headers: { Authorization: `Bearer ${adminLogin.body.token}` } });
  assert.equal(usersResponse.response.status, 200);
  const serialized = JSON.stringify(usersResponse.body);
  assert.ok(!serialized.includes('passwordResetTokenHash'));
  assert.ok(!serialized.includes('passwordHash'));
});
