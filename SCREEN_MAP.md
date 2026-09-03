# Screen map

| Route | Purpose | Primary interactions |
|---|---|---|
| `/` | Present three compact current review signals plus scoring eligibility | Review collection procurement, IHHL delivery, or reported legacy-waste balance; open Gap Radar evidence gates |
| `/operational-analytics` | Use retained governed evidence for current operational analysis without creating route sprawl | Switch between Collection, Sanitation Delivery, Processing Infrastructure, and Swachh Outcomes tabs; separate ULB procurement from district collection assets; review legacy-waste balances or the facility registry; inspect latest-period calculations and source-grain tables |
| `/gap-radar` | Display eligible demo fixtures in four quadrants in DEMO mode; in SAMPLE mode show the unmet activation gates and the crosswalk workbench that makes the first of them workable | Select a marker (DEMO); review candidate ULB matches against the anchor registry and record Approve / No match / Defer decisions (SAMPLE) |
| `/diagnostics/:ulbKey` | Explain a selected candidate using reported values, evidence breadth, source grain, formulas/checks, quality flags, raw fields, complete-snapshot provenance, and every exact normalized source candidate | Change entity; inspect source-family breadth; open additional exact-name sources; select any retained source record in the Evidence Inspector |
| `/data-readiness` | Separate authorization, documented integrations, compact and full coverage, retrieved periods, source reconciliation, join readiness, and scoring eligibility | Switch Catalogue/Coverage/Periods/Quality views; inspect 15-source operational breadth; review deterministic reconciliation queues and activation maturity |

The `mode=demo|sample|live` query parameter is preserved across navigation. Routes default to Demo mode when the parameter is absent or invalid. A separate header control switches between light and dark presentation themes without changing data mode or evidence state.

No separate Collection, IHHL, Processing, Coverage, Period, or Dataset Explorer routes exist. These remain internal views within the five-screen structure.
