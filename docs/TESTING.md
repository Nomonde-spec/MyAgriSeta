# Testing

## Automated backend tests

From `server/`, run:

```bash
npm test
```

The Node test-runner suite exercises registration and account approval, administrator provisioning and role assignment, role-specific dashboards, logout and authorization, audience-scoped announcements, aggregate report privacy, profile ownership, protected application documents, opportunity publication and applicant privacy, candidate opt-in, farmer market and mentor consent, provider enrolments and progress, and organisation-scoped SDF workforce planning. The logout test verifies immediate in-process revocation; the Neon-backed persistence and restart path still requires validation against a configured Neon database.

## Mobile type check

From `mobile/`, run:

```bash
npm run lint
npx tsc --noEmit
```

## Manual API smoke test

1. Configure `server/.env` with Neon and start the API. Confirm `GET http://localhost:3000/health` returns `200` and `"storage": "neon"`.
2. Register a learner through `POST /api/auth/register`; confirm the account can sign in without administrator approval. Non-learner public role registrations remain pending until an administrator reviews them.
3. Use a bearer token to call `GET /api/me` and `PATCH /api/me`. Update an allowed field, clear an optional phone or organisation, and confirm email, username, roles, and status cannot be changed by the account holder.
4. Verify the opportunity filters, saved opportunities, role-protected application actions, and account-owned application tracker.
5. Sign out and confirm the same token is rejected by `GET /api/me`. With a non-production test account and a disposable Neon database, restart the API and confirm the revoked token remains rejected.
6. Confirm unauthenticated and unauthorized requests receive the expected denial responses.

Do not copy development credentials into shared test reports, screenshots, or production systems. See [API.md](./API.md) for route details and [SYSTEM.md](./SYSTEM.md) for known limitations.

## Scope and limitations

No separate Jest or React Native UI test framework is currently configured. The automated suite is backend-focused; mobile interaction, accessibility, device, and browser validation still require a separately planned test pass.

The opportunities screens use the bundled agricultural photo for cards and details. Automated tests verify API behavior, not visual layout or image rendering across devices.
