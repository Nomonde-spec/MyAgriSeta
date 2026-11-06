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
  const result = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password }),
  });
  assert.equal(result.response.status, 200);
  return result.body.token;
}

function auth(token) {
  return { Authorization: `Bearer ${token}` };
}

test('service document requirements and uploads are validated and private', async () => {
  const learnerToken = await login('learner', 'Lerato123!');
  const farmerToken = await login('farmer', 'Sipho123!');
  const adminToken = await login('admin', 'Admin123!');
  const requirement = `Application document ${Date.now()}`;

  const forbiddenUpdate = await request('/admin/services/svc-2/requirements', {
    method: 'PATCH',
    headers: auth(learnerToken),
    body: JSON.stringify({ requiredDocuments: [requirement] }),
  });
  assert.equal(forbiddenUpdate.response.status, 403);

  const updatedService = await request('/admin/services/svc-2/requirements', {
    method: 'PATCH',
    headers: auth(adminToken),
    body: JSON.stringify({ requiredDocuments: [requirement] }),
  });
  assert.equal(updatedService.response.status, 200);

  const applicationData = {
    fullName: 'Lerato Khumalo',
    email: 'learner@myagriseta.local',
    phone: '',
    motivation: 'I would like to develop my agricultural skills.',
    consent: true,
  };
  const missingDocument = await request('/applications', {
    method: 'POST',
    headers: auth(learnerToken),
    body: JSON.stringify({ serviceId: 'svc-2', applicationData, documents: [] }),
  });
  assert.equal(missingDocument.response.status, 400);

  const encodedPdf = Buffer.from('%PDF-1.4\nworkflow test\n%%EOF', 'ascii').toString('base64');
  const submitted = await request('/applications', {
    method: 'POST',
    headers: auth(learnerToken),
    body: JSON.stringify({
      serviceId: 'svc-2',
      applicationData,
      documents: [{
        requirement,
        filename: 'farm-profile.pdf',
        mimeType: 'application/pdf',
        size: Buffer.from(encodedPdf, 'base64').length,
        data: encodedPdf,
      }],
    }),
  });
  assert.equal(submitted.response.status, 201);
  assert.equal(submitted.body.application.documents[0].filename, 'farm-profile.pdf');
  assert.equal(JSON.stringify(submitted.body).includes(encodedPdf), false);

  const applicantList = await request('/applications', { headers: auth(learnerToken) });
  assert.equal(JSON.stringify(applicantList.body).includes(encodedPdf), false);
  const documentId = submitted.body.application.documents[0].id;
  const applicantDocument = await request(
    `/applications/${submitted.body.application.id}/documents/${documentId}`,
    { headers: auth(learnerToken) }
  );
  assert.equal(applicantDocument.response.status, 200);
  assert.equal(applicantDocument.body.document.data, encodedPdf);

  const otherApplicant = await request(
    `/applications/${submitted.body.application.id}/documents/${documentId}`,
    { headers: auth(farmerToken) }
  );
  assert.equal(otherApplicant.response.status, 404);

  const reviewQueue = await request('/staff/review-queue', { headers: auth(adminToken) });
  const reviewedApplication = reviewQueue.body.applications.find((entry) => entry.id === submitted.body.application.id);
  assert.equal(reviewedApplication.applicationData.motivation, applicationData.motivation);
  assert.equal(reviewedApplication.documents[0].filename, 'farm-profile.pdf');
  assert.equal(JSON.stringify(reviewQueue.body).includes(encodedPdf), false);

  const reviewerDocument = await request(
    `/applications/${submitted.body.application.id}/documents/${documentId}`,
    { headers: auth(adminToken) }
  );
  assert.equal(reviewerDocument.response.status, 200);
  assert.equal(reviewerDocument.body.document.data, encodedPdf);

  const reset = await request('/admin/services/svc-2/requirements', {
    method: 'PATCH',
    headers: auth(adminToken),
    body: JSON.stringify({ requiredDocuments: [] }),
  });
  assert.equal(reset.response.status, 200);
});

test('application uploads reject invalid file signatures and account email mismatches', async () => {
  const learnerToken = await login('learner', 'Lerato123!');
  const adminToken = await login('admin', 'Admin123!');
  const requirement = `PDF proof ${Date.now()}`;
  const configured = await request('/admin/services/svc-3/requirements', {
    method: 'PATCH',
    headers: auth(adminToken),
    body: JSON.stringify({ requiredDocuments: [requirement] }),
  });
  assert.equal(configured.response.status, 200);

  const applicationData = {
    fullName: 'Lerato Khumalo',
    email: 'learner@myagriseta.local',
    phone: '',
    motivation: 'I would like to develop my agricultural skills.',
    consent: true,
  };
  const invalidFile = await request('/applications', {
    method: 'POST',
    headers: auth(learnerToken),
    body: JSON.stringify({
      serviceId: 'svc-3',
      applicationData,
      documents: [{
        requirement,
        filename: 'fake.pdf',
        mimeType: 'application/pdf',
        size: 5,
        data: Buffer.from('not pdf', 'ascii').toString('base64'),
      }],
    }),
  });
  assert.equal(invalidFile.response.status, 400);

  const emailMismatch = await request('/applications', {
    method: 'POST',
    headers: auth(learnerToken),
    body: JSON.stringify({
      serviceId: 'svc-3',
      applicationData: { ...applicationData, email: 'someone@example.org' },
      documents: [],
    }),
  });
  assert.equal(emailMismatch.response.status, 400);

  const reset = await request('/admin/services/svc-3/requirements', {
    method: 'PATCH',
    headers: auth(adminToken),
    body: JSON.stringify({ requiredDocuments: [] }),
  });
  assert.equal(reset.response.status, 200);
});
