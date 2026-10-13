# E-flow methodology demonstrator

Three connected tools illustrate the proposed methodology. The public landing page opens the **[demonstrator](https://hydrosolutions.github.io/eflow-demonstrator/prototype/)**.

| Tool | Use it to | Calculation boundary |
|---|---|---|
| [Demonstrator](https://hydrosolutions.github.io/eflow-demonstrator/prototype/) | Inspect the network, compare method components and allocation priorities, then assess flow delivery and salt separately | Saved native Taqsim routing and Fishy checks for a hypothetical Koksu-forced network; the browser does not rerun either package |
| [Methods playground](https://hydrosolutions.github.io/eflow-demonstrator/playground.html) | Change method assumptions and synthetic hydrographs; inspect requirements and shortfalls | Browser calculations of requirements and availability, not network routing |
| [Advanced basin example](https://hydrosolutions.github.io/eflow-demonstrator/advanced.html) | Inspect a separate larger system, detailed accounts, reservoir temperature and industrial cooling | Separate synthetic native water/salt results and external thermal diagnostics |

The presentation sequence is: change a method assumption in the playground, inspect the resulting requirement, then return to the demonstrator to compare saved ecology-first and irrigation-first network operation. Language and the chosen method connect the tools; playground slider values do **not** become new native network results. The advanced example has different topology and assumptions. Its results must not be attributed to the demonstrator's water bodies.

English, Russian and Uzbek Latin are available. The [controlled terminology registry](controlled-terms.json) distinguishes source-exact wording from provisional translations; professional terminology approval is still pending. The [coverage matrix](coverage-matrix.json) maps the retained interfaces and explicit omissions to report capabilities.

## Scope and evidence

The demonstrator compares a Swiss-derived assumed floor, an illustrative Kazakh annual-shift component and published snow-trout baseflows. These are partial method components, not complete interchangeable prescriptions. The Koksu forcing is approximate digitization of published monthly medians, with an assumed dry multiplier; it is not an observed daily year or accepted natural reconstruction. No local habitat calibration, official designation, legal compliance verdict or ecological-status classification is produced. Salt findings do not activate the report's dormant quality-based flow-sizing module.

See [prototype/README.md](prototype/README.md) for the exact model scope and [native/koksu/](native/koksu/) for calculation and reproduction sources. Native calculation files, tests and [verification/](verification/) remain in the repository. The app neither connects to nor certifies the separate Zarafshan SWAT+/MODFLOW6/Taqsim/Fishy modelling workstream.

## Publication and local preview

Publish the generated `_site/` artifact, **not the repository root**:

```sh
python3 scripts/build_site.py
python3 -m http.server 8781 --bind 127.0.0.1 --directory _site
```

Open `http://127.0.0.1:8781/`. The build copies only an explicit allowlist of runtime assets and intentional data downloads. JSON payloads are copied byte for byte, including the quality admission payload. Source `index.html` is retained as the advanced explorer and emitted as `advanced.html`; generated public `index.html` redirects to `prototype/`. Recognizable earlier basin links with `node`, `scenario` or `workshopCase` parameters go to the advanced example instead.

GitHub Pages uses `.github/workflows/pages.yml`: validate, build, upload `_site/`, deploy. The repository's Pages source must be **GitHub Actions**, rather than the historical `main` branch root. Pushes to `main` and manual workflow dispatches publish the selected artifact.

```sh
node --test tests/*.cjs
python3 -m unittest discover -s tests -p 'test_site_publication.py'
```

The publication tests check the allowlist, local HTML dependencies, translated retirement notices, safe rebuild behavior and byte-identical copies. Existing numerical and application tests remain active; this interface consolidation requires no new native simulation.

## Retired public journeys, preserved repository sources

`learn.html`, `guided.html` and `assessment.html` remain as historical source interfaces with their engines, fixtures, tests and review evidence. They are no longer deployed as applications or linked from the retained tools. The build emits short English/Russian/Uzbek retirement notices at their old addresses. Old case, scenario and exercise parameters are not silently transferred to another model.

The earlier six-exercise course, detailed route/evidence exercises, interactive uncertainty and planning-passport exercises are not current public capabilities. Their historical README and coverage descriptions remain in Git history. Report coverage below is illustrative and partial; retaining source code does not mean a capability is implemented in the current interface.
