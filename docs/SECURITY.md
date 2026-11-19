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
- The server refuses to start without a configured `JWT_SECRET` (outside automated tests); there is no silent fallback to a guessable development secret.
- New and reset passwords require at least 12 characters and a mix of uppercase and lowercase letters, a number, and a symbol.
- CORS only accepts the origin(s) listed in `CLIENT_URL` (plus common local dev origins outside production). Non-browser clients, including the mobile app, are unaffected since they don't send an `Origin` header.
- `/api/auth/login` and `/api/auth/register` are rate-limited per IP + identifier (8 attempts / 15 minutes) to slow down brute-force attempts.
- Logout revocation is persisted to Neon (as a hash of the token, never the token itself) in addition to the in-memory check, so it survives a server restart.

These controls do not establish production readiness. See [API.md](./API.md) for route-specific authorization behavior.

## Known gaps and privacy risks

- Neon PostgreSQL is the only supported database; `DATABASE_URL` is mandatory at startup. The connection is verified with TLS.
- Service listings and service-detail requests enforce the account role's eligibility.
- Published announcements are shared only with their configured audiences. Workflow notifications are scoped to the intended account.
- Brevo SMTP credentials are read from server-only environment variables. Email delivery is disabled by default; do not expose SMTP keys in the mobile app or logs.
- Web `sessionStorage` is accessible to JavaScript running on the page. Protect the web client against cross-site scripting and do not consider this equivalent to native secure storage.
- Self-service password reset is available only when Brevo email is enabled. Reset codes are random 256-bit values: only their SHA-256 hash is stored, they expire after 30 minutes, work once, are never logged, and the request endpoint returns the same response for unknown emails. There is no email verification or token refresh. Administrative account deactivation prevents deactivating the current or last active administrator.
- The rate limiter is in-memory and per-process; it resets on restart and does not share state across multiple server instances. It is also not proxy-aware (`req.ip` reflects the connecting socket, not an `X-Forwarded-For` header), which matters if this is deployed behind a reverse proxy or load balancer.
- Role assignment depends on the administrator's process; the app does not independently verify identity or role references against CIPC, educational institutions, agricultural bodies, AgriSETA, or QCTO.
- Existing Neon self-registration records with matching audit history may be moved to pending review at startup. Review existing accounts and pending requests before deployment. MongoDB data is not migrated automatically.
- Synthetic data and prototype content are not verified official AgriSETA information.

Before production or processing real personal information, complete a POPIA-oriented privacy review, threat/security assessment, authorization tests, persistent storage and retention controls, and operational review. Do not include passwords, tokens, or unnecessary personal data in logs, tickets, or documentation.
