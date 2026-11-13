# MyAgriSETA / AgriConnect 360 — Role-by-Role Presentation Script

Use this script as a practical walk-through of the current mobile-first application. The persistent bottom navigation has four tabs for every signed-in role: **Home → Services → Passport → Profile**. Opportunities, applications, notifications, administration, review, Farmer Hub, and AgriLearn open from Home quick actions, the notification bell, or a service card; SDF workforce planning opens from the SDF Opportunities workspace. These are not bottom tabs.

Present one role at a time. Log out before starting the next role and sign in with that role's separate demo account. Never describe role selection or switching as a regular user's ability.

## Opening statement

> “MyAgriSETA, also called AgriConnect 360, is a role-aware agricultural services prototype. It gives learners, farmers, employers, skills development facilitators, training providers, and administrators one place to find relevant information and use account-based workflows. I will demonstrate how the experience changes according to the signed-in account.”

Then set expectations:

> “This is a development prototype connected to an API and Neon database. Some listings are synthetic demonstration records, not official AgriSETA programmes. In-app applications and demo learning progress do not submit applications externally, reserve a real course place, establish accreditation, or create official assessment results or certificates. The app labels prototype and unverified content.”

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

**Presenter note:** Save account provisioning and role-management screens for the Administrator segment. An administrator may assign roles and an active role to an account; users cannot switch into an unassigned role themselves.

## 1. Learner dashboard

**Demo account:** `learner`
**Signed-in user:** Lerato Khumalo
**Role:** Learner
**Bottom tabs:** Home → Services → Passport → Profile
**Home shortcuts:** Find learning, My passport, Applications, Explore opportunities. Notifications open from the bell.

### Home — Learner dashboard

Say:

> “This is Lerato's Learner dashboard. It welcomes her by name and summarizes her learner journey. The quick actions focus on finding learning information, viewing skills-passport information, checking her applications, and exploring opportunities. The dashboard data is associated with this signed-in account.”

Select **Find learning** to open the learning-programmes service. Use **Explore opportunities** to open the opportunity list and **Applications** to review this account's own applications.

### Services — Learner service directory

Say:

> “Services is a searchable directory with category filters for Learning, Funding, and Work. Each card opens the relevant listing, feature, or information page. Its status note explains the current limits—for example, sample job entries are not real vacancies, the Skills Passport is self-reported, and no grant application service is connected.”

Explain that each service card is an entry point, not proof of an external integration:

- **Learning Programmes** opens AgriLearn: searchable course and provider listings, in-app guides, saved courses, demo enrolments, prototype modules, and knowledge checks. Listings and providers are not independently verified.
- **Bursaries & Funding**, **Grant Applications**, **Workplace Experience**, and **AgriJobs** open opportunity lists. Sample entries are not real offers; the app's application tracker does not send an application to an external organisation.
- **Provider Directory** opens provider listings in AgriLearn. These are demo records unless independently verified.
- **Career Pathways** provides prototype career and mentoring information; mentor matching is not connected through this card.
- **Skills Passport** opens the user's self-reported skills and credential records. There is no trusted issuer or public credential-verification service.
- **Employer Services** and **Skills Planning** provide workforce-development information. External employer systems and official WSP/ATR submission are not connected.
- **Support Centre** provides account guidance, but no support contact channel is connected.

### Opportunities — Learner opportunities

Say:

> “This page helps the learner search and filter opportunities by keyword, category, audience, status, and sorting option. The learner can inspect a detail page, save an opportunity, and track their own application.”

Open a card and point out the status, target audience, eligibility, requirements, and dates. If showing an application, say:

> “The application tracker creates a reference and shows the prototype status, but it does not submit the application to an external programme.”

If the learner has already applied to an opportunity, explain that an active application is hidden from that learner's opportunity browse list. The application remains available from **Applications**.

### Notifications — Learner account

Say:

> “The notification bell opens the in-app notifications for Lerato's account, with read/unread state. If transactional email is enabled and configured on the backend, account notifications and application-status updates are also sent to the account's registered email. The app can show a delivery attempt and the destination, but SMTP acceptance does not prove that a message reached the inbox. SMS and push delivery are not configured.”

### Profile — Learner account

Say:

> “Profile confirms the signed-in user's account and assigned role. Learners can manage permitted profile fields and their optional employer-search visibility, and can log out here. They cannot grant themselves another role.”

### Optional AgriLearn walkthrough — Learner

From the Learner's AgriLearn portal, explain the tabs:

- **Courses:** Search and filter listings, open details, save a course, and record a demo enrolment where the account role is eligible. A demo enrolment does not reserve a real place.
- **Programmes:** Choose a programme type to filter the catalogue.
- **Providers:** Browse provider demonstration records and associated course listings; select a course to view details and enrol where eligible.
- **Resources:** Start in-app guides and find them under My learning as in progress. Do not promise downloads or videos that are not configured.
- **My learning:** Review course enrolments, requests, saved courses, started guides, and private module progress. Open an enrolled demo course to complete lessons and knowledge checks. Completion is prototype-only; no certificate is issued.

Say:

> “A demonstration enrolment is not a real course place. The original prototype lessons and knowledge checks track practice progress only; they are not accredited delivery or a formal assessment and do not create a certificate. A request for a published course still needs provider confirmation.”

### Passport — learner skills passport

Say:

> “The Passport tab shows the learner's account-linked credentials and self-reported skills. A user can add or manage their own skill entries and share or download a summary. These are not verified credentials; no trusted issuer or public credential-verification service is connected.”

## 2. Farmer dashboard

**Demo account:** `farmer`
**Signed-in user:** Sipho Ndlovu
**Role:** Farmer
**Bottom tabs:** Home → Services → Passport → Profile
**Home shortcuts:** Farm hub, Find training, Funding & support, Mentor interest. Notifications open from the bell.

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

> “The Farmer can open the Farmer Hub for agricultural guides, market information, and mentor requests, and use opportunities to find eligible funding, training, business-support, and mentorship listings. Source details and expiry are shown for curated information; source attribution does not itself guarantee that an offer is official. In-app applications do not submit to the external provider.”

### Notifications — Farmer account

Say:

> “The notification bell opens Sipho's in-app notices. If configured, transactional email is sent to the account's registered email; the app's SMTP status does not guarantee inbox delivery. SMS and push are not connected.”

### Profile — Farmer account

Say:

> “Profile identifies Sipho and confirms the Farmer role assigned to this account. The farmer can log out, but cannot change their own permissions.”

## 3. Employer dashboard

**Demo account:** `employer`
**Signed-in user:** Thandi Mahlangu
**Role:** Employer
**Bottom tabs:** Home → Services → Passport → Profile
**Home shortcuts:** Employer-specific opportunities, candidate discovery, and recruitment tools. Notifications open from the bell.

### Home — Employer dashboard

Say:

> “This is Thandi's Employer dashboard. It focuses on employer services and workforce-development information. The metrics and quick actions relate to this employer account, its eligible opportunities, and its own application records.”

### Services — Employer service directory

Say:

> “The employer can search the service directory and open relevant employer or training services. The service details show the intended audience and whether the record is a prototype.”

### Opportunities — Employer opportunities

Say:

> “The Employer can submit job, internship, workplace-experience, and learner-facing training-need listings for administrator review. Training providers or SDFs may be the sponsor or delivery partner for a Training Need; learners are the intended participants. Employers can also search limited candidate profiles only when a learner or farmer has opted in, send an in-app invitation, and review applications to their own listings. Candidate contact details stay private until the person applies. The workflow does not send listings to an external job board.”

### Notifications — Employer account

Say:

> “The notification bell shows Thandi's account notices. Application and workflow emails may be sent when backend SMTP is configured; the in-app status only reports SMTP acceptance, not confirmed inbox delivery. SMS and push are not configured.”

### Profile — Employer account

Say:

> “Profile confirms the Employer account and assigned role. Thandi can sign out here. Account role changes must be performed by an authorized administrator.”

## 4. Skills Development Facilitator dashboard

**Demo account:** `sdf`
**Signed-in user:** Mpho Ramokgopa
**Role:** Skills Development Facilitator (SDF)
**Bottom tabs:** Home → Services → Passport → Profile
**Home shortcuts:** Skills Passport, Learning services, Training providers, Opportunities, and My applications. Open the **Opportunities** workspace, then choose **Open SDF planning workspace** for WSP/ATR and workforce records. Notifications open from the bell.

### Home — SDF dashboard

Say:

> “This is Mpho's Skills Development Facilitator dashboard. It highlights role-eligible services, opportunities, and the organisation's workforce-planning workflow.”

### Services — SDF service directory

Say:

> “The SDF can search the role-eligible service directory, open a service, and review its access and data-status information before relying on it.”

### Opportunities — SDF opportunities

Say:

> “The SDF can search and apply for eligible opportunities, submit skills-development programme listings for administrator review, and open the organisation's workforce-planning workspace.”

### SDF planning — assessment, WSP, ATR, and training

Say:

> “The SDF records employee-group skills gaps, builds WSP activity drafts, reports planned versus actual training in ATR records, and tracks training cohorts through delivery. The records are scoped to the verified organisation and avoid collecting employee names. Shared WSP/ATR summaries are working documents, not official submissions to AgriSETA.”

### Notifications — SDF account

Say:

> “The notification bell opens account-scoped in-app notices. Email depends on the configured SMTP service; SMTP acceptance is not proof of inbox delivery. SMS and push are not connected.”

### Profile — SDF account

Say:

> “Profile verifies which SDF account is signed in and which role the server assigned. The SDF cannot elevate their own access.”

## 5. Training Provider dashboard

**Demo account:** `provider`
**Signed-in user:** Naledi Maseko
**Role:** Training Provider
**Bottom tabs:** Home → Services → Passport → Profile
**Home shortcuts:** Provider-specific services, learning tools, and own submissions. Notifications open from the bell.

### Home — Training Provider dashboard

Say:

> “This is Naledi's Training Provider dashboard. It provides shortcuts to provider services, learning information, relevant opportunities, and the provider's own submissions.”

### Services — Training Provider service directory

Say:

> “The provider can browse services and open Learning Programmes to reach AgriLearn. Provider-specific management is available only to an account assigned the provider role; users cannot switch into an unassigned role.”

### Opportunities — Training Provider opportunities

Say:

> “The provider can submit learning programmes and learner-facing training opportunities for administrator review, manage their own submissions, and respond to enrolment requests on their own courses. A provider can sponsor or deliver learner training; the Training Need audience should be the learners who need that training. Publication does not prove accreditation or official status.”

### Notifications — Training Provider account

Say:

> “The notification bell shows Naledi's in-app notices. Transactional email is conditional on backend SMTP configuration; SMTP acceptance is not confirmed inbox delivery. SMS and push are not configured.”

### Profile — Training Provider account

Say:

> “Profile identifies Naledi's provider account and current assigned role. I will sign out before presenting another role.”

### Optional AgriLearn walkthrough — Provider tools

Open **Services → Learning Programmes → AgriLearn → Provider tools** and say:

> “The provider can submit programme listings with entry requirements and an eligible audience, and request changes to its provider profile. Listings and profile changes require administrator review. Submission does not establish accreditation or course availability.”

If listing records exist, show the provider's own submissions and course enrolment requests. Say:

> “The provider sees contact details only when a learner has consented to share them. The provider can review enrolment requests and record progress for accepted participants on its own courses.”

## 6. Administrator dashboard

**Demo account:** `admin`
**Signed-in user:** Nandi Mokoena
**Role:** Administrator
**Bottom tabs:** Home → Services → Passport → Profile
**Home shortcuts:** Manage users and announcements, reports and audit activity, service directory, notifications, and application review. The Admin workspace is opened from its Home shortcut, not a persistent bottom tab.

Suggested introduction:

> “I am signed in as Nandi, the Administrator. The same four bottom tabs appear, while administrative tools are opened from the Home dashboard. Learners can register and access the platform immediately; farmer, employer, SDF, and provider registrations require administrator review. Administrator and internal-staff roles cannot be self-registered.”

### Home — Administration dashboard

Say:

> “This is the Administrator Home page. It presents a platform overview, including account counts and recent administrative activity. The quick actions provide routes to user management, audit activity, the service directory, notifications, and review tasks.”

Point out that the counts reflect the current development data and are not an official AgriSETA report.

### Administration — account management

Say:

> “The Administration workspace lists and searches user accounts, reviews stakeholder role requests, and lets authorized administrators provision accounts, assign roles, update account details, and activate or deactivate users. Role permissions are enforced by the API.”

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

> “The Administrator can review submitted opportunities, approve or reject them, publish eligible listings, and manage published content. Learners only see opportunities that are published and eligible for their account. Review and publication do not independently verify accreditation, official status, or external availability.”

### Notifications — Administrator account

Say:

> “The notification bell opens in-app notices for the Administrator account. If SMTP is configured, transactional email may be sent to each account's registered email address. The app can show a recipient and SMTP acceptance, but does not confirm inbox delivery. SMS and push are not configured.”

### Profile — Administrator account

Say:

> “Profile confirms Nandi's Administrator identity and assigned role. I will log out here before starting the next role demonstration.”

### Optional AgriLearn walkthrough — Learning administration

Open **Services → Learning Programmes → AgriLearn → Learning administration** and say:

> “The Administrator can review provider profiles, programme listings, and enrolment requests, and administer learning categories and in-app guides. Demonstration enrolments are not provider-reviewed. Publishing a listing is a workflow decision; it does not independently verify accreditation or official AgriSETA status.”

If demonstrating a category or guide, create a temporary record and remove it afterward.

### Optional Administrator review pages

If showing **Audit activity** or **Review applications**, say:

> “These are restricted administrative or staff workflows. The server checks authorization for these actions. Audit records reflect only the events captured by this prototype and should not be presented as a complete production audit system.”

## Optional 7. Internal Staff role

**Demo account:** `multirole`
**Role to present:** Internal Staff only when an authorized administrator has assigned that role and made it the account's active role. The `multirole` demo account initially signs in as Administrator; an administrator must update its active role before a separate sign-in. Do not imply users can switch roles themselves.
**Bottom tabs:** Home → Services → Passport → Profile. There is no user-management workspace for Internal Staff.

### Home — Internal Staff dashboard

Say:

> “This is the Staff dashboard. It focuses on the application review queue and review-related opportunities assigned to staff functions.”

### Services — Internal Staff service directory

Say:

> “Staff can inspect the service directory for their assigned work. A staff role is not the same as Administrator account-management access.”

### Opportunities — Internal Staff opportunities

Say:

> “This page lets staff inspect opportunities, including review opportunities where available. Any review action remains subject to server-side authorization.”

### Notifications — Internal Staff account

Say:

> “The notification bell shows in-app alerts for this staff account. Transactional email depends on SMTP configuration and is not proof of inbox delivery; SMS and push are not configured.”

### Profile — Internal Staff account

Say:

> “Profile confirms the staff role associated with the active authenticated session. Staff cannot use this screen to grant themselves administrator privileges.”

## Shared details to explain when they appear

### Opportunity detail and application tracker

> “The detail page groups the description, eligibility, benefits, required documents, instructions, and configured dates. Applicants can save a draft, submit an application, and track their own reference and status. Active applications are hidden from that user's opportunity browse list. In-app submissions are not automatically transmitted to an external organisation; where an external link is provided, the applicant must follow it separately.”

### Back button and navigation

> “The Back button returns to the previous page when there is safe navigation history. If the page was opened directly, it returns to the appropriate parent instead of leaving a blank page.”

### Loading, empty, and error states

> “The application shows loading, empty, unavailable, and error states. It does not invent notifications, applications, official learning results, or certificates to make the screen look populated. Any module progress shown is prototype-only.”

### Service cards and filters

> “The Services screen searches and filters cards by Learning, Funding, and Work. Cards may open listings, account features, or informational pages. Check each card's status note: a directory listing or in-app workflow does not by itself mean that an external service is connected. The learner walkthrough above explains the current cards and their limits.”

## Closing statement

> “This demonstration shows authenticated, role-aware experiences for learners, farmers, employers, SDFs, training providers, administrators, and internal reviewers. Search, account-scoped applications, saved records, demo learning progress, provider submissions, and administrative review are connected to the development API and Neon database. Some records are synthetic. SMTP email is conditional on backend configuration and acceptance does not confirm inbox delivery. Verified AgriSETA data, external provider integrations, accredited course delivery, and production readiness require approved sources, integrations, and further operational work.”

## Presenter checklist

- [ ] Start the backend and mobile app; verify the API health endpoint.
- [ ] Begin each role presentation at Landing and Login, then identify the signed-in name and role before showing Home.
- [ ] Show the four persistent tabs (Home, Services, Passport, Profile); open opportunities, notifications, and role tools through the relevant shortcuts.
- [ ] Log out between roles. Do not present role switching as a user-facing feature.
- [ ] Use local demo accounts only; never enter real personal information in a demo.
- [ ] Clearly distinguish synthetic demo listings from verified official information.
- [ ] Do not claim applications are sent externally, SMTP acceptance means inbox delivery, or that accreditation/course delivery is live.
- [ ] Clean up disposable administrator changes after the demonstration.
- [ ] Confirm Neon is connected; the API does not run with an in-memory or alternate-database fallback.
