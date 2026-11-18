# Data Lake re-audit, 18 November 2026

Read through the portal's API playground in a signed-in browser session, using the
playground's own controls (dataset, purpose `BENEFIT_DISBURSEMENT`, "Run JSON query").
For each dataset I read the reported total and the periods on the first page of 100
rows, and compared both with the retained copies. No token was handled outside the page.

## The catalogue grew from 61 to 150 entries

`GET /api/v1/datasets` ("List authorized datasets") returned 150 entries, all authorized
for this account: `sasa` 42 (unchanged keys), `groundwater` 5, `aware` 103 (was 14).
All 89 new entries are AWARE, under the new domain "Open data". Themes: air quality
(pollution aggregate and time series, active alerts), carbon monoxide, sulphur dioxide,
nitrogen dioxide, urban, state and forest green cover, minor irrigation tanks, rainfall
tables, city flood advisory, cyclone, dry spell, earthquake, El Niño, fallow land, crop
health, pest stress, solar radiation, UV index and winds.

New metadata fields: `contractNote` (9 entries), `documentedFilters` (3),
`exportRequiresFilter` (4), alongside `supersedes` and `versionStatus` (6 each).

Four contract notes now acknowledge defects reported from this project:

- `soak_pits_api` serves a Compost Pits record, "retained pending upstream correction".
- `itc_wow_schools_api` transposes `dstrt_id` and `dstrt_nm`.
- `fstps_stps_cotreatment_new1_api` labels month 7 as JUNE; the numeric month is used.
- `aware_mandal_geo_api` longitude and latitude are not consistently WGS84 degrees.

## No sanitation dataset carries a newer period than the September retention

| Dataset | Reported total | Periods on the page | Retained |
|---|---|---|---|
| `ihhl_new_identification_new1_api` | 246 | June, July 2026 | 246 |
| `sasa_sac_door_to_door_e_autos_api` (vehicle feed) | 84 | May to July 2026 | 84 |
| `sasa_100_percent_clearance_of_legacy_waste_api` | 246 | June, July 2026 | 246 |
| `sewage_treated_qty_new1_api` | 242 | June, July 2026 | 242 |
| `fstps_stps_cotreatment_new1_api` | 70 | months 6 and 7 | 70 |
| `swacch_survekshan_info_new1_api` | 206 | 2024 only | 206 |
| `msw_door_to_door_collection_api` | 64,368 | (secretariat-day) | 64,368 |
| `sasa_establishment_of_gobardhan_units_api` | 28 | no period column | 28 |
| `sasa_declaration_of_odf_plus_model_villages_api` | 28 | no period column | 28 |
| `groundwater_aggregatedreadings_api` | 718 | newest reading 9 September | 718 |

The district programme tables (compost pits, soak pits, magic drains, community
sanitary complexes, housing and SBM toilets) were read with a district filter the
playground fills in by itself, so their totals here are one district's. Their periods
are unchanged: April 2026 to March 2027 programme months for the pit and drain tables,
May to July 2026 for the others.

The A.Konduru groundwater row is identical, field for field, to the 5 October capture.
A full capture is needed to say the same of all 718 rows.

**What this means for the app.** The same-year outcome gate stays blocked: there is no
2025 or 2026 Swachh Survekshan. No series gains a month, so trends cannot be extended,
and 12 August remains the only complete urban service day held.

## Not readable today

The upstream answered "The Data Lake API could not complete this request" for
`sasa_pr_door_to_door_collection_percentage_of_garbage_api_27_aug_2026`,
`sasa_sac_msw_processing_facilities_iswm_facilities_api`, `sasa_50_percent_greencover_api`,
`sasa_mepma_households_promoted_for_home_composite_api`, `sasa_sac_machinery_compactors_api`,
`waste_egregation_api`, `sasa_establishment_of_plastic_waste_management_units_api`, and for
every new feed sampled: `air_quality_pollution_aggregate_api`,
`air_quality_pollution_timeseries_api`, `aware_urban_green_cover_category_api`,
`mi_tanks_aggregated_api`. Several of the same keys answered on another attempt, so this
reads as an unstable upstream, not removed tables. The portal's dataset pages returned 504.

## To recheck

- One query on `sbm_construction_of_ihhls_new1_api`, sent by the playground with
  `district_name` "ALLURI SITHARAMA RAJU", returned all 84 rows rather than one district's
  three. If repeatable, an unmatched filter is now silently ignored instead of failing.
  One observation only; not reported as a defect.
- Sample the air quality and green cover feeds when they respond. They are the first
  measured environmental readings in the catalogue and could give the Environment & Carbon
  screen measured context.

## Afternoon recheck, 18 November 2026 (19:26–19:27 UTC)

Read through the playground's own controls after the account holder loaded the session token.

| Dataset | Query | Result |
|---|---|---|
| `sasa_cdma_ulbs_single_use_plastic_ban_api` | no filter (echoed `{}`) | 26 rows, all August 2026 |
| `sasa_cdma_ulbs_single_use_plastic_ban_api` | month 9 and month 10, 2026 | no rows |
| `waste_egregation_api` | no filter | 64,368 rows reported (same as the 8 September retention); first page 12 Aug 2026 |
| `msw_door_to_door_collection_api` | no filter | 64,368 rows reported (same as retained); first page 12 Aug 2026 |

No newer month exists for the measures behind the 2 October segregation and plastic-free targets, so the
SASA Goals statuses stand, and the screen now says when the source was last checked.
