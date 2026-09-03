# Data provenance and coverage

## What the application uses

SAMPLE mode uses retained, authenticated full-response JSON exports downloaded from the signed-in AI Living Labs data portal. These responses are stored with their source table key, response identifier, filters, reporting period, retrieval timestamp, raw values, parsed values, source grain, and pagination reconciliation.

JSON is the canonical machine-readable evidence used by the selectors and analytics. Available Excel exports were used for representative parity and field-level spot checks; they are not a second independent source and are not silently merged with the JSON.

The portal query/playground surfaces were also used to verify endpoint names, schemas, filter options, reporting-period behavior, and export behavior. The browser application never calls the authenticated production APIs directly.

## What was verified

- all 30 endpoints then authorized to the signed-in account were catalogued;
- 29 endpoints produced complete retained exports;
- Gobardhan was unavailable from the upstream source at retrieval time;
- the documented register also contains three pending integrations that are not treated as ingested evidence;
- source-level pagination, filters, periods, and returned fields were retained rather than inferred.

## Could anything still be missing?

No published endpoint visible to the signed-in account at the time of the audit was intentionally omitted. However, this is not a claim that every historical partition or every possible filter combination exists in the retained files. New authorizations, revised APIs, newly exposed periods, filter-dependent records, and tomorrow's announced datasets can add evidence.

For each incoming release, repeat the inventory, schema, filter, period, pagination, JSON/Excel parity, glossary, and selector-coverage checks before exposing values in SAMPLE mode.

