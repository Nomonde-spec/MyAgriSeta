# Role-based access matrix

The server is the authorization boundary. The account's server-side `activeRole` controls protected role operations; the mobile UI only hides or shows navigation for usability.

| Action | Learner | Farmer | Employer | SDF | Training provider | Assessor | Administrator | Internal staff |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| Sign in / sign out | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Public self-registration | Yes | Yes* | Yes* | Yes* | Yes* | No | No |
| Sign in immediately after registration | Yes | No | No | No | No | N/A | N/A |
| View own dashboard | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| View eligible services | Yes | Yes | Yes | Yes | Yes | All seeded | All seeded |
| View eligible opportunities | Yes | Yes | Yes | Yes | Yes | All open | All open |
| Read own applications | Yes | Yes | Yes | Yes | Yes | Yes | Yes |
| Submit an eligible application | Yes | Yes | Yes | Yes | Yes | No | No |
| Create/read SDF workforce assessments, WSPs, and ATRs for verified organisation | No | No | No | Yes | No | No | No |
| Coordinate organisation training cohorts | No | No | No | Yes | No | No | No |
| View and manage assigned assessments | No | No | No | No | No | Yes | No | No |
| Submit assessment results and feedback | No | No | No | No | No | Yes | No | No |
| Verify assessment outcomes | No | No | No | No | No | No | Yes | Yes |
| Submit skills-development programmes for administrator review | No | No | No | Yes | Yes | No | No |
| Submit provider profile changes for administrator review | No | No | No | No | Yes | No | No |
| Review and publish provider profiles | No | No | No | No | No | Yes | No |
| Manage own provider course enrolments and accepted-participant progress | No | No | No | No | Yes | No | No |
| List user accounts | No | No | No | No | No | Yes | No |
| Provision accounts and assign supported roles | No | No | No | No | No | Yes | No |
| Edit account details, roles, active role, or password | No | No | No | No | No | Yes | No |
| Activate / deactivate accounts | No | No | No | No | No | Yes | No |
| Create, publish, and archive role-targeted announcements | No | No | No | No | No | Yes | No |
| View aggregate platform reports | No | No | No | No | No | Yes | No |
| View filtered audit list | No | No | No | No | No | Yes | No |
| View internal review queue | No | No | No | No | No | No | Yes |
| Change active role in the client | No | No | No | No | No | No | No |

Administrators and internal staff can review enrolment requests; progress tracking is restricted to the owning training provider.

`*` Self-registration requests the selected stakeholder role. New learner accounts are active immediately; farmer, employer, SDF, and training-provider accounts remain inactive until administrator role verification. Administrator and internal-staff accounts are never self-registered.

## Service eligibility

The API filters the directory and applies the same eligibility check to service-detail requests. The seeded named service areas use proposed, informational descriptions; they are not official specifications or live integrations. The three older example programmes and opportunities are synthetic demo data.

## Current limitations

- User, service, application, bookmark, announcement, and audit records persist in Neon. Password changes invalidate existing account tokens. Logout revokes the token in the running API process and persists its hash and expiry in Neon, surviving API restarts.
- Learners can self-register and sign in immediately. Other public stakeholder roles can submit self-registration requests, but their accounts remain inactive until administrator verification. Administrator and internal-staff roles cannot be self-registered.
- Administrators also provision accounts, assign one or more roles, set the active role, edit account details/passwords, and activate or deactivate accounts. Permissions are derived from the assigned active role, not independently edited. Passwords are hashed; password-reset notifications are not configured.
- The server uses Neon PostgreSQL only. `DATABASE_URL` is mandatory in every environment; the API does not fall back to in-memory storage or another database.
- On Neon startup, legacy accounts identifiable from a `Self-registered ...` audit entry are marked inactive and moved to manual review. Other pre-existing records without that audit marker retain their current access and should be audited during deployment.
- `internal_staff` is an additional operational role, not one of the six primary stakeholder dashboards.
- Assessor records are persisted in `assessor_profiles` and `assessor_assignments`. Assessors can save drafts and submit assigned records for verification, but cannot verify their own work. Evidence metadata is validated for type and size; binary storage/integrated document delivery is not yet connected.
- SDF workforce data is isolated by an organisation key assigned when an administrator approves the SDF role, derived from the verified organisation name and work-email domain. The user-editable organisation display field cannot grant access. No employee names or contact details are stored in the SDF planning records.
- Role references are self-reported and are not independently checked against official records; review remains required for non-learner stakeholder roles.
