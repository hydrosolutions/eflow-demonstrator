'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');

const L = require('../learning-engine.js');
const close = (actual, expected, tolerance = 1e-9) => assert.ok(
  Number.isFinite(actual) && Math.abs(actual - expected) <= tolerance,
  `Expected ${expected}, received ${actual}`,
);
const rejects = action => assert.throws(action, error => error instanceof Error && error.message.length > 0);

test('report allocation exposes the river and irrigation tradeoff without losing water', () => {
  const full = L.allocation({inflow: 3, irrigation: 1, wetland: .5});
  const reduced = L.allocation({inflow: 3, irrigation: .5, wetland: .5});
  close(full.downstream, 1.5);
  close(full.riverDeficit, .5);
  close(full.irrigationDeficit, 0);
  close(reduced.downstream, 2);
  close(reduced.riverDeficit, 0);
  close(reduced.irrigationDeficit, .5);
  close(full.residual, 0);
  close(reduced.residual, 0);
  close(reduced.diversionDifferenceM3Day, 43200);
  close(full.diversionDifferenceM3Day, 0);
});

test('an allocation with surplus cannot report a negative deficit', () => {
  const result = L.allocation({inflow: 5, irrigation: 1, wetland: .5});
  close(result.downstream, 3.5);
  close(result.riverDeficit, 0);
  close(result.irrigationDeficit, 0);
});

test('zero water is a valid accounted shortage rather than missing evidence', () => {
  const result = L.allocation({inflow: 0, irrigation: 0, wetland: 0});
  close(result.downstream, 0);
  close(result.riverDeficit, 2);
  close(result.irrigationDeficit, 1);
  close(result.residual, 0);
});

test('allocation rejects impossible or nonnumeric water accounts', () => {
  rejects(() => L.allocation({inflow: 1, irrigation: 1, wetland: .5}));
  for (const field of ['inflow', 'irrigation', 'wetland']) {
    for (const value of [-1, null, NaN, Infinity, '1']) {
      rejects(() => L.allocation({...{inflow: 3, irrigation: 1, wetland: .5}, [field]: value}));
    }
  }
});

test('seasonal volume uses its stated duration and does not equate volume with discharge', () => {
  const june = L.seasonal({annualMm3: 100, share: .2, days: 30});
  close(june.volumeMm3, 20);
  close(june.meanM3s, 7.716049382716049);
  const longer = L.seasonal({annualMm3: 100, share: .2, days: 60});
  close(longer.volumeMm3, 20);
  close(longer.meanM3s, june.meanM3s / 2);
  for (const inputs of [{annualMm3: 0, share: 1, days: 30}, {annualMm3: 100, share: 0, days: 30}]) {
    const zero = L.seasonal(inputs);
    close(zero.volumeMm3, 0);
    close(zero.meanM3s, 0);
  }
});

test('seasonal calculation rejects unsupported shares and invalid periods', () => {
  for (const share of [-.1, 1.1, null, NaN, Infinity]) rejects(() => L.seasonal({annualMm3: 100, share, days: 30}));
  for (const days of [0, -1, 30.5, null, NaN, Infinity]) rejects(() => L.seasonal({annualMm3: 100, share: .2, days}));
  for (const annualMm3 of [-1, null, NaN, Infinity]) rejects(() => L.seasonal({annualMm3, share: .2, days: 30}));
});

test('source treatment lowers salt load at fixed flow while dilution alone retains salt load', () => {
  const original = L.mix({riverQ: 2, riverC: 100, drainQ: .5, drainC: 800});
  const treated = L.mix({riverQ: 2, riverC: 100, drainQ: .5, drainC: 400});
  close(original.flowM3s, 2.5);
  close(original.loadGps, 600);
  close(original.concentrationMgL, 240);
  close(treated.flowM3s, 2.5);
  close(treated.loadGps, 400);
  close(treated.concentrationMgL, 160);
  const diluted = L.mix({riverQ: original.flowM3s, riverC: original.concentrationMgL, drainQ: 2.5, drainC: 0});
  close(diluted.loadGps, 600);
  close(diluted.concentrationMgL, 120);
});

test('zero mixed flow leaves concentration undefined instead of claiming clean water', () => {
  const result = L.mix({riverQ: 0, riverC: 100, drainQ: 0, drainC: 800});
  close(result.flowM3s, 0);
  close(result.loadGps, 0);
  assert.equal(result.concentrationMgL, null);
});

test('missing or impossible chemistry cannot silently become zero load', () => {
  for (const field of ['riverQ', 'riverC', 'drainQ', 'drainC']) {
    for (const value of [null, -1, NaN, Infinity]) {
      rejects(() => L.mix({...{riverQ: 2, riverC: 100, drainQ: .5, drainC: 800}, [field]: value}));
    }
  }
});

test('measurement intervals support distinct delivery outcomes at the protective endpoints', () => {
  assert.equal(L.interval({value: 8, halfWidth: .5, criterion: 7}), 'met');
  assert.equal(L.interval({value: 6, halfWidth: .5, criterion: 7}), 'shortfall');
  assert.equal(L.interval({value: 7, halfWidth: .5, criterion: 7}), 'indeterminate');
  assert.equal(L.interval({value: 7.5, halfWidth: .5, criterion: 7}), 'met');
  assert.equal(L.interval({value: 6.5, halfWidth: .5, criterion: 7}), 'indeterminate');
  assert.equal(L.interval({value: 0, halfWidth: 0, criterion: 0}), 'met');
  assert.equal(L.interval({value: 0, halfWidth: 0, criterion: 7}), 'shortfall');
});

test('missing measurements or uncertainty yield no assessed verdict', () => {
  for (const field of ['value', 'halfWidth', 'criterion']) {
    for (const value of [null, undefined, NaN, Infinity]) {
      assert.equal(L.interval({...{value: 7, halfWidth: .5, criterion: 7}, [field]: value}), 'not_assessed');
    }
  }
  assert.equal(L.interval({value: 7, halfWidth: -.5, criterion: 7}), 'not_assessed');
});

test('a passing delivery comparison does not settle downstream floor protection', () => {
  assert.equal(L.interval({value: 7, halfWidth: 0, criterion: 7}), 'met');
  const downstream = L.floorCheck({floor: 2, butFor: 3, actual: 1.5, attributed: true, evidence: true});
  close(downstream.threshold, 2);
  assert.equal(downstream.verdict, 'attributed_shortfall');
  assert.notEqual(downstream.verdict, 'legal_fault');
});

test('natural shortage retains the floor but limits the conduct comparison to but-for flow', () => {
  const result = L.floorCheck({floor: 2, butFor: 1, actual: 1, attributed: false, evidence: true});
  close(result.threshold, 1);
  assert.equal(result.verdict, 'no_shortfall');
  const zero = L.floorCheck({floor: 2, butFor: 0, actual: 0, attributed: false, evidence: true});
  close(zero.threshold, 0);
  assert.equal(zero.verdict, 'no_shortfall');
});

test('a below-floor observation without attribution or admitted evidence is unresolved', () => {
  const base = {floor: 2, butFor: 3, actual: 1.5, attributed: true, evidence: true};
  assert.equal(L.floorCheck({...base, attributed: false}).verdict, 'unresolved');
  assert.equal(L.floorCheck({...base, evidence: false}).verdict, 'unresolved');
  for (const field of ['floor', 'butFor', 'actual']) {
    for (const value of [null, undefined, NaN, Infinity]) {
      assert.equal(L.floorCheck({...base, [field]: value}).verdict, 'unresolved');
    }
  }
});

test('learning calculations leave caller-owned evidence unchanged', () => {
  const inputs = Object.freeze({inflow: 3, irrigation: .5, wetland: .5});
  L.allocation(inputs);
  assert.deepEqual(inputs, {inflow: 3, irrigation: .5, wetland: .5});
});

test('saved original numerical evidence retains its frozen bytes', () => {
  const app = path.resolve(__dirname, '..');
  const baseline = JSON.parse(fs.readFileSync(path.resolve(app, '../learning_implementation_2026-10-04/BASELINE.json'), 'utf8'));
  for (const [relative, expected] of Object.entries(baseline.hashes)) {
    const actual = crypto.createHash('sha256').update(fs.readFileSync(path.join(app, relative))).digest('hex');
    assert.equal(actual, expected, `Frozen scientific input or method changed: ${relative}`);
  }
});
