# System documentation

## 1. Purpose and status

MyAgriSETA (AgriConnect 360) is a mobile-first prototype that brings together role-aware agricultural skills and service information. The repository currently contains an Expo React Native client and an Express API. Seed content is demonstration data, not official AgriSETA information.

The application is suitable for local development and demonstrations when connected to Neon. It is not production-ready: it uses seeded demonstration accounts and has security and privacy work outstanding. No production service, government system, identity provider, or external data source is connected.

## 2. Components and request flow

```text
Expo app (mobile/src)
  ├─ Expo Router screens and tabs
  ├─ Auth context manages client session state
  ├─ API helper sends JSON and Bearer tokens
  └─ expo-secure-store on native; sessionStorage on web
         │ HTTPS in production; local HTTP for development
         ▼
Express API (server/src/server.js)
  ├─ JWT authentication and role checks
  ├─ Request handlers for dashboard, directory, applications, and administration
  ├─ Seeded development data (server/src/data.js)
  └─ Neon PostgreSQL persistence (server/src/database.js; required)
```

The client authenticates with the API and attaches the JWT to protected requests. The server verifies the token, resolves the account by its subject, and rejects inactive or unknown accounts. The API controls the account roles; a client cannot grant itself an unassigned role. The API is the only layer that reads or changes its data.

## 3. Repository map

| Path | Responsibility |
|---|---|
| `mobile/src/app/` | Expo Router login, tabs, profile, directory, opportunity, admin, and review screens |
| `mobile/src/context/auth-context.tsx` | Login, session hydration, logout, and client auth state |
| `mobile/src/lib/api.ts` | API URL, token persistence, fetch wrapper, and API error type |
| `mobile/src/theme.ts` | Shared visual theme |
| `server/src/server.js` | Express setup, authentication middleware, routes, and role checks |
| `server/src/data.js` | Seed users, services, opportunities, notifications, applications, audit entries, and role permissions |
| `server/src/learning-data.js` | Synthetic learning categories, courses, provider listings, programme types, and in-app guide examples |
| `mobile/src/app/learning.tsx` | AgriLearn course discovery, provider/resource directories, role-aware provider/admin tools, course enrolments, and started-guide tracking |
| `server/test/auth.test.js` | Node test-runner coverage for key authentication and authorization flows |
| `docs/API.md` | Implemented API endpoint reference |

## 4. Roles and access

The account roles currently recognized in code are:

- `learner`
- `farmer`
- `employer`
- `sdf`
- `training_provider`
- `administrator`
- `internal_staff`

Login obtains the active role from the server-side account record. JWTs expire after eight hours and include a server-checked account token version; changing a password invalidates previously issued tokens. Learners can self-register and sign in immediately. Farmer, employer, SDF, and training-provider self-registration requests remain inactive until administrator role verification. Administrator and internal-staff roles cannot be self-registered. Administrators can also provision accounts, assign roles, edit account details/passwords, and activate or deactivate accounts. Permissions are derived from the assigned active role, not selected by the user. Administrator-only routes require the `administrator` role; the staff review queue requires `internal_staff`. Application reads are scoped to the authenticated account.

The mobile app hides or shows tabs based on the active role for usability. This client-side presentation is not an authorization boundary; the server must remain authoritative.

## 5. Data and persistence

`server/src/data.js` and `server/src/learning-data.js` define synthetic initial accounts and content. Neon PostgreSQL is the only supported database; `DATABASE_URL` is required at startup in every environment. The API creates tables and indexes, inserts missing seed records without overwriting existing ones, and loads the database tables. Users can read and update only their own editable profile fields; those changes persist with self-registration, administrator account provisioning/updates/status, application creation/transitions, opportunity and course bookmarks, course enrolments, started-guide records, provider course submissions, category/resource changes, announcements, review status, and audit entries. Login identity, role, permissions, account status, and account deletion remain server-controlled.

Administrators can create accounts for supported platform roles, select an active role for multi-role accounts, update account details or passwords, and activate/deactivate accounts. Password updates invalidate earlier tokens. The system prevents removing an administrator's own administrator role or unassigning the final active administrator. Permissions follow the role map in `server/src/data.js`; permissions are not individually editable. The administrator workspace also manages in-app announcements by role and schedule, reviews opportunities, and displays bounded audit history plus aggregate account/opportunity/application reports. Reports omit account/applicant identities. When Brevo SMTP is enabled, account-scoped notifications and application status changes are emailed to the account address, and published announcements are emailed to active audience members. SMTP failures leave the in-app notice available and set an email-delivery status. Email remains disabled unless `BREVO_EMAIL_ENABLED=true`; SMS and password-reset emails are not configured. Historical role requests can still be reviewed. Role claims are not independently validated against external registries.

AgriLearn provides an authenticated course catalogue with server-side search/filtering, categories, programme types, provider profiles, in-app text guides, private saved courses, course enrolments, and started-guide tracking. Farmer resources cover crop planning and scouting, farm records, water use, soil observations, livestock record keeping, funding readiness, and market planning. These are general educational checklists, not professional or farm-specific advice. Farmers can view administrator-curated market records with ZAR amount/unit, grade, observation date, source attribution, check date, and expiry; expired records are hidden. The list is empty until an administrator enters source-checked data. Administrators can add and archive consented, source-attributed mentor profiles; farmers can request introductions, and administrators can review, connect, decline, and provide feedback. Mentor contact details are hidden until an administrator marks a request connected, and only while the profile remains active and both listing/contact consent remain valid. There are no pre-seeded real mentor records. Administrator-published farmer funding, training, support, and mentorship opportunities require source URL, checked date, and expiry; expired opportunities are hidden. Source attribution does not independently establish official status, eligibility, or authenticity. Funding/support application submissions stay in the app and do not automatically transmit to an external provider. The funding-readiness guide helps assess an offer but is not itself a funding offer or eligibility decision. Each of the ten synthetic demonstration courses includes two original prototype modules and three-question knowledge checks. An enrolled demo learner marks each lesson complete before taking its assessment; the server scores answers at a 67% pass mark with unlimited retries and marks the course complete when all modules pass. Progress is account-owned and persisted, but does not reserve a real course place or represent accredited delivery, a formal assessment, or an official result. Enrolment requests for published listings await provider confirmation and do not receive this demo coursework. Guides started from Resources also appear in My learning as in progress, not completed. Provider accounts approved by an administrator receive a private provider profile; the provider completes the profile and submits changes for approval before directory publication. Providers can submit course, learnership, and skills-programme listings with optional entry requirements; listings require administrator review before publication. Providers can review enrolments for their own courses, see participant contact information only after explicit learner consent, and record progress for accepted participants. Provider support and partnership opportunities remain in-app submissions/applications. No certificates, accreditation, availability, or external provider verification is invented.

Neon-enabled API instances currently hold a process-local read cache. Run one API process only; multi-instance cache invalidation and concurrent-write guarantees are not implemented. See [DATABASE.md](./DATABASE.md) for table details and limits. Existing MongoDB data is not automatically migrated. Do not store real personal information until the required privacy and security work is complete.

Employers can submit jobs, internships, workplace opportunities, and employee training needs. Training needs are routed to a selected provider or SDF audience and remain unpublished pending administrator approval. Learner/farmer accounts can explicitly opt into a limited candidate profile and withdraw it at any time. Employers can search those profiles by role, province, skills, or summary and send an in-app invitation to consider an open listing. Candidate search returns only a first name, consented profile fields, and self-reported skills; it withholds account contact details and documents. Search and applicant-file access are audited. Candidates decide whether to apply, at which point the employer can review that application's details. The listing owner can update recruitment status and send feedback through applicant notifications; employers cannot access or change applications for another organisation's listings. There is no live funder feed: the employer workspace links to AgriSETA's official [Discretionary Grant Funding information](https://www.agriseta.co.za/discretionary-grant-funding/) page. Current windows and eligibility must be checked there, and the external application is completed outside MyAgriSETA.

Approved SDF accounts can create organisation-scoped skills-gap records, WSP activity drafts/submissions, ATR activity reports, and training cohorts. WSP activities can link to skills assessments; ATR reports and cohorts can link to WSP activities. Training cohorts track planned/scheduled/in-progress/completed/cancelled status and aggregate completion counts. SDF programme/opportunity submissions remain under administrator review, while eligible applications are tracked in-app. Records use employee-group counts rather than employee personal details. Organisation access is derived from the administrator-approved organisation name and work-email domain, not the user-editable profile organisation. The WSP/ATR summary can be shared from the mobile app, but these are not official AgriSETA forms or external submissions; no AgriSETA reporting or funding system is integrated.

## 6. Configuration and local development

### API

1. Install Node.js and npm.
2. In `server/`, install dependencies with `npm install`.
3. Copy `server/.env.example` to `server/.env` and set a unique, long `JWT_SECRET`. Keep `.env` local and out of version control.
4. Configure `DATABASE_URL` with the Neon connection string for persistence. A missing URL uses ephemeral storage in local development and prevents production startup.
5. Start the API with `npm start` (or `npm run dev` for nodemon).
6. Check `http://localhost:3000/health` and confirm the `storage` field.

The server reads:

| Variable | Purpose | Local default / guidance |
|---|---|---|
| `PORT` | HTTP listen port | `3000` |
| `JWT_SECRET` | Signs and verifies access tokens | Must be explicitly set to a strong random value outside disposable local development; source currently has a development fallback |
| `DATABASE_URL` | Neon PostgreSQL connection string | Required in every environment; the API refuses to start without a valid Neon endpoint |
| `CLIENT_URL` | Listed in `.env.example` as the client origin | The current CORS configuration does not use this variable and accepts any origin |

### Mobile app

In a separate terminal, install dependencies in `mobile/` and run `npm run dev`. The root `npm run dev` also starts the Expo client. `EXPO_PUBLIC_API_URL` overrides the API base URL; its default is `http://localhost:3000/api`. For a physical device, use a development-machine address reachable from the device instead of `localhost`. Use HTTPS for deployed environments.

The repository does not currently include `mobile/.env.example`; do not follow instructions that assume it exists.

### Tests

From `server/`, run `npm test`. Tests use Node's built-in test runner and start the Express app on a temporary local port.

## 7. API and client behavior

The full route list, request bodies, response envelopes, and endpoint-specific caveats are documented in [API.md](./API.md). Key behaviors:

- Learners can self-register and sign in immediately. Other public stakeholder role requests remain inactive until administrator verification; administrators can also provision accounts, assign roles, update account details/passwords, and manage account status. Permissions derive from the server-side active role.
- Administrator and internal-staff roles cannot be self-registered. Historical role requests can still be reviewed by administrators.
- Neon PostgreSQL is the only supported database; `DATABASE_URL` is mandatory in every environment. Startup fails rather than falling back to memory.
- Role assignment does not independently verify identity or role claims against official sources. Email verification, external identity/registry integrations, and login rate limiting are not configured.
- On Neon startup, identifiable legacy self-registered accounts are made inactive and placed in the admin review queue; other pre-existing accounts without a matching audit entry require a manual account audit.
- The client stores native tokens with Expo SecureStore and web tokens in tab-scoped `sessionStorage`.
- Client logout deletes its local token and the API revokes it in the current process. The in-memory revocation list is lost on server restart.
- Published announcements are filtered by audience and schedule; individual workflow notifications are scoped to the intended account.
- Service listings and details enforce role eligibility.

## 8. Security, privacy, and production readiness

Before any real-user or production use, address at least the following:

1. Add multi-instance cache consistency, a versioned migration process, and tested backup/recovery for Neon.
2. Remove the development JWT fallback, rotate secrets through managed configuration, and add appropriate token revocation/refresh and password-reset flows.
3. Restrict CORS to explicitly approved origins; use HTTPS and production-safe deployment settings.
4. Apply consistent authorization to detail and mutation handlers, and add automated negative tests for role and ownership boundaries.
5. Scope notifications to their intended audience and implement read/unread state if required.
6. Record security-relevant administrative actions in durable audit storage. Prevent removal/deactivation of the last active administrator.
7. Add request validation, abuse controls such as login rate limiting, and operational logging/monitoring that avoids credentials and unnecessary personal data.
8. Complete a POPIA-oriented privacy review, retention/access policy, and security assessment before using personal data.

Password reset, document uploads, persistent notification read-state, and external integrations are not implemented. SDF WSP/ATR records are in-app working records only and do not submit official forms or funding applications. Seed content and dashboard metrics must not be presented as live official information. External integrations require approved sources, credentials, consent where applicable, and documented safeguards.

The Farmer hub links to official information pages for ARC, AgriSETA, NAMC, and Land Bank. These are external referrals, not live feeds. Administrators may attach an HTTP(S) application-page URL to a sourced opportunity; the Farmer screen opens it separately from the optional MyAgriSETA tracking form. The tracking form does not submit information to an external organisation.

## 9. Related documents

- [API reference](./API.md)
- [30-day project tracker](./PROJECT-TRACKER-30-DAYS.md)
- [Security and privacy notes](./SECURITY.md)
- [Architecture notes](./ARCHITECTURE.md)
- [Database notes](./DATABASE.md)
- [Deployment guidance](./DEPLOYMENT.md)
