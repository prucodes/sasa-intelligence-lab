# SASA Intelligence Lab glossary

The application glossary is maintained in `lib/glossary.ts`. That file powers both interface tooltips and the About panel, so definitions remain consistent.

When a new dataset or API is activated:

1. Add every new abbreviation and specialist evidence term to `lib/glossary.ts`.
2. Use the source owner's official expansion where available.
3. Describe what a measure does **and does not** establish.
4. Review the rendered About panel and keyboard-focus tooltips.
5. Add or update the glossary test before merging.

Important interpretation terms include **UNSCORED**, **dataset grain**, **configured capacity**, **candidate identity**, **crosswalk**, and **retained snapshot**. Their definitions in code are the product's canonical wording.

