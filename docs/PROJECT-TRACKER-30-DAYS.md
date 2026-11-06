# 30-day project tracker

**Planning window:** 29 October–27 November 2026 (30 calendar days, inclusive)  
**Project:** MyAgriSETA / AgriConnect 360  
**Baseline:** Working local Expo/Express prototype with seeded in-memory data.  
**Status at creation:** All rows are **Planned**; this is a proposed schedule, not a claim that work has been completed.

## How to use this tracker

- Assign a named owner during kickoff; role labels below are proposed ownership, not assigned people.
- Update status and evidence in the project workspace at each daily check-in.
- Keep production deployment out of scope until the security, privacy, persistence, and approval gates are passed.
- Dates cover calendar days. Weekend entries are reserved for lightweight review, stakeholder feedback, or contingency rather than assumed full delivery capacity.

## Daily plan

| Day | Date | Work item / deliverable | Proposed owner | Acceptance evidence | Dependency | Status |
|---:|---|---|---|---|---|---|
| 1 | Thu 29 Oct | Kickoff: confirm MVP scope, stakeholder roles, decision makers, and measurable outcomes | Product owner | Approved scope, named reviewers, and definition of done | None | Planned |
| 2 | Fri 30 Oct | Inventory current app, API routes, test coverage, environment, and prototype limitations | Tech lead | Baseline findings checked into project tracker; no secrets recorded | Day 1 | Planned |
| 3 | Sat 31 Oct | Review priority user journeys for learner, farmer, employer, SDF, provider, staff, and admin | Product + UX | Journey map and role-specific acceptance criteria | Day 1 | Planned |
| 4 | Sun 1 Nov | Stakeholder feedback window and risk/assumption log | Product owner | Feedback and open decisions captured | Day 3 | Planned |
| 5 | Mon 2 Nov | Agree data classification, minimum profile fields, ownership rules, and POPIA questions | Product + privacy lead | Data inventory and privacy review actions | Days 2–4 | Planned |
| 6 | Tue 3 Nov | Define target persistence approach and record migration/backup needs | Tech lead | Approved database decision and data lifecycle outline | Days 2, 5 | Planned |
| 7 | Wed 4 Nov | Define API validation, error format, authentication lifecycle, and RBAC matrix | Backend lead | Reviewed API contract and role-permission matrix | Days 2, 5 | Planned |
| 8 | Thu 5 Nov | Specify accessible responsive design and loading/empty/error/denied states | UX + mobile lead | Screen-state checklist covering core flows | Days 3, 7 | Planned |
| 9 | Fri 6 Nov | Security design review: token lifecycle, CORS, secrets, abuse controls, audit needs | Security + backend | Prioritized remediation list and release gates | Days 5–7 | Planned |
| 10 | Sat 7 Nov | Week 1 review; validate scope, design decisions, and estimate updates | Product + tech leads | Decisions signed off; revised tracker if needed | Days 1–9 | Planned |
| 11 | Sun 8 Nov | Contingency / async feedback on API and role matrix | Product owner | Feedback triaged; blockers assigned | Days 7, 10 | Planned |
| 12 | Mon 9 Nov | Implement persistent data access and initial schema/migration path | Backend lead | Local persistence survives restart; schema setup documented | Day 6 | Planned |
| 13 | Tue 10 Nov | Add server-side request validation and consistent API error handling | Backend lead | Invalid inputs rejected with stable status/message tests | Days 7, 12 | Planned |
| 14 | Wed 11 Nov | Harden authentication configuration, password policy, expiry, logout/revocation design | Backend + security | No unsafe default secret in deployment; lifecycle tests pass | Day 9 | Planned |
| 15 | Thu 12 Nov | Restrict CORS and add login abuse controls; review operational logging | Backend + security | Only approved origins accepted; no credentials in logs | Day 9 | Planned |
| 16 | Fri 13 Nov | Complete endpoint-level role, ownership, and eligibility checks | Backend lead | Negative authorization tests cover protected reads/writes | Days 7, 13–15 | Planned |
| 17 | Sat 14 Nov | Review application, profile, and user data privacy boundaries | Product + privacy lead | Data access cases and retention questions reviewed | Days 5, 12, 16 | Planned |
| 18 | Sun 15 Nov | Week 2 checkpoint; record missed estimates and reprioritize | Product + tech leads | Demo notes, issues, and approved scope adjustments | Days 12–17 | Planned |
| 19 | Mon 16 Nov | Implement per-user notifications and read/unread state if retained in MVP | Backend + mobile | User isolation tests and functional read-state flow | Days 12, 16 | Planned |
| 20 | Tue 17 Nov | Build/complete account administration and last-admin safety checks | Backend + mobile | Admin provisioning/status flows; guarded destructive action tests | Days 12–16 | Planned |
| 21 | Wed 18 Nov | Add durable audit events for account and role administration | Backend lead | Auditable actor/action/time records with access controls | Days 12, 20 | Planned |
| 22 | Thu 19 Nov | Finish key mobile journeys: login, dashboard, services, opportunities, applications | Mobile lead | End-to-end scenarios usable on mobile and web; errors shown clearly | Days 8, 13, 16 | Planned |
| 23 | Fri 20 Nov | Accessibility and responsive pass on core screens | UX + mobile | Keyboard/focus, labels, contrast, and viewport checklist recorded | Days 8, 22 | Planned |
| 24 | Sat 21 Nov | Stakeholder demo and acceptance feedback | Product owner | Feedback prioritized; acceptance gaps assigned | Days 19–23 | Planned |
| 25 | Sun 22 Nov | Contingency / async acceptance review | Product owner | Open acceptance items confirmed with reviewers | Day 24 | Planned |
| 26 | Mon 23 Nov | Expand tests for auth, RBAC, data ownership, application rules, and failures | QA + engineering | Focused tests pass; critical cases trace to requirements | Days 16, 19–23 | Planned |
| 27 | Tue 24 Nov | Validate setup, environment examples, API/system documentation, and recovery notes | Tech writer + tech lead | New developer follows setup from a clean checkout; docs match behavior | Days 12–26 | Planned |
| 28 | Wed 25 Nov | Run integration/regression checks and remediate release-blocking defects | QA + engineering | Test report and severity-ranked defect disposition | Days 26–27 | Planned |
| 29 | Thu 26 Nov | Production readiness review: privacy, security, operations, data, and approvals | Product + security + operations | Go/no-go checklist; unresolved risks have owners and dates | Days 5, 9, 12–28 | Planned |
| 30 | Fri 27 Nov | Closeout: demonstrate accepted scope, record carry-over, and plan next iteration | Product owner | Signed acceptance summary, updated backlog, next milestone | Days 24–29 | Planned |

## Milestones and release gates

| Gate | Target | Exit criteria |
|---|---|---|
| Scope and design agreed | 7 Nov | MVP journeys, roles, data boundaries, API contract, and security risks reviewed |
| Backend foundations | 15 Nov | Persistence path, validation, token configuration, CORS, and core authorization checks tested |
| Core journeys and admin controls | 21 Nov | Priority mobile flows usable; account, notification, and audit work demonstrated or explicitly deferred |
| Verification and closeout | 27 Nov | Critical tests and docs reviewed; blockers and production decisions recorded |

## Risks and assumptions

- The dates assume timely product, privacy, security, and stakeholder decisions; unavailable reviewers may move dependent tasks.
- Persistent storage, account recovery, notification delivery, and external services need separate technical and approval decisions.
- A 30-day plan does not itself authorize production deployment or use of real personal data.
- Seed accounts and sample content are prototype data. Official AgriSETA records, opportunities, and integrations require approved sources.
