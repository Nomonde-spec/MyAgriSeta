# MyAgriSETA documentation

This repository contains a React Native Expo mobile app and an Express backend prototype for the AgriConnect 360 platform.

## Documentation

- [30-day project tracker](./PROJECT-TRACKER-30-DAYS.md) — proposed daily plan from 29 October through 27 November 2026. All tasks begin as planned.
- [API reference](./API.md) — implemented routes, request/response shapes, authorization, and known endpoint caveats.
- [System documentation](./SYSTEM.md) — components, roles, data, local setup, configuration, security, and current limitations.
- [Security and privacy notes](./SECURITY.md) — current controls, gaps, and pre-production privacy/security actions.
- [RBAC matrix](./RBAC_MATRIX.md) — implemented server-side role access and known administration gaps.
- [Setup guide](./SETUP.md) — local backend and Expo setup.
- [Testing guide](./TESTING.md) — current test commands and manual smoke checks.
- [Architecture notes](./ARCHITECTURE.md)
- [Visual architecture guide](./MYAGRISETA-VISUAL-ARCHITECTURE.pdf) — seven-page system and workflow diagrams.
- [Database notes](./DATABASE.md)
- [Deployment guidance](./DEPLOYMENT.md)

## Current implementation status

The prototype includes JWT login, self-registration for public stakeholder roles, immediate learner access, administrator-reviewed verification for other stakeholder roles, server-side role checks, role-tailored dashboards, service and opportunity workflows, and administrator account, announcement, audit, and report features. Administrator and internal-staff roles cannot self-register.

The API uses Neon PostgreSQL exclusively. `DATABASE_URL` is mandatory in every environment; the API does not fall back to in-memory storage or another database. The app remains a development prototype, not a production system. See [system documentation](./SYSTEM.md) and [database notes](./DATABASE.md) for limitations.
