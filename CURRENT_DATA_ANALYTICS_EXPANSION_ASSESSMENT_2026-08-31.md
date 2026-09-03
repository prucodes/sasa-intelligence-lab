# SASA Intelligence Lab — Current-Data Analytics Expansion Assessment

Date: 31 August 2026

> Implementation update: the recommended deterministic expansion has now been implemented. All 29 complete retained datasets have a visible primary or supporting analytical role. See `DATASET_USAGE_REGISTER_2026-08-31.md` for the reconciled 33-entry register. Gap Radar safeguards remain unchanged.

## Executive verdict

The current product is **not at the limit of what the retained data can support**.

The 29 complete authenticated exports contain 4,359 rows. The current primary analytical views visibly narrate roughly 10 of those exports. Another 19 exports are mostly confined to the catalogue, period matrix, or raw Evidence Inspector even though several contain defensible operational measures.

The strongest next increment is not a new score, route, model, or dashboard. It is a deeper deterministic review layer inside the existing five-screen structure:

1. add legacy-waste clearance and balance analytics;
2. expose district collection-asset reporting separately from ULB procurement;
3. add compact district programme snapshots;
4. expand facility source-status review queues;
5. expose real reported-period history where semantics are comparable;
6. expand candidate evidence bundles and coverage breadth;
7. turn source reconciliation into visible data-quality intelligence.

Gap Radar must remain unscored. None of the additional rows fixes the missing authoritative ULB crosswalk, 2024/2026 period mismatch, or absent approved scoring policy.

## Evidence profile

- 29 complete full exports
- 4,359 retained governed rows
- 21 datasets contain more than one returned period
- period depth:
  - 8 datasets: one period
  - 14 datasets: two periods
  - 4 datasets: three periods
  - 3 datasets: five periods
- 15 operational datasets contain ULB-grain names or source-specific ULB IDs
- across those 15 sources, 250 normalized district-and-ULB name candidates are observed; this is **not** an official ULB count
- three MEPMA datasets each contain the same 123 source-specific ULB IDs with no ID-to-name mapping conflicts inside that family

The profiler used for this assessment is `scripts/profile-current-opportunities.mjs`. It reads the retained full snapshots only and makes no network request.

## High-value analytics available now

### 1. Legacy-waste clearance — strongest unused operational story

The July 2026 retained ULB-grain records support:

- reported target quantity: 14,933,110
- reported achievement: 13,569,745
- aggregate reported clearance ratio: 90.9%
- source-reported remaining balance: 1,353,366
- 47 ULB-name candidates with a positive reported balance
- 73 ULB-name candidates with zero reported balance
- 25 of 120 comparable candidates reported a higher achievement value in July than June
- 95 were unchanged
- one row fails `target − achievement = balance` reconciliation

Safe presentation:

- target → achievement → reported balance
- largest reported balances for review
- reported June/July change counts
- balance reconciliation flag

Do not describe the figures as actual daily processing, utilization, or verified remediation impact.

### 2. Collection evidence has two distinct stories, not one

#### ULB procurement story

The existing E-Auto Service Model view remains valid:

- target: 1,910
- work orders issued: 1,153
- supplied: 134
- work-order ratio: approximately 60%
- delivery ratio: approximately 7.0%
- row-level floor-at-zero reported delivery gaps: 1,780

#### District source-achievement story

Three separate district-grain exports report July 2026 target and achievement:

- Door-to-Door E-Autos: 200 / 200
- Push Carts: 5,000 / 5,000
- Tri-Cycles: 12,000 / 12,000
- 28 district records in each dataset
- the same reported target and achievement values appear in May, June, and July for all 28 districts

These must not be merged with the ULB procurement funnel. They use different grain and apparently different source definitions. Their side-by-side presentation is valuable precisely because it reveals a definition/reconciliation question:

> District asset achievement is reported at target, while the separate ULB procurement dataset reports a much lower supply ratio. The measures are not directly comparable; source definitions require review.

This is evidence intelligence, not a performance conclusion.

Additional inventory values already retained:

- compactors: 25 reported units across 12 ULB records
- sweeping machines: 81 reported supplied units; two entity-period combinations contain more than one distinct record and require review

### 3. Processing source-status review queue

The current facility registry can become more operationally useful without claiming utilization.

ISWM July 2026 source evidence contains:

- 108 ULB records
- 5,392 configured TPD
- 2,957.25 wet configured TPD
- 2,434.75 dry configured TPD
- wet + dry reconciles to total in the retained rows
- exact source-status distribution:
  - Commenced: 66
  - Site Not Available: 21
  - Not Commenced: 9
  - Completed: 8
  - Local Issue: 3
  - Approach Road: 1

The product can show a transparent review queue for records carrying `Site Not Available`, `Not Commenced`, `Local Issue`, or `Approach Road`. These are source statuses, not inferred causes.

Additional configured inventory remains safe:

- CBG: 140 configured TPD across 6 records
- C&D: 480 configured TPD across 3 records
- FSTP: 600 configured KLD across 35 records, but every retained row has a month-number/month-name conflict and must remain visibly quarantined for period-based analysis

### 4. District programme snapshot

Several district-grain datasets can support a compact programme explorer with one selected measure visible at a time.

| Programme | Latest retained period | Reported target | Reported achievement | Aggregate ratio | Important limit |
|---|---|---:|---:|---:|---|
| Plastic-waste management units | July, FY 2026–27 | 210 | 50 | 23.8% | one zero-target row; nine district values are lower in July than June and should be treated as reported revisions/change, not decline |
| ITC WOW in schools | July 2026 | 7,957 | 3,652 | 45.9% | two district rows exceed target |
| Single-use plastic ban | August 2026 | 123 | 29 | 23.6% | district grain only |
| E-waste collection mechanism | August 2026 | 123 | 52 | 42.3% | district grain only |
| ODF Plus model villages | July, FY 2026–27 | 3,569 | 3,529 | 98.9% | earlier-period entity grain is ambiguous for ten entity-period combinations; do not present a historical trend |

Safe presentation:

- latest target → reported achievement
- largest reported gaps by district
- above-target, zero-target, or ambiguous-grain review flags
- explicit district-grain label

### 5. SERP district programme analytics

The three SERP exports contain clearly named target and cumulative-achievement fields for July 2026:

| SERP programme | Target | Cumulative achievement | Reported target coverage |
|---|---:|---:|---:|
| Circular-economy entrepreneurs | 5,000 | 11,084 | 221.7% |
| Kitchen gardens | 713,559 | 403,444 | 56.5% |
| Swachhata awareness | 833,275 | 488,143 | 58.6% |

The circular-economy value above target should be displayed as source-reported cumulative achievement and flagged for definition/target review, not treated as an error automatically.

These records are district grain and must not be manufactured into ULB values.

### 6. Environmental programme snapshots

The July 2026 ULB-grain exports support descriptive target/achievement distributions:

| Dataset | Deduplicated latest target | Achievement | Aggregate ratio | Review conditions |
|---|---:|---:|---:|---|
| Green spaces | 100 | 78 | 78.0% | 23 zero-target rows; 11 achievements above target; one exact duplicate excluded |
| Green cover | 1,400 | 303.01 | 21.6% | six achievements above target; one exact duplicate excluded |
| Water-body rejuvenation | 106 | 49 | 46.2% | 60 zero-target rows; one exact duplicate excluded |

The reported percentages reconcile to target/achievement, but source units and denominator definitions are insufficiently documented. These are suitable for a clearly caveated supporting-programme explorer, not an executive performance score.

### 7. Reported-period history

The current UI understates the amount of period evidence now retained.

- 21 of 29 datasets contain multiple returned periods
- the three MEPMA datasets contain March–July 2026
- the three district collection datasets and plastic-waste units contain three periods
- fourteen datasets contain two periods

Safe use:

- period selector
- exact reported value by period
- “increased / decreased / unchanged reported value” summaries where field semantics are stable
- target-change and carry-forward review checks

Do not call these short series a trend, trajectory, forecast, or prediction.

Some period comparisons are especially informative as data-quality evidence:

- all 28 district collection records are unchanged across May–July in each of the three asset datasets
- ULB E-Auto supplied values are unchanged for 82 comparable exact-name candidates between June and July
- legacy-waste achievement increases in 25 of 120 comparable candidates and is unchanged in 95
- ITC WOW achievement increases in 23 of 24 comparable districts

### 8. Candidate evidence breadth

Coverage can expand beyond the current six-column matrix.

Across 15 ULB-grain operational sources, exact normalized district/name candidate coverage currently has this breadth:

| Number of datasets returning a candidate | Observed candidates |
|---:|---:|
| 1 | 36 |
| 2 | 9 |
| 3 | 78 |
| 4 | 23 |
| 5 | 7 |
| 6 | 20 |
| 7 | 16 |
| 8 | 10 |
| 9 | 14 |
| 10 | 19 |
| 11 | 15 |
| 12 | 3 |

Examples of evidence-rich normalized candidates include Bapatla, Kuppam, and Ongole, each appearing in 12 of the 15 reviewed ULB sources.

This can support:

- “evidence-rich candidates” for officer review;
- a full source-coverage drawer;
- missing-source visibility;
- a multi-source evidence packet in Diagnostics.

It must remain labelled candidate coverage, not official ULB completeness or performance.

### 9. Data-quality intelligence

The retained rows support a much stronger deterministic reconciliation layer than the current quality screen shows.

Across latest-period analytical rows, the profiler observes:

- 6 exact duplicate rows
- 12 entity-period combinations containing more than one distinct record
- 296 rows where source-reported percentage differs from `achievement / target` by more than one percentage point
- 104 zero-target rows in target/achievement datasets
- 22 rows where reported achievement exceeds target
- 35 FSTP period conflicts
- one legacy-waste balance reconciliation failure

The 296 percentage differences are concentrated in the three MEPMA datasets:

- terrace/kitchen gardens: 105 of 123 July rows
- circular-economy entrepreneurs: 75 of 123
- home composting: 116 of 123

This may indicate that `achievement` is monthly while `achievement_percentage` is cumulative or carried forward. Until the source owner confirms semantics, the product should not calculate an official programme progress ratio from those fields.

Safe intelligence outputs:

- formula reconciliation queue;
- duplicate/grain ambiguity queue;
- denominator queue;
- above-target review queue;
- repeated-value/carry-forward review;
- period-conflict quarantine;
- source-status exception queue.

These are deterministic evidence checks, not anomaly detection or root-cause analysis.

## Dataset activation tiers

### Tier A — present more now

- Legacy Waste Clearance
- Door-to-Door E-Autos, Push Carts, and Tri-Cycles at district grain
- Compactors as reported inventory
- ISWM and CBG source-status review
- C&D configured-capacity registry
- IHHL funnel and backlog queue
- Plastic Waste Management Units latest snapshot
- ITC WOW latest snapshot
- Single-Use Plastic Ban latest snapshot
- E-Waste Collection Mechanism latest snapshot
- SERP Circular Economy, Kitchen Garden, and Swachhata Awareness
- ODF, GFC, and National Rank as separate 2024 historical context

### Tier B — present only with prominent quality/semantic limits

- Green spaces, green cover, and water-body rejuvenation: units/denominators require clarification; zero and above-target rows require review
- MEPMA three-programme portfolio: five periods and consistent source-specific IDs exist, but target/achievement/percentage semantics do not reconcile
- ODF Plus model villages: current July snapshot can be described, but earlier entity-period grain is ambiguous
- Sweeping machines: inventory is usable with two ambiguous entity-period cases visible
- FSTP: configured capacity can remain in the registry, but period analytics remain quarantined

### Tier C — still unavailable or unsupported

- Gobardhan analytics
- actual vehicle utilization
- actual facility throughput/utilization
- causal explanations
- asset–outcome Gap Radar scoring
- current outcome impact
- predictive or early-warning models
- next-best-action or investment optimization

## Recommended five-screen upgrade

### Overview

Keep exactly three primary findings.

Recommended change: replace the generic processing-inventory finding with the stronger legacy-waste story:

> “Reported legacy-waste clearance is 90.9%; 1.35 million remains as source-reported balance.”

Keep a concise limitation:

> “This reports clearance quantities, not facility throughput or environmental outcome.”

Facility configured-capacity context can remain in the smaller supporting card.

### Operational Analytics — Collection

Keep the E-Auto ULB procurement funnel as the default view.

Add one secondary segmented view inside the same tab:

- `ULB procurement`
- `District collection assets`

The district view should show the three target/achievement sources, compactors, and sweeping machines. Add an explicit comparison note explaining that district achievement and ULB procurement are different source measures.

### Operational Analytics — Sanitation Delivery

Keep IHHL as the primary narrative.

Add a collapsed “Supporting programme snapshots” section with a single programme selector for:

- ODF Plus model villages
- ITC WOW in schools
- SERP Swachhata awareness

Only one programme visual and one review table should be visible at a time.

### Operational Analytics — Processing Infrastructure

Use a compact internal selector:

- `Legacy waste`
- `Facility registry`
- `Resource-recovery programmes`

Legacy waste should be the additional operational story. Facility registry retains TPD/KLD separation. Resource-recovery programmes can show plastic-waste units, CBG, C&D, e-waste, circular economy, and source-status exceptions without combining their units.

### Operational Analytics — Swachh Outcomes

Keep this tab conservative and historical. Do not fill it with 2026 operational programme outputs.

Add only:

- outcome coverage completeness;
- exact candidate overlaps;
- clearer GFC sparsity;
- no current-performance inference.

### Gap Radar

No scoring change.

The only safe enhancement is a small “evidence available today” link to candidate evidence bundles or Data Readiness. SAMPLE remains unscored.

### ULB Diagnostics

The Evidence Inspector already retains all exact-name matching source records. Improve the case file by adding:

- source-family coverage chips;
- additional current evidence summaries for legacy waste, green programmes, compactors/sweeping, and MEPMA;
- deterministic issue list grouped by source;
- period selector where a candidate has more than one actual record period;
- raw-versus-calculated percentage reconciliation.

Do not create a composite “issue score.”

### Data Readiness

Expand Quality into an operational reconciliation workspace:

- formula mismatch
- balance mismatch
- duplicate/grain ambiguity
- zero denominator
- above-target values
- period conflicts
- unchanged repeated period values
- source field/schema aliases

Expand Coverage from six major datasets to a progressive-disclosure full source matrix. Keep the existing compact six-source view above the fold.

## Recommended reusable selectors

```text
getLegacyWasteSummary()
getDistrictCollectionAssetSummary()
getDistrictProgrammeSummary()
getSerpProgrammeSummary()
getEnvironmentalProgrammeSummary()
getFacilityStatusReviewQueue()
getReportedPeriodComparison()
getEntityEvidenceBreadth()
getSourceReconciliationIssues()
```

Every selector should return raw evidence references, period, grain, numerator/denominator, formula, and quality state.

## Recommended build order

### Increment 1 — highest stakeholder value

1. Legacy-waste analytics
2. District collection-assets subview
3. Expanded source-status review queue
4. Expanded reconciliation issues in Data Readiness
5. Candidate evidence-breadth summary

### Increment 2 — additional programme coverage

1. District programme selector
2. SERP programme snapshot
3. Environmental programme snapshot with semantic warnings
4. Diagnostics evidence-family summaries

### Increment 3 — after source clarification

1. MEPMA five-period portfolio
2. ODF Plus period history
3. FSTP period comparisons

## Guardrails

- Never call normalized-name candidates official ULBs.
- Never combine district and ULB records into one measure.
- Never interpret a missing record as zero.
- Never label supplied assets as working assets.
- Never label configured TPD/KLD as throughput or utilization.
- Never call two to five observations a predictive trend.
- Never compare 2024 outcomes directly with 2026 operations.
- Never rank entities with a hidden or composite score.
- Never silently choose between conflicting source fields.
- Keep raw values and source provenance accessible for every new metric.

## Final recommendation

Proceed with Increment 1 while the data owners prepare the requested standardised data package.

It would make the product visibly richer and more useful without weakening the evidence rules. The most compelling additional stakeholder story is:

> “We can already identify procurement gaps, delivery backlogs, legacy-waste balances, facility-status exceptions, programme target gaps, and source-quality conflicts. We can assemble the evidence for review today. Scoring, prediction, and causal recommendations remain gated until identity, definitions, periods, and outcome evidence are strengthened.”
