const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');

const app = require('../src/server');
const { curriculum } = require('../src/learning-curriculum');
const { courses } = require('../src/learning-data');

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

async function createPublishedCourse(title, providerToken, adminToken) {
  const submitted = await request('/learning/provider/courses', {
    method: 'POST',
    headers: auth(providerToken),
    body: JSON.stringify({
      title,
      description: 'Submitted programme for review testing.',
      categoryId: 'crop-plant',
      programmeType: 'Short Course',
      duration: '4 weeks',
      deliveryMethod: 'Blended',
      location: 'Limpopo',
      eligibleRoles: ['learner', 'farmer'],
    }),
  });
  assert.equal(submitted.response.status, 201);
  const courseId = submitted.body.course.id;
  const approved = await request(`/learning/courses/${courseId}/status`, {
    method: 'PATCH',
    headers: auth(adminToken),
    body: JSON.stringify({ status: 'Approved' }),
  });
  assert.equal(approved.response.status, 200);
  const published = await request(`/learning/courses/${courseId}/status`, {
    method: 'PATCH',
    headers: auth(adminToken),
    body: JSON.stringify({ status: 'Published' }),
  });
  assert.equal(published.response.status, 200);
  return published.body.course;
}

test('learning catalogue shows labeled seed demonstrations but hides unapproved provider submissions', async () => {
  const learnerToken = await login('learner@myagriseta.local', 'Lerato123!');
  const unauthenticated = await request('/learning/courses');
  assert.equal(unauthenticated.response.status, 401);

  const cropCourses = await request('/learning/courses?category=crop-plant&sort=name', {
    headers: auth(learnerToken),
  });
  assert.equal(cropCourses.response.status, 200);
  assert.deepEqual(cropCourses.body.courses.map((course) => course.id), ['course-crop']);
  assert.equal(cropCourses.body.courses[0].status, 'Demonstration');
  assert.match(cropCourses.body.courses[0].dataStatus, /Synthetic demonstration content/);
  assert.deepEqual(cropCourses.body.courses[0].lessonTitles, curriculum['course-crop'].map(({ id, title }) => ({ id, title })));
  assert.equal(Object.hasOwn(cropCourses.body.courses[0], 'modules'), false);

  const courseDetails = await request('/learning/courses/course-crop', { headers: auth(learnerToken) });
  assert.deepEqual(courseDetails.body.course.lessonTitles, cropCourses.body.courses[0].lessonTitles);
  assert.equal(courseDetails.body.course.lessonTitles[0].content, undefined);

  const search = await request('/learning/courses?q=greenfields&programmeType=Short%20Course', {
    headers: auth(learnerToken),
  });
  assert.deepEqual(search.body.courses.map((course) => course.id), ['course-crop']);

  const categories = await request('/learning/categories', { headers: auth(learnerToken) });
  assert.equal(categories.body.categories.length, 8);
  const programmes = await request('/learning/programmes', { headers: auth(learnerToken) });
  assert.ok(programmes.body.programmes.some((programme) => programme.courseCount > 0));
});

test('provider directory filters programmes and resources are served as readable in-app material', async () => {
  const token = await login('farmer@myagriseta.local', 'Sipho123!');
  const providers = await request('/learning/providers?category=animal', { headers: auth(token) });
  assert.equal(providers.response.status, 200);
  assert.equal(providers.body.providers.length, 2);

  const resources = await request('/learning/resources?q=water', { headers: auth(token) });
  assert.deepEqual(resources.body.resources.map((resource) => resource.id), ['resource-water-check']);
  assert.equal(Object.hasOwn(resources.body.resources[0], 'downloadUrl'), false);

  const resource = await request('/learning/resources/resource-water-check', { headers: auth(token) });
  assert.equal(resource.response.status, 200);
  assert.ok(resource.body.resource.content.length > 0);
  assert.match(resource.body.resource.dataStatus, /Demonstration/);

  const marketGuide = await request('/learning/resources/resource-market-planning', { headers: auth(token) });
  assert.equal(marketGuide.response.status, 200);
  assert.match(marketGuide.body.resource.title, /Market planning/);
  assert.match(marketGuide.body.resource.dataStatus, /No live South African market prices/);
  assert.ok(marketGuide.body.resource.content.some((entry) => /price unit/.test(entry)));

  const farmerResources = await request('/learning/resources', { headers: auth(token) });
  assert.ok(farmerResources.body.resources.some((entry) => entry.id === 'resource-soil-observations'));
  assert.ok(farmerResources.body.resources.some((entry) => entry.id === 'resource-crop-scouting'));
  assert.ok(farmerResources.body.resources.some((entry) => entry.id === 'resource-livestock-observations'));
  assert.ok(farmerResources.body.resources.some((entry) => entry.id === 'resource-funding-readiness'));
});

test('farmer market records are source-attributed, dated, role-restricted, and admin-managed', async () => {
  const farmerToken = await login('farmer', 'Sipho123!');
  const learnerToken = await login('learner', 'Lerato123!');
  const adminToken = await login('admin', 'Admin123!');
  const farmerHeaders = auth(farmerToken);
  const adminHeaders = auth(adminToken);

  const initial = await request('/farmer/market', { headers: farmerHeaders });
  assert.equal(initial.response.status, 200);
  assert.ok(Array.isArray(initial.body.records));

  const learnerAccess = await request('/farmer/market', { headers: auth(learnerToken) });
  assert.equal(learnerAccess.response.status, 403);
  const invalid = await request('/admin/farmer-data/market', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({ commodity: 'Maize', sourceUrl: 'javascript:alert(1)' }),
  });
  assert.equal(invalid.response.status, 400);

  const observedAt = new Date().toISOString().slice(0, 10);
  const expiresAt = new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10);
  const created = await request('/admin/farmer-data/market', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      commodity: 'Maize',
      grade: 'Example grade',
      market: 'Example market',
      province: 'Free State',
      price: 5200,
      unit: 'tonne',
      observedAt,
      sourceName: 'Test source',
      sourceUrl: 'https://example.org/market',
      verifiedAt: observedAt,
      expiresAt,
    }),
  });
  assert.equal(created.response.status, 201, created.body.message);

  const visible = await request('/farmer/market', { headers: farmerHeaders });
  const record = visible.body.records.find((entry) => entry.id === created.body.record.id);
  assert.equal(record.price, 5200);
  assert.equal(record.sourceUrl, 'https://example.org/market');
  assert.equal(record.expiresAt, expiresAt);
  const forbidden = await request('/admin/farmer-data/market', { headers: farmerHeaders });
  assert.equal(forbidden.response.status, 403);

  const deleted = await request(`/admin/farmer-data/market/${created.body.record.id}`, {
    method: 'DELETE',
    headers: adminHeaders,
  });
  assert.equal(deleted.response.status, 200);
  const afterDelete = await request('/farmer/market', { headers: farmerHeaders });
  assert.ok(!afterDelete.body.records.some((entry) => entry.id === created.body.record.id));
});

test('farmers can request a consent-checked mentor introduction and receive contact only after staff matching', async () => {
  const farmerToken = await login('farmer', 'Sipho123!');
  const adminToken = await login('admin', 'Admin123!');
  const farmerHeaders = auth(farmerToken);
  const adminHeaders = auth(adminToken);
  const verifiedAt = new Date().toISOString().slice(0, 10);
  const expiresAt = new Date(Date.now() + 90 * 86_400_000).toISOString().slice(0, 10);

  const missingConsent = await request('/admin/farmer-data/mentors', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      name: 'Test Mentor',
      province: 'Limpopo',
      expertise: 'Crop planning',
      biography: 'A source-checked profile for testing only.',
      contactEmail: 'mentor@example.org',
      sourceName: 'Test source',
      sourceUrl: 'https://example.org/mentor',
      verifiedAt,
      expiresAt,
    }),
  });
  assert.equal(missingConsent.response.status, 400);

  const created = await request('/admin/farmer-data/mentors', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      name: 'Test Mentor',
      province: 'Limpopo',
      expertise: 'Crop planning',
      biography: 'A source-checked profile for testing only.',
      contactEmail: 'mentor@example.org',
      sourceName: 'Test source',
      sourceUrl: 'https://example.org/mentor',
      verifiedAt,
      expiresAt,
      consentToList: true,
      consentToShare: true,
    }),
  });
  assert.equal(created.response.status, 201, created.body.message);
  assert.equal(Object.hasOwn(created.body.mentor, 'contactEmail'), false);

  const farmerDirectory = await request('/farmer/mentors', { headers: farmerHeaders });
  const publicMentor = farmerDirectory.body.mentors.find((entry) => entry.id === created.body.mentor.id);
  assert.ok(publicMentor);
  assert.equal(Object.hasOwn(publicMentor, 'contactEmail'), false);

  const requested = await request(`/farmer/mentors/${created.body.mentor.id}/requests`, {
    method: 'POST',
    headers: farmerHeaders,
    body: JSON.stringify({ message: 'I would like guidance on planning my crop cycle.' }),
  });
  assert.equal(requested.response.status, 201);
  const duplicate = await request(`/farmer/mentors/${created.body.mentor.id}/requests`, {
    method: 'POST',
    headers: farmerHeaders,
    body: JSON.stringify({ message: 'I would like to discuss farm planning.' }),
  });
  assert.equal(duplicate.response.status, 409);

  const requestId = requested.body.request.id;
  const connected = await request(`/admin/farmer-data/mentor-requests/${requestId}`, {
    method: 'PATCH',
    headers: adminHeaders,
    body: JSON.stringify({ status: 'Connected', feedback: 'The mentor agreed to an introduction.' }),
  });
  assert.equal(connected.response.status, 200);
  const farmerRequests = await request('/farmer/mentor-requests', { headers: farmerHeaders });
  assert.equal(farmerRequests.body.requests[0].mentorContactEmail, 'mentor@example.org');

  const learnerAccess = await request('/farmer/mentors', { headers: auth(await login('learner', 'Lerato123!')) });
  assert.equal(learnerAccess.response.status, 403);
});

test('every synthetic demonstration course has two modules with knowledge checks', () => {
  const demoCourseIds = courses.filter((course) => course.status === 'Demonstration').map((course) => course.id);
  assert.deepEqual(Object.keys(curriculum).sort(), demoCourseIds.sort());
  for (const modules of Object.values(curriculum)) {
    assert.equal(modules.length, 2);
    for (const module of modules) {
      assert.equal(module.content.length, 2);
      assert.equal(module.questions.length, 3);
      for (const question of module.questions) {
        assert.equal(question.options.length, 3);
        assert.ok(question.options.some((option) => option.id === question.correctOptionId));
      }
    }
  }
});

test('users can enrol in demonstration courses and track started guides in My learning', async () => {
  const learnerToken = await login('learner@myagriseta.local', 'Lerato123!');
  const farmerToken = await login('farmer@myagriseta.local', 'Sipho123!');
  const adminToken = await login('admin@myagriseta.local', 'Admin123!');

  const enrolled = await request('/learning/enrollments', {
    method: 'POST',
    headers: auth(learnerToken),
    body: JSON.stringify({ courseId: 'course-crop', acknowledgedDemo: true }),
  });
  assert.equal(enrolled.response.status, 201);
  assert.equal(enrolled.body.enrollment.status, 'Enrolled (demo)');

  const demoReview = await request(`/learning/enrollments/${enrolled.body.enrollment.id}/status`, {
    method: 'PATCH',
    headers: auth(adminToken),
    body: JSON.stringify({ status: 'Accepted' }),
  });
  assert.equal(demoReview.response.status, 409);

  const learnerHome = await request('/learning/me', { headers: auth(learnerToken) });
  assert.equal(learnerHome.body.enrollments.length, 1);
  assert.equal(learnerHome.body.enrollments[0].course.title, 'Crop Production');
  assert.deepEqual(learnerHome.body.startedResources, []);

  const farmerHome = await request('/learning/me', { headers: auth(farmerToken) });
  assert.deepEqual(farmerHome.body.enrollments, []);

  const duplicate = await request('/learning/enrollments', {
    method: 'POST',
    headers: auth(learnerToken),
    body: JSON.stringify({ courseId: 'course-crop', acknowledgedDemo: true }),
  });
  assert.equal(duplicate.response.status, 409);

  const started = await request('/learning/resources/resource-water-check/started', {
    method: 'POST',
    headers: auth(learnerToken),
  });
  assert.equal(started.response.status, 201);
  assert.equal(started.body.progress.status, 'In Progress');

  const repeatedStart = await request('/learning/resources/resource-water-check/started', {
    method: 'POST',
    headers: auth(learnerToken),
  });
  assert.equal(repeatedStart.response.status, 200);
  assert.equal(repeatedStart.body.progress.id, started.body.progress.id);

  const updatedHome = await request('/learning/me', { headers: auth(learnerToken) });
  assert.equal(updatedHome.body.startedResources.length, 1);
  assert.equal(updatedHome.body.startedResources[0].resource.title, 'Water-use observation notes');
  const otherUserHome = await request('/learning/me', { headers: auth(farmerToken) });
  assert.deepEqual(otherUserHome.body.startedResources, []);

  const withdrawn = await request(`/learning/enrollments/${enrolled.body.enrollment.id}`, {
    method: 'PATCH',
    headers: auth(learnerToken),
    body: JSON.stringify({ action: 'withdraw' }),
  });
  assert.equal(withdrawn.body.enrollment.status, 'Withdrawn');
});

test('enrolled learners complete private course modules and pass assessments for course completion', async () => {
  const learnerToken = await login('learner@myagriseta.local', 'Lerato123!');
  const farmerToken = await login('farmer@myagriseta.local', 'Sipho123!');
  const enrolled = await request('/learning/enrollments', {
    method: 'POST',
    headers: auth(learnerToken),
    body: JSON.stringify({ courseId: 'course-crop', acknowledgedDemo: true }),
  });
  assert.equal(enrolled.response.status, 201);
  const enrollmentId = enrolled.body.enrollment.id;

  const otherAccount = await request(`/learning/enrollments/${enrollmentId}/coursework`, {
    headers: auth(farmerToken),
  });
  assert.equal(otherAccount.response.status, 404);

  const coursework = await request(`/learning/enrollments/${enrollmentId}/coursework`, {
    headers: auth(learnerToken),
  });
  assert.equal(coursework.response.status, 200);
  assert.equal(coursework.body.modules.length, 2);
  assert.equal(coursework.body.passMark, 67);
  assert.match(coursework.body.dataStatus, /not an accredited course or formal assessment/i);
  assert.equal(Object.hasOwn(coursework.body.modules[0].questions[0], 'correctOptionId'), false);

  const firstModule = coursework.body.modules[0];
  const assessmentBeforeLesson = await request(
    `/learning/enrollments/${enrollmentId}/modules/${firstModule.id}/assessment`,
    {
      method: 'POST',
      headers: auth(learnerToken),
      body: JSON.stringify({ answers: {} }),
    }
  );
  assert.equal(assessmentBeforeLesson.response.status, 409);

  const lesson = await request(
    `/learning/enrollments/${enrollmentId}/modules/${firstModule.id}/lesson-complete`,
    { method: 'POST', headers: auth(learnerToken) }
  );
  assert.equal(lesson.response.status, 200);
  assert.equal(lesson.body.progress.lessonCompleted, true);

  const sourceModule = curriculum['course-crop'][0];
  const answersFor = (module, questionCountToAnswer = module.questions.length) =>
    Object.fromEntries(module.questions.map((question, index) => {
      const questionId = question.id || `${module.id}-question-${index + 1}`;
      const optionId = index < questionCountToAnswer
        ? question.correctOptionId
        : module.questions[index].options.find((option) => option.id !== question.correctOptionId).id;
      return [questionId, optionId];
    }));

  const failedAssessment = await request(
    `/learning/enrollments/${enrollmentId}/modules/${firstModule.id}/assessment`,
    {
      method: 'POST',
      headers: auth(learnerToken),
      body: JSON.stringify({ answers: answersFor(sourceModule, 0) }),
    }
  );
  assert.equal(failedAssessment.response.status, 200);
  assert.equal(failedAssessment.body.result.passed, false);
  assert.equal(failedAssessment.body.progress.attempts, 1);

  const incompleteAnswers = await request(
    `/learning/enrollments/${enrollmentId}/modules/${firstModule.id}/assessment`,
    {
      method: 'POST',
      headers: auth(learnerToken),
      body: JSON.stringify({ answers: { [firstModule.questions[0].id]: 'a' } }),
    }
  );
  assert.equal(incompleteAnswers.response.status, 400);

  const firstAssessment = await request(
    `/learning/enrollments/${enrollmentId}/modules/${firstModule.id}/assessment`,
    {
      method: 'POST',
      headers: auth(learnerToken),
      body: JSON.stringify({ answers: answersFor(sourceModule, 2) }),
    }
  );
  assert.equal(firstAssessment.response.status, 200);
  assert.equal(firstAssessment.body.result.score, 67);
  assert.equal(firstAssessment.body.result.passed, true);
  assert.equal(firstAssessment.body.progress.attempts, 2);
  assert.equal(firstAssessment.body.courseProgress.progressPercent, 50);
  assert.equal(firstAssessment.body.courseProgress.completed, false);

  const secondModule = coursework.body.modules[1];
  const secondLesson = await request(
    `/learning/enrollments/${enrollmentId}/modules/${secondModule.id}/lesson-complete`,
    { method: 'POST', headers: auth(learnerToken) }
  );
  assert.equal(secondLesson.response.status, 200);

  const secondAssessment = await request(
    `/learning/enrollments/${enrollmentId}/modules/${secondModule.id}/assessment`,
    {
      method: 'POST',
      headers: auth(learnerToken),
      body: JSON.stringify({ answers: answersFor(curriculum['course-crop'][1]) }),
    }
  );
  assert.equal(secondAssessment.response.status, 200);
  assert.equal(secondAssessment.body.result.passed, true);
  assert.equal(secondAssessment.body.courseProgress.progressPercent, 100);
  assert.equal(secondAssessment.body.courseProgress.completed, true);

  const learnerHome = await request('/learning/me', { headers: auth(learnerToken) });
  assert.equal(learnerHome.body.progress[0].completed, true);
  assert.equal(learnerHome.body.moduleProgress.length, 2);
  const farmerHome = await request('/learning/me', { headers: auth(farmerToken) });
  assert.deepEqual(farmerHome.body.moduleProgress, []);
});

test('course bookmarks and enrolment enquiries are private, role-checked, and duplicate-safe', async () => {
  const learnerToken = await login('learner@myagriseta.local', 'Lerato123!');
  const farmerToken = await login('farmer@myagriseta.local', 'Sipho123!');
  const providerToken = await login('provider@myagriseta.local', 'Naledi123!');
  const adminToken = await login('admin@myagriseta.local', 'Admin123!');
  const publishedCourse = await createPublishedCourse('Published Course Bookmark Test', providerToken, adminToken);

  const saved = await request(`/learning/courses/${publishedCourse.id}/saved`, {
    method: 'POST',
    headers: auth(learnerToken),
  });
  assert.equal(saved.response.status, 201);

  const farmerLearning = await request('/learning/me', { headers: auth(farmerToken) });
  assert.deepEqual(farmerLearning.body.savedCourses, []);
  assert.deepEqual(farmerLearning.body.enrollments, []);

  const forbiddenRole = await request('/learning/enrollments', {
    method: 'POST',
    headers: auth(providerToken),
    body: JSON.stringify({ courseId: publishedCourse.id, acknowledgedDemo: true }),
  });
  assert.equal(forbiddenRole.response.status, 403);

  const missingAcknowledgement = await request('/learning/enrollments', {
    method: 'POST',
    headers: auth(learnerToken),
    body: JSON.stringify({ courseId: publishedCourse.id }),
  });
  assert.equal(missingAcknowledgement.response.status, 400);

  const submitted = await request('/learning/enrollments', {
    method: 'POST',
    headers: auth(learnerToken),
    body: JSON.stringify({
      courseId: publishedCourse.id,
      acknowledgedDemo: true,
      shareWithProvider: true,
      applicantNote: 'Interested in the course details.',
    }),
  });
  assert.equal(submitted.response.status, 201);
  assert.equal(submitted.body.enrollment.status, 'Submitted');
  assert.match(submitted.body.enrollment.reference, /^LRN-\d{4}-[A-F0-9]{8}$/);

  const duplicate = await request('/learning/enrollments', {
    method: 'POST',
    headers: auth(learnerToken),
    body: JSON.stringify({ courseId: publishedCourse.id, acknowledgedDemo: true, shareWithProvider: true }),
  });
  assert.equal(duplicate.response.status, 409);

  const otherUserUpdate = await request(`/learning/enrollments/${submitted.body.enrollment.id}`, {
    method: 'PATCH',
    headers: auth(farmerToken),
    body: JSON.stringify({ action: 'withdraw' }),
  });
  assert.equal(otherUserUpdate.response.status, 404);

  const withdrawn = await request(`/learning/enrollments/${submitted.body.enrollment.id}`, {
    method: 'PATCH',
    headers: auth(learnerToken),
    body: JSON.stringify({ action: 'withdraw' }),
  });
  assert.equal(withdrawn.body.enrollment.status, 'Withdrawn');

  const removed = await request(`/learning/courses/${publishedCourse.id}/saved`, {
    method: 'DELETE',
    headers: auth(learnerToken),
  });
  assert.equal(removed.response.status, 200);
});

test('provider listing submissions require ownership and administrator review before publication', async () => {
  const providerToken = await login('provider@myagriseta.local', 'Naledi123!');
  const learnerToken = await login('learner@myagriseta.local', 'Lerato123!');
  const adminToken = await login('admin@myagriseta.local', 'Admin123!');

  const submitted = await request('/learning/provider/courses', {
    method: 'POST',
    headers: auth(providerToken),
    body: JSON.stringify({
      title: 'Demonstration Soil Workshop',
      description: 'Provider-submitted demonstration course.',
      requirements: 'Basic literacy; bring farm records.',
      categoryId: 'natural-resources',
      programmeType: 'Workshop',
      duration: '2 weeks',
      deliveryMethod: 'In person',
      location: 'Local demonstration venue',
      eligibleRoles: ['farmer'],
    }),
  });
  assert.equal(submitted.response.status, 201);
  assert.equal(submitted.body.course.status, 'Pending Review');
  assert.equal(submitted.body.course.requirements, 'Basic literacy; bring farm records.');

  const hidden = await request(`/learning/courses/${submitted.body.course.id}`, {
    headers: auth(learnerToken),
  });
  assert.equal(hidden.response.status, 404);

  const deniedReview = await request(`/learning/courses/${submitted.body.course.id}/status`, {
    method: 'PATCH',
    headers: auth(providerToken),
    body: JSON.stringify({ status: 'Published' }),
  });
  assert.equal(deniedReview.response.status, 403);

  const missingReason = await request(`/learning/courses/${submitted.body.course.id}/status`, {
    method: 'PATCH',
    headers: auth(adminToken),
    body: JSON.stringify({ status: 'Rejected' }),
  });
  assert.equal(missingReason.response.status, 400);

  const rejected = await request(`/learning/courses/${submitted.body.course.id}/status`, {
    method: 'PATCH',
    headers: auth(adminToken),
    body: JSON.stringify({ status: 'Rejected', note: 'Please clarify the programme requirements.' }),
  });
  assert.equal(rejected.response.status, 200);
  assert.equal(rejected.body.course.reviewNote, 'Please clarify the programme requirements.');
  assert.equal((await request(`/learning/courses/${submitted.body.course.id}`, {
    headers: auth(learnerToken),
  })).response.status, 404);

  const resubmitted = await request(`/learning/provider/courses/${submitted.body.course.id}`, {
    method: 'PATCH',
    headers: auth(providerToken),
    body: JSON.stringify({
      action: 'submit',
      title: 'Demonstration Soil Workshop',
      description: 'Provider-submitted demonstration course with clarified requirements.',
      requirements: 'Basic literacy; bring updated farm records.',
      categoryId: 'natural-resources',
      programmeType: 'Workshop',
      duration: '2 weeks',
      deliveryMethod: 'In person',
      location: 'Local demonstration venue',
      eligibleRoles: ['farmer'],
    }),
  });
  assert.equal(resubmitted.response.status, 200);
  assert.equal(resubmitted.body.course.status, 'Pending Review');
  assert.equal(resubmitted.body.course.requirements, 'Basic literacy; bring updated farm records.');

  const published = await request(`/learning/courses/${submitted.body.course.id}/status`, {
    method: 'PATCH',
    headers: auth(adminToken),
    body: JSON.stringify({ status: 'Approved' }),
  });
  assert.equal(published.response.status, 200);
  assert.equal(published.body.course.status, 'Approved');
  const stillHidden = await request(`/learning/courses/${submitted.body.course.id}`, {
    headers: auth(learnerToken),
  });
  assert.equal(stillHidden.response.status, 404);

  const publication = await request(`/learning/courses/${submitted.body.course.id}/status`, {
    method: 'PATCH',
    headers: auth(adminToken),
    body: JSON.stringify({ status: 'Published' }),
  });
  assert.equal(publication.response.status, 200);
  assert.equal(publication.body.course.interestEnabled, true);

  const visible = await request(`/learning/courses/${submitted.body.course.id}`, {
    headers: auth(learnerToken),
  });
  assert.equal(visible.response.status, 200);
});

test('only administrators can manage learning categories and in-app resources', async () => {
  const learnerToken = await login('learner@myagriseta.local', 'Lerato123!');
  const adminToken = await login('admin@myagriseta.local', 'Admin123!');
  const denied = await request('/learning/categories', {
    method: 'POST',
    headers: auth(learnerToken),
    body: JSON.stringify({ name: 'Learner-created category', description: 'Should be denied.' }),
  });
  assert.equal(denied.response.status, 403);

  const duplicateCategory = await request('/learning/categories', {
    method: 'POST',
    headers: auth(adminToken),
    body: JSON.stringify({
      name: ' crop   and plant production ',
      description: 'Should match the existing category despite whitespace and letter casing.',
    }),
  });
  assert.equal(duplicateCategory.response.status, 409);

  const category = await request('/learning/categories', {
    method: 'POST',
    headers: auth(adminToken),
    body: JSON.stringify({ name: 'Demonstration Test Category', description: 'Temporary test category.' }),
  });
  assert.equal(category.response.status, 201);

  const resource = await request('/learning/resources', {
    method: 'POST',
    headers: auth(adminToken),
    body: JSON.stringify({
      title: 'Temporary learning guide',
      summary: 'A guide used to test administrator content management.',
      categoryId: category.body.category.id,
      content: ['First paragraph.', 'Second paragraph.'],
    }),
  });
  assert.equal(resource.response.status, 201);

  const inUse = await request(`/learning/categories/${category.body.category.id}`, {
    method: 'DELETE',
    headers: auth(adminToken),
  });
  assert.equal(inUse.response.status, 409);

  const deletedResource = await request(`/learning/resources/${resource.body.resource.id}`, {
    method: 'DELETE',
    headers: auth(adminToken),
  });
  assert.equal(deletedResource.response.status, 200);

  const deletedCategory = await request(`/learning/categories/${category.body.category.id}`, {
    method: 'DELETE',
    headers: auth(adminToken),
  });
  assert.equal(deletedCategory.response.status, 200);

  const review = await request('/learning/admin/review', { headers: auth(adminToken) });
  assert.equal(review.response.status, 200);
  assert.ok(Array.isArray(review.body.courses));
  assert.ok(Array.isArray(review.body.enrollments));
});

test('providers submit profile changes for administrator review and only manage their own participant progress', async () => {
  const providerToken = await login('provider@myagriseta.local', 'Naledi123!');
  const learnerToken = await login('learner@myagriseta.local', 'Lerato123!');
  const farmerToken = await login('farmer@myagriseta.local', 'Sipho123!');
  const adminToken = await login('admin@myagriseta.local', 'Admin123!');

  const providerData = await request('/learning/provider/me', { headers: auth(providerToken) });
  assert.equal(providerData.response.status, 200);
  const providerId = providerData.body.provider.id;
  const profileUpdate = await request('/learning/provider/profile', {
    method: 'PATCH',
    headers: auth(providerToken),
    body: JSON.stringify({
      name: providerData.body.provider.name,
      location: 'Limpopo, South Africa',
      description: 'Provider profile awaiting administrator review.',
    }),
  });
  assert.equal(profileUpdate.response.status, 200);
  assert.equal(profileUpdate.body.profileStatus, 'Pending Review');

  const deniedProfileQueue = await request('/learning/admin/providers', { headers: auth(learnerToken) });
  assert.equal(deniedProfileQueue.response.status, 403);
  const profileQueue = await request('/learning/admin/providers', { headers: auth(adminToken) });
  assert.equal(profileQueue.response.status, 200);
  assert.ok(profileQueue.body.providers.some((entry) => entry.id === providerId));

  const approvedProfile = await request(`/learning/admin/providers/${providerId}`, {
    method: 'PATCH',
    headers: auth(adminToken),
    body: JSON.stringify({ decision: 'approve' }),
  });
  assert.equal(approvedProfile.response.status, 200);
  assert.equal(approvedProfile.body.provider.status, 'published');

  const course = await createPublishedCourse('Participant Progress Test', providerToken, adminToken);
  const missingConsent = await request('/learning/enrollments', {
    method: 'POST',
    headers: auth(learnerToken),
    body: JSON.stringify({ courseId: course.id, acknowledgedDemo: true }),
  });
  assert.equal(missingConsent.response.status, 400);

  const enrollment = await request('/learning/enrollments', {
    method: 'POST',
    headers: auth(learnerToken),
    body: JSON.stringify({ courseId: course.id, acknowledgedDemo: true, shareWithProvider: true }),
  });
  assert.equal(enrollment.response.status, 201);

  const providerEnrollment = (await request('/learning/provider/me', { headers: auth(providerToken) }))
    .body.enrollments.find((entry) => entry.id === enrollment.body.enrollment.id);
  assert.equal(providerEnrollment.participant.email, 'learner@myagriseta.local');
  assert.equal(providerEnrollment.trainingProgress, 0);

  const prematureProgress = await request(`/learning/provider/enrollments/${providerEnrollment.id}/progress`, {
    method: 'PATCH',
    headers: auth(providerToken),
    body: JSON.stringify({ progress: 50 }),
  });
  assert.equal(prematureProgress.response.status, 409);

  const accepted = await request(`/learning/enrollments/${providerEnrollment.id}/status`, {
    method: 'PATCH',
    headers: auth(providerToken),
    body: JSON.stringify({ status: 'Accepted' }),
  });
  assert.equal(accepted.response.status, 200);

  const invalidProgress = await request(`/learning/provider/enrollments/${providerEnrollment.id}/progress`, {
    method: 'PATCH',
    headers: auth(providerToken),
    body: JSON.stringify({ progress: 101 }),
  });
  assert.equal(invalidProgress.response.status, 400);

  const deniedProgress = await request(`/learning/provider/enrollments/${providerEnrollment.id}/progress`, {
    method: 'PATCH',
    headers: auth(farmerToken),
    body: JSON.stringify({ progress: 50 }),
  });
  assert.equal(deniedProgress.response.status, 403);

  const updatedProgress = await request(`/learning/provider/enrollments/${providerEnrollment.id}/progress`, {
    method: 'PATCH',
    headers: auth(providerToken),
    body: JSON.stringify({ progress: 50 }),
  });
  assert.equal(updatedProgress.response.status, 200);
  assert.equal(updatedProgress.body.enrollment.trainingProgress, 50);

  const providerWithoutConsent = await request('/learning/provider/me', { headers: auth(providerToken) });
  assert.equal(providerWithoutConsent.response.status, 200);
});
