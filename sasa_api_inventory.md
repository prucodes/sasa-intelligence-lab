# SASA API inventory for AI solution buildability

## Scope and evidence standard

This inventory separates three evidence layers:

1. **Current public catalogue metadata** inspected on 2026-08-27 at [AI Living Labs Government Data](https://ailivinglabs.ap.gov.in/government-data). It lists 27 SASA datasets and exposes the exact table keys and column metadata.
2. **Supplied API response examples** in `/Users/pruthviyannam/Downloads/data.docx`. These are sample API responses generated on 2026-08-17 and 2026-08-19 and include record counts and representative records.
3. **Governed Data Lake access** at `https://datalakes.ailivinglabs.ap.gov.in/datasets/<tableKey>`. Anonymous access redirected to the Sovereign AI Stack sign-in page, so no fresh authenticated payload could be fetched. The catalogue also states that sample record values were not included in its metadata workbook.

Accordingly, schemas below are current catalogue schemas, while payload values and record counts are from the supplied sample responses. No undocumented fields or historical periods are assumed.

The catalogue and supplied document expose dataset `tableKey` values, request bodies, and governed Data Lake routes, but they do **not** expose an anonymous shared-data HTTP endpoint URL. This inventory therefore reports the exact dataset key and Data Lake route and does not invent a network path.

## Acceptance evidence ledger

| Required category | Current schema inspected | Payload inspected | Evidence |
|---|---|---|---|
| Collection & Machinery | E-Autos Service Model detail in the public catalogue | supplied sample response, 83 records, July 2026 | `data.docx`, pages 7-8 |
| Processing & Facilities | MSW Processing — ISWM Facilities detail | supplied sample response, 108 records, July 2026 | `data.docx`, pages 27-28 |
| Sanitation Outcomes | Identification of New IHHLs detail | supplied sample response, 123 records, July 2026 | `data.docx`, pages 18-19 |
| Swachh / GFC / ODF | GFC, ODF, and National Rank details | supplied sample responses, 5/85/74 records, 2024 | `data.docx`, pages 30-33 |

These are sample payloads rather than fresh authenticated reads. The linked Data Lake was checked and redirected to sign-in.

## Shared response envelope observed in supplied samples

```json
{
  "requestEcho": {
    "departmentId": "string",
    "requestId": "string",
    "purpose": "string",
    "tableKey": "string",
    "filters": {}
  },
  "responseMetadata": {
    "responseId": "string",
    "generatedAt": "ISO-8601 datetime string",
    "totalRecordCount": "integer",
    "returnedRecordCount": "integer",
    "hasNextPage": "boolean",
    "nextPageToken": "string or null",
    "tableKey": "string",
    "tableName": "string"
  },
  "records": ["dataset-specific record objects"]
}
```

Operational samples show pagination: the ISWM and IHHL examples returned 100 of 108 and 100 of 123 records respectively with `hasNextPage: true`.

## Identifier and type conclusions

- **Common ULB ID:** absent across the representative ULB-level endpoints. They expose `ulb_name`, not `ulb_id`.
- **Common district ID:** absent across the representative ULB-level endpoints. They expose `district_name`, not `district_id` or `dstrt_id`.
- **Raw KPI types:** all KPI values in the inspected payload records are JSON strings, including counts, capacity, percentages, month numbers, years, and national rank. They require explicit parsing and validation.
- **Dates:** `inserted_date` is documented in current catalogue schemas but is absent from every inspected sample record. It cannot be treated as reliably populated.
- **Period field names:** inconsistent (`mnth_no` versus `month_number`; `fin_year` versus `financial_year`).
- **Verified historical depth:** only the periods actually present in supplied examples can be verified: one monthly snapshot (July 2026) for the operational datasets and one annual snapshot (2024) for Swachh outcome datasets. Catalogue frequency labels do not prove retained history.

## A. Collection & Machinery

### E-Autos Service Model

- **Dataset key:** `sasa_sac_machinery_e_autos_service_model_api`
- **Data Lake route:** `https://datalakes.ailivinglabs.ap.gov.in/datasets/sasa_sac_machinery_e_autos_service_model_api`
- **Catalogue name:** E-Autos Service Model
- **Grain inferred from fields/sample:** one ULB-month record
- **Sample inspected:** Anakapalli / Narsipatnam, July 2026; 83 records returned in the sample response
- **ULB identifier:** `ulb_name` only
- **District identifier:** `district_name` only
- **Period:** `mnth_no`, `month_name`, `year`, `fin_year`; catalogue also documents nullable/unverified `inserted_date`
- **Verified history:** one observed month, July 2026

| Field | Raw payload type | Semantic type | Role |
|---|---:|---|---|
| `district_name` | string | categorical identifier | district name |
| `ulb_name` | string | categorical identifier | ULB name |
| `target` | string | numeric count | planned vehicles |
| `actual_wrk_order_issued` | string | numeric count | work orders issued |
| `no_of_vehicles_supplied_in_nos` | string | numeric count | vehicles supplied |
| `percentage` | string | numeric percentage | reported achievement percentage |
| `mnth_no` | string | integer month | period |
| `month_name` | string | categorical month | period display |
| `year` | string | integer year | period |
| `fin_year` | string | categorical fiscal period | period |
| `inserted_date` | not present in sample | datetime if populated | ingestion metadata |

Sample KPI values: `target="6"`, `actual_wrk_order_issued="3"`, `no_of_vehicles_supplied_in_nos="0"`, `percentage="0.0"`.

**Status/capacity/utilization:** no status, rated capacity, uptime, trips, tonnage, or utilization field. The endpoint supports procurement/delivery progress only.

### Supporting endpoint: Compactor Machinery

- **Dataset key:** `sasa_sac_machinery_compactors_api`
- **Fields:** `inserted_date`, `month_number`, `no_of_units`, `fin_year`, `year`, `district_name`, `month_name`, `ulb_name`
- **Sample:** Bapatla / Bapatla, July 2026, `no_of_units="1"`; 12 total records
- **Limitation:** asset count only; no capacity, serviceability, utilization, or target.

## B. Processing & Facilities

### MSW Processing — ISWM Facilities

- **Dataset key:** `sasa_sac_msw_processing_facilities_iswm_facilities_api`
- **Data Lake route:** `https://datalakes.ailivinglabs.ap.gov.in/datasets/sasa_sac_msw_processing_facilities_iswm_facilities_api`
- **Catalogue name:** MSW Processing — ISWM Facilities
- **Grain inferred from fields/sample:** one ULB-month record
- **Sample inspected:** Anakapalli / Narsipatnam, July 2026; 108 total records, first 100 returned
- **ULB identifier:** `ulb_name` only
- **District identifier:** `district_name` only
- **Period:** `month_number`, `month_name`, `year`, `financial_year`; catalogue also documents nullable/unverified `inserted_date`
- **Verified history:** one observed month, July 2026

| Field | Raw payload type | Semantic type | Role |
|---|---:|---|---|
| `district_name` | string | categorical identifier | district name |
| `ulb_name` | string | categorical identifier | ULB name |
| `total_tpd` | string | numeric capacity | total tonnes/day |
| `wet_tpd` | string | numeric capacity | wet-waste tonnes/day |
| `dry_tpd` | string | numeric capacity | dry-waste tonnes/day |
| `status_tx` | string | categorical status | facility/project status |
| `month_number` | string | integer month | period |
| `month_name` | string | categorical month | period display |
| `year` | string | integer year | period |
| `financial_year` | string | categorical fiscal period | period |
| `inserted_date` | not present in sample | datetime if populated | ingestion metadata |

Sample values: `total_tpd="30"`, `wet_tpd="16.5"`, `dry_tpd="13.5"`, `status_tx="Completed"`.

**Status/capacity/utilization:** capacity and a categorical status are present. Actual waste received/processed, uptime, downtime, throughput, rejects, and utilization are absent. `total_tpd` therefore must not be described as actual processing or utilization.

### Supporting endpoint: FSTP Establishment

- **Dataset key:** `sasa_sac_establishing_fstps_information_api`
- **Fields:** `district_name`, `capacity_in_kld`, `month_name`, `inserted_date`, `month_number`, `year`, `overall_progress`, `fin_year`, `ulb_name`
- **Sample:** Anantapur / Rayadurg, `capacity_in_kld="20"`, `overall_progress="100%"`, `month_number="7"`, `month_name="JUNE"`, `year="2026"`; 35 total records
- **Data-quality warning:** `month_number="7"` conflicts with `month_name="JUNE"`. Period construction must prefer a validated numeric year-month and quarantine conflicts.
- **Limitation:** no inflow, treated volume, effluent-quality, uptime, or utilization field.

## C. Sanitation Outcomes

### Identification of New IHHLs

- **Dataset key:** `sasa_sac_identification_of_new_ihhls_api`
- **Data Lake route:** `https://datalakes.ailivinglabs.ap.gov.in/datasets/sasa_sac_identification_of_new_ihhls_api`
- **Catalogue name:** Identification of New IHHLs
- **Grain inferred from fields/sample:** one ULB-month record
- **Sample inspected:** Anakapalli / Yelamanchali, July 2026; 123 total records, first 100 returned
- **ULB identifier:** `ulb_name` only
- **District identifier:** `district_name` only
- **Period:** `month_number`, `month_name`, `year`, `fin_year`; catalogue also documents nullable/unverified `inserted_date`
- **Verified history:** one observed month, July 2026

| Field | Raw payload type | Semantic type | Role |
|---|---:|---|---|
| `district_name` | string | categorical identifier | district name |
| `ulb_name` | string | categorical identifier | ULB name |
| `ihhls_approved_by_mohua` | string | numeric count | approvals |
| `no_of_benf_identified` | string | numeric count | identified beneficiaries |
| `under_construction` | string | numeric count | construction pipeline |
| `completed` | string | numeric count | completed IHHLs |
| `percentage_of_achievement` | string | numeric percentage after `%` removal | reported achievement |
| `month_number` | string | integer month | period |
| `month_name` | string | categorical month | period display |
| `year` | string | integer year | period |
| `fin_year` | string | categorical fiscal period | period |
| `inserted_date` | not present in sample | datetime if populated | ingestion metadata |

Sample KPI values are all zero, including `percentage_of_achievement="0%"`.

**Status/capacity/utilization:** pipeline counts are present, but there is no beneficiary-level status, completion date, ward, contractor, age-in-stage, rejection reason, or toilet functionality/usage measure.

## D. Swachh Survekshan / GFC / ODF outcomes

### Swachh Survekshan — GFC Status

- **Dataset key:** `sasa_sac_swacch_survekshan_information_gfc_status_api`
- **Fields:** `year`, `gfc_status`, `ulb_name`, `inserted_date`, `district_name`
- **Sample:** East Godavari / RAJAHMUNDRY, `gfc_status="3 Star"`, `year="2024"`; 5 records
- **Identifiers:** names only; no ULB or district ID
- **Verified history:** one observed annual snapshot, 2024
- **Numeric KPI fields:** none in the raw schema. A star number may be parsed for display, but an ordinal scoring policy is not supplied by this dataset.
- **Status fields:** `gfc_status` categorical

### Swachh Survekshan — ODF Status

- **Dataset key:** `sasa_sac_swacch_survekshan_information_odf_status_api`
- **Fields:** `district_name`, `ulb_name`, `odf_status`, `inserted_date`, `year`
- **Sample:** Anakapalli / NARSIPATNAM, `odf_status="ODF+"`, `year="2024"`; 85 records
- **Identifiers:** names only; no ULB or district ID
- **Verified history:** one observed annual snapshot, 2024
- **Numeric KPI fields:** none
- **Status fields:** `odf_status` categorical
- **Data-quality warning:** the supplied request block says `year="2026"`, while its response echo and record say `year="2024"`. The response period must be treated as authoritative and the discrepancy logged.

### Swachh Survekshan — National Rank

- **Dataset key:** `sasa_sac_swacch_survekshan_information_national_rank_api`
- **Fields:** `national_rank`, `inserted_date`, `district_name`, `year`, `ulb_name`
- **Sample:** Anakapalli / NARSIPATNAM, `national_rank="553"`, `year="2024"`; 74 records
- **Identifiers:** names only; no ULB or district ID
- **Verified history:** one observed annual snapshot, 2024
- **Numeric KPI fields:** `national_rank` is a numeric string
- **Status/capacity/utilization:** none
- **Data-quality warning:** as with ODF, the supplied request block says 2026 but the response echo and record say 2024.

## Historical-depth verdict

| Dataset family | Catalogue frequency | Periods actually observed | Verified depth | Trend-ready? |
|---|---|---|---|---|
| E-Autos / Compactors | Monthly | July 2026 | 1 month | No |
| ISWM / FSTP | Monthly | July 2026 sample; FSTP month-name conflict | 1 month | No |
| IHHL | Monthly | July 2026 | 1 month | No |
| GFC / ODF / National Rank | Catalogue labels monthly, but schema is year-only | 2024 | 1 annual snapshot | No |

The catalogue's “Monthly” label cannot be used to claim historical retention. Current evidence supports cross-sectional snapshots only.

## Safe ingestion rules

1. Preserve raw strings and parsed typed values side by side.
2. Reject or quarantine records when `month_number` conflicts with `month_name`.
3. Construct a local period from validated numeric fields; never use `inserted_date` as the reporting period.
4. Paginate until `hasNextPage=false` and reconcile fetched row count to `totalRecordCount`.
5. Do not fabricate ULB IDs. Resolve names through a governed crosswalk and retain match confidence and provenance.
6. Do not interpret capacity as utilization or project completion as operating status.
7. Log request/response filter discrepancies and use the record's own period for analytics.
