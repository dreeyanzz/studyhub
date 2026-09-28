# STORY-02: Public landing-page design proposal

**Status:** historical proposal; option A accepted by Adrian, canonical revision pending merge · **Owner:** @fayeye-09 · **Story:** [#51](https://github.com/dreeyanzz/studyhub/issues/51) · **Related task:** [#101](https://github.com/dreeyanzz/studyhub/issues/101)

**Sources:** SRS §3.2.2 and §3.7.1; D-002, D-005, D-016, D-026, D-031; [approved STORY-02 design](STORY-02-design-system.md).

## Current disposition

Adrian accepted option A on 2026-09-28 in [his review comment](https://github.com/dreeyanzz/studyhub/pull/117#issuecomment-5866841931). The active specification is now the revised [canonical design](STORY-02-design-system.md), with [D-033](../DECISIONS.md#d-033--illustrative-examples-on-the-public-landing-page). Its scope, sourcing and timing take precedence over the historical options and open questions below. No further option choice is pending: build only after design merge and the Sprint 1 Musts are safe, or early Sprint 2. Production photo selection remains an implementation gate.

## 0. Purpose and scope

Faith requested the composition from her Public design discussion: a curved workspace-photo hero, left-aligned serif headline, floating filter area, Host promotion, benefit strip and four photo cards. The local prototype explores that direction. It differs from the approved static public shell being implemented in [PR #116](https://github.com/dreeyanzz/studyhub/pull/116).

This document makes that difference reviewable. It does not supersede the approved design, close TSK-02.2, certify the prototype, or authorize implementation. This PR contains documentation and reference screenshots only. No application code, dependency, authentication or database changes are included.

**Proposed visual scope:** preserve Worq branding, forest/cream/sage tokens, Georgia headings, accessible header/footer, skip link, host-updated availability and sandbox-payment notices. Adapt the reference composition to those existing foundations.

**Out:** real Space discovery, inventory, availability, maps, holds, payments, session-aware navigation and authentication. These remain with their owning stories.

## 1. Selected direction, pending Adrian review

Faith selected option A on 2026-09-28: retain the Public visual composition with noninteractive example cards. Use explanatory content in the floating panel instead of selects, search, reset or result-count controls. The proposed timing remains a follow-up after #116, subject to agreement with Adrian. This owner preference is not merged design approval.

| Option                                              | Behavior                                                                                                                    | Tradeoff                                                                                                                                              |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| A: visual composition only (selected by Faith)      | Photo hero, Host promotion and clearly illustrative, noninteractive cards; replace search controls with explanatory content | Keeps the approved exclusion of search behavior and avoids controls that look like real discovery                                                     |
| B: explicitly illustrative filtering (not selected) | Two labeled selects filter four static examples; empty state, reset and result-count announcement; no network query         | Matches the current prototype more closely, but changes the approved design's explicit exclusion of functional-looking filters and invented inventory |

The screenshots show the earlier option B prototype and illustrate composition only. Its selects, search button, clickable example cards, reset and result-count behavior are not part of the selected direction. Adrian still needs to review the visual scope, including the illustrative photography, and agree timing before a code PR is opened.

## 2. Flow and state

For option A, the server renders the page; visitors follow section links or authentication links supplied by STORY-03. No client filtering state is needed.

No client filter state, matcher, reset or live result-count announcement is needed for the selected option. The existing filtering prototype stays in its local checkpoint as historical work. No persistence, tables, schemas, policies, credentials or Server Actions participate. A cross-layer sequence diagram is unnecessary because no backend is called.

Account creation must not be described as available while its destination is absent. Example cards are noninteractive content: no links, buttons or tab stops, and no implication of available seats or working reservations. Keep explicit section navigation and separate authentication links.

## 3. Proposed files and execution order

1. Have Adrian review the selected option and agree timing here. Update the canonical STORY-02 design in a reviewed design change before implementation, per D-016. If #116 merges first, preserve its implementation record and define this as a follow-up; do not rewrite that history as if the prototype had shipped.
2. Build from fresh main after the design is approved. Reuse the public layout/header/footer delivered by #116; do not duplicate its task or open a competing full-shell PR.
3. Change `app/(public)/page.tsx` and route-local `discovery.css` for the approved composition. Keep shared tokens and primitives unchanged unless separately justified.
4. Implement the explanatory panel and noninteractive example cards as server-rendered content. Do not port the prototype's filter state, matcher, filter tests or registration links on example cards.
5. Complete responsive, enlarged-text, focus, contrast, photo-fallback and navigation checks. Refresh screenshots from the exact implementation commit.
6. Open one implementation PR targeting main with its approved design, evidence and AI disclosure. Adrian remains the merger.

No new task number or estimate is assigned until the scope and timing are agreed. #101 remains owned by Faith and is already covered by #116; this draft deliberately does not close it.

## 4. Verification required before implementation approval

| Check                               | Required result                                                                                                              |
| ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| 360, 768, 1024 and optional 1440 px | No horizontal overflow, overlap, clipping or hidden controls                                                                 |
| Enlarged text and browser zoom      | Verify all required widths; inspect actual text and card boundaries, not only document scrollWidth                           |
| Keyboard                            | Skip link first; Enter focuses main; Tab and Shift+Tab reach every control with visible focus; native link/button activation |
| Targets and contrast                | At least 48×48 px; text at least 4.5:1; focus at least 3:1; measure hover/focus states                                       |
| Photography                         | Readable token fallbacks with blocked/failed images; opaque text surfaces where needed; agree image sourcing before shipping |
| Static examples                     | Clearly illustrative labels; cards are not focusable or clickable; no search-like controls or real discovery requests        |
| Integration                         | Verify auth destinations when STORY-03 lands; no claim of current account creation before then                               |
| Repository                          | npm run check, npm run build and git diff --check pass                                                                       |

No SQL changes are proposed, so pgTAP and generated database types are not applicable.

## 5. Prototype evidence and limits

These screenshots were captured from Faith's local prototype on 2026-09-28, before this documentation PR. They show the proposed composition, not #116 or a deployable result. Minor shadow CSS was subsequently corrected; the screenshots are therefore design references rather than exact final-build evidence.

- [360 px](evidence/public-design-proposal/360.png)
- [768 px](evidence/public-design-proposal/768.png)
- [1024 px](evidence/public-design-proposal/1024.png)
- [1440 px](evidence/public-design-proposal/1440.png)

The prototype previously passed default-width, keyboard, filter and contrast checks. A fresh local npm run check passed 45 tests across 6 files. These results do not establish readiness: several reference styles use fixed-pixel text, and the earlier 200% root-font test covered only 360px. All-width text/zoom and overlap checks remain open. Prototype code stays in a local checkpoint, outside this documentation PR.

## 6. Open questions for Adrian and Faith

- Accept the photo-led direction as a follow-up to #116, or revise the current task before it lands?
- Adrian: accept Faith's selected option A, including clearly illustrative photographic content, as the revised visual scope?
- Confirm photography sourcing. Example cards are noninteractive under the selected direction.

Until those are settled and the canonical design is updated, this remains a draft. The approved STORY-02 design remains authoritative.
