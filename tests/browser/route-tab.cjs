'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {chromium} = require('playwright');

const base = process.env.EFLOW_BASE_URL || 'http://127.0.0.1:8769';
const initial = new URL('prototype/', base.endsWith('/') ? base : `${base}/`);
initial.search = new URLSearchParams({
  lang:'en', view:'compare', body:'R2', method:'kazakh', operation:'irrigation',
  basis:'fixed', forcing:'dry', month:'9', detail:'open', landscape:'network', layer:'inputs'
}).toString();

// Browser acceptance: retained calculations, independent route decisions, translated
// controls, usable narrow layouts, keyboard continuity and a reproducible export.
test('the corrected decision tab works without changing the three existing views', {timeout:180000}, async t => {
  const browser = await chromium.launch({
    headless:true,
    ...(process.env.CHROMIUM_EXECUTABLE ? {executablePath:process.env.CHROMIUM_EXECUTABLE} : {})
  });
  t.after(() => browser.close());
  const context = await browser.newContext({viewport:{width:1440, height:1000}, acceptDownloads:true});
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => {if (message.type() === 'error') errors.push(message.text());});
  // The demonstrator has no favicon; avoid testing the browser's incidental request.
  await page.route('**/favicon.ico', route => route.fulfill({status:204, body:''}));
  const routeRoot = page.locator('#route-walkthrough');
  const field = name => routeRoot.locator(`[data-route-field="${name}"]`);
  // Open only the disclosure ancestors needed for a control, using the public UI.
  const reveal = async control => {
    const closed = await control.evaluate(node => {
      const ancestors = [];
      for (let parent = node.parentElement; parent; parent = parent.parentElement) {
        if (parent.matches('details:not([open])')) ancestors.unshift(parent.dataset.routeDetails);
      }
      return ancestors;
    });
    for (const key of closed) await routeRoot.locator(`details[data-route-details="${key}"] > summary`).click();
  };
  const choose = async (name, value) => {
    await reveal(field(name));
    await field(name).selectOption(value);
  };
  const check = async (name, value) => {
    await reveal(field(name));
    await field(name).setChecked(value);
  };
  const tab = async view => {
    const control = page.locator(`nav [data-view="${view}"]`);
    await control.click();
    assert.equal(await control.getAttribute('aria-current'), 'page', `${view} is active`);
  };
  const retainedState = () => {
    const parameters = new URL(page.url()).searchParams;
    parameters.delete('view');
    return Object.fromEntries(parameters);
  };
  const cleanText = async () => {
    const text = await routeRoot.innerText();
    assert.ok(text.length > 500, 'A complete route journey is visible');
    assert.doesNotMatch(text, /\bundefined\b|\bNaN\b|\[object Object\]/);
    return text;
  };
  const passport = async () => {
    const button = routeRoot.locator('[data-route-action="export"]');
    assert.equal(await button.count(), 1, 'The workshop route-record export is available');
    const downloaded = page.waitForEvent('download');
    await button.click();
    const download = await downloaded;
    assert.equal(await download.failure(), null, 'Passport download succeeds');
    const stream = await download.createReadStream();
    assert.ok(stream, 'Passport can be read');
    const chunks = [];
    for await (const chunk of stream) chunks.push(chunk);
    const data = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    assert.ok(data.input && data.result, 'Export contains both inputs and result');
    assert.equal(data.result.bodyId, data.input.body.id, 'Export identifies the selected water body');
    assert.equal(data.result.mode, data.input.mode, 'Export identifies the selected assumptions');
    const reference = {
      fileName:'report_review_2026-09-20__shared_with_NCECC.docx',
      sha256:'51de55c8473548a536d3fd860948b928183dcdd6470df4721246c0bf1b3bfedc',
      referenceRole:'shared-report-alignment-reference'
    };
    assert.deepEqual(data.input.reportReference, reference);
    assert.deepEqual(data.result.reportReference, reference);
    assert.equal(data.input.reportVersion, reference.fileName);
    assert.equal(data.input.schemaVersion, 'eflow-route-proposal/2');
    assert.equal(data.result.schemaVersion, 'eflow-route-proposal/2');
    assert.equal(data.result.numericalResult, null);
    assert.equal(data.result.officialAssessment, false);
    for (const simplification of ['route-record-not-passport', 'monitoring-evidence-tasks', 'participant-supplied-checks']) {
      assert.ok(data.result.simplifications.includes(simplification), `${simplification} remains in the export`);
    }
    assert.ok(data.result.readiness.every(item => item.officialIssuance === 'not-established'));
    return data;
  };

  await page.goto(initial.href, {waitUntil:'networkidle'});
  await page.locator('[data-method="kazakh"]').waitFor();
  assert.deepEqual(await page.locator('nav [data-view]').evaluateAll(nodes => nodes.map(node => node.dataset.view)),
    ['system', 'compare', 'assessment', 'route']);
  const baselineState = retainedState();
  const previousViews = {};
  for (const view of ['system', 'compare', 'assessment']) {
    await tab(view);
    previousViews[view] = await page.locator('#main').innerText();
    assert.ok(previousViews[view].length > 200, `${view} renders its existing content`);
    assert.equal(await routeRoot.count(), 0, `${view} remains separate from the decision tab`);
  }

  await tab('route');
  await routeRoot.waitFor();
  assert.equal(await field('mode').inputValue(), 'report-current');
  assert.equal(await field('bodyId').inputValue(), 'R2');
  assert.match(await cleanText(), /candidate|pending|unresolved|not adopted/i);
  const current = await passport();
  assert.equal(await routeRoot.locator('[data-route-output]').getAttribute('data-route-output'), current.result.selectedRoute);
  assert.equal(current.input.availability.baseline.specified.state, 'accepted');
  assert.ok(current.result.readiness.some(item => item.route === 'kazakh-baseline' && item.procedureSpecified));
  assert.equal(Object.hasOwn(current.input.gates, 'low-flow-daily-mapping'), false);
  assert.doesNotMatch(await cleanText(), /baseline.{0,60}unfinished|unfinished.{0,60}baseline|daily.mapping.{0,30}unresolved/i);

  const inspect = route => routeRoot.locator(`[data-route-inspect="${route}"]`);
  const inspector = routeRoot.locator('[data-route-inspector]');
  await inspect('kazakh-baseline').click();
  assert.equal(await inspector.getAttribute('data-route-inspector'), 'kazakh-baseline');
  assert.equal(await inspector.getAttribute('data-route-inspection-disposition'), 'selected');
  assert.match(await inspector.innerText(), /R2/);
  assert.match(await inspector.innerText(), /natural.*reconstruction/i);
  await inspect('swiss-entry').focus();
  await page.keyboard.press('Enter');
  assert.equal(await inspector.getAttribute('data-route-inspector'), 'swiss-entry');
  assert.equal(await inspector.getAttribute('data-route-inspection-disposition'), 'not-reached');
  assert.match(await inspector.innerText(), /national Q347 conversion table/i);
  assert.deepEqual(await passport(), current, 'Inspecting another method changes neither inputs nor results');
  await page.keyboard.press('Escape');
  assert.equal(await inspector.count(), 0);
  assert.equal(await page.locator(':focus').getAttribute('data-route-inspect'), 'swiss-entry');
  await page.keyboard.press('Space');
  assert.equal(await inspector.getAttribute('data-route-inspector'), 'swiss-entry');

  await field('mode').selectOption('hypothetical-workshop');
  await field('flowEvidence').selectOption('daily-only');
  assert.equal(await inspector.getAttribute('data-route-inspection-disposition'), 'selected',
    'The open inspector refreshes after evidence changes');
  assert.equal(await routeRoot.locator('[data-route-output]').getAttribute('data-route-output'), 'swiss-entry');
  assert.match(await cleanText(), /Swiss|Q347/i);
  const daily = await passport();
  assert.equal(daily.result.selectedRoute, 'swiss-entry', 'Daily evidence unlocks the hypothetical entry floor');
  assert.equal(daily.result.officialAssessment, false);
  await field('flowEvidence').selectOption('monthly-only');
  assert.equal(await inspector.getAttribute('data-route-inspection-disposition'), 'skipped');
  assert.match(await inspector.innerText(), /daily low.flow/i);
  assert.equal(await routeRoot.locator('[data-route-output]').getAttribute('data-route-output'), 'pending');
  assert.match(await cleanText(), /pending/i);
  const monthly = await passport();
  assert.equal(monthly.result.selectedRoute, 'pending', 'Monthly evidence does not supply daily low flows');

  await choose('flowEvidence', 'full');
  // Keep the disclosure open across consecutive changes without the reveal helper
  // reopening it: asynchronous toggle events must not erase the live open state.
  await reveal(field('finalCheckRoute'));
  await field('finalCheckRoute').selectOption('kazakh-baseline');
  assert.equal(await field('finalAssessment').isVisible(), true,
    'Changing the final-check route keeps its disclosure open');
  await field('finalAssessment').selectOption('safeguard-fail');
  assert.equal(await field('finalCheckRoute').isVisible(), true,
    'Changing the supplied outcome keeps its disclosure open');
  const finalFailure = await passport();
  assert.equal(finalFailure.input.finalChecks['kazakh-baseline'].safeguard.state, 'fail');
  assert.equal(finalFailure.input.finalChecks['kazakh-baseline'].safeguard.basis, 'participant-supplied');
  assert.notEqual(finalFailure.result.selectedRoute, 'kazakh-baseline', 'Supplied final failure descends from the baseline');
  assert.ok(finalFailure.result.attempts.some(item => item.route === 'kazakh-baseline' && item.outcome === 'final-check-failed'));
  assert.match(await cleanText(), /participant.supplied/i);
  await choose('finalAssessment', 'not-assessed');
  await choose('thermalApplicability', 'applicable');
  await choose('question', 'water-quality');
  const focused = await passport();
  assert.equal(focused.input.questions[0], 'water-quality');
  const thermal = focused.result.overlays.find(item => item.kind === 'thermal');
  assert.equal(thermal.applicability, 'applicable');
  assert.notEqual(thermal.state, 'inactive', 'Workshop focus does not remove a separate applicable component');

  // Listed prerequisites are independent of a supplied delivery duty or floor.
  await check('enforcementEvidence', true);
  await choose('legalAuthority', 'existing-confirmed');
  await choose('dutyState', 'unresolved');
  await check('deliveryDutyEvidence', false);
  await check('floorDutyEvidence', true);
  const floorOnly = await passport();
  assert.equal(floorOnly.result.enforcement.floorConductTest, 'prerequisites-listed');
  assert.notEqual(floorOnly.result.enforcement.deliveryTest, 'prerequisites-listed');
  assert.ok(floorOnly.result.enforcement.deliveryMissingPrerequisites.length > 0);
  assert.deepEqual(floorOnly.result.enforcement.floorMissingPrerequisites, []);
  await check('floorDutyEvidence', false);
  await check('deliveryDutyEvidence', true);
  const deliveryOnly = await passport();
  assert.equal(deliveryOnly.result.enforcement.deliveryTest, 'prerequisites-listed');
  assert.equal(deliveryOnly.result.enforcement.floorConductTest, 'pending');
  assert.deepEqual(deliveryOnly.result.enforcement.deliveryMissingPrerequisites, []);
  assert.ok(deliveryOnly.result.enforcement.floorMissingPrerequisites.length > 0);
  await check('enforcementEvidence', false);
  await check('deliveryDutyEvidence', false);

  await field('bodyId').selectOption('C1');
  assert.equal(await inspector.count(), 0, 'Changing the water body clears the inspected method');
  assert.equal(new URL(page.url()).searchParams.get('body'), 'R2', 'Route water-body selection leaves the existing selection intact');
  await field('flowEvidence').selectOption('daily-only');
  const beforeReturn = await routeRoot.innerText();
  for (const view of ['system', 'compare', 'assessment']) {
    await tab(view);
    assert.equal(await page.locator('#main').innerText(), previousViews[view], `${view} results and explanations are unchanged`);
    assert.deepEqual(retainedState(), baselineState, `${view} retains the original controls`);
  }
  await tab('route');
  assert.equal(await field('bodyId').inputValue(), 'C1');
  assert.equal(await field('flowEvidence').inputValue(), 'daily-only');
  assert.equal(await routeRoot.innerText(), beforeReturn, 'Route inputs and output survive visiting the existing tabs');

  await field('bodyId').selectOption('W1');
  assert.match(await cleanText(), /wetland/i);
  assert.match(await cleanText(), /unsized|pending|unknown|unresolved/i);
  const wetland = await passport();
  assert.equal(wetland.input.body.origin, 'natural');
  assert.equal(wetland.result.selectedRoute, 'receptor-assessment');
  assert.equal(wetland.result.requirementScope, 'receptor-only');
  assert.ok(wetland.result.attempts.every(item => item.route === 'receptor-assessment'));
  assert.ok(wetland.result.simplifications.includes('w1-receptor-only'));
  assert.equal(wetland.result.numericalResult, null, 'The wetland receives no invented flow calculation');
  assert.equal(wetland.result.overlays.find(overlay => overlay.kind === 'receptor').state, 'unsized');

  // Exercise each public option separately; restore it before moving to another field.
  const controls = await routeRoot.locator('[data-route-field]').evaluateAll(nodes => nodes.map(node => ({
    name:node.dataset.routeField, tag:node.tagName, type:node.type,
    value:node.value, checked:node.checked,
    options:node.tagName === 'SELECT' ? Array.from(node.options, option => option.value) : []
  })));
  for (const control of controls) {
    if (control.tag === 'SELECT') {
      for (const value of control.options) {
        await choose(control.name, value);
        await cleanText();
      }
      await choose(control.name, control.value);
    } else if (control.type === 'checkbox') {
      await check(control.name, !control.checked);
      await cleanText();
      await check(control.name, control.checked);
    }
  }

  await field('flowEvidence').focus();
  await page.keyboard.press('Home');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  assert.equal(await page.locator(':focus').getAttribute('data-route-field'), 'flowEvidence',
    'Updating a route field by keyboard retains focus on that field');
  await field('bodyId').selectOption('R2');
  await field('mode').selectOption('hypothetical-workshop');
  await field('flowEvidence').selectOption('daily-only');

  await inspect('swiss-entry').click();
  await routeRoot.locator('[data-route-action="close-inspector"]').click();
  assert.equal(await inspector.count(), 0);
  assert.equal(await page.locator(':focus').getAttribute('data-route-inspect'), 'swiss-entry');
  await page.keyboard.press('Enter');
  const translated = {};
  for (const language of ['en', 'ru', 'uz-Latn']) {
    await page.locator('#language').selectOption(language);
    assert.equal(await page.locator('html').getAttribute('lang'), language);
    translated[language] = await cleanText();
    assert.ok(translated[language].includes('report_review_2026-09-20__shared_with_NCECC.docx'));
    assert.equal(await field('bodyId').inputValue(), 'R2');
    assert.equal(await field('flowEvidence').inputValue(), 'daily-only');
    assert.equal(await inspector.getAttribute('data-route-inspector'), 'swiss-entry',
      'Language changes preserve inspection of the same method');
    assert.equal(await inspector.getAttribute('data-route-inspection-disposition'), 'selected');
    for (const width of [390, 1440]) {
      await page.setViewportSize({width, height:1000});
      const dimensions = await page.evaluate(() => ({
        width:document.documentElement.clientWidth,
        content:Math.max(document.documentElement.scrollWidth, document.body.scrollWidth)
      }));
      assert.ok(dimensions.content <= dimensions.width + 1,
        `${language} at ${width}px has no horizontal page overflow (${dimensions.content}px)`);
    }
  }
  assert.match(translated.ru, /[А-Яа-яЁё]{5}/);
  assert.notEqual(translated.en, translated.ru);
  assert.notEqual(translated.en, translated['uz-Latn']);
  assert.notEqual(translated.ru, translated['uz-Latn']);
  assert.match(translated.en, /Proposed Uzbek baseline adapted from Kazakhstan/);
  assert.match(translated.en, /workshop.{0,40}(?:simplification|scope)|simplification.{0,40}workshop/i);
  for (const language of ['ru', 'uz-Latn']) {
    assert.doesNotMatch(translated[language], /Proposed Uzbek baseline adapted from Kazakhstan|participant-supplied checks|workshop simplifications/i,
      'The new scope and supplied-check labels are translated');
  }
  await page.waitForLoadState('networkidle');
  assert.deepEqual(errors, [], 'All routes and controls run without browser or console errors');
});
