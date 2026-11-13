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
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
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

function auth(token) {
  return { authorization: ['Bea', 'rer ', token].join('') };
}

test('learners and farmers can manage only their own explicitly self-reported passport skills', async () => {
  const learnerToken = await login('learner', 'Lerato123!');
  const farmerToken = await login('farmer', 'Sipho123!');
  const providerToken = await login('provider', 'Naledi123!');
  const employerToken = await login('employer', 'Thandi123!');
  const sdfToken = await login('sdf', 'Mpho123!');
  const adminToken = await login('admin', 'Admin123!');
  const staffAccount = await request('/users', {
    method: 'POST',
    headers: auth(adminToken),
    body: JSON.stringify({
      firstName: 'Passport',
      lastName: 'Reviewer',
      email: 'passport-reviewer@example.test',
      username: 'passport-reviewer',
      password: 'PassportReview123!',
      roles: ['internal_staff'],
      activeRole: 'internal_staff',
    }),
  });
  assert.equal(staffAccount.response.status, 201);
  const staffToken = await login('passport-reviewer', 'PassportReview123!');
  const learnerPassport = await request('/passport', { headers: auth(learnerToken) });
  assert.equal(learnerPassport.response.status, 200);
  assert.deepEqual(learnerPassport.body.skills, []);

  const farmerPassport = await request('/passport', { headers: auth(farmerToken) });
  assert.equal(farmerPassport.response.status, 200);
  assert.deepEqual(farmerPassport.body.skills, []);
  const farmerSkill = await request('/passport/skills', {
    method: 'POST',
    headers: auth(farmerToken),
    body: JSON.stringify({
      name: 'Seasonal crop planning',
      category: 'Farm management',
      level: 'Practised',
      description: 'Practical experience planning a seasonal crop cycle.',
    }),
  });
  assert.equal(farmerSkill.response.status, 201);

  const invalid = await request('/passport/skills', {
    method: 'POST',
    headers: auth(learnerToken),
    body: JSON.stringify({ name: 'Crop planning', level: 'Verified' }),
  });
  assert.equal(invalid.response.status, 400);

  const created = await request('/passport/skills', {
    method: 'POST',
    headers: auth(learnerToken),
    body: JSON.stringify({
      name: 'Crop planning',
      category: 'Crop production',
      level: 'Developing',
      description: 'Self-reported experience planning a seasonal crop cycle.',
      userId: 'usr-farmer',
      verificationStatus: 'Verified',
    }),
  });
  assert.equal(created.response.status, 201);
  assert.equal(created.body.skill.verificationStatus, 'Self-reported · not verified');
  assert.equal(Object.hasOwn(created.body.skill, 'userId'), false);

  const otherPassport = await request('/passport', { headers: auth(farmerToken) });
  assert.equal(otherPassport.body.skills.some((skill) => skill.id === created.body.skill.id), false);
  assert.ok(otherPassport.body.skills.some((skill) => skill.id === farmerSkill.body.skill.id));
  const forbiddenEdit = await request(`/passport/skills/${created.body.skill.id}`, {
    method: 'PATCH',
    headers: auth(farmerToken),
    body: JSON.stringify({ name: 'Changed by another user', level: 'Advanced' }),
  });
  assert.equal(forbiddenEdit.response.status, 404);
  const forbiddenDelete = await request(`/passport/skills/${created.body.skill.id}`, {
    method: 'DELETE',
    headers: auth(farmerToken),
  });
  assert.equal(forbiddenDelete.response.status, 404);

  const forbiddenRole = await request('/passport', { headers: auth(providerToken) });
  assert.equal(forbiddenRole.response.status, 403);
  for (const token of [employerToken, sdfToken, adminToken, staffToken]) {
    const forbiddenPassport = await request('/passport', { headers: auth(token) });
    assert.equal(forbiddenPassport.response.status, 403);
  }
  const farmerDelete = await request(`/passport/skills/${farmerSkill.body.skill.id}`, {
    method: 'DELETE',
    headers: auth(farmerToken),
  });
  assert.equal(farmerDelete.response.status, 200);

  const updated = await request(`/passport/skills/${created.body.skill.id}`, {
    method: 'PATCH',
    headers: auth(learnerToken),
    body: JSON.stringify({
      name: 'Crop-cycle planning',
      category: 'Crop production',
      level: 'Practised',
      description: '',
    }),
  });
  assert.equal(updated.response.status, 200);
  assert.equal(updated.body.skill.name, 'Crop-cycle planning');
  assert.equal(updated.body.skill.verificationStatus, 'Self-reported · not verified');

  const deleted = await request(`/passport/skills/${created.body.skill.id}`, {
    method: 'DELETE',
    headers: auth(learnerToken),
  });
  assert.equal(deleted.response.status, 200);
  const finalPassport = await request('/passport', { headers: auth(learnerToken) });
  assert.deepEqual(finalPassport.body.skills, []);
});

test('Passport records remain private to their owner until an administrator reviews submissions', async () => {
  const learnerToken = await login('learner', 'Lerato123!');
  const adminToken = await login('admin', 'Admin123!');
  const recordInput = {
    recordType: 'qualification',
    title: `Agricultural qualification ${Date.now()}`,
    organisation: 'Demonstration College',
    category: 'Agriculture',
    level: 'NQF 4',
    description: 'Completion record supplied by the learner.',
    startDate: '2024-01-01',
    endDate: '2024-12-01',
    documents: [{
      filename: 'qualification-proof.pdf',
      mimeType: 'application/pdf',
      data: Buffer.from('%PDF-1.4 sample').toString('base64'),
      size: Buffer.byteLength('%PDF-1.4 sample'),
    }],
  };
  const draft = await request('/passport/records', {
    method: 'POST',
    headers: auth(learnerToken),
    body: JSON.stringify({ ...recordInput, action: 'save' }),
  });
  assert.equal(draft.response.status, 201);
  assert.equal(draft.body.record.status, 'Draft');
  assert.equal(draft.body.record.userId, undefined);

  const submitted = await request('/passport/records', {
    method: 'POST',
    headers: auth(learnerToken),
    body: JSON.stringify({ ...recordInput, action: 'submit' }),
  });
  assert.equal(submitted.response.status, 201);
  assert.equal(submitted.body.record.status, 'Pending Verification');
  assert.match(submitted.body.record.reference, /^AGR-PAS-/);
  assert.equal(submitted.body.record.userId, undefined);
  assert.equal(submitted.body.record.documents.length, 1);
  assert.equal(submitted.body.record.documents[0].data, undefined);

  const ownerDocument = await request(
    `/passport/records/${submitted.body.record.id}/documents/${submitted.body.record.documents[0].id}`,
    { headers: auth(learnerToken) }
  );
  assert.equal(ownerDocument.response.status, 200);
  assert.equal(ownerDocument.body.document.filename, 'qualification-proof.pdf');
  assert.equal(Buffer.from(ownerDocument.body.document.data, 'base64').toString(), '%PDF-1.4 sample');
  const otherAccountDocument = await request(
    `/passport/records/${submitted.body.record.id}/documents/${submitted.body.record.documents[0].id}`,
    { headers: auth(await login('farmer', 'Sipho123!')) }
  );
  assert.equal(otherAccountDocument.response.status, 403);
  const adminDocument = await request(
    `/passport/records/${submitted.body.record.id}/documents/${submitted.body.record.documents[0].id}`,
    { headers: auth(adminToken) }
  );
  assert.equal(adminDocument.response.status, 200);

  const forbiddenQueue = await request('/admin/passport/verifications', { headers: auth(learnerToken) });
  assert.equal(forbiddenQueue.response.status, 403);
  const queue = await request('/admin/passport/verifications', { headers: auth(adminToken) });
  assert.equal(queue.response.status, 200);
  assert.ok(queue.body.records.some((entry) => entry.id === submitted.body.record.id));

  const needsInformation = await request(`/admin/passport/verifications/${submitted.body.record.id}`, {
    method: 'PATCH',
    headers: auth(adminToken),
    body: JSON.stringify({
      decision: 'request_information',
      comment: 'Please provide the completion month.',
      requirements: ['Completion month'],
    }),
  });
  assert.equal(needsInformation.response.status, 200);
  assert.equal(needsInformation.body.record.status, 'Additional Information Required');

  const resubmitted = await request('/passport/records', {
    method: 'POST',
    headers: auth(learnerToken),
    body: JSON.stringify({
      ...recordInput,
      id: submitted.body.record.id,
      action: 'submit',
      description: 'Completion month: December.',
      documents: [],
    }),
  });
  assert.equal(resubmitted.response.status, 200);
  assert.equal(resubmitted.body.record.status, 'Pending Verification');

  const verified = await request(`/admin/passport/verifications/${submitted.body.record.id}`, {
    method: 'PATCH',
    headers: auth(adminToken),
    body: JSON.stringify({ decision: 'verify', comment: 'Reviewed for completeness.' }),
  });
  assert.equal(verified.response.status, 200);
  assert.equal(verified.body.record.status, 'Verified');
  assert.equal(verified.body.record.verification.verifierRole, 'administrator');

  const ownerPassport = await request('/passport', { headers: auth(learnerToken) });
  assert.ok(ownerPassport.body.records.some((entry) =>
    entry.id === submitted.body.record.id && entry.status === 'Verified'
  ));
  const notifications = await request('/notifications', { headers: auth(learnerToken) });
  assert.ok(notifications.body.notifications.some((entry) =>
    entry.targetId === submitted.body.record.id && entry.title === 'Passport record verified'
  ));
});
