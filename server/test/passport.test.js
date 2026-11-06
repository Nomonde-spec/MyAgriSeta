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

test('users can manage only their own explicitly self-reported passport skills', async () => {
  const learnerToken = await login('learner', 'Lerato123!');
  const farmerToken = await login('farmer', 'Sipho123!');
  const providerToken = await login('provider', 'Naledi123!');
  const learnerPassport = await request('/passport', { headers: auth(learnerToken) });
  assert.equal(learnerPassport.response.status, 200);
  assert.deepEqual(learnerPassport.body.skills, []);

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
  assert.deepEqual(otherPassport.body.skills, []);
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
