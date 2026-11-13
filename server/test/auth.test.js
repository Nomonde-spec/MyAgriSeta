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
  return { Authorization: `Bearer ${token}` };
}

function roleEvidence(role, suffix = 'Example') {
  switch (role) {
    case 'learner':
      return {};
    case 'farmer':
      return { farmName: `Farm ${suffix}`, province: 'Limpopo', verificationReference: `Extension ${suffix}` };
    case 'employer':
      return { organization: `Employer ${suffix}`, registrationNumber: `CIPC-${suffix}`, workEmail: `${suffix.toLowerCase()}@company.example.test` };
    case 'sdf':
      return { organization: `SDF Employer ${suffix}`, workEmail: `${suffix.toLowerCase()}@sdf.example.test`, authorizationReference: `AUTH-${suffix}` };
    case 'training_provider':
      return { organization: `Provider ${suffix}`, registrationBody: `Registration body ${suffix}`, providerReference: `PROVIDER-${suffix}` };
    default:
      throw new Error(`No registration test evidence for role ${role}.`);
  }
}

test('public stakeholder registration creates an inactive account pending administrator role verification', async () => {
  const { response, body } = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      firstName: 'Self',
      lastName: 'Registered',
      email: 'self.registered@example.test',
      username: 'self-registered',
      password: 'SelfRegistered123!',
      role: 'farmer',
      verificationDetails: roleEvidence('farmer', 'Self'),
    }),
  });
  assert.equal(response.status, 202);
  assert.equal(body.role, 'farmer');
  assert.equal(body.roleVerificationStatus, 'pending');

  const pendingLogin = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier: 'self-registered', password: 'SelfRegistered123!' }),
  });
  assert.equal(pendingLogin.response.status, 403);

  const anonymousQueue = await request('/admin/role-requests');
  assert.equal(anonymousQueue.response.status, 401);

  const learnerToken = await login('learner@myagriseta.local', 'Lerato123!');
  const learnerQueue = await request('/admin/role-requests', {
    headers: { Authorization: `Bearer ${learnerToken}` },
  });
  assert.equal(learnerQueue.response.status, 403);

  const adminToken = await login('admin@myagriseta.local', 'Admin123!');
  const queue = await request('/admin/role-requests', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  assert.equal(queue.response.status, 200);
  const requestRecord = queue.body.requests.find((item) => item.email === 'self.registered@example.test');
  assert.ok(requestRecord);
  assert.equal(requestRecord.verificationDetails.farmName, 'Farm Self');

  const approval = await request(`/admin/role-requests/${requestRecord.id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ decision: 'approved' }),
  });
  assert.equal(approval.response.status, 200);
  assert.equal(approval.body.user.status, 'active');

  const approvedToken = await login('self-registered', 'SelfRegistered123!');
  const meResponse = await request('/me', {
    headers: { Authorization: `Bearer ${approvedToken}` },
  });
  assert.equal(meResponse.response.status, 200);
  assert.equal(meResponse.body.user.email, 'self.registered@example.test');

  const duplicateResponse = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      firstName: 'Self',
      lastName: 'Registered',
      email: 'self.registered@example.test',
      username: 'different-username',
      password: 'SelfRegistered123!',
      role: 'learner',
      verificationDetails: roleEvidence('learner', 'Duplicate'),
    }),
  });
  assert.equal(duplicateResponse.response.status, 409);
});

test('learner self-registration activates immediately without institution identifiers', async () => {
  const registration = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      firstName: 'Learner',
      lastName: 'Applicant',
      email: 'learner.applicant@example.test',
      username: 'learner-applicant',
      password: 'LearnerApplicant123!',
      role: 'learner',
    }),
  });
  const withRemovedFields = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      firstName: 'Learner',
      lastName: 'With Identifiers',
      email: 'learner.identifiers@example.test',
      username: 'learner-identifiers',
      password: 'LearnerIdentifiers123!',
      role: 'learner',
      verificationDetails: {
        institutionName: 'Example College',
        learnerReference: 'STU-12345',
      },
    }),
  });

  assert.equal(registration.response.status, 201);
  assert.equal(registration.body.roleVerificationStatus, 'approved');
  const adminToken = await login('admin@myagriseta.local', 'Admin123!');
  const queue = await request('/admin/role-requests', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const learnerRequest = queue.body.requests.find((item) => item.email === 'learner.applicant@example.test');
  assert.equal(learnerRequest, undefined);
  const learnerToken = await login('learner-applicant', 'LearnerApplicant123!');
  const learnerProfile = await request('/me', { headers: auth(learnerToken) });
  assert.equal(learnerProfile.response.status, 200);
  assert.equal(learnerProfile.body.user.email, 'learner.applicant@example.test');
  assert.equal(withRemovedFields.response.status, 400);
});

test('administrator approval provisions a private training-provider profile for completion', async () => {
  const suffix = `Provider${Date.now()}`;
  const registration = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      firstName: 'Provider',
      lastName: 'Applicant',
      email: `${suffix.toLowerCase()}@example.test`,
      username: suffix.toLowerCase(),
      password: 'ProviderApplicant123!',
      role: 'training_provider',
      verificationDetails: roleEvidence('training_provider', suffix),
    }),
  });
  assert.equal(registration.response.status, 202);

  const adminToken = await login('admin@myagriseta.local', 'Admin123!');
  const queue = await request('/admin/role-requests', {
    headers: auth(adminToken),
  });
  const providerRequest = queue.body.requests.find((item) => item.email === `${suffix.toLowerCase()}@example.test`);
  assert.ok(providerRequest);

  const approval = await request(`/admin/role-requests/${providerRequest.id}`, {
    method: 'PATCH',
    headers: auth(adminToken),
    body: JSON.stringify({ decision: 'approved' }),
  });
  assert.equal(approval.response.status, 200);

  const providerToken = await login(suffix.toLowerCase(), 'ProviderApplicant123!');
  const providerWorkspace = await request('/learning/provider/me', {
    headers: auth(providerToken),
  });
  assert.equal(providerWorkspace.response.status, 200);
  assert.equal(providerWorkspace.body.provider.name, `Provider ${suffix}`);
  assert.equal(providerWorkspace.body.provider.profileStatus, 'pending_review');
  assert.equal(providerWorkspace.body.provider.dataStatus.includes('pending administrator review'), true);

  const prematureApproval = await request(`/learning/admin/providers/${providerWorkspace.body.provider.id}`, {
    method: 'PATCH',
    headers: auth(adminToken),
    body: JSON.stringify({ decision: 'approve' }),
  });
  assert.equal(prematureApproval.response.status, 409);

  const profileSubmission = await request('/learning/provider/profile', {
    method: 'PATCH',
    headers: auth(providerToken),
    body: JSON.stringify({
      name: `Completed ${suffix}`,
      location: 'Limpopo, South Africa',
      description: 'Agricultural training provider profile submitted for review.',
    }),
  });
  assert.equal(profileSubmission.response.status, 200);

  const profileApproval = await request(`/learning/admin/providers/${providerWorkspace.body.provider.id}`, {
    method: 'PATCH',
    headers: auth(adminToken),
    body: JSON.stringify({ decision: 'approve' }),
  });
  assert.equal(profileApproval.response.status, 200);

  const publishedProvider = await request('/learning/provider/me', {
    headers: auth(providerToken),
  });
  assert.equal(publishedProvider.body.provider.name, `Completed ${suffix}`);
  assert.equal(publishedProvider.body.provider.profileStatus, 'published');
});

test('duplicate farmer and SDF verification references are rejected', async () => {
  const farmerFirst = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      firstName: 'Rural',
      lastName: 'Grower',
      email: 'rural.grower@example.test',
      username: 'rural-grower',
      password: 'RuralGrower123!',
      role: 'farmer',
      verificationDetails: roleEvidence('farmer', 'DuplicateFarmer'),
    }),
  });
  const farmerDuplicate = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      firstName: 'Rural',
      lastName: 'Grower 2',
      email: 'rural.grower.2@example.test',
      username: 'rural-grower-2',
      password: 'RuralGrower123!',
      role: 'farmer',
      verificationDetails: roleEvidence('farmer', 'DuplicateFarmer'),
    }),
  });
  const sdfFirst = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      firstName: 'Skills',
      lastName: 'Advisor',
      email: 'skills.advisor@example.test',
      username: 'skills-advisor',
      password: 'SkillsAdvisor123!',
      role: 'sdf',
      verificationDetails: roleEvidence('sdf', 'DuplicateSdf'),
    }),
  });
  const sdfDuplicate = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      firstName: 'Skills',
      lastName: 'Advisor 2',
      email: 'skills.advisor.2@example.test',
      username: 'skills-advisor-2',
      password: 'SkillsAdvisor123!',
      role: 'sdf',
      verificationDetails: roleEvidence('sdf', 'DuplicateSdf'),
    }),
  });

  assert.equal(farmerFirst.response.status, 202);
  assert.equal(farmerDuplicate.response.status, 409);
  assert.equal(sdfFirst.response.status, 202);
  assert.equal(sdfDuplicate.response.status, 409);
});

test('rejected role requests cannot be activated outside the verification workflow', async () => {
  const registration = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      firstName: 'Rejected',
      lastName: 'Farmer',
      email: 'rejected.farmer@example.test',
      username: 'rejected-farmer',
      password: 'RejectedFarmer123!',
      role: 'farmer',
      verificationDetails: roleEvidence('farmer', 'Rejected'),
    }),
  });
  const adminToken = await login('admin@myagriseta.local', 'Admin123!');
  const queue = await request('/admin/role-requests', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const requestRecord = queue.body.requests.find((item) => item.email === 'rejected.farmer@example.test');
  assert.ok(requestRecord);

  const rejected = await request(`/admin/role-requests/${requestRecord.id}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ decision: 'rejected', note: 'The submitted reference could not be verified.' }),
  });
  assert.equal(rejected.response.status, 200);
  assert.equal(rejected.body.user.status, 'inactive');

  const activate = await request(`/users/${requestRecord.id}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ status: 'active' }),
  });
  assert.equal(activate.response.status, 409);
  assert.equal(registration.response.status, 202);
});

test('self-registration rejects privileged roles and client-assigned account permissions', async () => {
  const privilegedRole = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      firstName: 'Privileged',
      lastName: 'Applicant',
      email: 'privileged.applicant@example.test',
      username: 'privileged-applicant',
      password: 'ValidPassword123!',
      role: 'administrator',
    }),
  });
  const roleInjection = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      firstName: 'Role',
      lastName: 'Injection',
      email: 'role.injection@example.test',
      username: 'role-injection',
      password: 'ValidPassword123!',
      role: 'learner',
      roles: ['administrator'],
      activeRole: 'administrator',
    }),
  });

  assert.equal(privilegedRole.response.status, 400);
  assert.equal(roleInjection.response.status, 400);
});

test('health reports when Neon is unavailable', async () => {
  const response = await fetch(`http://127.0.0.1:${server.address().port}/health`);
  const body = await response.json();
  assert.equal(response.status, 503);
  assert.equal(body.status, 'unavailable');
  assert.equal(body.storage, 'unavailable');
  assert.equal(body.emailNotifications, 'disabled');
});

test('user administration requires authentication', async () => {
  const listResponse = await request('/users');
  const createResponse = await request('/users', {
    method: 'POST',
    body: JSON.stringify({}),
  });

  assert.equal(listResponse.response.status, 401);
  assert.equal(createResponse.response.status, 401);
});

test('administrator can provision a stakeholder account with a server-assigned role and permission set', async () => {
  const token = await login('admin@myagriseta.local', 'Admin123!');
  const { response, body } = await request('/users', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      firstName: 'Test',
      lastName: 'Farmer',
      email: 'test.farmer@example.test',
      username: 'test-farmer',
      password: 'TestPass123!',
      roles: ['farmer'],
      activeRole: 'farmer',
    }),
  });

  assert.equal(response.status, 201);
  assert.equal(body.user.activeRole, 'farmer');
  assert.deepEqual(body.user.permissions, ['view_profile', 'view_services', 'view_opportunities', 'track_applications']);
  const userToken = await login('test-farmer', 'TestPass123!');
  const profile = await request('/me', { headers: { Authorization: `Bearer ${userToken}` } });
  assert.equal(profile.response.status, 200);
  assert.equal(profile.body.user.status, 'active');
});

test('non-admin users cannot create accounts', async () => {
  const token = await login('learner@myagriseta.local', 'Lerato123!');
  const { response } = await request('/users', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      firstName: 'Unauthorized',
      lastName: 'User',
      email: 'unauthorized@example.test',
      username: 'unauthorized-user',
      password: 'TestPass123!',
      roles: ['administrator'],
    }),
  });

  assert.equal(response.status, 403);
});

test('each supported role receives a distinct dashboard with role-eligible services', async () => {
  const roles = ['learner', 'farmer', 'employer', 'sdf', 'training_provider', 'administrator'];
  const provisioningToken = await login('admin@myagriseta.local', 'Admin123!');

  for (const role of roles) {
    if (role === 'learner' || role === 'farmer' || role === 'sdf' || role === 'administrator') {
      continue;
    }

    const { response } = await request('/users', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + provisioningToken },
      body: JSON.stringify({
        firstName: 'Dashboard',
        lastName: role,
        email: `dashboard.${role}@example.test`,
        username: `dashboard-${role}`,
        password: 'DashboardPass123!',
        roles: [role],
      }),
    });
    assert.equal(response.status, 201);
  }

  const adminToken = await login('admin@myagriseta.local', 'Admin123!');
  const queue = await request('/admin/role-requests', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  for (const role of []) {
    const requestRecord = queue.body.requests.find((item) => item.email === `dashboard.${role}@example.test`);
    assert.ok(requestRecord);
    const approval = await request(`/admin/role-requests/${requestRecord.id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: JSON.stringify({ decision: 'approved' }),
    });
    assert.equal(approval.response.status, 200);
  }

  const dashboards = await Promise.all(roles.map(async (role) => {
    const identifierByRole = {
      learner: 'learner@myagriseta.local',
      farmer: 'farmer@myagriseta.local',
      employer: 'dashboard-employer',
      sdf: 'sdf@myagriseta.local',
      training_provider: 'dashboard-training_provider',
      administrator: 'admin@myagriseta.local',
    };
    const password = role === 'administrator' ? 'Admin123!' : role === 'learner' ? 'Lerato123!' : role === 'farmer' ? 'Sipho123!' : role === 'sdf' ? 'Mpho123!' : 'DashboardPass123!';
    const token = await login(identifierByRole[role], password);
    const { response, body } = await request('/dashboard', {
      headers: { Authorization: 'Bearer ' + token },
    });
    assert.equal(response.status, 200);
    return { role, dashboard: body };
  }));

  assert.equal(new Set(dashboards.map(({ dashboard }) => dashboard.title)).size, roles.length);
  for (const { role, dashboard } of dashboards) {
    assert.equal(dashboard.userRole, role);
    assert.ok(Array.isArray(dashboard.metrics));
    assert.ok(Array.isArray(dashboard.sections));
  }

  const learnerServices = dashboards.find(({ role }) => role === 'learner').dashboard.sections[0].items;
  const farmerServices = dashboards.find(({ role }) => role === 'farmer').dashboard.sections[0].items;
  assert.ok(learnerServices.some((service) => service.id === 'svc-2'));
  assert.ok(!farmerServices.some((service) => service.id === 'svc-2'));
});

test('employer and training-provider demo accounts can authenticate to their assigned dashboards', async () => {
  const accounts = [
    { identifier: 'employer', password: 'Thandi123!', role: 'employer' },
    { identifier: 'provider', password: 'Naledi123!', role: 'training_provider' },
  ];

  for (const account of accounts) {
    const token = await login(account.identifier, account.password);
    const { response, body } = await request('/dashboard', {
      headers: { Authorization: ['Bearer', token].join(' ') },
    });
    assert.equal(response.status, 200);
    assert.equal(body.userRole, account.role);
  }
});

test('users can update and clear only their own editable profile fields', async () => {
  const learnerToken = await login('learner@myagriseta.local', 'Lerato123!');
  const farmerToken = await login('farmer@myagriseta.local', 'Sipho123!');
  const learnerHeaders = { Authorization: `Bearer ${learnerToken}` };
  const farmerHeaders = { Authorization: `Bearer ${farmerToken}` };
  const originalLearner = await request('/me', { headers: learnerHeaders });
  const originalFarmer = await request('/me', { headers: farmerHeaders });

  assert.equal(originalLearner.response.status, 200);
  assert.equal(originalFarmer.response.status, 200);
  assert.deepEqual(originalFarmer.body.user.farmProfile, { farmName: '', province: '' });
  assert.equal(Object.hasOwn(originalLearner.body.user, 'farmProfile'), false);

  const unauthenticatedUpdate = await request('/me', {
    method: 'PATCH',
    body: JSON.stringify({ firstName: 'Unauthorised' }),
  });
  assert.equal(unauthenticatedUpdate.response.status, 401);

  const forbiddenUpdate = await request('/me', {
    method: 'PATCH',
    headers: learnerHeaders,
    body: JSON.stringify({ email: 'different@example.test' }),
  });
  assert.equal(forbiddenUpdate.response.status, 400);

  const learnerFarmUpdate = await request('/me', {
    method: 'PATCH',
    headers: learnerHeaders,
    body: JSON.stringify({ farmName: 'Unauthorised Farm', province: 'Limpopo' }),
  });
  assert.equal(learnerFarmUpdate.response.status, 400);

  const invalidPhone = await request('/me', {
    method: 'PATCH',
    headers: learnerHeaders,
    body: JSON.stringify({ phone: 'not a phone number' }),
  });
  assert.equal(invalidPhone.response.status, 400);

  const duplicatePhone = await request('/me', {
    method: 'PATCH',
    headers: learnerHeaders,
    body: JSON.stringify({ phone: originalFarmer.body.user.phone }),
  });
  assert.equal(duplicatePhone.response.status, 409);

  const updated = await request('/me', {
    method: 'PATCH',
    headers: learnerHeaders,
    body: JSON.stringify({
      firstName: 'Updated',
      lastName: 'Learner',
      phone: '0761234987',
      organization: 'My updated organisation',
    }),
  });
  assert.equal(updated.response.status, 200);
  assert.equal(updated.body.user.firstName, 'Updated');
  assert.equal(updated.body.user.lastName, 'Learner');
  assert.equal(updated.body.user.phone, '+27761234987');
  assert.equal(updated.body.user.organization, 'My updated organisation');
  assert.equal(updated.body.user.email, originalLearner.body.user.email);
  assert.deepEqual(updated.body.user.roles, originalLearner.body.user.roles);

  const farmerAfterLearnerUpdate = await request('/me', { headers: farmerHeaders });
  assert.equal(farmerAfterLearnerUpdate.body.user.firstName, originalFarmer.body.user.firstName);
  assert.equal(farmerAfterLearnerUpdate.body.user.phone, originalFarmer.body.user.phone);

  const farmerUpdate = await request('/me', {
    method: 'PATCH',
    headers: farmerHeaders,
    body: JSON.stringify({ farmName: 'Ndlovu Produce Farm', province: 'Limpopo' }),
  });
  assert.equal(farmerUpdate.response.status, 200);
  assert.deepEqual(farmerUpdate.body.user.farmProfile, {
    farmName: 'Ndlovu Produce Farm',
    province: 'Limpopo',
  });
  const invalidFarmUpdate = await request('/me', {
    method: 'PATCH',
    headers: farmerHeaders,
    body: JSON.stringify({ farmName: 'x'.repeat(121) }),
  });
  assert.equal(invalidFarmUpdate.response.status, 400);

  const cleared = await request('/me', {
    method: 'PATCH',
    headers: learnerHeaders,
    body: JSON.stringify({
      firstName: originalLearner.body.user.firstName,
      lastName: originalLearner.body.user.lastName,
      phone: '',
      organization: '',
    }),
  });
  assert.equal(cleared.response.status, 200);
  assert.equal(cleared.body.user.phone, '');
  assert.equal(cleared.body.user.organization, '');
});

test('applications are scoped to the authenticated user', async () => {
  const learnerToken = await login('learner@myagriseta.local', 'Lerato123!');
  const farmerToken = await login('farmer@myagriseta.local', 'Sipho123!');
  const learnerResponse = await request('/applications', {
    headers: { Authorization: `Bearer ${learnerToken}` },
  });
  const farmerResponse = await request('/applications', {
    headers: { Authorization: `Bearer ${farmerToken}` },
  });

  assert.equal(learnerResponse.response.status, 200);
  assert.equal(farmerResponse.response.status, 200);
  assert.deepEqual(learnerResponse.body.applications.map((application) => application.id), ['app-1']);
  assert.deepEqual(farmerResponse.body.applications.map((application) => application.id), ['app-2']);
});

test('learners browse labeled demonstrations but not unpublished opportunities', async () => {
  const learnerToken = await login('learner@myagriseta.local', 'Lerato123!');
  const { response, body } = await request('/opportunities', {
    headers: { Authorization: 'Bearer ' + learnerToken },
  });
  assert.equal(response.status, 200);
  assert.ok(body.opportunities.length > 0);
  assert.ok(body.opportunities.every((opportunity) => opportunity.isDemo === true));
  const detail = await request('/opportunities/opp-1', {
    headers: { Authorization: 'Bearer ' + learnerToken },
  });
  assert.equal(detail.response.status, 404);
});

test('learners cannot apply to unpublished opportunities', async () => {
  const learnerToken = await login('learner@myagriseta.local', 'Lerato123!');
  const application = await request('/applications', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + learnerToken },
    body: JSON.stringify({ opportunityId: 'opp-1' }),
  });
  assert.equal(application.response.status, 404);
});

test('audit and review destinations enforce their assigned roles', async () => {
  const adminToken = await login('admin@myagriseta.local', 'Admin123!');
  const learnerToken = await login('learner@myagriseta.local', 'Lerato123!');
  const auditResponse = await request('/admin/audit', {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const learnerAuditResponse = await request('/admin/audit', {
    headers: { Authorization: `Bearer ${learnerToken}` },
  });

  const multiRoleToken = await login('multirole@myagriseta.local', 'Admin123!');
  const switchResponse = await request('/auth/switch-role', {
    method: 'POST',
    headers: { Authorization: `Bearer ${multiRoleToken}` },
    body: JSON.stringify({ role: 'internal_staff' }),
  });
  const staffReviewResponse = await request('/staff/review-queue', {
    headers: { Authorization: `Bearer ${switchResponse.body.token}` },
  });
  const learnerReviewResponse = await request('/staff/review-queue', {
    headers: { Authorization: `Bearer ${learnerToken}` },
  });

  assert.equal(auditResponse.response.status, 200);
  assert.equal(learnerAuditResponse.response.status, 403);
  assert.equal(switchResponse.response.status, 404);
  assert.equal(staffReviewResponse.response.status, 401);
  assert.equal(learnerReviewResponse.response.status, 403);
});

test('administrator can provision an internal staff account without role switching', async () => {
  const adminToken = await login('admin@myagriseta.local', 'Admin123!');
  const createResponse = await request('/users', {
    method: 'POST',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({
      firstName: 'Review',
      lastName: 'Staff',
      email: 'review.staff@example.test',
      username: 'review-staff',
      password: 'ReviewStaff123!',
      roles: ['internal_staff'],
    }),
  });

  assert.equal(createResponse.response.status, 201);
  const staffToken = await login('review-staff', 'ReviewStaff123!');
  const reviewResponse = await request('/staff/review-queue', {
    headers: { Authorization: `Bearer ${staffToken}` },
  });
  assert.equal(reviewResponse.response.status, 200);
  const pendingApplication = reviewResponse.body.applications.find((application) =>
    ['Submitted', 'Under Review', 'Additional Information Required'].includes(application.status)
  );
  assert.ok(pendingApplication, 'staff review queue should include an application available for review');
  const deniedFinalDecision = await request(`/admin/applications/${pendingApplication.id}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${staffToken}` },
    body: JSON.stringify({ status: 'Approved' }),
  });
  assert.equal(deniedFinalDecision.response.status, 403);

  const multiRoleToken = await login('multirole@myagriseta.local', 'Admin123!');
  const deniedReviewResponse = await request('/staff/review-queue', {
    headers: { Authorization: `Bearer ${multiRoleToken}` },
  });
  assert.equal(deniedReviewResponse.response.status, 200);
});

test('service details enforce the same role eligibility as the directory', async () => {
  const learnerToken = await login('learner@myagriseta.local', 'Lerato123!');
  const visible = await request('/services/svc-learn', {
    headers: { Authorization: `Bearer ${learnerToken}` },
  });
  const hidden = await request('/services/svc-market', {
    headers: { Authorization: `Bearer ${learnerToken}` },
  });

  assert.equal(visible.response.status, 200);
  assert.equal(hidden.response.status, 404);
});

test('service directory includes the eleven proposed service areas', async () => {
  const token = await login('admin@myagriseta.local', 'Admin123!');
  const { response, body } = await request('/services', {
    headers: { Authorization: `Bearer ${token}` },
  });
  const names = new Set(body.services.map((service) => service.name));

  assert.equal(response.status, 200);
  for (const name of [
    'AgriSkills Passport',
    'AgriLearn',
    'AgriOpportunity',
    'AgriEmployer',
    'AgriProvider',
    'AgriSMME',
    'AgriMarket',
    'AgriMentor',
    'AgriAdvisor AI',
    'AgriIntel',
    'AgriImpact',
  ]) {
    assert.ok(names.has(name), `${name} should be listed`);
  }
  assert.ok(body.services.every((service) => typeof service.dataStatus === 'string' && service.dataStatus.length > 0));
});

test('self-registration rejects invalid roles and malformed email addresses', async () => {
  const invalidRole = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      firstName: 'Invalid',
      lastName: 'Role',
      email: 'invalid.role@example.test',
      username: 'invalid-role',
      password: 'TestPass123!',
      role: 'internal_staff',
    }),
  });
  const invalidEmail = await request('/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      firstName: 'Invalid',
      lastName: 'Email',
      email: 'not-an-email',
      username: 'invalid-email',
      password: 'TestPass123!',
      role: 'learner',
      verificationDetails: roleEvidence('learner', 'InvalidEmail'),
    }),
  });

  assert.equal(invalidRole.response.status, 400);
  assert.equal(invalidEmail.response.status, 400);
});

test('logout revokes the current session token', async () => {
  const token = await login('learner@myagriseta.local', 'Lerato123!');
  const logoutResponse = await request('/auth/logout', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  const meResponse = await request('/me', {
    headers: { Authorization: `Bearer ${token}` },
  });

  assert.equal(logoutResponse.response.status, 200);
  assert.equal(meResponse.response.status, 401);
});

test('administrator cannot deactivate its own account', async () => {
  const token = await login('admin@myagriseta.local', 'Admin123!');
  const { response } = await request('/users/usr-admin/status', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ status: 'inactive' }),
  });

  assert.equal(response.status, 409);
});