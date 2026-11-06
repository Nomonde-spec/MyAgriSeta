# Architecture

## Overview

The solution combines a mobile-first Expo client with a lightweight Express backend. The backend owns authentication, role assignment, and authorization. The mobile app never writes to the database directly and stores tokens using `expo-secure-store`.

## Mobile app

- File-based routing under `mobile/src/app`
- Context-based authentication in `mobile/src/context/auth-context.tsx`
- Shared theme definitions in `mobile/src/theme.ts`
- API helper in `mobile/src/lib/api.ts`
- Role-aware dashboard tabs in `mobile/src/app/(tabs)/_layout.tsx`

## Backend

- App entry: `server/src/server.js`
- Seed data: `server/src/data.js`
- Neon PostgreSQL schema creation and persistence: `server/src/database.js`
- JWT-based login and authorization middleware
- Role permissions keyed by role name
- Neon PostgreSQL only; `DATABASE_URL` is required at startup

## Security model

- Learners can self-register and sign in immediately. Other public stakeholder roles can submit self-registration requests but require administrator role verification before sign-in. Privileged administrator/internal-staff roles cannot self-register.
- Permissions are derived from the account's assigned active role; users cannot choose or change their role.
- Administrator account, announcement, audit, and report APIs enforce administrator authorization server-side. The last active administrator cannot be unassigned or deactivated.
- Passwords are bcrypt-hashed, and administrator password changes invalidate existing account tokens.
- The account record determines the active role; there is no user-facing role switching.
- Protected endpoints require bearer tokens.
- Role access is enforced server-side in middleware and route guards.

## Notes

This is a development implementation intended for testing and demonstration. Neon can be enabled for persistence; no production database or external AgriSETA system is connected. Neon mode currently assumes a single API process and needs concurrency/cache invalidation work before horizontal scaling.
