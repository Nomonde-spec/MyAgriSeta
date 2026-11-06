# MyAgriSETA / AgriConnect 360 — Role-by-Role Presentation Script

Use this script while presenting the application page by page. It follows the demonstrated flow: **Landing page → Login → that role's Home dashboard → that role's tabs → Profile**. The Administrator has an extra **Admin** tab; the other roles do not.

Present one role at a time. Log out before starting the next role and sign in with that role's separate demo account. Never describe role selection or switching as a regular user's ability.

## Opening statement

> “MyAgriSETA, also called AgriConnect 360, is a role-aware platform concept for connecting South African agricultural stakeholders with relevant services, opportunities, learning information, and account support. In this demonstration, I will sign in as different users to show how the dashboard and permitted actions change according to each account's assigned role.”

Then set expectations:

> “This is a working prototype connected to a development API. Some listings are synthetic demonstration records, not official AgriSETA programmes. Demo course enrolments, module assessments, and started-guide records are for prototype tracking; they do not reserve a real course place or contact an external organisation. The app labels unverified content and does not claim accredited delivery, official assessment results, or certificates.”

Demo account names, usernames, and passwords are listed in [SETUP.md](./SETUP.md). Use them only in an isolated local development environment.

## Shared opening pages — show before each role

### Landing page

**Page:** Landing (`/`)  
**Signed-in user:** None.

Say:

> “This is the public welcome page. It introduces the platform as one place to learn, connect, and find information for South African agriculture. A new user can create an account here, or an existing user can continue to sign in.”

### Login page

**Page:** Login (`/login`)  
**Signed-in user:** None yet.

Say:

> “Learners can create their own accounts and sign in immediately. Other stakeholders can submit a registration request for administrator verification. Users cannot register as administrators or internal staff.”

Enter the selected demo account, then say:

> “The server authenticates this account and returns its assigned role. I am now presenting the application from that user's point of view.”

### Administrator account-management demonstration

Open the Administration screen and explain that authorized administrators can provision accounts, assign one or more roles, choose an active role, update account details or passwords, and activate or deactivate accounts. Permissions are derived from the assigned role and enforced by the API. Password changes invalidate existing sessions. The app does not independently verify identity or role claims against official registries.

## 1. Learner dashboard

**Demo account:** `learner`  
**Signed-in user:** Lerato Khumalo  
**Role:** Learner  
**Tabs, in order:** Home → Services → Opportunities → Alerts → Profile

### Home — Learner dashboard

Say:

> “This is Lerato's Learner dashboard. It welcomes her by name and summarizes her learner journey. The quick actions focus on finding learning information, viewing skills-passport information, checking her applications, and exploring opportunities. The dashboard data is associated with this signed-in account.”

Select **Find learning** to open the AgriLearn service details. Then select **Explore AgriLearn** if you want to show the learning portal.

### Services — Learner service directory

Say:

> “Services is the searchable directory. The learner can find services relevant to the learner role, review each service's description and access information, and see whether the information is a prototype or connected feature.”

Open **AgriLearn** and say:

> “AgriLearn provides a searchable demonstration course catalogue, provider directory, in-app learning guides, saved courses, demo enrolments, prototype modules and knowledge checks, and an account-linked learning list. Course and provider listings are not verified official records.”

### Opportunities — Learner opportunities

Say:

> “This page helps the learner search and filter opportunities by keyword, category, audience, status, and sorting option. The learner can inspect a detail page, save an opportunity, and track their own application.”

Open a card and point out the status, target audience, eligibility, requirements, and dates. If showing an application, say:

> “The application tracker creates a reference and shows the prototype status, but it does not submit the application to an external programme.”

### Alerts — Learner notifications

Say:

> “Alerts shows the in-app notifications available to Lerato's account, including their read or unread state. An empty list means no notification records are currently available. Email, SMS, and push delivery are not being demonstrated as live integrations.”

### Profile — Learner account

Say:

> “Profile confirms the signed-in user's name, contact identity, current role, and assigned roles. The learner can log out here, but cannot grant themselves another role.”

### Optional AgriLearn walkthrough — Learner

From the Learner's AgriLearn portal, explain the tabs:

- **Courses:** Search and filter listings, open details, save a course, and record a demo enrolment where the account role is eligible. A demo enrolment does not reserve a real place.
- **Programmes:** Choose a programme type to filter the catalogue.
- **Providers:** Browse provider demonstration records and associated course listings; select a course to view details and enrol where eligible.
- **Resources:** Start in-app guides and find them under My learning as in progress. Do not promise downloads or videos that are not configured.
- **My learning:** Review course enrolments, requests, saved courses, started guides, and private module progress. Open an enrolled demo course to complete lessons and knowledge checks. Completion is prototype-only; no certificate is issued.

Say:

> “A demonstration enrolment is not a real course place. The original prototype lessons and knowledge checks track practice progress only; they are not accredited delivery or a formal assessment and do not create a certificate. A request for a published course still needs provider confirmation.”

## 2. Farmer dashboard

**Demo account:** `farmer`  
**Signed-in user:** Sipho Ndlovu  
**Role:** Farmer  
**Tabs, in order:** Home → Services → Opportunities → Alerts → Profile

### Home — Farmer dashboard

Say:

> “This is Sipho's Farmer dashboard. It focuses on farm support and the farmer's own activity. The quick actions lead to farm support, market information, mentoring information, and the farmer's applications. The summary is generated for the Farmer role.”

### Services — Farmer service directory

Say:

> “The Farmer uses the same service directory experience, but the server returns services that this account is allowed to see. I can search the directory and inspect the description, eligibility, and prototype or availability notice.”

If opening **Farm Business Planning**, say:

> “This example describes farm planning support. It is labelled as a synthetic demonstration listing, so I am not presenting it as an official active programme.”

### Opportunities — Farmer opportunities

Say:

> “The Farmer can filter opportunities for the farming audience, open details, save relevant records, and track their own application. Eligibility and deadlines should only be treated as official when backed by a verified source.”

### Alerts — Farmer notifications

Say:

> “This page displays the in-app notification records for Sipho's account. It is not a live SMS or email inbox.”

### Profile — Farmer account

Say:

> “Profile identifies Sipho and confirms the Farmer role assigned to this account. The farmer can log out, but cannot change their own permissions.”

## 3. Employer dashboard

**Demo account:** `employer`  
**Signed-in user:** Thandi Mahlangu  
**Role:** Employer  
**Tabs, in order:** Home → Services → Opportunities → Alerts → Profile

### Home — Employer dashboard

Say:

> “This is Thandi's Employer dashboard. It focuses on employer services and workforce-development information. The metrics and quick actions relate to this employer account, its eligible opportunities, and its own application records.”

### Services — Employer service directory

Say:

> “The employer can search the service directory and open relevant employer or training services. The service details show the intended audience and whether the record is a prototype.”

### Opportunities — Employer opportunities

Say:

> “The Employer can find and filter relevant opportunities, inspect the requirements, and save or apply to records that are open to this role. A prototype application is tracked here only; it is not delivered to an external organisation.”

### Alerts — Employer notifications

Say:

> “Alerts displays the in-app notifications returned for Thandi's account. External email, SMS, or push notifications are not implied.”

### Profile — Employer account

Say:

> “Profile confirms the Employer account and assigned role. Thandi can sign out here. Account role changes must be performed by an authorized administrator.”

## 4. Skills Development Facilitator dashboard

**Demo account:** `sdf`  
**Signed-in user:** Mpho Ramokgopa  
**Role:** Skills Development Facilitator (SDF)  
**Tabs, in order:** Home → Services → Opportunities → Alerts → Profile

### Home — SDF dashboard

Say:

> “This is Mpho's Skills Development Facilitator dashboard. It highlights skills-development services, learning and provider information, and opportunities relevant to the SDF role.”

### Services — SDF service directory

Say:

> “The SDF can search the role-eligible service directory, open a service, and review its access and data-status information before relying on it.”

### Opportunities — SDF opportunities

Say:

> “The SDF can search and apply for eligible opportunities, submit skills-development programme listings for administrator review, and open the organisation's workforce-planning workspace.”

### SDF planning — assessment, WSP, ATR, and training

Say:

> “The SDF records employee-group skills gaps, builds WSP activity drafts, reports planned versus actual training in ATR records, and tracks training cohorts through delivery. The records are scoped to the verified organisation and avoid collecting employee names. Shared WSP/ATR summaries are working documents, not official submissions to AgriSETA.”

### Alerts — SDF notifications

Say:

> “This is the SDF account's in-app notification list. The screen does not mean that an external notification provider is connected.”

### Profile — SDF account

Say:

> “Profile verifies which SDF account is signed in and which role the server assigned. The SDF cannot elevate their own access.”

## 5. Training Provider dashboard

**Demo account:** `provider`  
**Signed-in user:** Naledi Maseko  
**Role:** Training Provider  
**Tabs, in order:** Home → Services → Opportunities → Alerts → Profile

### Home — Training Provider dashboard

Say:

> “This is Naledi's Training Provider dashboard. It provides shortcuts to provider services, learning information, relevant opportunities, and the provider's own submissions.”

### Services — Training Provider service directory

Say:

> “The provider can browse the role-eligible services and enter AgriLearn. Provider-specific management is available only when the authenticated account has the provider role; the role is not selected in a dashboard switcher.”

### Opportunities — Training Provider opportunities

Say:

> “The provider can explore and filter opportunities relevant to the account. Any submission or application shown is associated with this account and its permitted actions.”

### Alerts — Training Provider notifications

Say:

> “Alerts shows the in-app notifications available to Naledi. It does not claim that external notification delivery is configured.”

### Profile — Training Provider account

Say:

> “Profile identifies Naledi's provider account and current assigned role. I will sign out before presenting another role.”

### Optional AgriLearn walkthrough — Provider tools

Open **AgriLearn → Provider tools** and say:

> “The provider can submit programme listings with entry requirements and an eligible audience, and request changes to its provider profile. Listings and profile changes require administrator review. Submission does not establish accreditation or course availability.”

If listing records exist, show the provider's own submissions and course enrolment requests. Say:

> “The provider sees contact details only when a learner has consented to share them. The provider can review enrolment requests and record progress for accepted participants on its own courses.”

## 6. Administrator dashboard

**Demo account:** `admin`  
**Signed-in user:** Nandi Mokoena  
**Role:** Administrator  
**Tabs, in order:** Home → Admin → Services → Opportunities → Alerts → Profile

Suggested introduction:

> “I am signed in as Nandi, the Administrator. This dashboard includes the standard tabs plus an Admin tab. Learners can register and access the platform without waiting for approval; other stakeholder role requests are reviewed by the administrator. Privileged administrative roles cannot be self-assigned.”

### Home — Administration dashboard

Say:

> “This is the Administrator Home page. It presents a platform overview, including account counts and recent administrative activity. The quick actions provide routes to user management, audit activity, the service directory, notifications, and review tasks.”

Point out that the counts reflect the current development data and are not an official AgriSETA report.

### Admin — account administration

Say:

> “The Admin tab lists and searches registered user accounts. Learners can register themselves and sign in immediately. Farmer, employer, SDF, and training-provider role requests are reviewed by the administrator before sign-in is enabled. Administrators can also activate or deactivate accounts.”

Continue:

> “Server-side rules protect administrative actions and prevent disabling the last active administrator. Administrator and internal-staff accounts cannot be self-registered; authorized administrators provision those accounts.”

Do not create a real person's account during a presentation. If demonstrating self-registration, use disposable synthetic details and a test email address.

### Services — Administrator service directory

Say:

> “The administrator can search and inspect the service directory. Each service describes its intended audience and data status. Administrative visibility does not make a prototype listing official or mean an external system is connected.”

Open a service detail if useful. For **AgriLearn**, say:

> “AgriLearn opens the agricultural learning portal. Its demonstration course and provider records are not verified official listings.”

### Opportunities — Administrator opportunities

Say:

> “The Administrator can inspect the opportunity catalogue, search and filter records, open details, and review the information presented to users. Listings and application states remain subject to the same prototype-data notices.”

### Alerts — Administrator notifications

Say:

> “This page shows in-app notifications associated with the Administrator account, including the displayed read state. It is not a live email or SMS integration.”

### Profile — Administrator account

Say:

> “Profile confirms Nandi's Administrator identity and assigned role. I will log out here before starting the next role demonstration.”

### Optional AgriLearn walkthrough — Learning administration

Open **AgriLearn → Learning administration** and say:

> “The Administrator can review provider profiles, programme listings, and enrolment requests, and administer learning categories and in-app guides. Demonstration enrolments are not provider-reviewed. Publishing a listing is a workflow decision; it does not independently verify accreditation or official AgriSETA status.”

If demonstrating a category or guide, create a temporary record and remove it afterward.

### Optional Administrator review pages

If showing **Audit activity** or **Review applications**, say:

> “These are restricted administrative or staff workflows. The server checks authorization for these actions. Audit records reflect only the events captured by this prototype and should not be presented as a complete production audit system.”

## Optional 7. Internal Staff role

**Demo account:** `multirole`  
**Role to present:** Internal Staff only if the account is already authenticated with that assigned role. The demo account initially uses Administrator; do not imply users can switch roles themselves.  
**Tabs:** Home → Services → Opportunities → Alerts → Profile. There is no Admin tab for Internal Staff.

### Home — Internal Staff dashboard

Say:

> “This is the Staff dashboard. It focuses on the application review queue and review-related opportunities assigned to staff functions.”

### Services — Internal Staff service directory

Say:

> “Staff can inspect the service directory for their assigned work. A staff role is not the same as Administrator account-management access.”

### Opportunities — Internal Staff opportunities

Say:

> “This page lets staff inspect opportunities, including review opportunities where available. Any review action remains subject to server-side authorization.”

### Alerts — Internal Staff notifications

Say:

> “This page shows in-app alerts for the staff account when notification records are available.”

### Profile — Internal Staff account

Say:

> “Profile confirms the staff role associated with the active authenticated session. Staff cannot use this screen to grant themselves administrator privileges.”

## Shared details to explain when they appear

### Opportunity detail and application tracker

> “The detail page groups the description, eligibility, benefits, required documents, instructions, and any configured dates. The application tracker shows the signed-in user's reference and status. If the record is labelled as synthetic or prototype content, the dates and criteria are not official, and the application is not sent externally.”

### Back button and navigation

> “The Back button returns to the previous page when there is safe navigation history. If the page was opened directly, it returns to the appropriate parent instead of leaving a blank page.”

### Loading, empty, and error states

> “The application shows loading, empty, unavailable, and error states. It does not invent notifications, applications, official learning results, or certificates to make the screen look populated. Any module progress shown is prototype-only.”

## Closing statement

> “This demonstration shows a shared agricultural platform with separate, authenticated experiences for learners, farmers, employers, skills development facilitators, training providers, and administrators. Search, saved records, application tracking, demo enrolments, started guides, provider submissions, and administrative review are connected to the development API. Course and provider listings are demonstration records. Verified AgriSETA data, external provider integrations, real course delivery, and production persistence require approved sources and configuration.”

## Presenter checklist

- [ ] Start the backend and mobile app; verify the API health endpoint.
- [ ] Begin each role presentation at Landing and Login, then identify the signed-in name and role before showing Home.
- [ ] Follow the role's tab sequence in this guide; only the Administrator should have an Admin tab.
- [ ] Log out between roles. Do not present role switching as a user-facing feature.
- [ ] Use local demo accounts only; never enter real personal information in a demo.
- [ ] Clearly distinguish synthetic demo listings from verified official information.
- [ ] Do not claim external applications, messages, accreditation, or course delivery are live.
- [ ] Clean up disposable administrator changes after the demonstration.
- [ ] Confirm Neon is connected; the API does not run with an in-memory or alternate-database fallback.
