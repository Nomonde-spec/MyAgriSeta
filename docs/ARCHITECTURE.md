# Architecture

The [visual architecture guide](./MYAGRISETA-VISUAL-ARCHITECTURE.pdf) is the seven-page workflow reference for this prototype. This document maps those flows to the current implementation and records the boundaries that must remain true as the system changes.

## System boundary

```text
Expo / React Native client
  ├─ Expo Router screens and role-aware tabs
  ├─ Auth context and API helper
  └─ Native: Expo SecureStore | Web: sessionStorage
             │ HTTPS in production; local HTTP in development
             ▼
Express API
  ├─ JWT, active-account and role checks
  ├─ Input validation, ownership and workflow rules
  ├─ Audit and account-scoped notifications
  └─ Neon PostgreSQL over verified TLS (required)
```

The client never connects directly to the database. The API resolves the user from the verified token and checks the account's active status, active role, record ownership, and workflow eligibility before reading or mutating protected data. The API currently keeps a process-local read cache, so run one API process; horizontal scaling requires cache invalidation and concurrency work.

## Roles and responsibilities

| Role | Main workflows |
|---|---|
| Learner | Find learning and opportunities, track applications, practise prototype lessons, record self-reported skills, and optionally share a candidate profile |
| Farmer | View curated market and support information, find learning, apply where eligible, and request a mentor introduction |
| Employer | Submit opportunities and training needs, find opted-in candidates, and review applicants for its own listings |
| SDF | Manage organisation-scoped skills-gap assessments, WSP activities, training cohorts, and ATR records |
| Training provider | Submit a profile and courses for review, manage its enrolments, and record progress for accepted participants |
| Administrator | Provision and review accounts, review and publish listings, curate farmer information, manage announcements, and view aggregate reports and audit records |
| Internal staff | Review applications and enrolment requests within the internal review workflow; this role does not grant administrator account or publication controls |

The API assigns roles from the trusted account record. The client may hide unavailable actions for usability but never grants permissions. SDF organisation scope is assigned by the server after approval; employee cohort data uses aggregate counts rather than named employee records.

## Core workflows

### Service directory and candidate discovery

The authenticated service directory and service-detail endpoint apply the same server-side role eligibility. Employer candidate discovery includes only learner and farmer profiles that the account holder has explicitly opted to share. Search results omit contact information, surname, organisation, and documents; invitation and application flows remain user-controlled and consent-based.

### Accounts and access

- Learners may register and access their account immediately. Farmer, employer, SDF, and provider registrations remain inactive until administrator review. Administrator and internal-staff accounts are provisioned by an administrator.
- Login returns an eight-hour JWT. Each protected request checks the account, active status, token version, active role, and relevant ownership/eligibility.
- Native tokens use Expo SecureStore; browser tokens use tab-scoped `sessionStorage`.
- Sign-out calls `POST /api/auth/logout`, revokes the token, and clears local storage even if the API call fails. The API stores only a token hash and expiry in Neon so revocation survives an API restart; a persistence failure returns an API error while keeping the in-process revocation active, and the client warns if revocation could not be confirmed.

### Opportunities and applications

Employers, SDFs, and providers can submit listings. An administrator reviews and publishes them; only published, open, role-eligible listings are available to applicants. Applicants can save a draft or submit an application with required documents and consent. The applicant sees status, feedback, and notifications; reviewers retrieve document contents only through protected routes, and reviewer document access is audited. General application review and an employer's recruitment decisions are separate workflows, and applications are not sent to external organisations.

### AgriLearn

The catalogue supports search, filters, provider and course details, private saved courses, and started informational guides. Synthetic demonstration courses use two in-app modules with lesson completion and three-question practice checks; the 67% pass mark and unlimited retries are prototype behavior, not accreditation or an official result. Demo completion does not confirm a course place. Published provider courses use enrolment requests: providers review their own requests and can record progress only for accepted participants. Contact details are shared only after consent.

### Farmer support

Administrators curate market and mentor records with attribution, consent, and expiry. Expired listings are hidden. Mentor contact details are released only after an approved introduction and while the mentor profile, sharing consent, and request remain valid. External sites are referrals, not integrated feeds.

### SDF workforce planning

Approved SDF accounts can manage skills-gap assessments, WSP activities, training cohorts, and ATR records only within their assigned organisation. These are working records; they do not submit official forms or external reports. Workforce planning stores aggregate employee counts, not employee names or contact details.

### Notifications and administration

Workflow events create account-scoped in-app notices and audit records. Administrators can publish audience-targeted announcements and view aggregate reports that omit applicant identities. Optional Brevo email delivery is disabled unless configured; SMS, push, password reset, and official AgriSETA/government integrations are not connected.

## Data model and operational limits

Neon stores keyed JSONB records in the collections listed in [DATABASE.md](./DATABASE.md). The diagram is a logical relationship map, not a relational foreign-key specification. Startup creates the current tables and indexes and inserts missing synthetic seed records. Schema changes are not managed by a versioned migration framework.

Use synthetic accounts and content only. No official AgriSETA source, credential verification, accredited course delivery, or external application submission is connected. Complete the privacy, retention, security, backup, migration, and multi-instance reviews before production or real personal data use. See [SYSTEM.md](./SYSTEM.md), [SECURITY.md](./SECURITY.md), [API.md](./API.md), and [RBAC_MATRIX.md](./RBAC_MATRIX.md) for implementation details.
