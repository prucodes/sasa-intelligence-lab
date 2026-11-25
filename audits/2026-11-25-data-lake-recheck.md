# Data Lake recheck, 25 November 2026

Read through the portal's API playground in a signed-in session, with the page's own
session token (loaded by Pruthvi). Unfiltered queries unless a filter is shown; totals are
the API's `totalRecordCount`.

## Result: no newer period in any dataset the app reads

| Dataset | Total, 25 Nov | Latest period |
|---|---|---|
| msw_door_to_door_collection_api | 64,368 | 16 days from 12 Aug 2026 |
| waste_egregation_api | 64,368 | same days |
| sasa_cdma_ulbs_single_use_plastic_ban_api (year 2026) | 26 | August 2026 only |
| sasa_100_percent_clearance_of_legacy_waste_api | 246 | June and July 2026; month_id 7 returns 123; month_id 8 fails (no rows) |
| sasa_pr_door_to_door_collection_percentage_of_garbage_api_27_aug_2026 | 3,965,247 | MONTH_ID 8 = 280,371 = 13,351 GPs x 7 days x 3 copies; MONTH_ID 9 fails (no rows) |
| ihhl_new_identification_new1_api | 246 | June and July 2026 |
| sewage_treated_qty_new1_api | 242 | June and July 2026 |
| fstps_stps_cotreatment_new1_api | 70 | June and July 2026 |
| sasa_declaration_of_odf_plus_model_villages_api | 28 | no period columns |
| sasa_50_percent_greencover_api | 400 | June and July 2026 |

## Not rechecked

- identification_of_bulk_waste_generators_api: "The Data Lake API could not complete this
  request" on three attempts; the session token expired before its twin
  (onsite_processing_of_wet_waste_bwg_api) could be read. The app's bulk generator reading
  stays the 12 Aug 2026 retained copy.

## Catalogue

150 published datasets, 42 in the SASA collection, the same keys as 18 Nov. Nine contract
notes: the five SASA notes recorded on 18 Nov (e-autos service model, the waste_egregation
key spelling, soak pits serving compost pits, ITC WOW transposed district fields, the FSTP
month label) and four AWARE notes. No change that affects the app.

The app's "Data Lake checked" line now reads 25 Nov 2026 (lib/sasa-goals.ts LAST_SOURCE_CHECK).
