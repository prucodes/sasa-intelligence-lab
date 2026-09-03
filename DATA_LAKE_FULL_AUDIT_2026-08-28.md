# Authenticated Data Lake Audit — 28 August 2026

## Executive result

- The signed-in account is authorized for all 30 published datasets: 27 SASA and 3 SERP.
- The project catalogue contains all 30 authorized table keys.
- The project retains 29 complete, filter-scoped JSON snapshots containing 1,136 rows.
- Unfiltered authenticated checks show 4,359 currently addressable records across the 29 working datasets, or 3,223 more records than the retained filtered snapshots.
- This difference is not 3,223 new entities. It primarily represents additional periods, locations, and records at mixed grains.
- Gobardhan is the only dataset that remains unavailable. Query, JSON export, and XLSX export all fail upstream.
- Thirteen other dataset detail pages use stale filter names. Their underlying datasets remain accessible through corrected requests and/or the export API.
- The export API is more reliable than the interactive query surface for Plastic Waste, ITC WOW, FSTP, and Compactors: an empty-filter query reports a non-zero total but returns zero records, while the corresponding full JSON export returns all records.

## Dataset-by-dataset reconciliation

| # | Dataset | Grain | Retained rows | Current live total | Periods observed in current live data | Immediate safe use | Evidence or contract issue |
|---:|---|---|---:|---:|---|---|---|
| 1 | SERP Kitchen Garden | District | 25 | 28 | July 2026 | District target and cumulative-achievement analytics | Three records use `month = "July "` and are excluded by an exact `July` filter |
| 2 | SERP Swachhata Awareness | District | 25 | 28 | July 2026 | District awareness target and cumulative-achievement analytics | Same trailing-space month issue |
| 3 | SERP Circular Economy | District | 25 | 28 | July 2026 | District enterprise target and cumulative-achievement analytics | Same trailing-space month issue |
| 4 | Door-to-Door E-Autos | District | 28 | 84 | May–July 2026 | Three-month district delivery trend | Explorer sends stale `mnth_no`; live schema now uses generic `target` and `achievement` fields |
| 5 | Door-to-Door Push Carts | District | 28 | 84 | May–July 2026 | Three-month district delivery trend | Same filter and schema drift |
| 6 | Door-to-Door Tri-Cycles | District | 28 | 84 | May–July 2026 | Three-month district delivery trend | Same filter and schema drift |
| 7 | Gobardhan Units | Not retrievable | 0 | Unavailable | Unavailable | None until repaired | Query, JSON export, and XLSX export fail upstream |
| 8 | ODF Plus Model Villages | District | 1 | 84 | May and July 2026 labels observed | District rural sanitation target/achievement view | Retained export is geographically filtered; apparent period distribution needs source review |
| 9 | E-Autos Service Model | ULB | 83 | 166 | June–July 2026 | Procurement funnel by ULB | Stale filter names and canonical schema drift; two pages required |
| 10 | Plastic Waste Management Units | District | 1 | 84 | May–July 2026 | District target/achievement registry | Empty query returns 0 of 84; full JSON/XLSX exports correctly contain 84 |
| 11 | ITC WOW in Schools | District | 1 | 48 | June–July 2026 | District school-programme target/achievement view | Empty query returns 0 of 48; full JSON export correctly contains 48 |
| 12 | MEPMA Circular Economy Entrepreneurs | ULB with dataset ID | 1 | 615 | March–July 2026 | Five-month ULB operational trend | Dataset `ulb_id` is useful but is not yet an approved cross-dataset master ID |
| 13 | MEPMA Terrace/Kitchen Gardens | ULB with dataset ID | 1 | 615 | March–July 2026 | Five-month ULB operational trend | Same identity limitation |
| 14 | MEPMA Home Composting | ULB with dataset ID | 1 | 615 | March–July 2026 | Five-month ULB operational trend | Same identity limitation |
| 15 | Legacy Waste Clearance | ULB | 2 | 246 | June–July 2026 | Remediated quantity, balance, and reported completion | Retained snapshot is source-filtered; do not relabel as facility utilization |
| 16 | New IHHLs | ULB | 123 | 246 | June–July 2026 | Two-month identified-to-completed funnel | No stable shared ULB ID; duplicates and zero denominators require flags |
| 17 | FSTP Information | ULB | 35 | 70 | June–July 2026 | Configured KLD and source-reported progress | `month_number = 7` still pairs with `month_name = JUNE`; empty query returns 0 of 70 but export returns 70 |
| 18 | Compactors | ULB | 12 | 24 | June–July 2026 | Supplied-unit counts | Empty query returns 0 of 24 but export returns 24; no utilization field |
| 19 | Green Cover | ULB | 123 | 244 | June–July 2026 | Descriptive target/achievement trend | Stale `mnth_no` filter and canonical schema drift |
| 20 | Water-Body Rejuvenation | ULB | 123 | 244 | June–July 2026 | Descriptive target/achievement trend | Same filter and schema drift |
| 21 | Green Spaces | ULB | 123 | 244 | June–July 2026 | Descriptive target/achievement trend | Same filter and schema drift |
| 22 | ISWM Facilities | ULB | 108 | 216 | June–July 2026 | Configured TPD, wet/dry split, status | Two pages; capacity is not actual processing or utilization |
| 23 | CBG Units | ULB | 6 | 12 | June–July 2026 | Configured TPD and source status | Capacity is not actual processing or utilization |
| 24 | GFC Status | ULB | 5 | 5 | 2024 | Descriptive 2024 outcome | Too sparse and too old for a 2026 operational score |
| 25 | ODF Status | ULB | 85 | 85 | 2024 | Descriptive 2024 outcome | Must remain separate from 2026 operations |
| 26 | National Rank | ULB | 74 | 74 | 2024 | Descriptive 2024 outcome | Relative rank is not a continuous outcome measure and is not contemporaneous |
| 27 | Sweeping Machines | ULB | 14 | 28 | June–July 2026 | Supplied-machine counts | No utilization or condition field |
| 28 | C&D Waste Processing | ULB | 3 | 6 | June–July 2026 | Configured plant capacity | Capacity is not actual throughput |
| 29 | Single-Use Plastic Ban | District | 26 | 26 | August 2026 | District reported target/achievement | Missing ULB rows are not zero; current values require denominator checks |
| 30 | E-Waste Collection Mechanism | District | 26 | 26 | August 2026 | District reported target/achievement | Missing ULB rows are not zero; current values require denominator checks |

## API, JSON, and Excel findings

The authenticated Playground publishes the same 30 table keys exposed by the catalogue and supports:

- `GET /api/v1/datasets`
- `POST /api/v1/datasets/{tableKey}/query`
- `POST /api/v1/datasets/{tableKey}/export?format=json|xlsx`
- page-token pagination for queries
- generated examples for cURL, Node.js, Python, Java, Rust, and Go

Validated export behavior includes:

- small single-page datasets;
- multi-page exports such as the 615-row MEPMA Circular Economy dataset;
- datasets where the query explorer is inconsistent, such as the 84-row Plastic Waste dataset;
- JSON and XLSX parity for representative small, multi-page, and anomaly cases;
- an XLSX data sheet plus a Metadata sheet containing table key, export time, record count, response metadata, and exported page count where pagination was needed.

Representative reconciliations:

- MEPMA Circular Economy JSON: 615 records, five month IDs, seven exported pages.
- MEPMA Circular Economy XLSX: 615 data rows plus header, and a Metadata sheet reporting 615 records.
- Plastic Waste JSON: 84 records across May–July despite the interactive empty-filter query returning zero rows.
- Plastic Waste XLSX: 84 data rows plus header, and a Metadata sheet reporting 84 records.
- Gobardhan JSON and XLSX: both fail with the same upstream Data Lake error.

## What should be ingested now

1. Use full JSON exports as the preferred bulk-harvest path for all 29 working datasets.
2. Retain each response envelope and export metadata, not only the records array.
3. Preserve raw field names while mapping old dataset-specific schemas and new canonical schemas into versioned parsed models.
4. Enumerate periods from returned records before applying a period filter.
5. Reconcile exported record counts and page counts before activation.
6. Store raw period strings and normalized period candidates separately.
7. Add explicit quality issues for query/export disagreement, stale UI filters, whitespace period variants, schema drift, and FSTP conflicts.
8. Never promote dataset-specific MEPMA `ulb_id` values into the statewide master crosswalk without source-owner confirmation.

## Data request package required to complete the product

### Priority 0 — unlock a real, evidence-gated Gap Radar

Request an authoritative ULB master and crosswalk containing:

- stable statewide `ulb_id`;
- canonical ULB name and reviewed aliases;
- district ID and canonical district name;
- ULB type, class, and active status;
- effective-from/effective-to dates for boundary or naming changes;
- mappings from every source-specific ULB/district ID to the master ID.

Request same-period outcome evidence containing:

- 2026 ODF and GFC outcomes and their component measures;
- 2026 Swachh Survekshan result/rank with category and cohort;
- publication/revision date and assessment period;
- stable ULB ID on every row;
- definitions and denominator rules for every component.

Request an approved scoring policy containing:

- the permitted implementation and outcome indicators;
- minimum completeness and freshness requirements;
- thresholds, transformations, weights, and directionality;
- treatment of missing, zero, not-applicable, and suppressed values;
- review owner, approval date, and version;
- an explicit rule that failed identity, period, or denominator gates produce `UNSCORED`.

### Priority 1 — make the operational product substantially stronger

Request at least 12 months, preferably 24 months, of monthly ULB-grain records for:

- household door-to-door collection coverage and source segregation;
- waste generated, collected, transported, processed, and landfilled, with units;
- actual facility throughput and downtime separately from configured capacity;
- asset operational condition, deployment, downtime, and service area separately from supplied counts;
- IHHL approval/completion dates and denominator definitions;
- legacy-waste opening balance, remediated quantity, closing balance, and revisions;
- complaints/service requests, response times, and resolution outcomes where legally and operationally appropriate.

Every fact table should include stable record ID, stable ULB ID, period start/end, reporting timestamp, revision/version, unit, numerator, denominator, missingness reason, and source provenance.

### Priority 2 — future predictive and intervention capabilities

Only after validated history exists, request:

- action/intervention logs;
- implementation dates and responsible unit;
- cost and funding source;
- pre-action and post-action outcome observations;
- facility/asset IDs and maintenance events;
- target labels suitable for a formally reviewed prediction task.

These fields are prerequisites for later persistent-bottleneck, early-warning, and intervention-effectiveness work. They do not authorize causal claims in the current product.

## Product recommendation

Use the additional data immediately for descriptive multi-month Operational Analytics and richer Diagnostics. Do not activate real Gap Radar quadrant placement yet. The additional rows improve operational usefulness, but they do not resolve the two decisive blockers: reviewed cross-source ULB identity and same-period outcome evidence.
