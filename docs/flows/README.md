# Shared flows

A shared flow is a flow that crosses stories, such as a reservation from its hold to its
check-in. Each one is drawn once, here, and merged before any story design that uses it
is written (D-044). A story design links the flows it uses in its §1 and draws only its
own part. It never changes a shared flow: that is a pull request to the flow doc.

## The flows

| Flow                         | Diagram  | Drawn by | Approved by   | Status      |
| ---------------------------- | -------- | -------- | ------------- | ----------- |
| Reservation lifecycle        | State    | Adrian   | Maria         | not written |
| Space verification           | State    | Adrian   | Maria         | not written |
| Sandbox payment confirmation | Sequence | Adrian   | Luke          | not written |
| Check-in                     | Sequence | Luke     | Adrian, Maria | not written |
| Host setup journey           | Swimlane | Maria    | Adrian        | not written |
| Seeker journey               | Swimlane | Maria    | Adrian, Luke  | not written |

Approvals follow D-042: Maria approves what a flow says users see, do and are told, Luke
what it says about security, and Adrian what it says about data and money. Adrian merges.
Each flow's pull request also asks for a review from the owner of every story that waits
for it. James, who turns the journeys into Playwright tests, reviews both of them.

The pull request that adds a flow links it in the table above. Its status there, and in
its own status line, is `draft`; `approved YYYY-MM-DD`, set in the pull request that
merges it; `implemented YYYY-MM-DD`, once every test it names passes on `main`; or
`superseded by <flow>`.

### What each flow covers

- **Reservation lifecycle.** The seat state (D-004), the reservation's own states, and
  the sandbox payment record's status (SRS §3.8). Every move between them, and who or
  what makes it: a hold, a confirmed sandbox payment, a lapsed payment window, a
  check-in, a no-show, a check-out, closing time, and a Host's tap, including on a unit
  a Seeker has paid for. How a lapse takes effect on read and on write, since nothing
  runs on a schedule (D-011). Where the payment window, the wait window's bounds and the fee are
  kept. Closing time for a Space that closes after midnight or never closes (D-027). What
  deleting a unit with a hold does. What moves the Host-updated time (D-002). The record
  of a completed visit that a review needs (D-009).
- **Space verification.** A Space's verification status, Pending, Verified or Rejected
  (FR-5.1): who changes it (D-037), what each status shows Hosts, Seekers and
  Administrators, and what a Host's edit does to it (D-027).
- **Sandbox payment confirmation.** From the gateway's hosted checkout to a Reserved
  unit: the gateway calling a route in `app/api/` (D-010), the signature check, a
  message that comes twice, comes after the payment window has lapsed, or reports a
  failed payment, and the Seeker's return from the checkout. It makes one of the
  reservation lifecycle's moves, so it is drawn once that flow is merged.
- **Check-in.** From a Seeker's QR code to an Occupied unit: what the booking token
  holds, how the Host scans or types it, why it works only once, what happens at the
  wrong Space or after the wait window, and what the Host and the Seeker are told. It
  makes one of the reservation lifecycle's moves, so it is drawn once that flow is
  merged.
- **Host setup journey.** A Host from a new Space to a public one: its details
  (STORY-05), the seat map (STORY-07), tags (STORY-08), photos (STORY-11), and an
  Administrator's approval (STORY-15).
- **Seeker journey.** A Seeker from search to a held unit: search and filters
  (STORY-08), the Space profile and picking a unit (STORY-11), the hold and the sandbox
  payment (STORY-09), and the booking token on their dashboard (STORY-10). It includes
  what a signed-out visitor gets when they try to hold a unit.

### Which story designs wait for which flows

| Story                                           | Its design waits for                                                          |
| ----------------------------------------------- | ----------------------------------------------------------------------------- |
| STORY-07 Seat map builder (#56)                 | Reservation lifecycle, Host setup journey                                     |
| STORY-08 Map and filters (#57)                  | Space verification, Host setup journey, Seeker journey                        |
| STORY-09 Holds and sandbox payment (#58)        | Reservation lifecycle, sandbox payment confirmation, check-in, Seeker journey |
| STORY-10 QR check-in and release (#59)          | Reservation lifecycle, check-in, Seeker journey                               |
| STORY-11 Space profile (#76)                    | Reservation lifecycle, Space verification, Host setup journey, Seeker journey |
| STORY-12 Host occupancy (#77)                   | Reservation lifecycle                                                         |
| STORY-15 Space verification (#166)              | Space verification, Host setup journey                                        |
| STORY-13 Reviews (#78), Sprint 3                | Reservation lifecycle                                                         |
| STORY-14 Administration console (#79), Sprint 3 | Reservation lifecycle, Space verification, sandbox payment confirmation       |

If your story needs a shared flow that isn't listed here, ask Adrian before you write its
design. Adrian decides whether it gets a doc, and D-042 decides who draws it.

## When a flow gets its own doc

A flow crosses stories when two or more stories build or read it. It gets its own doc
here only if, as well, at least one of these holds:

- two or more stories change the same state, as STORY-09, STORY-10 and STORY-12 all
  change the seat state;
- one person's steps run through two or more stories, as a Seeker's do from search to a
  hold;
- a caller from outside the app takes part, such as the gateway's webhook or a QR scan
  (D-010);
- a timer changes a state, as the payment window does (D-004, D-011).

Any other flow stays in its story's design. A story that only reads what another story
builds, such as the tags shown on a Space profile, waits for that story's design instead.

## Which diagram

The diagram follows the question the flow answers. It is drawn in Mermaid, which GitHub
renders, so a pull request shows each changed line of it.

| The question                                                        | Diagram          | In Mermaid                                       |
| ------------------------------------------------------------------- | ---------------- | ------------------------------------------------ |
| What states can it be in, and what moves it from one to the next?   | State diagram    | `stateDiagram-v2`                                |
| Who calls whom, in what order, and what if a call fails or repeats? | Sequence diagram | `sequenceDiagram`, with an `alt` for each branch |
| Who does what, in what order, across people and stories?            | Swimlane         | `flowchart`, with one `subgraph` per lane        |

A flow answers one question. When one arrow of a state diagram needs a sequence of its
own, like a confirmed sandbox payment, that sequence is its own flow, and each links the
other.

## Every diagram names its tests

- **State diagram.** A table under it lists every arrow: from, to, the event, who may
  make it, what makes it (a database function, or a policy and grant), and the pgTAP test
  that proves it. It also lists the moves nobody may make, such as a Host verifying their
  own Space, each with its negative test (AGENTS.md rule 5).
- **Sequence diagram.** Every `alt` branch, failures included, names the test that
  proves it (pgTAP, Vitest or Playwright), or the manual check in a story design's §4
  that covers it.
- **Swimlane.** Every path through it names the Playwright test in `e2e/` that walks it,
  or the manual check that covers it. James writes those tests.

A test is named before it exists. The story that builds an arrow or a branch writes its
test in the pull request that builds it, and the pull request that adds a flow's last
test sets the flow's status to `implemented`.

## Writing a flow doc

- **File:** `docs/flows/<short-name>.md`, for example `reservation-lifecycle.md`.
- **Branch:** `feature/STORY-00-flow-<short-name>`. A flow serves several stories, so it
  uses STORY-00, like other planning that crosses stories.
- **Pull request:** title `docs(STORY-00): draw the <name> flow`, and `Refs #<story>` for
  every story whose design waits for it. Request reviews from its approvers, from the
  owner of every story that waits for it, and from James for a journey. Everyone's GitHub
  handle is in [CONTRIBUTING.md](../../CONTRIBUTING.md#team).
- **Status line**, at the top, as in a design doc:

  ```
  **Status:** draft · **Owner:** @handle · **Approved by:** @handle ·
  **Stories:** STORY-xx · **Decisions:** D-NNN
  ```

- **Sections:** what the flow covers, and what it leaves to other flows; the diagram;
  the table of its arrows or branches, with their tests; the choices it made and what was
  rejected, each with a D-entry when D-044 says it needs one; and its open questions, each
  a `decision-needed` issue.
- **Words:** the [glossary's](../GLOSSARY.md), for people, states and labels, with states
  named as in code: `pending_payment`.
- **One fact, one place.** A flow that uses another flow's states links to it instead of
  drawing them again, as a story design does.

## Changing a flow after it merges

Open a pull request to the flow doc, approved like the first one. It updates the story
designs it makes stale in the same pull request (AGENTS.md rule 7). If code already
follows the old flow, it says what has to change, and each change is a fix under its
story. A story design never changes a flow on its own.
