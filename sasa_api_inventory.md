# SASA API inventory for AI solution buildability

## Scope and evidence standard

This inventory separates four evidence layers:

1. **Current public catalogue metadata** inspected and revalidated on 2026-08-27 at [AI Living Labs Government Data](https://ailivinglabs.ap.gov.in/government-data). The rendered implementation reports 27 SASA datasets, 242 documented fields, six themes, and a catalogue-wide “Monthly” frequency label. Dataset detail pages expose exact table keys, Data Lake links, and column metadata.
2. **Supplied API response excerpts** in `/Users/pruthviyannam/Downloads/data.docx`. The file has SHA-256 `598e89dda3d6bb6fdb42bad0901f6b1e73b80fe8fe1e13e3029eafa84c5c023c` and renders as 39 pages, the last of which is blank. It contains response metadata and one representative record for each relevant dataset. It does **not** retain every record claimed by `returnedRecordCount`; these are response excerpts, not complete payload archives.
3. **Governed Data Lake access** at `https://datalakes.ailivinglabs.ap.gov.in/datasets/<tableKey>`. On 2026-08-27, anonymous navigation to the E-Autos route redirected to the Sovereign AI Stack OpenID Connect sign-in page on `auth.ailivinglabs.ap.gov.in`. No credential was supplied, so no fresh authenticated payload or pagination request was made. The catalogue also explicitly states that sample record values were not included in its metadata workbook.
4. **Corroborating SASA KPI Dashboard integration evidence** in `/Users/pruthviyannam/Downloads/WhatsApp Image 2026-08-27 at 12.01.35 PM.jpeg`, SHA-256 `70976acdf610278773385c02b2d2c5f19f03091ffa84806e9fcca2978c357386`. The screenshot is from another workstream and is not an API payload. It names two exact Data Lake query URLs and describes network whitelisting from private IMS servers.

Accordingly, schemas below are current catalogue schemas. Payload values are from the single representative records preserved in the supplied document, while counts are claims in the preserved `responseMetadata`. No undocumented fields, unretained rows, or historical periods are assumed. At handoff, this repository contained only the three Markdown assessment files—no raw payload archive, metadata workbook, integration client, or authentication configuration.

The supplied document exposes dataset `tableKey` values and request bodies; the catalogue exposes the governed Data Lake UI routes. The supplied excerpt begins at section 6.1 and does **not** expose the token URL or shared-data retrieval URL. The corroborating screenshot supplies exact `/api/v1/datasets/<tableKey>/query` URLs for two other SASA datasets, but not for the six selected representative datasets. This inventory therefore distinguishes exact observed query URLs from candidate paths inferred from a route pattern.

## Evidence-strength vocabulary

| Label | Meaning in this report |
|---|---|
| Live schema verified | table key, Data Lake link, and columns observed in the rendered public catalogue on 2026-08-27 |
| Record excerpt verified | one record object is preserved in `data.docx` |
| Metadata count observed | count is present in `responseMetadata`; it is not independently reconciled to retained record objects |
| Complete payload verified | every returned page and record was retained and reconciled — **not achieved for any selected endpoint in this repository** |
| Historical depth verified | distinct reporting periods were observed in retained record objects, not inferred from a frequency label |

## Live government-data implementation check

The rendered catalogue implementation was rechecked on 2026-08-27. The following six representative details all resolved to the documented governed Data Lake route and displayed the expected column count:

| Catalogue detail | Table key | Live field count |
|---|---|---:|
| E-Autos Service Model | `sasa_sac_machinery_e_autos_service_model_api` | 11 |
| MSW Processing — ISWM Facilities | `sasa_sac_msw_processing_facilities_iswm_facilities_api` | 11 |
| Identification of New IHHLs | `sasa_sac_identification_of_new_ihhls_api` | 12 |
| Swachh Survekshan — GFC Status | `sasa_sac_swacch_survekshan_information_gfc_status_api` | 5 |
| Swachh Survekshan — ODF Status | `sasa_sac_swacch_survekshan_information_odf_status_api` | 5 |
| Swachh Survekshan — National Rank | `sasa_sac_swacch_survekshan_information_national_rank_api` | 5 |

The implementation labels every catalogue entry “Monthly.” That label conflicts with the GFC/ODF/rank table structures, which contain `year` but no month field. It is catalogue metadata, not proof of monthly outcome records.

## Corroborating IMS/SASA KPI integration evidence

The unrelated workstream screenshot requests network whitelisting for a SASA KPI Dashboard IMS environment and names three private RFC 1918 server addresses with ports 80 and 443. It provides these exact AI Living Labs URLs:

- `https://datalakes.ailivinglabs.ap.gov.in/api/v1/datasets/sasa_sac_door_to_door_tri_cycles_api/query`
- `https://datalakes.ailivinglabs.ap.gov.in/api/v1/datasets/sasa_itc_wow_program_in_schools_api/query`

On 2026-08-27, unauthenticated HTTPS requests to both exact URLs returned HTTP 401 JSON with `WWW-Authenticate: Bearer` and:

```json
{"error":"invalid_token","message":"Provide a platform access token in the Authorization header."}
```

This verifies that the query-path family is live and bearer-token protected. It also shows that network whitelisting and application authorization are separate gates: allowing IMS connectivity does not itself provide a platform access token.

An inferred E-Autos path and a deliberately fabricated table-key path both returned the same pre-authentication 401. Authentication therefore occurs before dataset-key validation, so a 401 alone cannot prove that an inferred selected-dataset route exists. The screenshot does not establish request method/body, response envelope, token issuance flow, assigned dataset permissions, full payloads, or history for the endpoints in this assessment.

**Connection to this investigation:** an existing SASA KPI connector or its platform client registration may be reusable after governance approval. The responsible next step is to obtain its approved API contract and service identity, not to assume access from the visible URL pattern or to reuse another team's credentials.

## Acceptance evidence ledger

| Required category | Current schema inspected | Payload inspected | Evidence |
|---|---|---|---|
| Collection & Machinery | E-Autos Service Model detail in the public catalogue | one July 2026 record excerpt; metadata reports 83 returned of 83 | `data.docx`, pages 7-8 |
| Processing & Facilities | MSW Processing — ISWM Facilities detail | one July 2026 record excerpt; metadata reports 100 returned of 108 with another page required | `data.docx`, pages 26-27 |
| Sanitation Outcomes | Identification of New IHHLs detail | one July 2026 record excerpt; metadata reports 100 returned of 123 with another page required | `data.docx`, pages 18-19 |
| Swachh / GFC / ODF | GFC, ODF, and National Rank details | one 2024 record excerpt each; metadata reports 5/85/74 returned respectively | `data.docx`, pages 29-33 |

These are response excerpts rather than fresh authenticated reads or complete payload archives. The linked Data Lake was checked and redirected to sign-in.

## Representative response provenance

| Dataset | `responseId` | `generatedAt` | Metadata count | Retained record objects |
|---|---|---|---:|---:|
| E-Autos Service Model | `resp-bdddc80c-c56e-4171-a589-5a8ab6d093b8` | `2026-08-17T11:31:26.660735+00:00` | 83 of 83 | 1 |
| Identification of New IHHLs | `resp-7a702140-218b-4224-b52b-0b0a96521ab0` | `2026-08-19T06:15:17.128552+00:00` | 100 of 123 | 1 |
| MSW Processing — ISWM Facilities | `resp-cf6fec26-111e-4444-9c56-91941846f431` | `2026-08-19T06:32:28.183284+00:00` | 100 of 108 | 1 |
| Swachh Survekshan — GFC Status | `resp-e5721362-d008-47c1-81da-e17da14174f4` | `2026-08-19T10:01:37.206318+00:00` | 5 of 5 | 1 |
| Swachh Survekshan — ODF Status | `resp-dda3cfab-76dd-4a00-affc-b739d4f3edba` | `2026-08-19T10:14:46.715280+00:00` | 85 of 85 | 1 |
| Swachh Survekshan — National Rank | `resp-69893590-2f40-4866-870e-b3cad69338b9` | `2026-08-19T10:16:11.712708+00:00` | 74 of 74 | 1 |

“Retained record objects” counts what is actually present in the DOCX, not what the API metadata says it returned.

**Pairing caveat:** in the section 12-13 examples, including IHHL, ISWM, GFC, ODF, and National Rank, the displayed request's `requestId` differs from the `requestEcho.requestId`. ODF and National Rank also display `year="2026"` in the request block while the response echo and record use 2024. The response objects remain useful schema/value excerpts, but the DOCX is not a self-verifying request/response transcript; live authenticated re-execution is required to prove filter behavior.

## Shared response envelope observed in supplied excerpts

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

Operational metadata shows pagination: the ISWM and IHHL examples report 100 of 108 and 100 of 123 records respectively with `hasNextPage: true`. The document does not preserve those 100 records or the follow-up page, so pagination completeness and full-dataset coverage remain unverified.

## Identifier and type conclusions

- **Common ULB ID:** absent across the representative ULB-level endpoints. They expose `ulb_name`, not `ulb_id`.
- **Common district ID:** absent across the representative ULB-level endpoints. They expose `district_name`, not `district_id` or `dstrt_id`.
- **Raw KPI types:** all KPI values in the inspected record excerpts are JSON strings, including counts, capacity, percentages, month numbers, years, and national rank. They require explicit parsing and validation.
- **Dates:** `inserted_date` is documented in current catalogue schemas but is absent from every inspected record excerpt. It cannot be treated as reliably populated.
- **Period field names:** inconsistent (`mnth_no` versus `month_number`; `fin_year` versus `financial_year`).
- **Verified historical depth:** only the periods actually present in supplied examples can be verified: one monthly snapshot (July 2026) for the operational datasets and one annual snapshot (2024) for Swachh outcome datasets. Catalogue frequency labels do not prove retained history.

## A. Collection & Machinery

### E-Autos Service Model

- **Dataset key:** `sasa_sac_machinery_e_autos_service_model_api`
- **Data Lake route:** `https://datalakes.ailivinglabs.ap.gov.in/datasets/sasa_sac_machinery_e_autos_service_model_api`
- **Catalogue name:** E-Autos Service Model
- **Grain inferred from fields/sample:** one ULB-month record
- **Record excerpt inspected:** Anakapalli / Narsipatnam, July 2026; metadata reports 83 returned of 83, but only one record is retained
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

Excerpt KPI values: `target="6"`, `actual_wrk_order_issued="3"`, `no_of_vehicles_supplied_in_nos="0"`, `percentage="0.0"`.

**Status/capacity/utilization:** no status, rated capacity, uptime, trips, tonnage, or utilization field. The endpoint supports procurement/delivery progress only.

### Supporting endpoint: Compactor Machinery

- **Dataset key:** `sasa_sac_machinery_compactors_api`
- **Fields:** `inserted_date`, `month_number`, `no_of_units`, `fin_year`, `year`, `district_name`, `month_name`, `ulb_name`
- **Record excerpt:** Bapatla / Bapatla, July 2026, `no_of_units="1"`; metadata reports 12 records
- **Limitation:** asset count only; no capacity, serviceability, utilization, or target.

## B. Processing & Facilities

### MSW Processing — ISWM Facilities

- **Dataset key:** `sasa_sac_msw_processing_facilities_iswm_facilities_api`
- **Data Lake route:** `https://datalakes.ailivinglabs.ap.gov.in/datasets/sasa_sac_msw_processing_facilities_iswm_facilities_api`
- **Catalogue name:** MSW Processing — ISWM Facilities
- **Grain inferred from fields/sample:** one ULB-month record
- **Record excerpt inspected:** Anakapalli / Narsipatnam, July 2026; metadata reports 100 returned of 108, but only one record is retained and the next page is absent
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

Excerpt values: `total_tpd="30"`, `wet_tpd="16.5"`, `dry_tpd="13.5"`, `status_tx="Completed"`.

**Status/capacity/utilization:** capacity and a categorical status are present. Actual waste received/processed, uptime, downtime, throughput, rejects, and utilization are absent. `total_tpd` therefore must not be described as actual processing or utilization.

### Supporting endpoint: FSTP Establishment

- **Dataset key:** `sasa_sac_establishing_fstps_information_api`
- **Fields:** `district_name`, `capacity_in_kld`, `month_name`, `inserted_date`, `month_number`, `year`, `overall_progress`, `fin_year`, `ulb_name`
- **Record excerpt:** Anantapur / Rayadurg, `capacity_in_kld="20"`, `overall_progress="100%"`, `month_number="7"`, `month_name="JUNE"`, `year="2026"`; metadata reports 35 records
- **Data-quality warning:** `month_number="7"` conflicts with `month_name="JUNE"`. Do not choose one silently; quarantine the record's reporting period until the source resolves the conflict.
- **Limitation:** no inflow, treated volume, effluent-quality, uptime, or utilization field.

## C. Sanitation Outcomes

### Identification of New IHHLs

- **Dataset key:** `sasa_sac_identification_of_new_ihhls_api`
- **Data Lake route:** `https://datalakes.ailivinglabs.ap.gov.in/datasets/sasa_sac_identification_of_new_ihhls_api`
- **Catalogue name:** Identification of New IHHLs
- **Grain inferred from fields/sample:** one ULB-month record
- **Record excerpt inspected:** Anakapalli / Yelamanchali, July 2026; metadata reports 100 returned of 123, but only one record is retained and the next page is absent
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

Excerpt KPI values are all zero, including `percentage_of_achievement="0%"`.

**Status/capacity/utilization:** pipeline counts are present, but there is no beneficiary-level status, completion date, ward, contractor, age-in-stage, rejection reason, or toilet functionality/usage measure.

## D. Swachh Survekshan / GFC / ODF outcomes

### Swachh Survekshan — GFC Status

- **Dataset key:** `sasa_sac_swacch_survekshan_information_gfc_status_api`
- **Data Lake route:** `https://datalakes.ailivinglabs.ap.gov.in/datasets/sasa_sac_swacch_survekshan_information_gfc_status_api`
- **Fields:** `year`, `gfc_status`, `ulb_name`, `inserted_date`, `district_name`
- **Record excerpt:** East Godavari / RAJAHMUNDRY, `gfc_status="3 Star"`, `year="2024"`; metadata reports 5 records
- **Identifiers:** names only; no ULB or district ID
- **Verified history:** one observed annual snapshot, 2024
- **Numeric KPI fields:** none in the raw schema. A star number may be parsed for display, but an ordinal scoring policy is not supplied by this dataset.
- **Status fields:** `gfc_status` categorical

### Swachh Survekshan — ODF Status

- **Dataset key:** `sasa_sac_swacch_survekshan_information_odf_status_api`
- **Data Lake route:** `https://datalakes.ailivinglabs.ap.gov.in/datasets/sasa_sac_swacch_survekshan_information_odf_status_api`
- **Fields:** `district_name`, `ulb_name`, `odf_status`, `inserted_date`, `year`
- **Record excerpt:** Anakapalli / NARSIPATNAM, `odf_status="ODF+"`, `year="2024"`; metadata reports 85 records
- **Identifiers:** names only; no ULB or district ID
- **Verified history:** one observed annual snapshot, 2024
- **Numeric KPI fields:** none
- **Status fields:** `odf_status` categorical
- **Data-quality warning:** the supplied request block says `year="2026"`, while its response echo and record say `year="2024"`. The response period must be treated as authoritative and the discrepancy logged.

### Swachh Survekshan — National Rank

- **Dataset key:** `sasa_sac_swacch_survekshan_information_national_rank_api`
- **Data Lake route:** `https://datalakes.ailivinglabs.ap.gov.in/datasets/sasa_sac_swacch_survekshan_information_national_rank_api`
- **Fields:** `national_rank`, `inserted_date`, `district_name`, `year`, `ulb_name`
- **Record excerpt:** Anakapalli / NARSIPATNAM, `national_rank="553"`, `year="2024"`; metadata reports 74 records
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

## Remaining acceptance gaps

The schema and excerpt review is complete, but actual API validation is not complete until all of the following are supplied or observed:

1. the governed token issuance flow, selected-dataset query contracts, and authorized test credentials or an approved authenticated session;
2. fresh responses for the representative endpoints, with raw payloads stored as immutable evidence;
3. all pages fetched and reconciled to `totalRecordCount`, including the missing IHHL and ISWM pages;
4. deliberate multi-period queries proving which historical months/years are retained, including negative/empty-period responses;
5. complete ULB coverage and duplicate-grain profiling across each payload, not extrapolation from one representative record;
6. an authoritative ULB/district master or reviewed crosswalk with stable IDs;
7. confirmation of `inserted_date` population and semantics in authenticated records.
8. confirmation whether the `/api/v1/datasets/<tableKey>/query` contract is the same API represented by the DOCX request/response envelope or a separate Data Lake query surface.

Until these gaps close, this repository validates current public schemas, governed-access behavior, and supplied response excerpts—not live API completeness, historical retention, or statewide coverage.

## Safe ingestion rules

1. Preserve raw strings and parsed typed values side by side.
2. Reject or quarantine records when `month_number` conflicts with `month_name`.
3. Construct a local period from validated numeric fields; never use `inserted_date` as the reporting period.
4. Paginate until `hasNextPage=false` and reconcile fetched row count to `totalRecordCount`.
5. Do not fabricate ULB IDs. Resolve names through a governed crosswalk and retain match confidence and provenance.
6. Do not interpret capacity as utilization or project completion as operating status.
7. Log request/response filter discrepancies and use the record's own period for analytics.
