const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const {execFileSync} = require('node:child_process');
const {renderer, root: prototype} = require('./prototype-render-fixture.cjs');
const root = path.dirname(prototype);
const routeAssets = ['route-engine.js', 'route-cases.js', 'route-catalog.js', 'route-view.js', 'route.css'];
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const plain = html => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const reportReference = {
  fileName:'report_review_2026-09-20__shared_with_NCECC.docx',
  sha256:'51de55c8473548a536d3fd860948b928183dcdd6470df4721246c0bf1b3bfedc',
  referenceRole:'shared-report-alignment-reference'
};
const components = ['quality', 'thermal', 'receptor', 'sediment', 'connectivity', 'groundwater'];

test('the overview follows the selected track and candidate without treating check numbers as method identifiers', () => {
  const page = browser();
  let html = page.render();
  const overview = () => html.match(/<figure\b[^>]*data-route-overview="([^"]+)"[^>]*>([\s\S]*?)<\/figure>/);
  assert.equal(overview()?.[1], 'natural-status');
  assert.match(plain(html), /Check 1/);
  assert.match(plain(html), /not method IDs or report step numbers/);
  page.select('mode', 'hypothetical-workshop');
  html = page.select('flowEvidence', 'daily-only');
  assert.match(overview()[2], /data-route-diagram-node="swiss-entry" data-route-diagram-state="selected"/);
  assert.match(plain(overview()[2]), /Crossed baseline bounds/);
  assert.match(plain(overview()[2]), /domestic statistic fails/);
  html = page.select('bodyId', 'C1');
  assert.equal(overview()[1], 'ecological-potential');
  assert.doesNotMatch(overview()[2], /data-route-diagram-node="swiss-entry"/);
  html = page.select('bodyId', 'W1');
  assert.equal(overview()[1], 'receptor-assessment');
  assert.match(overview()[2], /data-route-diagram-node="receptor-assessment" data-route-diagram-state="selected"/);
  assert.doesNotMatch(overview()[2], /data-route-diagram-node="kazakh-baseline"/);
});

const inspector = html => html.match(/<section\b[^>]*data-route-inspector="([^"]+)"[^>]*>([\s\S]*?)<\/section>/);

test('diagram buttons expose a method inspector without selecting a calculation method', () => {
  const app = browser();
  app.render();
  app.select('flowEvidence', 'full');
  const original = app.state();
  const html = app.inspect('kazakh-baseline');
  assert.match(html, /<button[^>]*data-route-inspect="kazakh-baseline"[^>]*aria-expanded="true"[^>]*aria-controls="route-method-inspector"/);
  assert.equal(inspector(html)?.[1], 'kazakh-baseline');
  assert.match(plain(inspector(html)[2]), /R2/);
  assert.match(plain(inspector(html)[2]), /Selected candidate/);
  assert.match(plain(inspector(html)[2]), /Annual exceedance statistics/);
  assert.match(plain(inspector(html)[2]), /Not assessed/);
  assert.match(inspector(html)[2], /report_review_2026-09-20__shared_with_NCECC.docx/);
  assert.equal(app.focused()?.id, 'route-method-inspector');
  assert.deepEqual(app.state(), original);
  const other = app.inspect('swiss-entry');
  assert.match(other, /data-route-output="kazakh-baseline"/);
  assert.equal(inspector(other)?.[1], 'swiss-entry');
  assert.deepEqual(app.state(), original);
  assert.equal(inspector(app.inspect('swiss-entry')), null, 'The expanded method button toggles the panel closed');
});

test('the inspector refreshes evidence and final-check findings while preserving the selected method', () => {
  const app = browser();
  app.render();
  app.select('mode', 'hypothetical-workshop');
  app.select('flowEvidence', 'full');
  app.inspect('kazakh-baseline');
  const daily = app.select('flowEvidence', 'daily-only');
  assert.equal(inspector(daily)?.[1], 'kazakh-baseline');
  assert.match(plain(inspector(daily)[2]), /Skipped after checks/);
  assert.match(plain(inspector(daily)[2]), /Missing/);
  assert.match(daily, /data-route-output="swiss-entry"/);
  app.select('flowEvidence', 'full');
  app.select('finalCheckRoute', 'kazakh-baseline');
  const failed = app.select('finalAssessment', 'safeguard-fail');
  assert.equal(inspector(failed)?.[1], 'kazakh-baseline');
  assert.match(plain(inspector(failed)[2]), /Supplied final check failed/);
  assert.match(plain(inspector(failed)[2]), /Reported failure/);
});

test('the inspector distinguishes unvisited routes and direct fallback from failed evidence', () => {
  const app = browser();
  app.render();
  app.select('mode', 'hypothetical-workshop');
  app.select('flowEvidence', 'full');
  let html = app.inspect('swiss-entry');
  assert.match(plain(inspector(html)[2]), /Not reached/);
  assert.match(plain(inspector(html)[2]), /earlier route/);
  html = app.select('flowEvidence', 'crossed-bounds');
  assert.match(plain(inspector(html)[2]), /directly to fallback/);
  assert.doesNotMatch(plain(inspector(html)[2]), /Skipped after checks/);
  app.select('flowEvidence', 'monthly-only');
  assert.match(plain(inspector(app.html())[2]), /Missing or not accepted: Accepted daily low-flow statistic/);
});

test('the inspector labels hypothetical assumptions restricted indicative use and alternative authority', () => {
  const app = browser();
  app.render();
  app.select('mode', 'hypothetical-workshop');
  app.select('flowEvidence', 'daily-only');
  const swiss = app.inspect('swiss-entry');
  assert.match(plain(inspector(swiss)[2]), /Workshop assumption/);
  assert.match(plain(inspector(swiss)[2]), /Adopted national Q347 conversion table/);
  app.select('flowEvidence', 'indicative-prohibited');
  const restricted = app.inspect('kazakh-baseline');
  assert.match(plain(inspector(restricted)[2]), /Not permitted for sizing/);
  assert.match(plain(inspector(restricted)[2]), /Screening/);
  app.select('bodyId', 'C1');
  app.select('serviceEvidence', true);
  const service = app.inspect('service-conveyance');
  assert.match(plain(inspector(service)[2]), /At least one authority basis/);
  assert.match(plain(inspector(service)[2]), /Operating rule or approving act/);
  assert.match(plain(inspector(service)[2]), /Applicable permit entitlement/);
  assert.match(plain(inspector(service)[2]), /seasonal floor/i);
});

test('inspection survives locale and tab changes and closes on body change or Escape', () => {
  const app = browser();
  app.render();
  app.inspect('swiss-entry');
  assert.equal(inspector(app.route('ru'))?.[1], 'swiss-entry');
  app.tab('compare');
  assert.equal(inspector(app.tab('route'))?.[1], 'swiss-entry');
  app.key('Escape');
  assert.equal(inspector(app.html()), null);
  assert.equal(app.focused()?.dataset.routeInspect, 'swiss-entry');
  app.inspect('kazakh-baseline');
  app.closeInspector();
  assert.equal(inspector(app.html()), null);
  assert.equal(app.focused()?.dataset.routeInspect, 'kazakh-baseline');
  app.inspect('swiss-entry');
  const wetland = app.select('bodyId', 'W1');
  assert.equal(inspector(wetland), null);
  const receptor = app.inspect('receptor-assessment');
  assert.equal(inspector(receptor)?.[1], 'receptor-assessment');
  assert.match(plain(inspector(receptor)[2]), /Receptor targets, pathways and sizing rules/);
  assert.doesNotMatch(inspector(receptor)[2], /data-route-gate="annual-exceedance-set"/);
});

test('method inspector evidence and navigation labels are localized in all three languages', () => {
  const app = browser();
  app.render();
  app.select('mode', 'hypothetical-workshop');
  app.select('flowEvidence', 'indicative-prohibited');
  app.inspect('kazakh-baseline');
  for (const lang of ['en', 'ru', 'uz-Latn']) {
    for (const state of ['accepted', 'accepted-indicative', 'not-accepted', 'unavailable', 'not-applicable', 'unknown']) {
      const key = `inspect-state-${state}`;
      assert.notEqual(app.context.RouteCatalog.text(lang, key), key, `Translated evidence state: ${lang} / ${state}`);
    }
    const html = app.route(lang);
    const text = plain(inspector(html)[2]);
    assert.doesNotMatch(text, /inspection:|inspect[A-Z]|annual-exceedance-set|workshop-participant-input|No accepted case evidence|undefined/);
    assert.match(text, lang === 'ru' ? /Не разрешено для расчёта/ : lang === 'uz-Latn' ? /Hisoblashga ruxsat etilmagan/ : /Not permitted for sizing/);
    if (lang !== 'en') assert.doesNotMatch(text, /Required data and conditions|Selected candidate|Workshop assumption|Not reached|Accepted daily low-flow statistic/);
  }
});

// A small DOM boundary fake: controls are discovered from the rendered public HTML.
// It supports direct and delegated handlers without depending on private route state.
function attributeMap(source) {
  return Object.fromEntries([...source.matchAll(/([\w-]+)(?:=["']([^"']*)["'])?/g)].map(match => [match[1], match[2] ?? '']));
}
function element(attributes, value = '') {
  const listeners = {};
  const result = {
    attributes, value, checked: Object.hasOwn(attributes, 'checked'),
    id: attributes.id ?? '',
    dataset: Object.fromEntries(Object.entries(attributes).filter(([key]) => key.startsWith('data-')).map(([key, value]) => [key.slice(5).replace(/-([a-z])/g, (_, letter) => letter.toUpperCase()), value])),
    getAttribute(key) {return this.attributes[key] ?? null;},
    setAttribute(key, value) {this.attributes[key] = String(value);},
    addEventListener(type, handler) {(listeners[type] ??= []).push(handler);},
    matches(selector) {
      if (selector.startsWith('#')) return selector.slice(1) === this.id;
      const attributes = [...selector.matchAll(/\[([\w-]+)(?:=["']?([^\]"']+)["']?)?\]/g)];
      return attributes.length > 0 && attributes.every(([, key, value]) => Object.hasOwn(this.attributes, key) && (value === undefined || this.attributes[key] === value));
    },
    closest(selector) {return this.matches(selector) ? this : null;},
    dispatch(type, extra = {}) {
      const event = {target:this, preventDefault(){}, ...extra};
      this['on' + type]?.(event);
      for (const handler of listeners[type] ?? []) handler(event);
      return event;
    },
  };
  return result;
}
function browser() {
  const fixture = renderer().withQuality();
  const {context, events} = fixture;
  const main = vm.runInContext('main', context);
  let previousHTML;
  let nodes = [];
  const nav = ['system', 'compare', 'assessment', 'route'].map(view => element({'data-view':view}));
  function controls() {
    if (main.innerHTML === previousHTML) return nodes;
    previousHTML = main.innerHTML;
    nodes = [];
    for (const match of (main.innerHTML ?? '').matchAll(/<(select|input|button)\b([^>]*)(?:>([\s\S]*?)<\/\1>|\/?>)/g)) {
      const attributes = attributeMap(match[2]);
      const options = [...(match[3] ?? '').matchAll(/<option\b([^>]*)>/g)].map(item => attributeMap(item[1]));
      const selected = options.find(option => Object.hasOwn(option, 'selected')) ?? options[0];
      nodes.push(element(attributes, selected?.value ?? attributes.value ?? ''));
    }
    const panel = main.innerHTML.match(/<section\b([^>]*id="route-method-inspector"[^>]*)>/);
    if (panel) nodes.push(element(attributeMap(panel[1])));
    for (const node of nodes) {
      node.focus = () => {context.document.activeElement = node;};
      node.closest = selector => selector === '#route-walkthrough' ? routeRoot : node.matches(selector) ? node : null;
    }
    return nodes;
  }
  const routeRoot = {
    addEventListener(type, handler) {(events[type] ??= []).push(handler);},
    querySelectorAll(selector) {return controls().filter(node => node.matches(selector));},
    querySelector(selector) {return this.querySelectorAll(selector)[0] ?? null;},
  };
  context.document.querySelectorAll = selector => selector.startsWith('nav ') ? nav : routeRoot.querySelectorAll(selector);
  context.document.querySelector = selector => selector === '#route-walkthrough' ? routeRoot : routeRoot.querySelector(selector);
  context.document.getElementById = id => id === 'main' ? main : id === 'route-walkthrough' ? routeRoot : controls().find(node => node.id === id) ?? null;
  // Localization itself has separate browser tests; leave route output untouched here.
  context.PrototypeLocale.apply = () => {};
  for (const file of routeAssets.filter(file => file.endsWith('.js'))) {
    vm.runInContext(fs.readFileSync(path.join(prototype, file), 'utf8'), context, {filename:file});
  }
  // The existing fixture loads app.js first; public pages load these modules first.
  // Reproduce the app's public connection step after the modules become available.
  context.RouteView.connect(context.render);
  function dispatch(node, type, extra) {
    const event = node.dispatch(type, extra);
    for (const handler of events[type] ?? []) handler(event);
  }
  return {
    fixture, context,
    render(bodyId = 'R2', lang = 'en') {
      context.inputBody = bodyId; context.inputLang = lang;
      vm.runInContext('Object.assign(state,{view:"route",body:inputBody,lang:inputLang});render()', context);
      return main.innerHTML;
    },
    select(field, value) {
      const control = controls().find(node => node.dataset.routeField === field);
      assert.ok(control, `Rendered route control: ${field}`);
      control.value = value;
      control.checked = value === true;
      dispatch(control, 'change');
      return main.innerHTML;
    },
    inspect(route) {
      const button = controls().find(node => node.dataset.routeInspect === route);
      assert.ok(button, `Method inspection button: ${route}`);
      dispatch(button, 'click');
      return main.innerHTML;
    },
    closeInspector() {dispatch(controls().find(node => node.dataset.routeAction === 'close-inspector'), 'click');},
    key(key) {dispatch(context.document.activeElement, 'keydown', {key});},
    focused() {return context.document.activeElement;},
    tab(view) {dispatch(nav.find(node => node.dataset.view === view), 'click'); return main.innerHTML;},
    state() {return JSON.parse(vm.runInContext('JSON.stringify(state)', context));},
    route(language = 'en', bodyId = 'R2') {return context.RouteView.render(language, bodyId);},
    html() {return main.innerHTML;},
  };
}

test('the Decision tree tab is a separate retained navigation destination', () => {
  const html = read('prototype/index.html');
  const navigation = html.match(/<nav\b[^>]*aria-label="Main views"[^>]*>([\s\S]*?)<\/nav>/)?.[1];
  assert.ok(navigation, 'Main views navigation exists');
  const destinations = [...navigation.matchAll(/data-view="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(destinations, ['system', 'compare', 'assessment', 'route']);
  assert.match(navigation, /data-view="route"[^>]*>Decision tree</);
  const {cleanState} = require('../retained-navigation.js');
  assert.equal(cleanState('view=route&body=W1&method=kazakh').get('view'), 'route');
  const app = browser();
  assert.match(app.tab('route'), /id="route-walkthrough"/);
  assert.equal(app.state().view, 'route');
});

test('existing tabs and their initial navigation remain available', () => {
  const app = browser();
  assert.equal(app.state().view, 'compare');
  for (const view of ['system', 'compare', 'assessment']) {
    const expected = app.fixture.render({view});
    assert.equal(app.tab(view), expected, `${view} retains its existing rendering`);
    assert.doesNotMatch(expected, /id="route-walkthrough"/);
  }
});

test('the route view renders a water-body journey and an explicit output kind', () => {
  const app = browser();
  for (const bodyId of ['R1', 'S1', 'R2', 'C1', 'D1', 'W1']) {
    const html = app.render(bodyId);
    assert.match(html, /id="route-walkthrough"[^>]*data-no-translate|data-no-translate[^>]*id="route-walkthrough"/);
    assert.match(html, new RegExp(bodyId));
    for (const field of ['bodyId', 'category', 'question', 'flowEvidence', 'mode']) assert.match(html, new RegExp(`data-route-field="${field}"`));
    assert.match(plain(html), /pending|candidate|service.only/i);
    assert.doesNotMatch(html, /\bundefined\b|\[object Object\]|\bNaN\b/);
  }
});

test('report-current and hypothetical-workshop modes show their assumptions distinctly', () => {
  const app = browser();
  const current = app.render();
  assert.match(plain(current), /current|report/i);
  assert.match(plain(current), /unavailable|unresolved|pending|not adopted/i);
  assert.doesNotMatch(plain(current), /baseline.{0,60}unfinished|unfinished.{0,60}baseline|daily.mapping.{0,30}unresolved/i);
  const workshop = app.select('mode', 'hypothetical-workshop');
  assert.notEqual(workshop, current);
  assert.match(plain(workshop), /hypothetical|workshop/i);
  assert.match(plain(workshop), /stipulat|assum/i);
  assert.match(plain(workshop), /current|report/i, 'Workshop assumptions retain their report reference');
  assert.equal(app.select('mode', 'report-current'), current);
});

test('specified baseline procedures remain separate from supplied case inputs and hydrological sufficiency', () => {
  const {createInput} = require('../prototype/route-cases.js');
  const {evaluateWalkthrough} = require('../prototype/route-engine.js');
  const dailyInput = createInput({bodyId:'R2', mode:'hypothetical-workshop', flowEvidence:'daily-only'});
  const daily = evaluateWalkthrough(dailyInput);
  assert.equal(daily.attempts.find(item => item.route === 'kazakh-baseline').outcome, 'data-failed');
  assert.equal(daily.attempts.find(item => item.route === 'swiss-entry').outcome, 'eligible');
  assert.equal(daily.selectedRoute, 'swiss-entry');
  const monthlyInput = createInput({bodyId:'R2', mode:'hypothetical-workshop', flowEvidence:'monthly-only'});
  const monthly = evaluateWalkthrough(monthlyInput);
  assert.equal(monthly.attempts.find(item => item.route === 'swiss-entry').outcome, 'data-failed');
  assert.equal(monthly.selectedRoute, 'pending');
  for (const input of [dailyInput, monthlyInput]) {
    assert.equal(input.availability.baseline.specified.state, 'accepted');
    assert.equal(Object.hasOwn(input.gates, 'low-flow-daily-mapping'), false);
    for (const id of ['multi-day-safeguard-configuration', 'swiss-adopted-table']) {
      assert.equal(input.gates[id][0].state, 'accepted');
      assert.equal(input.stipulations.filter(item => item.inputPath === `gates.${id}`).length, 1);
    }
  }
  const currentInput = createInput({bodyId:'R2', mode:'report-current', flowEvidence:'daily-only'});
  const current = evaluateWalkthrough(currentInput);
  assert.equal(currentInput.availability.baseline.specified.state, 'accepted');
  assert.doesNotMatch(currentInput.availability.baseline.specified.reason, /unfinished|unresolved/i);
  assert.equal(currentInput.stipulations.length, 0);
  assert.ok(current.readiness.some(item => item.route === 'kazakh-baseline' && item.procedureSpecified));
  assert.ok(current.readiness.every(item => item.officialIssuance === 'not-established'));
});

test('the workshop route record renders source scope duties monitoring and authority prerequisites', () => {
  const app = browser();
  const text = plain(app.render());
  for (const topic of [/reason|attempt|because/i, /dut(?:y|ies)|obligation/i, /gap|unresolved|pending/i, /monitor/i, /authorit|power/i, /owner|responsib|lead/i, /review/i]) assert.match(text, topic);
  assert.match(text, /technical|referral/i);
  assert.match(text, /not.{0,35}official|official.{0,35}not|workshop.{0,35}only/i);
  assert.match(text, /Water Code|Code authority/i);
  assert.match(text, /7272/);
  assert.match(text, /anticipated|draft|non.binding|not.{0,20}binding/i);
  assert.match(text, /workshop.{0,40}(?:simplification|scope)|simplification.{0,40}workshop/i);
  assert.match(text, /Appendix C/);
  assert.match(text, /annual|annually/i);
  assert.match(text, /three years|3 years/i);
  assert.match(text, /Proposed Uzbek baseline adapted from Kazakhstan/);
  assert.match(text, /multi.day/i);
  assert.match(text, /participant.supplied/i);
  assert.ok(text.includes(reportReference.fileName));
});

test('public controls expose evidence limitations final checks applicability and independent duties', () => {
  const app = browser();
  const html = app.render();
  for (const field of ['priorityBasis', 'finalCheckRoute', 'finalAssessment', 'dutyState', 'legalAuthority',
    'deliveryDutyEvidence', 'floorDutyEvidence', ...components.map(item => `${item}Applicability`)]) {
    assert.match(html, new RegExp(`data-route-field="${field}"`), `${field} is participant-controllable`);
  }
  assert.match(html, /value="indicative-prohibited"/);
  const text = plain(html);
  for (const topic of [/reference member/i, /daily boundar/i, /return period/i, /predecessor/i, /uncertainty/i,
    /fisheries/i, /salt budget/i, /transport model/i, /grouping/i, /feasib/i]) assert.match(text, topic);
});

test('case controls retain explicit permitted uses and participant supplied route-specific checks', () => {
  const {createInput} = require('../prototype/route-cases.js');
  const {evaluateWalkthrough} = require('../prototype/route-engine.js');
  const choices = {bodyId:'R2', mode:'hypothetical-workshop', flowEvidence:'indicative-prohibited'};
  const limited = createInput(choices);
  const indicative = Object.values(limited.gates).flat().filter(gate => gate.state === 'accepted-indicative');
  assert.ok(indicative.length > 0);
  assert.ok(indicative.every(gate => !gate.permittedUses.includes('sizing')));
  assert.notEqual(evaluateWalkthrough(limited).selectedRoute, 'kazakh-baseline');
  const unchanged = createInput({...choices, flowEvidence:'full'});
  const failed = createInput({...choices, flowEvidence:'full', finalCheckRoute:'kazakh-baseline', finalAssessment:'safeguard-fail'});
  for (const [route, checks] of Object.entries(unchanged.finalChecks)) {
    if (route !== 'kazakh-baseline') assert.deepEqual(failed.finalChecks[route], checks, `${route} checks stay independent`);
  }
  assert.equal(failed.finalChecks['kazakh-baseline'].safeguard.state, 'fail');
  assert.equal(failed.finalChecks['kazakh-baseline'].safeguard.basis, 'participant-supplied');
  const result = evaluateWalkthrough(failed);
  assert.notEqual(result.selectedRoute, 'kazakh-baseline');
  assert.ok(result.attempts.some(item => item.route === 'kazakh-baseline' && item.outcome === 'final-check-failed'));
  assert.equal(result.numericalResult, null);
});

test('changing the final-check route retains each route assessment independently', () => {
  const app = browser();
  app.render();
  app.select('mode', 'hypothetical-workshop');
  app.select('flowEvidence', 'full');
  app.select('finalCheckRoute', 'kazakh-baseline');
  const descended = app.select('finalAssessment', 'safeguard-fail');
  assert.match(descended, /<h4>Checks for selected candidate: Q347-derived entry floor<\/h4>/,
    'The completion list identifies the selected entry candidate while the editor still shows the failed baseline');
  app.select('finalCheckRoute', 'swiss-entry');
  const entry = app.select('finalAssessment', 'pass');
  assert.match(entry, /data-route-output="swiss-entry"/, 'An entry assessment does not erase the failed baseline record');
  const returned = app.select('finalCheckRoute', 'kazakh-baseline');
  const assessment = returned.match(/<select data-route-field="finalAssessment">([\s\S]*?)<\/select>/)?.[1];
  assert.ok(assessment);
  assert.match(assessment, /value="safeguard-fail" selected/, 'Returning to the baseline restores its own supplied finding');
  const cleared = app.select('finalAssessment', 'not-assessed');
  assert.match(cleared, /data-route-output="kazakh-baseline"/, 'Only changing the baseline finding makes it eligible again');
});

test('workshop focus cannot erase applicable thermal or unknown component checks', () => {
  const {createInput} = require('../prototype/route-cases.js');
  const {evaluateWalkthrough} = require('../prototype/route-engine.js');
  for (const question of ['seasonal-regime', 'water-quality', 'service-duty']) {
    const input = createInput({bodyId:'R2', question, thermalApplicability:'applicable', thermalEvidence:false});
    const result = evaluateWalkthrough(input);
    assert.equal(input.applicability.thermal, 'applicable');
    const thermal = result.overlays.find(item => item.kind === 'thermal');
    assert.equal(thermal.applicability, 'applicable');
    assert.notEqual(thermal.state, 'inactive');
    for (const component of ['sediment', 'connectivity', 'groundwater']) {
      assert.equal(input.applicability[component], 'unknown');
      assert.equal(result.overlays.find(item => item.kind === component).state, 'unassessed');
    }
  }
});

test('every workshop export source is reproducible and simplifications remain explicit', () => {
  const {createInput} = require('../prototype/route-cases.js');
  const {evaluateWalkthrough} = require('../prototype/route-engine.js');
  for (const bodyId of ['R2', 'S1', 'W1']) {
    const input = createInput({bodyId, mode:'hypothetical-workshop', flowEvidence:'full'});
    const result = evaluateWalkthrough(input);
    assert.deepEqual(input.reportReference, reportReference);
    assert.deepEqual(result.reportReference, reportReference);
    assert.equal(input.reportVersion, reportReference.fileName);
    for (const key of ['monitoring-evidence-tasks', 'route-record-not-passport', 'participant-supplied-checks']) {
      assert.ok(result.simplifications.includes(key));
    }
    if (bodyId === 'S1') assert.ok(result.simplifications.includes('s1-scenario-identity'));
    if (bodyId === 'W1') {
      assert.ok(result.simplifications.includes('w1-receptor-only'));
      assert.equal(result.selectedRoute, 'receptor-assessment');
      assert.equal(result.requirementScope, 'receptor-only');
      assert.ok(result.attempts.every(item => item.route === 'receptor-assessment'));
    }
    assert.ok(input.existingDuties.length > 0, 'Step 3 retains an explicit duty search state');
    assert.ok(input.existingDuties.every(item => item.recordStatus === 'workshop-placeholder' && item.searchDate === null));
  }
});

test('the route view translates its controls and outcomes in every supported locale', () => {
  const app = browser();
  const texts = Object.fromEntries(['en', 'ru', 'uz-Latn'].map(language => [language, plain(app.route(language))]));
  assert.match(texts.ru, /[А-Яа-яЁё]{5}/);
  assert.notEqual(texts.en, texts.ru);
  assert.notEqual(texts.en, texts['uz-Latn']);
  assert.notEqual(texts.ru, texts['uz-Latn']);
  for (const [language, text] of Object.entries(texts)) {
    assert.ok(text.length > 500, `${language} contains the full journey`);
    assert.doesNotMatch(text, /\bundefined\b|\[object Object\]|\bNaN\b/);
  }
});

test('switching tab or locale preserves route inputs and existing tab state independently', () => {
  const app = browser();
  app.fixture.render({view:'compare', method:'kazakh', operation:'irrigation', basis:'fixed', forcing:'dry', month:9, detail:true});
  app.render();
  app.select('mode', 'hypothetical-workshop');
  const before = app.select('flowEvidence', 'daily-only');
  const state = app.state();
  app.tab('compare');
  assert.equal(app.tab('route'), before, 'Returning to the tab restores its input and output');
  const russian = app.route('ru');
  assert.match(russian, /value="daily-only"[^>]*selected|selected[^>]*value="daily-only"/);
  assert.equal(app.route('en'), before);
  assert.deepEqual(app.state(), state, 'Route inputs and language rendering do not mutate existing scenario controls');
});

test('the route tab never changes existing calculation data or numeric results', () => {
  const app = browser();
  const controls = {view:'compare', method:'site', operation:'irrigation', basis:'fixed', forcing:'dry', month:11, detail:true};
  const before = Object.fromEntries(['compare', 'system', 'assessment'].map(view => [view, app.fixture.render({...controls,view})]));
  const data = vm.runInContext('JSON.stringify({policyDatasets,qualityData})', app.context);
  app.render();
  app.select('mode', 'hypothetical-workshop');
  for (const value of ['full', 'indicative', 'daily-only', 'monthly-only', 'none', 'crossed-bounds']) app.select('flowEvidence', value);
  assert.equal(vm.runInContext('JSON.stringify({policyDatasets,qualityData})', app.context), data);
  for (const view of ['compare', 'system', 'assessment']) assert.equal(app.fixture.render({...controls,view}), before[view]);
});

test('related numeric examples are available only for R2 and remain illustration-only', () => {
  const app = browser();
  const options = {mode:'hypothetical-workshop', flowEvidence:'full', category:'Б'};
  for (const bodyId of ['R1','R2','S1','C1','D1','W1']) {
    const input = app.context.RouteCases.createInput({...options,bodyId});
    const result = app.context.RouteEngine.evaluateWalkthrough(input);
    if (bodyId === 'R2') {
      assert.ok(result.relatedExample);
      assert.equal(result.relatedExample.bodyId, 'R2');
      assert.equal(result.relatedExample.purpose, 'illustration-only');
    } else assert.equal(result.relatedExample, null, `${bodyId} must not inherit R2 numerical results`);
    assert.equal(result.numericalResult, null);
    assert.equal(result.officialAssessment, false);
  }
});

test('the publication build includes route assets without reviving retired pages', () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'eflow-route-publication-'));
  const output = path.join(temporary, 'site');
  try {
    execFileSync('python3', ['scripts/build_site.py', '--output', output], {cwd:root, stdio:'pipe'});
    for (const asset of routeAssets) {
      const published = fs.readFileSync(path.join(output, 'prototype', asset));
      assert.deepEqual(published, fs.readFileSync(path.join(prototype, asset)));
      assert.ok(read('prototype/index.html').includes(asset), `${asset} is loaded by the public interface`);
    }
    for (const page of ['learn.html','guided.html','assessment.html']) {
      const html = fs.readFileSync(path.join(output,page),'utf8');
      assert.match(html, /retired/);
      assert.doesNotMatch(html, /<script src=/);
    }
  } finally {
    fs.rmSync(temporary, {recursive:true,force:true});
  }
});
