# Setup and configuration

For the full local setup, environment-variable reference, and security notes, see [SYSTEM.md](./SYSTEM.md).

## Backend (`server/`)

1. Install Node.js and npm.
2. In `server/`, copy `.env.example` to `.env`.
3. Configure the Neon PostgreSQL connection string as `DATABASE_URL` in `server/.env`. Neon is required in every environment; the API does not fall back to an in-memory or other database. The connection uses verified TLS.
4. Set a strong `JWT_SECRET` and keep `.env` out of version control.
5. Run `npm install`, then `npm start`.
6. Confirm `http://localhost:3000/health` returns `200` and `"storage": "neon"`.

For automatic restarts during development, use `npm run dev` from `server/`.

### Local demo login accounts

After starting the backend, use any of these accounts on the login screen. Enter the email address or username:

| Account | Email or username | Password |
|---|---|---|
| Administrator | `admin@myagriseta.local` or `admin` | `Admin123!` |
| Learner | `learner@myagriseta.local` or `learner` | `Lerato123!` |
| Farmer | `farmer@myagriseta.local` or `farmer` | `Sipho123!` |
| Employer | `employer@myagriseta.local` or `employer` | `Thandi123!` |
| Skills Development Facilitator (SDF) | `sdf@myagriseta.local` or `sdf` | `Mpho123!` |
| Training provider | `provider@myagriseta.local` or `provider` | `Naledi123!` |
| Administrator and internal staff | `multirole@myagriseta.local` or `multirole` | `Admin123!` |

These are synthetic development accounts defined in `server/src/data.js`, not real user credentials. They are inserted into Neon only if their records do not already exist. Never use these accounts or passwords outside an isolated local environment.

### Administrator account and platform management

Sign in using an administrator account, then open **Administration** to provision accounts for supported platform roles, select active roles, update account details or passwords, and activate/deactivate accounts. Permissions are derived from the assigned role; users cannot select or switch into unassigned roles. The administrator screen also supports publishing role-targeted in-app announcements and reviewing historical role requests. Open **Reports & audit activity** from the administrator dashboard for date-filtered aggregate reports and audit history. Reports contain aggregate counts, not account/applicant identities.

Users can register themselves from the sign-in screen. Learner accounts are active immediately and do not require administrator approval. Farmer, employer, SDF, and training-provider registrations require administrator review of role details before sign-in is enabled. Administrator and internal-staff accounts cannot be self-registered.

#### Brevo email notifications

The backend sends transactional email for account-scoped in-app notifications (including application status updates) and sends published administrator announcements to active accounts in the selected audience. Email is off by default. In `server/.env`, configure the SMTP settings below and set `BREVO_EMAIL_ENABLED=true`:

```env
BREVO_EMAIL_ENABLED=true
BREVO_SMTP_HOST=smtp-relay.brevo.com
BREVO_SMTP_PORT=587
BREVO_SMTP_LOGIN=your-brevo-smtp-login
BREVO_SMTP_KEY=your-brevo-smtp-key
BREVO_SENDER_EMAIL=verified-sender@yourdomain.co.za
BREVO_SENDER_NAME=MyAgriSETA
```

Use the SMTP login and SMTP key from Brevo (not your Brevo account password or API key), and verify the sender address/domain in Brevo. Port 587 uses STARTTLS. Restart the backend after editing `.env`. The health endpoint reports whether email notifications are enabled. If SMTP delivery fails, the in-app notification remains saved, the delivery status is marked failed, and a sanitized error is logged; check the backend logs and Brevo SMTP settings. Email sending is disabled during automated tests.

#### Password reset by email

Password reset uses the same Brevo SMTP settings. When email is enabled, **Forgot password?** on the sign-in screen asks for the account email and sends a link plus a reset code. The link opens `PASSWORD_RESET_URL?token=...`. If `PASSWORD_RESET_URL` is not set, it defaults to the first `CLIENT_URL` origin followed by `/reset-password`. Users on a phone can paste the code on the **I already have a reset code** screen instead.

```env
# Optional: the web page that opens from the reset email
PASSWORD_RESET_URL=http://localhost:8081/reset-password
```

Reset codes expire after 30 minutes and can be used once. A new code can be requested every 60 seconds. A successful reset signs the account out on all devices and is recorded in the audit log. If `BREVO_EMAIL_ENABLED` is not `true`, the reset request returns `503` and users are told to contact an administrator; reset codes are never written to logs.

SMS delivery is not configured.

## Mobile app

1. In `mobile/`, run `npm install`.
2. Configure `server/.env` with Neon. The optional `mobile/.env.example` documents `EXPO_PUBLIC_API_URL`; the default is `http://localhost:3000/api`.
3. From the repository root, `npm run dev` starts the API and Expo web app. Registration and sign-in require the API and Neon to be available.
4. To use Expo Go, start the API in one terminal. From the repository root, run `npm --prefix server run dev`; if that terminal is already in `server/`, run `npm run dev` instead. In a second terminal at the repository root, run `npm run dev:mobile`. This starts Expo in LAN mode. Open its QR code in Expo Go. The native app automatically replaces a localhost API URL with the host address used by the Expo development server.

The phone and development computer must be on the same Wi-Fi/network. The backend listens on `0.0.0.0` by default so devices on the LAN can reach it; set `HOST` in `server/.env` only if a different bind address is required. If the app still cannot connect, allow Node.js or inbound TCP port 3000 through the computer's private-network firewall, check `http://<computer-LAN-IP>:3000/health` from the phone's browser, and make sure `EXPO_PUBLIC_API_URL` is not set to a stale non-loopback address. `localhost` on the phone refers to the phone itself. Do not place secrets in `EXPO_PUBLIC_*` variables because they are bundled into the client.

### Farmer services and curated information

The Farmer hub includes in-app agricultural guides, training listings, eligible opportunity applications, a farm profile, a sourced market-information view, and a mentor directory/request flow. Sample courses and funding/support opportunities are explicitly labelled demonstrations and must not be presented as live offers.

To publish current market or mentor information locally:

1. Sign in with an administrator account and open **Administration → Farmer information curation**.
2. For market entries, enter the exact commodity, grade, market, province, ZAR price/unit, observation date, source name/URL, checked date, and expiry date. Use the source's original units and do not estimate missing prices.
3. For mentor profiles, verify the person's identity and agricultural experience using the recorded source. Obtain and confirm consent both to display the profile to signed-in farmers and to share contact details after an approved introduction.
4. Review mentor requests in the same section. Only mark a request **Connected** after confirming the mentor is available and has agreed to the introduction. The farmer then sees the consented contact email in their request record.
5. Farmer-facing funding, training, business-support, and mentorship opportunity listings must include a source name, HTTP(S) URL, last-checked date, and expiry date before an administrator can approve or publish them. Recheck eligibility and deadlines at the source before publication.

Market records expire from the farmer view when their expiry date passes. Mentor profiles likewise disappear after expiry or archival. Curated records are stored in Neon. Source attribution does not itself prove a source or claim is authentic; administrators are responsible for verification. No market, funding, course-provider, or mentor records are invented or pre-seeded as real.

The Farmer hub also links to official external information from the Agricultural Research Council (ARC), AgriSETA, the National Agricultural Marketing Council (NAMC), and Land Bank. These links are referrals, not live integrations: ARC and AgriSETA provide sector information, NAMC's market-access page is not a current commodity-price feed, and Land Bank eligibility and application availability must be confirmed directly. Administrators can add an optional official application-page URL to an opportunity; farmers can open that page directly. The separate in-app application tracker is for MyAgriSETA follow-up and does not submit to the external organisation.

### Employer recruitment and training needs

Employers can submit job, internship, workplace-opportunity, and employee-training-need listings from **Opportunities**. All submissions remain private until an administrator reviews and publishes them. Training needs specify whether training providers or SDFs should respond, the priority skills and objectives, employee count, preferred dates, and location. Do not include employee names or sensitive personal information in a training-needs listing.

The **Candidates and recruitment** panel shows only submitted applications to that employer's own published listings. Employers may search their applicants, review application documents, and update recruitment status with optional feedback; applicants receive notifications and can see those updates in their application tracker. Candidate-detail and file access are restricted to the listing owner and are audited.

The **Discover candidates** panel searches learner/farmer profiles only after the account holder explicitly opts in from **Profile → Personal information**. A candidate can withdraw visibility there at any time. Employers see a limited profile and self-reported skills, not contact details or documents. They can select one of their open listings and send an in-app invitation; candidates choose whether to apply. A MyAgriSETA application is still required before the employer can see the applicant's submitted contact details or documents.

The employer funding/support panel links to AgriSETA's official [Discretionary Grant Funding information](https://www.agriseta.co.za/discretionary-grant-funding/) page. The source page may change; verify current application windows, eligibility, and instructions directly with AgriSETA. No live funding feed is connected and MyAgriSETA does not transmit the employer's details or submit an external funding application. Application details and files contain personal information: the current prototype is not production-ready for real applicant records until the privacy, retention, access-control, backups, and security requirements in [SYSTEM.md](./SYSTEM.md) are completed.

### Skills Development Facilitator (SDF) workforce planning

Sign in with an active, administrator-approved SDF account and open **Opportunities → SDF planning workspace**. The SDF workspace supports:

1. Recording skills-gap assessment entries by employee group, headcount, current/target competency level, priority, and proposed intervention.
2. Preparing Workplace Skills Plan (WSP) activity records, linked to a same-organisation skills assessment where relevant.
3. Preparing Annual Training Report (ATR) activity records with planned, attended, and completed participant counts, expenditure in ZAR, and outcomes; the API checks participant totals.
4. Coordinating training cohorts from planned through scheduled and in-progress to completed or cancelled, recording completion counts.
5. Sharing a WSP or ATR summary through the device's share sheet.
6. Submitting SDF skills-development programme/opportunity listings for administrator review and applying for role-eligible opportunities through **Opportunities**.

Workforce records are shared only with administrator-approved SDF accounts that have the same verified organisation name and work-email domain. The profile display name is not used as the authorisation boundary. Records are grouped by headcount and do not collect employee names, identity numbers, or contact details. Saving or submitting a record in MyAgriSETA is not an official AgriSETA WSP/ATR submission. The application does not connect to AgriSETA's reporting systems, verify the current statutory template, submit funding applications, or provide official acceptance; check current requirements and submit externally through the appropriate authorised channel.

### Application documents

Applicants complete a short form and upload only documents required by the selected service or opportunity. Administrators set service requirements on the service detail screen; employers and administrators set opportunity requirements when preparing a listing. Uploads are restricted to PDF, JPG, and PNG files (2 MB each; 5 MB total per application). The API checks file signatures and prevents applicant documents from appearing in application-list responses. Applicants and authorized application reviewers can retrieve files; reviewer access is audited.

Before production, configure Neon data protection and access controls, protected backups, retention/deletion rules, and an approved malware-scanning process. Do not request identity/passport, bank-account, health, or biometric documents through these prototype forms.
