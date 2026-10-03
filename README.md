# Synthetic e-flow demonstrator

A standalone teaching example of TaqSim water and salt simulation, linked thermal diagnostics, and Fishy water-body criterion checks.

Open `index.html` in a browser. All data are synthetic and embedded in the page. Criteria are illustrative; this is not a calibrated Zarafshan model or an official ecological assessment.

No build step or server-side runtime is required. Publish this directory as a static site.

## Method playground

Open `playground.html` for four synthetic hydrograph patterns and three illustrative requirement calculations. `playground-engine.js` supplies deterministic calculations. The methods use explicitly synthetic parameters; none is an adopted Uzbek prescription or calibrated ecological assessment. The playground does not rerun basin allocation.

## Guided workshop workflow

Open **[assessment.html](assessment.html)** for the fictional six-unit route map, evidence variants and planning passport. The existing basin explorer and numeric playground remain available. Serve this folder with any static HTTP server, for example `python3 -m http.server 8768 --bind 127.0.0.1`, then open `http://127.0.0.1:8768/assessment.html`. There is no build step, external dependency or live simulation call.

Suggested 18-minute sequence, with two minutes reserved for discussion:

1. **3 minutes:** identify R1, R2, canal C1, drain D1, reservoir S1 and wetland W1. Colours identify default routes, not ecological status. Alteration and irrigation use do not reclassify a natural river. R2's designation-pending variant blocks tier selection; its designated variant is explicitly hypothetical.
2. **4 minutes:** choose R1 baseline. Follow 100 synthetic years → annual 50% class uses 75% → 70 million m³ → June 14.31 million m³ / 5.52 m³/s. The unchanged numeric engine checks daily bounds. Short-but-usable evidence still selects baseline, with raised uncertainty.
3. **3 minutes:** open the exact R1 playground preset; reduce availability. Reference and requirements remain fixed. Entry is a floor only, top is a single hypothetical habitat element. Return using “Reopen canonical R1 case”: this explicitly resets modifications. Inspect bounds-crossing and missing-operand variants; neither substitutes zero or an unadopted fallback.
4. **4 minutes:** follow the separate saved-basin link, select Below cooling (`wb-downstream`), and compare Supply priority — dry with Seasonal protection — dry. The saved flow criterion remains 30% of normal reference and salt criterion 250 mg/L. These physical findings do not establish ecological status. The workshop target is not passed into TaqSim/Fishy.
5. **4 minutes:** return to the assessment guide, inspect potential/receptor gaps, and export a passport with candidate, missing inputs, action, responsible role and review trigger. A saved-basin export is a separate record with its actual water-body ID, scenario and exact saved series; it cannot replace the method-case record.

### Evidence boundaries

- `workshop-r1-synthetic-v1` is a method teaching fixture, not an observed or accepted reconstructed record. `workshop-fixture.json` preserves the shared slide/demo values. The generator uses 100 deterministic 365-day years; “short record” changes the assumed eligibility situation, not the underlying numeric fixture.
- `saved-basin-2025-v1` contains the existing saved synthetic simulations. R1 and `wb-upstream` are only an illustrative analogy; they are neither identical units nor joinable records. There is no new allocation or Fishy assessment run.
- The route engine distinguishes floor, seasonal quantity, habitat element, pending potential/receptor, undetermined track and route-only outputs. A candidate is never a final adopted requirement or delivery obligation. Missing values are null with reasons and actions, not zero.
- Potential sizing records the habitat, velocity/depth, applicable service and suspended winter-share attempts. Service flow is not ecological adequacy; natural fallback does not fill potential gaps. W1 needs its own level/inundation/quality targets and carrier-path evidence.
- Origin and designation are fictional. `none` means an assumed records check; `not_searched` and `pending` block selection. A hypothetical valid designation retains natural origin, has no artificial subtype and does not invent a prior natural result.
- Winter/spawning/quality limbs remain omitted from the R1 quantity example. The top-tier curve is hypothetical, not calibrated snow-trout evidence or a holistic prescription. Daily means do not establish extrema. Ecological status remains unestablished.
- Only whitelisted case/variant URLs are accepted; unknown or mismatched inputs produce a visible notice. Modifying playground controls creates a modified experiment export with actual inputs, never a stale canonical passport.

### Verification

Run `node --test tests/*.cjs`. The application tests cover all route fixtures, designation states, exact canonical precision, daily series, ordered fallbacks, null reasons, invalid contexts, modified exports, separate saved-data exports and hashes of the original numeric engine and both embedded physical datasets. `test_playground_engine.cjs` is copied unchanged from the parent Zarafshan workshop's existing behavior suite; it exercises the existing public engine API. No unit-only mocks or native simulations are required.

The numeric engine and embedded `const results` / `const inputs` data are deliberately byte-protected. Changes in this workshop extension affect presentation, routing and explicit records only. No production deployment is part of this change.
