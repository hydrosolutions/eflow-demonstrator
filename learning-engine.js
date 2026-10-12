/* Separate teaching arithmetic. No native simulation or legal adjudication. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EflowLearning = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  function nonnegative(values) {
    if (!values.every(v => Number.isFinite(v) && v >= 0)) throw new RangeError('Inputs must be finite nonnegative numbers');
  }
  function allocation({inflow = 3, irrigation = 1, wetland = .5} = {}) {
    nonnegative([inflow, irrigation, wetland]);
    if (irrigation + wetland > inflow) throw new RangeError('Allocations exceed inflow');
    const downstream = inflow - irrigation - wetland;
    return {downstream, riverDeficit: Math.max(0, 2 - downstream), irrigationDeficit: Math.max(0, 1 - irrigation), residual: inflow - irrigation - wetland - downstream, diversionDifferenceM3Day: (1 - irrigation) * 86400};
  }
  function seasonal({annualMm3, share, days}) {
    nonnegative([annualMm3, share, days]);
    if (share > 1 || !Number.isInteger(days) || days === 0) throw new RangeError('Share must be at most one and duration a positive integer');
    const volumeMm3 = annualMm3 * share;
    return {volumeMm3, meanM3s: volumeMm3 * 1e6 / (days * 86400)};
  }
  function mix({riverQ, riverC, drainQ, drainC}) {
    nonnegative([riverQ, riverC, drainQ, drainC]);
    const flowM3s = riverQ + drainQ, loadGps = riverQ * riverC + drainQ * drainC;
    return {flowM3s, loadGps, concentrationMgL: flowM3s === 0 ? null : loadGps / flowM3s};
  }
  function interval({value, halfWidth, criterion}) {
    if (![value, halfWidth, criterion].every(Number.isFinite) || halfWidth < 0) return 'not_assessed';
    return value - halfWidth >= criterion ? 'met' : value + halfWidth < criterion ? 'shortfall' : 'indeterminate';
  }
  function floorCheck({floor, butFor, actual, attributed, evidence}) {
    if (![floor, butFor, actual].every(v => Number.isFinite(v) && v >= 0) || evidence !== true) return {threshold: null, verdict: 'unresolved'};
    const threshold = Math.min(floor, butFor);
    return {threshold, verdict: actual >= threshold ? 'no_shortfall' : attributed === true ? 'attributed_shortfall' : 'unresolved'};
  }
  return {allocation, seasonal, mix, interval, floorCheck};
});
