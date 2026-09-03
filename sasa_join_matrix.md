# SASA join matrix

## Join-key verdict

There is **no verified common stable ULB key** across the selected collection, processing, sanitation, and Swachh outcome datasets. The common fields are `district_name`, `ulb_name`, and `year`; operational tables additionally carry a month. Name-based joins are feasible only after controlled normalization and crosswalk review.

`ulb_id` appears in some other SASA/MEPMA examples, but it is absent from every representative endpoint in this analysis. It therefore cannot be assumed to exist in the asset/outcome tables.

The supplied DOCX retains only one representative record per selected endpoint, even when `responseMetadata` reports many returned rows. This matrix therefore assesses schema compatibility and demonstrated record-level examples; it does not measure full-payload overlap, coverage, uniqueness, or join rates.

## Canonicalization required before any join

```text
district_norm = UPPER(TRIM(collapse_whitespace(district_name)))
ulb_norm      = UPPER(TRIM(collapse_whitespace(ulb_name)))
natural_key   = district_norm + "|" + ulb_norm
```

Normalization handles case and whitespace only. Spelling variants must go through an explicit crosswalk; fuzzy matching must never silently create a production join.

Recommended local key:

```text
ulb_key = surrogate key from dim_ulb_crosswalk
crosswalk fields = source_dataset, district_raw, ulb_raw,
                   district_norm, ulb_norm, ulb_key,
                   match_method, match_confidence, reviewed_by, reviewed_at
```

## Pairwise feasibility matrix

Legend: **Conditional** = schema-compatible but a reviewed name/ID crosswalk and valid period are required; **Not currently valid** = the retained record excerpts cannot be aligned temporally. No selected cross-dataset join is direct from a shared stable source ID.

| Left dataset | Right dataset | Candidate join | Feasibility | Evidence / limitation |
|---|---|---|---|---|
| E-Autos Service Model | ISWM Facilities | normalized district + ULB + year + month | Conditional | Narsipatnam matches in July 2026; no stable IDs |
| E-Autos Service Model | IHHL | normalized district + ULB + year + month | Conditional | same grain in schema; sample ULBs differ and names may be misspelled |
| ISWM Facilities | IHHL | normalized district + ULB + year + month | Conditional | compatible monthly grain; no stable IDs |
| E-Autos Service Model | ODF Status | normalized district + ULB + year | Not currently valid | Narsipatnam name matches, but samples are 2026 assets versus 2024 outcome |
| E-Autos Service Model | National Rank | normalized district + ULB + year | Not currently valid | same temporal mismatch |
| ISWM Facilities | ODF Status | normalized district + ULB + year | Not currently valid | same Narsipatnam identity candidate, but 2026 versus 2024 |
| ISWM Facilities | National Rank | normalized district + ULB + year | Not currently valid | same temporal mismatch |
| ODF Status | National Rank | normalized district + ULB + year | Conditional | Anakapalli / NARSIPATNAM / 2024 exists in both retained excerpts, but neither source carries a stable ULB ID |
| GFC Status | ODF Status | normalized district + ULB + year | Conditional | compatible schema, but GFC sample has only 5 records and no demonstrated Narsipatnam match |
| GFC Status | National Rank | normalized district + ULB + year | Conditional | compatible schema, but coverage and sample overlap are unverified |

## Demonstrated join example

After uppercasing and trimming, three inspected records resolve to the same candidate ULB name key:

```text
ANAKAPALLI|NARSIPATNAM
```

| Dataset | Reporting period | Fields observed |
|---|---|---|
| E-Autos Service Model | 2026-07 | `target=6`, `actual_wrk_order_issued=3`, `no_of_vehicles_supplied_in_nos=0`, `percentage=0.0` |
| ISWM Facilities | 2026-07 | `total_tpd=30`, `wet_tpd=16.5`, `dry_tpd=13.5`, `status_tx=Completed` |
| ODF Status | 2024 | `odf_status=ODF+` |
| National Rank | 2024 | `national_rank=553` |

This demonstrates identity-level join feasibility, but **not a temporally valid asset-to-outcome comparison**. The two-year period mismatch must remain visible; it must not be silently bridged.

It also does not establish dataset-wide overlap: the DOCX retains one record object from each reported result set, so overlap counts and join coverage cannot be computed.

## Demonstrated failure mode

The IHHL sample uses `ulb_name="Yelamanchali"`. Another supplied sample uses `ulb_nm="Yelamanchili"`. Uppercase/trim normalization does not reconcile those spellings. A production pipeline needs a reviewed alias mapping or an authoritative ULB master.

The supplied MEPMA circular-economy excerpt maps `district_id="16"`, `ulb_id="181"` to Anakapalli / Narsipatnam for `month_id="202603"`. This is useful candidate evidence for a crosswalk, but it is not a verified master key for the selected asset/outcome endpoints and must not be propagated without authoritative confirmation.

## Period-join rules

- Operational-to-operational: join on `ulb_key` and validated `period_month`.
- Annual outcome-to-annual outcome: join on `ulb_key` and `year`.
- Monthly operational-to-annual outcome: aggregate operational records within the same outcome year or select an explicitly defined as-of snapshot. Never pair 2026 assets with a 2024 outcome and call it contemporaneous.
- If only stale annual outcomes exist, return `outcome_lag_years` and a `stale_outcome=true` flag.
- Do not use `inserted_date` as an as-of or reporting date unless populated and its semantics are confirmed.

## Join-quality checks required in production

| Check | Pass condition | Failure action |
|---|---|---|
| Unique ULB-period grain | one record per dataset/ULB/period, or documented aggregation | quarantine duplicates |
| Crosswalk coverage | 100% of dashboarded records have reviewed `ulb_key` | exclude unmatched rows from joined metrics |
| Ambiguous aliases | one source name maps to one ULB | manual review |
| Period validity | numeric month 1-12; month name agrees | quarantine period |
| Temporal alignment | asset and outcome year match for gap score | mark unscored/stale |
| Pagination completeness | fetched rows equal `totalRecordCount` | retry/fail ingestion |
| Numeric parsing | values parse after allowed commas/percent signs | retain raw, set typed value null, log error |
| Coverage disclosure | joined numerator and denominator reported | suppress unsupported statewide claims |

## Join conclusion

Reliable joins are **not available directly from source keys**. A reviewed ULB crosswalk can make selected joins operational, but this is a local data-governance layer, not evidence that the source APIs share a canonical ULB identifier.

With the evidence currently retained, only the ODF-to-National-Rank Narsipatnam record pair is both identity- and year-compatible. No retained asset-to-outcome pair is contemporaneous, and no full-payload join rate can be calculated.

## Authenticated full-snapshot overlap addendum — 2026-08-27

Full current-period snapshots now permit an exact-normalization overlap audit. These counts use lowercase, whitespace collapse, punctuation removal, and `district|ULB` concatenation only. They are **candidate overlaps**, not approved joins and not fuzzy matches.

| Dataset pair | Exact normalized candidates in common | Temporal eligibility |
|---|---:|---|
| E-Autos (83) × ISWM (108) | 44 | Same July 2026 period; crosswalk review still required |
| E-Autos (83) × IHHL (121 candidates) | 48 | Same July 2026 period; crosswalk review still required |
| ISWM (108) × IHHL (121 candidates) | 93 | Same July 2026 period; crosswalk review still required |
| ODF (85) × National Rank (74) | 57 | Same 2024 year; crosswalk review still required |
| ODF (85) × GFC (5) | 5 | Same 2024 year; crosswalk review still required |
| E-Autos (2026) × ODF (2024) | 38 | Not contemporaneous |
| E-Autos (2026) × National Rank (2024) | 34 | Not contemporaneous |
| ISWM (2026) × ODF (2024) | 64 | Not contemporaneous |
| ISWM (2026) × National Rank (2024) | 58 | Not contemporaneous |
| IHHL (2026) × ODF (2024) | 69 | Not contemporaneous |
| IHHL (2026) × National Rank (2024) | 64 | Not contemporaneous |

The authenticated evidence changes the earlier “overlap unverified” conclusion to “overlap measured under an unreviewed exact-name candidate method.” It does **not** change the stable-key verdict: the representative operational and outcome datasets still lack a common source ULB ID, and the 2026/2024 asset–outcome mismatch still blocks scoring.

## SASA PR grain and join addendum — 2026-08-28

The three newly documented PR table keys are excluded from the ULB overlap matrix. Their examples expose District, Block, Gram Panchayat, and collection-date identifiers, but no reviewed mapping to the ULB candidates used by the prototype.

| PR dataset | Safe local key candidate | ULB join status | Current use |
|---|---|---|---|
| GP SWPC availability / working condition | `DISTRICT_ID + BLOCK_ID + GRAM_PANCHAYAT_ID` | Not permitted | Gram Panchayat registry after complete retrieval |
| Swachh Ratham operator reconciliation | `DISTRICT_ID` | District only | District reconciliation after semantic review |
| Door-to-door garbage collection | `DISTRICT_ID + BLOCK_ID + GRAM_PANCHAYAT_ID + COLLECTION_DATE` | Not permitted | Descriptive rural collection analytics after complete pagination |

Missing PR records must never be interpreted as zero collection, absence of an SWPC, or absence of an operator. No PR value may be rolled up to a ULB without a governed geographic crosswalk and an explicit aggregation policy.
