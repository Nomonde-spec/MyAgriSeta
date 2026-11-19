# API reference

This reference describes the Express API currently implemented in `server/src/server.js`. It is a prototype contract, not a promise that every endpoint is production-ready.

## Connection

- Local base URL: `http://localhost:3000`
- API base URL: `http://localhost:3000/api`
- Health check: `GET /health` (outside `/api`)
- Requests and responses use JSON unless noted otherwise.
- Authenticated requests use `Authorization: Bearer <token>`.
- Access tokens are signed JWTs and expire after eight hours.
- Login and registration are limited to eight attempts per IP-and-identifier key per 15 minutes in each API process; this in-memory limit is skipped in automated tests and is not shared across instances.
- There is no pagination or version prefix.

## Roles

The backend recognizes `learner`, `farmer`, `employer`, `sdf`, `training_provider`, `administrator`, and `internal_staff`. People can self-register for one public role: `learner`, `farmer`, `employer`, `sdf`, or `training_provider`. Administrator and internal-staff roles cannot be self-selected. The account record determines the active role; users cannot switch roles.

## Common responses

Explicit API errors use this shape:

```json
{ "message": "A human-readable explanation." }
```

Common status codes are `400` for invalid or missing request data, `401` for a missing or invalid session, `403` for a disallowed action, `404` for a missing route or record, `409` for a conflicting request, and `500` for an unexpected server or configured-storage error. Unexpected errors return a generic JSON message; sensitive error details are not sent to clients.

## Health

### `GET /health`

Public liveness response:

```json
{ "status": "ok", "service": "myagriseta-backend", "storage": "neon" }
```

When Neon is available, the endpoint returns `200` with `"storage": "neon"`. If the database is unavailable, it returns `503` with `"storage": "unavailable"`. The server does not start without Neon.

## Authentication and current user

### `POST /api/auth/register`

Public self-registration endpoint. Required fields: `firstName`, `lastName`, `email`, `username`, `password`, and `role`. Allowed roles are `learner`, `farmer`, `employer`, `sdf`, and `training_provider`; administrator and internal-staff roles cannot be self-assigned. Optional `phone` must be a South African phone number. Passwords must be at least eight characters and no more than 72 UTF-8 bytes.

Learner registration does not require `verificationDetails`; the account is created active and approved, and the user may sign in immediately. Learner registration rejects institution/student identifiers. Farmer, employer, SDF, and training-provider roles require their corresponding reference fields; these accounts are created inactive with `roleVerificationStatus: "pending"` and must be reviewed by an administrator before sign-in. These submitted role details are claims and are not independently verified against official sources. The endpoint returns `201` for learners and `202` for other role requests. Returns `400` for invalid input and `409` for duplicate contact details or role references. Passwords are bcrypt-hashed, and account creation is audited/persisted in Neon.

### `POST /api/auth/login`

Public. Authenticates with an email address, username, or South African phone number.

Request:

```json
{
  "identifier": "learner@example.test",
  "password": "your-password"
}
```

Success (`200`) returns a signed token, a sanitized user, and the account's assigned roles:

```json
{
  "token": "<jwt>",
  "user": {
    "id": "usr-example",
    "firstName": "Example",
    "lastName": "User",
    "email": "learner@example.test",
    "username": "learner",
    "phone": "+27123456789",
    "organization": "Example organisation",
    "roles": ["learner"],
    "status": "active",
    "activeRole": "learner",
    "permissions": ["view_profile", "view_services"]
  },
  "availableRoles": ["learner"],
  "activeRole": "learner"
}
```

Returns `400` if the identifier or password is missing, `401` for invalid credentials or an inactive account, and `403` while a role request is pending or rejected.

### `POST /api/auth/password-reset/request`

Public, rate-limited. Body: `{ "email": "name@example.co.za" }`. Always returns `200` with the same message whether or not an active account uses that email, so it cannot be used to find accounts. For an active account it emails a reset link and code through Brevo. Only a SHA-256 hash of the code is stored, it expires after 30 minutes, and a new one can be issued every 60 seconds. Returns `400` for an invalid email and `503` when Brevo email is not enabled.

### `POST /api/auth/password-reset/confirm`

Public, rate-limited. Body: `{ "token": "<64-character reset code>", "password": "new password" }`. Sets a new bcrypt-hashed password, makes the code unusable, invalidates all existing tokens for the account, and writes an audit entry. Returns `200` on success. Returns `400` with the same message for invalid, used, or expired codes, and `400` if the password is shorter than 8 characters or longer than 72 UTF-8 bytes.

### `GET /api/auth/roles`

Authentication required. Returns the roles and active role stored on the authenticated account:

```json
{ "availableRoles": ["administrator", "internal_staff"], "activeRole": "administrator" }
```

There is no role-switch endpoint. Attempts to call the former `POST /api/auth/switch-role` route return `404`.

### `GET /api/me`

Authentication required. Returns `{ "user": <sanitized user> }` for the current token role. Password hashes are not included. Farmer-role responses include a `farmProfile` with the account's farm name and province; role-verification references are never returned.

### `PATCH /api/me`

Authentication required. Updates only the authenticated user's own profile. Accepted optional fields are `firstName`, `lastName`, `phone`, and `organization`; farmer-role accounts may also update `farmName` (120 characters maximum) and `province` (60 characters maximum). Learner- and farmer-role accounts may also update `candidateVisible` (boolean), `candidatePassportVisible` (boolean), `candidateDesiredRole` (120 characters maximum), `candidateProvince` (60 characters maximum), and `candidateSummary` (500 characters maximum). Candidate visibility defaults to false and cannot be enabled without a desired role. Setting it to false immediately removes the profile from employer search and revokes Passport-sharing consent. Passport sharing is a separate, optional consent and requires candidate visibility. Send at least one field. Names are required when provided and limited to 80 characters. Phone numbers must be valid South African numbers and unique across accounts; send an empty string to clear the optional phone. Organisation is limited to 160 characters; send an empty string to clear it. Returns `{ "user": <updated sanitized user> }`.

The account ID is derived from the verified token, so request bodies cannot select another user. Email, username, roles, active role, permissions, account status, and role-verification details are not editable here. Account creation, activation, deactivation, role assignment, and account deletion remain administrator-controlled. Returns `400` for invalid fields, `401` when unauthenticated, and `409` if the phone number is already in use.

Farm profile fields are separate editable profile information; changing them does not alter the original role-verification record or its reference.

Learner/farmer `GET /api/me` responses include the account holder's own candidate-profile settings, including when visibility is off. Employer candidate discovery exposes only the first name, consented profile fields, and self-reported Skills Passport skills; contact details, account email, surname, organisation, and documents are not shared. Applicants separately control employer access to their Passport during eligible applications.

### `POST /api/auth/logout`

Authentication required. Returns `{ "message": "Logged out successfully." }`, revokes the presented token immediately in the API process, and stores only its SHA-256 hash and expiry in Neon so the revocation survives an API restart. If durable persistence fails, the request returns an error while the in-process revocation remains active. The client calls this endpoint and deletes its local token even if the request fails. If the API cannot confirm revocation, the client still signs out locally and warns that the token may remain valid until expiry.

## Assessor workflow

All assessor endpoints require an authenticated account whose server-side active role is `assessor`. Assignment and learner responses are scoped to the assessor's assigned records.

- `GET /api/assessor/dashboard` — returns database-backed counts for assigned learners, pending, scheduled, completed, awaiting-verification, competent, and not-yet-competent assessments, plus recent activity and upcoming schedules.
- `GET /api/assessor/profile` and `PATCH /api/assessor/profile` — read or update permitted qualifications and registration reference. Accreditation status is not self-editable.
- `GET /api/assessor/learners` — returns only learners linked to the assessor's assignments.
- `GET /api/assessor/criteria` — returns criteria configured on the assessor's assignments.
- `GET /api/assessor/assignments` — returns the assessor's assigned assessment records.
- `PATCH /api/assessor/assignments/:id` — saves a draft or submits an assessment. Supported outcomes are `Competent`, `Not Yet Competent`, `Pending Assessment`, and `Assessment Incomplete`. Submitted records move to `Awaiting Verification`; scores must be between 0 and 100 when supplied. Evidence metadata accepts PDF, JPEG, or PNG files up to 5 MB.
- `GET /api/learner/assessments` — returns only the authenticated learner's submitted assessment records and excludes internal report text.
- `GET /api/admin/assessment-verifications` and `PATCH /api/admin/assessment-verifications/:id` — administrator or internal staff verification queue and decisions (`Verified` or `Changes Requested`). Assessors cannot verify their own records.

## Dashboards and directory

### `GET /api/dashboard`

Authentication required. Returns a role-tailored dashboard:

```json
{
  "userRole": "learner",
  "title": "Learner dashboard",
  "description": "Track your applications and find learning opportunities.",
  "metrics": [{ "label": "My applications", "value": 0 }],
  "sections": [
    {
      "title": "Learning services",
      "emptyState": "No services are currently available for your role.",
      "items": [{ "id": "svc-1", "title": "Example service", "body": "Description" }]
    }
  ]
}
```

Dashboard sections and metrics are derived from seeded content loaded into the API process. Administrator and internal-staff accounts receive management/review summaries; other roles receive services, opportunities, and their own applications.

The Farmer hub links to in-app agricultural guides, eligible training listings, funding and business-support opportunities, mentorship-interest examples, the farm profile, and application tracking. Farmer funding, business-support, and mentorship entries are synthetic demonstrations; applying records an in-app application only and does not contact an external organisation. The market-planning information is general guidance, not live price or buyer data.

### `GET /api/services`

Authentication required. Returns `{ "services": [...] }` filtered to the active role. Administrator and internal-staff roles receive all seeded services.

The seed directory includes the eleven proposed AgriConnect 360 service areas. These entries are informational prototypes; the three additional programme examples are synthetic demonstration data. None of the entries represents an official listing or a connected external system.

### `GET /api/services/:id`

Authentication required. Returns `{ "service": <service> }` only when the active account role is eligible; inaccessible and unknown services return the same `404`.
Service records may include `requiredDocuments`; only an administrator can change them.

### `PATCH /api/admin/services/:id/requirements`

Administrator role required. Accepts up to five distinct document requirement labels:

```json
{ "requiredDocuments": ["CV or work history", "Training plan"] }
```

Labels must be 160 characters or fewer. Identity/passport, bank-account, and biometric document requirements are rejected. Service applications are accepted only while the service status is `open`.

### `GET /api/opportunities`

Authentication required. Returns `{ "opportunities": [...], "serverDate": "..." }`. Query parameters are optional:

- `q`: case-insensitive search across title, category, type, description, and target role.
- `category`: exact category match.
- `audience`: assigned target role (for example `farmer` or `learner`).
- `status`: `Open` or `Closed`.
- `sort`: `deadline` (default; undated opportunities sort last), `title`, or `newest`.

Published opportunities that are open or upcoming and eligible for the authenticated account's assigned role are returned. Upcoming listings are visible before their application opening date, but applications are accepted only while the application period is open. Provider listings additionally require the owning provider account to remain active and administrator-verified. A record is published only after administrator approval and publication. Listings past their application deadline are treated as closed and excluded from browsing, details, bookmarks, and applications.

The development server includes clearly labeled synthetic learner examples for funding, learnership, internship, and job discovery. These records exist only to exercise in-app search and application tracking; they are not real offers, employers, deadlines, or official programme data. No external official data source is connected.

### `GET /api/opportunities/:id`

Authentication required. Returns `{ "opportunity": <opportunity> }`, including a `saved` flag for the current account. Unknown IDs return `404`.

### `GET /api/opportunities/saved`

Authentication required. Returns `{ "opportunities": [...] }` saved by the authenticated account.

### `POST /api/opportunities/:id/saved` and `DELETE /api/opportunities/:id/saved`

Authentication required. Add or remove the current account's bookmark. `POST` returns `201` for a new saved item and `200` if it was already saved. Saved records persist when Neon is enabled; otherwise they reset when the server restarts.

### Opportunities Management: stakeholder submissions

- `GET /api/employer/opportunities` — employer-only list of the signed-in employer's own submissions, with an `effectiveStatus` that reflects deadline/expiry for published listings.
- `POST /api/employer/opportunities` — create a job, internship, workplace-opportunity, or employee-training-need listing. Send `action: "draft"` to save a draft or `action: "submit"` to send it for review. Job/workplace submissions require a title, description, location, employment type, qualifications, at least one requirement, a future `closingDate` (`YYYY-MM-DD`), and application instructions. Training needs require a target audience (`training_provider` or `sdf`), objectives, priority skills, employee count, programme dates, location, a future deadline, and response instructions. Organisation and contact email are taken from the authenticated account.
- `PATCH /api/employer/opportunities/:id` — edit the employer's own draft, pending, or rejected listing by sending its fields and `action: "draft"` or `"submit"`. Send `action: "withdraw"` to archive it. Published or archived records cannot be edited.
- `GET /api/employer/applications` — lists submitted candidates only for the signed-in employer's own job, internship, workplace-opportunity, and training-need listings. Candidate details are returned only to the listing owner; the read is audited.
- `GET /api/employer/candidates?q=<text>&province=<province>` — employer-only search of active learner/farmer accounts that explicitly opted into discovery. Searches desired role, province, short summary, and self-reported Skills Passport skills; results are capped at 50 and each search is audited. Contact details and documents are never returned.
- `POST /api/employer/candidates/:candidateId/invitations` — invite an opted-in candidate to consider an open job, internship, or workplace-opportunity listing owned by the employer. The candidate receives an in-app notification and decides whether to apply. Training needs cannot be used for candidate invitations. Duplicate invitations for the same candidate/listing by the same employer return `409`; an opted-out candidate or unavailable listing returns `404`.
- `PATCH /api/employer/applications/:id/status` — the listing owner can update an active candidate to `Under Review`, `Shortlisted`, `Interview`, `Hired`, `Unsuccessful`, or `Rejected`, with optional feedback (up to 500 characters). Applicants receive an in-app notification and can see the status and feedback in their application tracker. Other employers and roles cannot update the record.
- `GET /api/sdf/opportunities` — SDF-only list of the signed-in SDF's own submissions.
- `POST /api/sdf/opportunities` — submit a `Skills Development`, `Training Need`, `Training`, `Learnership`, `Funding`, or `Training Partnership` opportunity. `action` may be `"draft"` or `"submit"`. Submission requires an eligible audience, title, description, location, organisation on the authenticated account, application instructions, future deadline (`YYYY-MM-DD`), training objectives, at least one requirement and required skill, participant count, and start/end dates.
- `PATCH /api/sdf/opportunities/:id` — edit the SDF's own editable submission, resubmit it after requested changes, or withdraw it with `action: "withdraw"`.
- `GET /api/sdf/workforce` — returns skills assessments, WSP activities, ATR records, and training cohorts for the signed-in SDF's verified organisation only; reads are audited.
- `POST /api/sdf/workforce` — create an organisation record with `type: "assessment" | "wsp" | "atr" | "training"`. Assessment records capture a dated skill gap, employee group/headcount, current/target levels (1–5), priority, and proposed intervention. WSP records capture an objective, intervention, skills, participant count, delivery method, planned dates, estimated ZAR cost, and optional same-organisation `assessmentId`. ATR records capture planned/actual/completed participant counts, actual ZAR expenditure, outcomes, and optional same-organisation `wspId`. Training cohort records capture an employee group/headcount, skills, trainer/provider, delivery, dates, and optional WSP link.
- `PATCH /api/sdf/workforce/:id` — update an organisation-owned draft assessment/WSP/ATR record, submitting it with `action: "submit"` (submitted records are read-only); or move an organisation-owned training cohort through `Planned → Scheduled → In Progress → Completed` or to `Cancelled`. Cohort counts cannot exceed its recorded headcount. Submitted WSP/ATR/assessment records are submitted to MyAgriSETA only; no external AgriSETA submission integration is connected.
- `GET /api/provider/opportunities` — training-provider-only list of the signed-in provider's own submissions.
- `POST /api/provider/opportunities` — submit a `Training`, `Learnership`, `Training Service`, or `Training Partnership` listing. `action` may be `"draft"` or `"submit"`. Submission requires a title, description, eligible audience, location, organisation on the authenticated account, a future `closingDate` (`YYYY-MM-DD`), application instructions, learning outcomes, entry requirements, accreditation information, duration, delivery method (`Online`, `Physical`, or `Hybrid`), programme dates, and learner capacity.
- `PATCH /api/provider/opportunities/:id` — edit the provider's own editable submission, resubmit it after requested changes, or withdraw it with `action: "withdraw"`.

SDF and provider submissions start as private `Pending Approval` records; employer listings use `Pending Review` for compatibility. Only an administrator can approve, reject, request changes, and publish. A provider listing can be published only while its owner account is active and administrator-verified. Each submitter can view/edit only their own editable submissions and cannot approve or publish them. Organisation and contact email are taken from the authenticated account, not the submitted request.

Workforce records require an active, administrator-approved SDF account. The organisation scope is derived server-side from the administrator-approved organisation name and work-email domain; the editable profile organisation field is not used for access control. Approved SDF accounts with the same verified organisation/domain share records, while unrelated organisations cannot read or modify them. Records use employee-group counts and do not accept employee names or contact/identity data. These planning records are not official AgriSETA WSP/ATR forms, are not transmitted to AgriSETA, and must be checked against current official requirements before external use.

Non-employer submissions may include up to five supporting documents (PDF, JPG, or PNG; 2 MB per file and 5 MB total). Contents are withheld from applicant and stakeholder list responses; administrators retrieve them through `GET /api/admin/opportunities/:id/documents/:documentId`, with access recorded in the audit log. Listings may specify up to five `requiredDocuments` labels. Applicants must upload one matching document for each label. Public opportunity responses omit owner identifiers, submitter details, contact email, and supporting files.

Role eligibility is enforced against the authenticated account on browse, detail, and application endpoints. For recruitment, employers can review only candidates who applied to their own published listing. Separately, learner/farmer accounts can opt into a limited candidate search profile and withdraw it at any time. Employers can search those profiles and invite candidates to consider their open listings; invitations do not share contact information and the candidate must choose whether to apply. Candidate search access is audited. The application form explicitly obtains consent to share recruitment details with the employer and platform reviewers. Employer access to applicant files is restricted to their own listings and audited. Textual qualifications and requirements are disclosed to applicants for their consideration and administrator review; the prototype does not independently verify applicant credentials or external provider accreditation.

Employer funding and training support is not connected to a live funder feed. The app links to AgriSETA's official [Discretionary Grant Funding information](https://www.agriseta.co.za/discretionary-grant-funding/) page; employers must confirm current dates, eligibility, and instructions at the source. MyAgriSETA does not transmit account data or submit external grant applications.

### Administrator opportunity management

- `GET /api/admin/opportunities` — administrator-only list, with optional `status` and `q` filters. Includes approval history, effective closed status, and counts of non-draft, non-withdrawn applications.
- `GET /api/admin/opportunities/:id/applications` — administrator-only applicant list for a published opportunity. Returns applicant name, application reference, submitted date, and status; access is audited. Contact details, application answers, and documents are not included.
- `POST /api/admin/opportunities` — create administrator-managed opportunity content. Omit `action` or use `"draft"` to save a draft; use `"approve"` to create an approved listing that still requires the separate `publish` action. The expanded form may include category-specific `opportunityDetails`, `eligibilityCriteria`, `applicationConfiguration`, and up to 20 `applicationQuestions`.
- `PATCH /api/admin/opportunities/:id` — administrator-only content editing and state transitions. Supported review actions: `approve`, `reject`, `request_changes`, `publish`, `unpublish`, `close`, `archive`, and `edit` where available for the current status. Rejection and change requests require a review note. `publish` is allowed only after approval; provider submissions also require an active, verified provider account. `unpublish` returns a listing to `Approved`. Editing a non-published listing returns it to `Draft`.

Important review, publication, and edit actions are recorded in the audit log and each listing retains a status history. Administrator approval does not verify a provider's accreditation or replace independent source checks.
The mobile administrator form has seven steps for basic information, category details, eligibility, application setup, required documents, review settings, and preview. It preserves entries when moving between steps and supports saving incomplete drafts. Approval requires complete core fields and category details when the expanded form is used. Application opening dates are enforced before applicants can apply.

`applicationConfiguration` supports an opening date, maximum application count, applicant information requirements, terms, draft/edit/withdraw settings, and private review instructions. Public opportunity responses omit reviewer department and review instructions. `applicationQuestions` supports short/long text, dropdown, multiple choice, checkboxes, date, and number answers; answers are validated against the published question schema. Up to five `requiredDocuments` labels can be configured; applicants must upload each required file before submission. Document uploads are limited to PDF, JPG, or PNG, 2 MB per file and 5 MB total.

## AgriLearn

All AgriLearn routes require authentication. Course, provider, and programme seed entries are synthetic demonstrations: provider verification and accreditation are not confirmed, and catalogue presence is not a promise of availability.

### `GET /api/learning/categories`

Returns `{ "categories": [...] }` for the eight agricultural learning categories.

### `GET /api/learning/courses`

Returns administrator-published listings and the explicitly labeled synthetic `Demonstration` seed courses, filtered by optional query parameters: `q`, `category` (category ID), `provider` (provider ID), `location` (substring), `deliveryMethod`, `duration` (substring), `availability` (`Demonstration` or `Published`), `programmeType`, and `sort` (`newest`, `name`, or `duration`). Draft, pending, approved-but-unpublished, rejected, and archived provider submissions are not returned.

### `GET /api/learning/courses/:id`

Returns course details, the current account's saved state, and its own existing enrolment record or request if present.

### `GET /api/learning/programmes`

Returns the programme types and counts from visible course listings.

### Administrator Learning Programme Management

- `GET /api/learning/admin/dashboard` — administrator-only current programme, enrolment, completion, and recent assigned-material summary.
- `POST /api/learning/admin/programmes` — administrator-only programme creation using an active provider record, category, programme type, eligible roles, dates, facilitator, and optional capacity. The programme may be created as `Draft` or published immediately. These records use the existing course catalogue and database collection.
- `PATCH /api/learning/admin/programmes/:id` — administrator-only `{ "action": "publish" | "unpublish" | "archive" }` for administrator-managed programmes. A programme with active enrolments cannot be unpublished.
- `POST /api/learning/admin/enrollments` — retired; administrators receive `403`. Administrators publish programmes, and eligible users submit their own enrolment requests using `POST /api/learning/enrollments`. Published administrator-managed programmes enable enrolment for eligible roles; capacity and duplicate requests are checked by the server.
- `PATCH /api/learning/admin/enrollments/:id` — administrator-only `{ "action": "withdraw", "reason": "..." }`; requires a 5–500 character reason, records the status history and audit event, notifies the learner, and revokes access to programme-assigned materials.

### `GET /api/learning/providers` and `GET /api/learning/providers/:id`

Returns public provider-directory fields and associated programmes. Provider contact details and ownership identifiers are not exposed. The optional list filters are `q`, `location`, `category`, and `programmeType`. Unverified demonstration records are explicitly labelled.

### `GET /api/learning/resources` and `GET /api/learning/resources/:id`

Lists and displays learning materials for authenticated users. The list supports `q`, `category`, `programmeType`, and `programmeId`; catalogue responses include file metadata only. Administrator list responses additionally include basic linked programme metadata for filtering published materials in the Courses view; this metadata is not returned to other roles. Resource details include text content and file metadata, but never file bytes. Draft materials are visible only to administrators. Materials assigned to an administrator-managed programme are visible only to its active enrollees (and administrators); the same access check applies to direct resource, attachment, and started-resource requests. Administrator-published files are limited to PDF, JPG, and PNG, up to 2 MB per file. These materials are not professional, veterinary, or farm-specific advice. `GET /api/learning/resources/:id/attachment` returns the attached file only to an authorized account. `POST /api/learning/resources/:id/started` adds the material to the authenticated user's learning list idempotently; it does not mark the material complete.

Farmer funding, training, support, and mentorship opportunity listings must be source-attributed and expiry-dated before an administrator can approve or publish them. Farmer listing responses include source name/URL, check date, and expiry; expired listings are not returned as open. An optional `applicationUrl` must be a credential-free HTTP(S) URL. When provided, eligible users can open the organisation's application page; the separate in-app application tracker does not submit data to that organisation.

### `GET /api/learning/me`

Returns only the authenticated account's course enrolments/requests, saved courses, started guides, module progress, course progress, and certificates. For the administrator active role, learning lists are empty. Course progress records show the number of passed modules and whether all prototype modules have been completed. Certificates are not issued by this prototype.

### `GET /api/learning/enrollments/:id/coursework`

Returns the module lessons and assessment questions for the authenticated user's active demonstration enrolment. Other users receive `404`. Correct answers are never returned. Published-course requests do not receive demonstration coursework. Material and knowledge checks are prototype content, not an accredited course or formal assessment.

### `POST /api/learning/enrollments/:id/modules/:moduleId/lesson-complete`

Marks a module lesson complete for its owning learner. The assessment cannot be submitted until the lesson is marked complete.

### `POST /api/learning/enrollments/:id/modules/:moduleId/assessment`

Accepts an `answers` object keyed by question ID and option ID. The server validates all answers and calculates the score. The recommended prototype pass mark is 67% (2 of 3 answers); retries are unlimited. A module counts as passed after a successful attempt, and the course is marked complete when every module has been passed. Attempts and scores are private to the enrolled account. This is prototype knowledge-check progress only; it is not an official result, accreditation, or certificate.

### `POST /api/learning/courses/:id/saved` and `DELETE /api/learning/courses/:id/saved`

Adds or removes the current account's course bookmark. Only learner, farmer, employer, and SDF active roles may use these endpoints; administrators receive `403`. Saved courses persist with Neon enabled.

### `POST /api/learning/enrollments`

Learner, farmer, employer, and SDF accounts may enrol in or request an eligible course where enrolments are enabled. Course eligibility is checked against the assigned role on the server. Required: `courseId` and `acknowledgedDemo: true`; optional `applicantNote` is limited to 500 characters. `{ "draft": true }` saves a draft. Enrolling in a synthetic `Demonstration` course creates an account-owned `Enrolled (demo)` record, visible under `GET /api/learning/me`; it does not provide course delivery or reserve a real place. A request for an administrator-published course has `Submitted` status and still requires provider confirmation. An active duplicate returns `409`.

### `POST /api/learning/resources/:id/started`

Authentication required. Learner, farmer, employer, and SDF active roles can record their start of an existing learning resource and receive `{ "progress": ... }`. Repeating the request returns the same record; it cannot start a resource for another account or mark it complete. Administrators receive `403` and cannot add materials to My learning.

### `POST /api/learning/resources` and `DELETE /api/learning/resources/:id`

Administrator-only learning material management. Creation requires a title, summary, category ID, and valid `programmeType`; provide one to twelve text paragraphs, an optional attached file, or both. `publicationStatus` can be `Draft` or `Published` (defaults to `Published`). To restrict material to an administrator-managed programme, include its published `programmeId`. Attached files must be PDF, JPG, or PNG, with a matching file signature, and no larger than 2 MB. Assigned material is visible only to active programme enrollees and administrators. `PATCH /api/learning/resources/:id` lets an administrator publish or unpublish a material using `{ "publicationStatus": "Published" | "Draft" }`. Creation/list/detail responses return attachment metadata only; download file bytes from the authenticated attachment endpoint. Programme publication and material publication are audited; material publication creates in-app notifications for current enrollees.

## Farmer-curated information

Farmer-only endpoints:

- `GET /api/farmer/market` returns published market records whose expiry has not passed. Each record includes commodity, grade, market, province, ZAR price/unit, observation/check dates, source name/URL, and expiry.
- `GET /api/farmer/mentors` returns active, unexpired mentor records that have recorded consent; contact details are never included in the directory.
- `POST /api/farmer/mentors/:id/requests` accepts `{ "message": "..." }` (10–500 characters). `GET /api/farmer/mentor-requests` returns only the signed-in farmer's requests and staff feedback. Mentor contact email is included only after an administrator marks the request `Connected`, and only while the profile remains active, unexpired, and consented.

Administrator-only curation:

- `GET`, `POST`, and `DELETE /api/admin/farmer-data/market` (delete uses `/:id`) manage sourced market records. Creation validates HTTP(S) source URL, observation/check/expiry dates, and positive price values.
- `GET /api/admin/farmer-data/mentors` returns mentor records and requests for review. `POST` adds a source-attributed profile only when contact-sharing consent is confirmed. `DELETE /:id` archives a profile. `PATCH /api/admin/farmer-data/mentor-requests/:id` accepts `Under Review`, `Connected`, or `Declined` plus staff feedback; decisions are audited and notify the farmer.

Administrator-created farmer-facing opportunity listings in Funding, Grants, Training, Learnership, Mentorship, and Business Support require a source name, HTTP(S) source URL, source check date, and record expiry before approval/publication. Expired listings no longer appear to farmers. Source attribution records provenance; administrators remain responsible for verifying source authenticity and eligibility.

### `PATCH /api/learning/enrollments/:id`

The owning account can `{ "action": "submit" }` a draft or `{ "action": "withdraw" }` its own draft, enrolment, or request. Submitting a draft for a demonstration course changes it to `Enrolled (demo)`; other published-course drafts become `Submitted`. Other accounts receive `404`.

### `PATCH /api/learning/enrollments/:id/status`

Administrator and internal-staff roles can review enrolment requests. A training provider can review requests only for courses belonging to its assigned provider profile. Demonstration enrolments cannot be provider-reviewed. Accepted statuses are `Under Review`, `Accepted`, `Waitlisted`, and `Rejected`. Closed requests cannot be changed.

### Provider and administrator tools

- `GET /api/learning/provider/me` — assigned training-provider profile, its listings, and its course enrolment requests; participant name and email are returned only when the learner consented to share them.
- `PATCH /api/learning/provider/profile` — submit provider name, location, and description for administrator review. Changes do not become public until approved.
- `POST /api/learning/provider/courses` — create a provider-owned course draft or submit it for administrator review. Listings can include programme entry requirements/prerequisites.
- `PATCH /api/learning/provider/courses/:id` — edit the provider's own draft, pending, or rejected listing and save it as a draft or resubmit it. Published and archived listings cannot be edited.
- `PATCH /api/learning/provider/enrollments/:id/progress` — record whole-number training progress from 0 to 100 for an accepted learner on the provider's own course.
- `GET /api/learning/admin/providers` — list new provider profiles and profile changes awaiting administrator review.
- `PATCH /api/learning/admin/providers/:id` — administrator-only approve/reject of a provider profile or requested changes; decisions are audited.
- `GET /api/learning/admin/review` — submitted course listings and open requests for published courses; administrator or internal staff. Only administrators can change a course's review status.
- `PATCH /api/learning/courses/:id/status` — administrator review transitions: `Pending Review` → `Approved` or `Rejected`; `Approved` → `Published`, `Rejected`, or `Archived`; `Published` → `Approved` (unpublish) or `Archived`. Rejection requires a reason. Published courses and labeled demonstration courses appear in catalogues. Publication does not establish accreditation.
- `POST`, `PATCH`, and `DELETE /api/learning/categories` (with `/:id` for updates/deletion) — administrator-only category management. Categories in use cannot be deleted.
- `POST /api/learning/resources` and `DELETE /api/learning/resources/:id` — administrator-only programme learning material management.

An administrator approving a training-provider role request creates a private provider profile for completion. An administrator must review and publish that profile before the provider's course listings can be published. Learners must explicitly consent before their name and email are shared with a provider for an enrolment request. The provider can manage the request and record progress only after accepting the learner. Providers can also submit `Training`, `Learnership`, `Training Service`, and `Training Partnership` opportunities through `/api/provider/opportunities`; eligible provider-support opportunities can be applied for through the existing application workflow. These are in-app records and are not submitted to external funders or AgriSETA.

## Skills Passport

Learners and farmers can manage their own self-reported skills and Passport records. Submitted records can include supporting PDF, JPG, or PNG files (up to five per record, 2 MB each and 5 MB total). Uploaded files are private to the account owner and administrators; access by administrators is audited. Admin review status is not an issuer verification or official accreditation.

### `GET /api/passport`

Learner/farmer only. Returns `{ "skills": [...], "certificates": [...], "records": [...] }` for the authenticated account only. Record document metadata is returned without file content. Certificate records are included only if a trusted source has populated them; the prototype does not issue certificates.

### `GET /api/passport/me/summary`

Learner/farmer only. Returns counts of the account holder's own skills, qualifications, and credentials for the role dashboard.

### `POST /api/passport/skills`

Creates an account-owned self-reported skill. Required fields: `name` (2–80 characters) and `level` (`Foundational`, `Developing`, `Practised`, or `Advanced`). Optional `category` is limited to 60 characters and `description` to 240. A user can add up to 50 entries. The API ignores caller-supplied ownership and verification fields.

### `PATCH /api/passport/skills/:id` and `DELETE /api/passport/skills/:id`

Update or remove a skill owned by the authenticated user. Another user's or unknown skill returns `404`. The verification status cannot be set by the user and remains self-reported.

### `POST /api/passport/records`

Learner/farmer only. Creates an owned Passport record of type `qualification`, `training`, `experience`, or `achievement`. Required field: `title` (2–120 characters). Optional fields include `organisation`, `category`, `level`, `description`, `startDate`, `endDate`, `hours`, and `documents`. Dates must use valid `YYYY-MM-DD` values. Submit `action: "save"` for a draft or `action: "submit"` to enter the administrator verification queue. Users may update their own draft, rejected, or returned-for-information records by including the record `id`; only such records may be edited. A submitted record receives a generated reference and status `Pending Verification`.

### `GET /api/passport/records/:id/documents/:documentId`

Available to the record owner and administrators only. Returns a document's metadata and base64 data. Administrator access is audited. Other roles cannot retrieve supporting documents.

### `GET /api/admin/passport/verifications`

Administrator only. Returns submitted, under-review, and returned records with minimal owner identity needed for review. Each decision is retained in verification history.

### `PATCH /api/admin/passport/verifications/:id`

Administrator only. `decision` must be `verify`, `reject`, `request_information`, or `review`. Reject requires a reason; requesting information requires one or more listed requirements. The owner receives an in-app notification. These decisions document the administrator's platform review and are not an external credential verification.

### `GET /api/employer/applications/:id/passport`

Employer only. Returns limited skills, qualifications, experience, and credential metadata for an applicant on the employer's own eligible opportunity, only while the applicant has opted in to Passport sharing. Supporting documents and private notes are excluded. Access is audited. Revoking consent or candidate visibility immediately blocks retrieval.

## Applications Management

### `GET /api/applications`

Authentication required. Returns `{ "applications": [...] }` scoped to the authenticated user. Opportunity application records include a reference, status history, update timestamp, outstanding requirements, and administrator feedback.

### `POST /api/applications`

Authentication required. Creates an application for the authenticated user. Send exactly one of `serviceId` or `opportunityId`:

```json
{
  "opportunityId": "opp-1",
  "applicationData": {
    "fullName": "Applicant name",
    "email": "the-signed-in-account@example.org",
    "phone": "",
    "motivation": "A short statement of why the applicant is applying.",
    "consent": true
  },
  "documents": [{
    "requirement": "CV or work history",
    "filename": "cv.pdf",
    "mimeType": "application/pdf",
    "size": 1234,
    "data": "<base64 file contents>"
  }]
}
```

`serviceId` can be used instead of `opportunityId`. The applicant email must match the signed-in account. Motivation is 10–1,000 characters, and the applicant must confirm consent. Each required document must match a label configured on that service/opportunity.
Submitting to an employer-, SDF-, or training-provider-owned opportunity also sends an in-app notification to that listing owner.

Only PDF, JPG, and PNG files are accepted. Each file is limited to 2 MB, with up to five files and a 5 MB total per application. The server verifies file signatures, MIME type, size, and required labels. Application and document metadata are returned to the applicant and authorized reviewers; file contents are never included in application lists or review-queue responses.

Use `"draft": true` to save a completed form and its required documents as a draft; otherwise the application is submitted. A draft can later be submitted with `{ "action": "submit" }` while its target remains open and eligible. Success returns `201` and `{ "application": <application> }`. The API checks target status, active-role eligibility, and duplicate applications.

Possible errors: `400` for invalid form data or missing/invalid required uploads; `403` if the target is not eligible; `404` if the target does not exist; `409` if the target is closed or the account has already applied.

### `GET /api/applications/:id/documents/:documentId`

The applicant who owns the application, the employer that owns its opportunity, or an administrator/internal staff reviewer may retrieve an uploaded file. Other users receive `404`. Employer and staff reviewer access is recorded in the audit log. The response includes the base64 file data; do not expose or log this response.

### `PATCH /api/applications/:id`

Authentication required; the application must belong to the authenticated account. `{ "action": "submit" }` submits an eligible open draft. `{ "action": "withdraw" }` withdraws a draft or application that is not already final. Other transitions return `400`; another user's or unknown application returns `404`.

### `PATCH /api/admin/applications/:id/status`

Administrator or `internal_staff` role required. Accepts `Under Review`, `Additional Information Required`, `Approved`, `Rejected`, or `Unsuccessful`, plus optional `feedback` of up to 500 characters. Additional-information status requires one to ten non-empty requirements (each no longer than 300 characters). Status changes and feedback are returned only to the applicant and authorized reviewers, recorded in the application's status history and audit collection. Final applications cannot be changed through this endpoint.

Employer recruitment status updates use the separate `PATCH /api/employer/applications/:id/status` endpoint above; employers cannot use the administrator application-review route.

## Notifications

### `GET /api/notifications`

Authentication required. Returns shared announcements and notifications scoped to the signed-in account. User-specific workflow notices include a `canMarkRead` flag.
When `BREVO_EMAIL_ENABLED=true`, account-scoped notifications are also emailed through Brevo SMTP. Administrator decisions are emailed as soon as the application status update is processed to the applicant's registered account email; a manual retry targets the signed-in account's registered email. Final decisions use an “Application approved” or “Application rejected” subject. Responses include `emailDeliveryStatus` (`pending`, `sent`, `failed`, or `disabled`) and, on failure, a safe `emailDeliveryError` for the owner's own notification. For account-specific notifications, `emailDeliveryRecipient` shows the signed-in user's own registered email address so they can verify the destination. `sent` means the SMTP server explicitly accepted the recipient; it does not confirm delivery to the mailbox. `emailDeliveryMessageId` is generated by Nodemailer and is not a Brevo delivery-log reference. `emailDeliveryAttemptedAt` records when sending was attempted. In-app notifications remain available if delivery fails. SMTP delivery still depends on valid Brevo credentials, sender verification, and any required authorized-IP settings.
Application review emails include outstanding document or information requirements when the status is `Additional Information Required`. Demonstration notifications are labeled as samples and are not emailed.
Notifications may include a `targetType` and `targetId` so the app can route the signed-in user to the related application, opportunity, mentor requests, or relevant section.

### `POST /api/notifications/resend-email`

Authentication required. Resends the signed-in account's notifications that have not been successfully submitted to Brevo, as well as legacy notices marked sent without a Brevo message reference. A retry of a legacy notice may duplicate a message if Brevo accepted the original. Messages are sent only to that account's registered email address; another account's notices cannot be selected. Returns the `sentCount` and `failedCount`. Returns `503` if Brevo email is disabled. The legacy `/api/notifications/resend-application-status` path remains supported.

### `PATCH /api/notifications/:id/read`

Authentication required. Marks a notification delivered to the signed-in account as read. Shared announcements cannot be marked read through this endpoint.

## Administration and staff

### `GET /api/users`

Administrator role required. Returns `{ "users": [...] }` with sanitized user records.

### `POST /api/users`

Administrator role required. Provisions accounts for supported platform roles: learner, farmer, employer, SDF, training provider, administrator, and internal staff. Accounts are active by default, with optional `status: "inactive"`. The server derives permissions from assigned roles; clients cannot submit permissions. Provider-role provisioning creates a private provider profile pending completion and administrator review.

Required request fields: `firstName`, `lastName`, `email`, `username`, `password`, and a non-empty `roles` array containing only supported roles. `activeRole` may specify one of the assigned roles and otherwise defaults to the first assigned role. Email format, username characters/length, and passwords of at least eight characters and at most 72 UTF-8 bytes are validated. Optional `phone` must be a South African phone number; `organization` is limited to 160 characters and `status` must be `active` or `inactive`.

Returns `201` with `{ "user": <sanitized user> }`. Returns `400` for invalid fields, `409` for a duplicate email or username, and `403` for non-administrators. The password is bcrypt-hashed before storage. When Neon is configured, account creation and its audit entry are persisted.

### `PATCH /api/users/:id`

Administrator role required. Updates account name, email, username, South African phone number, organisation, assigned roles, active role, or password. Role permissions are always derived from the assigned active role. Passwords must be at least eight characters and no more than 72 UTF-8 bytes; they are bcrypt-hashed, and password changes invalidate existing tokens for that account. The last active administrator cannot be unassigned, and administrators cannot remove their own administrator role. Returns `{ "user": <sanitized user> }`; returns `400` for invalid fields, `404` for an unknown account, or `409` for duplicate details or administrator-safety violations.

### `GET /api/admin/role-requests`

Administrator role required. Returns pending role requests submitted by self-registered farmers, employers, SDFs, and training providers. Learner registrations are activated automatically and do not appear in this queue. Treat role-reference data as confidential and review only for the stated purpose.

### `PATCH /api/admin/role-requests/:id`

Administrator role required. Accepts `{ "decision": "approved" }`, or `{ "decision": "rejected", "note": "Reason for rejection" }`. Approval activates the account and marks its role verification approved. Rejection keeps the account inactive and records the reason. The decision, reviewer, and timestamp are written to the Neon audit log.

### `PATCH /api/users/:id/status`

Administrator role required. Request:

```json
{ "status": "inactive" }
```

Allowed values are `active` and `inactive`. Administrators cannot deactivate their own account, and the last active administrator is protected. Returns `{ "user": <sanitized user> }`; returns `400` for an invalid status, `404` for an unknown account, or `409` when deactivation would violate an administrator safety rule. When Neon is configured, status changes and their audit entries are persisted.

### `GET /api/admin/audit`

Administrator role required. Returns `{ "entries": [...] }` with optional `from`, `to` (`YYYY-MM-DD`), and `limit` (1-500) query parameters. Audit entries are persisted when Neon is configured; otherwise they reset on server restart.

### `GET /api/admin/announcements`

Administrator role required. Returns `{ "announcements": [...] }`, including draft, published, and archived announcements.

### `POST /api/admin/announcements` and `PATCH /api/admin/announcements/:id`

Administrator role required. Create or update an announcement with `title` (1-120 characters), `message` (1-2,000 characters), a non-empty `audience` array of platform roles or `"*"`, `status` (`draft`, `published`, or `archived`), and optional `startsAt`/`endsAt` timestamps. Published notifications are delivered in-app only to matching roles while within schedule; users cannot mark shared announcements read. Writes generate audit events.
With Brevo email enabled, publishing an announcement also sends it to active users whose current role matches the audience. Future `startsAt` dates schedule email dispatch while the API process is running; pending scheduled sends are restored from Neon at startup. The admin announcement response includes aggregate email-delivery status and counts, not recipient addresses.

### `GET /api/admin/reports`

Administrator role required. Returns aggregate account, opportunity, application, and administrative activity counts. Optional `from` and `to` dates use `YYYY-MM-DD`; invalid or reversed ranges return `400`. The report does not include applicant or account identities. It is an operational summary, not an export or externally verified report.

### `GET /api/staff/review-queue`

`internal_staff` or `administrator` role required. Returns `{ "applications": [...] }` for the application review interface.
The response includes application form answers and document metadata, but never document contents. Reviewers retrieve a file through the authenticated document endpoint above.

## Operational and implementation limits

- Neon PostgreSQL is the only supported database. `DATABASE_URL` is mandatory in every environment; the API startup fails if it is missing, invalid, or the database cannot be reached. Users, services, opportunities, applications (including uploaded files), bookmarks, notifications, and audit entries are stored in Neon. Configure data protection and protected backups before handling real applicant documents. Existing MongoDB data is not migrated automatically. The current API keeps a process-local read cache; run one instance only.
- Logout revokes the token in the current API process and persists its hash and expiry in Neon, so it remains revoked after restart. Revocations are loaded at startup and expired entries are removed. Administrator password changes and emailed password resets also invalidate existing tokens. Self-service password reset requires Brevo email to be enabled. Refresh tokens are not configured.
- Administrators assign roles based on their own approval process. Role assignment does not independently verify a user's identity or role references against official sources.
- CORS allows configured `CLIENT_URL` origins and the known local Expo origins outside production; set `CLIENT_URL` to the approved web origins in production.
- The server refuses to start without `JWT_SECRET` outside automated tests and requires at least 32 characters in production.
- See [SYSTEM.md](./SYSTEM.md) for architecture, configuration, local setup, and known production blockers.
