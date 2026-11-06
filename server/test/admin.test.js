const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');

const app = require('../src/server');

let server;
let baseUrl;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}/api`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  const text = await response.text();
  return { response, body: text ? JSON.parse(text) : {} };
}

async function login(identifier, password) {
  const { response, body } = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password }),
  });
  assert.equal(response.status, 200);
  return body.token;
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });

test('administrator can create, update, reassign roles and deactivate accounts with authorization guards', async () => {
  const adminToken = await login('admin', 'Admin123!');
  const learnerToken = await login('learner', 'Lerato123!');
  const suffix = Date.now();
  const created = await request('/users', {
    method: 'POST',
    headers: auth(adminToken),
    body: JSON.stringify({
      firstName: 'Provisioned',
      lastName: 'Farmer',
      email: `provisioned.${suffix}@example.test`,
      username: `provisioned-${suffix}`,
      password: 'Provisioned123!',
      roles: ['farmer'],
    }),
  });
  assert.equal(created.response.status, 201);
  assert.deepEqual(created.body.user.permissions, ['view_profile', 'view_services', 'view_opportunities', 'track_applications']);
  const previousPasswordToken = await login(created.body.user.username, 'Provisioned123!');

  const forbiddenEdit = await request(`/users/${created.body.user.id}`, {
    method: 'PATCH',
    headers: auth(learnerToken),
    body: JSON.stringify({ roles: ['administrator'] }),
  });
  assert.equal(forbiddenEdit.response.status, 403);

  const changed = await request(`/users/${created.body.user.id}`, {
    method: 'PATCH',
    headers: auth(adminToken),
    body: JSON.stringify({
      firstName: 'Updated',
      organization: 'Updated Agricultural Cooperative',
      roles: ['farmer', 'employer'],
      activeRole: 'employer',
      password: 'NewProvisioned123!',
    }),
  });
  assert.equal(changed.response.status, 200);
  assert.equal(changed.body.user.activeRole, 'employer');
  assert.ok(changed.body.user.permissions.includes('manage_employer_info'));
  const invalidatedPasswordSession = await request('/me', { headers: auth(previousPasswordToken) });
  assert.equal(invalidatedPasswordSession.response.status, 401);

  const updatedToken = await login(created.body.user.username, 'NewProvisioned123!');
  const deactivate = await request(`/users/${created.body.user.id}/status`, {
    method: 'PATCH',
    headers: auth(adminToken),
    body: JSON.stringify({ status: 'inactive' }),
  });
  assert.equal(deactivate.response.status, 200);
  const inactiveLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier: created.body.user.username, password: 'NewProvisioned123!' }),
  });
  assert.equal(inactiveLogin.response.status, 401);
  const staleSession = await request('/me', { headers: auth(updatedToken) });
  assert.equal(staleSession.response.status, 401);
});

test('administrator announcements are managed, role-targeted, and visible only while published', async () => {
  const adminToken = await login('admin', 'Admin123!');
  const farmerToken = await login('farmer', 'Sipho123!');
  const learnerToken = await login('learner', 'Lerato123!');

  const denied = await request('/admin/announcements', { headers: auth(learnerToken) });
  assert.equal(denied.response.status, 403);

  const created = await request('/admin/announcements', {
    method: 'POST',
    headers: auth(adminToken),
    body: JSON.stringify({
      title: 'Farmer service notice',
      message: 'A scheduled service notice for farmers.',
      audience: ['farmer'],
      status: 'published',
    }),
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.body.announcement.emailDelivery.status, 'disabled');

  const farmerNotifications = await request('/notifications', { headers: auth(farmerToken) });
  const announcement = farmerNotifications.body.notifications.find((item) => item.id === created.body.announcement.id);
  assert.ok(announcement);
  assert.equal(announcement.canMarkRead, false);
  assert.equal(announcement.createdBy, undefined);

  const learnerNotifications = await request('/notifications', { headers: auth(learnerToken) });
  assert.equal(learnerNotifications.body.notifications.some((item) => item.id === created.body.announcement.id), false);

  const archived = await request(`/admin/announcements/${created.body.announcement.id}`, {
    method: 'PATCH',
    headers: auth(adminToken),
    body: JSON.stringify({
      title: created.body.announcement.title,
      message: created.body.announcement.message,
      audience: ['farmer'],
      status: 'archived',
    }),
  });
  assert.equal(archived.response.status, 200);
  const archivedNotifications = await request('/notifications', { headers: auth(farmerToken) });
  assert.equal(archivedNotifications.body.notifications.some((item) => item.id === created.body.announcement.id), false);
});

test('administrator reports aggregate activity without exposing identities and validate date ranges', async () => {
  const adminToken = await login('admin', 'Admin123!');
  const report = await request('/admin/reports?from=2026-01-01&to=2026-12-31', { headers: auth(adminToken) });
  assert.equal(report.response.status, 200);
  assert.equal(typeof report.body.accounts.total, 'number');
  assert.equal(typeof report.body.applications.submittedInPeriod, 'number');
  assert.equal(report.body.privacyNote.includes('no applicant'), true);
  assert.equal(JSON.stringify(report.body).includes('@myagriseta.local'), false);

  const invalidRange = await request('/admin/reports?from=2026-12-31&to=2026-01-01', { headers: auth(adminToken) });
  assert.equal(invalidRange.response.status, 400);

  const denied = await request('/admin/reports', { headers: auth(await login('learner', 'Lerato123!')) });
  assert.equal(denied.response.status, 403);
});
