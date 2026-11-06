# API reference

This reference describes the Express API currently implemented in `server/src/server.js`. It is a prototype contract, not a promise that every endpoint is production-ready.

## Connection

- Local base URL: `http://localhost:3000`
- API base URL: `http://localhost:3000/api`
- Health check: `GET /health` (outside `/api`)
- Requests and responses use JSON unless noted otherwise.
- Authenticated requests use `Authorization: Bearer <token>`.
- Access tokens are signed JWTs and expire after eight hours.
- There is no pagination, version prefix, or documented rate limit.

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

### `GET /api/auth/roles`

Authentication required. Returns the roles and active role stored on the authenticated account:

```json
{ "availableRoles": ["administrator", "internal_staff"], "activeRole": "administrator" }
```

There is no role-switch endpoint. Attempts to call the former `POST /api/auth/switch-role` route return `404`.

### `GET /api/me`

Authentication required. Returns `{ "user": <sanitized user> }` for the current token role. Password hashes are not included. Farmer-role responses include a `farmProfile` with the account's farm name and province; role-verification references are never returned.

### `PATCH /api/me`

Authentication required. Updates only the authenticated user's own profile. Accepted optional fields are `firstName`, `lastName`, `phone`, and `organization`; farmer-role accounts may also update `farmName` (120 characters maximum) and `province` (60 characters maximum). Learner- and farmer-role accounts may also update `candidateVisible` (boolean), `candidateDesiredRole` (120 characters maximum), `candidateProvince` (60 characters maximum), and `candidateSummary` (500 characters maximum). Candidate visibility defaults to false and cannot be enabled without a desired role. Setting it to false immediately removes the profile from employer search. Send at least one field. Names are required when provided and limited to 80 characters. Phone numbers must be valid South African numbers and unique across accounts; send an empty string to clear the optional phone. Organisation is limited to 160 characters; send an empty string to clear it. Returns `{ "user": <updated sanitized user> }`.

The account ID is derived from the verified token, so request bodies cannot select another user. Email, username, roles, active role, permissions, account status, and role-verification details are not editable here. Account creation, activation, deactivation, role assignment, and account deletion remain administrator-controlled. Returns `400` for invalid fields, `401` when unauthenticated, and `409` if the phone number is already in use.

Farm profile fields are separate editable profile information; changing them does not alter the original role-verification record or its reference.

Learner/farmer `GET /api/me` responses include the account holder's own candidate-profile settings, including when visibility is off. Employer candidate discovery exposes only the first name, consented profile fields, and self-reported Skills Passport skills; contact details, account email, surname, organisation, and documents are not shared.

### `POST /api/auth/logout`

Authentication required. Returns `{ "message": "Logged out successfully." }` and revokes the token in this server process. The client also deletes its locally stored token. Revocation is held in memory and is lost when the server restarts, including when Neon is enabled.

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

Only `Published` opportunities that are open and eligible for the authenticated account's assigned role are returned. Provider listings additionally require the owning provider account to remain active and administrator-verified. A record is published only after administrator approval and publication. Listings past their application deadline are treated as closed and excluded from browsing, details, bookmarks, and applications.

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

- `GET /api/admin/opportunities` — administrator-only list, with optional `status` and `q` filters. Includes approval history and effective closed status.
- `POST /api/admin/opportunities` — create administrator-managed bursary, learnership, funding, or other opportunity content as a draft.
- `PATCH /api/admin/opportunities/:id` — administrator-only content editing and state transitions. Supported review actions: `approve`, `reject`, `request_changes`, `publish`, `unpublish`, `close`, `archive`, and `edit` where available for the current status. Rejection and change requests require a review note. `publish` is allowed only after approval; provider submissions also require an active, verified provider account. `unpublish` returns a listing to `Approved`. Editing a non-published listing returns it to `Draft`.

Important review, publication, and edit actions are recorded in the audit log and each listing retains a status history. Administrator approval does not verify a provider's accreditation or replace independent source checks.
Administrator opportunity forms also accept up to five `requiredDocuments` labels; applicants upload a file for each before submission.

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

### `GET /api/learning/providers` and `GET /api/learning/providers/:id`

Returns public provider-directory fields and associated programmes. Provider contact details and ownership identifiers are not exposed. The optional list filters are `q`, `location`, `category`, and `programmeType`. Unverified demonstration records are explicitly labelled.

### `GET /api/learning/resources` and `GET /api/learning/resources/:id`

Lists and displays in-app text guides, including general guides for crop scouting, soil and livestock observations, funding readiness, and comparing market offers. The list supports `q` and `category`. These guides are not professional, veterinary, or farm-specific advice. No live market prices, verified buyer listings, live funding feed, file downloads, or external video links are provided. `POST /api/learning/resources/:id/started` adds a guide to the authenticated user's learning list idempotently; it does not mark the guide complete.

Farmer funding, training, support, and mentorship opportunity listings must be source-attributed and expiry-dated before an administrator can approve or publish them. Farmer listing responses include source name/URL, check date, and expiry; expired listings are not returned as open. An optional `applicationUrl` must be a credential-free HTTP(S) URL. When provided, eligible users can open the organisation's application page; the separate in-app application tracker does not submit data to that organisation.

### `GET /api/learning/me`

Returns only the authenticated account's course enrolments/requests, saved courses, started guides, module progress, course progress, and certificates. Course progress records show the number of passed modules and whether all prototype modules have been completed. Certificates are not issued by this prototype.

### `GET /api/learning/enrollments/:id/coursework`

Returns the module lessons and assessment questions for the authenticated user's active demonstration enrolment. Other users receive `404`. Correct answers are never returned. Published-course requests do not receive demonstration coursework. Material and knowledge checks are prototype content, not an accredited course or formal assessment.

### `POST /api/learning/enrollments/:id/modules/:moduleId/lesson-complete`

Marks a module lesson complete for its owning learner. The assessment cannot be submitted until the lesson is marked complete.

### `POST /api/learning/enrollments/:id/modules/:moduleId/assessment`

Accepts an `answers` object keyed by question ID and option ID. The server validates all answers and calculates the score. The recommended prototype pass mark is 67% (2 of 3 answers); retries are unlimited. A module counts as passed after a successful attempt, and the course is marked complete when every module has been passed. Attempts and scores are private to the enrolled account. This is prototype knowledge-check progress only; it is not an official result, accreditation, or certificate.

### `POST /api/learning/courses/:id/saved` and `DELETE /api/learning/courses/:id/saved`

Adds or removes the current account's course bookmark. Saved courses persist with Neon enabled.

### `POST /api/learning/enrollments`

Learner, farmer, employer, and SDF accounts may enrol in or request an eligible course where enrolments are enabled. Course eligibility is checked against the assigned role on the server. Required: `courseId` and `acknowledgedDemo: true`; optional `applicantNote` is limited to 500 characters. `{ "draft": true }` saves a draft. Enrolling in a synthetic `Demonstration` course creates an account-owned `Enrolled (demo)` record, visible under `GET /api/learning/me`; it does not provide course delivery or reserve a real place. A request for an administrator-published course has `Submitted` status and still requires provider confirmation. An active duplicate returns `409`.

### `POST /api/learning/resources/:id/started`

Authentication required. Records the authenticated user's start of an existing in-app guide and returns `{ "progress": ... }`. Repeating the request returns the same record; it cannot start a guide for another account or mark it complete.

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
- `POST /api/learning/resources` and `DELETE /api/learning/resources/:id` — administrator-only in-app guide management.

An administrator approving a training-provider role request creates a private provider profile for completion. An administrator must review and publish that profile before the provider's course listings can be published. Learners must explicitly consent before their name and email are shared with a provider for an enrolment request. The provider can manage the request and record progress only after accepting the learner. Providers can also submit `Training`, `Learnership`, `Training Service`, and `Training Partnership` opportunities through `/api/provider/opportunities`; eligible provider-support opportunities can be applied for through the existing application workflow. These are in-app records and are not submitted to external funders or AgriSETA.

## Skills Passport

The skills passport records learner-entered capability notes. Entries are always labeled `Self-reported · not verified`; they are not credentials, official qualifications, or independently validated skills. Only learner, farmer, SDF, administrator, and internal-staff roles can access their own passport records.

### `GET /api/passport`

Returns `{ "skills": [...], "certificates": [...] }` for the authenticated account only. Certificate records are included only if a trusted source has populated them; the prototype does not issue certificates.

### `POST /api/passport/skills`

Creates an account-owned self-reported skill. Required fields: `name` (2–80 characters) and `level` (`Foundational`, `Developing`, `Practised`, or `Advanced`). Optional `category` is limited to 60 characters and `description` to 240. A user can add up to 50 entries. The API ignores caller-supplied ownership and verification fields.

### `PATCH /api/passport/skills/:id` and `DELETE /api/passport/skills/:id`

Update or remove a skill owned by the authenticated user. Another user's or unknown skill returns `404`. The verification status cannot be set by the user and remains self-reported.

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
When `BREVO_EMAIL_ENABLED=true`, account-scoped notifications are also emailed through Brevo SMTP. Administrator decisions are emailed as soon as the application status update is processed; final decisions use an “Application approved” or “Application rejected” subject. Responses include `emailDeliveryStatus` (`pending`, `sent`, `failed`, or `disabled`) and, on failure, a safe `emailDeliveryError` for the owner's own notification. `sent` means Brevo SMTP accepted the message; it does not confirm delivery to the mailbox. In-app notifications remain available if delivery fails. SMTP delivery still depends on valid Brevo credentials, sender verification, and any required authorized-IP settings.
Notifications may include a `targetType` and `targetId` so the app can route the signed-in user to the related application, opportunity, mentor requests, or relevant section.

### `POST /api/notifications/resend-application-status`

Authentication required. Resends the signed-in account's application status notifications that have not been successfully submitted to Brevo. Messages are sent only to that account's registered email address; another account's notices cannot be selected. Returns the `sentCount` and `failedCount`. Returns `503` if Brevo email is disabled.

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
- Logout revokes the token in this server process; revocation state is in memory and resets on restart. Administrator password changes invalidate existing tokens. Self-service password reset and refresh tokens are not configured.
- Administrators assign roles based on their own approval process. Role assignment does not independently verify a user's identity or role references against official sources.
- CORS currently allows requests from any origin. Restrict it before deployment.
- The server uses a development fallback for `JWT_SECRET`; configure a strong secret outside local development.
- See [SYSTEM.md](./SYSTEM.md) for architecture, configuration, local setup, and known production blockers.
