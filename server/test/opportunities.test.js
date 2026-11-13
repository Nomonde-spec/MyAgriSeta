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

function deadline(days = 60) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function applicationForm({ fullName = 'Lerato Khumalo', email = 'learner@myagriseta.local' } = {}) {
  return {
    applicationData: {
      fullName,
      email,
      phone: '',
      motivation: 'I would like to develop my agricultural skills.',
      consent: true,
    },
    documents: [],
  };
}

async function submitEmployerJob(title) {
  const employerToken = await login('employer', 'Thandi123!');
  const result = await request('/employer/opportunities', {
    method: 'POST',
    headers: auth(employerToken),
    body: JSON.stringify({
      action: 'submit',
      title,
      description: `${title} agricultural vacancy.`,
      location: 'Mpumalanga',
      employmentType: 'Fixed term',
      requirements: ['Agricultural experience'],
      qualifications: 'Relevant experience',
      closingDate: deadline(),
      applicationInstructions: 'Apply using the contact email.',
    }),
  });
  assert.equal(result.response.status, 201);
  return { token: employerToken, opportunity: result.body.opportunity };
}

async function approveAndPublish(opportunityId, adminToken) {
  const approval = await request(`/admin/opportunities/${opportunityId}`, {
    method: 'PATCH',
    headers: auth(adminToken),
    body: JSON.stringify({ action: 'approve' }),
  });
  assert.equal(approval.response.status, 200, approval.body.message);
  assert.equal(approval.body.opportunity.status, 'Approved');

  const publication = await request(`/admin/opportunities/${opportunityId}`, {
    method: 'PATCH',
    headers: auth(adminToken),
    body: JSON.stringify({ action: 'publish' }),
  });
  assert.equal(publication.response.status, 200, publication.body.message);
  assert.equal(publication.body.opportunity.status, 'Published');
}

test('employers submit private job listings for central administrator approval', async () => {
  const { token, opportunity } = await submitEmployerJob(`Seasonal Farm Assistant ${Date.now()}`);
  const learnerToken = await login('learner', 'Lerato123!');
  const adminToken = await login('admin', 'Admin123!');

  assert.equal(opportunity.status, 'Pending Review');
  assert.equal(opportunity.organization, 'Highveld Agri Co-op');

  const ownerQueue = await request('/employer/opportunities', { headers: auth(token) });
  assert.ok(ownerQueue.body.opportunities.some((entry) => entry.id === opportunity.id));

  const learnerList = await request(`/opportunities?q=${encodeURIComponent(opportunity.title)}`, {
    headers: auth(learnerToken),
  });
  assert.deepEqual(learnerList.body.opportunities, []);
  const hiddenDetails = await request(`/opportunities/${opportunity.id}`, { headers: auth(learnerToken) });
  assert.equal(hiddenDetails.response.status, 404);
  const hiddenSave = await request(`/opportunities/${opportunity.id}/saved`, {
    method: 'POST',
    headers: auth(learnerToken),
  });
  assert.equal(hiddenSave.response.status, 404);

  const pending = await request('/admin/opportunities?status=Pending%20Review', { headers: auth(adminToken) });
  assert.ok(pending.body.opportunities.some((entry) => entry.id === opportunity.id));

  const learnerReview = await request('/admin/opportunities', { headers: auth(learnerToken) });
  assert.equal(learnerReview.response.status, 403);
  const employerApproval = await request(`/admin/opportunities/${opportunity.id}`, {
    method: 'PATCH',
    headers: auth(token),
    body: JSON.stringify({ action: 'approve' }),
  });
  assert.equal(employerApproval.response.status, 403);
});

test('only administrator-published opportunities are visible and application-ready', async () => {
  const { token: employerToken, opportunity } = await submitEmployerJob(`Approved Farm Role ${Date.now()}`);
  const learnerToken = await login('learner', 'Lerato123!');
  const farmerToken = await login('farmer', 'Sipho123!');
  const adminToken = await login('admin', 'Admin123!');

  await approveAndPublish(opportunity.id, adminToken);

  const learnerList = await request(`/opportunities?q=${encodeURIComponent(opportunity.title)}`, {
    headers: auth(learnerToken),
  });

  assert.equal(learnerList.body.opportunities.length, 1);
  assert.equal(learnerList.body.opportunities[0].status, 'Open');

  const learnerDetail = await request(`/opportunities/${opportunity.id}`, { headers: auth(learnerToken) });
  assert.equal(learnerDetail.response.status, 200);
  const farmerDetail = await request(`/opportunities/${opportunity.id}`, { headers: auth(farmerToken) });
  assert.equal(farmerDetail.response.status, 404);

  const saved = await request(`/opportunities/${opportunity.id}/saved`, {
    method: 'POST',
    headers: auth(learnerToken),
  });
  assert.equal(saved.response.status, 201);

  const application = await request('/applications', {
    method: 'POST',
    headers: auth(learnerToken),
    body: JSON.stringify({ opportunityId: opportunity.id, ...applicationForm() }),
  });
  assert.equal(application.response.status, 201);

  const refreshedList = await request(`/opportunities?q=${encodeURIComponent(opportunity.title)}`, {
    headers: auth(learnerToken),
  });
  assert.deepEqual(refreshedList.body.opportunities, []);
  const refreshedSaved = await request('/opportunities/saved', { headers: auth(learnerToken) });
  assert.equal(
    refreshedSaved.body.opportunities.some((entry) => entry.id === opportunity.id),
    false
  );

  const duplicate = await request('/applications', {
    method: 'POST',
    headers: auth(learnerToken),
    body: JSON.stringify({ opportunityId: opportunity.id, ...applicationForm() }),
  });
  assert.equal(duplicate.response.status, 409);

  const employerApplications = await request('/applications', {
    method: 'POST',
    headers: auth(employerToken),
    body: JSON.stringify({ opportunityId: opportunity.id, ...applicationForm() }),
  });
  assert.equal(employerApplications.response.status, 403);

  const adminList = await request('/admin/opportunities?status=Published', { headers: auth(adminToken) });
  const adminOpportunity = adminList.body.opportunities.find((entry) => entry.id === opportunity.id);
  assert.ok(adminOpportunity);
  assert.equal(adminOpportunity.applicationCount, 1);
  const applicantList = await request(`/admin/opportunities/${opportunity.id}/applications`, {
    headers: auth(adminToken),
  });
  assert.equal(applicantList.response.status, 200);
  assert.equal(applicantList.body.applications.length, 1);
  assert.equal(applicantList.body.applications[0].status, 'Submitted');
  assert.equal(applicantList.body.applications[0].applicantName, 'Lerato Khumalo');
  assert.equal('email' in applicantList.body.applications[0], false);
  assert.equal('applicationData' in applicantList.body.applications[0], false);
  const deniedApplicantList = await request(`/admin/opportunities/${opportunity.id}/applications`, {
    headers: auth(learnerToken),
  });
  assert.equal(deniedApplicantList.response.status, 403);
});

test('employers can review only their own candidates and manage recruitment statuses', async () => {
  const { token: employerToken, opportunity } = await submitEmployerJob(`Recruitment Workflow ${Date.now()}`);
  const adminToken = await login('admin', 'Admin123!');
  const learnerToken = await login('learner', 'Lerato123!');
  await approveAndPublish(opportunity.id, adminToken);
  const passportSkill = await request('/passport/skills', {
    method: 'POST',
    headers: auth(learnerToken),
    body: JSON.stringify({
      name: `Recruitment passport skill ${Date.now()}`,
      category: 'Crop production',
      level: 'Practised',
      description: 'Self-reported applicant skill.',
    }),
  });
  assert.equal(passportSkill.response.status, 201);
  const passportRecord = await request('/passport/records', {
    method: 'POST',
    headers: auth(learnerToken),
    body: JSON.stringify({
      recordType: 'qualification',
      title: `Applicant qualification ${Date.now()}`,
      organisation: 'Demonstration Provider',
      level: 'NQF 4',
      action: 'submit',
    }),
  });
  assert.equal(passportRecord.response.status, 201);

  const submitted = await request('/applications', {
    method: 'POST',
    headers: auth(learnerToken),
    body: JSON.stringify({ opportunityId: opportunity.id, ...applicationForm() }),
  });
  assert.equal(submitted.response.status, 201);

  const candidates = await request('/employer/applications', { headers: auth(employerToken) });
  assert.equal(candidates.response.status, 200);
  const candidate = candidates.body.applications.find((entry) => entry.id === submitted.body.application.id);
  assert.ok(candidate);
  assert.equal(candidate.applicationData.fullName, 'Lerato Khumalo');
  assert.equal(candidate.opportunityTitle, opportunity.title);
  assert.equal(candidate.applicantId, undefined);
  assert.equal(candidate.documents.some((document) => Object.hasOwn(document, 'data')), false);
  const applicantPassport = await request(`/employer/applications/${candidate.id}/passport`, {
    headers: auth(employerToken),
  });
  assert.equal(applicantPassport.response.status, 404);
  const consent = await request('/me', {
    method: 'PATCH',
    headers: auth(learnerToken),
    body: JSON.stringify({
      candidateVisible: true,
      candidatePassportVisible: true,
      candidateDesiredRole: 'Agricultural assistant',
    }),
  });
  assert.equal(consent.response.status, 200);
  const consentedPassport = await request(`/employer/applications/${candidate.id}/passport`, {
    headers: auth(employerToken),
  });
  assert.equal(consentedPassport.response.status, 200);
  assert.ok(consentedPassport.body.skills.some((skill) => skill.id === passportSkill.body.skill.id));
  assert.equal(consentedPassport.body.skills[0].userId, undefined);
  const sharedRecord = consentedPassport.body.records.find((entry) => entry.id === passportRecord.body.record.id);
  assert.ok(sharedRecord);
  assert.equal(sharedRecord.userId, undefined);
  assert.equal(sharedRecord.documents, undefined);
  const revokeConsent = await request('/me', {
    method: 'PATCH',
    headers: auth(learnerToken),
    body: JSON.stringify({ candidateVisible: false, candidateDesiredRole: '' }),
  });
  assert.equal(revokeConsent.response.status, 200);
  const revokedPassport = await request(`/employer/applications/${candidate.id}/passport`, {
    headers: auth(employerToken),
  });
  assert.equal(revokedPassport.response.status, 404);
  const deniedApplicantPassport = await request(`/employer/applications/${candidate.id}/passport`, {
    headers: auth(learnerToken),
  });
  assert.equal(deniedApplicantPassport.response.status, 403);
  const employerNotifications = await request('/notifications', { headers: auth(employerToken) });
  assert.ok(employerNotifications.body.notifications.some((entry) =>
    entry.title === 'New opportunity application' && entry.message.includes(opportunity.title)
  ));

  const denied = await request('/employer/applications', { headers: auth(learnerToken) });
  assert.equal(denied.response.status, 403);

  const adminFinalDecision = await request(`/admin/applications/${candidate.id}/status`, {
    method: 'PATCH',
    headers: auth(adminToken),
    body: JSON.stringify({ status: 'Approved' }),
  });
  assert.equal(adminFinalDecision.response.status, 403);

  const shortlisted = await request(`/employer/applications/${candidate.id}/status`, {
    method: 'PATCH',
    headers: auth(employerToken),
    body: JSON.stringify({ status: 'Shortlisted', feedback: 'Please attend an interview.' }),
  });
  assert.equal(shortlisted.response.status, 200);
  assert.equal(shortlisted.body.application.status, 'Shortlisted');
  assert.equal(shortlisted.body.application.feedback, 'Please attend an interview.');

  const applicantView = await request('/applications', { headers: auth(learnerToken) });
  const updatedApplication = applicantView.body.applications.find((entry) => entry.id === candidate.id);
  assert.equal(updatedApplication.status, 'Shortlisted');
  assert.equal(updatedApplication.feedback, 'Please attend an interview.');
  const notifications = await request('/notifications', { headers: auth(learnerToken) });
  assert.ok(notifications.body.notifications.some((entry) =>
    entry.title === 'Recruitment application updated' && entry.message.includes('Shortlisted')
  ));

  const unscheduledInterview = await request(`/employer/applications/${candidate.id}/status`, {
    method: 'PATCH',
    headers: auth(employerToken),
    body: JSON.stringify({ status: 'Interview' }),
  });
  assert.equal(unscheduledInterview.response.status, 400);
  const scheduledInterview = await request(`/employer/applications/${candidate.id}/status`, {
    method: 'PATCH',
    headers: auth(employerToken),
    body: JSON.stringify({
      status: 'Interview',
      interviewAt: '2027-03-16T10:30',
      feedback: 'Please attend at the farm office.',
    }),
  });
  assert.equal(scheduledInterview.response.status, 200);
  assert.equal(scheduledInterview.body.application.interviewAt, '2027-03-16T10:30');
  const hiredWithoutStartDate = await request(`/employer/applications/${candidate.id}/status`, {
    method: 'PATCH',
    headers: auth(employerToken),
    body: JSON.stringify({ status: 'Hired' }),
  });
  assert.equal(hiredWithoutStartDate.response.status, 400);
  const hired = await request(`/employer/applications/${candidate.id}/status`, {
    method: 'PATCH',
    headers: auth(employerToken),
    body: JSON.stringify({
      status: 'Hired',
      inductionDate: '2027-03-22',
      employmentStartDate: '2027-03-29',
    }),
  });
  assert.equal(hired.response.status, 200);
  assert.equal(hired.body.application.status, 'Hired');
  assert.equal(hired.body.application.inductionDate, '2027-03-22');
  assert.equal(hired.body.application.employmentStartDate, '2027-03-29');
  const scheduleNotifications = await request('/notifications', { headers: auth(learnerToken) });
  assert.ok(scheduleNotifications.body.notifications.some((entry) =>
    entry.message.includes('Interview: 2027-03-16 10:30') &&
    entry.message.includes('Induction: 2027-03-22') &&
    entry.message.includes('Start date: 2027-03-29')
  ));

  const invalidTransition = await request(`/employer/applications/${candidate.id}/status`, {
    method: 'PATCH',
    headers: auth(employerToken),
    body: JSON.stringify({ status: 'Approved' }),
  });
  assert.equal(invalidTransition.response.status, 400);
  const deniedTransition = await request(`/employer/applications/${candidate.id}/status`, {
    method: 'PATCH',
    headers: auth(learnerToken),
    body: JSON.stringify({ status: 'Rejected' }),
  });
  assert.equal(deniedTransition.response.status, 403);
  const removedSkill = await request(`/passport/skills/${passportSkill.body.skill.id}`, {
    method: 'DELETE',
    headers: auth(learnerToken),
  });
  assert.equal(removedSkill.response.status, 200);
});

test('administrator can recruit only candidates for administrator-posted jobs', async () => {
  const adminToken = await login('admin', 'Admin123!');
  const learnerToken = await login('learner', 'Lerato123!');
  const title = `Administrator Posted Role ${Date.now()}`;
  const created = await request('/admin/opportunities', {
    method: 'POST',
    headers: auth(adminToken),
    body: JSON.stringify({
      action: 'approve',
      title,
      description: `${title} agricultural vacancy.`,
      category: 'Employment',
      type: 'Employment',
      role: 'learner',
      organization: 'AgriSETA',
      location: 'Free State',
      closingDate: deadline(),
      applicationInstructions: 'Apply through this MyAgriSETA listing.',
    }),
  });
  assert.equal(created.response.status, 201, created.body.message);
  const published = await request(`/admin/opportunities/${created.body.opportunity.id}`, {
    method: 'PATCH',
    headers: auth(adminToken),
    body: JSON.stringify({ action: 'publish' }),
  });
  assert.equal(published.response.status, 200, published.body.message);

  const submitted = await request('/applications', {
    method: 'POST',
    headers: auth(learnerToken),
    body: JSON.stringify({ opportunityId: created.body.opportunity.id, ...applicationForm() }),
  });
  assert.equal(submitted.response.status, 201, submitted.body.message);
  const ownerCandidates = await request('/employer/applications', { headers: auth(adminToken) });
  assert.ok(ownerCandidates.body.applications.some((entry) => entry.id === submitted.body.application.id));

  const hired = await request(`/employer/applications/${submitted.body.application.id}/status`, {
    method: 'PATCH',
    headers: auth(adminToken),
    body: JSON.stringify({ status: 'Hired', employmentStartDate: '2027-04-05' }),
  });
  assert.equal(hired.response.status, 200, hired.body.message);
  assert.equal(hired.body.application.status, 'Hired');

  const learnerApplications = await request('/applications', { headers: auth(learnerToken) });
  assert.equal(
    learnerApplications.body.applications.find((entry) => entry.id === submitted.body.application.id).status,
    'Hired'
  );
});

test('employers can search and invite only candidates who explicitly opt in', async () => {
  const { token: employerToken, opportunity } = await submitEmployerJob(`Opt-in Candidate Role ${Date.now()}`);
  const adminToken = await login('admin', 'Admin123!');
  const learnerToken = await login('learner', 'Lerato123!');
  await approveAndPublish(opportunity.id, adminToken);

  const hidden = await request('/employer/candidates', { headers: auth(employerToken) });
  assert.equal(hidden.response.status, 200);
  assert.equal(hidden.body.candidates.some((entry) => entry.firstName === 'Lerato'), false);
  const deniedSearch = await request('/employer/candidates', { headers: auth(learnerToken) });
  assert.equal(deniedSearch.response.status, 403);

  const invalidOptIn = await request('/me', {
    method: 'PATCH',
    headers: auth(learnerToken),
    body: JSON.stringify({ candidateVisible: true }),
  });
  assert.equal(invalidOptIn.response.status, 400);

  const skill = await request('/passport/skills', {
    method: 'POST',
    headers: auth(learnerToken),
    body: JSON.stringify({
      name: 'Irrigation operations',
      category: 'Crop production',
      level: 'Practised',
      description: 'Self-reported irrigation experience.',
    }),
  });
  assert.equal(skill.response.status, 201);

  const optedIn = await request('/me', {
    method: 'PATCH',
    headers: auth(learnerToken),
    body: JSON.stringify({
      candidateVisible: true,
      candidateDesiredRole: 'Agricultural assistant',
      candidateProvince: 'Limpopo',
      candidateSummary: 'Experience supporting irrigation and crop production.',
    }),
  });
  assert.equal(optedIn.response.status, 200);
  assert.equal(optedIn.body.user.candidateProfile.visible, true);

  const matching = await request('/employer/candidates?q=irrigation', { headers: auth(employerToken) });
  assert.equal(matching.response.status, 200);
  const candidate = matching.body.candidates.find((entry) => entry.firstName === 'Lerato');
  assert.ok(candidate);
  assert.equal(candidate.desiredRole, 'Agricultural assistant');
  assert.equal(candidate.province, 'Limpopo');
  assert.ok(candidate.skills.some((entry) => entry.name === 'Irrigation operations' &&
    entry.verificationStatus === 'Self-reported · not verified'));
  for (const privateField of ['email', 'phone', 'lastName', 'organization', 'documents']) {
    assert.equal(Object.hasOwn(candidate, privateField), false);
  }

  const invitation = await request(`/employer/candidates/${encodeURIComponent(candidate.id)}/invitations`, {
    method: 'POST',
    headers: auth(employerToken),
    body: JSON.stringify({ opportunityId: opportunity.id }),
  });
  assert.equal(invitation.response.status, 201);
  const duplicateInvitation = await request(`/employer/candidates/${encodeURIComponent(candidate.id)}/invitations`, {
    method: 'POST',
    headers: auth(employerToken),
    body: JSON.stringify({ opportunityId: opportunity.id }),
  });
  assert.equal(duplicateInvitation.response.status, 409);

  const notifications = await request('/notifications', { headers: auth(learnerToken) });
  assert.ok(notifications.body.notifications.some((entry) =>
    entry.type === 'employer_candidate_invitation' && entry.message.includes(opportunity.title)
  ));

  const optedOut = await request('/me', {
    method: 'PATCH',
    headers: auth(learnerToken),
    body: JSON.stringify({ candidateVisible: false, candidateDesiredRole: '' }),
  });
  assert.equal(optedOut.response.status, 200);
  assert.equal(optedOut.body.user.candidateProfile.visible, false);
  const afterOptOut = await request('/employer/candidates?q=irrigation', { headers: auth(employerToken) });
  assert.equal(afterOptOut.body.candidates.some((entry) => entry.id === candidate.id), false);
  const inviteAfterOptOut = await request(`/employer/candidates/${encodeURIComponent(candidate.id)}/invitations`, {
    method: 'POST',
    headers: auth(employerToken),
    body: JSON.stringify({ opportunityId: opportunity.id }),
  });
  assert.equal(inviteAfterOptOut.response.status, 404);
});

test('employers can create internship and workplace-opportunity listings', async () => {
  const employerToken = await login('employer', 'Thandi123!');
  for (const category of ['Internship', 'Workplace Opportunity']) {
    const listing = await request('/employer/opportunities', {
      method: 'POST',
      headers: auth(employerToken),
      body: JSON.stringify({
        action: 'submit',
        title: `${category} ${Date.now()}`,
        description: `An agricultural ${category.toLowerCase()} listing.`,
        category,
        location: 'North West',
        employmentType: category === 'Internship' ? 'Internship' : 'Seasonal',
        requirements: ['Available for the advertised period.'],
        qualifications: 'Entry requirements are reviewed by the employer.',
        closingDate: deadline(),
        applicationInstructions: 'Apply through MyAgriSETA.',
      }),
    });
    assert.equal(listing.response.status, 201, listing.body.message);
    assert.equal(listing.body.opportunity.category, category);
  }
});

test('employers can retrieve applicant files only for applications to their own listings', async () => {
  const employerToken = await login('employer', 'Thandi123!');
  const learnerToken = await login('learner', 'Lerato123!');
  const farmerToken = await login('farmer', 'Sipho123!');
  const adminToken = await login('admin', 'Admin123!');
  const title = `Candidate Document Listing ${Date.now()}`;
  const listing = await request('/employer/opportunities', {
    method: 'POST',
    headers: auth(employerToken),
    body: JSON.stringify({
      action: 'submit',
      title,
      description: 'Agricultural role requiring a CV.',
      category: 'Employment',
      location: 'Free State',
      employmentType: 'Fixed term',
      requirements: ['Agricultural experience'],
      qualifications: 'Relevant experience.',
      requiredDocuments: ['CV'],
      closingDate: deadline(),
      applicationInstructions: 'Apply through MyAgriSETA.',
    }),
  });
  assert.equal(listing.response.status, 201);
  await approveAndPublish(listing.body.opportunity.id, adminToken);

  const file = Buffer.from('%PDF-1.4\ncandidate cv\n%%EOF', 'ascii');
  const application = await request('/applications', {
    method: 'POST',
    headers: auth(learnerToken),
    body: JSON.stringify({
      opportunityId: listing.body.opportunity.id,
      ...applicationForm(),
      documents: [{
        requirement: 'CV',
        filename: 'cv.pdf',
        mimeType: 'application/pdf',
        size: file.length,
        data: file.toString('base64'),
      }],
    }),
  });
  assert.equal(application.response.status, 201);
  const documentId = application.body.application.documents[0].id;

  const employerDocument = await request(
    `/applications/${application.body.application.id}/documents/${documentId}`,
    { headers: auth(employerToken) }
  );
  assert.equal(employerDocument.response.status, 200);
  assert.equal(employerDocument.body.document.data, file.toString('base64'));

  const unrelatedDocument = await request(
    `/applications/${application.body.application.id}/documents/${documentId}`,
    { headers: auth(farmerToken) }
  );
  assert.equal(unrelatedDocument.response.status, 404);
});

test('employers can submit learner-facing training needs with a provider sponsor', async () => {
  const employerToken = await login('employer', 'Thandi123!');
  const providerToken = await login('provider', 'Naledi123!');
  const adminToken = await login('admin', 'Admin123!');
  const title = `Workforce Training Need ${Date.now()}`;
  const trainingNeed = await request('/employer/opportunities', {
    method: 'POST',
    headers: auth(employerToken),
    body: JSON.stringify({
      action: 'submit',
      title,
      description: 'Request practical irrigation and water-management training for employees.',
      category: 'Training Need',
      role: 'training_provider',
      location: 'Limpopo',
      trainingObjectives: 'Improve safe irrigation planning and water-use records.',
      requiredSkills: ['Irrigation basics', 'Water-use record keeping'],
      participantCount: 12,
      startDate: deadline(30),
      endDate: deadline(60),
      closingDate: deadline(),
      applicationInstructions: 'Learners can apply for the training; the employer coordinates with the sponsor.',
    }),
  });
  assert.equal(trainingNeed.response.status, 201, trainingNeed.body.message);
  assert.equal(trainingNeed.body.opportunity.category, 'Training Need');
  assert.equal(trainingNeed.body.opportunity.role, 'training_provider');
  assert.equal(trainingNeed.body.opportunity.participantCount, 12);

  await approveAndPublish(trainingNeed.body.opportunity.id, adminToken);
  const providerListings = await request('/opportunities?category=Training%20Need', {
    headers: auth(providerToken),
  });
  assert.equal(providerListings.body.opportunities.some((entry) => entry.id === trainingNeed.body.opportunity.id), false);

  const learnerToken = await login('learner', 'Lerato123!');
  const learnerListings = await request('/opportunities?category=Training%20Need', {
    headers: auth(learnerToken),
  });
  const learnerListing = learnerListings.body.opportunities.find((entry) =>
    entry.id === trainingNeed.body.opportunity.id
  );
  assert.ok(learnerListing);
  assert.equal(learnerListing.role, 'learner');
  const learnerDetail = await request(`/opportunities/${trainingNeed.body.opportunity.id}`, {
    headers: auth(learnerToken),
  });
  assert.equal(learnerDetail.response.status, 200);

  const learnerApplication = await request('/applications', {
    method: 'POST',
    headers: auth(learnerToken),
    body: JSON.stringify({
      opportunityId: trainingNeed.body.opportunity.id,
      ...applicationForm(),
    }),
  });
  assert.equal(learnerApplication.response.status, 201, learnerApplication.body.message);

  const hiddenAfterApplying = await request('/opportunities?category=Training%20Need', {
    headers: auth(learnerToken),
  });
  assert.equal(
    hiddenAfterApplying.body.opportunities.some((entry) => entry.id === trainingNeed.body.opportunity.id),
    false
  );

  const providerApply = await request('/applications', {
    method: 'POST',
    headers: auth(providerToken),
    body: JSON.stringify({
      opportunityId: trainingNeed.body.opportunity.id,
      ...applicationForm({ fullName: 'Naledi Provider', email: 'provider@myagriseta.local' }),
    }),
  });
  assert.equal(providerApply.response.status, 403);
});

test('learner-facing training need submissions retain provider sponsors', async () => {
  const employerToken = await login('employer', 'Thandi123!');
  const learnerToken = await login('learner', 'Lerato123!');
  const adminToken = await login('admin', 'Admin123!');
  const title = `Learner Training Opportunity ${Date.now()}`;
  const submission = await request('/employer/opportunities', {
    method: 'POST',
    headers: auth(employerToken),
    body: JSON.stringify({
      action: 'submit',
      title,
      description: 'Practical agricultural skills training for eligible learners.',
      category: 'Training Need',
      role: 'training_provider',
      location: 'Limpopo',
      trainingObjectives: 'Build practical irrigation and water-management skills.',
      requiredSkills: ['Irrigation basics'],
      participantCount: 12,
      startDate: deadline(30),
      endDate: deadline(60),
      closingDate: deadline(),
      applicationInstructions: 'Apply through the learner portal.',
    }),
  });
  assert.equal(submission.response.status, 201, submission.body.message);
  assert.equal(submission.body.opportunity.role, 'training_provider');

  await approveAndPublish(submission.body.opportunity.id, adminToken);
  const learnerListings = await request('/opportunities?category=Training%20Need', {
    headers: auth(learnerToken),
  });
  const learnerListing = learnerListings.body.opportunities.find((entry) =>
    entry.id === submission.body.opportunity.id
  );
  assert.ok(learnerListing);
  assert.equal(learnerListing.role, 'learner');
});

test('farmers can discover support and request a mentor introduction with in-app staff feedback', async () => {
  const farmerToken = await login('farmer', 'Sipho123!');
  const adminToken = await login('admin', 'Admin123!');
  const authHeaders = auth(farmerToken);
  const funding = await request('/opportunities?category=Funding', { headers: authHeaders });
  const support = await request('/opportunities?category=Business%20Support', { headers: authHeaders });
  const mentorship = await request('/opportunities?category=Mentorship', { headers: authHeaders });

  assert.ok(funding.body.opportunities.some((entry) => entry.id === 'demo-farmer-funding' && entry.isDemo));
  assert.ok(support.body.opportunities.some((entry) => entry.id === 'demo-farmer-support' && entry.isDemo));
  const mentorListing = mentorship.body.opportunities.find((entry) => entry.id === 'demo-farmer-mentorship' && entry.isDemo);
  assert.ok(mentorListing);
  assert.match(mentorListing.title, /mentor introduction/i);
  assert.match(mentorListing.applicationInstructions, /reviewed by authorized platform staff/i);

  const application = await request('/applications', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      opportunityId: 'demo-farmer-mentorship',
      ...applicationForm({ fullName: 'Sipho Ndlovu', email: 'farmer@myagriseta.local' }),
    }),
  });
  assert.equal(application.response.status, 201, application.body.message);
  assert.equal(application.body.application.opportunityId, 'demo-farmer-mentorship');

  const reviewQueue = await request('/staff/review-queue', { headers: auth(adminToken) });
  assert.ok(reviewQueue.body.applications.some((entry) => entry.id === application.body.application.id));

  const review = await request(`/admin/applications/${application.body.application.id}/status`, {
    method: 'PATCH',
    headers: auth(adminToken),
    body: JSON.stringify({
      status: 'Under Review',
      feedback: 'Your mentor-introduction request is being reviewed by platform staff.',
    }),
  });
  assert.equal(review.response.status, 200);

  const tracked = await request('/applications', { headers: authHeaders });
  const trackedRequest = tracked.body.applications.find((entry) => entry.id === application.body.application.id);
  assert.ok(trackedRequest);
  assert.equal(trackedRequest.status, 'Under Review');
  assert.match(trackedRequest.feedback, /being reviewed by platform staff/);
});

test('farmer-facing managed opportunity listings require valid sources and expiry before publication', async () => {
  const adminToken = await login('admin', 'Admin123!');
  const adminHeaders = auth(adminToken);
  const closingDate = deadline(60);
  const recordExpiresAt = deadline(90);
  const observedAt = new Date().toISOString().slice(0, 10);
  const draft = await request('/admin/opportunities', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      action: 'draft',
      title: 'Sourced farm support listing',
      description: 'A source-attributed listing for workflow validation.',
      category: 'Funding',
      type: 'Funding',
      role: 'farmer',
      organization: 'Verified source',
      location: 'South Africa',
      closingDate,
      applicationInstructions: 'Apply through the published source instructions.',
    }),
  });
  assert.equal(draft.response.status, 201);

  const rejectedWithoutSource = await request(`/admin/opportunities/${draft.body.opportunity.id}`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({ action: 'approve' }),
  });
  assert.equal(rejectedWithoutSource.response.status, 400);
  assert.match(rejectedWithoutSource.body.message, /source name/i);

  const edited = await request(`/admin/opportunities/${draft.body.opportunity.id}`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({
      action: 'edit',
      title: 'Sourced farm support listing',
      description: 'A source-attributed listing for workflow validation.',
      category: 'Funding',
      type: 'Funding',
      role: 'farmer',
      organization: 'Verified source',
      location: 'South Africa',
      closingDate,
      recordExpiresAt,
      sourceName: 'Test source',
      sourceUrl: 'https://example.org/opportunity',
      applicationUrl: 'https://example.org/apply',
      sourceVerifiedAt: observedAt,
      applicationInstructions: 'Apply through the published source instructions.',
    }),
  });
  assert.equal(edited.response.status, 200);

  const approved = await request(`/admin/opportunities/${draft.body.opportunity.id}`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({ action: 'approve' }),
  });
  assert.equal(approved.response.status, 200, approved.body.message);
  const published = await request(`/admin/opportunities/${draft.body.opportunity.id}`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({ action: 'publish' }),
  });
  assert.equal(published.response.status, 200, published.body.message);

  const farmerToken = await login('farmer', 'Sipho123!');
  const listings = await request('/opportunities?category=Funding&q=Sourced%20farm%20support%20listing', {
    headers: auth(farmerToken),
  });
  assert.equal(listings.response.status, 200);
  assert.equal(listings.body.opportunities.length, 1);
  assert.equal(listings.body.opportunities[0].sourceUrl, 'https://example.org/opportunity');
  assert.equal(listings.body.opportunities[0].applicationUrl, 'https://example.org/apply');
  assert.equal(listings.body.opportunities[0].recordExpiresAt, recordExpiresAt);
});

test('administrator bursary, learnership, and training content requires a checked source before approval', async () => {
  const adminToken = await login('admin', 'Admin123!');
  const today = new Date().toISOString().slice(0, 10);
  const closingDate = deadline(60);
  const recordExpiresAt = deadline(90);
  const content = {
    title: 'Sourced bursary information',
    description: 'Information about an externally sourced agricultural bursary.',
    category: 'Bursary',
    type: 'Bursary',
    role: 'learner',
    organization: 'Example funder',
    location: 'South Africa',
    closingDate,
    applicationInstructions: 'Check the source for current eligibility and application details.',
  };
  const missingSource = await request('/admin/opportunities', {
    method: 'POST',
    headers: auth(adminToken),
    body: JSON.stringify(content),
  });
  assert.equal(missingSource.response.status, 400);
  assert.match(missingSource.body.message, /source name/i);

  const sourced = await request('/admin/opportunities', {
    method: 'POST',
    headers: auth(adminToken),
    body: JSON.stringify({
      ...content,
      sourceName: 'Example official source',
      sourceUrl: 'https://example.org/bursary',
      sourceVerifiedAt: today,
      recordExpiresAt,
    }),
  });
  assert.equal(sourced.response.status, 201, sourced.body.message);
  assert.equal(sourced.body.opportunity.status, 'Approved');
  assert.equal(sourced.body.opportunity.dataStatus.includes('Confirm the source'), true);
});

test('administrator opportunity forms persist category details and validate custom applicant fields', async () => {
  const adminToken = await login('admin', 'Admin123!');
  const learnerToken = await login('learner', 'Lerato123!');
  const today = new Date().toISOString().slice(0, 10);
  const closingDate = deadline(60);
  const result = await request('/admin/opportunities', {
    method: 'POST',
    headers: auth(adminToken),
    body: JSON.stringify({
      title: 'Agricultural studies bursary form test',
      description: 'A bursary listing used to test the expanded opportunity form.',
      category: 'Bursary',
      type: 'Bursary',
      role: 'learner',
      organization: 'Example funder',
      location: 'Western Cape',
      closingDate,
      applicationInstructions: 'Apply online and provide your current academic details.',
      sourceName: 'Example official source',
      sourceUrl: 'https://example.org/bursary',
      sourceVerifiedAt: today,
      recordExpiresAt: deadline(90),
      opportunityDetails: {
        programmeName: 'Agricultural Studies Bursary',
        academicYear: '2027',
        qualificationLevel: 'Diploma',
        fieldOfStudy: 'Agricultural Management',
        bursaryValue: '25000',
      },
      eligibilityCriteria: { provinces: 'Western Cape', minimumQualification: 'Matric' },
      applicationConfiguration: {
        openingDate: today,
        maximumApplications: '15',
        termsAndConditions: 'Information is subject to verification.',
        requiredInformation: ['Academic information', 'Relevant skills'],
        assignReviewDepartment: 'Bursary Review',
        reviewInstructions: 'Check the academic record.',
        allowSaveAsDraft: true,
        allowEditsBeforeClosing: true,
        allowAfterClosing: false,
        allowWithdrawal: true,
        enableReferenceNumbers: true,
        enableStatusTracking: true,
      },
      applicationQuestions: [{
        title: 'Are you currently enrolled?',
        type: 'Dropdown',
        required: true,
        description: '',
        options: ['Yes', 'No'],
      }],
    }),
  });
  assert.equal(result.response.status, 201, result.body.message);
  const opportunity = result.body.opportunity;
  assert.equal(opportunity.status, 'Approved');
  assert.equal(opportunity.opportunityDetails.programmeName, 'Agricultural Studies Bursary');
  assert.equal(opportunity.applicationQuestions.length, 1);
  const published = await request(`/admin/opportunities/${opportunity.id}`, {
    method: 'PATCH',
    headers: auth(adminToken),
    body: JSON.stringify({ action: 'publish' }),
  });
  assert.equal(published.response.status, 200, published.body.message);
  const publicDetail = await request(`/opportunities/${opportunity.id}`, { headers: auth(learnerToken) });
  assert.equal(publicDetail.response.status, 200);
  assert.equal(publicDetail.body.opportunity.opportunityDetails.programmeName, 'Agricultural Studies Bursary');
  assert.equal('assignReviewDepartment' in publicDetail.body.opportunity, false);

  const missingAnswers = await request('/applications', {
    method: 'POST',
    headers: auth(learnerToken),
    body: JSON.stringify({ opportunityId: opportunity.id, ...applicationForm() }),
  });
  assert.equal(missingAnswers.response.status, 400);
  const validApplicationData = {
    ...applicationForm().applicationData,
    answers: ['Yes'],
    additionalInformation: {
      'Academic information': 'Currently enrolled in a Diploma in Agriculture.',
      'Relevant skills': 'Crop production and record keeping.',
    },
  };
  const application = await request('/applications', {
    method: 'POST',
    headers: auth(learnerToken),
    body: JSON.stringify({
      opportunityId: opportunity.id,
      applicationData: validApplicationData,
      documents: [],
    }),
  });
  assert.equal(application.response.status, 201, application.body.message);
});

test('administrator opportunity application URLs must use safe HTTP(S) links', async () => {
  const adminToken = await login('admin', 'Admin123!');
  const invalid = await request('/admin/opportunities', {
    method: 'POST',
    headers: auth(adminToken),
    body: JSON.stringify({
      action: 'draft',
      title: 'Application link validation',
      description: 'Validate external application URLs.',
      category: 'Funding',
      type: 'Funding',
      role: 'farmer',
      applicationUrl: 'javascript:alert(1)',
    }),
  });
  assert.equal(invalid.response.status, 400);
  assert.match(invalid.body.message, /application URL must use HTTP or HTTPS/i);
});

test('upcoming opportunities are visible but applications cannot open early', async () => {
  const adminToken = await login('admin', 'Admin123!');
  const learnerToken = await login('learner', 'Lerato123!');
  const created = await request('/admin/opportunities', {
    method: 'POST',
    headers: auth(adminToken),
    body: JSON.stringify({
      title: 'Upcoming agricultural internship',
      description: 'An internship with a future application opening date.',
      category: 'Internship',
      role: 'learner',
      organization: 'Example employer',
      location: 'Free State',
      closingDate: deadline(60),
      applicationInstructions: 'Apply online when applications open.',
      opportunityDetails: {
        programmeName: 'Farm internship',
        agriculturalField: 'Crop production',
        positions: '2',
        duration: '12 months',
      },
      applicationConfiguration: { openingDate: deadline(2), maximumApplications: '1' },
    }),
  });
  assert.equal(created.response.status, 201, created.body.message);
  const published = await request(`/admin/opportunities/${created.body.opportunity.id}`, {
    method: 'PATCH',
    headers: auth(adminToken),
    body: JSON.stringify({ action: 'publish' }),
  });
  assert.equal(published.response.status, 200, published.body.message);
  const detail = await request(`/opportunities/${created.body.opportunity.id}`, { headers: auth(learnerToken) });
  assert.equal(detail.response.status, 200);
  assert.equal(detail.body.opportunity.status, 'Upcoming');
  const application = await request('/applications', {
    method: 'POST',
    headers: auth(learnerToken),
    body: JSON.stringify({
      opportunityId: created.body.opportunity.id,
      ...applicationForm(),
    }),
  });
  assert.equal(application.response.status, 409);
});

test('learners can discover clearly labeled sample funding, learnership, internship, and job listings', async () => {
  const learnerToken = await login('learner', 'Lerato123!');
  const cases = [
    ['Funding', 'demonstration: agricultural study funding'],
    ['Training', 'demonstration: agricultural learnership'],
    ['Employment', 'demonstration: agricultural internship'],
    ['Employment', 'demonstration: junior agricultural assistant'],
  ];

  for (const [category, query] of cases) {
    const result = await request(`/opportunities?category=${encodeURIComponent(category)}&q=${encodeURIComponent(query)}`, {
      headers: auth(learnerToken),
    });
    assert.equal(result.response.status, 200);
    assert.equal(result.body.opportunities.length, 1);
    assert.equal(result.body.opportunities[0].isDemo, true);
    assert.match(result.body.opportunities[0].dataStatus, /Synthetic demonstration listing only/);
    assert.equal(result.body.opportunities[0].closingDate, null);
  }

  const detail = await request('/opportunities/demo-learner-bursary', { headers: auth(learnerToken) });
  assert.equal(detail.response.status, 200);
  assert.equal(detail.body.opportunity.isDemo, true);
  assert.match(detail.body.opportunity.applicationInstructions, /demonstration only/i);
});

test('learners can create and track an in-app application for a labeled sample opportunity', async () => {
  const learnerToken = await login('learner', 'Lerato123!');
  const application = await request('/applications', {
    method: 'POST',
    headers: auth(learnerToken),
    body: JSON.stringify({
      opportunityId: 'demo-learner-learnership',
      ...applicationForm(),
    }),
  });
  assert.equal(application.response.status, 201);
  assert.equal(application.body.application.status, 'Submitted');
  assert.equal(application.body.application.serviceName, 'Demonstration: Agricultural learnership');

  const tracked = await request('/applications', { headers: auth(learnerToken) });
  assert.ok(tracked.body.applications.some((entry) =>
    entry.id === application.body.application.id && entry.statusHistory.length === 1
  ));
});

test('rejected content needs a reason and remains hidden until resubmitted and published', async () => {
  const { token: employerToken, opportunity } = await submitEmployerJob(`Review Required Job ${Date.now()}`);
  const learnerToken = await login('learner', 'Lerato123!');
  const adminToken = await login('admin', 'Admin123!');

  const missingReason = await request(`/admin/opportunities/${opportunity.id}`, {
    method: 'PATCH',
    headers: auth(adminToken),
    body: JSON.stringify({ action: 'reject' }),
  });
  assert.equal(missingReason.response.status, 400);

  const rejected = await request(`/admin/opportunities/${opportunity.id}`, {
    method: 'PATCH',
    headers: auth(adminToken),
    body: JSON.stringify({ action: 'reject', note: 'Employer details need confirmation.' }),
  });
  assert.equal(rejected.response.status, 200);
  assert.equal(rejected.body.opportunity.status, 'Rejected');
  assert.equal(rejected.body.opportunity.reviewNote, 'Employer details need confirmation.');
  assert.ok(rejected.body.opportunity.statusHistory.length >= 2);

  const hidden = await request(`/opportunities?q=${encodeURIComponent(opportunity.title)}`, {
    headers: auth(learnerToken),
  });
  assert.deepEqual(hidden.body.opportunities, []);

  const resubmitted = await request(`/employer/opportunities/${opportunity.id}`, {
    method: 'PATCH',
    headers: auth(employerToken),
    body: JSON.stringify({
      action: 'submit',
      title: opportunity.title,
      description: opportunity.description,
      location: opportunity.location,
      employmentType: opportunity.employmentType,
      requirements: opportunity.requirements,
      qualifications: opportunity.qualifications,
      closingDate: opportunity.closingDate,
      applicationInstructions: opportunity.applicationInstructions,
    }),
  });
  assert.equal(resubmitted.response.status, 200);
  assert.equal(resubmitted.body.opportunity.status, 'Pending Review');

  await approveAndPublish(opportunity.id, adminToken);
  const visible = await request(`/opportunities?q=${encodeURIComponent(opportunity.title)}`, {
    headers: auth(learnerToken),
  });
  assert.equal(visible.body.opportunities.length, 1);
});

test('only employers can submit and employers can edit or withdraw only their own listings', async () => {
  const learnerToken = await login('learner', 'Lerato123!');
  const notEmployer = await request('/employer/opportunities', { headers: auth(learnerToken) });
  assert.equal(notEmployer.response.status, 403);
  const deniedCreate = await request('/employer/opportunities', {
    method: 'POST',
    headers: auth(learnerToken),
    body: JSON.stringify({ title: 'Not an employer submission' }),
  });
  assert.equal(deniedCreate.response.status, 403);

  const { opportunity } = await submitEmployerJob(`Ownership Test Job ${Date.now()}`);
  const providerToken = await login('provider', 'Naledi123!');
  const forbiddenEdit = await request(`/employer/opportunities/${opportunity.id}`, {
    method: 'PATCH',
    headers: auth(providerToken),
    body: JSON.stringify({ action: 'withdraw' }),
  });
  assert.equal(forbiddenEdit.response.status, 403);

  const employerToken = await login('employer', 'Thandi123!');
  const withdrawn = await request(`/employer/opportunities/${opportunity.id}`, {
    method: 'PATCH',
    headers: auth(employerToken),
    body: JSON.stringify({ action: 'withdraw' }),
  });
  assert.equal(withdrawn.response.status, 200);
  assert.equal(withdrawn.body.opportunity.status, 'Archived');
});

test('training providers submit opportunities for admin approval and applicants receive review feedback', async () => {
  const providerToken = await login('provider', 'Naledi123!');
  const learnerToken = await login('learner', 'Lerato123!');
  const farmerToken = await login('farmer', 'Sipho123!');
  const adminToken = await login('admin', 'Admin123!');
  const title = `Agricultural Skills Programme ${Date.now()}`;
  const encodedPdf = Buffer.from('%PDF-1.4\nprovider evidence\n%%EOF', 'ascii').toString('base64');
  const form = {
    action: 'submit',
    title,
    description: 'Practical agricultural skills training for eligible applicants.',
    category: 'Training',
    role: 'learner',
    location: 'Eastern Cape',
    qualifications: 'Open to eligible learners.',
    requirements: ['Available for the full programme.'],
    trainingObjectives: 'Build practical soil management skills.',
    accreditation: 'Provider registration details submitted for review.',
    duration: 'Six weeks',
    deliveryMethod: 'Hybrid',
    startDate: deadline(30),
    endDate: deadline(60),
    capacity: 24,
    closingDate: deadline(),
    applicationInstructions: 'Apply through this platform.',
    supportingDocuments: [{
      filename: 'programme.pdf',
      mimeType: 'application/pdf',
      size: Buffer.from(encodedPdf, 'base64').length,
      data: encodedPdf,
    }],
  };

  const submitted = await request('/provider/opportunities', {
    method: 'POST',
    headers: auth(providerToken),
    body: JSON.stringify(form),
  });
  assert.equal(submitted.response.status, 201);
  assert.equal(submitted.body.opportunity.status, 'Pending Approval');
  assert.equal(submitted.body.opportunity.organization, 'GreenFields Training Centre');
  assert.equal(submitted.body.opportunity.supportingDocuments[0].data, undefined);
  assert.equal(submitted.body.opportunity.capacity, 24);

  const notTrainingProvider = await request('/provider/opportunities', { headers: auth(learnerToken) });
  assert.equal(notTrainingProvider.response.status, 403);
  const wrongRoleEndpoint = await request('/employer/opportunities', { headers: auth(providerToken) });
  assert.equal(wrongRoleEndpoint.response.status, 403);

  const invalidCategory = await request('/provider/opportunities', {
    method: 'POST',
    headers: auth(providerToken),
    body: JSON.stringify({ action: 'draft', title, description: 'Not a training opportunity.', category: 'Employment', role: 'learner' }),
  });
  assert.equal(invalidCategory.response.status, 400);

  const incompleteFunding = await request('/provider/opportunities', {
    method: 'POST',
    headers: auth(providerToken),
    body: JSON.stringify({
      action: 'submit',
      title: `Incomplete Training Funding ${Date.now()}`,
      description: 'Funding opportunity for agricultural training.',
      category: 'Funding',
      role: 'learner',
      location: 'Eastern Cape',
      trainingObjectives: 'Support agricultural training.',
      accreditation: 'Provider evidence supplied.',
      duration: 'Six weeks',
      deliveryMethod: 'Hybrid',
      startDate: deadline(30),
      endDate: deadline(60),
      capacity: 24,
      qualifications: 'Eligible learners.',
      requirements: ['Agricultural training interest.'],
      closingDate: deadline(),
      applicationInstructions: 'Apply through this platform.',
    }),
  });
  assert.equal(incompleteFunding.response.status, 400);

  const trainingFunding = await request('/provider/opportunities', {
    method: 'POST',
    headers: auth(providerToken),
    body: JSON.stringify({
      action: 'submit',
      title: `Agricultural Training Funding ${Date.now()}`,
      description: 'Funding to support agricultural skills development.',
      category: 'Funding',
      role: 'learner',
      location: 'Eastern Cape',
      trainingObjectives: 'Fund practical agricultural soil-management skills training.',
      accreditation: 'Provider evidence supplied.',
      duration: 'Six weeks',
      deliveryMethod: 'Hybrid',
      startDate: deadline(30),
      endDate: deadline(60),
      capacity: 24,
      qualifications: 'Eligible learners.',
      requirements: ['Agricultural training interest.'],
      closingDate: deadline(),
      applicationInstructions: 'Apply through this platform.',
      opportunityDetails: {
        programmeName: 'Soil Skills Training Fund',
        fundingType: 'Training grant',
        fundingPurpose: 'Support practical agricultural training.',
        projectObjectives: 'Develop soil-management skills.',
      },
    }),
  });
  assert.equal(trainingFunding.response.status, 201, trainingFunding.body.message);
  assert.equal(trainingFunding.body.opportunity.category, 'Funding');

  const hidden = await request(`/opportunities?q=${encodeURIComponent(title)}`, { headers: auth(learnerToken) });
  assert.deepEqual(hidden.body.opportunities, []);
  const reviewQueue = await request('/admin/opportunities?status=Pending%20Approval', { headers: auth(adminToken) });
  assert.ok(reviewQueue.body.opportunities.some((entry) => entry.id === submitted.body.opportunity.id));
  const adminDocument = await request(
    `/admin/opportunities/${submitted.body.opportunity.id}/documents/${submitted.body.opportunity.supportingDocuments[0].id}`,
    { headers: auth(adminToken) }
  );
  assert.equal(adminDocument.response.status, 200);
  assert.equal(adminDocument.body.document.data, encodedPdf);
  const providerDocument = await request(
    `/admin/opportunities/${submitted.body.opportunity.id}/documents/${submitted.body.opportunity.supportingDocuments[0].id}`,
    { headers: auth(providerToken) }
  );
  assert.equal(providerDocument.response.status, 403);

  const changeRequest = await request(`/admin/opportunities/${submitted.body.opportunity.id}`, {
    method: 'PATCH',
    headers: auth(adminToken),
    body: JSON.stringify({ action: 'request_changes', note: 'Clarify the learner entry requirements.' }),
  });
  assert.equal(changeRequest.response.status, 200);
  assert.equal(changeRequest.body.opportunity.status, 'Changes Requested');
  const providerSubmissions = await request('/provider/opportunities', { headers: auth(providerToken) });
  const changesRequested = providerSubmissions.body.opportunities.find((entry) => entry.id === submitted.body.opportunity.id);
  assert.equal(changesRequested.reviewNote, 'Clarify the learner entry requirements.');

  const resubmitted = await request(`/provider/opportunities/${submitted.body.opportunity.id}`, {
    method: 'PATCH',
    headers: auth(providerToken),
    body: JSON.stringify({ ...form, supportingDocuments: [] }),
  });
  assert.equal(resubmitted.response.status, 200);
  assert.equal(resubmitted.body.opportunity.status, 'Pending Approval');
  assert.deepEqual(resubmitted.body.opportunity.supportingDocuments, []);

  await approveAndPublish(submitted.body.opportunity.id, adminToken);

  const users = await request('/users', { headers: auth(adminToken) });
  const providerAccount = users.body.users.find((entry) => entry.email === 'provider@myagriseta.local');
  const deactivated = await request(`/users/${providerAccount.id}/status`, {
    method: 'PATCH',
    headers: auth(adminToken),
    body: JSON.stringify({ status: 'inactive' }),
  });
  assert.equal(deactivated.response.status, 200);
  const unavailable = await request(`/opportunities/${submitted.body.opportunity.id}`, { headers: auth(learnerToken) });
  assert.equal(unavailable.response.status, 404);
  const blockedApplication = await request('/applications', {
    method: 'POST',
    headers: auth(learnerToken),
    body: JSON.stringify({ opportunityId: submitted.body.opportunity.id, ...applicationForm() }),
  });
  assert.equal(blockedApplication.response.status, 409);
  const reactivated = await request(`/users/${providerAccount.id}/status`, {
    method: 'PATCH',
    headers: auth(adminToken),
    body: JSON.stringify({ status: 'active' }),
  });
  assert.equal(reactivated.response.status, 200);
  const publicListing = await request(`/opportunities/${submitted.body.opportunity.id}`, { headers: auth(learnerToken) });
  assert.equal(publicListing.response.status, 200);
  assert.equal(publicListing.body.opportunity.contactEmail, undefined);
  assert.equal(publicListing.body.opportunity.ownerUserId, undefined);
  assert.equal(publicListing.body.opportunity.submittedBy, undefined);
  assert.equal(publicListing.body.opportunity.supportingDocuments, undefined);

  const application = await request('/applications', {
    method: 'POST',
    headers: auth(learnerToken),
    body: JSON.stringify({ opportunityId: submitted.body.opportunity.id, ...applicationForm() }),
  });
  assert.equal(application.response.status, 201);

  const review = await request(`/admin/applications/${application.body.application.id}/status`, {
    method: 'PATCH',
    headers: auth(adminToken),
    body: JSON.stringify({
      status: 'Additional Information Required',
      outstandingRequirements: ['Please provide your latest training record.'],
      feedback: 'Your application is being reviewed. Please add the requested training record.',
    }),
  });
  assert.equal(review.response.status, 200);

  const applicantApplications = await request('/applications', { headers: auth(learnerToken) });
  const applicantRecord = applicantApplications.body.applications.find((entry) => entry.id === application.body.application.id);
  assert.equal(applicantRecord.feedback, 'Your application is being reviewed. Please add the requested training record.');
  assert.equal(applicantRecord.statusHistory.at(-1).feedback, applicantRecord.feedback);
  assert.deepEqual(applicantRecord.outstandingRequirements, ['Please provide your latest training record.']);
  const applicantNotifications = await request('/notifications', { headers: auth(learnerToken) });
  const statusNotice = applicantNotifications.body.notifications.find((entry) =>
    entry.message.includes(application.body.application.reference)
  );
  assert.ok(statusNotice);
  assert.equal(statusNotice.canMarkRead, true);
  assert.equal(statusNotice.targetType, 'application');
  assert.equal(statusNotice.targetId, application.body.application.id);
  assert.equal(statusNotice.emailDeliveryStatus, 'disabled');
  assert.equal(statusNotice.emailDeliveryRecipient, 'learner@myagriseta.local');
  assert.match(statusNotice.message, /Additional documents or information requested:/);
  assert.match(statusNotice.message, /Please provide your latest training record\./);
  const finalReview = await request(`/admin/applications/${application.body.application.id}/status`, {
    method: 'PATCH',
    headers: auth(adminToken),
    body: JSON.stringify({ status: 'Approved' }),
  });
  assert.equal(finalReview.response.status, 200);
  const approvalNotifications = await request('/notifications', { headers: auth(learnerToken) });
  const approvalNotice = approvalNotifications.body.notifications.find((entry) =>
    entry.title === 'Application approved' && entry.message.includes('now Approved')
  );
  assert.ok(approvalNotice);
  assert.equal(approvalNotice.targetType, 'application');
  assert.equal(approvalNotice.targetId, application.body.application.id);
  const unauthenticatedResend = await request('/notifications/resend-email', { method: 'POST' });
  assert.equal(unauthenticatedResend.response.status, 401);
  const otherAccountResend = await request('/notifications/resend-email', {
    method: 'POST',
    headers: auth(farmerToken),
  });
  assert.equal(otherAccountResend.response.status, 503);
  const disabledEmailResend = await request('/notifications/resend-email', {
    method: 'POST',
    headers: auth(learnerToken),
  });
  assert.equal(disabledEmailResend.response.status, 503);
  const legacyResend = await request('/notifications/resend-application-status', {
    method: 'POST',
    headers: auth(learnerToken),
  });
  assert.equal(legacyResend.response.status, 503);
  const markedRead = await request(`/notifications/${statusNotice.id}/read`, {
    method: 'PATCH',
    headers: auth(learnerToken),
  });
  assert.equal(markedRead.body.notification.read, true);

  const otherApplicantApplications = await request('/applications', { headers: auth(farmerToken) });
  assert.equal(otherApplicantApplications.body.applications.some((entry) => entry.id === application.body.application.id), false);

  const archived = await request(`/provider/opportunities/${submitted.body.opportunity.id}`, {
    method: 'PATCH',
    headers: auth(providerToken),
    body: JSON.stringify({ action: 'withdraw' }),
  });
  assert.equal(archived.response.status, 200);
  assert.equal(archived.body.opportunity.status, 'Archived');
});

test('SDF opportunity submissions require administrator approval and preserve role eligibility', async () => {
  const sdfToken = await login('sdf', 'Mpho123!');
  const learnerToken = await login('learner', 'Lerato123!');
  const providerToken = await login('provider', 'Naledi123!');
  const adminToken = await login('admin', 'Admin123!');
  const title = `Workplace Skills Improvement ${Date.now()}`;
  const submission = await request('/sdf/opportunities', {
    method: 'POST',
    headers: auth(sdfToken),
    body: JSON.stringify({
      action: 'submit',
      title,
      description: 'Workplace skills support for agricultural employees.',
      category: 'Skills Development',
      role: 'sdf',
      location: 'Northern Cape',
      requirements: ['For SDF accounts coordinating agricultural workforce development.'],
      trainingObjectives: 'Improve workplace planning and employee skills.',
      requiredSkills: ['Workplace skills planning', 'Training coordination'],
      participantCount: 18,
      startDate: deadline(30),
      endDate: deadline(90),
      closingDate: deadline(),
      applicationInstructions: 'Apply through this platform.',
    }),
  });
  assert.equal(submission.response.status, 201);
  assert.equal(submission.body.opportunity.status, 'Pending Approval');
  assert.equal(submission.body.opportunity.organization, 'Northern Skills Hub');

  const deniedRole = await request('/sdf/opportunities', { headers: auth(providerToken) });
  assert.equal(deniedRole.response.status, 403);
  const hidden = await request(`/opportunities?q=${encodeURIComponent(title)}`, { headers: auth(sdfToken) });
  assert.deepEqual(hidden.body.opportunities, []);

  const adminApproval = await request(`/admin/opportunities/${submission.body.opportunity.id}`, {
    method: 'PATCH',
    headers: auth(adminToken),
    body: JSON.stringify({ action: 'approve' }),
  });
  assert.equal(adminApproval.response.status, 200, adminApproval.body.message);
  const published = await request(`/admin/opportunities/${submission.body.opportunity.id}`, {
    method: 'PATCH',
    headers: auth(adminToken),
    body: JSON.stringify({ action: 'publish' }),
  });
  assert.equal(published.response.status, 200);

  const eligibleBrowse = await request(`/opportunities?q=${encodeURIComponent(title)}`, { headers: auth(sdfToken) });
  assert.equal(eligibleBrowse.body.opportunities.length, 1);
  const eligibleApplication = await request('/applications', {
    method: 'POST',
    headers: auth(sdfToken),
    body: JSON.stringify({
      opportunityId: submission.body.opportunity.id,
      ...applicationForm({ fullName: 'Mpho Ramokgopa', email: 'sdf@myagriseta.local' }),
    }),
  });
  assert.equal(eligibleApplication.response.status, 201);
  const ineligibleBrowse = await request(`/opportunities?q=${encodeURIComponent(title)}`, { headers: auth(learnerToken) });
  assert.deepEqual(ineligibleBrowse.body.opportunities, []);
  const ineligibleApply = await request('/applications', {
    method: 'POST',
    headers: auth(learnerToken),
    body: JSON.stringify({ opportunityId: submission.body.opportunity.id, ...applicationForm() }),
  });
  assert.equal(ineligibleApply.response.status, 403);
});
