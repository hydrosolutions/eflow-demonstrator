const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const Engine = require('../prototype/route-engine.js');
const Cases = require('../prototype/route-cases.js');
const Catalog = require('../prototype/route-catalog.js');

// Behavioral acceptance criteria from the shared report and frozen correction contract.
// Inputs are participant assertions: these tests do not calculate or certify an e-flow.
const REPORT = {
  fileName:'report_review_2026-09-20__shared_with_NCECC.docx',
  sha256:'51de55c8473548a536d3fd860948b928183dcdd6470df4721246c0bf1b3bfedc',
  referenceRole:'shared-report-alignment-reference',
};
const checkIds = ['assembly', 'safeguard', 'member-selection', 'cross-class-floor', 'applicable-conditions'];
const languages = ['en', 'ru', 'uz-Latn'];
function input(choices = {}) {
  return Cases.createInput({bodyId:'R2', mode:'hypothetical-workshop', flowEvidence:'full', ...choices});
}
function run(value) {
  assert.deepEqual(Engine.validateWalkthrough(value), [], 'Participant record satisfies the input contract');
  const before = structuredClone(value);
  const result = Engine.evaluateWalkthrough(value);
  assert.deepEqual(value, before, 'Evaluation preserves the supplied evidence record');
  return result;
}
function gate(value, id, state, extra = {}) {
  assert.ok(value.gates[id]?.length, `Factory supplies ${id}`);
  value.gates[id] = value.gates[id].map(record => ({...record, state, ...extra}));
}
function finalChecks(value, route, overrides = {}) {
  value.finalChecks[route] = Object.fromEntries(checkIds.map(id => [id, {
    applicable:!['safeguard', 'member-selection', 'cross-class-floor'].includes(id) || route === 'kazakh-baseline',
    state:'not-assessed', basis:'participant-supplied', sourceIds:['alignment-test-participant-record'],
    reason:`Participant has not assessed ${id} for ${route}.`, ...overrides[id],
  }]));
}
const attempt = (result, route) => result.attempts.find(item => item.route === route);
const overlay = (result, kind) => result.overlays.find(item => item.kind === kind);
function noVerdict(result) {
  assert.equal(result.officialAssessment, false);
  assert.equal(result.numericalResult, null);
  assert.equal(result.ecologicalStatusFinding, null);
  assert.equal(result.legalFaultFinding, null);
  assert.equal(result.enforcement.action, 'technical-record-and-referral-only');
}
function visibleText(choices = {}, language = 'en') {
  const normalized = Cases.normalize({bodyId:'R2', mode:'hypothetical-workshop', ...choices});
  const context = vm.createContext({
    RouteEngine:Engine, RouteCatalog:Catalog,
    RouteCases:{...Cases, defaults:() => ({...normalized})},
  });
  const view = fs.readFileSync(path.join(__dirname, '../prototype/route-view.js'), 'utf8');
  vm.runInContext(view, context, {filename:'route-view.js'});
  return context.RouteView.render(language, normalized.bodyId).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');
}
function assertLocalized(choices, patterns) {
  const texts = languages.map(language => visibleText(choices, language));
  assert.equal(new Set(texts).size, 3, 'Disclosures are translated, not an English fallback');
  for (let index = 0; index < languages.length; index++) {
    for (const pattern of patterns[index]) assert.match(texts[index], pattern, `${languages[index]} disclosure: ${pattern}`);
    assert.doesNotMatch(texts[index], /\bundefined\b|\[object Object\]|\bNaN\b/);
  }
}

test('R1 specified baseline procedures remain distinct from missing case inputs and official issuance', () => {
  for (const mode of ['report-current', 'hypothetical-workshop']) {
    const value = input({mode, flowEvidence:'none'});
    assert.equal(value.availability.baseline.specified.state, 'accepted');
    const result = run(value);
    const baseline = result.readiness.find(item => item.route === 'kazakh-baseline');
    assert.ok(baseline, 'Baseline readiness remains visible even when its inputs are missing');
    assert.equal(baseline.procedureSpecified, true);
    assert.equal(baseline.caseInputsSupplied, false);
    assert.equal(baseline.officialIssuance, 'not-established');
    assert.notEqual(baseline.scientificSupport, 'accepted');
    assert.notEqual(result.selectedRoute, 'kazakh-baseline');
    noVerdict(result);
  }
  const supplied = run(input());
  assert.equal(supplied.selectedRoute, 'kazakh-baseline');
  assert.equal(supplied.readiness.find(item => item.route === 'kazakh-baseline').caseInputsSupplied, true);
  assert.ok(supplied.readiness.every(item => item.officialIssuance === 'not-established'));
});

test('R1 route exports identify the exact shared report and its checksum', () => {
  for (const mode of ['report-current', 'hypothetical-workshop']) {
    const value = input({mode});
    assert.deepEqual(value.reportReference, REPORT);
    assert.equal(value.reportVersion, REPORT.fileName);
    const result = run(value);
    assert.deepEqual(result.reportReference, REPORT);
    assert.equal(result.schemaVersion, 'eflow-route-proposal/2');
    const sources = [...result.attempts.flatMap(item => item.sources),
      ...result.unresolvedNationalRules.map(item => item.source), ...result.stipulations.map(item => item.source)];
    assert.ok(sources.length);
    for (const source of sources) {
      assert.equal(source.artifact, REPORT.fileName);
      assert.ok(source.distinctivePhrase.length > 10);
    }
  }
});

test('R2 a configured multi-day safeguard preserves pass, fail and indeterminate diagnostics', () => {
  for (const [assessment, state] of [['pass', 'pass'], ['safeguard-fail', 'fail'], ['safeguard-indeterminate', 'indeterminate']]) {
    const value = input({finalCheckRoute:'kazakh-baseline', finalAssessment:assessment});
    assert.equal(value.gates['multi-day-safeguard-configuration'][0].state, 'accepted');
    const result = run(value);
    const record = state === 'pass' ? result.completion.checks : attempt(result, 'kazakh-baseline').checks;
    assert.equal(record.find(item => item.id === 'safeguard').state, state);
    assert.ok(record.every(item => item.basis === 'participant-supplied'));
    if (state === 'pass') assert.equal(result.selectedRoute, 'kazakh-baseline');
    else {
      assert.equal(attempt(result, 'kazakh-baseline').outcome, `final-check-${state === 'fail' ? 'failed' : 'indeterminate'}`);
      assert.equal(result.selectedRoute, 'swiss-entry');
    }
    noVerdict(result);
  }
});

test('R2 the safeguard does not require the superseded daily mapping or create a drought exception', () => {
  const value = input();
  assert.ok(!Object.hasOwn(value.gates, 'low-flow-daily-mapping'));
  assert.ok(value.gates['multi-day-safeguard-configuration'].length);
  assert.ok(value.gates['ecological-drought-rule'].length, 'Separate drought evidence remains represented');
  assert.doesNotMatch(JSON.stringify(value), /low-flow-daily-mapping|daily mapping unresolved/);
  const text = visibleText();
  for (const topic of [/multi.day/i, /duration/i, /return period/i, /estimator/i, /coverage/i, /uncertainty/i]) assert.match(text, topic);
  assert.match(text, /no drought exception|does not.{0,45}drought exception|creates no.{0,20}exception/i);
  gate(value, 'multi-day-safeguard-configuration', 'unavailable');
  assert.notEqual(run(value).selectedRoute, 'kazakh-baseline');
});

test('R3 indicative statistics permitted for sizing can support the baseline', () => {
  const value = input({flowEvidence:'indicative'});
  assert.equal(value.gates['annual-exceedance-set'][0].state, 'accepted-indicative');
  assert.ok(value.gates['annual-exceedance-set'][0].permittedUses.includes('sizing'));
  const result = run(value);
  assert.equal(result.selectedRoute, 'kazakh-baseline');
  assert.equal(result.readiness.find(item => item.route === 'kazakh-baseline').scientificSupport, 'not-assessed');
  assert.equal(result.completion.state, 'indeterminate');
  assert.ok(attempt(result, 'kazakh-baseline').reasons.some(reason => reason.startsWith('indicative:')),
    'Indicative sizing support survives without implying a completed scientific assessment');
});

test('R3 indicative statistics prohibited from sizing cannot support that sizing route', () => {
  const restricted = input({flowEvidence:'indicative-prohibited'});
  const indicative = restricted.gates['annual-exceedance-set'].filter(item => item.state === 'accepted-indicative');
  assert.ok(indicative.some(item => !item.permittedUses.includes('sizing')));
  assert.notEqual(run(restricted).selectedRoute, 'kazakh-baseline');
  const explicit = input();
  gate(explicit, 'annual-exceedance-set', 'accepted', {permittedUses:['screening', 'diagnostic'], reason:'Accepted for screening only.'});
  assert.notEqual(run(explicit).selectedRoute, 'kazakh-baseline', 'Even accepted evidence needs sizing permission');
  gate(explicit, 'annual-exceedance-set', 'accepted-indicative', {permittedUses:['sizing'], reason:'Short record; uncertainty retained.'});
  assert.equal(run(explicit).selectedRoute, 'kazakh-baseline', 'No parsing free-text reason or record-length veto');
});

test('R3 a hydrology-wide sizing restriction also prevents entry sizing without independent evidence', () => {
  for (const domesticEvidence of [false, true]) {
    const value = input({flowEvidence:'indicative-prohibited', domesticEvidence});
    for (const id of ['swiss-daily-statistic', ...(domesticEvidence ? ['domestic-statistic'] : [])]) {
      assert.equal(value.gates[id][0].state, 'accepted-indicative', id);
      assert.ok(!value.gates[id][0].permittedUses.includes('sizing'), id);
    }
    assert.equal(run(value).selectedRoute, 'pending', 'Restricted flow evidence cannot be silently replaced by a sizing statistic');
    const independentlySupported = input({flowEvidence:'indicative-prohibited', domesticEvidence, donor:true});
    assert.equal(run(independentlySupported).selectedRoute, 'donor-transfer', 'Independent donor and recipient evidence retains its declared sizing permission');
  }
});

test('R4 candidate route selection stays separate from assembly and final applicable checks', () => {
  const value = input({finalCheckRoute:'kazakh-baseline', finalAssessment:'not-assessed'});
  const candidate = run(value);
  assert.equal(candidate.selectedRoute, 'kazakh-baseline');
  assert.notEqual(candidate.completion.status, 'checks-reported-pass');
  assert.ok(candidate.completion.checks.some(item => item.applicable && item.state === 'not-assessed'));
  const passed = run(input({finalCheckRoute:'kazakh-baseline', finalAssessment:'pass'}));
  assert.equal(passed.completion.status, 'checks-reported-pass');
  assert.equal(passed.completion.basis, 'participant-supplied');
  noVerdict(passed);
  const screening = run(input({finalCheckRoute:'kazakh-baseline', finalAssessment:'single-member-screening'}));
  assert.equal(screening.selectedRoute, 'kazakh-baseline');
  assert.equal(screening.completion.status, 'single-member-screening');
  const member = screening.completion.checks.find(item => item.id === 'member-selection');
  assert.equal(member.state, 'not-assessed');
  assert.equal(member.screeningOnly, true);
});

test('R4 failed or indeterminate completion checks descend to an eligible tier or remain pending', () => {
  for (const state of ['fail', 'indeterminate']) {
    const value = input({donor:true});
    finalChecks(value, 'kazakh-baseline', {assembly:{state}});
    finalChecks(value, 'swiss-entry', {'applicable-conditions':{state}});
    const result = run(value);
    assert.equal(result.selectedRoute, 'donor-transfer');
    for (const route of ['kazakh-baseline', 'swiss-entry']) {
      const rejected = result.attempts.filter(item => item.route === route);
      assert.equal(rejected.length, 1, `${route} must not re-enter after rejection`);
      assert.equal(rejected[0].outcome, `final-check-${state === 'fail' ? 'failed' : 'indeterminate'}`);
      assert.ok(rejected[0].checks.some(item => item.state === state));
    }
    finalChecks(value, 'donor-transfer', {assembly:{state}});
    assert.equal(run(value).selectedRoute, 'pending');
  }
  const scoped = input({bodyId:'C1', habitatEvidence:true, finalCheckRoute:'kazakh-baseline', finalAssessment:'safeguard-fail'});
  assert.equal(run(scoped).selectedRoute, 'potential-habitat', 'Baseline-only failure cannot reject a potential floor');
  const entry = input({flowEvidence:'daily-only', finalCheckRoute:'kazakh-baseline', finalAssessment:'safeguard-fail'});
  assert.equal(run(entry).selectedRoute, 'swiss-entry', 'Baseline-only failure cannot reject observed-statistic entry');
});

test('R4 crossed natural bounds retain the direct fallback route', () => {
  const result = run(input({flowEvidence:'crossed-bounds', donor:true}));
  assert.equal(result.selectedRoute, 'donor-transfer');
  assert.equal(attempt(result, 'kazakh-baseline').outcome, 'infeasible');
  assert.ok(!attempt(result, 'swiss-entry') && !attempt(result, 'domestic-entry'));
  const top = run(input({flowEvidence:'crossed-bounds', habitatEvidence:true, priorityBasis:'scheduled-priority'}));
  assert.equal(top.selectedRoute, 'top', 'Independent habitat component is not capped by baseline natural bounds');
  assert.equal(top.requirementScope, 'habitat-component-only');
  const potential = run(input({bodyId:'C1', flowEvidence:'crossed-bounds', serviceEvidence:true}));
  assert.equal(potential.selectedRoute, 'service-conveyance');
});

test('R4 donor transfer retains recipient member-selection and cross-class checks without a baseline safeguard', () => {
  for (const [finalAssessment, id, outcome] of [
    ['cross-class-fail', 'cross-class-floor', 'final-check-failed'],
    ['member-selection-indeterminate', 'member-selection', 'final-check-indeterminate'],
  ]) {
    const value = input({flowEvidence:'none', donor:true, presumptive:true,
      finalCheckRoute:'donor-transfer', finalAssessment});
    assert.equal(value.finalChecks['donor-transfer'][id].applicable, true);
    assert.equal(value.finalChecks['donor-transfer'].safeguard.applicable, false);
    const result = run(value);
    assert.equal(result.selectedRoute, 'presumptive-floor');
    assert.equal(attempt(result, 'donor-transfer').outcome, outcome);
    assert.ok(attempt(result, 'donor-transfer').checks.some(check => check.id === id && check.applicable));
    noVerdict(result);
  }
  const baselineOnly = input({flowEvidence:'none', donor:true, presumptive:true,
    finalCheckRoute:'donor-transfer', finalAssessment:'safeguard-fail'});
  assert.equal(run(baselineOnly).selectedRoute, 'donor-transfer');
});

test('R5 potential habitat, hydraulic and service routes produce seasonal-floor-only candidates', () => {
  for (const [choices, route, basis] of [
    [{habitatEvidence:true}, 'potential-habitat', 'potential-habitat'],
    [{hydraulicEvidence:true}, 'potential-hydraulics', 'potential-hydraulics'],
    [{serviceEvidence:true}, 'service-conveyance', 'service-conveyance'],
  ]) {
    const result = run(input({bodyId:'C1', ...choices}));
    assert.equal(result.selectedRoute, route);
    assert.equal(result.outputKind, 'seasonal-floor-only-candidate');
    assert.equal(result.outputBasis, basis);
    assert.equal(result.requirementScope, 'floor-only-candidate');
    assert.equal(result.enforcement.derivedDeliveryObligation, 'pending');
    noVerdict(result);
  }
});

test('R5 a potential floor creates no new delivery duty while an independent existing duty remains assessable', () => {
  const value = input({bodyId:'C1', serviceEvidence:true, enforcementEvidence:true,
    legalAuthority:'existing-confirmed', dutyState:'unresolved', deliveryDutyEvidence:false, floorDutyEvidence:false});
  const candidate = run(value);
  assert.equal(candidate.enforcement.deliveryTest, 'no-obligation-from-floor');
  assert.equal(candidate.enforcement.floorConductTest, 'pending', 'Routing does not issue an applicable floor');
  const existing = input({bodyId:'C1', serviceEvidence:true, enforcementEvidence:true,
    legalAuthority:'existing-confirmed', dutyState:'authenticated-applicable'});
  const result = run(existing);
  assert.equal(result.enforcement.deliveryTest, 'prerequisites-listed');
  assert.equal(result.enforcement.derivedDeliveryObligation, 'pending');
  assert.ok(result.retainedDutyIds.length);
});

test('R6 an applicable floor can be assessed without a delivery obligation', () => {
  const value = input({flowEvidence:'daily-only', enforcementEvidence:true, floorDutyEvidence:true,
    deliveryDutyEvidence:false, dutyState:'unresolved', legalAuthority:'existing-confirmed'});
  const result = run(value);
  assert.equal(result.enforcement.floorConductTest, 'prerequisites-listed');
  assert.deepEqual(result.enforcement.floorMissingPrerequisites, []);
  assert.equal(result.enforcement.deliveryTest, 'no-obligation-from-floor');
  assert.ok(!result.enforcement.floorMissingPrerequisites.some(item => item.includes('issued-obligation')));
  for (const id of ['applicable-floor', 'designated-control-points', 'monitoring-evidence-admission',
    'floor-abstraction-and-but-for-evidence', 'causal-attribution-evidence']) {
    const missing = structuredClone(value);
    gate(missing, id, 'unavailable');
    const checked = run(missing);
    assert.equal(checked.enforcement.floorConductTest, 'pending', id);
    assert.ok(checked.enforcement.floorMissingPrerequisites.some(item => item.includes(id)), id);
  }
});

test('R6 regime routes retain a separate floor test and delivery duties require independent evidence', () => {
  const value = input({enforcementEvidence:true, floorDutyEvidence:true, deliveryDutyEvidence:true,
    dutyState:'unresolved', legalAuthority:'existing-confirmed'});
  const result = run(value);
  assert.equal(result.selectedRoute, 'kazakh-baseline');
  assert.equal(result.enforcement.deliveryTest, 'prerequisites-listed');
  assert.equal(result.enforcement.floorConductTest, 'prerequisites-listed');
  gate(value, 'issued-obligation', 'unavailable');
  const noDelivery = run(value);
  assert.equal(noDelivery.enforcement.deliveryTest, 'pending');
  assert.equal(noDelivery.enforcement.floorConductTest, 'prerequisites-listed');
  const noSizing = input({flowEvidence:'none', enforcementEvidence:true, floorDutyEvidence:true,
    deliveryDutyEvidence:true, legalAuthority:'existing-confirmed'});
  const pending = run(noSizing);
  assert.equal(pending.selectedRoute, 'pending');
  assert.equal(pending.enforcement.deliveryTest, 'prerequisites-listed');
  assert.equal(pending.enforcement.floorConductTest, 'prerequisites-listed');
});

test('R6 neither operational test supplies an automatic legal-fault finding', () => {
  for (const legalAuthority of ['existing-confirmed', 'applicability-unresolved', 'additional-power-needed']) {
    const result = run(input({enforcementEvidence:true, floorDutyEvidence:true, deliveryDutyEvidence:true, legalAuthority}));
    noVerdict(result);
  }
});

test('R7 W1 without a supported named carrier remains a receptor requirement that is unsized', () => {
  const result = run(input({bodyId:'W1', donor:true, presumptive:true}));
  assert.equal(result.selectedRoute, 'receptor-assessment');
  assert.equal(result.requirementScope, 'receptor-only');
  assert.equal(result.outputBasis, 'receptor-state');
  assert.equal(overlay(result, 'receptor').state, 'unsized');
  assert.ok(!result.attempts.some(item => ['kazakh-baseline', 'swiss-entry', 'domestic-entry', 'donor-transfer'].includes(item.route)));
  assert.ok(result.simplifications.includes('w1-receptor-only'));
  noVerdict(result);
});

test('R7 a supported receptor pathway identifies its carrier and keeps carrier and receptor findings separate', () => {
  const value = input({bodyId:'W1', receptorEvidence:true, receptorApplicability:'applicable'});
  gate(value, 'receptor-targets-pathways-and-sizing', 'accepted', {
    reason:'R2 is the named supporting river carrier; accepted targets, physical pathway and controllable schedule supplied.',
    sourceIds:['W1-receptor-targets', 'R2-to-W1-supported-pathway'],
  });
  const result = run(value);
  assert.equal(result.selectedRoute, 'receptor-assessment');
  assert.equal(overlay(result, 'receptor').state, 'assessment-supported');
  assert.equal(result.requirementScope, 'receptor-only');
  assert.ok(!result.attempts.some(item => item.route === 'kazakh-baseline'));
  assert.deepEqual(value.gates['receptor-targets-pathways-and-sizing'][0].sourceIds,
    ['W1-receptor-targets', 'R2-to-W1-supported-pathway']);
  assert.match(visibleText({bodyId:'W1', receptorEvidence:true}), /carrier.{0,100}separat|separat.{0,100}carrier/i);
  noVerdict(result);
});

test('R8 applicable quality and thermal components remain visible under another workshop focus', () => {
  const value = input({question:'seasonal-regime', qualityApplicability:'applicable', thermalApplicability:'applicable'});
  const original = run(value);
  for (const kind of ['quality', 'thermal']) {
    assert.equal(overlay(original, kind).applicability, 'applicable');
    assert.notEqual(overlay(original, kind).state, 'inactive');
    assert.ok(overlay(original, kind).actions.length);
    assert.match(JSON.stringify(original.monitoring), kind === 'quality' ? /quality|chemistry/ : /temperature|thermal/);
  }
  value.questions = ['habitat'];
  const changed = run(value);
  assert.deepEqual(changed.overlays, original.overlays, 'Workshop focus does not change assessment applicability');
});

test('R8 unassessed sediment, connectivity and groundwater needs remain explicit when applicable', () => {
  for (const applicability of ['applicable', 'unknown', 'not-applicable']) {
    const result = run(input({sedimentApplicability:applicability,
      connectivityApplicability:applicability, groundwaterApplicability:applicability}));
    for (const kind of ['sediment', 'connectivity', 'groundwater']) {
      const component = overlay(result, kind);
      assert.equal(component.applicability, applicability);
      assert.equal(component.state, applicability === 'not-applicable' ? 'inactive' : 'unassessed');
      if (applicability !== 'not-applicable') assert.ok(component.actions.length);
    }
  }
});

test('R8 quality activation discloses five conditions and feasibility checks while thermal logging starts before calculation', () => {
  const value = input({category:'Б', qualityEvidence:true, qualityApplicability:'applicable', thermalApplicability:'applicable'});
  const fiveConditions = ['quality-feasibility-screen', 'quality-fisheries-limits', 'quality-grouping-approved',
    'quality-basin-salt-budget', 'quality-transport-model-approved'];
  for (const id of fiveConditions) assert.ok(value.gates[id]?.length, id);
  const qualified = run(value);
  for (const id of fiveConditions) {
    const missing = structuredClone(value);
    gate(missing, id, 'unavailable');
    assert.notEqual(overlay(run(missing), 'quality').state, 'assessment-supported', id);
  }
  assert.match(JSON.stringify(qualified.monitoring), /outlet|temperature/);
  assert.notEqual(overlay(qualified, 'thermal').state, 'assessment-supported');
  const text = visibleText({qualityApplicability:'applicable', thermalApplicability:'applicable'});
  for (const topic of [/fisher/i, /group/i, /salt/i, /transport/i, /feasib/i,
    /source.{0,40}(?:first|control)/i, /same.section|same section/i, /upper/i, /lower/i, /outlet/i]) assert.match(text, topic);
});

test('R9 existing powers retain verified applicability, unresolved applicability and proposed-power distinctions', () => {
  const records = ['existing-confirmed', 'applicability-unresolved', 'additional-power-needed'].map(legalAuthority => {
    const value = input({mode:'report-current', legalAuthority, enforcementEvidence:true,
      floorDutyEvidence:true, deliveryDutyEvidence:true});
    const result = run(value);
    noVerdict(result);
    return {value, result};
  });
  assert.equal(records[0].value.gates['legal-powers'][0].state, 'accepted');
  for (const {value} of records.slice(1)) assert.notEqual(value.gates['legal-powers'][0].state, 'accepted');
  assert.notDeepEqual(records[1].value.gates['legal-powers'], records[2].value.gates['legal-powers']);
  assert.ok(!records[0].result.unresolvedNationalRules.some(item => /legal-powers/.test(item.reason)),
    'Current-report mode does not deny verified existing powers');
});

test('R9 authenticated, inapplicable, unresolved and dated no-duty search outcomes remain distinct', () => {
  const states = ['authenticated-applicable', 'located-not-applicable', 'unresolved', 'none-located'];
  const followUps = [];
  for (const state of states) {
    const value = input({dutyState:state});
    const duty = value.existingDuties.find(item => item.state === state);
    assert.ok(duty, state);
    assert.equal(duty.recordStatus, 'workshop-placeholder');
    assert.equal(duty.searchDate, null, 'No search date invented for a workshop choice');
    const result = run(value);
    assert.deepEqual(result.dutyRecords, value.existingDuties);
    assert.equal(result.retainedDutyIds.includes(duty.id), state === 'authenticated-applicable');
    assert.ok(duty.followUp.description && duty.followUp.ownerRole && duty.followUp.reviewTrigger);
    followUps.push(duty.followUp.description);
  }
  assert.equal(new Set(followUps).size, 4, 'Four search outcomes have distinct follow-up');
  const documented = input({dutyState:'none-located'});
  Object.assign(documented.existingDuties[0], {recordStatus:'documented-record', searchDate:'2026-09-20'});
  const result = run(documented);
  assert.equal(result.dutyRecords[0].searchDate, '2026-09-20');
  assert.equal(result.dutyRecords[0].state, 'none-located');
  assert.equal(result.retainedDutyIds.length, 0);
});

test('S1 every locale labels the top-tier result as a habitat-component illustration', () => {
  const choices = {priorityBasis:'scheduled-priority', habitatEvidence:true};
  const result = run(input(choices));
  assert.equal(result.selectedRoute, 'top');
  assert.equal(result.requirementScope, 'habitat-component-only');
  assert.ok(result.simplifications.includes('top-component-only'));
  assertLocalized(choices, [
    [/habitat/i, /component/i, /complete|full/i, /not represented|not modelled|not modeled/i],
    [/местообитан/i, /компонент/i, /полн/i, /не представлен|не моделир/i],
    [/yashash muhiti/i, /komponent/i, /to[‘’']liq/i, /aks ettirilma|ifodalanma|ko[‘’']rsatilma|modellashtirilma/i],
  ]);
});

test('S2 every locale distinguishes evidence tasks from a commissioned monitoring programme and priority from ecological trigger', () => {
  const scheduled = input({priorityBasis:'scheduled-priority'});
  const triggered = input({priorityBasis:'ecological-trigger'});
  assert.equal(scheduled.priorityBasis, 'scheduled-priority');
  assert.equal(triggered.priorityBasis, 'ecological-trigger');
  assert.ok(run(scheduled).simplifications.includes('monitoring-evidence-tasks'));
  assertLocalized({}, [
    [/evidence tasks/i, /commission/i, /scheduled/i, /ecological trigger/i],
    [/задач/i, /данн|доказательств/i, /программ/i, /планов/i, /экологическ/i],
    [/dalil/i, /vazifa/i, /dastur/i, /rejalashtirilgan/i, /ekologik/i],
  ]);
});

test('S2 habitat and hydraulic readiness disclose target selection, valid range, seasons, ramping and uncertainty', () => {
  const text = visibleText({habitatEvidence:true, hydraulicEvidence:true});
  for (const topic of [/target/i, /curve.point|curve point/i, /valid.{0,20}range/i,
    /season/i, /ramping|ramp rate/i, /uncertainty/i]) assert.match(text, topic);
});

test('S3 every locale labels the export as a workshop route record and discloses the report review cadence', () => {
  assert.ok(run(input()).simplifications.includes('route-record-not-passport'));
  assertLocalized({}, [
    [/workshop route record/i, /Appendix C/i, /annual/i, /within.{0,15}year|during.{0,15}year/i, /three years|3 years/i],
    [/запис|маршрут/i, /семинар/i, /ежегод/i, /в течение года|внутри года/i, /тр[её]х лет|три года|3 год/i],
    [/seminar/i, /qayd/i, /yillik|har yili/i, /yil davomida|yil ichida/i, /uch yil|3 yil/i],
  ]);
});

test('S4 every locale discloses the S1 scenario difference without changing its inherited identity', () => {
  const value = input({bodyId:'S1'});
  assert.equal(value.body.origin, 'natural');
  assert.equal(value.body.designation, 'pending');
  assert.ok(run(value).simplifications.includes('s1-scenario-identity'));
  assertLocalized({bodyId:'S1'}, [
    [/S1/, /modified natural/i, /constructed|artificial/i, /different/i],
    [/S1/, /естествен/i, /искусствен|построенн/i, /друг|отлич/i],
    [/S1/, /tabiiy/i, /sun[‘’']iy|qurilgan/i, /boshqa|farq/i],
  ]);
});

test('S5 every locale names the proposed Uzbek baseline adapted from Kazakhstan', () => {
  assertLocalized({}, [
    [/Proposed Uzbek baseline adapted from Kazakhstan/i],
    [/предлагаем/i, /узбек|Узбекистан/i, /Казахстан/i, /адапт/i],
    [/taklif/i, /o[‘’']zbek/i, /Qozog[‘’']iston/i, /moslashtir/i],
  ]);
});
