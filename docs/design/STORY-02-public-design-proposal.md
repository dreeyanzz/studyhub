# STORY-02: Public landing-page design proposal

**Status:** draft for discussion, not approved · **Owner:** @fayeye-09 · **Story:** [#51](https://github.com/dreeyanzz/studyhub/issues/51) · **Related task:** [#101](https://github.com/dreeyanzz/studyhub/issues/101)

**Sources:** SRS §3.2.2 and §3.7.1; D-002, D-005, D-016, D-026, D-031; [approved STORY-02 design](STORY-02-design-system.md).

## 0. Purpose and scope

Faith requested the composition from her Public design discussion: a curved workspace-photo hero, left-aligned serif headline, floating filter area, Host promotion, benefit strip and four photo cards. The local prototype explores that direction. It differs from the approved static public shell being implemented in [PR #116](https://github.com/dreeyanzz/studyhub/pull/116).

This document makes that difference reviewable. It does not supersede the approved design, close TSK-02.2, certify the prototype, or authorize implementation. This PR contains documentation and reference screenshots only. No application code, dependency, authentication or database changes are included.

**Proposed visual scope:** preserve Worq branding, forest/cream/sage tokens, Georgia headings, accessible header/footer, skip link, host-updated availability and sandbox-payment notices. Adapt the reference composition to those existing foundations.

**Out:** real Space discovery, inventory, availability, maps, holds, payments, session-aware navigation and authentication. These remain with their owning stories.

## 1. Decision needed

Recommended direction: use a follow-up after #116, retaining its approved scope while reviewing the photo-led design separately. Before implementation, agree whether to retain only the visual composition or also permit the prototype's illustrative filtering.

| Option                                   | Behavior                                                                                                                    | Tradeoff                                                                                                                                              |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| A: visual composition only (recommended) | Photo hero, Host promotion and clearly illustrative, noninteractive cards; replace search controls with explanatory content | Keeps the approved exclusion of search behavior and avoids controls that look like real discovery                                                     |
| B: explicitly illustrative filtering     | Two labeled selects filter four static examples; empty state, reset and result-count announcement; no network query         | Matches the current prototype more closely, but changes the approved design's explicit exclusion of functional-looking filters and invented inventory |

Faith requested the visual reference, but the choice between these behaviors remains open. The screenshots show option B as a prototype, not an approved requirement. Adrian and Faith should settle the option and whether it is a follow-up before a code PR is opened.

## 2. Flow and state

For option A, the server renders the page; visitors follow section links or authentication links supplied by STORY-03. No client filtering state is needed.

For option B, the public layout remains a Server Component and the example filter region owns client state. Draft type/atmosphere values become applied filters on submit; reset restores all examples. A pure matcher is tested for wildcard, individual, combined and no-match cases. No persistence, tables, schemas, policies, credentials or Server Actions participate. A cross-layer sequence diagram is unnecessary because no backend is called.

In either option, account creation must not be described as available while its destination is absent. Cards should not imply available seats or working reservations. If cards navigate to registration, their purpose and accessible names must make that destination clear; noninteractive examples are preferable for option A.

## 3. Proposed files and execution order

1. Agree the option and timing here. Update the canonical STORY-02 design in a reviewed design change before implementation, per D-016. If #116 merges first, preserve its implementation record and define this as a follow-up; do not rewrite that history as if the prototype had shipped.
2. Build from fresh main after the design is approved. Reuse the public layout/header/footer delivered by #116; do not duplicate its task or open a competing full-shell PR.
3. Change `app/(public)/page.tsx` and route-local `discovery.css` for the approved composition. Keep shared tokens and primitives unchanged unless separately justified.
4. Only for option B, add the example matcher and adjacent tests under `lib/public/`; keep browser-only filter state scoped to the example region.
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
| Option B only                       | Accurate example labels, filter combinations, empty state, reset and polite result count; no real discovery requests         |
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
- Choose option A or approve option B as an explicit change to the current scope?
- Confirm photography sourcing and whether example cards are noninteractive.

Until those are settled and the canonical design is updated, this remains a draft. The approved STORY-02 design remains authoritative.
