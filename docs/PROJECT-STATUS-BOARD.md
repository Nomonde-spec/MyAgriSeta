# MyAgriSETA project status board

**Last updated:** 16 November 2026  
**Project:** MyAgriSETA / AgriConnect 360

This board reflects the current repository state. “Done” means the work is implemented in the repository and has supporting evidence; it does not mean the platform is production-ready.

## To do

- [ ] Complete production-readiness approval: POPIA/privacy review, security review, operational logging, backups, recovery, and external-service approvals.
- [ ] Replace seeded/sample content with approved, source-attributed production content.
- [ ] Confirm the final persistence, migration, backup, and data-retention operating procedures for Neon PostgreSQL.
- [ ] Configure and verify production notification delivery, consent, provider credentials, and delivery monitoring.
- [ ] Complete stakeholder acceptance and sign-off for learner, farmer, employer, SDF, training-provider, assessor, SMME, staff, and administrator journeys.
- [ ] Decide and document the release policy for prototype learning content, credentials, opportunities, market information, and provider records.
- [ ] Complete production deployment controls and monitoring; do not use real personal information before the required approvals are complete.

## In progress

- [ ] Finish the mobile release cycle: rebuild the Android APK with the hosted API URL, install it on target devices, and verify login and core journeys.
- [ ] Resolve remaining production integration gaps and document any feature that still requires external credentials or an approved data source.
- [ ] Continue expanding automated coverage for notifications, account administration, audit events, data ownership, and failure states.
- [ ] Continue accessibility and responsive testing across Android, web, small screens, and larger screens.
- [ ] Reconcile the 30-day tracker with actual evidence, owners, blockers, and revised dates.

## Review / waiting for testing

- [ ] Mobile TypeScript check currently passes; complete device-level APK testing.
- [ ] Hosted API health endpoint is available at `https://myagriseta.onrender.com/health`; verify login, authenticated API calls, and error handling from the rebuilt APK.
- [ ] Review the final APK configuration to confirm it uses `https://myagriseta.onrender.com/api` and not a local LAN address.
- [ ] Run the backend test suite after the latest authentication, persistence, and authorization changes.
- [ ] Review server-side RBAC, ownership checks, account provisioning, role changes, last-administrator protection, and audit behavior against acceptance criteria.
- [ ] Review user-facing labels and disclosures so sample, prototype, unverified, and unavailable features are described accurately.
- [ ] Perform a clean-checkout setup test using the documented environment and test commands.

## Done

- [x] Expo mobile application and Express API repository structure established.
- [x] Hosted API responds successfully from `/health`.
- [x] Mobile API configuration supports the hosted HTTPS API for EAS preview builds.
- [x] Local development API configuration and LAN development guidance documented.
- [x] JWT authentication, password hashing, logout/revocation, expiry handling, and server-side role checks implemented.
- [x] New and reset password policy strengthened to require 12 characters and mixed character classes.
- [x] Administrator account provisioning, account status management, role assignment, and protected administration routes implemented.
- [x] Core role-aware dashboards and navigation implemented for the supported stakeholder roles.
- [x] Service directory, learning catalogue, opportunities, applications, profiles, passport, notifications, and administrative workspaces implemented.
- [x] Server-side ownership and eligibility checks implemented for protected records and actions.
- [x] Neon PostgreSQL persistence integration and environment configuration documented.
- [x] API, system, setup, database, security, and testing documentation added or updated.
- [x] Mobile TypeScript validation passed with `mobile\node_modules\.bin\tsc.cmd --noEmit`.
- [x] User-facing “Demo/Demonstration” labels in the mobile app were renamed to “Sample” without removing the internal state flags that control sample behavior.

## Known boundaries

- Sample records, sample opportunities, prototype lessons, self-reported skills, and unverified provider information must not be presented as official or live without approved sources and integration.
- The hosted API and preview APK are not evidence of production readiness.
- External identity, government, AgriSETA, email/SMS, accreditation, payment, and other third-party integrations require their own credentials, approvals, consent, and verification.