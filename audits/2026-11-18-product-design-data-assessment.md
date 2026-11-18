# SASA application assessment — 18 November 2026

The application has a strong evidence foundation and a coherent visual identity. The next improvement should make its best analysis easier to reach, make comparisons more consistent, and reduce repeated presentation. The largest opportunity for a premium feel is clearer hierarchy and faster interaction.

Reviewed the [live application](https://prucodes.github.io/sasa-intelligence-lab/), all nine primary destinations, selected interactions, light and dark presentation, and targeted desktop/mobile layouts. Inspected the current source, recent changes, the October review, and the November catalogue audit. Local baseline: `b1ef7fc`. The existing untracked `lib/ask-evidence.ts` was read and preserved. This assessment changes no application code and publishes nothing.

## What is already working well

- The restrained teal, navy, warm accent and editorial typography give the product a recognizable identity. The map, Atlas heatmap and environmental graphics are more relevant than generic decorative illustrations.
- The Atlas joins supported measures using source-provided urban body codes, handles ties, distinguishes held records from missing records, and shows absolute workloads beside rates.
- SASA Goals separates the stated target, reading date, deadline, proxy measures and missing evidence. Its computed brief and expandable source records are a useful executive layer.
- Rural comparisons already use a common GP-day cohort, expose calendar sensitivity, and distinguish repeated reporting from demonstrated operational change.
- The application already has comparison views, source drilldowns, an executive brief, reporting continuity and reconciliation. The next release can improve their integration instead of adding more parallel destinations.
- Snapshot fingerprints, aggregate contracts and extensive tests provide meaningful safeguards. These safeguards should also govern deployment.

The site is publicly hosted; its governed figures are retained snapshots. The authenticated, automatically refreshing Live connector remains a boundary for future work. Hosting freshness and observation freshness need separate labels.

## Corrections to prioritize

### 1. Gate comparisons of national ranks whose categories are unknown

**Confirmed on the live Atlas.** The Rank view says the source does not identify the population category and correctly withholds a district map for that reason. It nevertheless displays a median of 732 across 96 ULBs, “Highest place” #19, “Lowest place” #1,528, rank-based shading, and “Ahead of” comparisons.

Those ordinal positions may come from different lists. A disclaimer does not make their peer ordering comparable. Keep each reported rank available as historical source evidence; withhold cross-ULB median, best/worst, peer position and performance shading until the ranking category is supplied.

Evidence: `lib/ulb-atlas.ts:334`, `:339`, `:345`, `:498`, `:515`; `app/ulb-atlas.tsx:288`. The existing test checks that the district map is withheld, but not the other comparison surfaces. The unfinished question-answer draft also inherits this comparison and needs the same gate before release.

Acceptance: raw ranks remain inspectable; no implied comparison spans unknown categories; category-aware comparisons have an explicit same-category denominator.

### 2. Make the selected period govern the analytical headline

**Confirmed live.** In Operational Analytics → Collection, selecting “March 2027 · 3 sources” leaves the July hero figures and funnels visible while the body says there are no retained procurement rows. The control says other datasets show nothing rather than an older figure, which contradicts the prominent opening.

`AnalyticsHero` receives the tab but no selected period and memoizes `analyticsHero()` once. The same delivery opening also appears above rural, continuity and works-plan views. The period selector includes future programme-plan months under the general “Reported period” label.

Move the subject/period controls above the headline. Scope the headline to those controls, or make a separately labelled latest-evidence overview explicitly independent. Offer periods relevant to the selected source and distinguish plan periods from observed achievements.

Evidence: `app/lab-app.tsx:1078`, `:1121`, `:1146`, `:2258`; `lib/screen-heroes.ts:96`.

Acceptance: selecting an unavailable period produces an unavailable headline, chart and detail consistently; no unrelated future plan month appears as an available procurement observation.

### 3. Correct “most left” and make chart encodings literal

**Confirmed wording issue.** The Goals brief says Prakasam “had the most left, 22% of its own target.” The computation selects the largest *percentage*. Independently summing July source balances gives Prakasam 87,906 source units, versus 211,660 for the source label Vishakapatnam and 204,603 for Anantapur. Use “highest remaining share among matched districts,” with the scope stated, or calculate a separate largest-quantity finding.

Evidence: `lib/sasa-goals.ts:377–397`.

**Chart issues.** The new delivery funnels impose a minimum half-thickness of 1.2 SVG units; the split chart imposes a minimum 1% segment. Consequently, zero/small values can have non-proportional visible area despite a caption saying thickness represents the count. The IHHL funnel also describes approved → under construction → completed as successive subsets; that requires confirmation that “under construction” includes subsequent completions rather than describing the current work-in-progress stock.

Use exact-scale stage bars until the source establishes a transition model. A visible zero marker can be separate from the quantitative area. Label KPI meters by their actual denominator: beneath a quantity headline, some currently encode the share of ULBs affected. The rural change card displays a negative change with the positive palette and a meter based on the closing rate, which weakens its meaning.

Evidence: `app/screen-hero.tsx:150–172`; `lib/screen-heroes.ts:92–114`; `app/overview-hero.tsx:58–63`.

### 4. Use one strict measurement contract in the newer features

**Confirmed code-level risk; no claim that all current values are wrong.** Goals uses a numeric parser that strips non-digits and falls back to zero. A missing value becomes zero and a negative value loses its sign. Atlas FSTP progress uses `Number(unquote(...))`, which also turns an empty value into zero. These paths can undermine the carefully maintained missing-versus-zero rule on a future refresh.

Use the existing strict parsing conventions, retain null/invalid/explicit-zero states, and reject negative counts where the measurement contract requires it. Validate source year and month together when selecting the latest period; several new selectors currently choose the largest month number.

Evidence: `lib/sasa-goals.ts:88–104`, `:281–295`; `lib/ulb-atlas.ts:196–216`.

Acceptance: missing, blank, quoted null, malformed and negative values cannot silently become valid zero/positive measurements; January of a later year supersedes December of an earlier year.

### 5. Put quality gates in front of publication

**Confirmed.** The Pages workflow installs dependencies, builds and uploads. It does not run snapshot validation, lint, tests or a TypeScript check. The separate TypeScript check currently fails even though the static build succeeds.

Add a typecheck script, resolve its current errors, and require data validation, lint, tests and typecheck before the static build/upload. Add a small browser smoke against the actual Pages subpath, including Goals and Atlas. Include a build identifier and evidence manifest so a reviewer can distinguish deployed code from retained data.

Evidence: `.github/workflows/deploy-pages.yml:27–42`, `package.json`; typecheck findings include a nullable `bound.coveredShare` in `app/environment-ledger.tsx:548`, test typing errors and Vite/Vitest type incompatibility.

## Design direction: a quieter, more useful first screen

### Mobile is the clearest immediate opportunity

At **390 × 844**, the Overview hero measured **1,084 px** high. Its map is ordered before the copy; the first KPI number starts around document y=**847 px**, just below the initial viewport. Subject selection starts around **1,278 px**. On Operational Analytics, the controls begin around **1,036 px**. Neither inspected screen overflowed horizontally, but fitting the width is not the same as making the primary task easy to reach.

Put the title and primary finding first, followed by the subject selector and two or three compact readings. Place the map after that or behind “Explore districts.” Keep an opening map on desktop where space allows. On interior pages, use a compact heading and one finding rather than another full-page introduction. Reserve the expansive storytelling treatment for Overview and presenter mode.

Suggested mobile order: **page title → subject/place control → key finding + period/population → chart → named review list → evidence disclosure**.

### Reduce competing destinations and repeated explanations

Nine equally weighted navigation destinations require readers to understand the product’s architecture before starting. Group them by purpose: Review, Explore and Evidence. Make the Atlas the main place-finding entry; open Diagnostics as contextual detail from a selected place. Keep existing routes and deep links.

Use one consistent evidence drawer for source rows, formulas and exclusions. Keep the period, population, unit and critical caveat alongside the reading. Repeated catalogue totals, lengthy methodology and implementation terminology can sit inside disclosure panels. Existing comparison trays and dossier views should share the selected place and cohort.

On phones, use a small set of persistent primary destinations plus a clearly discoverable menu for the remainder. The current horizontally scrolling navigation hides later destinations, including Atlas and the evidence tools.

### Refine the visual system

- Preserve the teal/navy identity and one warm exception color. Apply positive/negative colors consistently to a measure’s direction.
- Use the italic editorial phrase sparingly. Short interior headings will create more room for analysis.
- Reduce nested cards, repeated borders and background treatments. Let spacing and typography carry more of the hierarchy.
- Make essential denominator/period text comfortably readable; several mobile contexts currently use 11 px type. Keep technical detail compact inside disclosures.
- Use short transitions for selection and navigation. Render final KPI values immediately; counting up produces transient false readings during the first glance and screenshots. Respect the existing reduced-motion support.
- Expose held-record reasons on tap and keyboard focus. Atlas matrix cells currently rely on a native `title` tooltip, which is difficult to discover on touch screens.

The intended “wow” moment is a clear relationship: choose a district, see its gap, inspect the named places contributing to it, then open the exact evidence in one continuous interaction.

## Meaningful intelligence that the retained evidence can support

| Improvement | Build on what exists | Required boundary |
|---|---|---|
| Unified review queue | Existing largest-gap lists, delivery cohorts and named findings | Keep subjects separate; show workload, rate, affected population, date and review reason. These are review priorities, not proven intervention effects. |
| Explain this number | Atlas code joins, Goals citations, environment ledger and cohort exclusions | Show included/held populations and the denominator before comparing values. |
| Concentration and comparable peers | Existing absolute shortfalls, peer profiles and district views | Offer same-source/same-period comparisons; add size bands only when source population measurements support them. |
| Evidence change summary | Fingerprints, source revisions and repeated-period checks | Distinguish a new capture, changed records, repeated values and a genuinely new observation period. |
| Shareable filtered brief | Existing executive brief and Atlas CSV | Serialize selected district, measure, period, cohort and source vintage; clearly label snapshot-wide versus filtered exports. |
| Ask the evidence | Existing untracked `lib/ask-evidence.ts` | Validate question interpretation, units, entity level, ranking eligibility and citation meaning before integrating it. |

An especially useful reconciliation is **63.7% collection reach in 116 placed ULBs** versus **56.1% across the full retained register in Environment**. These use different populations; the difference is not itself an arithmetic bug. Similarly, Goals’ **46.2% segregation** uses all households in its placed cohort, while Environment’s **72.5%** uses collected households across its retained population. A visible population/denominator label and “Why this differs” explanation would prevent readers from interpreting these as conflicting facts.

The current Ask draft is a deterministic fact index and question router; no application import or corresponding tests were found. Its source links and explicit answer states are a useful starting point. Before release, test ambiguous city/district names, absolute quantity versus percentage, multiple periods, unsupported causal questions and unknown-category ranks. A generated sentence containing permitted numbers and citation IDs still needs to preserve the fact’s meaning, denominator and entity. Integrate a compact question entry with suggested questions into the existing workspace.

Freshness should appear as **observed period**, **retained date**, and **last source check**, separately. The 18 November catalogue audit examined selected pages and totals; it explicitly does not establish full-record equality with upstream. Its sampled endpoints and new AWARE catalogue entries do not yet justify new environmental trend or impact claims. New measured context should be admitted only after retention and contract validation.

## Performance and maintainability

The rebuilt main app chunk is **4,782,183 bytes** minified, approximately **594,675 bytes gzip** measured locally. Its CSS files total **791,566 bytes** uncompressed. These are artifact sizes, not measured network transfer times or a Core Web Vitals result.

All primary routes import the large shared `LabApp`, which imports many screens and evidence modules. Split screen components and their data by route; load raw evidence browsers and large supporting data on demand. Separate the roughly 3,022-line application module into the shell, route views and shared components. Consolidate CSS as those components move, instead of appending another visual override layer.

The README still describes exactly five primary screens, while the live product has nine. Update the README, screen map and dataset vocabulary alongside the next implementation pass so paused work resumes from the current product rather than an older specification.

## Verification completed and limits

| Check | Result |
|---|---|
| Retained-data validation | Passed: 36 current response hashes; 44 complete exports / 6,509 rows; 10 aggregate contracts / 12,874 source entities; period fingerprints match. |
| Unit/component tests | 392 tests passed across 39 files. React duplicate-key warnings for collection/sanitation remain in application tests. |
| Lint | Passed. |
| TypeScript | Failed with nine diagnostics across application, tests and configuration. |
| Production static build | Passed on Node 22.20.0: 138 Pages routes, with the production subpath. Large-chunk warning remains. |
| Live browser review | Nine primary destinations; selected Atlas and period-filter interactions; targeted desktop/390 px mobile inspection; light/dark sample. |

The shell initially selected Node 20, below the project requirement; the successful build used the installed Node 22. Prerender required local loopback access outside the sandbox. No deployment was performed. No fresh authenticated Data Lake ingestion, exhaustive accessibility audit, full responsive regression suite or field performance benchmark was performed in this assessment. Passing snapshot checks establishes internal integrity, not upstream truth or currentness.

## Recommended implementation sequence

1. **Trust and release:** fix incomparable ranks, period/headline scope, quantity-versus-rate wording, strict measurement parsing, typecheck failures and publication gates.
2. **Reading experience:** bring mobile findings/controls above the fold, compact interior headers, group navigation, unify evidence disclosures and cohort labels.
3. **Useful intelligence:** connect existing findings into a review queue, add population reconciliation, filtered briefs and evidence-backed question answering.
4. **Responsiveness:** split route/data bundles, consolidate styling, then measure loading and interaction on a representative phone and network.

For acceptance, require a useful headline and subject control in the initial 390 × 844 viewport; consistent units, cohort and period across every linked view; no rank comparison without its category; every answer linked to supporting evidence; and validated data/tests/typecheck before Pages publication.

## Implementation follow-through — 18 November 2026

Implemented locally after approval:

- Withheld national-rank peer positions, extrema, medians (including the district table), colour scales and comparison exports where the source omits ranking categories.
- Restricted programme period choices to retained observations and labelled the headline period; corrected the legacy-waste highest-share wording; added strict missing/negative measurement handling and year-aware latest-month selection.
- Compacted interior heroes, moved Overview subject controls earlier, simplified mobile navigation, removed count-up mutation of evidence figures, and made supporting hero graphics expandable. Held-out Atlas cells now expose their reason on tap or keyboard activation.
- Integrated the existing deterministic evidence-question draft with suggested questions, source links, city/district disambiguation and explicit limits on time, causal and unsupported comparison requests. Questions and executive briefs load on demand.
- Added population/denominator reconciliation and a filtered Atlas text brief with exact scope, held/missing readings and retained-source provenance. Evidence links preserve query parameters and fragments.
- Fixed TypeScript issues, added validation gates before Pages publication, documented all nine screens and added a release manifest for distributable retained JSON inputs (excluding ignored ingestion working files).

Validation: 423 unit/component tests across 40 files passed; data validation, lint and TypeScript passed; the production-subpath build emitted 138 routes. No source records were refreshed or changed.

Remaining: local browser access was unavailable in this chat, so the revised visual layouts and responsive interactions still require rendered browser review. No deployment was performed. The shared route/data bundle remains large; on-demand dialogs are an incremental improvement, not completion of the broader route/data separation or a measured loading-performance improvement.

## Design follow-up — 18 November 2026

Kept from the implementation above: the rank gate, strict measurement parsing, year-aware latest month, per-programme period choices, the remaining-share wording, publication gates, the evidence manifest, Atlas deep links and held-cell reasons, the population note, and the evidence-question guardrails.

Reversed on review with the product owner, who asked that every screen open on its figures and a graphic:

- Screen heroes show their graphic again instead of folding it into a disclosure. The Operational Analytics opening is back, now bound to the pinned period: each figure is that period's last stage over its own earlier stage, and a programme with no rows for the month is named as missing rather than shown at an older month. Its stages are drawn as exact-scale bars (no minimum width, zero marked separately) and no transition between stages is drawn, which answers the funnel and subset findings above.
- The Overview opens on its hero again, with the map after the figures on phones.
- Figures count up to their value once, when first seen; the final value is in the accessible name throughout. A capture taken during that first second can show an intermediate number.
- A meter under a figure is kept only where it is that figure over the population its context names. The rural change carries no meter and turns warm when negative.

Ask the evidence moved from a centred dialog to a side panel (a sheet on phones) with a conversation thread, figure tiles, source chips and supporting readings. An optional Claude worker (`worker/ask-evidence`) can add one framing sentence and order the records; the page shows the cited records verbatim beneath it and discards any framing that carries a digit, a judgement or a cause.
