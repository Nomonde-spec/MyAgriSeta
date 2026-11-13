# Database and data model

The API uses Neon Serverless PostgreSQL through the `pg` driver. Configure `DATABASE_URL` with the connection string from the Neon project; the connection is made over verified TLS. Neon is the only supported database in every environment. Startup fails if `DATABASE_URL` is missing, is not a PostgreSQL connection string, or Neon cannot be reached. The health endpoint reports `"storage": "neon"` when ready and returns `503` otherwise.

## Tables

`server/src/database.js` creates one PostgreSQL table for each application collection. Each table stores a record key and its JSONB record:

- `users` (unique case-insensitive email and username, unique role-verification key)
- `services`, `opportunities`, `saved_opportunities`, and `applications`
- `learning_categories`, `training_providers`, `learning_courses`, `learning_programmes`, and `learning_resources`
- `enrollments` (unique reference and one active record per applicant/course), `resource_progress` (one started-guide record per account/resource), `saved_courses`, `course_progress`, `learning_module_progress`, and `certificates`
- `passport_skills` and `passport_records` for self-reported skills and owner-submitted qualification, training, experience, and achievement records
- `notifications` and `audit_logs`
- `sdf_workforce_records` for organisation-scoped SDF skills-gap assessments, WSP activities, ATR records, and employee training cohorts

The API creates these tables and indexes on startup, inserts missing synthetic seed records without overwriting existing records, and loads the database rows into its process-local cache. Account provisioning/status, administrator-created provider profiles and profile-review changes, application creation/transitions, bookmarks, enrolments and consented provider contact visibility, provider-managed training progress, started-guide records, module lessons and assessment attempts, course progress, provider course submissions, category/resource changes, review status, Passport records and verification decisions, and audit entries are persisted. Learners and farmers control their own Passport data. Applicants must separately consent to employer Passport access, which is limited to eligible applications for that employer and is audited. Administrator review is an internal platform review and does not constitute issuer verification or qualification accreditation.
SDF workforce records are persisted and scoped by a server-assigned organisation key derived on administrator approval; employee cohorts store aggregate counts rather than named employee records.

## Neon configuration

1. Create a Neon project and copy its connection string from the Neon dashboard.
2. Copy `server/.env.example` to `server/.env`.
3. Set `DATABASE_URL` to the Neon connection string with verified TLS (`sslmode=verify-full`), and set a private `JWT_SECRET`. Do not commit `.env` or share database credentials.
4. Start the server with `npm start`; check `http://localhost:3000/health` and confirm `"storage": "neon"`.
5. Keep `DATABASE_URL` configured in every environment; the API does not provide an ephemeral or alternate-database mode.

If Neon is unreachable, startup fails instead of silently falling back to memory. If Neon becomes unavailable after startup, persisted mutations return an error rather than claiming success.

## Migration and limits

- Existing MongoDB data is not copied automatically. Before switching an existing installation, export and migrate the required records to Neon using a reviewed, access-controlled migration process; verify account counts and authentication before using the new database. Never put database credentials or exported personal data in source control.
- The API keeps a process-local read cache after loading records. Run one API process only; multi-instance cache invalidation and concurrent-write guarantees are not implemented.
- Startup creates the current tables and indexes but is not a versioned migration framework. Schema evolution, backups/restores, retention, and deployment rollout procedures still need to be designed and tested.
- Seed records are synthetic development examples. There is no official AgriSETA data source.
- AgriLearn's seeded module lessons and scored knowledge checks are original demonstration material for the ten synthetic course listings. Per-account lesson completion, assessment attempts, scores, and course completion are persisted. This is not a formal LMS or accredited assessment, and it does not issue certificates. Provider/course seed records, accreditation labels, and learning resources are demonstrations; there is no external provider messaging or verified course delivery integration.
- No organisation registry or manual cross-domain SDF organisation linking is provided; SDF membership is derived from approved organisation name and work-email domain. Email/SMS notification delivery is not connected.
- The Neon database path has not been exercised against live Neon credentials in this environment.
- Never store real personal information until a POPIA-oriented privacy, access, retention, and security review is complete.
