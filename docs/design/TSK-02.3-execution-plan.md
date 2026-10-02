# TSK-02.3: Illustrative landing page execution plan

**Task:** [#121](https://github.com/dreeyanzz/studyhub/issues/121) · **Owner:** @fayeye-09 · **Estimate:** 3 points / 1.5 working days.
**Status:** implemented locally 2026-10-02 after Faith confirmed the plan; checks passed; verified locally; publication authorized by Faith. Faith authorized commit, push and PR on 2026-10-02 after reviewing the local completion report.
**Baseline:** main at 3be9cd3; branch feature/STORY-02-illustrative-landing.
**Sources:** approved STORY-02 design (§0 follow-up, §3 look/photography, §4 checks), D-002, D-005, D-016, D-026, D-031, D-033, SRS §3.2.2 and §3.7.1.

## 1. Start conditions

- Design revision #117 and original shell #116 are merged.
- Adrian explicitly confirmed STORY-03/04/05 are safe and moved this task into Sprint 1 in his [task comment](https://github.com/dreeyanzz/studyhub/issues/121#issuecomment-5918846751).
- Preserve the historical filtering prototype on its checkpoint branch. Do not cherry-pick its client state, filters or clickable cards.
- Read installed Next.js guidance for Server Components, images and styling before coding. Keep implementation local until Faith authorizes publication.

## 2. Intended page, in reading order

1. Existing skip link and public header, unchanged.
2. Photo hero: left-aligned Georgia heading, concise Worq introduction and curved workspace photo. Primary CTA to /register; secondary CTA to #how-it-works. No Explore spaces/search promise.
3. Floating explanatory panel: short static text about focus, comfort and community. No inputs, select menus, search icons that suggest actions, filters or reset button.
4. Host promotion with CTA to /register, paired with a simple benefit strip. Preserve the #for-hosts anchor expected by the header/footer.
5. Four photographic examples, visibly labeled "illustrative spaces, not live listings". Use semantic list/card content with headings and short invented descriptions. No links, buttons, tabindex, pointer cursor, hover lift, seat counts, ratings, prices, open-now language or availability states.
6. How it works at #how-it-works: retain the three pillars and their Sprint 2/3 delivery labels. Explain what is planned without claiming discovery or holds work today.
7. Existing footer with sandbox-payment and Host-updated-availability notices, unchanged.

On mobile, photo and text stack in logical reading order. At larger widths the photo and hero text share space, and the lower content forms columns only when its rem-based minimum widths fit. The floating panel may overlap decorative space, never text or controls. Do not use hidden overflow to disguise layout defects.

## 3. File scope

| File                                   | Planned change                                                                                                                 |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| app/(public)/page.tsx                  | Static Server Component implementing the approved composition; no use client, filter state, matcher or database/session access |
| app/(public)/discovery.css             | Route-scoped styles imported by the page if needed; semantic tokens, rem text, content-aware grids and reduced-motion behavior |
| public/images/public-landing/          | Optimized, locally served stock photos                                                                                         |
| docs/design/STORY-02-design-system.md  | Complete photo register and append measured verification for this follow-up; preserve the original shell record                |
| docs/design/TSK-02.3-execution-plan.md | This execution checklist and outcomes                                                                                          |
| docs/design/evidence/TSK-02.3/         | New screenshots and concise measurement evidence                                                                               |

Reuse the existing layout, header, footer, globals and primitives. No dependency, auth, dashboard, schema or shared token changes are planned. If integration needs a change outside this scope, identify it before making it.

## 4. Execution sequence

### A. Source and verify photos

Find Unsplash or Pexels photographs of empty study/work interiors with no identifiable people. Inspect each original photo and its license page. Record source page URL, photographer, license URL, verification date and visual people/content check. Download actual assets rather than hotlinking. Compress to WebP/AVIF, size to their use, target at most 250 KB each; explain any necessary exception. Reuse one image for hero/promotion where appropriate. Record output filenames, dimensions and byte sizes. Do not claim the old screenshot imagery is approved or licensed without checking it.

### B. Build the static composition

Read installed framework guidance, then implement section by section using the approved screenshot composition as reference. Use one h1 and ordered headings. Use meaningful alternative text for informative images and empty alternatives for decorative repetition. Use local image paths with appropriate dimensions/responsive sizing to limit layout shifts. Keep text on opaque token surfaces where contrast would otherwise depend on photography. Use rem for every text size, including badges and card labels. Preserve native navigation semantics and existing anchors. All page CTAs target exactly /register, /login or #how-it-works; existing shell home/section links remain intact.

### C. Inspect and correct accessibility

Measure the complete 12-case matrix: widths 360, 768, 1024 and 1440 CSS px, each at 100%, 150% and 200% root text. Record document overflow, element clipping (including overflow-hidden containers), text/photo collisions and target rectangles. Also exercise browser zoom separately; root-font enlargement alone is not browser zoom. Inspect screenshots rather than trusting scrollWidth alone.

Trace forward and reverse keyboard navigation, skip-link Enter focus to main, native activation and all CTA destinations. Examples and explanatory content must never become tab stops. Measure text contrast at least 4.5:1 and focus at least 3:1, including hover/focus states. Every interactive target must be at least 48x48 CSS px. Check reduced motion, blocked/failed images and local-only image requests. Verify no false live inventory claims.

### D. Verify integration and record evidence

Run npm run check, npm run build and git diff --check after fixes. Use existing tests; do not add tests that merely duplicate static markup. No new pure logic or database work is planned, so matcher tests and pgTAP are not applicable. Exercise public navigation anonymously. Any authenticated comparison must use a local seeded Supabase stack, never shared-cloud test mutations; record unavailability honestly if that stack is missing.

Save refreshed screenshots for all matrix cases and a summary of keyboard path, target sizes, contrast, zoom, fallback and route results. Update the canonical design with actual photo records and results, identifying any unchecked requirement. Do not copy historical prototype results as current evidence.

### E. Deliver locally

Show Faith the rendered design and explain the page, styles and photo register. Report passed checks and remaining limitations. Leave all changes uncommitted; no push, PR, task closure or approval without the user's later instruction.

## 5. Acceptance checklist

- [x] Four clearly labeled noninteractive examples; no false availability/inventory.
- [x] Explanatory panel has no search-like controls; only permitted CTA destinations.
- [x] Every photo is local, compressed, free-license verified, person-free and attributed in the register.
- [x] One h1, logical headings and preserved shell anchors/skip link.
- [x] All 12 width/text cases have no overflow, clipping or overlap.
- [x] Browser zoom checked separately; reduced motion and image failure checked.
- [x] Targets >=48x48; text contrast >=4.5:1; focus >=3:1 including relevant states.
- [x] Keyboard, CTA navigation and example noninteractivity verified.
- [x] npm run check, npm run build and git diff --check pass.
- [x] Photo register, screenshots and measured evidence recorded.
- [ ] Faith receives the local visual and code walkthrough; no commit/push/PR.

## 6. Verification status

Fresh implementation evidence is recorded in [the verification report](evidence/TSK-02.3/verification.md). Photos and licenses are recorded in the canonical design. The earlier prototype remains separate.

## Publication authorization — 2026-10-02

Faith requested opening the PR after the completion report. Earlier no-publication instructions above describe the implementation phase; this authorization permits committing and publishing this task branch for Adrian's review. It does not authorize merging.
