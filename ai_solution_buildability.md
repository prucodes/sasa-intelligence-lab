# AI solution buildability from verified SASA data

## Executive verdict

| Solution | Buildable now | Strict interpretation |
|---|---|---|
| Asset–Outcome Gap Radar | **Conditional / not scoreable from retained excerpts** | The schemas can support a descriptive, explainable cross-sectional radar after authenticated full ingestion, a reviewed name crosswalk, and same-year period alignment. The retained examples produce no eligible asset-to-outcome score. A causal or predictive radar is not supported. |
| Swachh Bottleneck & Next-Best-Action Engine | **Partial for rules; no for next-best action** | Single-record KPI bottleneck flags are feasible. Data-driven action ranking or effectiveness claims are not supported by the inspected fields. |
| ULB Early-Warning Radar | **No** | Only one operational month and one annual outcome year are verified; there is no trend history, incident stream, or leading-outcome label. |

These verdicts distinguish schema potential from current deployment readiness. The supplied DOCX retains one representative record per selected endpoint rather than full result sets, and anonymous Data Lake access redirects to sign-in.

## 1. Asset–Outcome Gap Radar

**Buildable now: Conditional schema support; no eligible score from current evidence**

### Exact fields used

- Collection assets: `district_name`, `ulb_name`, `target`, `actual_wrk_order_issued`, `no_of_vehicles_supplied_in_nos`, `percentage`, `mnth_no`, `year`.
- Processing facilities: `district_name`, `ulb_name`, `total_tpd`, `wet_tpd`, `dry_tpd`, `status_tx`, `month_number`, `year`.
- Optional FSTP context: `capacity_in_kld`, `overall_progress`.
- Sanitation delivery: `ihhls_approved_by_mohua`, `no_of_benf_identified`, `under_construction`, `completed`, `percentage_of_achievement`, `month_number`, `year`.
- Outcomes: `gfc_status`, `odf_status`, `national_rank`, `year`.

### Required joins

1. Resolve `district_name + ulb_name` through a reviewed ULB crosswalk to a local `ulb_key`.
2. Join monthly operational datasets on `ulb_key + period_month`.
3. Join annual outcomes on `ulb_key + year` only when the reporting years align.
4. Preserve coverage, match method, `outcome_lag_years`, and stale flags in every result.

### Minimum history needed

- For a descriptive same-period snapshot: one complete operational period plus one outcome observation in the same reporting year.
- For a credible trend/gap signal: at least 12 consecutive monthly operational periods and at least two comparable annual outcome cycles.
- Verified now: only July 2026 operational examples and 2024 outcome examples. The supplied examples do not satisfy same-period asset/outcome alignment.
- The document also does not retain the complete result sets, so statewide coverage, ULB overlap, uniqueness, and join yield cannot be measured.

### Missing fields

- stable ULB and district IDs across these endpoints;
- population, households, waste generated, collection coverage, service area, and other denominators;
- actual facility inflow/throughput, uptime/downtime, rejects, and utilization;
- asset condition, availability, trips, routes, fuel/energy, and maintenance;
- outcome methodology/population category needed to interpret rank comparably;
- aligned current-year GFC/ODF/rank observations;
- verified multi-period history.

### Safe model claims

- “For this source record and period, the ULB reported X vehicles supplied against target Y.”
- “The facility record reports Z TPD of configured capacity and status label S.”
- “The outcome dataset reports ODF label/rank/GFC label for year Y.”
- “These records were joined through a reviewed name crosswalk,” with match method and coverage shown.
- “A high-gap flag is a deterministic comparison of reported fields,” when all periods are aligned and the rule is displayed.

### Claims it must not make

- that assets caused or failed to cause an outcome;
- that `total_tpd` is actual throughput or utilization;
- that more assets/capacity necessarily implies better sanitation performance;
- that a 2026 asset snapshot explains a 2024 outcome;
- that raw asset counts are comparable across differently sized ULBs without denominators;
- that unobserved ULBs have zero assets or poor outcomes;
- that a fuzzy/name-only join is authoritative.

## 2. Swachh Bottleneck & Next-Best-Action Engine

**Buildable now: Partial for deterministic snapshot rules; not buildable as a next-best-action engine**

### Exact fields used

- Procurement bottleneck: `target`, `actual_wrk_order_issued`, `no_of_vehicles_supplied_in_nos`.
- Facility readiness: `status_tx`, `total_tpd`, `wet_tpd`, `dry_tpd`, `overall_progress`, `capacity_in_kld`.
- IHHL pipeline: `no_of_benf_identified`, `ihhls_approved_by_mohua`, `under_construction`, `completed`, `percentage_of_achievement`.
- Outcome context only: `gfc_status`, `odf_status`, `national_rank`.

### Required joins

- Same ULB crosswalk as above.
- Same-month operational join on `ulb_key + period_month`.
- Annual outcome context joined only by aligned `ulb_key + year` and explicitly labeled as context, not an action-effect estimate.

### Minimum history needed

- One month can support a snapshot rule such as “work orders below target” or “reported completions below approvals.”
- At least six consecutive months are needed to label a bottleneck persistent or worsening.
- Action ranking/effectiveness requires a longitudinal intervention/outcome table; none was observed.

### Missing fields

- root-cause codes, complaints, inspections, SLA breaches, ward/route/facility detail;
- asset uptime, collection tonnage, facility throughput/utilization;
- budget, cost, workforce, contractor, due date, dependencies, and action eligibility;
- action catalogue, action owner, action taken, completion, and measured post-action outcome;
- consistent history and causal/confounding variables.

### Safe model claims

- “The reported delivery ratio is below a configured threshold.”
- “The reported IHHL pipeline has approvals/identified beneficiaries not reflected in completed counts,” only when the arithmetic and denominator are valid.
- “The facility status is the source label shown.”
- “This rule suggests a review queue,” with the exact triggering fields and no claim of optimality.

### Claims it must not make

- “This is the root cause.”
- “This action is optimal/next best” or will improve GFC/ODF/rank.
- “The ULB has insufficient treatment capacity” without waste-generation and throughput denominators.
- “The facility is utilized/operational” merely because capacity or `Completed` is reported.
- “The ULB will fail certification/ranking.”

## 3. ULB Early-Warning Radar

**Buildable now: No**

### Exact fields that would be candidate signals

`percentage`, `no_of_vehicles_supplied_in_nos`, `target`, `status_tx`, `total_tpd`, `overall_progress`, `percentage_of_achievement`, `under_construction`, `completed`, `gfc_status`, `odf_status`, `national_rank`, and validated period fields.

### Required joins

- reviewed `ulb_key` crosswalk;
- complete monthly time series per ULB;
- aligned outcome labels or a defined failure event per forecast horizon.

### Minimum history needed

- Minimum for basic threshold/trend warnings: 12 consecutive monthly periods per ULB.
- Preferable for seasonal/predictive validation: 24+ months and at least two comparable annual outcome cycles.
- Verified history is one month plus one annual outcome snapshot, so neither trend estimation nor backtesting is possible.

### Missing fields

- consecutive time series;
- timestamped incidents, complaints, inspections, outages, utilization, and service-level failures;
- explicit warning target/label and forecast horizon;
- data freshness/completeness SLA;
- intervention and recovery outcomes;
- stable ULB identity.

### Safe claims now

- None about future risk. The system may only report current data-quality or current-threshold exceptions.

### Claims it must not make

- probability of deterioration, failure, rank drop, or certification loss;
- anomaly, trend, seasonality, or early warning from a single snapshot;
- calibrated risk scores or lead time;
- statewide coverage when record coverage varies sharply across datasets.

## Best MVP recommendation

Build the **data-quality and evidence foundation for the Asset–Outcome Gap Radar first**, with an operational snapshot mode that shows procurement progress, reported facility capacity/status, and IHHL pipeline counts. Keep the asset-to-outcome gap component disabled or explicitly unscored until authenticated full payloads, reviewed ULB matches, and same-year outcome data are available. This preserves the proposed radar as the best target architecture without pretending the retained 2026 asset and 2024 outcome excerpts form a valid gap score. Do not launch an Early-Warning model or claim next-best-action optimization until history, utilization, stable IDs, and intervention data are supplied.

## Production activation gates

| Capability | Minimum activation evidence | Current status |
|---|---|---|
| Operational snapshot | fresh authenticated payload, complete pagination, valid typed fields, reviewed ULB match | Blocked by access and unretained full payloads |
| Asset–outcome gap flag | operational snapshot requirements plus same-year outcome and disclosed comparison cohort | Blocked by 2026/2024 mismatch |
| Persistent bottleneck flag | at least six consecutive validated months under a declared business rule | No verified history |
| Early-warning model | forecast label/horizon, 12+ consecutive months (preferably 24+), multiple outcome cycles, backtest | Unsupported |
| Next-best-action ranking | action catalogue, eligibility, cost/owner/dependencies, interventions, post-action outcomes | Unsupported |

The six-, 12-, and 24-month thresholds above are proposed product validation gates, not claims about periods present in SASA.

## Smallest production-ready MVP architecture

This architecture is appropriate only for the descriptive Asset–Outcome Gap Radar described above.

### Normalized tables

| Table | Key | Essential columns |
|---|---|---|
| `dim_ulb` | `ulb_key` | canonical district/ULB names; optional authoritative IDs only when supplied |
| `ulb_alias` | source + raw district + raw ULB | `ulb_key`, normalized values, match method/confidence, review audit fields |
| `dim_period` | `period_month` | year, month, financial year |
| `api_ingestion_run` | `run_id` | table key, request filters, generated time, counts, pagination completeness, checksum |
| `asset_eauto_monthly` | ULB + month + run | raw and parsed target, work orders, supplied, reported percentage |
| `facility_iswm_monthly` | ULB + month + run | raw and parsed total/wet/dry TPD, raw status |
| `facility_fstp_monthly` | ULB + month + run | parsed KLD capacity, parsed progress, period-conflict flag |
| `sanitation_ihhl_monthly` | ULB + month + run | identified, approved, under construction, completed, reported percentage |
| `outcome_swachh_annual` | ULB + year + outcome type + run | raw GFC/ODF label or parsed national rank |
| `ulb_feature_snapshot` | ULB + as-of period | calculated features, source coverage, quality flags, evidence JSON |
| `gap_flag_policy` | policy version | effective dates, eligible components, cohort definition, versioned thresholds, approval metadata |
| `ulb_gap_assessment` | ULB + as-of period + policy version | component values, unscored reasons, flag, explanation |

All facts should retain raw strings, parsed values, source table key, source period, run ID, and record hash.

### Feature calculations

Use only observed fields and return `null` rather than impute missing values.

```text
vehicle_work_order_ratio = actual_wrk_order_issued / target
vehicle_delivery_ratio   = no_of_vehicles_supplied_in_nos / target
vehicle_delivery_gap     = max(target - no_of_vehicles_supplied_in_nos, 0)

iswm_total_tpd           = parsed total_tpd
iswm_split_check         = abs(total_tpd - (wet_tpd + dry_tpd)) <= tolerance
iswm_status_label        = raw status_tx                 # do not infer utilization

ihhl_completion_ratio    = completed / ihhls_approved_by_mohua
ihhl_identified_coverage = completed / no_of_benf_identified
ihhl_open_approvals      = max(ihhls_approved_by_mohua - completed, 0)

outcome_rank             = parsed national_rank
outcome_gfc_label        = raw gfc_status
outcome_odf_label        = raw odf_status
outcome_lag_years        = operational_year - outcome_year
```

Every division uses `safe_divide`: zero or missing denominator returns null plus an `undefined_denominator` flag.

### Scoring logic

Version 1 should be deterministic and deliberately conservative:

1. **Eligibility gate:** reviewed ULB match, complete pagination, valid period, same-year operational/outcome data, and at least one asset readiness ratio plus one outcome field.
2. **Asset readiness:** use target-based ratios only. Do not size-normalize raw TPD or asset counts without population/waste denominators.
3. **Outcome weakness:** use within-year rank percentile only if complete rank coverage, comparability, and the comparison cohort are disclosed and approved. Preserve GFC/ODF as categorical facets until a domain-approved ordinal dictionary is provided.
4. **Gap flag:** flag “high reported asset progress with weak reported outcome” only when both dimensions are eligible and the versioned policy supplies the two thresholds. Display the policy version and component fields.
5. **Unscored state:** default when periods are stale/misaligned, ULB matching is unresolved, or denominators are zero/missing.

Do not create a weighted composite score in version 1: the observed fields do not justify weights across vehicles, configured capacity, IHHL delivery, and categorical outcomes. A flag is safer and more auditable. The source data does not supply valid threshold values, so production thresholds must remain unset until a named domain owner approves them in `gap_flag_policy`; unset thresholds yield `unscored`, never an implicit default.

No causal language, forecasting, automated recommendations, or learned model is warranted in version 1.

### API aggregation logic

Ingestion:

```text
POST governed shared-data request with exact tableKey and filters
→ follow nextPageToken until hasNextPage=false
→ reconcile record count
→ retain raw payload hash and response metadata
→ parse typed values with error flags
→ validate period fields
→ resolve reviewed ulb_key or quarantine
→ upsert immutable source-versioned facts
→ refresh eligible feature snapshots and gap flags
```

Suggested internal APIs:

| Endpoint | Purpose |
|---|---|
| `GET /api/v1/ulbs?district=&match_status=` | canonical ULBs and crosswalk coverage |
| `GET /api/v1/ulbs/{ulb_key}/evidence?as_of=` | raw/parsed source evidence and quality flags |
| `GET /api/v1/gap-radar?as_of=&district=&status=` | eligible/scored/unscored ULB list with components |
| `GET /api/v1/gap-radar/{ulb_key}?as_of=` | ULB detail, source periods, join provenance, calculations |
| `GET /api/v1/data-quality?run_id=&table_key=` | pagination, parsing, period, duplicate, and join audits |
| `POST /api/v1/ingestion-runs` | controlled server-side ingestion trigger; not exposed to public clients |

### Minimum production components

| Component | Smallest responsibility |
|---|---|
| Governed source connector | authenticate server-side, submit exact table-key requests, paginate, retry safely, and record request/response metadata |
| Immutable raw evidence store | retain each response page, checksum, retrieval time, table key, filters, and run ID; encrypt and apply retention policy |
| Validation/normalization worker | parse typed values, validate periods and grain, resolve reviewed ULB aliases, quarantine failures, and publish quality metrics |
| PostgreSQL or equivalent relational store | hold the normalized dimensions/facts, policy versions, feature snapshots, and evidence pointers |
| Read-only application API | enforce user/role scope and serve radar, evidence, coverage, and quality endpoints; ingestion trigger remains operator-only |
| Scheduler and operations controls | run approved refreshes, alert on schema drift/pagination mismatch/staleness, and expose run logs and audit history |

There is no model-serving component in version 1. Secrets remain in a managed secret store, raw payloads never go to the browser, and every displayed metric links back to a run ID and record hash.

The separate SASA KPI Dashboard whitelisting evidence suggests an IMS-hosted connector already targets the Data Lake `/api/v1/datasets/<tableKey>/query` family. Reuse should be evaluated through the platform owner and existing service identity, but the screenshot does not authorize credential reuse or prove permissions for the representative radar datasets.

### Minimum dashboard views

UI design is out of scope, but the minimum information views are:

1. **ULB gap list:** ULB, reporting periods, asset ratios, facility label/capacity, IHHL ratio, outcome labels/rank, gap flag, and unscored reason.
2. **ULB evidence detail:** exact source fields, formulas, source periods, join method, and data-quality flags.
3. **Coverage and quality:** fetched/expected rows, ULB crosswalk coverage, unmatched/ambiguous names, period conflicts, and outcome staleness.

These views are requirements for auditability; no visual design should begin until authenticated API access confirms actual retained periods and a reviewed ULB master is available.
