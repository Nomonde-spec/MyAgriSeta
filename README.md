# MyAgriSeta

This repository contains a full-stack MyAgriSETA prototype for the AgriConnect 360 mobile experience.

## Structure

- `mobile/` – Expo React Native app
- `server/` – Express API with JWT authentication and role checks
- `docs/` – project documentation

## Quick start

Start the backend in one terminal:

```powershell
Set-Location .\server
npm install
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
npm start
```

Start the Expo app in a second terminal:

```powershell
Set-Location .\mobile
npm install
npm run dev
```

The web app's default API URL is `http://localhost:3000/api`. To use Expo Go, start the API with `npm --prefix server run dev` from the repository root (or `npm run dev` if already inside `server/`). In a second terminal at the repository root, run `npm run dev:mobile`; Expo starts in LAN mode and the native app automatically uses the development server's host for API requests. Keep the phone and computer on the same network and allow Node.js through the computer's private-network firewall. From the repository root, `npm run dev` starts the API and Expo web app after the API health check succeeds.

Local demo accounts and setup details are in [docs/SETUP.md](./docs/SETUP.md).

## Checks

Run backend tests from `server/`:

```powershell
Set-Location .\server
npm test
```

Check the mobile TypeScript project from `mobile/`:

```powershell
Set-Location .\mobile
.\node_modules\.bin\tsc.cmd --noEmit
```

## Notes

This prototype uses Neon PostgreSQL exclusively; `DATABASE_URL` is required for every server environment, and startup fails if Neon is unavailable. It includes role-based account access, administrator workflows, and synthetic demonstration content, but is not production-ready or suitable for real personal information without the documented privacy, security, and operational work.

Learners can self-register and sign in immediately. Other public stakeholder roles can submit registration requests but require administrator role verification before sign-in. Administrator and internal-staff accounts cannot self-register. Administrators can also provision accounts, assign roles, manage account details/status, publish audience-targeted in-app announcements, and review aggregate reports and audit activity.

Learners can discover labeled sample opportunities and apply for in-app tracking; those examples are not live offers, and applications are not submitted to employers or providers. Passport skills are self-reported rather than verified. AgriLearn includes prototype lessons and knowledge checks, not accredited course delivery or official assessments. See [docs/API.md](./docs/API.md), [docs/SYSTEM.md](./docs/SYSTEM.md), [docs/SECURITY.md](./docs/SECURITY.md), and [docs/SETUP.md](./docs/SETUP.md) for details.
