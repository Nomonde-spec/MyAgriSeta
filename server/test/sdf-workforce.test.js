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

async function approveSdf({ organization, suffix }) {
  const adminToken = await login('admin', 'Admin123!');
  const provisioned = await request('/users', {
    method: 'POST',
    headers: auth(adminToken),
    body: JSON.stringify({
      firstName: 'Additional',
      lastName: 'SDF',
      email: `additional.sdf.${suffix}@myagriseta.local`,
      username: `sdf-${suffix}`,
      password: 'AdditionalSdf123!',
      organization,
      roles: ['sdf'],
    }),
  });
  assert.equal(provisioned.response.status, 201);
  return login(`sdf-${suffix}`, 'AdditionalSdf123!');
}

test('SDF workforce records support an organisation-scoped assessment-to-training workflow', async () => {
  const sdfToken = await login('sdf', 'Mpho123!');
  const learnerToken = await login('learner', 'Lerato123!');
  const sameOrganizationToken = await approveSdf({
    organization: 'Northern Skills Hub',
    suffix: `same-${Date.now()}`,
  });
  const otherOrganizationToken = await approveSdf({
    organization: 'Different Skills Organisation',
    suffix: `other-${Date.now()}`,
  });
  const year = new Date().getUTCFullYear();
  const assessmentDate = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  const deniedRole = await request('/sdf/workforce', { headers: auth(learnerToken) });
  assert.equal(deniedRole.response.status, 403);
  const forgedOrganization = await request('/sdf/workforce', {
    method: 'POST',
    headers: auth(sdfToken),
    body: JSON.stringify({ type: 'assessment', organizationId: 'another-organisation' }),
  });
  assert.equal(forgedOrganization.response.status, 400);

  const assessment = await request('/sdf/workforce', {
    method: 'POST',
    headers: auth(sdfToken),
    body: JSON.stringify({
      type: 'assessment',
      action: 'submit',
      title: 'Irrigation capability assessment',
      reportingYear: year,
      assessmentDate,
      department: 'Crop production',
      occupationGroup: 'Irrigation assistants',
      employeeCount: 8,
      skillArea: 'Water-use record keeping',
      currentLevel: 2,
      targetLevel: 4,
      priority: 'High',
      proposedIntervention: 'Workplace irrigation and water-record training',
    }),
  });
  assert.equal(assessment.response.status, 201, assessment.body.message);
  assert.equal(assessment.body.record.status, 'Submitted');
  assert.equal(assessment.body.record.createdBy, undefined);
  assert.equal(assessment.body.record.organizationId, undefined);
  const forgedUpdate = await request(`/sdf/workforce/${assessment.body.record.id}`, {
    method: 'PATCH',
    headers: auth(sdfToken),
    body: JSON.stringify({ action: 'draft', organizationId: 'another-organisation' }),
  });
  assert.equal(forgedUpdate.response.status, 400);

  const draftAssessment = await request('/sdf/workforce', {
    method: 'POST',
    headers: auth(sdfToken),
    body: JSON.stringify({
      type: 'assessment',
      title: 'Draft gap assessment',
      reportingYear: year,
      assessmentDate,
      department: 'Livestock',
      occupationGroup: 'Animal care assistants',
      employeeCount: 4,
      skillArea: 'Animal health observation',
      currentLevel: 1,
      targetLevel: 3,
      priority: 'Medium',
      proposedIntervention: 'Practical animal care training',
    }),
  });
  assert.equal(draftAssessment.response.status, 201);
  const editedDraft = await request(`/sdf/workforce/${draftAssessment.body.record.id}`, {
    method: 'PATCH',
    headers: auth(sdfToken),
    body: JSON.stringify({ action: 'draft', title: 'Updated gap assessment' }),
  });
  assert.equal(editedDraft.response.status, 200, editedDraft.body.message);
  assert.equal(editedDraft.body.record.title, 'Updated gap assessment');
  const submittedDraft = await request(`/sdf/workforce/${draftAssessment.body.record.id}`, {
    method: 'PATCH',
    headers: auth(sdfToken),
    body: JSON.stringify({ action: 'submit' }),
  });
  assert.equal(submittedDraft.response.status, 200, submittedDraft.body.message);
  assert.equal(submittedDraft.body.record.status, 'Submitted');

  const sameOrgList = await request('/sdf/workforce', { headers: auth(sameOrganizationToken) });
  assert.ok(sameOrgList.body.records.some((entry) => entry.id === assessment.body.record.id));

  const profileUpdate = await request('/me', {
    method: 'PATCH',
    headers: auth(sameOrganizationToken),
    body: JSON.stringify({ organization: 'A user-edited display name' }),
  });
  assert.equal(profileUpdate.response.status, 200);
  const sameOrgAfterEdit = await request('/sdf/workforce', { headers: auth(sameOrganizationToken) });
  assert.ok(sameOrgAfterEdit.body.records.some((entry) => entry.id === assessment.body.record.id));

  const otherOrgList = await request('/sdf/workforce', { headers: auth(otherOrganizationToken) });
  assert.equal(otherOrgList.body.records.some((entry) => entry.id === assessment.body.record.id), false);
  const crossTenantUpdate = await request(`/sdf/workforce/${assessment.body.record.id}`, {
    method: 'PATCH',
    headers: auth(otherOrganizationToken),
    body: JSON.stringify({ action: 'draft' }),
  });
  assert.equal(crossTenantUpdate.response.status, 404);

  const plan = await request('/sdf/workforce', {
    method: 'POST',
    headers: auth(sameOrganizationToken),
    body: JSON.stringify({
      type: 'wsp',
      action: 'submit',
      title: 'Water management WSP activity',
      reportingYear: year,
      objective: 'Improve efficient water use and record keeping.',
      intervention: 'Blended workplace training',
      skillAreas: 'Irrigation planning; water-use records',
      participantCount: 8,
      deliveryMethod: 'Hybrid',
      plannedStartDate: `${year}-07-01`,
      plannedEndDate: `${year}-08-01`,
      estimatedCostZar: 12000,
      assessmentId: assessment.body.record.id,
    }),
  });
  assert.equal(plan.response.status, 201, plan.body.message);
  assert.equal(plan.body.record.status, 'Submitted');
  assert.equal(plan.body.record.assessmentId, assessment.body.record.id);

  const lockedPlanEdit = await request(`/sdf/workforce/${plan.body.record.id}`, {
    method: 'PATCH',
    headers: auth(sameOrganizationToken),
    body: JSON.stringify({ action: 'draft' }),
  });
  assert.equal(lockedPlanEdit.response.status, 409);

  const report = await request('/sdf/workforce', {
    method: 'POST',
    headers: auth(sdfToken),
    body: JSON.stringify({
      type: 'atr',
      action: 'submit',
      title: 'Annual water management training report',
      reportingYear: year,
      plannedParticipantCount: 8,
      actualParticipantCount: 7,
      completedParticipantCount: 6,
      expenditureZar: 10000,
      outcomeSummary: 'Six employees completed the planned training; one attendee did not complete.',
      wspId: plan.body.record.id,
    }),
  });
  assert.equal(report.response.status, 201, report.body.message);
  assert.equal(report.body.record.wspId, plan.body.record.id);

  const invalidReport = await request('/sdf/workforce', {
    method: 'POST',
    headers: auth(sdfToken),
    body: JSON.stringify({
      type: 'atr',
      title: 'Invalid attendance report',
      reportingYear: year,
      plannedParticipantCount: 4,
      actualParticipantCount: 5,
      completedParticipantCount: 2,
      expenditureZar: 0,
      outcomeSummary: 'Invalid attendance exceeds the plan.',
    }),
  });
  assert.equal(invalidReport.response.status, 400);

  const cohort = await request('/sdf/workforce', {
    method: 'POST',
    headers: auth(sdfToken),
    body: JSON.stringify({
      type: 'training',
      title: 'Irrigation assistant cohort',
      reportingYear: year,
      department: 'Crop production',
      occupationGroup: 'Irrigation assistants',
      skillAreas: 'Water-use record keeping',
      employeeCount: 6,
      providerName: 'Internal trainer',
      deliveryMethod: 'Workplace',
      startDate: `${year}-09-01`,
      endDate: `${year}-09-20`,
      wspId: plan.body.record.id,
    }),
  });
  assert.equal(cohort.response.status, 201, JSON.stringify(cohort.body));
  assert.equal(cohort.body.record.status, 'Planned');

  for (const status of ['Scheduled', 'In Progress']) {
    const updated = await request(`/sdf/workforce/${cohort.body.record.id}`, {
      method: 'PATCH',
      headers: auth(sdfToken),
      body: JSON.stringify({ status }),
    });
    assert.equal(updated.response.status, 200, updated.body.message);
  }
  const completed = await request(`/sdf/workforce/${cohort.body.record.id}`, {
    method: 'PATCH',
    headers: auth(sdfToken),
    body: JSON.stringify({ status: 'Completed', completedEmployeeCount: 5 }),
  });
  assert.equal(completed.response.status, 200, completed.body.message);
  assert.equal(completed.body.record.status, 'Completed');
  assert.equal(completed.body.record.completedEmployeeCount, 5);
  const updatedOutcome = await request(`/sdf/workforce/${cohort.body.record.id}`, {
    method: 'PATCH',
    headers: auth(sdfToken),
    body: JSON.stringify({
      status: 'Completed',
      completedEmployeeCount: 5,
      outcomeSummary: 'Five employees completed the cohort assessment.',
    }),
  });
  assert.equal(updatedOutcome.response.status, 200, updatedOutcome.body.message);
  assert.equal(updatedOutcome.body.record.outcomeSummary, 'Five employees completed the cohort assessment.');

  const finalRecords = await request('/sdf/workforce', { headers: auth(sameOrganizationToken) });
  assert.equal(finalRecords.body.records.filter((entry) => entry.reportingYear === year).length >= 4, true);
});

test('SDF workforce input validates skill scales, reporting values, and cross-organisation links', async () => {
  const sdfToken = await login('sdf', 'Mpho123!');
  const otherSdfToken = await approveSdf({
    organization: 'Unrelated Agricultural Employer',
    suffix: `validation-${Date.now()}`,
  });
  const year = new Date().getUTCFullYear();
  const assessmentDate = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

  const invalidGap = await request('/sdf/workforce', {
    method: 'POST',
    headers: auth(sdfToken),
    body: JSON.stringify({
      type: 'assessment',
      title: 'Invalid skill gap',
      reportingYear: year,
      assessmentDate,
      department: 'Production',
      occupationGroup: 'Workers',
      employeeCount: 5,
      skillArea: 'Irrigation',
      currentLevel: 4,
      targetLevel: 2,
      priority: 'High',
      proposedIntervention: 'Training',
    }),
  });
  assert.equal(invalidGap.response.status, 400);

  const assessment = await request('/sdf/workforce', {
    method: 'POST',
    headers: auth(sdfToken),
    body: JSON.stringify({
      type: 'assessment',
      title: 'Private assessment',
      reportingYear: year,
      assessmentDate,
      department: 'Production',
      occupationGroup: 'Workers',
      employeeCount: 5,
      skillArea: 'Irrigation',
      currentLevel: 1,
      targetLevel: 3,
      priority: 'Medium',
      proposedIntervention: 'Workplace training',
    }),
  });
  assert.equal(assessment.response.status, 201);

  const crossOrganizationLink = await request('/sdf/workforce', {
    method: 'POST',
    headers: auth(otherSdfToken),
    body: JSON.stringify({
      type: 'wsp',
      title: 'Cross-organisation WSP',
      reportingYear: year,
      objective: 'Improve irrigation skills.',
      intervention: 'Workplace course',
      skillAreas: 'Irrigation',
      participantCount: 5,
      deliveryMethod: 'Workplace',
      plannedStartDate: `${year}-07-01`,
      plannedEndDate: `${year}-08-01`,
      assessmentId: assessment.body.record.id,
    }),
  });
  assert.equal(crossOrganizationLink.response.status, 400);
});
