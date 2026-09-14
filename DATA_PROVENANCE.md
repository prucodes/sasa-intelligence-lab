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

Small tables are affected too. Rows just after a 100-row page boundary can be replaced by repeats from the page before, so compost pits, soak pits, magic drains, legacy waste clearance, IHHL identification, sewage and the green programme table each miss between two and six rows while their totals still match. The same positions repeat in the 2026-08-28 and 2026-09-10 copies. Repeats are collapsed, so the missing rows show as absent, never as zero.

For each incoming release, repeat the inventory, schema, filter, period, pagination, JSON/Excel parity, glossary, and selector-coverage checks before exposing values in SAMPLE mode.
