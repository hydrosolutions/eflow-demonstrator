const test = require('node:test');
const assert = require('node:assert/strict');
const A = require('../assessment-engine.js');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

function localeRuntime(lang) {
  const root = path.resolve(__dirname, '..');
  const context = {URL, URLSearchParams, location: {search: '?lang=' + lang, href: 'http://localhost/assessment.html'}, document: {readyState: 'loading', addEventListener() {}, title: 'Assessment'}, localStorage: {getItem() { return null; }}};
  vm.createContext(context);
  const html = fs.readFileSync(path.join(root, 'assessment.html'), 'utf8');
  const catalogs = [...html.matchAll(/src="(i18n\/[^"?]+catalog\.js)[^"]*"/g)].map(m => m[1]);
  for (const file of [...catalogs, 'i18n/legacy-i18n.js']) vm.runInContext(fs.readFileSync(path.join(root, file), 'utf8'), context);
  return context.EflowI18n;
}

test('switching language retains the explicit case and evidence route', () => {
  for (const lang of ['en', 'ru', 'uz-Latn']) {
    const query = new URLSearchParams({case: 'R2', variant: 'designated', lang, returnTo: 'learn.html?exercise=1&day=181'});
    const context = A.context('?' + query);
    assert.equal(context.valid, true);
    assert.equal(context.caseId, 'R2');
    assert.equal(context.variant, 'designated');
    assert.equal(A.buildPassport(context.caseId, context.variant).outputKind, 'potential_pending');
  }
});

test('locale-only entry retains the default case without inventing a new route', () => {
  for (const lang of ['en', 'ru', 'uz-Latn']) {
    const context = A.context('?lang=' + lang);
    assert.equal(context.valid, true);
    assert.equal(context.caseId, 'R1');
    assert.equal(context.variant, 'baseline');
    assert.equal(context.requested, false);
  }
});

test('localization does not weaken the context whitelist or permit external return targets', () => {
  for (const query of [
    '?case=R1&lang=xx', '?case=R1&lang=ru&lang=en', '?case=R1&lang=ru&unexpected=1',
    '?case=R1&returnTo=https%3A%2F%2Fexample.com', '?case=R1&returnTo=%2F%2Fexample.com',
    '?case=R1&returnTo=javascript%3Aalert(1)', '?case=R1&returnTo=learn.html%5Cevil',
  ]) assert.equal(A.context(query).valid, false, query);
});

test('localized extension URLs preserve their own scientific case identities', () => {
  for (const lang of ['en', 'ru', 'uz-Latn']) {
    assert.equal(A.context('?workshop=R1&variant=baseline&lang=' + lang, 'playground').valid, true);
    assert.equal(A.context('?workshop=R2&variant=baseline&lang=' + lang, 'playground').valid, false);
    assert.equal(A.context('?workshopCase=R1&node=wb-upstream&lang=' + lang, 'basin').valid, true);
    assert.equal(A.context('?workshopCase=R1&node=wb-downstream&lang=' + lang, 'basin').valid, false);
  }
});

test('localized export interpretations retain exact source values and pending evidence', () => {
  for (const variant of ['baseline', 'entry', 'top', 'evidence-missing']) {
    const source = A.buildPassport('R1', variant);
    const original = JSON.stringify(source);
    for (const lang of ['en', 'ru', 'uz-Latn']) {
      const result = localeRuntime(lang).withLocale(source);
      assert.equal(result.locale, lang);
      assert.equal(result.localizedSummary.language, lang);
      assert.ok(result.localizedSummary.output);
      if (lang === 'ru') assert.match(result.localizedSummary.output, /[А-Яа-я]/);
      assert.equal(result.finalRequirement, null);
      assert.equal(result.deliveryObligation, null);
      for (const key of Object.keys(source)) assert.deepEqual(result[key], source[key], key);
      assert.equal(JSON.stringify(source), original);
    }
  }
});

test('shared catalogs distinguish ecological potential from evaporation and consumptive use', () => {
  const ru = localeRuntime('ru');
  const uz = localeRuntime('uz-Latn');
  assert.equal(ru.t('Ecological potential'), 'Экологический потенциал');
  assert.equal(uz.t('Ecological potential'), 'Ekologik salohiyat');
  assert.notEqual(ru.t('Ecological potential'), ru.t('Potential evaporation'));
  assert.match(ru.t('consumptive use'), /[Бб]езвозврат/);
});
