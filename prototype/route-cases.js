'use strict';
(function (root) {
  const reportReference = {
    fileName:'report_review_2026-09-20__shared_with_NCECC.docx',
    sha256:'51de55c8473548a536d3fd860948b928183dcdd6470df4721246c0bf1b3bfedc',
    referenceRole:'shared-report-alignment-reference'
  };
  const gateIds = [
    'top-priority-or-trigger', 'natural-reconstruction', 'annual-exceedance-set', 'seasonal-hydrographs',
    'low-flow-risk-statistic', 'multi-day-safeguard-configuration', 'ecological-drought-rule', 'daily-bounds-inputs',
    'habitat-hydraulics', 'domestic-five-contracts', 'domestic-sanitary-scope', 'domestic-statistic',
    'swiss-adopted-table', 'swiss-daily-statistic', 'swiss-daily-resolution', 'swiss-floor-below-input',
    'swiss-large-river-screen', 'donor-rules-register', 'donor-qualification', 'receiving-series',
    'presumptive-adopted-schedule', 'present-climate-daily-reference', 'potential-habitat-route',
    'potential-hydraulic-route', 'carrier-service-duty', 'operating-rule-or-approving-act', 'permit-entitlement',
    'conveyance-loss', 'quality-targets', 'source-control', 'residual-dilution-prerequisites',
    'thermal-target-and-evidence', 'receptor-targets-pathways-and-sizing', 'issued-obligation',
    'designated-control-points', 'monitoring-evidence-admission', 'operator-control-evidence',
    'floor-abstraction-and-but-for-evidence', 'legal-powers', 'applicable-floor', 'causal-attribution-evidence',
    'quality-feasibility-screen', 'quality-fisheries-limits', 'quality-grouping-approved',
    'quality-basin-salt-budget', 'quality-transport-model-approved'
  ];
  const nationalRules = new Set(['domestic-five-contracts', 'swiss-adopted-table',
    'donor-rules-register', 'presumptive-adopted-schedule']);
  const statisticalGates = new Set(['natural-reconstruction', 'annual-exceedance-set', 'seasonal-hydrographs',
    'low-flow-risk-statistic', 'daily-bounds-inputs', 'habitat-hydraulics', 'domestic-statistic',
    'swiss-daily-statistic', 'receiving-series', 'present-climate-daily-reference', 'conveyance-loss']);
  const baselineStatistics = ['natural-reconstruction', 'annual-exceedance-set', 'seasonal-hydrographs',
    'low-flow-risk-statistic', 'daily-bounds-inputs'];
  const swiss = ['swiss-adopted-table', 'swiss-daily-statistic', 'swiss-daily-resolution',
    'swiss-floor-below-input', 'swiss-large-river-screen'];
  const components = ['quality', 'thermal', 'receptor', 'sediment', 'connectivity', 'groundwater'];
  const sizingRoutes = ['top', 'kazakh-baseline', 'domestic-entry', 'swiss-entry', 'donor-transfer',
    'presumptive-floor', 'potential-habitat', 'potential-hydraulics', 'service-conveyance'];
  const checkIds = ['assembly', 'safeguard', 'member-selection', 'cross-class-floor', 'applicable-conditions'];
  const bodyDefinitions = {
    R1:{name:'Upstream river', origin:'natural', uses:['irrigation', 'fish habitat']},
    S1:{name:'Reservoir', origin:'natural', uses:['storage', 'regulated releases']},
    R2:{name:'Downstream river', origin:'natural', uses:['irrigation', 'fish habitat']},
    C1:{name:'Irrigation canal', origin:'artificial', uses:['irrigation conveyance']},
    D1:{name:'Drainage return', origin:'artificial', uses:['drainage conveyance']},
    W1:{name:'Valley wetland', origin:'natural', uses:['wetland habitat']}
  };
  const options = {
    bodyId:Object.keys(bodyDefinitions), mode:['report-current', 'hypothetical-workshop'],
    flowEvidence:['full', 'indicative', 'indicative-prohibited', 'daily-only', 'monthly-only', 'none', 'crossed-bounds'],
    category:['undetermined', 'А', 'Б', 'В', 'Г', 'Д'],
    question:['seasonal-regime', 'minimum-protection', 'habitat', 'water-quality', 'thermal-regime', 'receptor-state', 'service-duty'],
    designation:['none', 'not-searched', 'pending', 'designated', 'expired', 'rejected'],
    priorityBasis:['none', 'scheduled-priority', 'ecological-trigger'],
    finalCheckRoute:[...sizingRoutes],
    finalAssessment:['not-assessed', 'pass', 'safeguard-fail', 'safeguard-indeterminate',
      'member-selection-indeterminate', 'single-member-screening', 'cross-class-fail', 'conditions-fail'],
    ...Object.fromEntries(components.map(component => [`${component}Applicability`, ['applicable', 'not-applicable', 'unknown']])),
    dutyState:['authenticated-applicable', 'located-not-applicable', 'unresolved', 'none-located'],
    legalAuthority:['existing-confirmed', 'applicability-unresolved', 'additional-power-needed']
  };
  const booleans = ['habitatEvidence', 'hydraulicEvidence', 'serviceEvidence', 'donor', 'presumptive',
    'qualityEvidence', 'thermalEvidence', 'receptorEvidence', 'enforcementEvidence', 'domesticEvidence',
    'deliveryDutyEvidence', 'floorDutyEvidence'];
  function defaults(bodyId = 'R2') {
    const id = options.bodyId.includes(bodyId) ? bodyId : 'R2';
    return {bodyId:id, mode:'report-current', flowEvidence:'full', category:'undetermined',
      question:id === 'W1' ? 'receptor-state' : ['C1', 'D1'].includes(id) ? 'service-duty' : 'seasonal-regime',
      designation:id === 'S1' ? 'pending' : 'none', priorityBasis:'none',
      finalCheckRoute:'kazakh-baseline', finalAssessment:'not-assessed', dutyState:'unresolved',
      legalAuthority:'applicability-unresolved',
      ...Object.fromEntries(components.map(component => [`${component}Applicability`, component === 'receptor' && id === 'W1' ? 'applicable' : 'unknown'])),
      ...Object.fromEntries(booleans.map(key => [key, false]))};
  }
  function normalize(supplied = {}) {
    const result = defaults(supplied.bodyId);
    for (const [key, values] of Object.entries(options)) if (values.includes(supplied[key])) result[key] = supplied[key];
    for (const key of booleans) result[key] = supplied[key] === true;
    return result;
  }
  function gate(state, reason, id, permittedUses = []) {
    return {state, reason, sourceIds:['workshop-participant-input'],
      ...(statisticalGates.has(id) ? {permittedUses:[...permittedUses]} : {})};
  }
  function finalChecks(chosen) {
    const checks = Object.fromEntries(sizingRoutes.map(route => [route,
      Object.fromEntries(checkIds.map(id => [id, {
        applicable:['assembly', 'applicable-conditions'].includes(id)
          || (id === 'safeguard' && route === 'kazakh-baseline')
          || (['member-selection', 'cross-class-floor'].includes(id) && ['top', 'kazakh-baseline', 'donor-transfer'].includes(route)),
        state:'not-assessed', basis:'participant-supplied', sourceIds:['workshop-participant-input'],
        reason:`Participant has not supplied a final ${id} finding for ${route}.`
      }]))]));
    const selected = checks[chosen.finalCheckRoute];
    if (chosen.finalAssessment === 'pass') {
      for (const [id, check] of Object.entries(selected)) if (check.applicable) {
        check.state = 'pass';
        check.reason = `Participant reports the final ${id} check passed for ${chosen.finalCheckRoute}; the tab does not calculate it.`;
      }
    } else if (chosen.finalAssessment !== 'not-assessed') {
      const assessment = {
        'safeguard-fail':['safeguard', 'fail'],
        'safeguard-indeterminate':['safeguard', 'indeterminate'],
        'member-selection-indeterminate':['member-selection', 'indeterminate'],
        'single-member-screening':['member-selection', 'not-assessed'],
        'cross-class-fail':['cross-class-floor', 'fail'],
        'conditions-fail':['applicable-conditions', 'fail']
      }[chosen.finalAssessment];
      const [id, state] = assessment;
      selected[id].state = state;
      selected[id].reason = `Participant supplies ${chosen.finalAssessment} for ${chosen.finalCheckRoute}; applicability remains separately recorded.`;
      if (chosen.finalAssessment === 'single-member-screening') selected[id].screeningOnly = true;
    }
    return checks;
  }
  function dutyRecord(chosen) {
    const state = chosen.dutyState;
    const located = ['authenticated-applicable', 'located-not-applicable'].includes(state);
    const unresolved = state === 'unresolved';
    return {
      id:`${chosen.bodyId}-workshop-duty-search`, state, recordStatus:'workshop-placeholder', searchDate:null,
      current:gate(located ? 'accepted' : unresolved ? 'unknown' : 'not-applicable',
        'Workshop placeholder for currency of the located duty; no dated search is asserted.'),
      authentic:gate(located ? 'accepted' : unresolved ? 'unknown' : 'not-applicable',
        'Workshop placeholder for authentication; the actual instrument and search record remain to be attached.'),
      applicable:gate(state === 'authenticated-applicable' ? 'accepted' : unresolved ? 'unknown' : 'not-applicable',
        `Workshop duty search outcome: ${state}. This placeholder is not proof of absence of a duty.`),
      followUp:{description:`action-duty-${state}`, ownerRole:'owner-competent-authority',
        reviewTrigger:'review-duty-register-updated', reviewDate:null}
    };
  }
  function createInput(supplied = {}) {
    const chosen = normalize(supplied), definition = bodyDefinitions[chosen.bodyId];
    const hypothetical = chosen.mode === 'hypothetical-workshop';
    const hydrologyState = chosen.flowEvidence.startsWith('indicative') ? 'accepted-indicative' : 'accepted';
    const hydrologyUses = chosen.flowEvidence === 'indicative-prohibited'
      ? ['screening', 'diagnostic'] : ['sizing', 'screening', 'diagnostic'];
    const input = {
      schemaVersion:'eflow-route-proposal/2', mode:chosen.mode, reportVersion:reportReference.fileName,
      reportReference:{...reportReference}, stipulations:[],
      body:{id:chosen.bodyId, name:definition.name, origin:definition.origin, designation:chosen.designation,
        designationEvidenceAndSafeguards:gate(chosen.designation === 'designated' ? 'accepted' : 'not-applicable',
          chosen.designation === 'designated' ? 'Participant supplies a valid designation and safeguards for this workshop case.' : 'No valid designation asserted.'),
        documentedUses:[...definition.uses], category:chosen.category,
        categoryEvidence:gate(chosen.category === 'undetermined' ? 'unknown' : 'accepted', 'Workshop category selection; authority confirmation remains separate.'),
        receptorIds:chosen.bodyId === 'W1' ? ['W1'] : [], controlPointIds:[`${chosen.bodyId}-assessment-point`]},
      questions:[chosen.question], priorityBasis:chosen.priorityBasis,
      applicability:Object.fromEntries(components.map(component => [component, chosen[`${component}Applicability`]])),
      existingDuties:[dutyRecord(chosen)], finalChecks:finalChecks(chosen),
      availability:Object.fromEntries(['top', 'baseline', 'entry'].map(tier => [tier, {
        specified:gate('accepted', tier === 'baseline'
          ? 'The shared report specifies the proposed Uzbek baseline procedures; case inputs, scientific suitability and official issuance remain separate.'
          : `The shared report specifies the ${tier === 'top' ? 'habitat component illustrated by this tab' : 'entry procedures'}; official issuance is not established.`),
        resourced:gate('accepted', 'Participant assumes assessment resources are available for the workshop case.')
      }])),
      gates:Object.fromEntries(gateIds.map(id => [id, [gate('unavailable', `No accepted case evidence supplied: ${id}.`, id)]])),
      baselineBounds:chosen.flowEvidence === 'crossed-bounds' ? 'crossed'
        : ['full', 'indicative', 'indicative-prohibited'].includes(chosen.flowEvidence) ? 'compatible' : 'not-tested'
    };
    function stipulate(id, assumption) {
      const inputPath = `gates.${id}`;
      if (input.stipulations.some(item => item.inputPath === inputPath)) return;
      const phrases = {
        'multi-day-safeguard-configuration':'D.5: The daily-mapping gap is thereby replaced by a specified multi-day assessment procedure.',
        'swiss-adopted-table':'Appendix A, step 6: The entry-tier floor table',
        'domestic-five-contracts':'Appendix A, step 6: all five contracts',
        'donor-rules-register':'Appendix A, step 7: What transfers is the relationship, never the discharge',
        'presumptive-adopted-schedule':'Appendix A, step 7: presumptive floor'
      };
      input.stipulations.push({inputPath, assumption,
        currentReportStatus:nationalRules.has(id)
          ? 'The shared report proposes this national setting; it does not establish adoption or applicability to this case.'
          : 'The shared report specifies the procedure; this workshop supplies a case configuration, not a calculated or officially accepted finding.',
        source:{artifact:reportReference.fileName, distinctivePhrase:phrases[id]}});
    }
    function accept(ids, state = 'accepted', permittedUses = ['sizing', 'screening', 'diagnostic']) {
      for (const id of ids) {
        if (nationalRules.has(id) && !hypothetical) {
          input.gates[id] = [gate('unavailable', `The shared report does not establish adoption of the proposed national setting: ${id}.`, id)];
        } else {
          const admittedState = statisticalGates.has(id) ? state : 'accepted';
          input.gates[id] = [gate(admittedState,
            `Participant supplies ${admittedState === 'accepted-indicative' ? 'indicative ' : ''}case evidence for ${id}; permitted use and official issuance remain distinct.`,
            id, permittedUses)];
          if (nationalRules.has(id)) stipulate(id, `Assume the proposed ${id} setting is adopted and applicable to this workshop case.`);
        }
      }
    }
    if (hypothetical) {
      for (const tier of ['top', 'baseline', 'entry']) for (const condition of ['specified', 'resourced']) {
        input.stipulations.push({inputPath:`availability.${tier}.${condition}`,
          assumption:condition === 'specified'
            ? `Use the report's specified ${tier === 'top' ? 'habitat component illustration' : `${tier} procedure`} for this workshop case; this is not an adoption or issuance claim.`
            : `Assume resources are available for the ${tier} assessment in this workshop case.`,
          currentReportStatus:'The report specifies the proposed procedures; case applicability, resources, scientific suitability and official issuance remain separate.',
          source:{artifact:reportReference.fileName,
            distinctivePhrase:tier === 'baseline' ? 'Section 4.2: The baseline procedures are specified'
              : 'Appendix A, step 5: highest ELIGIBLE tier'}});
      }
      accept(['multi-day-safeguard-configuration', 'swiss-adopted-table']);
      stipulate('multi-day-safeguard-configuration',
        'Assume case-specific section/reference member, daily boundaries, duration, season, return period, estimator, reference period, coverage, predecessor context, adequacy and uncertainty are specified.');
    }
    if (['full', 'indicative', 'indicative-prohibited', 'crossed-bounds'].includes(chosen.flowEvidence)) {
      accept(baselineStatistics, hydrologyState, hydrologyUses);
      accept(['multi-day-safeguard-configuration']);
      accept(swiss, hydrologyState, hydrologyUses);
    } else if (chosen.flowEvidence === 'daily-only') accept(swiss);
    else if (chosen.flowEvidence === 'monthly-only') accept(['seasonal-hydrographs']);
    input.gates['ecological-drought-rule'] = [gate('unavailable',
      'No separate drought depth, duration or recovery assessment supplied. The multi-day safeguard creates no drought exception.', 'ecological-drought-rule')];
    input.gates['top-priority-or-trigger'] = [gate(chosen.priorityBasis === 'none' ? 'not-applicable' : 'accepted',
      chosen.priorityBasis === 'scheduled-priority' ? 'Participant supplies scheduled priority for a habitat component assessment.'
        : chosen.priorityBasis === 'ecological-trigger' ? 'Participant supplies a demonstrated ecological trigger for a habitat component assessment.'
          : 'No scheduled top-tier priority or demonstrated ecological trigger supplied.')];
    if (chosen.habitatEvidence) accept(['habitat-hydraulics', 'potential-habitat-route']);
    if (chosen.hydraulicEvidence) accept(['potential-hydraulic-route']);
    if (chosen.serviceEvidence) accept(['carrier-service-duty', 'operating-rule-or-approving-act', 'conveyance-loss']);
    if (chosen.domesticEvidence) {
      accept(['domestic-five-contracts', 'domestic-sanitary-scope']);
      if (['full', 'indicative', 'indicative-prohibited', 'daily-only', 'crossed-bounds'].includes(chosen.flowEvidence)) {
        accept(['domestic-statistic'], hydrologyState, hydrologyUses);
      }
    }
    if (chosen.donor) accept(['donor-rules-register', 'donor-qualification', 'receiving-series']);
    if (chosen.presumptive) accept(['presumptive-adopted-schedule', 'present-climate-daily-reference']);
    if (chosen.qualityEvidence) accept(['quality-targets', 'source-control', 'residual-dilution-prerequisites',
      'quality-feasibility-screen', 'quality-fisheries-limits', 'quality-grouping-approved',
      'quality-basin-salt-budget', 'quality-transport-model-approved']);
    if (chosen.thermalEvidence) accept(['thermal-target-and-evidence']);
    if (chosen.receptorEvidence) accept(['receptor-targets-pathways-and-sizing']);
    if (chosen.enforcementEvidence) accept(['designated-control-points', 'monitoring-evidence-admission',
      'operator-control-evidence', 'floor-abstraction-and-but-for-evidence', 'causal-attribution-evidence']);
    if (chosen.deliveryDutyEvidence) accept(['issued-obligation']);
    if (chosen.floorDutyEvidence) accept(['applicable-floor']);
    input.gates['legal-powers'] = [gate(chosen.legalAuthority === 'existing-confirmed' ? 'accepted'
      : chosen.legalAuthority === 'applicability-unresolved' ? 'unknown' : 'unavailable',
    chosen.legalAuthority === 'existing-confirmed' ? 'Participant supplies verified existing powers applicable to the proposed action; the tab makes no legal finding.'
      : chosen.legalAuthority === 'applicability-unresolved' ? 'Existing powers may apply, but their applicability to this action remains unresolved.'
        : 'This proposed action requires an additional power that has not been established; existing lawful powers are not cancelled.')];
    return input;
  }
  const api = {createInput, defaults, normalize, options, booleans};
  root.RouteCases = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
