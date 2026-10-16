const GATE_IDS = [
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
];

const BASELINE_DATA = [
  'natural-reconstruction', 'annual-exceedance-set', 'seasonal-hydrographs',
  'low-flow-risk-statistic', 'multi-day-safeguard-configuration',
  'daily-bounds-inputs',
];
const SWISS_DATA = [
  'swiss-adopted-table', 'swiss-daily-statistic', 'swiss-daily-resolution',
  'swiss-floor-below-input', 'swiss-large-river-screen',
];
const NATIONAL_RULES = new Set([
  'domestic-five-contracts', 'swiss-adopted-table',
  'donor-rules-register', 'presumptive-adopted-schedule',
]);
const REPORT_REFERENCE = {
  fileName: 'report_review_2026-09-20__shared_with_NCECC.docx',
  sha256: '51de55c8473548a536d3fd860948b928183dcdd6470df4721246c0bf1b3bfedc',
  referenceRole: 'shared-report-alignment-reference',
};
const CHECK_IDS = ['assembly', 'safeguard', 'member-selection', 'cross-class-floor', 'applicable-conditions'];
const ROUTES = [
  'top', 'kazakh-baseline', 'domestic-entry', 'swiss-entry', 'donor-transfer',
  'presumptive-floor', 'potential-habitat', 'potential-hydraulics', 'service-conveyance',
];

function gate(state = 'accepted', reason = 'Accepted evidence for this workshop case') {
  return { state, reason, sourceIds: ['case-evidence-2026-10-16'], permittedUses: ['sizing'] };
}

function check(state = 'not-assessed', applicable = true) {
  return { state, applicable, basis: 'participant-supplied', sourceIds: ['case-final-checks'],
    reason: 'Participant-supplied assessment; this tab does not calculate a check.' };
}

function routeChecks(route) {
  return Object.fromEntries(CHECK_IDS.map(id => [id, check('not-assessed',
    !(['safeguard'].includes(id) && route !== 'kazakh-baseline')
    && !(['member-selection', 'cross-class-floor'].includes(id)
      && !['top', 'kazakh-baseline', 'donor-transfer'].includes(route)))]));
}

function duty(id, state = 'authenticated-applicable') {
  return {
    id, state, current: gate(), authentic: gate(),
    applicable: gate(state === 'authenticated-applicable' ? 'accepted' : 'unknown'),
    searchDate: null, recordStatus: 'workshop-placeholder',
    followUp: { description: 'Complete and authenticate the Step 3 duty register',
      ownerRole: 'owner-competent-authority', reviewTrigger: 'review-authority-confirmation', reviewDate: null },
  };
}

function stipulate(input, inputPath, assumption) {
  input.stipulations = input.stipulations.filter(item => item.inputPath !== inputPath);
  input.stipulations.push({
    inputPath,
    assumption,
    currentReportStatus: 'The report has not established or adopted this condition for this case.',
    source: {
      artifact: REPORT_REFERENCE.fileName,
      distinctivePhrase: 'Section 4.2: Calculation and official use remain separate',
    },
  });
  return input;
}

function setGate(input, id, state = 'accepted', reason) {
  input.gates[id] = [gate(state, reason)];
  if (input.mode === 'hypothetical-workshop' && NATIONAL_RULES.has(id)
      && ['accepted', 'accepted-indicative'].includes(state)) {
    stipulate(input, `gates.${id}`, `Assume ${id} is specified, adopted and applicable to this workshop case.`);
  }
  return input;
}

function hypothetical() {
  const input = {
    schemaVersion: 'eflow-route-proposal/2',
    mode: 'hypothetical-workshop',
    reportVersion: REPORT_REFERENCE.fileName,
    reportReference: { ...REPORT_REFERENCE },
    stipulations: [],
    body: {
      id: 'R1', name: 'Natural irrigation river', origin: 'natural', designation: 'none',
      designationEvidenceAndSafeguards: gate('not-applicable', 'No designation is claimed'),
      documentedUses: ['irrigation', 'fish habitat'], category: 'undetermined',
      categoryEvidence: gate('unknown', 'Category assessment remains pending'),
      receptorIds: [], controlPointIds: ['R1-downstream-control'],
    },
    questions: ['seasonal-regime'], existingDuties: [],
    priorityBasis: 'none',
    applicability: Object.fromEntries(['quality', 'thermal', 'receptor', 'sediment', 'connectivity', 'groundwater']
      .map(component => [component, 'unknown'])),
    finalChecks: Object.fromEntries(ROUTES.map(route => [route, routeChecks(route)])),
    availability: Object.fromEntries(['top', 'baseline', 'entry'].map(tier => [tier, {
      specified: gate(), resourced: gate(),
    }])),
    gates: Object.fromEntries(GATE_IDS.map(id => [id, [gate('unavailable', `No accepted ${id} evidence supplied`)]])),
    baselineBounds: 'compatible',
  };
  for (const tier of ['top', 'baseline', 'entry']) {
    stipulate(input, `availability.${tier}.specified`, `Assume ${tier} method contracts are fully specified.`);
    stipulate(input, `availability.${tier}.resourced`, `Assume ${tier} assessment resources are available.`);
  }
  for (const id of BASELINE_DATA) setGate(input, id);
  setGate(input, 'top-priority-or-trigger', 'not-applicable', 'No priority designation or escalation trigger');
  return input;
}

function current() {
  const input = hypothetical();
  input.mode = 'report-current';
  input.stipulations = [];
  input.availability.baseline.specified = gate('accepted', 'Shared report Section 4.2 specifies the baseline procedure');
  setGate(input, 'natural-reconstruction', 'unavailable', 'The case reference reconstruction has not been supplied');
  setGate(input, 'multi-day-safeguard-configuration', 'unavailable', 'The specified multi-day procedure needs case configuration');
  return input;
}

function swiss() {
  const input = hypothetical();
  setGate(input, 'annual-exceedance-set', 'not-accepted', 'Annual exceedance set cannot be estimated defensibly');
  for (const id of SWISS_DATA) setGate(input, id);
  return input;
}

function artificial() {
  const input = hypothetical();
  input.body.id = 'C1';
  input.body.name = 'Constructed drinking-water canal';
  input.body.origin = 'artificial';
  input.body.documentedUses = ['drinking-water supply'];
  input.body.controlPointIds = ['C1-terminal-control'];
  input.questions = ['service-duty'];
  return input;
}

function allowDonor(input) {
  for (const id of ['donor-rules-register', 'donor-qualification', 'receiving-series']) setGate(input, id);
  return input;
}

function allowPresumptive(input) {
  for (const id of ['presumptive-adopted-schedule', 'present-climate-daily-reference']) setGate(input, id);
  return input;
}

function allowService(input) {
  for (const id of ['carrier-service-duty', 'operating-rule-or-approving-act', 'conveyance-loss']) setGate(input, id);
  return input;
}

module.exports = {
  GATE_IDS, BASELINE_DATA, SWISS_DATA, REPORT_REFERENCE, CHECK_IDS, gate, check, routeChecks, duty, stipulate, setGate,
  hypothetical, current, swiss, artificial, allowDonor, allowPresumptive, allowService,
};
