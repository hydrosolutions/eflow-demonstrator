# Conservative salt restoration

`native_quality.py` uses the existing allocation rules and daily forcing, adds one native conservative salt constituent, and calls `fishy.quality.assess_quality` at R2a and R2b. The original water sources and comparison files are unchanged. The 180 mg/L background and inclusive 250 mg/L daily mean criterion come from the earlier basin example. The 50% same-day return is retained from the current simpler prototype (the earlier explorer used 35%). All are hypothetical demonstration assumptions. They are not measured Koksu chemistry or an adopted standard.

Irrigation consumption removes water but no salt. All diverted salt returns in half the diverted water, making the return 360 mg/L when it flows. Natural exchange carries mixed water and salt. Reservoir water and salt, and every other native inventory, carry across three-day chunks. Dry concentration is undefined; the display finding is `unknown`, and the original Fishy finding is retained separately. These results assess a physical consequence; they do not size a quality-based flow requirement.

The 13 October 2026 run executed 14 unique managed annual cases (1,708 native chunks) covering all 24 operation/basis/forcing/method selections. Reuse requires identical forcing, calendar, method, complete raw and quantized target, operation policy and chemistry inputs. Normal-year fixed-target selections link to the matched water file selected by the UI. Full normal method records were verified identical across the matched and stress files. Every native daily water ledger and quantity finding was checked against its existing water artifact. Native node and basin water/salt residuals were zero, and independent mass checks covered consumption, return, downstream mixing and storage.

Use the Python 3.13 environment and exact Git revisions in `native/pyproject.toml` and `native/uv.lock`. From the demonstrator root, after preparing that pinned environment:

```sh
uv run --no-sync --project native pytest native/koksu/test_native_quality.py native/koksu/test_allocation_priority.py -q
uv run --no-sync --project native python native/koksu/native_quality.py --source native/koksu/koksu_forcing.csv --targets prototype/targets.json --year 2021 --method site --priority ecology-first --output /tmp/koksu-quality-site
```

The direct single-case command is not supervised. The bounded complete matrix command is:

```sh
uv run --no-sync --project native python native/koksu/build_quality.py --audit /path/to/fresh-quality-audit
```

The audit directory must contain `CONTRACT.json` with `assumptions` and `excluded` fields matching the retained artifact; a copy of the review contract is at `verification/prototype_quality_2026-10-13/CONTRACT.json` in this repository. The matrix refuses to overwrite prior run folders, bounds each case to 300 seconds/2 GiB and the matrix to 1,200 seconds, checks frozen files, and writes `prototype/quality.json` with `status: candidate`. Admission is a separate independent review; reproducing native calculations does not grant admission.

Local audit evidence is held outside the website in `quality_restore_2026-10-13/`: `MATRIX_STATE.json`, `NATIVE_QUALITY_SUMMARY.json`, `ASSEMBLY_ALIAS_CORRECTION.json`, and each native case's model/run/physical files and result. The assembly correction records the executed and delivered builder hashes because the normal/fixed active-water hash link was corrected after execution; no native source or physical result changed. Artifact provenance retains the native result and physical hashes. Runtime, absolute paths, and publication/admission metadata need not reproduce bytewise; physical counts, ledgers, salt findings, and water associations must agree.
