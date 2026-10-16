(function (root) {
  'use strict';

  const GATE_IDS = Object.freeze([
    'top-priority-or-trigger', 'natural-reconstruction', 'annual-exceedance-set',
    'seasonal-hydrographs', 'low-flow-risk-statistic', 'multi-day-safeguard-configuration',
    'ecological-drought-rule', 'daily-bounds-inputs', 'habitat-hydraulics',
    'domestic-five-contracts', 'domestic-sanitary-scope', 'domestic-statistic',
    'swiss-adopted-table', 'swiss-daily-statistic', 'swiss-daily-resolution',
    'swiss-floor-below-input', 'swiss-large-river-screen', 'donor-rules-register',
    'donor-qualification', 'receiving-series', 'presumptive-adopted-schedule',
    'present-climate-daily-reference', 'potential-habitat-route',
    'potential-hydraulic-route', 'carrier-service-duty', 'operating-rule-or-approving-act',
    'permit-entitlement', 'conveyance-loss', 'quality-targets', 'source-control',
    'residual-dilution-prerequisites', 'thermal-target-and-evidence',
    'receptor-targets-pathways-and-sizing', 'issued-obligation',
    'designated-control-points', 'monitoring-evidence-admission',
    'operator-control-evidence', 'floor-abstraction-and-but-for-evidence', 'legal-powers',
    'applicable-floor', 'causal-attribution-evidence', 'quality-feasibility-screen',
    'quality-fisheries-limits', 'quality-grouping-approved', 'quality-basin-salt-budget',
    'quality-transport-model-approved',
  ]);
  const TIERS = ['top', 'baseline', 'entry'];
  const STATES = ['accepted', 'accepted-indicative', 'not-accepted', 'unavailable', 'not-applicable', 'unknown'];
  const NATIONAL_RULES = new Set([
    'domestic-five-contracts', 'swiss-adopted-table',
    'donor-rules-register', 'presumptive-adopted-schedule',
  ]);
  const REPORT_REFERENCE = Object.freeze({
    fileName: 'report_review_2026-09-20__shared_with_NCECC.docx',
    sha256: '51de55c8473548a536d3fd860948b928183dcdd6470df4721246c0bf1b3bfedc',
    referenceRole: 'shared-report-alignment-reference',
  });
  const COMPONENTS = ['quality', 'thermal', 'receptor', 'sediment', 'connectivity', 'groundwater'];
  const CHECK_IDS = ['assembly', 'safeguard', 'member-selection', 'cross-class-floor', 'applicable-conditions'];
  const ROUTES = ['top', 'kazakh-baseline', 'domestic-entry', 'swiss-entry', 'donor-transfer',
    'presumptive-floor', 'potential-habitat', 'potential-hydraulics', 'service-conveyance'];
  const NATURAL_REGIME_ROUTES = new Set(['top', 'kazakh-baseline', 'donor-transfer']);
  // Indicative statistics may carry a tier; legal authority, adoption, validation,
  // applicability and resource records require an unqualified accepted finding.
  const INDICATIVE_STATISTICS = new Set([
    'natural-reconstruction', 'annual-exceedance-set', 'seasonal-hydrographs',
    'low-flow-risk-statistic', 'daily-bounds-inputs', 'habitat-hydraulics',
    'domestic-statistic', 'swiss-daily-statistic', 'receiving-series',
    'present-climate-daily-reference', 'conveyance-loss',
  ]);
  const BASELINE_STATISTICS = [
    'natural-reconstruction', 'annual-exceedance-set', 'seasonal-hydrographs',
    'low-flow-risk-statistic', 'daily-bounds-inputs',
  ];
  const BASELINE_RULES = ['multi-day-safeguard-configuration'];
  const BASELINE_GATES = [...BASELINE_STATISTICS, ...BASELINE_RULES];
  const SWISS_GATES = [
    'swiss-adopted-table', 'swiss-daily-statistic', 'swiss-daily-resolution',
    'swiss-floor-below-input', 'swiss-large-river-screen',
  ];
  const DONOR_GATES = ['donor-rules-register', 'donor-qualification', 'receiving-series'];
  const PRESUMPTIVE_GATES = ['presumptive-adopted-schedule', 'present-climate-daily-reference'];
  const TOP_GATES = [...BASELINE_STATISTICS, 'habitat-hydraulics'];
  const SERVICE_AUTHORITY_GATES = ['operating-rule-or-approving-act', 'permit-entitlement'];
  const ROUTE_GATES = {
    top: TOP_GATES, 'kazakh-baseline': BASELINE_GATES,
    'domestic-entry': ['domestic-five-contracts', 'domestic-sanitary-scope', 'domestic-statistic'],
    'swiss-entry': SWISS_GATES, 'donor-transfer': DONOR_GATES, 'presumptive-floor': PRESUMPTIVE_GATES,
    'potential-habitat': ['potential-habitat-route'], 'potential-hydraulics': ['potential-hydraulic-route'],
    'service-conveyance': ['carrier-service-duty', 'conveyance-loss'],
    'receptor-assessment': ['receptor-targets-pathways-and-sizing'],
  };
  const SOURCES = {
    classification: 'Appendix A step 2: Then derive the track — from ORIGIN, not from use',
    tier: 'Appendix A steps 4–7: highest ELIGIBLE tier',
    indicative: 'Appendix D.8: a declared limitation confines its use',
    top: 'Appendix A step 4: data alone never assigns it',
    domestic: 'Appendix A step 6: failing the third it takes the fallback',
    swiss: 'Appendix A step 6: the floor does not apply; take the fallback',
    bounds: 'Appendix A step 7: an infeasibility, not a result',
    donor: 'Appendix A step 6: What transfers is the relationship, never the discharge',
    fallback: 'Appendix D.10: No computable floor means pending',
    potential: 'Appendix D.10: Final seasonal floor only under this proposal',
    quality: 'Appendix A step 8: Activation requires all five conditions, with evidence for each',
    receptor: 'Appendix A step 9: the pathway, not the receptor’s class, decides which module sizes it',
    evidence: 'Appendix A step 10: The evidence is admitted before the verdict',
    floor: 'Appendix A step 11: The daily floor is tested separately as a restraint on conduct',
    checks: 'Appendix D.10: Mark the failed route so it is not selected again in the same attempt',
    safeguard: 'Appendix D.5: The daily-mapping gap is thereby replaced by a specified multi-day assessment procedure',
    readiness: 'Section 4.2: Calculation and official use remain separate. The baseline procedures are specified',
    duty: 'Section 10.1: Existing duties and powers remain effective for their lawful purposes',
  };
  const MONITORING = [
    {
      kind: 'flow', purpose: 'monitor-flow',
      evidence: ['evidence-flow-series', 'evidence-time-support', 'evidence-admission-and-uncertainty'],
      owner: 'owner-hydrologist',
    },
    {
      kind: 'operations', purpose: 'monitor-abstraction-and-operations',
      evidence: ['evidence-abstraction-metering', 'evidence-operation-records', 'evidence-independent-balance'],
      owner: 'owner-operator',
    },
    {
      kind: 'habitat', purpose: 'monitor-habitat-and-biology',
      evidence: ['evidence-habitat-structure', 'evidence-biological-response', 'evidence-season-and-pressure-context'],
      owner: 'owner-ecologist',
    },
    {
      kind: 'quality', purpose: 'monitor-water-quality',
      evidence: ['evidence-quality-targets', 'evidence-chemistry-and-loads', 'evidence-source-controls'],
      owner: 'owner-quality-specialist',
    },
    {
      kind: 'thermal', purpose: 'monitor-temperature-and-thermal-regime',
      evidence: ['evidence-temperature-series', 'evidence-outlet-and-stratification', 'evidence-thermal-mechanism'],
      owner: 'owner-thermal-specialist',
    },
    {
      kind: 'receptor', purpose: 'monitor-receptor-state',
      evidence: ['evidence-water-level-and-hydroperiod', 'evidence-receptor-quality', 'evidence-receptor-pathways'],
      owner: 'owner-receptor-specialist',
    },
  ];
  // These strings are localization keys shared with the view. They do not set a
  // sampling frequency, appoint an authority, or give a compliance verdict.
  const TEXT_KEYS = Object.freeze([
    ...MONITORING.flatMap(item => [item.purpose, ...item.evidence, `action-monitor-${item.kind}`, item.owner]),
    'action-resolve-classification', 'action-confirm-category', 'action-review-route',
    'action-confirm-authority', 'action-resolve-quality', 'action-resolve-thermal',
    'action-resolve-receptor', 'action-resolve-sediment', 'action-resolve-connectivity',
    'action-resolve-groundwater', 'action-confirm-control-points',
    'action-resolve-baseline-bounds',
    'owner-basin-lead', 'owner-competent-authority',
    'review-new-evidence-or-changed-pressures', 'review-evidence-or-rule-change',
    'review-authority-confirmation', 'action-complete-final-checks',
    'action-assess-carrier-separately', 'action-complete-duty-register',
  ].filter((value, index, values) => values.indexOf(value) === index));

  const isRecord = value => value !== null && typeof value === 'object' && !Array.isArray(value);
  const hasText = value => typeof value === 'string' && value.trim().length > 0;
  const positive = gate => gate && ['accepted', 'accepted-indicative'].includes(gate.state);
  const strict = gate => isRecord(gate) && gate.state === 'accepted';
  const clone = value => JSON.parse(JSON.stringify(value));
  const source = key => ({ artifact: REPORT_REFERENCE.fileName, distinctivePhrase: SOURCES[key] });

  const gatePass = (input, id) => input.gates[id].every(gate => INDICATIVE_STATISTICS.has(id)
    ? positive(gate) && gate.permittedUses.includes('sizing') : strict(gate));
  const routeTier = route => route === 'top' ? 'top' : route === 'kazakh-baseline' ? 'baseline'
    : ['domestic-entry', 'swiss-entry'].includes(route) ? 'entry' : null;

  // These are supplied findings, never checks calculated from a flow series by this tab.
  function routeChecks(input, route) {
    return CHECK_IDS.map(id => {
      const supplied = input.finalChecks[route]?.[id];
      const allowed = id === 'safeguard' ? route === 'kazakh-baseline'
        : ['member-selection', 'cross-class-floor'].includes(id) ? NATURAL_REGIME_ROUTES.has(route) : true;
      const value = supplied ? clone(supplied) : {
        applicable: allowed, state: 'not-assessed', basis: 'participant-supplied', sourceIds: [],
        reason: 'No participant-supplied final check is available for this route.',
      };
      return {...value, id, applicable: allowed && (['assembly', 'applicable-conditions'].includes(id) || value.applicable)};
    });
  }

  function validateWalkthrough(input) {
    const errors = [];
    if (!isRecord(input)) return ['input: expected a walkthrough record'];
    const requireText = (value, path) => {
      if (!hasText(value)) errors.push(`${path}: expected non-empty text`);
    };
    const requireChoice = (value, choices, path) => {
      if (!choices.includes(value)) errors.push(`${path}: unrecognised value`);
    };
    const requireStrings = (value, path) => {
      if (!Array.isArray(value) || value.some(item => !hasText(item))) {
        errors.push(`${path}: expected an array of non-empty strings`);
      }
    };
    const checkGate = (gate, path, statistical = false) => {
      if (!isRecord(gate)) { errors.push(`${path}: missing gate record`); return; }
      requireChoice(gate.state, STATES, `${path}.state`);
      requireText(gate.reason, `${path}.reason`);
      requireStrings(gate.sourceIds, `${path}.sourceIds`);
      if (positive(gate) && Array.isArray(gate.sourceIds) && !gate.sourceIds.length) {
        errors.push(`${path}.sourceIds: accepted evidence needs a source`);
      }
      if (statistical || gate.permittedUses !== undefined) {
        requireStrings(gate.permittedUses, `${path}.permittedUses`);
        for (const use of Array.isArray(gate.permittedUses) ? gate.permittedUses : []) requireChoice(use, ['sizing', 'screening', 'diagnostic'], `${path}.permittedUses`);
      }
      for (const field of ['season', 'estimator']) if (gate[field] !== undefined) requireText(gate[field], `${path}.${field}`);
    };
    const checkAction = (value, path) => {
      if (!isRecord(value)) { errors.push(`${path}: missing action`); return; }
      for (const field of ['description', 'ownerRole', 'reviewTrigger']) requireText(value[field], `${path}.${field}`);
    };
    requireChoice(input.schemaVersion, ['eflow-route-proposal/2'], 'schemaVersion');
    requireChoice(input.mode, ['report-current', 'hypothetical-workshop'], 'mode');
    requireChoice(input.reportVersion, [REPORT_REFERENCE.fileName], 'reportVersion');
    for (const [key, value] of Object.entries(REPORT_REFERENCE)) {
      requireChoice(input.reportReference?.[key], [value], `reportReference.${key}`);
    }
    if (!isRecord(input.body)) errors.push('body: missing record');
    else {
      for (const field of ['id', 'name']) requireText(input.body[field], `body.${field}`);
      requireChoice(input.body.origin, ['natural', 'artificial', 'unknown'], 'body.origin');
      requireChoice(input.body.designation, ['none', 'not-searched', 'pending', 'designated', 'expired', 'rejected'], 'body.designation');
      requireChoice(input.body.category, ['А', 'Б', 'В', 'Г', 'Д', 'undetermined'], 'body.category');
      for (const field of ['documentedUses', 'receptorIds', 'controlPointIds']) requireStrings(input.body[field], `body.${field}`);
      checkGate(input.body.designationEvidenceAndSafeguards, 'body.designationEvidenceAndSafeguards');
      checkGate(input.body.categoryEvidence, 'body.categoryEvidence');
    }
    requireStrings(input.questions, 'questions');
    for (const question of Array.isArray(input.questions) ? input.questions : []) {
      requireChoice(question, ['seasonal-regime', 'minimum-protection', 'habitat', 'water-quality', 'thermal-regime', 'receptor-state', 'service-duty'], 'questions');
    }
    requireChoice(input.priorityBasis, ['none', 'scheduled-priority', 'ecological-trigger'], 'priorityBasis');
    requireChoice(input.baselineBounds, ['not-tested', 'compatible', 'crossed'], 'baselineBounds');
    for (const component of COMPONENTS) requireChoice(input.applicability?.[component], ['applicable', 'not-applicable', 'unknown'], `applicability.${component}`);
    for (const tier of TIERS) for (const condition of ['specified', 'resourced']) {
      checkGate(input.availability?.[tier]?.[condition], `availability.${tier}.${condition}`);
    }
    for (const id of GATE_IDS) {
      const records = input.gates?.[id];
      if (!Array.isArray(records) || !records.length) errors.push(`gates.${id}: at least one gate record is required`);
      else records.forEach((gate, index) => checkGate(gate, `gates.${id}[${index}]`, INDICATIVE_STATISTICS.has(id)));
    }
    if (!isRecord(input.finalChecks)) errors.push('finalChecks: expected a route-keyed record');
    else for (const [route, checks] of Object.entries(input.finalChecks)) {
      requireChoice(route, ROUTES, 'finalChecks.route');
      for (const id of CHECK_IDS) {
        const value = checks?.[id];
        const path = `finalChecks.${route}.${id}`;
        if (!isRecord(value)) { errors.push(`${path}: missing final check`); continue; }
        if (typeof value.applicable !== 'boolean') errors.push(`${path}.applicable: expected a boolean`);
        requireChoice(value.state, ['not-assessed', 'pass', 'fail', 'indeterminate'], `${path}.state`);
        requireChoice(value.basis, ['participant-supplied'], `${path}.basis`);
        requireText(value.reason, `${path}.reason`);
        requireStrings(value.sourceIds, `${path}.sourceIds`);
        if (value.state !== 'not-assessed' && !value.sourceIds?.length) errors.push(`${path}.sourceIds: supplied finding needs a source`);
        if (value.screeningOnly !== undefined && (id !== 'member-selection' || typeof value.screeningOnly !== 'boolean')) {
          errors.push(`${path}.screeningOnly: allowed only as a member-selection boolean`);
        }
      }
    }
    if (!Array.isArray(input.existingDuties)) errors.push('existingDuties: expected an array');
    else input.existingDuties.forEach((duty, index) => {
      const path = `existingDuties[${index}]`;
      if (!isRecord(duty)) { errors.push(`${path}: missing record`); return; }
      requireText(duty.id, `${path}.id`);
      requireChoice(duty.state, ['authenticated-applicable', 'located-not-applicable', 'unresolved', 'none-located'], `${path}.state`);
      requireChoice(duty.recordStatus, ['workshop-placeholder', 'documented-record'], `${path}.recordStatus`);
      if (duty.recordStatus === 'documented-record' && !/^\d{4}-\d{2}-\d{2}$/.test(duty.searchDate ?? '')) {
        errors.push(`${path}.searchDate: a documented search needs its date`);
      } else if (duty.searchDate !== null && !/^\d{4}-\d{2}-\d{2}$/.test(duty.searchDate ?? '')) {
        errors.push(`${path}.searchDate: expected date or workshop-placeholder null`);
      }
      for (const field of ['current', 'authentic', 'applicable']) checkGate(duty[field], `${path}.${field}`);
      checkAction(duty.followUp, `${path}.followUp`);
    });
    const stipulations = Array.isArray(input.stipulations) ? input.stipulations : [];
    if (!Array.isArray(input.stipulations)) errors.push('stipulations: expected an array');
    stipulations.forEach((item, index) => {
      const path = `stipulations[${index}]`;
      if (!isRecord(item)) { errors.push(`${path}: missing record`); return; }
      for (const field of ['inputPath', 'assumption', 'currentReportStatus']) requireText(item[field], `${path}.${field}`);
      requireChoice(item.source?.artifact, [REPORT_REFERENCE.fileName], `${path}.source.artifact`);
      requireText(item.source?.distinctivePhrase, `${path}.source.distinctivePhrase`);
    });
    const stipulated = new Set(stipulations.filter(isRecord).map(item => item.inputPath));
    for (const id of NATIONAL_RULES) {
      if (!Array.isArray(input.gates?.[id]) || !input.gates[id].some(positive)) continue;
      if (input.mode === 'report-current') errors.push(`gates.${id}: report-current cannot adopt an unresolved national rule`);
      else if (input.mode === 'hypothetical-workshop' && !stipulated.has(`gates.${id}`)) errors.push(`gates.${id}: a named hypothetical stipulation is required`);
    }
    if (input.mode === 'report-current' && stipulations.length) errors.push('stipulations: report-current cannot carry hypothetical overrides');
    if (input.mode === 'hypothetical-workshop') for (const tier of TIERS) for (const condition of ['specified', 'resourced']) {
      const path = `availability.${tier}.${condition}`;
      if (positive(input.availability?.[tier]?.[condition]) && !stipulated.has(path)) errors.push(`${path}: a named hypothetical stipulation is required`);
    }
    return errors;
  }

  function evaluateWalkthrough(input) {
    const errors = validateWalkthrough(input);
    if (errors.length) throw new Error(`Invalid walkthrough input: ${errors.join('; ')}`);
    const pass = id => gatePass(input, id);
    const all = ids => ids.every(pass);
    const missing = ids => ids.filter(id => !pass(id)).flatMap(id => [
      `missing:${id}`,
      ...(INDICATIVE_STATISTICS.has(id) && input.gates[id].some(gate => positive(gate) && !gate.permittedUses.includes('sizing')) ? [`restricted:${id}`] : []),
    ]);
    const indicative = ids => ids.filter(id => input.gates[id].some(gate => gate.state === 'accepted-indicative')).map(id => `indicative:${id}`);
    const available = tier => strict(input.availability[tier].specified) && strict(input.availability[tier].resourced);
    const availabilityReasons = tier => ['specified', 'resourced'].filter(condition => !strict(input.availability[tier][condition])).map(condition => `unavailable:${tier}:${condition}`);
    const action = (description, ownerRole = 'owner-basin-lead', reviewTrigger = 'review-evidence-or-rule-change') => ({ description, ownerRole, reviewTrigger, reviewDate: null });
    const retained = input.existingDuties.filter(duty => duty.state === 'authenticated-applicable'
      && strict(duty.current) && strict(duty.authentic) && strict(duty.applicable));
    const result = {
      schemaVersion: input.schemaVersion, reportReference: clone(input.reportReference), mode: input.mode, bodyId: input.body.id,
      track: 'undetermined', objective: 'unresolved', selectedRoute: 'pending',
      selectedTier: null, dataSupportedTierIgnoringAvailability: null, outputKind: 'pending',
      outputBasis: 'pending', requirementScope: 'pending',
      completion: {state: 'indeterminate', status: 'pending', basis: 'participant-supplied', checks: []},
      readiness: [], attempts: [], overlays: [], retainedDutyIds: retained.map(duty => duty.id),
      dutyRecords: clone(input.existingDuties), monitoring: [], enforcement: null, actions: [], unresolvedNationalRules: [],
      simplifications: ['monitoring-evidence-tasks', 'route-record-not-passport', 'participant-supplied-checks'],
      stipulations: clone(input.stipulations), officialAssessment: false,
      ecologicalStatusFinding: null, legalFaultFinding: null, numericalResult: null, relatedExample: null,
    };
    if (input.body.id === 'S1') result.simplifications.push('s1-scenario-identity');
    const record = (route, outcome, reasons, anchors, checks) => {
      result.attempts.push({route, outcome, reasons: [...reasons], sources: anchors.map(source), ...(checks ? {checks: clone(checks)} : {})});
    };
    function completionFor(route) {
      const checks = routeChecks(input, route);
      const applicable = checks.filter(item => item.applicable);
      const failed = applicable.find(item => item.state === 'fail');
      const indeterminate = applicable.find(item => item.state === 'indeterminate');
      const unassessed = applicable.some(item => item.state === 'not-assessed');
      const screening = applicable.some(item => item.id === 'member-selection' && item.screeningOnly && item.state === 'not-assessed');
      return {
        state: failed ? 'fail' : indeterminate || unassessed ? 'indeterminate' : 'pass',
        status: failed || indeterminate ? 'pending' : screening ? 'single-member-screening' : unassessed ? 'candidate' : 'checks-reported-pass',
        basis: 'participant-supplied', checks,
      };
    }
    for (const route of ROUTES) {
      const ids = ROUTE_GATES[route];
      const tier = routeTier(route);
      let caseInputsSupplied = all(ids);
      if (route === 'service-conveyance') caseInputsSupplied &&= SERVICE_AUTHORITY_GATES.some(pass);
      const complete = completionFor(route);
      result.readiness.push({
        route, procedureSpecified: route === 'kazakh-baseline' || (tier ? strict(input.availability[tier].specified) : true),
        caseInputsSupplied,
        scientificSupport: !caseInputsSupplied || (route === 'kazakh-baseline' && input.baselineBounds === 'crossed') || complete.checks.some(item => item.applicable && ['fail', 'indeterminate'].includes(item.state)) ? 'not-accepted'
          : complete.status !== 'checks-reported-pass' ? 'not-assessed' : indicative(ids).length ? 'accepted-indicative' : 'accepted',
        officialIssuance: 'not-established',
      });
    }
    const rejected = new Set();
    function select(route, tier, outputKind, gates, anchors, extraReasons = []) {
      if (rejected.has(route)) return false;
      const complete = completionFor(route);
      const finalFailure = complete.checks.filter(item => item.applicable && ['fail', 'indeterminate'].includes(item.state));
      if (finalFailure.length) {
        rejected.add(route);
        record(route, complete.state === 'fail' ? 'final-check-failed' : 'final-check-indeterminate',
          finalFailure.map(item => `final-check:${item.id}:${item.state}`), [...anchors, 'checks'], complete.checks);
        return false;
      }
      result.selectedRoute = route;
      result.selectedTier = tier;
      result.outputKind = outputKind;
      result.outputBasis = NATURAL_REGIME_ROUTES.has(route) ? 'natural-regime'
        : route.startsWith('potential-') || route === 'service-conveyance' ? route : 'entry-floor';
      result.requirementScope = route === 'top' ? 'habitat-component-only'
        : outputKind === 'regime-candidate' ? 'regime-and-floor-candidate' : 'floor-only-candidate';
      result.completion = complete;
      if (route === 'top') result.simplifications.push('top-component-only');
      const completionReasons = complete.status === 'candidate' ? ['completion:not-assessed']
        : complete.status === 'single-member-screening' ? ['completion:single-member-screening'] : [];
      record(route, 'eligible', [`selected:${route}`, ...indicative(gates), ...extraReasons, ...completionReasons], anchors, complete.checks);
      if (complete.status !== 'checks-reported-pass') result.actions.push(action('action-complete-final-checks', 'owner-hydrologist'));
      return true;
    }
    const classification = [];
    if (input.body.origin === 'unknown') classification.push('classification:origin');
    if (['not-searched', 'pending'].includes(input.body.designation)) classification.push('classification:designation');
    if (input.body.designation === 'designated' && !strict(input.body.designationEvidenceAndSafeguards)) classification.push('classification:safeguards');
    if (classification.length) {
      record('pending', 'pending', classification, ['classification']);
      result.actions.push(action('action-resolve-classification', 'owner-competent-authority', 'review-authority-confirmation'));
    } else {
      const potential = input.body.origin === 'artificial' || input.body.designation === 'designated';
      result.track = potential ? 'ecological-potential' : 'natural-status';
      result.objective = potential ? 'ecological-potential' : 'ecological-status';
    }
    function fallback() {
      if (all(DONOR_GATES)) {
        if (select('donor-transfer', null, 'regime-candidate', DONOR_GATES, ['donor'])) return;
      } else record('donor-transfer', pass('donor-rules-register') ? 'data-failed' : 'unavailable', missing(DONOR_GATES), ['donor', 'fallback']);
      if (all(PRESUMPTIVE_GATES)) {
        if (select('presumptive-floor', null, 'floor-only-candidate', PRESUMPTIVE_GATES, ['fallback', 'floor'])) return;
      } else record('presumptive-floor', pass('presumptive-adopted-schedule') ? 'data-failed' : 'unavailable', missing(PRESUMPTIVE_GATES), ['fallback']);
      record('pending', 'pending', ['pending:no-computable-basis'], ['fallback']);
    }
    function naturalRoute() {
      if (all(TOP_GATES)) result.dataSupportedTierIgnoringAvailability = 'top';
      else if (all(BASELINE_STATISTICS)) result.dataSupportedTierIgnoringAvailability = 'baseline';
      else if (pass('domestic-statistic') || all(SWISS_GATES.filter(id => id !== 'swiss-adopted-table'))) result.dataSupportedTierIgnoringAvailability = 'entry';
      if (input.priorityBasis === 'none' || !pass('top-priority-or-trigger')) record('top', 'not-selected-for-top', ['priority:not-selected'], ['tier', 'top']);
      else if (!available('top')) record('top', 'unavailable', availabilityReasons('top'), ['tier']);
      else if (!all(TOP_GATES)) record('top', 'data-failed', missing(TOP_GATES), ['tier', 'indicative']);
      else {
        const crossed = input.baselineBounds === 'crossed';
        if (select('top', 'top', 'habitat-element-candidate', TOP_GATES, ['top', 'indicative'], crossed ? ['bounds:crossed', 'pending:full-regime'] : [])) {
          if (crossed) {
            record('kazakh-baseline', 'infeasible', ['bounds:crossed'], ['bounds']);
            result.actions.push(action('action-resolve-baseline-bounds', 'owner-hydrologist'));
          }
          return;
        }
      }
      if (!available('baseline')) record('kazakh-baseline', 'unavailable', availabilityReasons('baseline'), ['tier', 'readiness']);
      else if (!all(BASELINE_GATES)) record('kazakh-baseline', 'data-failed', missing(BASELINE_GATES), ['tier', 'indicative', 'safeguard']);
      else if (input.baselineBounds === 'crossed') {
        record('kazakh-baseline', 'infeasible', ['bounds:crossed'], ['bounds']);
        result.actions.push(action('action-resolve-baseline-bounds', 'owner-hydrologist'));
        fallback();
        return;
      } else if (input.baselineBounds !== 'compatible') record('kazakh-baseline', 'data-failed', ['bounds:not-tested'], ['bounds']);
      else if (select('kazakh-baseline', 'baseline', 'regime-candidate', BASELINE_GATES, ['tier', 'indicative', 'safeguard'])) return;
      if (!available('entry')) {
        record('domestic-entry', 'unavailable', availabilityReasons('entry'), ['tier', 'domestic']);
        record('swiss-entry', 'unavailable', availabilityReasons('entry'), ['tier', 'swiss']);
        fallback();
        return;
      }
      if (!pass('domestic-five-contracts')) record('domestic-entry', 'unavailable', ['missing:domestic-five-contracts'], ['domestic']);
      else if (!pass('domestic-sanitary-scope')) record('domestic-entry', 'not-applicable', ['missing:domestic-sanitary-scope'], ['domestic']);
      else if (!pass('domestic-statistic')) {
        record('domestic-entry', 'data-failed', missing(['domestic-statistic']), ['domestic']);
        fallback();
        return;
      } else if (select('domestic-entry', 'entry', 'floor-only-candidate', ROUTE_GATES['domestic-entry'], ['domestic', 'floor'])) return;
      if (all(SWISS_GATES)) {
        if (select('swiss-entry', 'entry', 'floor-only-candidate', SWISS_GATES, ['swiss', 'floor'])) return;
      } else record('swiss-entry', pass('swiss-adopted-table') ? 'data-failed' : 'unavailable', missing(SWISS_GATES), ['swiss']);
      fallback();
    }
    function potentialRoute() {
      for (const [route, gate] of [['potential-habitat', 'potential-habitat-route'], ['potential-hydraulics', 'potential-hydraulic-route']]) {
        if (pass(gate)) {
          if (select(route, null, 'seasonal-floor-only-candidate', [gate], ['potential'])) return;
        } else {
          const states = input.gates[gate].map(item => item.state);
          const outcome = states.includes('not-applicable') ? 'not-applicable' : states.includes('unavailable') ? 'unavailable' : 'data-failed';
          record(route, outcome, [`missing:${gate}`], ['potential']);
        }
      }
      const dutySource = SERVICE_AUTHORITY_GATES.find(pass) || null;
      const serviceMissing = missing(['carrier-service-duty', 'conveyance-loss']);
      if (!dutySource) serviceMissing.push('missing:operating-rule-or-approving-act', 'missing:permit-entitlement');
      if (!serviceMissing.length) {
        if (select('service-conveyance', null, 'seasonal-floor-only-candidate', ['carrier-service-duty', dutySource, 'conveyance-loss'], ['potential'])) return;
      } else record('service-conveyance', pass('carrier-service-duty') ? 'data-failed' : 'not-applicable', serviceMissing, ['potential']);
      record('pending', 'pending', ['pending:no-computable-basis'], ['potential']);
    }
    if (input.body.id === 'W1' && result.track !== 'undetermined') {
      result.selectedRoute = 'receptor-assessment';
      result.outputKind = 'receptor-assessment-candidate';
      result.outputBasis = 'receptor-state';
      result.requirementScope = 'receptor-only';
      result.completion.status = 'candidate';
      result.simplifications.push('w1-receptor-only');
      record('receptor-assessment', 'eligible', ['selected:receptor-assessment', 'pending:carrier-assessment'], ['receptor']);
      result.actions.push(action('action-assess-carrier-separately', 'owner-receptor-specialist'));
    } else if (result.track === 'natural-status') naturalRoute();
    else if (result.track === 'ecological-potential') potentialRoute();
    const categoryReady = input.body.category !== 'undetermined' && strict(input.body.categoryEvidence);
    if (!categoryReady) result.actions.push(action('action-confirm-category', 'owner-competent-authority', 'review-authority-confirmation'));
    const qualityGates = ['quality-targets', 'source-control', 'residual-dilution-prerequisites',
      'quality-feasibility-screen', 'quality-fisheries-limits', 'quality-grouping-approved', 'quality-basin-salt-budget', 'quality-transport-model-approved'];
    for (const kind of COMPONENTS) {
      const applicability = input.applicability[kind];
      const active = applicability !== 'not-applicable';
      let state = active ? 'unassessed' : 'inactive';
      let reasons = active ? [applicability === 'unknown' ? `unknown-applicability:${kind}` : `unassessed:${kind}`] : [`inactive:${kind}`];
      if (applicability === 'applicable' && kind === 'quality') {
        state = !categoryReady || !pass('quality-targets') ? 'target-pending' : all(qualityGates) ? 'assessment-supported' : 'unsized';
        reasons = [...(!categoryReady ? [input.body.category === 'undetermined' ? 'category:undetermined' : 'category:evidence'] : []), ...missing(qualityGates)];
      } else if (applicability === 'applicable' && kind === 'thermal') {
        state = pass('thermal-target-and-evidence') ? 'assessment-supported' : 'unsized';
        reasons = missing(['thermal-target-and-evidence']);
      } else if (applicability === 'applicable' && kind === 'receptor') {
        state = pass('receptor-targets-pathways-and-sizing') && input.body.receptorIds.length ? 'assessment-supported' : 'unsized';
        reasons = [...missing(['receptor-targets-pathways-and-sizing']), ...(!input.body.receptorIds.length ? ['missing:receptor-identity'] : [])];
      }
      if (!reasons.length) reasons = [`supported:${kind}`];
      const owner = kind === 'quality' ? 'owner-quality-specialist' : kind === 'thermal' ? 'owner-thermal-specialist'
        : kind === 'receptor' ? 'owner-receptor-specialist' : 'owner-ecologist';
      const actions = active ? [action(`action-resolve-${kind}`, owner)] : [];
      const receptors = kind === 'receptor' && input.body.receptorIds.length ? input.body.receptorIds : [null];
      for (const receptorId of receptors) result.overlays.push({kind, applicability, ...(receptorId ? {receptorId} : {}), state, reasons: [...reasons], actions: clone(actions)});
    }
    for (const item of MONITORING) {
      if (COMPONENTS.includes(item.kind) && input.applicability[item.kind] === 'not-applicable') continue;
      if (item.kind === 'habitat' && result.track === 'undetermined' && !input.questions.includes('habitat')) continue;
      result.monitoring.push({purpose: item.purpose, controlPointIds: [...input.body.controlPointIds], evidenceNeeded: [...item.evidence],
        action: action(`action-monitor-${item.kind}`, item.owner, 'review-new-evidence-or-changed-pressures')});
    }
    if (!input.body.controlPointIds.length) result.actions.push(action('action-confirm-control-points', 'owner-competent-authority', 'review-authority-confirmation'));
    const commonGates = ['designated-control-points', 'monitoring-evidence-admission'];
    const authorityGates = ['operator-control-evidence', 'legal-powers'];
    const dutySupplied = pass('issued-obligation') || retained.length > 0;
    const deliveryMissing = [...(!dutySupplied ? ['missing:issued-obligation'] : []), ...missing(commonGates)];
    const floorMissing = missing(['applicable-floor', ...commonGates, ...authorityGates, 'floor-abstraction-and-but-for-evidence', 'causal-attribution-evidence']);
    if (!input.body.controlPointIds.length) {
      deliveryMissing.push('missing:control-point-identity');
      floorMissing.push('missing:control-point-identity');
    }
    const floorOnly = result.requirementScope === 'floor-only-candidate';
    result.enforcement = {
      deliveryTest: deliveryMissing.length === 0 ? 'prerequisites-listed' : floorOnly && !dutySupplied ? 'no-obligation-from-floor' : 'pending',
      floorConductTest: floorMissing.length === 0 ? 'prerequisites-listed' : 'pending',
      deliveryMissingPrerequisites: deliveryMissing, floorMissingPrerequisites: floorMissing,
      missingPrerequisites: [...new Set([...deliveryMissing, ...floorMissing])],
      derivedDeliveryObligation: result.track === 'ecological-potential' ? 'pending' : 'not-derived-by-this-tab',
      action: 'technical-record-and-referral-only',
    };
    result.actions.push(action('action-review-route', 'owner-basin-lead', 'review-new-evidence-or-changed-pressures'));
    result.actions.push(action('action-complete-duty-register', 'owner-competent-authority', 'review-authority-confirmation'));
    result.actions.push(...input.existingDuties.map(duty => clone(duty.followUp)));
    if (!all(authorityGates)) result.actions.push(action('action-confirm-authority', 'owner-competent-authority', 'review-authority-confirmation'));
    for (const overlay of result.overlays) result.actions.push(...clone(overlay.actions));
    for (const id of NATIONAL_RULES) if (!pass(id)) result.unresolvedNationalRules.push({reason: `missing:${id}`, source: source(id.startsWith('domestic') ? 'domestic' : id.startsWith('swiss') ? 'swiss' : 'fallback')});
    if (input.body.id === 'R2' && result.selectedRoute !== 'pending') {
      const method = ['kazakh-baseline', 'donor-transfer'].includes(result.selectedRoute) ? 'kazakh'
        : ['swiss-entry', 'domestic-entry', 'presumptive-floor'].includes(result.selectedRoute) ? 'swiss' : 'site';
      result.relatedExample = {bodyId: 'R2', purpose: 'illustration-only', method};
    }
    return result;
  }

  function inspectRoute(input, route) {
    if (![...ROUTES, 'receptor-assessment', 'pending'].includes(route)) {
      throw new Error(`Unknown inspection route: ${route}`);
    }
    // Evaluate once and explain its trace; inspection never changes the chosen route.
    const result = evaluateWalkthrough(input);
    const attempts = result.attempts.filter(item => item.route === route);
    const otherTrack = result.track === 'undetermined'
      || (input.body.id === 'W1' ? route !== 'receptor-assessment' && route !== 'pending'
        : route === 'receptor-assessment'
          || (ROUTES.slice(0, 6).includes(route) && result.track !== 'natural-status')
          || (ROUTES.slice(6).includes(route) && result.track !== 'ecological-potential'));
    const disposition = route === result.selectedRoute ? 'selected' : attempts.length ? 'skipped'
      : otherTrack ? 'other-track' : 'not-reached';
    const directFallback = result.selectedRoute !== 'top' && (
      (['domestic-entry', 'swiss-entry'].includes(route)
        && result.attempts.some(item => item.route === 'kazakh-baseline' && item.outcome === 'infeasible'))
      || (route === 'swiss-entry'
        && result.attempts.some(item => item.route === 'domestic-entry' && item.outcome === 'data-failed')));
    const reasons = attempts.length ? attempts.flatMap(item => item.reasons)
      : [otherTrack ? 'inspection:other-track' : directFallback ? 'inspection:direct-fallback' : 'inspection:not-reached'];
    const required = route === 'pending'
      ? [...new Set(result.attempts.flatMap(item => item.reasons)
        .filter(reason => reason.startsWith('missing:'))
        .map(reason => reason.slice('missing:'.length))
        .filter(id => GATE_IDS.includes(id) && !gatePass(input, id)))]
      : [...(route === 'top' ? ['top-priority-or-trigger'] : []), ...ROUTE_GATES[route],
        ...(route === 'service-conveyance' ? SERVICE_AUTHORITY_GATES : [])];
    const requiredGates = required.map(id => ({
      id, satisfied: gatePass(input, id) && (id !== 'top-priority-or-trigger' || input.priorityBasis !== 'none'),
      records: input.gates[id], group: SERVICE_AUTHORITY_GATES.includes(id) ? 'any-authority' : 'all',
    }));
    const tier = routeTier(route);
    return clone({
      route, bodyId: result.bodyId, disposition, selectedRoute: result.selectedRoute,
      attempts, reasons, requiredGates,
      availability: tier ? {tier, ...input.availability[tier]} : null,
      finalChecks: ROUTES.includes(route) ? routeChecks(input, route) : [],
      readiness: result.readiness.find(item => item.route === route) || null,
      baselineBounds: ['top', 'kazakh-baseline'].includes(route) ? input.baselineBounds : null,
    });
  }

  const api = Object.freeze({validateWalkthrough, evaluateWalkthrough, inspectRoute, textKeys: TEXT_KEYS});
  root.RouteEngine = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
