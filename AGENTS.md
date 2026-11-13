# AGENTS.md - A1 MyAgriSETA (AgriConnect 360)

## 1. Project Overview

**Project:** A1 - MyAgriSETA / AgriConnect 360  
**Purpose:** Build a secure, role-based digital platform that brings AgriSETA-related agricultural skills development, learning, opportunities, employers, training providers, support services, and impact information into one place.

The platform should help stakeholders discover and access relevant services through one consistent experience. It must be implemented as a working application, not merely a collection of static mock-ups.

**Primary audience / roles:** Learner, Farmer, Employer, Skills Development Facilitator (SDF), Training Provider, Administrator.

Use South African examples and South African Rand (ZAR) where currency is relevant. Keep wording clear, accessible, and suitable for a broad range of digital-literacy levels.

## 2. Core Product Rules

1. **Administrator-controlled accounts:** Users must not self-register. An administrator creates or provisions user accounts.
2. **Credential-based access:** Determine a user's role from the authenticated account and trusted server-side user record. Do not allow users to choose or change their own role during login.
3. **Enforce authorisation on the server:** Hiding a screen or button is not security. Protect API endpoints, data access, and restricted actions using role-based access control (RBAC).
4. **No role-switching bypass:** Do not implement a user-facing role switcher that grants another role. A user can access only the role and permissions assigned to their account. Any administrative reassignment must be an authorised admin action and must be audited.
5. **Connected experience:** Navigation, forms, buttons, filters, and dashboards should work and reflect application state. Do not create dead-end controls or claim a feature is complete when it is only a visual placeholder.
6. **Privacy and security:** Collect only data required for a defined function. Protect personal information, apply least-privilege access, and design with South Africa's POPIA requirements in mind.
7. **Accessible and responsive UI:** Aim for WCAG 2.2 AA-oriented practices, readable typography, keyboard access, clear focus states, appropriate contrast, labels, and useful validation messages.
8. **Honest status:** Clearly distinguish implemented functionality from mock data, unfinished work, and integrations that require external credentials or approval.

## 3. In Scope

Implement the following as the agreed core scope. If a feature depends on a third-party service, provide a documented integration boundary and a safe development fallback rather than pretending the integration is live.

### 3.1 Authentication and Account Administration

- Login and logout.
- Secure password handling using a recognised password-hashing approach on the server.
- Account provisioning by an authorised administrator; no public self-registration.
- Account activation/deactivation and password-reset flow appropriate to the configured environment.
- Server-side role and permission checks on every protected operation.
- Session/token expiry and safe handling of authentication failures.
- Audit records for important administrative actions, where supported by the architecture.

### 3.2 Role-Based Dashboards

Provide role-appropriate dashboards and navigation for Learner, Farmer, Employer, SDF, Training Provider, and Administrator.

- Show only services, records, and actions the signed-in user is permitted to access.
- Provide loading, empty, error, access-denied, and offline/unavailable states where relevant.
- Do not expose private records belonging to other users unless an explicit permission and business rule allows it.

### 3.3 Unified Service Directory

Create a searchable, filterable directory of platform services. The proposed service areas are:

- **AgriSkills Passport** - skills and credential overview.
- **AgriLearn** - learning and training opportunities.
- **AgriOpportunity** - opportunities relevant to eligible users.
- **AgriEmployer** - employer-facing services.
- **AgriProvider** - training-provider information and services.
- **AgriSMME** - support and information for agricultural small businesses.
- **AgriMarket** - agricultural market information or opportunities.
- **AgriMentor** - mentoring information or requests.
- **AgriAdvisor AI** - an advisory interface only if an approved AI provider and safeguards are configured.
- **AgriIntel** - information and insights.
- **AgriImpact** - programme and platform impact information.

Where a service is not yet connected to a real backend or approved data source, label it as a prototype, informational page, or planned integration. Do not fabricate official data or imply endorsement or live availability.

### 3.4 Profiles and Relevant Records

- View and edit permitted profile fields.
- Validate submitted data and provide clear feedback.
- Show the user's own relevant learning, skills, credentials, applications, or service records where those modules are implemented.
- Enforce ownership and role permissions on the server.

### 3.5 Credentials and Verification

- Provide a credential list or skills-passport view when credential data exists.
- Support a QR code or verification reference only when backed by a defined verification process.
- Public verification must reveal only the minimum information required to confirm validity.
- Do not expose full personal profiles, identity numbers, contact details, or private records through a public verification page.

### 3.6 Notifications and Announcements

- In-app notification list and read/unread state.
- Administrator-managed announcements with appropriate audience and permission controls.
- Clear empty and error states.
- Email, SMS, push notifications, and delivery receipts are in scope only when the corresponding provider, credentials, consent, and configuration are available.

### 3.7 Administration

- Manage users, assigned roles, account status, and permissions within the administrator's authority.
- Manage announcements and basic service-directory content where implemented.
- View relevant audit events.
- Apply confirmation steps to destructive or high-impact actions.
- Prevent an administrator from accidentally removing the last active administrator, unless a safe recovery path exists.

### 3.8 Application Quality

- Consistent design system using green, gold, and white as the primary visual direction.
- Reusable components and clear validation.
- Responsive layouts for mobile, tablet, and desktop.
- API and form error handling.
- Basic automated tests for authentication, permissions, and important business rules.
- Setup documentation, environment-variable example file without secrets, and clear run/test instructions.
- Use migrations or a documented schema-management approach if a database is used.

## 4. Out of Scope

Do **not** implement the following unless the project owner explicitly approves a scope change:

- Public self-service account registration or an unrestricted sign-up page.
- User-selected roles at login, client-only role selection, or a role switcher that grants extra privileges.
- Unauthorised access to admin pages, other users' records, or protected API endpoints.
- Real payment processing, banking, lending, insurance underwriting, or financial transactions.
- Buying and selling agricultural products, order fulfilment, escrow, or a full e-commerce marketplace. A directory or informational market module may be included.
- A full learning-management system with video hosting, examinations, proctoring, grading, and accredited course delivery unless separately specified.
- Issuing official qualifications, certificates, or accreditation without an authorised source and a validated business process.
- Claiming that QR codes, credentials, courses, opportunities, or provider records are officially verified when they are not connected to a trusted source.
- Unsupervised AI advice that makes binding decisions about eligibility, funding, accreditation, employment, or regulatory compliance.
- Automated approval or rejection of bursaries, grants, funding, jobs, training, or other high-impact applications.
- Collecting unnecessary sensitive personal data, identity documents, precise location, or biometric data.
- Production integrations with government systems, AgriSETA systems, identity providers, payment gateways, SMS/email providers, or external databases without approved access, credentials, and specifications.
- Native device features such as background location tracking, biometric login, or offline synchronisation unless explicitly approved and designed.
- Multi-tenant enterprise billing, subscription management, advanced analytics infrastructure, or complex workflow automation unless separately approved.
- Deploying to production, changing live infrastructure, or modifying production data without explicit authorisation.
- Replacing existing project architecture or deleting files just to make implementation easier without first inspecting the repository and explaining the need.

## 5. Technical and Repository Working Rules

Before changing code:

1. Inspect the existing repository structure, package manifests, README files, environment examples, and current implementation.
2. Identify the current frontend, backend, database, and test setup. Reuse existing choices unless a documented reason requires a change.
3. Check whether `mobile/`, `backend/`, and `docs/` already exist; preserve their purpose and current work.
4. Do not assume a framework, database, API route, or environment variable exists without checking.
5. Do not overwrite working code or documentation blindly. Make small, coherent changes.

While implementing:

- Keep secrets out of source control. Use environment variables and provide `.env.example` with placeholder values only.
- Validate all untrusted input on the server.
- Use parameterised database operations or the relevant ORM safely.
- Return appropriate HTTP status codes and avoid exposing stack traces or secrets to clients.
- Apply least privilege and deny access by default.
- Avoid storing passwords, access tokens, or sensitive personal data in logs.
- Add tests for critical access-control rules and business logic.
- Use clear names, consistent formatting, and reusable components.
- Do not add dependencies without a clear need.
- Never mark a feature complete merely because its screen exists.

## 6. Suggested Minimum Acceptance Criteria

A feature is not complete until applicable criteria are met:

- [ ] A user cannot create an account through public self-registration.
- [ ] An administrator can create or provision an account and assign an allowed role.
- [ ] Login resolves the role from the trusted account record, not a value supplied by the client.
- [ ] Changing a role value in the UI, request body, URL, or local storage does not grant extra access.
- [ ] Protected frontend routes and backend/API operations enforce authorisation.
- [ ] Users cannot read or modify records outside their permissions.
- [ ] Main navigation and interactive controls lead to functional screens or clearly labelled unavailable features.
- [ ] Forms validate input and display success and failure feedback.
- [ ] Loading, empty, error, and access-denied states are handled.
- [ ] Critical authentication and RBAC rules have tests.
- [ ] Setup, environment configuration, and test instructions are documented.
- [ ] Mock data and unfinished integrations are clearly identified.

## 7. Definition of Done

Before declaring work complete:

1. Summarise what changed and why.
2. List the files created or modified.
3. Run the available linting, type checks, tests, and build commands where practical.
4. Report the actual result of each command; never claim a check passed if it was not run.
5. State any known limitations, mock data, missing credentials, or external approvals still required.
6. Update relevant documentation and tests.
7. Confirm that no secrets or unnecessary personal data were introduced.

## 8. Priority Order

When requirements conflict, prioritise:

1. Security, privacy, and correct server-side authorisation.
2. Existing project structure and working functionality.
3. Core user journeys and data integrity.
4. Accessibility and responsive usability.
5. Maintainability, documentation, and visual polish.

**Guiding principle:** Build a secure, functional, role-aware AgriConnect 360 platform. Do not expand beyond the approved scope or simulate official integrations that are not actually available.

## 9. Mobile Application (`mobile/`)

These mobile-specific instructions supplement the repository-wide requirements above.

### Expo and React Native

- Prioritize mobile-first patterns, performance, and cross-platform compatibility.
- Expo APIs can change between SDK releases. Before writing code that uses Expo, EAS, or React Native APIs:
  1. Read the major version of `expo` in `mobile/package.json`.
  2. Consult the matching versioned documentation at `https://docs.expo.dev/versions/v<major>.0.0/`.
  3. For other Expo questions, consult `https://docs.expo.dev/llms.txt` and follow its links to the relevant documentation.
- Use Expo Router for navigation. Routes belong in `mobile/src/app/`; keep non-route code outside that directory. Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`. See https://docs.expo.dev/router/introduction.md.
- Prefer recommended Expo modules over third-party libraries, and review available skills before adding dependencies. See https://docs.expo.dev/versions/latest/index.md.
- Expo Go includes only its bundled native modules. After adding a library with native code, use a development build.
- When `ios/` and `android/` directories are absent, Expo Continuous Native Generation creates them. Configure native behavior in app configuration and config plugins; do not create or hand-edit generated native projects.

### Mobile Commands

- If `mobile/bun.lock` is present, use `bunx` rather than `npx`.
- Install Expo-compatible packages with `npx expo install <package>` (or `bunx expo install <package>` in a Bun project).
- Common commands, run from `mobile/`:
  ```bash
  npx expo start
  npx expo lint
  npx tsc --noEmit
  npx expo-doctor
  ```
- Run the mobile lint and type checks before declaring mobile work complete.

### EAS Builds

- Use EAS for cloud builds, signing, submission, and over-the-air updates; avoid local native build tooling unless the task specifically requires it.
- Run EAS CLI as `npx eas-cli@latest <command>` or `bunx eas-cli <command>` for Bun projects.
- Consult https://docs.expo.dev/eas/index.md for current EAS guidance.
