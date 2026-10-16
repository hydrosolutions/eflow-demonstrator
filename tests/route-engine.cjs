const test = require('node:test');
const assert = require('node:assert/strict');
const { validateWalkthrough, evaluateWalkthrough, inspectRoute } = require('../prototype/route-engine.js');
const F = require('./route-fixtures.cjs');

// Public routing contract tests; no hydrological values or legal verdicts are calculated.
function run(input) {
  assert.deepEqual(validateWalkthrough(input), [], 'Complete scenario satisfies the input contract');
  const result = evaluateWalkthrough(input);
  assert.equal(result.bodyId, input.body.id);
  assert.equal(result.mode, input.mode);
  assert.equal(result.schemaVersion, input.schemaVersion);
  assert.deepEqual(result.reportReference, F.REPORT_REFERENCE);
  for (const attempt of result.attempts) assert.ok(attempt.reasons.length, `${attempt.route} needs a reason`);
  return result;
}
const attempt = (result, route) => result.attempts.find(item => item.route === route);
const overlay = (result, kind) => result.overlays.find(item => item.kind === kind);
function noVerdict(result) {
  assert.equal(result.officialAssessment, false);
  assert.equal(result.ecologicalStatusFinding, null);
  assert.equal(result.legalFaultFinding, null);
  assert.equal(result.numericalResult, null);
  assert.equal(result.enforcement.action, 'technical-record-and-referral-only');
}

test('natural irrigation use retains the natural-status track', () => {
  const result = run(F.hypothetical());
  assert.equal(result.track, 'natural-status');
  assert.equal(result.objective, 'ecological-status');
  assert.equal(result.selectedRoute, 'kazakh-baseline');
  assert.equal(result.selectedTier, 'baseline');
  assert.equal(result.outputKind, 'regime-candidate');
});

test('unknown origin or unresolved designation leaves tier selection pending', () => {
  for (const [origin, designation] of [['unknown', 'none'], ['natural', 'not-searched'], ['natural', 'pending']]) {
    const input = F.hypothetical();
    Object.assign(input.body, { origin, designation });
    const result = run(input);
    assert.equal(result.track, 'undetermined');
    assert.equal(result.selectedRoute, 'pending');
    assert.equal(result.selectedTier, null);
  }
  const designated = F.hypothetical();
  designated.body.designation = 'designated';
  designated.body.designationEvidenceAndSafeguards = F.gate();
  F.setGate(designated, 'potential-habitat-route');
  assert.equal(run(designated).track, 'ecological-potential');
  designated.body.designationEvidenceAndSafeguards = F.gate('accepted-indicative', 'Safeguards only indicative');
  assert.equal(run(designated).selectedRoute, 'pending');
});

test('accepted indicative baseline evidence passes with uncertainty disclosed', () => {
  const input = F.hypothetical();
  input.gates['annual-exceedance-set'] = [
    { ...F.gate('accepted-indicative', 'Short indicative record with uncertainty'), season: 'summer', estimator: 'analogue' },
    { ...F.gate(), season: 'winter', estimator: 'model' },
  ];
  const result = run(input);
  assert.equal(result.selectedRoute, 'kazakh-baseline');
  assert.match(JSON.stringify(result), /indicative|uncertain/i);
  input.gates['annual-exceedance-set'][1] = F.gate('not-accepted', 'Winter statistic invalid');
  assert.notEqual(run(input).selectedRoute, 'kazakh-baseline');
});

test('missing a local gauge alone does not disqualify reconstructed baseline evidence', () => {
  const input = F.hypothetical();
  F.setGate(input, 'natural-reconstruction', 'accepted-indicative', 'No local gauge; qualified analogue and water balance reconstruction accepted');
  assert.equal(run(input).selectedRoute, 'kazakh-baseline');
});

test('top requires priority or a trigger as well as applicable habitat evidence', () => {
  const input = F.hypothetical();
  input.priorityBasis = 'scheduled-priority';
  F.setGate(input, 'top-priority-or-trigger');
  F.setGate(input, 'habitat-hydraulics');
  const result = run(input);
  assert.equal(result.selectedRoute, 'top');
  assert.equal(result.selectedTier, 'top');
  assert.equal(result.outputKind, 'habitat-element-candidate');
});

test('a habitat question alone does not select the top tier', () => {
  const input = F.hypothetical();
  input.questions = ['habitat'];
  F.setGate(input, 'habitat-hydraulics');
  const result = run(input);
  assert.equal(result.selectedRoute, 'kazakh-baseline');
  assert.equal(attempt(result, 'top').outcome, 'not-selected-for-top');
});

test('failed top evidence records descent to the highest eligible available tier', () => {
  const input = F.hypothetical();
  input.priorityBasis = 'ecological-trigger';
  F.setGate(input, 'top-priority-or-trigger');
  F.setGate(input, 'habitat-hydraulics', 'not-accepted', 'Habitat curve fails applicability check');
  const result = run(input);
  assert.equal(result.selectedRoute, 'kazakh-baseline');
  assert.equal(attempt(result, 'top').outcome, 'data-failed');
});

test('data support is reported separately from method availability', () => {
  const input = F.swiss();
  F.setGate(input, 'annual-exceedance-set');
  input.availability.baseline.resourced = F.gate('unavailable', 'Assessment staff unavailable');
  const result = run(input);
  assert.equal(result.dataSupportedTierIgnoringAvailability, 'baseline');
  assert.equal(result.selectedRoute, 'swiss-entry');
  assert.equal(attempt(result, 'kazakh-baseline').outcome, 'unavailable');
});

test('missing current case inputs leave the route pending while existing duties survive', () => {
  const input = F.current();
  input.existingDuties = [
    F.duty('existing-duty'),
    { ...F.duty('expired-duty', 'located-not-applicable'), current: F.gate('not-accepted', 'Expired') },
    { ...F.duty('unverified-duty', 'unresolved'), authentic: F.gate('accepted-indicative', 'Unconfirmed') },
  ];
  const result = run(input);
  assert.equal(result.selectedRoute, 'pending');
  assert.equal(result.outputKind, 'pending');
  assert.deepEqual(result.retainedDutyIds, ['existing-duty']);
  assert.ok(result.unresolvedNationalRules.length);
  assert.equal(result.readiness.find(item => item.route === 'kazakh-baseline').procedureSpecified, true);
  assert.equal(result.readiness.find(item => item.route === 'kazakh-baseline').officialIssuance, 'not-established');
  noVerdict(result);
});

test('hypothetical adopted conditions remain visible in the result stipulations', () => {
  const input = F.swiss();
  const result = run(input);
  assert.equal(result.selectedRoute, 'swiss-entry');
  assert.deepEqual(result.stipulations, input.stipulations);
  assert.ok(result.stipulations.some(item => item.inputPath.includes('swiss-adopted-table')));
});

test('failed domestic statistic goes directly to fallback when contracts and scope pass', () => {
  const input = F.allowDonor(F.swiss());
  F.setGate(input, 'domestic-five-contracts');
  F.setGate(input, 'domestic-sanitary-scope');
  F.setGate(input, 'domestic-statistic', 'not-accepted', 'Domestic statistic invalid');
  const result = run(input);
  assert.equal(result.selectedRoute, 'donor-transfer');
  assert.equal(attempt(result, 'domestic-entry').outcome, 'data-failed');
  assert.ok(!attempt(result, 'swiss-entry'));
});

test('unavailable domestic contracts or inapplicable scope permit Swiss entry checks', () => {
  for (const failure of ['domestic-five-contracts', 'domestic-sanitary-scope']) {
    const input = F.swiss();
    for (const id of ['domestic-five-contracts', 'domestic-sanitary-scope', 'domestic-statistic']) F.setGate(input, id);
    F.setGate(input, failure, failure === 'domestic-sanitary-scope' ? 'not-applicable' : 'unavailable');
    assert.equal(run(input).selectedRoute, 'swiss-entry');
  }
  const domestic = F.swiss();
  for (const id of ['domestic-five-contracts', 'domestic-sanitary-scope', 'domestic-statistic']) F.setGate(domestic, id);
  assert.equal(run(domestic).selectedRoute, 'domestic-entry');
});

test('Swiss entry requires all adoption statistic resolution and scope gates', () => {
  for (const id of F.SWISS_DATA) {
    const input = F.swiss();
    F.setGate(input, id, 'not-accepted', `${id} does not pass`);
    assert.equal(run(input).selectedRoute, 'pending', id);
  }
  const indicativeRule = F.swiss();
  F.setGate(indicativeRule, 'swiss-adopted-table', 'accepted-indicative', 'Adoption only indicative');
  assert.notEqual(run(indicativeRule).selectedRoute, 'swiss-entry');
});

test('Swiss entry produces a floor-only candidate with no delivery verdict', () => {
  const result = run(F.swiss());
  assert.equal(result.selectedTier, 'entry');
  assert.equal(result.outputKind, 'floor-only-candidate');
  assert.equal(result.enforcement.deliveryTest, 'no-obligation-from-floor');
  noVerdict(result);
});

test('monthly or dekadal proxies without validated daily low-flow evidence fail Swiss entry', () => {
  for (const period of ['monthly', 'dekadal']) {
    const input = F.swiss();
    F.setGate(input, 'swiss-daily-resolution', 'not-accepted', `${period} proxy lacks independent daily validation`);
    assert.equal(run(input).selectedRoute, 'pending');
  }
});

test('a Swiss floor at or above its input or a failed large-river screen is ineligible', () => {
  for (const id of ['swiss-floor-below-input', 'swiss-large-river-screen']) {
    const input = F.swiss();
    F.setGate(input, id, 'not-accepted');
    assert.notEqual(run(input).selectedRoute, 'swiss-entry');
  }
});

test('crossed baseline bounds bypass entry and go directly to fallback', () => {
  const input = F.allowDonor(F.swiss());
  F.setGate(input, 'annual-exceedance-set');
  input.baselineBounds = 'crossed';
  const result = run(input);
  assert.equal(result.selectedRoute, 'donor-transfer');
  assert.equal(attempt(result, 'kazakh-baseline').outcome, 'infeasible');
  assert.ok(!attempt(result, 'domestic-entry') && !attempt(result, 'swiss-entry'));
});

test('top habitat component retains a known baseline bounds conflict and pending full regime', () => {
  const input = F.hypothetical();
  input.priorityBasis = 'scheduled-priority';
  F.setGate(input, 'top-priority-or-trigger');
  F.setGate(input, 'habitat-hydraulics');
  input.baselineBounds = 'crossed';
  const result = run(input);
  assert.equal(result.selectedRoute, 'top');
  assert.equal(result.outputKind, 'habitat-element-candidate');
  assert.equal(attempt(result, 'kazakh-baseline').outcome, 'infeasible');
  assert.ok(attempt(result, 'kazakh-baseline').reasons.includes('bounds:crossed'));
  assert.ok(attempt(result, 'top').reasons.includes('pending:full-regime'));
  assert.ok(result.actions.some(item => item.description === 'action-resolve-baseline-bounds'));
  assert.ok(!attempt(result, 'domestic-entry') && !attempt(result, 'swiss-entry'));
  noVerdict(result);
});

test('qualified donor transfer precedes the presumptive floor fallback', () => {
  const input = F.allowDonor(F.allowPresumptive(F.hypothetical()));
  F.setGate(input, 'annual-exceedance-set', 'not-accepted');
  assert.equal(run(input).selectedRoute, 'donor-transfer');
  assert.equal(run(input).outputKind, 'regime-candidate');
  F.setGate(input, 'donor-qualification', 'not-accepted');
  assert.equal(run(input).selectedRoute, 'presumptive-floor');
  assert.equal(run(input).outputKind, 'floor-only-candidate');
});

test('presumptive fallback needs an adopted schedule and accepted daily reference', () => {
  for (const id of ['presumptive-adopted-schedule', 'present-climate-daily-reference']) {
    const input = F.allowPresumptive(F.hypothetical());
    F.setGate(input, 'annual-exceedance-set', 'not-accepted');
    F.setGate(input, id, 'unavailable');
    assert.equal(run(input).selectedRoute, 'pending');
  }
});

test('artificial bodies use habitat then hydraulics then service without borrowing natural tiers', () => {
  const input = F.allowService(F.artificial());
  F.setGate(input, 'potential-habitat-route');
  F.setGate(input, 'potential-hydraulic-route');
  assert.equal(run(input).selectedRoute, 'potential-habitat');
  assert.equal(run(input).outputKind, 'seasonal-floor-only-candidate');
  assert.equal(run(input).outputBasis, 'potential-habitat');
  F.setGate(input, 'potential-habitat-route', 'unavailable');
  assert.equal(run(input).selectedRoute, 'potential-hydraulics');
  assert.equal(run(input).outputKind, 'seasonal-floor-only-candidate');
  assert.equal(run(input).outputBasis, 'potential-hydraulics');
  F.setGate(input, 'potential-hydraulic-route', 'unavailable');
  const result = run(input);
  assert.equal(result.selectedRoute, 'service-conveyance');
  assert.equal(result.track, 'ecological-potential');
  assert.equal(result.selectedTier, null);
  assert.equal(result.outputKind, 'seasonal-floor-only-candidate');
  assert.equal(result.outputBasis, 'service-conveyance');
  assert.equal(result.enforcement.derivedDeliveryObligation, 'pending');
  assert.ok(!result.attempts.some(item => ['top', 'kazakh-baseline', 'domestic-entry', 'swiss-entry', 'donor-transfer', 'presumptive-floor'].includes(item.route)));
});

test('service-only results carry no ecological claim and require duty plus conveyance losses', () => {
  const input = F.allowService(F.artificial());
  assert.equal(run(input).outputKind, 'seasonal-floor-only-candidate');
  assert.equal(run(input).requirementScope, 'floor-only-candidate');
  noVerdict(run(input));
  F.setGate(input, 'operating-rule-or-approving-act', 'unavailable');
  F.setGate(input, 'permit-entitlement');
  assert.equal(run(input).selectedRoute, 'service-conveyance');
  F.setGate(input, 'carrier-service-duty', 'not-applicable');
  assert.equal(run(input).selectedRoute, 'pending');
});

test('missing service operands leave pending rather than sizing from observed abstraction', () => {
  for (const id of ['conveyance-loss', 'operating-rule-or-approving-act']) {
    const input = F.allowService(F.artificial());
    F.setGate(input, id, 'unavailable', 'Only observed abstraction is available; it does not define this operand');
    assert.equal(run(input).selectedRoute, 'pending');
    assert.equal(run(input).numericalResult, null);
  }
});

test('natural wetland origin is preserved while unknown receptor pathways remain unsized', () => {
  const input = F.hypothetical();
  Object.assign(input.body, { id: 'W1', name: 'Natural wetland', receptorIds: ['wetland-state'] });
  input.questions = ['receptor-state'];
  input.applicability.receptor = 'applicable';
  F.setGate(input, 'receptor-targets-pathways-and-sizing', 'unknown', 'Target known; pathway unknown');
  const result = run(input);
  assert.equal(result.track, 'natural-status');
  assert.equal(result.selectedRoute, 'receptor-assessment');
  assert.equal(result.requirementScope, 'receptor-only');
  assert.ok(!result.attempts.some(item => ['kazakh-baseline', 'domestic-entry', 'swiss-entry', 'donor-transfer'].includes(item.route)));
  assert.equal(overlay(result, 'receptor').state, 'unsized');
  assert.equal(overlay(result, 'receptor').receptorId, 'wetland-state');
});

test('quality and thermal overlays retain their target and evidence prerequisites', () => {
  const input = F.hypothetical();
  input.questions = ['water-quality', 'thermal-regime'];
  input.applicability.quality = 'applicable';
  input.applicability.thermal = 'applicable';
  assert.equal(overlay(run(input), 'quality').state, 'target-pending');
  input.body.category = 'А';
  input.body.categoryEvidence = F.gate();
  for (const id of ['quality-targets', 'source-control', 'residual-dilution-prerequisites',
    'quality-feasibility-screen', 'quality-fisheries-limits', 'quality-grouping-approved',
    'quality-basin-salt-budget', 'quality-transport-model-approved', 'thermal-target-and-evidence']) F.setGate(input, id);
  assert.equal(overlay(run(input), 'quality').state, 'assessment-supported');
  assert.equal(overlay(run(input), 'thermal').state, 'assessment-supported');
  F.setGate(input, 'source-control', 'not-accepted');
  assert.notEqual(overlay(run(input), 'quality').state, 'assessment-supported');
});

test('monitoring names points evidence owners and review triggers without inventing a cadence', () => {
  const input = F.hypothetical();
  input.questions = ['seasonal-regime', 'habitat', 'water-quality', 'thermal-regime'];
  const result = run(input);
  assert.ok(result.monitoring.length);
  for (const item of result.monitoring) {
    assert.ok(item.purpose && item.evidenceNeeded.length);
    assert.ok(item.controlPointIds.includes('R1-downstream-control'));
    assert.ok(item.action.description && item.action.ownerRole && item.action.reviewTrigger);
    assert.equal(item.action.reviewDate, null);
  }
  for (const item of result.actions) assert.ok(item.description && item.ownerRole && item.reviewTrigger);
  assert.match(JSON.stringify(result.monitoring), /flow|discharge/i);
  assert.match(JSON.stringify(result.monitoring), /habitat|biolog/i);
  assert.match(JSON.stringify(result.monitoring), /temperature|thermal/i);
});

test('delivery testing lists issued obligation control point and admitted evidence prerequisites', () => {
  const input = F.hypothetical();
  assert.equal(run(input).enforcement.deliveryTest, 'pending');
  for (const id of ['issued-obligation', 'designated-control-points', 'monitoring-evidence-admission', 'operator-control-evidence', 'legal-powers']) F.setGate(input, id);
  assert.equal(run(input).enforcement.deliveryTest, 'prerequisites-listed');
  for (const id of ['issued-obligation', 'designated-control-points', 'monitoring-evidence-admission']) {
    const failed = structuredClone(input);
    F.setGate(failed, id, 'not-accepted');
    assert.equal(run(failed).enforcement.deliveryTest, 'pending', id);
  }
});

test('floor conduct testing requires abstraction and but-for evidence separately', () => {
  const input = F.swiss();
  for (const id of ['applicable-floor', 'designated-control-points', 'monitoring-evidence-admission',
    'operator-control-evidence', 'legal-powers', 'causal-attribution-evidence']) F.setGate(input, id);
  assert.equal(run(input).enforcement.floorConductTest, 'pending');
  assert.match(JSON.stringify(run(input).enforcement.missingPrerequisites), /abstraction|but.?for/i);
  F.setGate(input, 'floor-abstraction-and-but-for-evidence');
  assert.equal(run(input).enforcement.floorConductTest, 'prerequisites-listed');
  assert.equal(run(input).enforcement.deliveryTest, 'no-obligation-from-floor');
  assert.ok(!run(input).enforcement.floorMissingPrerequisites.some(item => item.includes('issued-obligation')));
  F.setGate(input, 'issued-obligation');
  assert.equal(run(input).enforcement.deliveryTest, 'prerequisites-listed');
  assert.equal(run(input).enforcement.floorConductTest, 'prerequisites-listed');
  noVerdict(run(input));
});

test('rejected or uncertain evidence cannot produce legal fault or ecological status findings', () => {
  for (const [state, reason] of [['not-accepted', 'Observations rejected'], ['accepted-indicative', 'Uncertainty spans obligation'], ['accepted', 'Shortfall needs causal investigation']]) {
    const input = F.hypothetical();
    F.setGate(input, 'monitoring-evidence-admission', state, reason);
    noVerdict(run(input));
  }
});

test('numeric examples are illustrations restricted to R2 and never attach to another body', () => {
  for (const id of ['R1', 'W1', 'C1', 'unregistered-body']) {
    const input = F.hypothetical();
    input.body.id = id;
    assert.equal(run(input).relatedExample, null, id);
  }
  const input = F.hypothetical();
  input.body.id = 'R2';
  const result = run(input);
  assert.ok(result.relatedExample);
  assert.equal(result.relatedExample.bodyId, 'R2');
  assert.equal(result.relatedExample.purpose, 'illustration-only');
  assert.equal(result.relatedExample.method, 'kazakh');
});

test('evaluation does not mutate input or produce numeric prescriptions', () => {
  const input = F.swiss();
  const before = structuredClone(input);
  const result = run(input);
  assert.deepEqual(input, before);
  assert.deepEqual(run(input), result);
  noVerdict(result);
});

test('validation reports missing required gate records', () => {
  for (const id of F.GATE_IDS) {
    const input = F.hypothetical();
    delete input.gates[id];
    assert.ok(validateWalkthrough(input).some(error => error.includes(id)), id);
  }
  const empty = F.hypothetical();
  empty.gates['annual-exceedance-set'] = [];
  assert.ok(validateWalkthrough(empty).some(error => error.includes('annual-exceedance-set')));
});

test('validation reports hidden hypothetical overrides without named stipulations', () => {
  const input = F.swiss();
  input.stipulations = input.stipulations.filter(item => !item.inputPath.includes('swiss-adopted-table'));
  assert.ok(validateWalkthrough(input).some(error => /swiss-adopted-table|stipulat/i.test(error)));
  const current = F.current();
  F.setGate(current, 'swiss-adopted-table');
  assert.ok(validateWalkthrough(current).some(error => /swiss-adopted-table|current|adopt/i.test(error)));
});


test('inspection distinguishes a selected baseline from an unvisited entry method', () => {
  const input = F.hypothetical();
  const result = run(input);
  const baseline = inspectRoute(input, 'kazakh-baseline');
  assert.equal(baseline.disposition, 'selected');
  assert.equal(baseline.bodyId, input.body.id);
  assert.equal(baseline.selectedRoute, result.selectedRoute);
  assert.deepEqual(baseline.attempts, result.attempts.filter(item => item.route === 'kazakh-baseline'));
  assert.deepEqual(baseline.reasons, attempt(result, 'kazakh-baseline').reasons);
  assert.deepEqual(baseline.requiredGates.map(item => item.id), [
    'natural-reconstruction', 'annual-exceedance-set', 'seasonal-hydrographs',
    'low-flow-risk-statistic', 'daily-bounds-inputs', 'multi-day-safeguard-configuration',
  ]);
  assert.ok(baseline.requiredGates.every(item => item.satisfied && item.group === 'all'));
  assert.deepEqual(baseline.availability, {tier:'baseline', ...input.availability.baseline});
  assert.deepEqual(baseline.readiness, result.readiness.find(item => item.route === 'kazakh-baseline'));
  assert.equal(baseline.baselineBounds, 'compatible');
  const swiss = inspectRoute(input, 'swiss-entry');
  assert.equal(swiss.disposition, 'not-reached');
  assert.deepEqual(swiss.attempts, []);
  assert.deepEqual(swiss.reasons, ['inspection:not-reached']);
  assert.equal(swiss.baselineBounds, null);
});

test('inspection reports selected Q347 data and exact rejection reasons', () => {
  const input = F.swiss();
  const swiss = inspectRoute(input, 'swiss-entry');
  assert.equal(swiss.disposition, 'selected');
  assert.deepEqual(swiss.requiredGates.map(item => item.id), F.SWISS_DATA);
  assert.ok(swiss.requiredGates.every(item => item.satisfied));
  F.setGate(input, 'swiss-daily-resolution', 'not-accepted', 'Monthly observations lack daily validation');
  const failed = inspectRoute(input, 'swiss-entry');
  assert.equal(failed.disposition, 'skipped');
  assert.deepEqual(failed.reasons, attempt(run(input), 'swiss-entry').reasons);
  assert.ok(failed.reasons.includes('missing:swiss-daily-resolution'));
  assert.equal(failed.requiredGates.find(item => item.id === 'swiss-daily-resolution').satisfied, false);
});

test('inspection preserves sizing restrictions and all seasonal gate records', () => {
  const input = F.hypothetical();
  input.gates['annual-exceedance-set'] = [
    {...F.gate('accepted-indicative'), season:'summer', permittedUses:['screening', 'diagnostic']},
    {...F.gate(), season:'winter'},
  ];
  const inspected = inspectRoute(input, 'kazakh-baseline');
  const requirement = inspected.requiredGates.find(item => item.id === 'annual-exceedance-set');
  assert.equal(requirement.satisfied, false);
  assert.deepEqual(requirement.records, input.gates['annual-exceedance-set']);
  assert.ok(inspected.reasons.includes('restricted:annual-exceedance-set'));
  assert.equal(inspected.disposition, 'skipped');
  input.gates['annual-exceedance-set'][0].permittedUses.push('sizing');
  const admitted = inspectRoute(input, 'kazakh-baseline');
  assert.equal(admitted.requiredGates.find(item => item.id === 'annual-exceedance-set').satisfied, true);
  assert.ok(admitted.reasons.includes('indicative:annual-exceedance-set'));
});

test('inspection distinguishes direct fallback from an earlier selected method', () => {
  const crossed = F.allowDonor(F.swiss());
  F.setGate(crossed, 'annual-exceedance-set');
  crossed.baselineBounds = 'crossed';
  for (const route of ['domestic-entry', 'swiss-entry']) {
    const inspected = inspectRoute(crossed, route);
    assert.equal(inspected.disposition, 'not-reached');
    assert.equal(inspected.selectedRoute, 'donor-transfer');
    assert.deepEqual(inspected.reasons, ['inspection:direct-fallback']);
    assert.deepEqual(inspected.attempts, []);
  }
  const domestic = F.allowDonor(F.swiss());
  for (const id of ['domestic-five-contracts', 'domestic-sanitary-scope']) F.setGate(domestic, id);
  F.setGate(domestic, 'domestic-statistic', 'not-accepted');
  assert.deepEqual(inspectRoute(domestic, 'swiss-entry').reasons, ['inspection:direct-fallback']);
  const top = F.hypothetical();
  top.priorityBasis = 'scheduled-priority';
  for (const id of ['top-priority-or-trigger', 'habitat-hydraulics']) F.setGate(top, id);
  top.baselineBounds = 'crossed';
  assert.deepEqual(inspectRoute(top, 'swiss-entry').reasons, ['inspection:not-reached']);
});

test('inspection shows top priority separately from statistical support', () => {
  const input = F.hypothetical();
  F.setGate(input, 'top-priority-or-trigger');
  F.setGate(input, 'habitat-hydraulics');
  const rejected = inspectRoute(input, 'top');
  assert.equal(rejected.requiredGates.find(item => item.id === 'top-priority-or-trigger').satisfied, false);
  assert.ok(rejected.reasons.includes('priority:not-selected'));
  input.priorityBasis = 'ecological-trigger';
  const selected = inspectRoute(input, 'top');
  assert.equal(selected.disposition, 'selected');
  assert.ok(selected.requiredGates.every(item => item.satisfied));
  assert.equal(selected.requiredGates.some(item => item.id === 'multi-day-safeguard-configuration'), false);
});

test('inspection groups service authority alternatives without requiring both', () => {
  const input = F.allowService(F.artificial());
  F.setGate(input, 'operating-rule-or-approving-act', 'unavailable');
  F.setGate(input, 'permit-entitlement');
  const inspected = inspectRoute(input, 'service-conveyance');
  assert.equal(inspected.disposition, 'selected');
  assert.equal(inspected.availability, null);
  const alternatives = inspected.requiredGates.filter(item => item.group === 'any-authority');
  assert.deepEqual(alternatives.map(item => item.id), ['operating-rule-or-approving-act', 'permit-entitlement']);
  assert.deepEqual(alternatives.map(item => item.satisfied), [false, true]);
  F.setGate(input, 'permit-entitlement', 'not-accepted');
  assert.equal(inspectRoute(input, 'service-conveyance').disposition, 'skipped');
  const pendingAuthority = inspectRoute(input, 'pending').requiredGates.filter(item => item.group === 'any-authority');
  assert.deepEqual(pendingAuthority.map(item => item.id), ['operating-rule-or-approving-act', 'permit-entitlement']);
  assert.equal(inspectRoute(input, 'kazakh-baseline').disposition, 'other-track');
});

test('inspection keeps wetland receptor evidence separate from river methods', () => {
  const input = F.hypothetical();
  input.body.id = 'W1';
  input.body.receptorIds = ['W1-wetland'];
  input.applicability.receptor = 'applicable';
  const receptor = inspectRoute(input, 'receptor-assessment');
  assert.equal(receptor.disposition, 'selected');
  assert.deepEqual(receptor.requiredGates.map(item => item.id), ['receptor-targets-pathways-and-sizing']);
  assert.equal(receptor.requiredGates[0].satisfied, false);
  assert.deepEqual(receptor.finalChecks, []);
  assert.equal(receptor.readiness, null);
  assert.deepEqual(inspectRoute(input, 'swiss-entry').reasons, ['inspection:other-track']);
  F.setGate(input, 'receptor-targets-pathways-and-sizing');
  assert.equal(inspectRoute(input, 'receptor-assessment').requiredGates[0].satisfied, true);
});

test('inspection normalizes final checks without inheriting baseline safeguards', () => {
  const input = F.swiss();
  F.setGate(input, 'annual-exceedance-set');
  input.finalChecks['kazakh-baseline'].safeguard = F.check('fail');
  const baseline = inspectRoute(input, 'kazakh-baseline');
  assert.equal(baseline.disposition, 'skipped');
  assert.ok(baseline.reasons.includes('final-check:safeguard:fail'));
  assert.deepEqual(baseline.finalChecks, attempt(run(input), 'kazakh-baseline').checks);
  input.finalChecks['swiss-entry'].safeguard = F.check('fail');
  const entry = inspectRoute(input, 'swiss-entry');
  assert.equal(entry.disposition, 'selected');
  assert.equal(entry.finalChecks.find(item => item.id === 'safeguard').applicable, false);
  delete input.finalChecks['swiss-entry'];
  assert.equal(inspectRoute(input, 'swiss-entry').finalChecks.find(item => item.id === 'assembly').state, 'not-assessed');
});

test('inspection lists only real blockers for pending and respects classification', () => {
  const input = F.current();
  const pending = inspectRoute(input, 'pending');
  assert.equal(pending.disposition, 'selected');
  assert.deepEqual(pending.reasons, attempt(run(input), 'pending').reasons);
  assert.ok(pending.requiredGates.length);
  assert.ok(pending.requiredGates.every(item => !item.satisfied && Array.isArray(input.gates[item.id])));
  assert.deepEqual(pending.finalChecks, []);
  input.body.origin = 'unknown';
  const classification = inspectRoute(input, 'pending');
  assert.deepEqual(classification.requiredGates, []);
  assert.ok(classification.reasons.includes('classification:origin'));
  assert.equal(inspectRoute(input, 'kazakh-baseline').disposition, 'other-track');
});

test('inspection rejects unknown routes and invalid walkthroughs clearly', () => {
  assert.throws(() => inspectRoute(F.hypothetical(), 'invented-method'), {
    name:'Error', message:'Unknown inspection route: invented-method',
  });
  const invalid = F.hypothetical();
  delete invalid.gates['natural-reconstruction'];
  assert.throws(() => inspectRoute(invalid, 'kazakh-baseline'), /Invalid walkthrough input:.*natural-reconstruction/);
});

test('inspection returns independent copies and preserves evaluation outputs', () => {
  const input = F.swiss();
  const original = structuredClone(input);
  const result = run(input);
  for (const route of ['top', 'kazakh-baseline', 'domestic-entry', 'swiss-entry', 'donor-transfer',
    'presumptive-floor', 'potential-habitat', 'potential-hydraulics', 'service-conveyance', 'receptor-assessment', 'pending']) {
    const inspected = inspectRoute(input, route);
    if (inspected.requiredGates.length) inspected.requiredGates[0].records[0].sourceIds.push('mutated');
    if (inspected.attempts.length) inspected.attempts[0].reasons.push('mutated');
    if (inspected.finalChecks.length) inspected.finalChecks[0].sourceIds.push('mutated');
    if (inspected.availability) inspected.availability.specified.sourceIds.push('mutated');
    if (inspected.readiness) inspected.readiness.caseInputsSupplied = 'mutated';
  }
  assert.deepEqual(input, original);
  assert.deepEqual(run(input), result);
});
