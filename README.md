# SASA Intelligence Lab

An evidence-first frontend prototype that demonstrates how verified SASA sanitation records could support transparent decision intelligence without presenting synthetic values as government findings.

The application implements exactly five primary screens:

- **Overview** — three compact operational review signals: collection procurement, IHHL delivery, and legacy-waste clearance, plus current scoring eligibility.
- **Operational Analytics** — one workspace with Collection, Sanitation Delivery, Processing Infrastructure, and 2024 Swachh Outcomes tabs. Each SAMPLE tab leads with a plain-language finding, its evidence, the next review, and what the evidence cannot establish. Collection, IHHL and legacy-waste views also include a browseable ULB comparison that is locked to one source, period, grain and unit. The shell exposes a persistent, browse-first comparison tray for up to six anchored ULBs, plus a client-side evidence-brief download (governed mode only for source-backed figures).
- **Gap Radar** — an illustrative two-axis matrix with a first-class unscored state. In SAMPLE mode it shows the four unmet activation gates plus a **crosswalk workbench**: 1,151 of 1,408 observed ULB-name occurrences resolve to a source-provided 123-entity anchor registry by exact match, leaving a bounded queue of 82 names for review. Candidates are district-scoped and similarity is a ranking hint only — decisions are a local working copy and are never an approved crosswalk.
- **ULB Diagnostics** — metric details, deterministic diagnostics, source-family breadth, and expandable raw evidence.
- **Data Readiness** — Catalogue, Coverage, Periods, and Quality views inside one route, including full operational evidence breadth and a deterministic reconciliation workspace. Coverage includes an **anchored coverage grid**: 123 registry entities × 18 ULB-grain sources = 2,214 observations. Before local alias decisions, 1,063 cells (48%) were absent; the seeded working crosswalk recovers 235 observations, leaving 828 (37%) not returned. That recovery is a reviewer working state, not an authoritative statewide completeness claim. Absence is drawn as a hatched cell rather than blank space, because "not returned" is never a reported zero. Periods includes the four-check acceptance path that every later governed snapshot must clear before it enters a longitudinal view. Quality opens with the **retained evidence vintage** panel.

## Run locally

Node.js 22.13 or newer is required.

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

Validation commands:

```bash
npm run lint
npm test
npm run build
```

## Data modes

- **DEMO** uses unmistakably synthetic fixtures so every interaction can be demonstrated. Its policy thresholds and trends are illustrative.
- **SAMPLE** uses authenticated governed JSON exports retrieved through the signed-in AI Living Labs API Playground. It retains 4,359 rows across 29 complete full exports: 26 SASA exports and three SERP exports. The 30th authorized endpoint, Gobardhan, failed to export. The expanded IHHL export contains 246 rows across June and July 2026 and 123 observed normalized district-and-ULB name candidates. The latest July slice contains 119 rows, 117 candidates, and two exact duplicates. Complete payloads do not remove the need for a reviewed crosswalk or same-year outcome evidence, so all source profiles remain unscored.
- **Documented integrations** lists three additional SASA PR table keys supplied on 2026-08-28. They remain visible in Data Readiness but are excluded from authenticated analytics and totals: two examples are geographically filtered and the door-to-door example retains only 100 of 1,241,643 reported rows with pagination still open.
- **Live availability audit (2026-09-06)** confirms all 33 granted catalogue entries are visible and the three large CDMA endpoints remain readable at unchanged totals (64,368; 64,528; 64,528 rows). No further documented key is readable by this account: the ten CDMA guide keys return HTTP 403 (the alternate corrected waste-segregation spelling returns 404), the three SASA PR keys return 404, and Gobardhan returns 503. These response states are access/availability evidence, not zero-valued data.
- **LIVE** is a non-connecting adapter boundary. It performs no government API request and shows the gates needed for future activation.

All frontend reads go through a shared `SasaDataProvider` interface. The retained snapshots are local evidence artifacts; no access token, refresh token, cookie, or password is stored. A future governed connector can implement the same interface without changing the screens, but credentials must remain server-side.

Operational analytics are computed by reusable selectors in `lib/analytics.ts`. They retain `tableKey`, response ID, request filters, retrieval timestamp, source period, raw values, parsed values, and source grain. Current KPI views select each dataset’s latest governed period and exclude exact duplicate rows; Data Readiness enumerates every period actually present in the full exports. The selectors include collection procurement, separate district collection assets, legacy-waste clearance and balance, IHHL funnel, MEPMA community programmes, processing registry and exact source-status review queue, Swachh outcome summary, compact and full entity coverage, period availability, source reconciliation, and quality issues. UI values are not copied from the design references.

The current dataset-use reconciliation covers all 33 documented entries: 16 retained datasets power primary analytics, 13 retained datasets power supporting programme/history/evidence-breadth views, Gobardhan remains unavailable, and three SASA PR integrations remain ingestion-pending. No complete retained dataset is left without a visible role. The exact register is documented in `DATASET_USAGE_REGISTER_2026-08-31.md` and is rendered in **Data Readiness → Catalogue**.

The header includes an accessible light/dark theme toggle. Dark mode uses the prototype’s deep-navy analytical-panel language with restrained teal and violet accents; it changes presentation only and never changes the selected data mode, calculations, evidence state, or scoring eligibility.

The header About panel includes a maintained plain-language glossary. Common abbreviations and evidence terms are also underlined in context and expose the same definition on hover or keyboard focus. `lib/glossary.ts` is the single source of truth; see `GLOSSARY.md` for the required update workflow whenever a dataset or API is activated. Retrieval provenance and the limits of the completeness claim are documented in `DATA_PROVENANCE.md`.

Validate the snapshot boundary independently with:

```bash
npm run validate:data
```

With a fresh temporary Playground token, compare all 29 retained payloads directly
against the live API without writing or accepting any new evidence:

```bash
AILAB_ACCESS_TOKEN=... npm run audit:live-snapshots
```

`npm run validate:data` checks pagination, count reconciliation and credential hygiene, and additionally compares every retained dataset against the recorded vintage in `data/snapshot-fingerprints.json`. The live audit uses the same fingerprints against current API responses. Each reported period is hashed on its content and its entity set, because a source revision that re-dates rows between periods leaves `totalRecordCount`, pagination and local row counts identical — the counts reconcile while the periods have changed underneath. Row order is not significant to the hash.

After re-exporting snapshots, read the drift report, then accept the new vintage deliberately:

```bash
npm run fingerprint
```

Commit `data/snapshot-fingerprints.json` alongside the snapshots. The current vintage is visible in the application at **Data Readiness → Quality → Retained evidence vintage**.

## Large-dataset ingestion

The retained SASA/SERP snapshots are small enough to import directly. The documented SASA_CDMA
datasets are not: they are roughly 64,000 rows each at a fixed page size of 100, and the
application bundles every dataset it imports. A separate two-stage pipeline handles them.

```bash
export AILAB_REFRESH_TOKEN=...      # for this run only; never written to disk
npm run ingest -- msw_door_to_door_collection_api
npm run aggregate -- msw_door_to_door_collection_api
```

`scripts/ingest.mjs` paginates with the offset page token, refreshes the access token before
its 300-second expiry, retries transient upstream failures, and resumes from the last retained
page if interrupted. It records both the returned row count and the reported
`totalRecordCount` without asserting they agree, because filtered requests have been observed
returning a `totalRecordCount` that does not match the rows actually returned.

`scripts/aggregate.mjs` reduces the raw pages to two outputs: a ULB-by-period roll-up small
enough for the application to import, and a secretariat-by-period detail file that stays on
disk. At full scale the roll-up is a few hundred kilobytes while the detail is tens of
megabytes, so only the roll-up is ever bundled.

Missing is never folded into zero. Every measure carries separate `reported`, `zero` and
`missing` counts, and a ratio is suppressed unless its denominator was actually reported. At
daily grain that distinction decides whether a coverage figure means anything, and the source
convention for zero versus not-reported is still unconfirmed.

`scripts/dataset-map.mjs` holds the per-dataset column mapping. Each field lists candidate
column names tried in order, so the expected rename to LGD master columns is a one-line edit
rather than a pipeline change. Raw pages and the detail aggregate are git-ignored.

## Deployment and roadmap

The app is a vinext (Next App Router + RSC) project. It has no request-time server
features — every screen reads local evidence and runs in the browser — so it is built
as a fully static site and hosted on **GitHub Pages**.

```bash
node scripts/build-static.mjs --base /<repo-name>   # emits dist-static/
```

`.github/workflows/deploy-pages.yml` runs this on every push to `main` and deploys
`dist-static/`. The base path is derived from the repo name, so the site works under
`username.github.io/<repo>/`. Live at: https://prucodes.github.io/sasa-intelligence-lab/

**Mode labels vs. internal names.** The **SAMPLE** mode is presented to viewers as
**"Governed data"** with the URL `?mode=governed`, because "sample" wrongly implied mock
data in a shared link — it is real authenticated government data, retained as snapshots.
The internal enum stays `SAMPLE` and legacy `?mode=sample` links still resolve.

### Roadmap: Governed data today, Live next

- **Today — Governed data (on GitHub Pages).** Real Data Lake data, pulled once and
  retained as snapshots committed to the repo. Refreshing the numbers is a manual
  re-pull + push. A static host cannot hold a credential or make authenticated calls,
  so this is the correct mode for a public demo.
- **Next — Live (requires a server host, e.g. Cloudflare Workers).** A Worker can hold
  credentials server-side and pull from the Data Lake on a schedule into a cache the
  page reads, so the data auto-updates with no manual step. **The front end, analytics,
  evidence gates and layout do not change** — only the data source swaps from retained
  JSON to governed API calls (via the shared `SasaDataProvider` interface). Multi-period
  live data would also enable trend views that single-period snapshots keep disabled.
- **The blocker is access, not code.** The Playground access token lives ~300 seconds
  (a standard short-lived OIDC access token) and is issued from an interactive login, so
  a server cannot renew it unattended. Live requires a **durable service credential**
  (a client-credentials/service-account flow or a non-expiring refresh token) provisioned
  by the platform/identity owner of the AI Living Labs Data Lake.

## Evidence and limitations

The authoritative assessments remain:

- `sasa_api_inventory.md`
- `sasa_join_matrix.md`
- `ai_solution_buildability.md`

The interface does not treat configured TPD/KLD capacity as throughput or utilization, reported legacy-waste clearance as verified remediation impact, source names as stable IDs, district totals as ULB records, missing records as zero, duplicated source rows as additional ULBs, or 2026 operational snapshots as contemporaneous with 2024 outcomes. Exact duplicates remain in raw evidence but are excluded from analytical totals with explicit counts. District asset achievement and ULB procurement remain separate source stories. The active full exports use empty export filters; the earlier geographically filtered snapshots remain archived under `data/snapshots` for provenance. All 35 July FSTP rows preserve the observed `month_number=7` / `month_name=JUNE` conflict and remain unscored.

The SASA PR additions preserve District, Block, Gram Panchayat, and collection-date grain. They are not assigned to ULB candidates, and their documentation examples do not establish period availability. The SWPC/Swachh Ratham endpoint titles also require semantic confirmation before final product labeling.

The user-supplied generated illustrations are suitable for this prototype. Organizational approval of the SASA brand treatment and artwork is still required before public release.
