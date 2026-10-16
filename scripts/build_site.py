#!/usr/bin/env python3
"""Build the selected public interfaces without publishing repository history."""

import argparse
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROTOTYPE_FILES = (
    'index.html', 'styles.css', 'locale-catalog.js', 'locale.js', 'flow-status.js',
    'quality-data.js', 'calculated-data.js', 'app.js', 'calculated-view.js',
    'route-engine.js', 'route-cases.js', 'route-catalog.js', 'route-view.js', 'route.css',
    'comparison-ecology.json', 'comparison-irrigation.json',
    'comparison-stress-ecology.json', 'comparison-stress-irrigation.json',
    'targets.json', 'targets-stress.json', 'quality.json',
)
ROOT_FILES = (
    'playground.html', 'playground-engine.js', 'assessment-engine.js',
    'workshop-saved.js', 'controlled-terms.json',
    'retained-navigation.js', 'retained-navigation.css',
)
I18N_FILES = (
    'common-catalog.js', 'guided-catalog.js', 'assessment-catalog.js',
    'playground-catalog.js', 'basin-catalog.js', 'record-catalog.js',
    'evidence-catalog.js', 'legacy-i18n.js', 'legacy-i18n.css',
)
COPY_PATHS = (
    *ROOT_FILES,
    *(f'prototype/{name}' for name in PROTOTYPE_FILES),
    *(f'i18n/{name}' for name in I18N_FILES),
)
RETIRED_PAGES = ('learn.html', 'guided.html', 'assessment.html')
MARKER = '.selected-site-output'

LANDING = '''<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>E-flow demonstrator</title>
<p>Opening the <a id="destination" href="prototype/">e-flow demonstrator</a>.</p>
<script>
const destination = new URL('prototype/', location.href);
const query = new URLSearchParams(location.search);
if (['node', 'scenario', 'workshopCase'].some(key => query.has(key))) {
  destination.pathname = new URL('advanced.html', location.href).pathname;
}
destination.search = location.search;
destination.hash = location.hash;
document.getElementById('destination').href = destination.href;
location.replace(destination.href);
</script>
<noscript><p><a href="playground.html">Methods playground</a> · <a href="advanced.html">Advanced basin example</a></p></noscript>
</html>
'''

RETIRED_NOTICE = '''<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Earlier interface retired · E-flow</title>
<style>body{font:18px/1.6 system-ui,sans-serif;max-width:750px;margin:8vh auto;padding:24px;color:#193e44;background:#f8faf9}a{color:#176b81}nav{display:flex;gap:20px;flex-wrap:wrap}section{margin:36px 0}h1{font-size:1.8rem}</style></head>
<body><nav aria-label="Language"><a href="?lang=en">English</a><a href="?lang=ru">Русский</a><a href="?lang=uz-Latn">Oʻzbekcha</a></nav>
<section lang="en"><h1>This earlier interface has been retired</h1><p>Choose one of the retained tools below. The case, scenario and exercise settings in an old link are not transferred. Source files and evidence remain in the GitHub repository.</p><nav><a href="prototype/?lang=en">Demonstrator</a><a href="playground.html?lang=en">Methods playground</a><a href="advanced.html?lang=en">Advanced basin example</a></nav></section>
<section lang="ru"><h1>Этот прежний интерфейс больше не публикуется</h1><p>Выберите один из сохранённых инструментов ниже. Параметры примера, сценария и упражнения из старой ссылки не переносятся. Исходные файлы и подтверждающие материалы сохранены в репозитории GitHub.</p><nav><a href="prototype/?lang=ru">Демонстратор</a><a href="playground.html?lang=ru">Сравнение методов</a><a href="advanced.html?lang=ru">Расширенный пример бассейна</a></nav></section>
<section lang="uz-Latn"><h1>Avvalgi interfeys endi eʼlon qilinmaydi</h1><p>Quyida saqlangan vositalardan birini tanlang. Eski havoladagi misol, ssenariy va mashq sozlamalari yangi vositaga koʻchirilmaydi. Manba fayllari va tasdiqlovchi materiallar GitHub repozitoriysida saqlangan.</p><nav><a href="prototype/?lang=uz-Latn">Namoyish modeli</a><a href="playground.html?lang=uz-Latn">Usullarni oʻrganish</a><a href="advanced.html?lang=uz-Latn">Havzaning kengaytirilgan misoli</a></nav></section>
<script>
const selected = new URLSearchParams(location.search).get('lang');
const language = ['en', 'ru', 'uz-Latn'].includes(selected) ? selected : 'en';
document.documentElement.lang = language;
for (const section of document.querySelectorAll('section[lang]')) section.hidden = section.lang !== language;
document.title = document.querySelector('section[lang="'+language+'"] h1').textContent;
</script></body></html>
'''


def build(output: Path, source: Path = ROOT) -> list[str]:
    """Copy an explicit allowlist; refuse to clear unrelated existing directories."""
    output = output.resolve()
    source = source.resolve()
    if output == source or source.is_relative_to(output):
        raise ValueError('Site output must not contain the source repository')
    missing = [name for name in (*COPY_PATHS, 'index.html') if not (source / name).is_file()]
    if missing:
        raise FileNotFoundError(f'Missing public source files: {missing}')
    if output.exists() and any(output.iterdir()) and not (output / MARKER).is_file():
        raise ValueError('Refusing to clear a nonempty directory without the site-output marker')
    if output.exists():
        shutil.rmtree(output)
    output.mkdir(parents=True)
    (output / MARKER).write_text('Generated by scripts/build_site.py\n')
    for name in COPY_PATHS:
        target = output / name
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(source / name, target)
    shutil.copyfile(source / 'index.html', output / 'advanced.html')
    (output / 'index.html').write_text(LANDING, encoding='utf-8')
    for name in RETIRED_PAGES:
        (output / name).write_text(RETIRED_NOTICE, encoding='utf-8')
    (output / '.nojekyll').touch()
    return sorted(str(path.relative_to(output)) for path in output.rglob('*') if path.is_file())


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, default=ROOT / '_site')
    args = parser.parse_args()
    build(args.output)


if __name__ == '__main__':
    main()
