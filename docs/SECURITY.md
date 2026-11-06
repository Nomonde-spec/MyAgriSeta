# Security and privacy notes

This is a local-development prototype, not a production security assessment. See [SYSTEM.md](./SYSTEM.md) for the architecture and complete production-readiness list.

## Controls currently implemented

- JWT bearer authentication on protected API routes; tokens expire after eight hours.
- Route-level role checks for administrator account, announcement, audit, and report routes and the internal-staff review queue.
- Learners can self-register and sign in immediately. Other public stakeholder roles can request registration but remain inactive until administrator role verification. Administrator and internal-staff roles cannot self-register.
- The server derives access from the stored active role; permissions and role assignments are not client-controlled.
- Administrator account management is protected server-side. The last active administrator cannot be unassigned or deactivated.
- Password changes are bcrypt-hashed and invalidate previously issued account tokens.
- Passwords are checked and stored as bcrypt hashes.
- Native token persistence uses Expo SecureStore; web token persistence uses browser `sessionStorage`.
- Application list reads are scoped to the authenticated user.

These controls do not establish production readiness. See [API.md](./API.md) for route-specific authorization behavior.

## Known gaps and privacy risks

- The API falls back to a known development JWT secret when `JWT_SECRET` is absent. Set a strong secret and remove the fallback before any deployment.
- Neon PostgreSQL is the only supported database; `DATABASE_URL` is mandatory at startup. The connection is verified with TLS.
- CORS currently accepts any origin; `CLIENT_URL` is not used by the current CORS setup.
- Service listings and service-detail requests enforce the account role's eligibility.
- Published announcements are shared only with their configured audiences. Workflow notifications are scoped to the intended account.
- Brevo SMTP credentials are read from server-only environment variables. Email delivery is disabled by default; do not expose SMTP keys in the mobile app or logs.
- Logout revokes a token only in the current server process; revocation state is lost when the server restarts.
- Web `sessionStorage` is accessible to JavaScript running on the page. Protect the web client against cross-site scripting and do not consider this equivalent to native secure storage.
- There is no login rate limiting, email verification, self-service password reset, or token refresh. Administrative account deactivation prevents deactivating the current or last active administrator.
- Role assignment depends on the administrator's process; the app does not independently verify identity or role references against CIPC, educational institutions, agricultural bodies, AgriSETA, or QCTO.
- Existing Neon self-registration records with matching audit history may be moved to pending review at startup. Review existing accounts and pending requests before deployment. MongoDB data is not migrated automatically.
- Synthetic data and prototype content are not verified official AgriSETA information.

Before production or processing real personal information, complete a POPIA-oriented privacy review, threat/security assessment, authorization tests, persistent storage and retention controls, and operational review. Do not include passwords, tokens, or unnecessary personal data in logs, tickets, or documentation.
