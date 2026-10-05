# E-flow workshop demonstrator

Start with **[learn.html](learn.html)** for the self-guided learning path in English, Russian and Uzbek Latin. Six illustrated exercises explain assessment objects, compare Q347-style/Kazakh/habitat methods, allocate a simple river account, compare drought outcomes, separate quantity from quality, and interpret evidence in a planning record. Each includes a prediction, explanation and retry. The short orientation targets 20 minutes; allow 45–60 minutes for full practice. These are estimates, not measured learner completion times.

The versioned [terminology registry](controlled-terms.json) distinguishes held source-exact wording from provisional translations; it is not certified translation or institutional approval. The [coverage matrix](coverage-matrix.json) records which report capabilities are illustrated and which remain outside the demonstrator.

The earlier **[guided.html](guided.html)** remains the detailed saved R2b walkthrough. **[playground.html](playground.html)** retains all method comparisons; **[assessment.html](assessment.html)** retains evidence/route cases; **[index.html](index.html)** retains the larger basin with users, salt and thermal diagnostics. These are named extensions, not a second compulsory tour. Their datasets are separate and requirements do not transfer automatically between them.

Tobi’s actual Zarafshan SWAT+/MODFLOW6/Taqsim/Fishy modelling is a separate workstream in progress, as reported by the project lead. This app explains conceptual model roles; it does not connect to, test or certify that basin implementation.

All public inputs are synthetic. This is a static replay of saved native calculations, with small explicitly labelled browser teaching calculations. It does not run Taqsim or Fishy live, make official designations, adopt a national prescription or determine ecological status. Native calculation provenance, bounded-run outcomes and reproduction instructions are supplied with `native/` and `data/guided.json`. A missing/unadmitted native result is shown as pending, never replaced by made-up output.

Current implementation review is summarized in `verification/learning_2026-10-04.json`; the earlier review remains in `verification/REVIEW_OUTCOME.txt`. Independent simulated learner/scientific and language reviews informed this update. Actual JSON and readable-card downloads from the new learning portal were received and opened in all three languages, with identical numerical results. **Draft release check:** legacy guided-page download receipt remains unconfirmed in the in-app browser after a compatibility repair. The exact record remains inspectable on screen; check those legacy downloads in the standard workshop browser before release.

Drought-sharing validation: `verification/drought_sharing_science.json`, `verification/drought_sharing_annual.json`, `verification/drought_sharing_browser.json` and `native/SHARING_VALIDATION.json`. Those earlier sharing checks are retained in the expanded 65-check JavaScript suite. No native simulation was rerun for this learning/localization update.

## Detailed saved-case walkthrough (optional extension)

1. **0–6 min: define the water bodies and network.** Select natural R1, constructed C1 and altered-natural R2. A hypothetical designation changes R2's assessment route without changing its origin or the physical replay. W1 is natural with a receptor overlay, not a fourth origin class. Restore controls return the assumed starting record. Classification determines the assessment route; network connections determine water accounting. Toggle landscape/network without losing the selected water body. R2a and R2b belong to R2; junctions are distinct. S1 is a storage object. C1 supplies irrigation, whose consumption and return explain D1. W1's unestablished supply remains dashed and unsized.
2. **6–10 min: compare.** Use same-forcing natural/managed pairs at R2b. Inspect transformations, a daily hydrograph and storage/balance evidence. The assumed 5% exchange is retained; the memoryless natural counterpart does not claim groundwater physics or unmeasured lateral inflow. Pre-existing artificial stored water is not dumped into the natural run.
3. **10–15 min: apply one rule.** Select R2 baseline. Spend two minutes tracing the seasonal candidate, one minute on dry supply, one on separate shortfall evidence and one on matching Fishy criteria. Ecological schedule and issued instruction remain separate. The 10/7/5 example is a separate supplied-evidence exercise, not an altered native trace.
4. **15–18 min: record.** Read the missing evidence and responsible role, export current JSON/readable summary, and reserve two additional minutes for questions. Deep links preserve body, scenario, day, mode, step, map view, receptor path and selected classification; unsupported links reset visibly. A shared link preserves the selected body’s override; other bodies return to the declared defaults on reload. Exports record the selected body, not a saved project of every exploratory override.

After the tour, explore entry/presumptive/top, C1 depth/velocity, W1 supplied-geometry balance, source-reduction/mixing and uncertainty examples. Each is an independent teaching calculation with explicit assumptions; these controls do not rerun or modify the native replay. Entry/top/presumptive or a nonmatching body cannot inherit an R2 baseline delivery instruction or verdict. The optional entry uses a deliberately simplified table, **not the statutory Swiss table**. The optional wetland is not a newly simulated branch. Quantity adequacy does not establish biological or chemical adequacy.

The four visible steps retain stable internal link IDs `1`, `3`, `4`, `5`. An older `step=2` link opens the combined first step in network view. Older comparison, rule and record links keep their meanings; Previous/Next visits the map only once.

## Comparing allocation choices during drought

Compare and Test a rule share one allocation selection, encoded by the saved scenario ID. **Ecology first (teaching)** uses the original scenarios. **Share drought water (teaching)** selects the separate `dry-managed-sharing` replay in `guided-sharing-synthetic-v1`; it is available only for dry forcing. Returning to normal visibly restores ecology first. Existing URLs keep their original scenario meanings.

The sharing assumption diverts up to 20% of river flow after the retained 5% natural exchange, limited by the seasonal irrigation request and actual available water. The daily cap is rounded down to 2 m³/day increments: `2 × floor(0.20 × post-exchange daily volume / 2)` in m³/day. This conservative numerical representation can leave diversion slightly below the nominal 20% cap. Half the diverted water is consumed and half returns on the same day. **20% is a teaching assumption, not a recommended percentage or a legal allocation rule.** Domestic and industrial demand and hydropower objectives are absent. The receiving river serves downstream functions and uses; its flow is not consumed exclusively by ecology.

The ecological schedule is unchanged. The issued instruction uses a separate allocation-policy version and the conditional deliverability after committed diversion. Low-runoff shortage, additional downstream reduction under allocation and failure to meet an instruction are different findings. Daily water accounting displays gross diversion, consumption, return and river flow. Three dry curves distinguish the natural system, ecology first and sharing; an explicit notice explains overlap when natural and priority flows coincide.

The add-on retains its own dataset, native run, allocation and issued-criterion identities. Its comparison names the frozen parent payload and is admitted only when ordered dates, reference, ecological schedule, forcing, checkpoint and mapping match the original admitted scenarios. Original natural/priority data are not relabelled as sharing results. JSON and readable exports retain the selected policy and parent provenance. All curves are saved native replays; selectors do not launch simulations or optimise an allocation. Missing or unadmitted add-on evidence stays pending.

## Record and identity boundaries

- `guided-six-unit-synthetic-v1` is the new connected case. Numerical assessment is at **R2 / R2b**; selecting R1, a canal, reservoir or wetland does not relabel those results.
- Classification stores origin, alteration, designation evidence/validity, route, use category, plan-unit link, reach mapping and receptor facts separately. Unassigned plan unit and unsupported use category remain null.
- Exported revisions are independent snapshots. The current record names actual dataset, scenario, reference, policy, checkpoint, units, provenance and missing evidence. Downloading a new revision never overwrites a prior record in application memory.
- Legacy W1 passports now use `eflow-passport/2`: natural origin plus receptor assessment, and an unknown/null carrier path. Old exports are not rewritten.
- The canonical 100-year R1 method fixture (70 million m³/year; June 5.52 m³/s) and the older nine-water-body basin remain separate and reachable below. Their protected physical datasets and numeric engine are unchanged. No project-observed time series is bundled in this public update.

Serve this folder with a static HTTP server (for example `python3 -m http.server 8768 --bind 127.0.0.1`) and open `http://127.0.0.1:8768/guided.html`. The page loads its data from a local JavaScript payload; no network service, account or browser Python is needed. Run application checks with `node --test tests/*.cjs`.

---

## Earlier separate examples

# Synthetic e-flow demonstrator

A standalone teaching example of TaqSim water and salt simulation, linked thermal diagnostics, and Fishy water-body criterion checks.

Open `index.html` in a browser. All data are synthetic and embedded in the page. Criteria are illustrative; this is not a calibrated Zarafshan model or an official ecological assessment.

No build step or server-side runtime is required. Publish this directory as a static site.

## Method playground

Open `playground.html` for four synthetic hydrograph patterns and three illustrative requirement calculations. `playground-engine.js` supplies deterministic calculations. The methods use explicitly synthetic parameters; none is an adopted Uzbek prescription or calibrated ecological assessment. The playground does not rerun basin allocation.

## Guided workshop workflow

Open **[assessment.html](assessment.html)** for the fictional six-unit route map, evidence variants and planning passport. The existing basin explorer and numeric playground remain available. Serve this folder with any static HTTP server, for example `python3 -m http.server 8768 --bind 127.0.0.1`, then open `http://127.0.0.1:8768/assessment.html`. There is no build step, external dependency or live simulation call.

Historical separate-example sequence, retained for reference. Use individual sections as extensions from the learning path; do not present this as the same numerical case:

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
