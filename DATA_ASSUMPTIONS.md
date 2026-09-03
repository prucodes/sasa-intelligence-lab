# Data assumptions

## Evidence boundary

- Current schemas are documented from the public AI Living Labs catalogue and authenticated dataset responses.
- The signed-in account exposes 30 authorized endpoints: 27 SASA and three SERP.
- Three additional SASA PR table keys are documented separately. They are integration candidates, not yet authenticated retained snapshots, and do not change the 30-endpoint authorized counter.
- SAMPLE mode retains 29 complete, paginated full JSON exports containing 4,359 rows. Gobardhan is authorized but currently fails to export.
- Every retained snapshot reconciles `returnedRecordCount`, `totalRecordCount`, local row count, `hasNextPage=false`, and `nextPageToken=null`.
- Active full exports use empty export filters. Earlier source-filtered snapshots remain archived separately and must not be substituted for the full exports without disclosing their scope.
- The expanded IHHL export contains 246 rows across June and July and 123 observed normalized district-and-ULB name candidates. This is not an official statewide ULB count.
- The latest July IHHL slice contains 119 rows, 117 candidates, and two exact duplicate records. Operational funnel totals exclude those duplicates while retaining them in raw evidence. The latest July E-Auto slice similarly excludes one exact duplicate. This is exact-record reconciliation, not fuzzy entity matching.
- No common stable ULB or district ID is present across the selected endpoints.
- Name normalization provides a candidate identity only; it is not an approved production join.
- Operational full exports contain returned periods from March through August 2026 depending on dataset, while Swachh outcomes are from 2024. Current KPI views use each dataset’s latest returned period and never sum multiple months together.
- All 35 FSTP rows returned for the July filter carry `month_number=7` and `month_name=JUNE`; the conflict is retained and quarantined.

## Calculation rules

- `vehicle_work_order_ratio = actual_work_orders / target`
- `vehicle_delivery_ratio = vehicles_supplied / target`
- `vehicle_delivery_gap = max(target - vehicles_supplied, 0)`
- `ihhl_completion_ratio = completed / approved`
- `ihhl_open_approvals = max(approved - completed, 0)`
- `ihhl_identified_coverage = completed / identified`
- `iswm_split_check = abs(total_tpd - (wet_tpd + dry_tpd)) <= 0.01`
- `legacy_waste_clearance_ratio = achievement / target`
- `legacy_waste_balance_check = abs(target - achievement - balance) <= 1`
- `outcome_lag_years = operational_year - outcome_year`

All divisions use safe-divide behavior. A zero or missing denominator returns `null` and an explicit quality flag. Missing values are never imputed.

The IHHL “large reported backlog” review flag is deterministic: `approved - completed >= 100`. It is a review threshold, not a causal diagnosis or recommendation.

## Eligibility

SAMPLE profiles remain `UNSCORED` unless all of the following are true:

- the ULB match is reviewed;
- all relevant payload pages are retained and reconciled;
- the source period is internally valid;
- operational and outcome years align;
- required values and denominators are valid.

Demo mode uses synthetic canonical keys and policy version `v0-demo` solely to demonstrate interface behavior. Its values are not Andhra Pradesh findings.

## Capacity and status

TPD and KLD fields are labeled configured capacity. They are not described as actual processing, treatment, throughput, or utilization. A source-reported `Completed` status is displayed without inferring operational performance.

## Availability and coverage

- Coverage is keyed only by normalized district-and-ULB name candidates and is labeled unreviewed.
- The compact matrix uses six major operational/outcome sources. The progressive full-breadth view uses 15 operational ULB-grain sources and observes 250 normalized district-and-ULB candidates; neither number is an official ULB count.
- District collection-asset targets and achievements remain district grain and are never merged with the separate ULB E-Auto procurement funnel.
- Evidence breadth means a source returned a candidate record. It does not mean completeness, quality, performance, or scoring eligibility.
- `✓` means a governed row was returned, `—` means not returned, and `⚠` means returned with a visible quality issue. “Not returned” is never interpreted as zero.
- Overlap counts are recomputed from retained rows at runtime.
- Period availability is enumerated only from period fields in actual governed returned records. Catalogue frequency labels, retrieval timestamps, financial-year labels, and inserted dates do not establish calendar-month history.
- ODF, GFC, and National Rank remain a separate descriptive 2024 outcome view and are not joined into a 2026 operational score.
- Legacy-waste target, achievement, and balance are source-reported quantities. They do not establish daily processing, facility utilization, or environmental impact.
- SASA PR examples remain at their documented grain: District, Block/Gram Panchayat, or Gram Panchayat/date. They are never manufactured into ULB rows.
- The PR door-to-door example is incomplete (`100 / 1,241,643`, `hasNextPage=true`) and therefore contributes no analytics or period-availability mark.
- The two PR SWPC/Swachh Ratham titles conflict with their returned field semantics; source-owner review is required before treating either as a facility or asset count.

## Future LIVE connector

LIVE mode is intentionally inert. The local authenticated snapshots do not turn the browser into a live API client. Activation still requires an approved service identity, server-side credential handling, complete pagination, raw evidence retention, typed parsing, period validation, a reviewed ULB crosswalk, and same-year outcome observations.
