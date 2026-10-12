# Native Koksu allocation calculations

These are byte-identical calculation sources, forcing and nine application witnesses from the admitted 12 October 2026 local audit. Use the existing `native/pyproject.toml` and lockfile pins (Python 3.13; Taqsim 0.1.4, Fishy 0.1.2 and Incidence 0.1.4, exact Git revisions in that project).

From repository root, after setting up the pinned environment:

```sh
uv run --project native pytest native/koksu/test_allocation_priority.py -q
uv run --project native python native/koksu/native_comparison.py --source native/koksu/koksu_forcing.csv --targets prototype/targets.json --year 2021 --method kazakh --priority irrigation-first --output native-output/koksu-dry-kazakh-irrigation
```

The second command runs one 365-day case in state-carrying three-day chunks and writes native model/run/physical files and a daily result ledger. Use `--method natural`, `swiss`, or `site` for other routes; `--year 2011` selects the base curve; `--priority ecology-first` selects ecological reservation. Years are synthetic calendar codes. Use `prototype/targets-stress.json` with `--mode fixed-normal-target-stress` for the retained normal-year target under drought. The prototype reads admitted assembled results rather than the output of arbitrary new runs.

The published matrix used 300 seconds and 2 GiB per case and 1200 seconds aggregate, with independent output admission. The direct reproduction command above is not supervised by those limits. Public verification preserves the original source hashes and run summaries; the full local 1952-chunk archive is not included in this static website commit. No native rerun was necessary for publishing these unchanged sources and inputs.
