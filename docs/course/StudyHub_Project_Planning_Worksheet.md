# SOFTWARE PROJECT PLANNING WORKSHEET

**StudyHub: Web-Based Co-Working Space and Study Spot Discovery and Reservation Platform**

Proposed Software System: StudyHub Web Application (Software Development 1)

*Team Members: Adrian Seth Tabotabo, Maria Faith Antigua, Luke Miguel Dongque, James Niño Mandawe*

# PART 1. PROBLEM IDENTIFICATION

**1. What is the current problem?**

Students, freelancers, and remote learners frequently struggle to locate reliable, quiet, and conducive study environments with essential productivity amenities (stable high-speed Wi-Fi, accessible power outlets, adequate desk space, and quiet zones). In our preliminary user survey (Study Hub & Workspace Habits Survey, N = 16), 75% of respondents reported arriving at study hubs in person without checking availability beforehand, and 50% have personally arrived only to find that no seats or power sockets were available. Consolidated, trustworthy information on hourly rates, socket availability, noise levels, and exact operating hours remains fragmented across unmaintained social media pages, leaving 75% of users stuck returning to the same suboptimal spot simply because finding alternatives takes too much effort (rated 4.19 / 5.0).

**2. Who experiences or is affected by this problem?**

- University and College Students: learners preparing for exams, research writing, and group projects who need quiet, affordable spaces with reliable power and internet.

- Remote Workers and Freelancers: professionals and online examinees who need distraction-free desks, ergonomic seating, and meeting rooms.

- Study Cafe and Co-Working Space Owners/Managers: small operators who face unpredictable seat utilization, peak-hour congestion, walk-in friction, and uncoordinated social-media inquiries (43.8% of surveyed users found messaging response times unacceptably slow).

**3. What are the effects of the problem?**

**Effect 1 — Lost Productive Time and Commuter Frustration:**

Users spend significant time and transport cost travelling to study locations only to be turned away for lack of seats or sockets, disrupting study routines. As one respondent put it: "Most study hubs are far... it is a hassle to arrive only to find no available space and have to look for another, wasting study time instead of learning."

**Effect 2 — Compromised Focus and Mental Fatigue:**

When suitable spaces cannot be found, users settle for noisy or poorly equipped areas (50% cite noise and socket shortages as primary disruptions), lowering concentration and output and leaving devices uncharged.

**Effect 3 — Inefficient Space Management and Lost Revenue for Hosts:**

Hosts experience chaotic overcrowding at peak hours and under-utilization off-peak, while spending staff time answering repetitive messages about availability.

# PART 2. PROJECT GOAL

**What is the main goal of the proposed software system?**

To develop a responsive, centralized web application that streamlines the discovery, verification, and immediate reservation of conducive study spaces and co-working hubs — providing a live, host-updated view of seat availability, verified amenities (Wi-Fi tier, power sockets, noise level), and operating schedules, so users can hold a specific open seat before they travel and Hosts can keep their space accurately represented with minimal effort.

# PART 3. PROJECT STAKEHOLDERS

*People or groups who will use, manage, develop, or be affected by the system.*

| **No.** | **Stakeholder** | **Role or Interest in the System** |
|----|----|----|
| 1 | **Students & Academic Researchers** | Primary end-users seeking quiet, affordable study environments with guaranteed desks, power, and Wi-Fi; search, view live availability, and hold seats to use now. |
| 2 | **Remote Workers & Freelancers** | Professional end-users needing reliable internet, ergonomic seating, and meeting rooms for focused remote work; interested in amenity verification and quick holds. |
| 3 | **Study Hub & Co-Working Space Owners/Managers** | Service providers who list facilities, build the seat map, keep occupancy current, configure rates/amenities, and optimize venue revenue. |
| 4 | **Platform Administrator** | Verifies owner legitimacy and facility quality, moderates reviews and disputes, oversees sandbox payments/refunds, and maintains platform health. |
| 5 | **Software Development Team** | Adrian Seth Tabotabo, Maria Faith Antigua, Luke Miguel Dongque, James Niño Mandawe — responsible for architecture, frontend UI/UX, backend APIs, database, quality assurance, and maintenance. |

# PART 4. PROJECT SCOPE

## A. Features Included in the Project

| **No.** | **Feature / Function** |
|----|----|
| 1 | User Authentication & Role Management: secure multi-role registration and login via Supabase Auth, with Row-Level Security enforcing roles for Study Seekers, Space Hosts, and Administrators. |
| 2 | Interactive Geo-Map & Multi-Filter Discovery: search by location/campus and filter by a curated tag set — Wi-Fi tier, power-outlet availability, noise level, air-conditioning, operating hours, price tier, and room type. Hosts may add free-text custom tags for display. |
| 3 | Space Profiles & Live, Host-Updated Availability: photos, amenity tags, pricing, operating hours, and a live seat map showing open units with a "last updated" timestamp. |
| 4 | Host-Built Snap-Grid Seat Map: Hosts lay out individual seats, standing desks, and whole-unit rooms on a grid; Seekers pick an exact unit. |
| 5 | Reserve-Now Booking with Guaranteed Holds: hold a currently-open unit, pay a small sandbox reservation fee, receive a QR code, set a wait window, and check in on arrival; unclaimed holds auto-release (no-show) and the fee is forfeited. |
| 6 | Host Occupancy Management: one-tap control to set any unit Available, Reserved, or Occupied — including walk-ins — from the seat map. |
| 7 | Community Reviews & Administration: amenity reviews restricted to checked-in visitors, plus administrator venue verification and content moderation. |

## B. Features NOT Included in the First Version

| **No.** | **Feature Not Included** |
|----|----|
| 1 | Real-Money Payment Settlement: v1 processes reservation fees only in the payment gateway’s sandbox/test mode to demonstrate the guaranteed-hold flow; the venue’s usage fee is settled on-site. Live capture (GCash/Maya/card) with merchant onboarding, KYC, refunds, and dispute handling is deferred to a future release. |
| 2 | Advance / Future Scheduling: the model is current-state only — users hold seats that are open now and cannot book a seat for a later date or time. |
| 3 | Physical IoT Desk-Occupancy Sensors: excluded to avoid hardware cost, installation, and maintenance; availability is host-maintained. |
| 4 | In-App Virtual Study Rooms & Video Conferencing: excluded to avoid feature bloat and WebRTC bandwidth cost; focus stays on physical workspace discovery and holds. |

**Why is it important to define what is NOT included in the project?**

Defining out-of-scope features prevents scope creep — the uncontrolled expansion of requirements without matching time and resources. For an academic project on a 14-week semester, excluding real-money processing (with its fees, KYC, and financial liability), future scheduling, IoT hardware, and video conferencing lets the team deliver a stable, secure Minimum Viable Product. It sets clear boundaries, manages stakeholder expectations, and minimizes technical and financial risk while still demonstrating the full guaranteed-hold experience via sandbox payments.

# PART 5. PROJECT RESOURCES

| **Resource Category** | **Resources Needed** |
|----|----|
| **People** | 4 Developers / System Engineers (Adrian Seth Tabotabo, Maria Faith Antigua, Luke Miguel Dongque, James Niño Mandawe) covering frontend, backend, database, and quality testing. |
| **Hardware** | Development laptops (Intel Core i5/i7, 16 GB RAM), local Wi-Fi, and test devices (Windows/Mac desktops, Android and iOS phones for responsive testing, plus a device camera for QR check-in testing). |
| **Software / Development Tools** | VS Code, Git & GitHub, Next.js / React, Node.js, Tailwind CSS, Supabase (PostgreSQL, Auth, Row-Level Security) accessed only through the Supabase client, Leaflet.js / OpenStreetMap, PayMongo or Stripe sandbox, Postman, and modern browsers. |
| **Internet / Network** | High-speed broadband (min. 50 Mbps) for repository sync, package installation, cloud database queries, and deployment testing. |
| **Budget** | ₱0 – ₱2,500. Free-tier hosting (Vercel, Supabase, GitHub), open-source libraries, free OpenStreetMap tiles, and free sandbox payments; small contingency for domain registration if deployed publicly. |
| **Time** | 14 weeks: Requirements Analysis (Wk 1–3), System Design (Wk 4–5), Sprint Development — three two-week sprints (Wk 6–11), QA & Integration Testing (Wk 12), Final Evaluation & Deployment (Wk 13–14). |

# PART 6. FEASIBILITY ANALYSIS

## A. Technical Feasibility

**☑ Highly Feasible ☐ Feasible ☐ Not Feasible**

Explanation: The stack (Next.js, Node.js, Supabase/PostgreSQL, Leaflet) relies on mature, well-documented web technologies. Using Supabase Auth and Row-Level Security removes the need to build a custom auth stack, and a payment gateway’s sandbox lets the team implement the full payment flow without financial-integration risk. The seat map is the most complex part, so a grid-based (snap) layout was chosen over a freeform floor-plan editor to keep it achievable. The team has working proficiency in JavaScript/TypeScript, relational databases, and REST APIs.

## B. Economic Feasibility

**☑ Highly Feasible ☐ Feasible ☐ Not Feasible**

Explanation: Development cost is negligible — generous free tiers for hosting (Vercel), managed database/auth (Supabase), version control (GitHub), mapping (OpenStreetMap), and sandbox payments. No licenses or upfront capital are required. Preliminary survey data (N = 16) indicates demand: 62.5% frequently visit paid study hubs and spend on workspaces, and 75% were willing to hold seats digitally.

## C. Operational Feasibility

**☑ Highly Feasible ☐ Feasible ☐ Not Feasible**

Explanation: Adoption looks promising: 87.5% of respondents gave a top rating (avg 4.50 / 5.0) to a consolidated map with pricing and amenities, and 75% want to check availability before leaving home. Hosts gain a free, simple tool to keep occupancy current and cut repetitive messaging. The browser-based interface needs no installation. The main operational dependency — that Hosts keep the seat map current — is mitigated by one-tap state controls and a visible "last updated" time.

## D. Schedule Feasibility

**☑ Yes ☐ Possibly ☐ No**

**Expected Development Time: 14 Weeks (1 Academic Semester)**

Explanation: The 14-week schedule is achievable due to disciplined scoping. High-risk dependencies (real-money processing, future scheduling, IoT hardware, video conferencing) were deliberately excluded. Work is distributed across the 4-member team using two-week Agile-Scrum sprints, with Weeks 12–14 reserved for QA, bug-fixing, and user acceptance testing.

# PART 7. PROJECT RISKS

| **No.** | **Possible Risk** | **Possible Effect** | **Suggested Solution / Response** |
|----|----|----|----|
| 1 | Availability accuracy depends on Hosts keeping the seat map current (walk-in vs. app). | Stale counts or a Seeker arriving to find a seat taken, damaging trust. | One-tap host state control on the snap-grid seat map; reserve-now only (a Seeker can never hold an occupied seat); paid holds the system guarantees; a visible "last updated" timestamp; and automatic release when the seeker-set wait window expires. |
| 2 | Two-sided cold start — few initial host listings. | Users perceive the platform as unhelpful and abandon it. | Curate an initial directory of popular student study spots near campus with verified public info, and offer free, zero-commission onboarding to local hosts. |
| 3 | Concurrent hold conflicts during exam-week peaks. | Race conditions causing double-booking of the same unit. | Enforce one active hold per unit within a single atomic PostgreSQL transaction (no external lock service needed), backed by Vercel serverless auto-scaling. |
| 4 | Sandbox-only payments limit the real no-show deterrent. | The fee-forfeiture guard is demonstrated but not monetized in v1; refund/dispute logic must still be modeled. | Implement the full flow in sandbox with paid/forfeited/refunded states and administrator refunds; document real-money rollout (merchant onboarding, KYC) as future work. |

# PART 8. PROJECT PRIORITIES

|  |  |
|----|----|
| **Most Important Feature** | Live, host-updated availability with exact-seat, reserve-now booking and a system-guaranteed paid hold. |
| **Most Important Resource Needed** | Reliable managed database, authentication, and hosting (Supabase + Vercel) for dependable uptime and state consistency. |
| **Biggest Project Risk** | Availability accuracy depending on Hosts keeping the seat map current. |
| **Most Important Stakeholder** | End users (Students and Remote Learners), whose adoption and feedback drive platform relevance. |

# PART 9. PROJECT DECISION

**☑ Proceed with the Project**

☐ Proceed with Modifications

☐ Do Not Proceed

**Justification for Your Decision**

The group unanimously recommends proceeding. StudyHub addresses a validated, urgent problem for students and remote professionals (87.5% wanted an integrated discovery map and 75% wanted to check live availability before leaving). With an open-source web stack, managed auth/database, zero licensing cost, sandbox payments that demonstrate the guaranteed-hold flow at no financial risk, a manageable 14-week schedule, and a clearly bounded current-state MVP, StudyHub is a low-risk, high-impact solution that delivers immediate practical value.

# PART 10. PROJECT PLANNING SUMMARY

|  |  |
|----|----|
| **Problem** | Students and remote workers waste study time travelling to hubs only to find no available seats or sockets, with amenity information scattered and unreliable. |
| **Proposed Software Solution** | StudyHub: a centralized web app for map discovery, amenity verification, and immediate (reserve-now) holds of an exact seat on a host-built seat map. |
| **Main Users** | University students, researchers, remote freelancers, and study hub / co-working managers. |
| **Main Features** | Role-based accounts (Supabase Auth), geo-search with curated tag filters, host-built seat map, live host-updated availability, and reserve-now holds with sandbox reservation fees and QR check-in. |
| **Major Resource Needed** | Full-stack team (4), managed cloud database/auth and hosting (Supabase & Vercel), and cross-device test hardware. |
| **Major Risk** | Availability accuracy depending on host updates; mitigated by one-tap host controls, reserve-now-only logic, guaranteed paid holds, timestamps, and no-show auto-release. |
| **Feasibility Result** | Highly Feasible across Technical, Economic, Operational, and Schedule dimensions. |
| **Final Decision** | Proceed with the Project. |

# GROUP REFLECTION

**Why is the Planning Phase important before developers begin designing and programming a software system?**

The planning phase bridges human needs and technical implementation before any code is written. Without it, teams fall prey to scope creep, architectural misalignment, conflicting priorities, and wasted effort on features users do not need.

Our preliminary survey (N = 16) surfaced a critical reality: while 75% of users want live seat tracking, their biggest concern is data accuracy between walk-ins and digital bookings. Identifying this early led us to a current-state ("reserve-now") model where users only hold seats that are open now — so the system can guarantee an advance-paid hold, and the accuracy of the live view depends on simple host updates shown with a "last updated" time. It also led us to guard no-shows with a small sandbox reservation fee (forfeited when the chosen wait window of the seeker expires without a check-in) rather than free bookings that trolls could abuse.

Planning also enabled disciplined scope delimitation — deferring real-money processing, future scheduling, IoT hardware, and video conferencing — to protect the 14-week timeline, and steered concrete architecture choices such as Supabase Auth with Row-Level Security, a grid-based seat map, and atomic database transactions to prevent double-booking. In short, thorough planning minimized financial and technical risk, aligned the team, set measurable evaluation criteria, and produced the blueprint for software that is robust, usable, and purposeful.

# INSTRUCTOR EVALUATION

| **Criteria**                             | **Points**          |
|------------------------------------------|---------------------|
| Clear identification of the problem      | \_\_\_\_\_ / 5      |
| Appropriate project goal                 | \_\_\_\_\_ / 5      |
| Stakeholder identification               | \_\_\_\_\_ / 5      |
| Clearly defined project scope            | \_\_\_\_\_ / 5      |
| Feasibility analysis                     | \_\_\_\_\_ / 5      |
| Risk identification and response         | \_\_\_\_\_ / 5      |
| Final project decision and justification | \_\_\_\_\_ / 5      |
| **TOTAL**                                | **\_\_\_\_\_ / 35** |
