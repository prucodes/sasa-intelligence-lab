# Site audit and improvements — 22 October 2026

Baseline: `7db38de` (local and remote main agreed). Scope: the SASA application, its retained evidence and authenticated Data Lake catalogue. Raw snapshots, retention repairs, aggregates and fingerprints were not changed.

## Corrections

1. **Undeclared legacy-waste units — misleading wording.** `lib/overview.ts:84`, `lib/analytics.ts:720`, `lib/findings.ts:230`, rankings and operational cards called the balance tonnes. Neither the retained current/full payload nor `data/current-catalogue.json` declares that unit. Labels now say source units or quantity; source boundaries explain the omission. Carbon scenarios still explicitly assume tonnes. Quantities and rankings are unchanged.
2. **Missing is not zero — code bug.** `lib/environment-ledger.ts:225` used `(reported ?? 0) === 0`. It now counts explicit zero and missing measures separately. A regression test replaces all repeated copies of a targeted zero record with a missing measure and verifies that the counts move to the correct category.
3. **Target population was unclear — misleading wording.** The green-spaces ledger has 100 ULBs with positive targets, 31 with positive achievement, and 73 targeted ULBs reporting zero. Four of the 31 positive ULBs have no positive target. The four are now explicitly identified as included in the positive count; 31 − 4 + 73 = 100.
4. **FSTP date looked resolved — misleading wording.** The ledger displayed June 2026 while 35 of its 70 rows pair numeric month 7 with JUNE. The heading now says conflicting month labels, derived from the fields. Its existing 35-site, 600 KLD deduplicated capacity remains a register quantity, not a monthly throughput claim.
5. **Response date called retention date — misleading wording.** `app/environment-ledger.tsx:213` now labels `responseMetadata.generatedAt` as response generated.
6. **Unsupported operating and climate claims — misleading wording.** Commenced construction no longer implies a plant is not processing waste. A legacy dump is no longer asserted to be a measured methane source. “Highest climate leverage” and a claimed action ranking are removed. The capacity heading compares modelled waste with reported completed-status capacity, not what an individual plant can handle. The legacy methane scenario now states its food-like composition assumption and that its interval varies only site type, not all uncertainty.
7. **Daily evidence described as unavailable — misleading wording.** Environment said the daily series did not exist. `reporting-continuity.json` contains 16 collection dates and 41,635 unique records. Environment now shows the selected reference day and its 95.6% share of the retained collection total, and links to Reporting Continuity. Daily coverage varies; this is not a sustained-service rate.
8. **Scenario instructions implied editable controls — misleading wording.** Assumption copy now describes documented inputs for recalculation, without implying that this screen offers an editable calculator.
9. **Action flow rendered incorrectly — visual bug.** An older `.el-action-basis > div` flex rule overrode the newer grid. It now applies only to the text panel, restoring the flow layout.

## Visual and evidence improvements

- Named-place concentration lists now have bars and percentages against the full reported source total, not against the largest row.
- Planting length preserves two decimal places (303.01 km).
- Reporting Continuity's lower summary is now three labelled state bars and two coverage cards. Positive, explicit zero, missing measure and absent entity/date combinations remain distinct.
- Inventory gaps now includes a groundwater context panel derived from the two existing October captures. There are 717 distinct UUIDs against 718 reported; all 717 matched records are unchanged. Reading timestamps span 1–9 September, not October. The 28 district and 689 subdistrict rows are displayed separately and never summed as measurements. No groundwater trend, sanitation impact or carbon reduction is inferred.

## Portal checks and limitations

Authenticated catalogue inspection showed 61 authorized routes: 42 SASA, five groundwater and 14 AWARE. AWARE catalogue entries include category thresholds, module counts and geographic references; their presence alone does not establish observations suitable for environmental modelling.

The detail pages for `aware_aerosol_modulecounts_api`, `ihhl_new_identification_new1_api` and `groundwater_aggregatedreadings_api` each returned HTTP 504 in the signed-in browser. No fresh records were ingested and no claim is made that the latest upstream values match retention. The groundwater panel uses the existing 4 and 5 October files, with their incomplete coverage explicitly shown.

The composting defaults (4 g CH4/kg and 0.24 g N2O/kg wet waste) match [IPCC 2006 Volume 5 Chapter 4, Table 4.1](https://www.ipcc-nggip.iges.or.jp/public/2006gl/pdf/5_Volume5/V5_4_Ch4_Bio_Treat.pdf). This does not validate local composition, throughput, unit assumptions or an actual emissions reduction. AR5 factors remain a declared convention, not a claim to use AR6 values.

## Verification and test changes

- Snapshot validation: 36 current response hashes; 44 complete exports / 6,509 retained rows; nine aggregate contracts / 12,874 entities; recorded period fingerprints pass.
- Unit/component suite: 347 tests across 36 files. New regression coverage covers null versus zero and groundwater identity, completeness, grain and observation dates.
- Lint and static build on Node 22.20.0 pass. Build assembles 136 Pages routes with `/sasa-intelligence-lab` asset and route rewriting. The build still warns about chunks above 500 kB; this pass does not claim a bundle-size improvement.
- Baseline live app: navigation smoke and 50 responsive screen states passed. Expanded local verification passed 125 responsive screen states and 15 component states (including keyboard, download and print); it includes all seven primary pages, seven Operational Analytics tabs, all four Environment views, reconciliation revisions, four Data Readiness states and six Gap Radar comparisons at 320, 390, 768, 1024 and 1440 px.
- Overview smoke now follows the current subject navigation and mobile selector. Independent pairing of June/July legacy records gives 122 reconciled pairs: 27 lower, zero higher, 95 unchanged. Its old expectation of 25 lower was stale.
- Review smoke opens the historical graph disclosure and selects the appropriate diagnostics subject tab. Executive brief expectations now use the independently reconciled totals 8,593 open IHHL approvals and 1,485,769 legacy source units; the old 8,479 and 1,353,366 belonged to older retention. Vehicle shortfall remains 1,019.
- The production artifact also passed navigation, mode switching, diagnostics and inert-Live smoke checks under the actual Pages subpath.
- Wording expectations were updated only where the displayed wording changed. Existing numeric calculations were not changed to satisfy tests.

## Checked and retained

The IHHL source, carried-forward warnings, rural calendar sensitivity and common-count/range tests, identity gates, subject-specific denominators, held-out invalid records, source drilldowns and mode separation continue to pass. No causal explanation for Sunday or second-Saturday reporting was added. Actions describe measurements and follow-up; the app still does not certify carbon neutrality or assign a cross-subject performance score.

This is a bounded audit of retained evidence and application behavior, not departmental verification of every source record or a fresh-data certification.
