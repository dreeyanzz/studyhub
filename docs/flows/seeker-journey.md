# Seeker journey

**Status:** draft · **Owner:** @fayeye-09 · **Approved by:** @dreeyanzz, @lukedongque ·
**Stories:** STORY-08, STORY-09, STORY-10, STORY-11 · **Decisions:** D-001, D-002, D-003, D-006, D-007, D-008, D-010, D-012, D-044

This journey follows a Seeker from discovery to a paid hold and its booking token. It shows what the Seeker sees, does and is told as they move between search, a Space profile, a hold, sandbox checkout and their dashboard. James will turn each named path into a Playwright test.

## What this flow covers

- Searching for Spaces by a typed place or campus name, or by the device's location; results in a map and list; curated filters; and opening a Space profile (STORY-08).
- Reviewing a Space's photos, hours, curated and Host custom tags, and Available units per zone with their Host-updated times; choosing an Available unit from the seat map or fully keyboard-accessible list (STORY-11).
- Asking to hold a unit, choosing a wait window within the Host's bounds, signing in when required, and seeing a clear result if the unit cannot be held (STORY-09).
- Going through PayMongo's hosted sandbox checkout and returning to StudyHub. The sandbox payment confirmation flow (#175) owns gateway callbacks and duplicate, late or failed messages; its issue is open and its flow document is not written yet.
- Seeing the Reserved unit and booking token on the Seeker dashboard (STORY-10).
- The signed-out visitor's sign-in or registration path when they try to hold a unit.

This flow links, but does not redraw, the merged [reservation lifecycle](reservation-lifecycle.md). The sandbox payment confirmation (#175) and check-in (#176) are separate shared flows whose issues are open and whose documents are not written yet. They own the gateway details and the check-in rules respectively; the later flow PRs should add links between the documents once both exist. This journey ends when the Seeker has the booking token.

## Journey

```mermaid
flowchart LR
  subgraph seeker[Seeker]
    direction TB
    S0([Start]) --> S1[Open Space discovery]
    S1 --> S2[Search by place or campus, or use device location]
    S2 --> S3[Optionally choose curated filters]
    S3 -->|E2E seeker-filters-and-verification| S4{Matching Verified Spaces?}
    S4 -->|No: no matching Spaces<br/>E2E: seeker-search-no-results| S5[Change search or filters]
    S5 --> S2
    S4 -->|Yes: E2E seeker-search-matches| S6[Compare map pins and result list]
    S6 --> S7[Select a pin or list result]
    S7 --> S8[Review Space profile: photos, hours, tags, availability]
    S8 --> S9{Available unit to hold?}
    S9 -->|No: E2E seeker-profile-no-available-unit| S10[Review another Space or return to results]
    S10 --> S6
    S9 -->|Yes: E2E seeker-select-available-unit| S11[Choose an Available unit on map or accessible list]
    S11 --> S12[Choose a wait window within the Host's bounds]
    S12 --> S13{Signed in as a Seeker?}
    S13 -->|No: E2E seeker-signed-out-hold| S14[See sign-in required; sign in or create a Seeker account]
    S14 --> S15{Post-auth return path: decision #186}
    S15 -->|Preserve and recheck selection: E2E seeker-auth-return-preserves-selection| S15a[Recheck selected unit availability]
    S15a --> S16
    S15 -->|Return to profile and reselect: E2E seeker-auth-return-reselects-unit| S11
    S13 -->|Yes: E2E seeker-signed-in-hold| S16[Request hold]
    S16 --> S17{Hold accepted?}
    S17 -->|No: unit changed, Space closed, or another hold exists<br/>E2E: seeker-hold-unavailable| S18[See reason and return to current availability]
    S18 --> S8
    S17 -->|Yes: E2E seeker-hold-available-unit| S19[See Pending Payment and payment-window guidance]
    S19 --> S20[Continue to PayMongo hosted sandbox checkout]
    S20 --> S21{Checkout outcome}
    S21 -->|Paid and confirmed<br/>E2E: seeker-hold-and-pay| S22[Return to StudyHub and see Reserved status]
    S22 --> S23[Open dashboard and view booking token as QR]
    S23 --> S24([Journey ends: token ready for check-in])
    S21 -->|Failed, still pending, or payment window lapsed<br/>E2E: seeker-payment-outcomes| S25[Follow the payment flow's message and next step]
    S25 --> S26{Payment flow says hold remains active?}
    S26 -->|Yes: return only if payment flow allows| S20
    S26 -->|No: E2E seeker-expired-payment-window| S8
  end

  subgraph product[StudyHub]
    direction TB
    P1[Return only Verified Spaces; show map pins and list results; pin shows name, price tier, distance and profile link]
    P2[Combine selected curated filters with AND; do not offer custom tags as filters]
    P3[Show Space profile and distinguish curated tags from Host custom tags]
    P4[Show Available units per zone and each unit's "Host-updated · X min ago" time; make list fully keyboard accessible]
    P5[Allow a hold only for an Available unit, a valid wait window, and a Seeker with no other active hold]
    P6[Create one Pending Payment hold; make the unit unavailable to other Seekers]
    P7[On confirmed sandbox payment, show Reserved and one booking token]
    P8[If the hold or payment window has ended, explain that the unit is available again]
  end

  S2 -.-> P1
  S3 -.-> P2
  S8 -.-> P3
  S8 -.-> P4
  S16 -.-> P5
  S17 -- Accepted --> P6
  S21 -- Confirmed --> P7
  S21 -- Lapsed --> P8
```

## Paths and test coverage

These Playwright test names are planned coverage, not a claim that the tests already exist. James writes the journey tests under `e2e/` as the stories land.

| Path | Expected Seeker experience | Test that proves it |
| --- | --- | --- |
| Search returns matches | Verified Spaces appear as pins and list results; a pin shows the Space's name, price tier, distance and profile link; opening the profile gives the same Space details. | Playwright `e2e/seeker-journey.spec.ts`: “search shows matching Spaces and a selected result opens its profile” (`seeker-search-matches`) |
| Search returns no matches | Explain there are no matching Spaces; let the Seeker change the query or filters. | Playwright `e2e/seeker-journey.spec.ts`: “no-results search lets the Seeker revise the query” |
| Filters are combined | Two or more curated filters return only Spaces matching all selected filters; custom tags are not filter options; non-Verified Spaces never appear. | Playwright `e2e/seeker-journey.spec.ts`: “filters combine with AND and exclude custom tags and unverified Spaces” (`seeker-filters-and-verification`) |
| Profile has no Available unit | Show Available units per zone and their Host-updated times; allow return to results or another Space; do not present an unavailable unit as holdable. | Playwright `e2e/seeker-journey.spec.ts`: “profile with no Available units offers no hold action” (`seeker-profile-no-available-unit`) |
| Signed-out visitor tries to hold | Explain sign-in is required and offer sign-in or Seeker registration. After authentication, either preserve and revalidate the selected unit or return to the profile to reselect; [decision #186](https://github.com/dreeyanzz/studyhub/issues/186) tracks the choice. | Planned Playwright `e2e/seeker-journey.spec.ts` cases: “signed-out visitor is prompted to authenticate before holding” (`seeker-signed-out-hold`), plus the selected-unit return case chosen in #186. |
| Hold succeeds | Show Pending Payment and its payment-window guidance; the unit is no longer offered to another Seeker while the hold is active. | Playwright `e2e/seeker-journey.spec.ts`: “Seeker holds an Available unit and sees Pending Payment” (`seeker-hold-available-unit`) |
| Hold is refused | If the unit is no longer Available, the Space is closed or unverified, the wait window is invalid, or the Seeker already has an active hold, show a helpful reason and refresh availability without creating a second hold. | Playwright `e2e/seeker-journey.spec.ts`: “stale or ineligible hold request explains why it cannot proceed” |
| Payment is confirmed | Return from PayMongo, show Reserved and the booking token on the Seeker dashboard. | Playwright `e2e/seeker-journey.spec.ts`: “confirmed sandbox payment shows Reserved and one booking token” |
| Payment fails or remains pending | Show the outcome and the next step; keep the Seeker informed while the payment window remains open. | Playwright `e2e/seeker-journey.spec.ts`: “failed or pending checkout shows the current payment outcome” |
| Payment window lapses | Follow the payment flow's outcome message, explain that the hold ended and the unit is Available again, and return to current availability. | Playwright `e2e/seeker-journey.spec.ts`: “expired payment window releases the unit and returns to availability” (`seeker-expired-payment-window`) |

The lifecycle's pgTAP tests prove data and state rules, including `holds`: “a Seeker holds an Available unit, which reads Pending Payment”, “a Seeker with an active hold cannot hold a second unit”, and “a hold whose payment window lapsed is expired, and its unit reads Available.” This journey's Playwright tests prove what the Seeker sees across the screens; they do not replace those database tests.

## Choices

- **Use the map and list as equal discovery and selection paths.** A Seeker can open a Space from either map pin or list result, and can choose a unit from the seat map or accessible list. The list offers the same actions by keyboard (D-003).
- **Keep curated and Host custom tags distinct.** Curated tags are the only filters; custom tags are display-only (D-006).
- **Use Leaflet with OpenStreetMap tiles.** The journey's map search follows the project map decision (D-012).
- **Label availability “Host-updated,” not live or real-time.** The status is Host-maintained and can be stale until refreshed (D-002).
- **Authenticate at the hold boundary.** Search and profile browsing remain available to signed-out visitors; attempting to hold prompts authentication. A hold is created only for a signed-in Seeker (D-008). The post-auth return behavior is tracked in [decision-needed issue #186](https://github.com/dreeyanzz/studyhub/issues/186).
- **Keep gateway detail in the payment flow.** This journey shows the Seeker's transition to and return from checkout, while #175 owns signatures, duplicate/late callbacks and gateway failures (D-010).

## Delegated behavior

- **Payment outcomes:** the exact messaging and recovery path for failed, duplicate or late PayMongo confirmations belong to sandbox payment confirmation (#175). This flow shows only the handoff and follows the outcome that flow returns.
- **Check-in:** the journey ends at the booking token. The QR token's use, check-in and what happens at the wrong Space belong to check-in (#176).

## Open decision

- [#186](https://github.com/dreeyanzz/studyhub/issues/186): whether to preserve and revalidate the selected unit after authentication or return the Seeker to the profile to choose again. The flow does not treat either path as approved until this decision is settled.

