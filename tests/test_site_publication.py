"""Exercise the public artifact rather than the repository's historical interfaces."""

import hashlib
import importlib.util
import json
import re
import subprocess
import tempfile
import unittest
from pathlib import Path
from urllib.parse import unquote, urlsplit

ROOT = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location('build_site', ROOT / 'scripts/build_site.py')
assert SPEC is not None and SPEC.loader is not None
site = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(site)


class PublicationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.output = (Path(self.temp.name) / 'site').resolve()
        self.paths = site.build(self.output)

    def tearDown(self) -> None:
        self.temp.cleanup()

    def test_artifact_contains_only_declared_public_files(self) -> None:
        expected = {*site.COPY_PATHS, *site.RETIRED_PAGES, 'advanced.html', 'index.html', '.nojekyll', site.MARKER}
        self.assertEqual(set(self.paths), expected)
        for excluded in ('native', 'verification', 'data', 'tests', '.git', 'learning.js', 'guided.js', 'assessment.js'):
            self.assertFalse((self.output / excluded).exists(), excluded)

    def test_source_and_calculation_payloads_copy_without_changes(self) -> None:
        for name in site.COPY_PATHS:
            self.assertEqual(
                hashlib.sha256((ROOT / name).read_bytes()).hexdigest(),
                hashlib.sha256((self.output / name).read_bytes()).hexdigest(), name,
            )
        self.assertEqual((ROOT / 'index.html').read_bytes(), (self.output / 'advanced.html').read_bytes())

    def test_retired_pages_are_not_old_applications(self) -> None:
        for name in site.RETIRED_PAGES:
            content = (self.output / name).read_text()
            self.assertNotIn('<script src=', content)
            self.assertNotIn('guided-data', content)
            self.assertNotIn('learning.js', content)
            for language in ('en', 'ru', 'uz-Latn'):
                self.assertIn(f'<section lang="{language}">', content)
                self.assertIn(f'prototype/?lang={language}', content)
            self.assertNotIn('location.search;', content)
            self.assertIn('are not transferred', content)

    def test_html_local_asset_and_navigation_links_resolve(self) -> None:
        for page in self.output.rglob('*.html'):
            content = page.read_text()
            refs = re.findall(r'(?:src|href)=["\']([^"\']+)["\']', content)
            for ref in refs:
                parsed = urlsplit(ref.replace('&amp;', '&'))
                if parsed.scheme or parsed.netloc or not parsed.path or '${' in ref:
                    continue
                target = (page.parent / unquote(parsed.path)).resolve()
                if target.is_dir():
                    target /= 'index.html'
                self.assertTrue(target.is_relative_to(self.output), f'{page}: {ref}')
                self.assertTrue(target.is_file(), f'{page.relative_to(self.output)}: {ref}')

    def test_public_root_routes_new_and_old_links_without_reinterpreting_state(self) -> None:
        script = re.search(r'<script>(.*?)</script>', site.LANDING, re.S).group(1)
        runner = """
const vm = require('node:vm');
const source = JSON.parse(process.argv[1]);
const cases = [
  ['https://example.test/eflow/?lang=ru&method=kazakh&operation=irrigation', 'prototype/'],
  ['https://example.test/eflow/index.html?node=wb-upstream&lang=uz-Latn', 'advanced.html'],
  ['https://example.test/eflow/?scenario=dry&day=70#thermal-section', 'advanced.html'],
  ['https://example.test/eflow/?workshopCase=R1', 'advanced.html'],
];
for (const [href, path] of cases) {
  const input = new URL(href);
  let redirected;
  const location = {href, search: input.search, hash: input.hash, replace: value => {redirected = new URL(value);}};
  vm.runInNewContext(source, {URL, URLSearchParams, location, document: {getElementById: () => ({})}});
  if (redirected.pathname !== '/eflow/' + path || redirected.search !== input.search || redirected.hash !== input.hash) {
    throw new Error('Unexpected redirect for ' + href + ': ' + redirected);
  }
}
"""
        subprocess.run(['node', '-e', runner, json.dumps(script)], check=True, capture_output=True, text=True)

    def test_rebuild_removes_accidentally_added_legacy_payload(self) -> None:
        leaked = self.output / 'learning.js'
        leaked.write_text('should not remain public')
        site.build(self.output)
        self.assertFalse(leaked.exists())

    def test_build_refuses_unrelated_output_directory(self) -> None:
        unrelated = Path(self.temp.name) / 'unrelated'
        unrelated.mkdir()
        (unrelated / 'important.txt').write_text('retain')
        with self.assertRaisesRegex(ValueError, 'Refusing to clear'):
            site.build(unrelated)
        self.assertEqual((unrelated / 'important.txt').read_text(), 'retain')


if __name__ == '__main__':
    unittest.main()
