# Data provenance and coverage

## What the application uses

SAMPLE mode uses retained, authenticated full-response JSON exports downloaded from the signed-in AI Living Labs data portal. These responses are stored with their source table key, response identifier, filters, reporting period, retrieval timestamp, raw values, parsed values, source grain, and pagination reconciliation.

JSON is the canonical machine-readable evidence used by the selectors and analytics. Available Excel exports were used for representative parity and field-level spot checks; they are not a second independent source and are not silently merged with the JSON.

The portal query/playground surfaces were also used to verify endpoint names, schemas, filter options, reporting-period behavior, and export behavior. The browser application never calls the authenticated production APIs directly.

## What was verified

- all 42 endpoints in the current authorized catalogue were catalogued;
- all 42 current routes have retained responses or authenticated exports, including six large routes whose 42,502 pages reconcile to the reported totals, repeats included;
- 44 historical full exports and their revised LGD-enriched vintages remain available as separate evidence;
- eight historical route keys are absent from the current catalogue and remain explicitly labelled as historical rather than silently treated as current;
- source-level pagination, filters, periods, and returned fields were retained rather than inferred.

## Could anything still be missing?

No published endpoint visible to the signed-in account at the time of the audit was intentionally omitted. However, this is not a claim that every historical partition or every possible filter combination exists in the retained files. New authorizations, revised APIs, newly exposed periods, filter-dependent records, and tomorrow's announced datasets can add evidence.

Retrieval itself can miss distinct rows. The six large route totals reconcile to the source totals, but part of each total is repeats, so a matching count is not proof of completeness. The urban reference day, 2026-08-12, is therefore retained from every retrieval of that day combined, and only when each file holds every secretariat with no disagreement between retrievals (see `scripts/urban-sources.mjs`). The other fifteen urban days remain the 8 September paged pull and are incomplete.

Small tables are affected too. Rows just after a 100-row page boundary can be replaced by repeats from the page before, so a response matches its total while missing a few distinct rows. The same positions repeat in the earlier copy (2026-08-28 for legacy waste clearance, 2026-09-08 for the others) and in the 2026-09-09 or 2026-09-10 copy, and the export route returns the same gaps.

On 2026-09-14 the missing rows were recovered with queries filtered to one district or one month, and merged into both retained copies of six tables: legacy waste clearance (3 rows), compost pits (3), soak pits (3), magic drains (2), IHHL new identification (2) and sewage (6). The green programme table, served under three keys, had 5 rows recovered in its 2026-09-10 copy; its only earlier copy is a different 244-row vintage. Every other row is unchanged, each file records the repair under `retentionRepair`, and the raw filtered responses are kept in `data/retention-repairs/2026-09-14/`.

Household toilets now read `ihhl_new_identification_new1_api`, the platform's named LGD-enriched replacement, which is complete for all 123 ULBs after the repair. On every ULB-month both tables carry, all four measures are identical. The 2026-08-28 `sasa_sac_identification_of_new_ihhls_api` copy, which lost 6 July rows at a page boundary and cannot be repaired because its key now serves the reissue, stays retained as historical corroboration.

Two retained copies could not be repaired, because the live key now serves a different table: the ULB-grain `sasa_sac_machinery_e_autos_service_model_api` (1 June row, used by vehicles) and the 244-row green programme vintage (3 June rows). Repeats are collapsed, so those rows show as absent, never as zero.

A later period can also repeat the one before. Where nearly every ULB is identical in every field, the app flags the period as possibly carried forward (`getCarriedForward` in `lib/analytics.ts`), because the source does not say whether it was reported again.

For each incoming release, repeat the inventory, schema, filter, period, pagination, JSON/Excel parity, glossary, and selector-coverage checks before exposing values in SAMPLE mode.
