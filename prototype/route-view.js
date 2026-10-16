'use strict';
(function (root) {
  let choices = null, incomingBody = null, independentBody = false, rerender = null, connected = false, inspectedRoute = null;
  const disclosures = new Set();
  const finalAssessments = new Map();
  const escape = value => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[character]));
  function buildInput() {
    const input = root.RouteCases.createInput(choices || {});
    for (const [route, assessment] of finalAssessments) {
      const record = root.RouteCases.createInput({...choices, finalCheckRoute:route, finalAssessment:assessment});
      input.finalChecks[route] = record.finalChecks[route];
    }
    return input;
  }
  function captureDisclosures() {
    for (const disclosure of root.document?.querySelectorAll?.('#route-walkthrough details[data-route-details]') || []) {
      const key = disclosure.dataset.routeDetails;
      if (disclosure.open) disclosures.add(key); else disclosures.delete(key);
    }
  }
  function render(language = 'en', bodyId = 'R2') {
    captureDisclosures();
    const cases = root.RouteCases, catalog = root.RouteCatalog, engine = root.RouteEngine;
    if (!choices) {
      choices = cases.defaults(bodyId);
      finalAssessments.set(choices.finalCheckRoute, choices.finalAssessment);
    }
    if (!independentBody && incomingBody !== bodyId) {
      inspectedRoute = null;
      const defaults = cases.defaults(bodyId);
      finalAssessments.clear();
      choices = {...choices, bodyId:defaults.bodyId, designation:defaults.designation, question:defaults.question,
        finalCheckRoute:defaults.finalCheckRoute, finalAssessment:defaults.finalAssessment,
        ...Object.fromEntries(Object.keys(cases.options).filter(key => key.endsWith('Applicability')).map(key => [key, defaults[key]]))};
    }
    incomingBody = bodyId;
    const t = key => catalog.text(language, key), e = key => escape(t(key));
    const input = buildInput(), errors = engine.validateWalkthrough(input);
    if (errors.length) return `<section id="route-walkthrough" data-no-translate><h1>${e('validation')}</h1><ul>${errors.map(error => `<li>${escape(error)}</li>`).join('')}</ul></section>`;
    const result = engine.evaluateWalkthrough(input);
    const diagramTrack = result.selectedRoute === 'receptor-assessment' ? 'receptor-assessment' : result.track;
    const diagramRoutes = {
      'natural-status':['top', 'kazakh-baseline', 'domestic-entry', 'swiss-entry', 'donor-transfer', 'presumptive-floor', 'pending'],
      'ecological-potential':['potential-habitat', 'potential-hydraulics', 'service-conveyance', 'pending'],
      'receptor-assessment':['receptor-assessment'], undetermined:['pending']
    }[diagramTrack];
    if (!diagramRoutes.includes(inspectedRoute)) inspectedRoute = null;
    const inspection = inspectedRoute ? engine.inspectRoute(input, inspectedRoute) : null;
    const reason = code => escape(catalog.reason(language, code));
    const list = (items, mapper = escape) => `<ul>${items.map(item => `<li>${mapper(item)}</li>`).join('')}</ul>`;
    const open = key => disclosures.has(key) ? ' open' : '';
    function select(field, labelKey = field) {
      const optionLabel = value => field === 'bodyId' ? `${value} · ${t(`body-${value}`)}`
        : field === 'priorityBasis' && value === 'none' ? t('priorityNone')
          : field === 'designation' && value === 'none' ? t('designationNone')
          : field === 'designation' && value === 'pending' ? t('designationPending') : t(value);
      return `<label class="route-field"><span>${e(labelKey)}</span><select data-route-field="${escape(field)}">${cases.options[field].map(value => `<option value="${escape(value)}"${choices[field] === value ? ' selected' : ''}>${escape(optionLabel(value))}</option>`).join('')}</select></label>`;
    }
    function action(item) {
      return `<li class="route-action"><strong>${e(item.description)}</strong><span>${e('owner')}: ${e(item.ownerRole)}</span><span>${e('review')}: ${e(item.reviewTrigger)}</span>${item.reviewDate ? `<span>${escape(item.reviewDate)}</span>` : ''}</li>`;
    }
    function source(item) {
      return `<span class="route-source"><code>${escape(item.artifact)}</code> · <q>${escape(item.distinctivePhrase)}</q></span>`;
    }
    function assumptionLabel(item) {
      const parts = item.inputPath.split('.');
      return parts[0] === 'gates' ? t(parts[1]) : `${t(parts[1])} · ${t(parts[2])}`;
    }
    const components = ['quality', 'thermal', 'receptor', 'sediment', 'connectivity', 'groundwater'];
    const checkControl = field => `<label class="route-check"><input type="checkbox" data-route-field="${escape(field)}"${choices[field] ? ' checked' : ''}><span>${e(field)}</span></label>`;
    const evidenceControls = cases.booleans.filter(field => !['enforcementEvidence', 'deliveryDutyEvidence', 'floorDutyEvidence'].includes(field));
    const compactPath = result.attempts.map((item, index) => `<li class="route-attempt ${item.outcome === 'eligible' ? 'route-pass' : 'route-gap'}"><span class="route-step-number">${item.route === 'pending' ? e('routeOutcome') : `${e('routeCheck')} ${index + 1}`}</span><div><strong>${e(item.route)}</strong><span>${e(item.outcome)}</span></div></li>`).join('');
    const checkList = checks => `<dl class="route-check-list">${checks.map(item => `<div><dt>${e(item.id)}</dt><dd>${e(item.applicable ? item.screeningOnly ? 'single-member-screening' : item.state : 'not-applicable')}</dd></div>`).join('')}</dl>`;
    const detailedAttempts = result.attempts.map(item => `<article class="route-check-result"><h4>${e(item.route)} <span>${e(item.outcome)}</span></h4>${list(item.reasons, reason)}${item.checks?.length ? checkList(item.checks) : ''}${item.sources.map(source).join('')}</article>`).join('');
    const overlayCards = result.overlays.map(item => `<article class="route-overlay"><strong>${e(item.kind)}${item.receptorId ? ` · ${escape(item.receptorId)}` : ''}</strong><span>${e(item.applicability)} · ${e(item.state)}</span>${list(item.reasons, reason)}</article>`).join('');
    const monitorCards = result.monitoring.map(item => `<article class="route-monitor"><h4>${e(item.purpose)}</h4>${list(item.evidenceNeeded, e)}<p class="route-owner">${e('owner')}: ${e(item.action.ownerRole)}</p><p class="route-note">${e('points')}: ${item.controlPointIds.length ? item.controlPointIds.map(escape).join(', ') : e('pending')}</p><p class="route-note">${e(item.action.description)}</p><p class="route-note">${e('review')}: ${e(item.action.reviewTrigger)}</p></article>`).join('');
    const pending = result.selectedRoute === 'pending';
    const routeTrack = result.track === 'undetermined' ? 'track-undetermined' : result.track;
    function overview() {
      const track = diagramTrack;
      function node(route, criterion) {
        const attempt = result.attempts.find(item => item.route === route);
        const state = result.selectedRoute === route ? 'selected' : attempt ? 'tried' : 'untried';
        return `<button type="button" class="route-diagram-node" data-route-diagram-node="${escape(route)}" data-route-diagram-state="${state}" data-route-inspect="${escape(route)}" aria-expanded="${inspectedRoute === route}" aria-controls="route-method-inspector" aria-label="${e('inspectMethod')}: ${e(route)}"><strong>${e(route)}</strong><span>${e(criterion)}</span><small>${e(attempt ? attempt.outcome : 'diagramNotReached')}</small><span class="route-inspect-affordance">${e(inspectedRoute === route ? 'inspectHide' : 'inspectOpen')} <b aria-hidden="true">${inspectedRoute === route ? '−' : '+'}</b></span></button>`;
      }
      function chain(items) {
        return `<ol class="route-diagram-chain">${items.map(([route, criterion, next], index) => `<li>${node(route, criterion)}${index < items.length - 1 ? `<div class="route-diagram-next"><span aria-hidden="true">↓</span><span>${e(next || 'diagramOtherwise')}</span></div>` : ''}</li>`).join('')}</ol>`;
      }
      let diagram;
      if (track === 'natural-status') {
        diagram = `<div class="route-diagram-branches"><section><h4>${e('diagramTiers')}</h4>${chain([
          ['top', 'diagramTop'], ['kazakh-baseline', 'diagramBaseline'],
          ['domestic-entry', 'diagramDomestic', 'diagramDomesticNext'], ['swiss-entry', 'diagramSwiss']
        ])}</section><div class="route-diagram-transfer"><span>${e('diagramToFallback')}</span><b aria-hidden="true">→</b></div><section><h4>${e('diagramFallback')}</h4>${chain([
          ['donor-transfer', 'diagramDonor'], ['presumptive-floor', 'diagramPresumptive'], ['pending', 'diagramPending']
        ])}</section></div><p class="route-diagram-exceptions"><strong>${e('diagramDirectFallback')}</strong> ${e('diagramExceptions')}</p>`;
      } else if (track === 'ecological-potential') {
        diagram = `<p class="route-note">${e('diagramPotential')}</p>${chain([
          ['potential-habitat', 'diagramPotentialHabitat'], ['potential-hydraulics', 'diagramPotentialHydraulics'],
          ['service-conveyance', 'diagramService'], ['pending', 'diagramPending']
        ])}`;
      } else if (track === 'receptor-assessment') {
        diagram = node('receptor-assessment', 'diagramReceptor');
      } else {
        diagram = node('pending', 'diagramClassification');
      }
      return `<figure class="route-overview" data-route-overview="${escape(track)}"><figcaption><h3>${e('diagramTitle')}</h3><p>${e('diagramIntro')}</p><p class="route-inspect-help">${e('inspectHelp')}</p></figcaption><div class="route-diagram-start">${escape(input.body.id)} · ${e(track === 'undetermined' ? 'track-undetermined' : track)}</div><div class="route-diagram-down" aria-hidden="true">↓</div>${diagram}${inspectorPanel()}<div class="route-diagram-finish"><strong>${e('diagramFinalChecks')}</strong><p>${e('diagramChecksNote')}</p></div><div class="route-diagram-down" aria-hidden="true">↓</div><a class="route-diagram-follow" href="#route-workshop-record">${e('diagramFollow')} <span aria-hidden="true">↓</span></a><p class="route-note">${e('diagramDuties')}</p></figure>`;
    }
    const enforcementStatus = status => e(status === 'pending' ? 'enforcementPending' : status);
    const actions = [...result.actions, ...result.overlays.flatMap(item => item.actions)];
    const primaryReadiness = result.readiness.find(item => item.route === result.selectedRoute)
      || result.readiness.find(item => item.route === 'kazakh-baseline') || result.readiness[0];
    const readinessFacts = item => `<dl class="route-readiness"><div><dt>${e('procedureSpecified')}</dt><dd>${e(item.procedureSpecified ? 'specified' : 'notEstablished')}</dd></div><div><dt>${e('caseInputsSupplied')}</dt><dd>${e(item.caseInputsSupplied ? 'supplied' : 'incomplete')}</dd></div><div><dt>${e('scientificSupport')}</dt><dd>${e(item.scientificSupport)}</dd></div><div><dt>${e('officialIssuance')}</dt><dd>${e(item.officialIssuance)}</dd></div></dl>`;
    function inspectorPanel() {
      if (!inspection) return '<div id="route-method-inspector" hidden></div>';
      const assumedPaths = new Set(input.stipulations.map(item => item.inputPath));
      const assumption = path => assumedPaths.has(path) ? `<span class="route-inspector-assumption">${e('inspectAssumption')}</span>` : '';
      const record = gate => `<span class="route-evidence-state">${e(`inspect-state-${gate.state}`)}</span>${gate.permittedUses ? `<span class="route-evidence-use">${e('inspectPermitted')}: ${gate.permittedUses.length ? gate.permittedUses.map(use => e(`inspect-use-${use}`)).join(', ') : e('inspectNoUse')}${!gate.permittedUses.includes('sizing') ? ` · <strong>${e('restricted')}</strong>` : ''}</span>` : ''}`;
      const evidenceRow = item => `<div data-route-gate="${escape(item.id)}" data-route-gate-satisfied="${item.satisfied}"><dt>${e(item.id)}${assumption(`gates.${item.id}`)}</dt><dd><strong class="route-gate-status ${item.satisfied ? 'route-gate-met' : 'route-gate-missing'}">${e(item.satisfied ? 'inspectSatisfied' : 'inspectUnsatisfied')}</strong>${item.records.length ? item.records.map(record).join('') : `<span class="route-evidence-state">${e('inspectNoRecord')}</span>`}</dd></div>`;
      const all = inspection.requiredGates.filter(item => item.group === 'all');
      const any = inspection.requiredGates.filter(item => item.group === 'any-authority');
      const available = inspection.availability;
      const availability = available ? `<h4>${e('inspectAvailability')}</h4><dl class="route-evidence-rows">${['specified', 'resourced'].map(key => `<div><dt>${e(key)}${assumption(`availability.${available.tier}.${key}`)}</dt><dd>${record(available[key])}</dd></div>`).join('')}</dl>` : '';
      const reasonCodes = [...new Set(inspection.reasons)];
      const sourceRecords = inspection.attempts.flatMap(item => item.sources || []);
      const uniqueSources = [...new Map(sourceRecords.map(item => [`${item.artifact}:${item.distinctivePhrase}`, item])).values()];
      const scopeKey = inspection.route === 'top' ? 'top-component-only'
        : ['potential-habitat', 'potential-hydraulics', 'service-conveyance'].includes(inspection.route) ? 'diagramPotential'
          : inspection.route === 'swiss-entry' ? 'floorNote'
            : inspection.route === 'receptor-assessment' ? 'wetlandNote' : null;
      const disposition = inspection.disposition === 'selected' && inspection.route === 'pending' ? 'inspectCurrentOutcome'
        : inspection.disposition === 'selected' && inspection.route === 'receptor-assessment' ? 'inspectCurrentAssessment' : `inspect-${inspection.disposition}`;
      return `<section id="route-method-inspector" class="route-method-inspector" data-route-inspector="${escape(inspection.route)}" data-route-inspection-disposition="${escape(inspection.disposition)}" role="region" aria-labelledby="route-inspector-title" tabindex="-1">
        <div class="route-inspector-header"><div><p class="route-eyebrow">${e('inspectEyebrow')} · ${escape(input.body.id)}</p><h3 id="route-inspector-title">${e(inspection.route)}</h3></div><button type="button" class="route-inspector-close" data-route-action="close-inspector">${e('inspectClose')} <span aria-hidden="true">×</span></button></div>
        <p class="route-inspector-disposition">${e(disposition)}</p><p class="route-note">${e('diagramYourResult')}: <strong>${e(inspection.selectedRoute)}</strong> · ${escape(input.body.id)} · ${e(`body-${input.body.id}`)}</p>
        <div class="route-inspector-reasons"><h4>${e('inspectWhy')}</h4>${list(reasonCodes, reason)}${inspection.attempts.map(item => `<p class="route-note">${e(item.outcome)}</p>`).join('')}</div>
        ${scopeKey ? `<p class="route-inspector-scope">${e(scopeKey)}</p>` : ''}
        <h4>${e(inspection.route === 'pending' ? 'inspectBlockers' : 'inspectRequirements')}</h4><p class="route-note">${e(inspection.route === 'pending' ? 'inspectBlockersNote' : 'inspectEvidenceNote')}</p>
        ${all.length ? `<dl class="route-evidence-rows">${all.map(evidenceRow).join('')}</dl>` : ''}
        ${any.length ? `<div class="route-inspector-any"><h4>${e('inspectAnyAuthority')}</h4><p class="route-note">${e('inspectAnyAuthorityNote')}</p><dl class="route-evidence-rows">${any.map(evidenceRow).join('')}</dl></div>` : ''}
        ${!all.length && !any.length ? `<p class="route-note">${e('inspectNoRequirements')}</p>` : ''}
        ${availability}
        ${inspection.baselineBounds ? `<p class="route-inspector-bounds"><strong>${e('inspectBounds')}:</strong> ${e(`inspect-bounds-${inspection.baselineBounds}`)}${inspection.route === 'top' ? `<span class="route-evidence-use">${e('inspectTopBoundsNote')}</span>` : ''}</p>` : ''}
        ${inspection.finalChecks.length ? `<details data-route-details="inspector-checks"${open('inspector-checks')}><summary>${e('participantSupplied')}</summary><p class="route-note">${e('finalChecksNote')}</p>${checkList(inspection.finalChecks)}</details>` : ''}
        ${inspection.readiness ? `<details data-route-details="inspector-readiness"${open('inspector-readiness')}><summary>${e('readinessFor')}</summary>${readinessFacts(inspection.readiness)}</details>` : `<p class="route-note">${e('inspectReadinessNotEvaluated')}</p>`}
        <p class="route-inspector-footer">${e('inspectReadOnly')}</p><details data-route-details="inspector-source"${open('inspector-source')}><summary>${e('source')}</summary><p class="route-reference">${escape(result.reportReference.fileName)}</p><p class="route-note">${e('referenceNote')}</p>${uniqueSources.map(source).join('')}</details>
      </section>`;
    }
    const dutyCards = result.dutyRecords.map(item => `<article class="route-duty"><h4>${e(item.state)}</h4><p class="route-note">${e(item.recordStatus)}${item.searchDate ? ` · ${escape(item.searchDate)}` : ` · ${e('noSearchDate')}`}</p><p>${e(item.followUp.description)}</p><p class="route-note">${e('owner')}: ${e(item.followUp.ownerRole)}</p></article>`).join('');
    const simplificationText = result.simplifications.map(key => `<li>${e(key)}</li>`).join('');
    const prerequisites = (heading, status, missing) => `<article class="route-prerequisites"><h4>${e(heading)}</h4><strong>${enforcementStatus(status)}</strong>${missing.length ? list(missing, reason) : `<p class="route-note">${e('listedNotVerdict')}</p>`}</article>`;
    return `<section id="route-walkthrough" data-no-translate lang="${escape(language)}">
      <header class="route-header"><div><p class="route-eyebrow">${e('eyebrow')}</p><h1>${e('title')}</h1><p class="route-intro">${e('intro')}</p></div><span class="route-scope">${e('scope')}</span></header>
      <p class="route-reference"><strong>${e('source')}:</strong> <span>${escape(result.reportReference.fileName)}</span></p>
      <div class="route-input-grid">
        <section class="route-card"><h2><span class="route-number">1</span>${e('identify')}</h2><div class="route-field-grid">${select('bodyId')}${select('category')}${select('question')}${select('designation')}</div><div class="route-body-facts"><p><strong>${e('origin')}:</strong> ${e(input.body.origin)}</p><p><strong>${e('uses')}:</strong> ${e(`uses-${input.body.id}`)}</p></div><p class="route-note">${e('targetNote')}</p><details data-route-details="category"${open('category')}><summary>${e('authority')} · А–Д</summary><p class="route-note">${e('categoryNote')}</p></details><details data-route-details="applicability"${open('applicability')}><summary>${e('componentApplicability')}</summary><p class="route-note">${e('applicabilityNote')}</p><div class="route-field-grid">${components.map(component => select(`${component}Applicability`, component)).join('')}</div></details></section>
        <section class="route-card"><h2><span class="route-number">2</span>${e('evidence')}</h2><div class="route-field-grid route-evidence-fields">${select('mode')}${select('flowEvidence')}</div><p class="route-mode-note ${input.mode === 'hypothetical-workshop' ? 'route-hypothetical' : ''}">${e(input.mode === 'report-current' ? 'currentNote' : 'hypotheticalNote')}</p><p class="route-note">${e('evidenceNote')}</p><details data-route-details="evidence"${open('evidence')}><summary>${e('advanced')}</summary><p class="route-note">${e('advancedNote')}</p>${select('priorityBasis')}<div class="route-check-grid">${evidenceControls.map(checkControl).join('')}</div><p class="route-note">${e('habitatEvidenceNote')}</p></details><details data-route-details="safeguard"${open('safeguard')}><summary>${e('safeguardConfiguration')}</summary>${list(['safeguardSection', 'safeguardBoundaries', 'safeguardDuration', 'safeguardEstimator', 'safeguardCoverage', 'safeguardAdequacy'], e)}<p class="route-note">${e('safeguardNote')}</p></details><details data-route-details="quality"${open('quality')}><summary>${e('qualityActivation')}</summary><p class="route-note">${e('qualityNote')}</p>${list(['quality-feasibility-screen', 'quality-fisheries-limits', 'quality-grouping-approved', 'quality-basin-salt-budget', 'quality-transport-model-approved'], e)}<p class="route-note">${e('qualityCombinationNote')}</p></details></section>
      </div>
      <section class="route-card route-path-card"><h2><span class="route-number">3</span>${e('path')}</h2>${input.body.id === 'W1' ? `<p class="route-wetland-note">${e('wetlandNote')}</p>` : ''}${overview()}<h3>${e('diagramYourResult')}</h3><div class="route-flow"><div class="route-flow-node"><span>${escape(input.body.id)} · ${e(`body-${input.body.id}`)}</span><strong>${e(input.body.origin)}</strong></div><span class="route-arrow" aria-hidden="true">→</span><div class="route-flow-node"><span>${e('origin')} + ${e('designation')}</span><strong>${e(routeTrack)}</strong></div><span class="route-arrow" aria-hidden="true">→</span><div class="route-flow-node route-outcome ${pending ? 'route-pending' : ''}" data-route-output="${escape(result.selectedRoute)}"><span>${e(result.outputKind)}</span><strong>${e(result.selectedRoute)}</strong></div></div><h3>${e('routeChecksTitle')}</h3><p class="route-note">${e('routeCheckNumbers')}</p><ol class="route-attempts">${compactPath}</ol>
        <p class="route-completion"><strong>${e('completion')}:</strong> ${e(result.completion.status)} · ${e('participantSupplied')}</p>${result.attempts.some(item => item.reasons.includes('pending:full-regime')) ? `<p class="route-mode-note">${e('pending:full-regime')}</p>` : ''}<p class="route-note">${e(pending ? 'pendingNote' : result.selectedRoute === 'swiss-entry' ? 'floorNote' : result.requirementScope === 'floor-only-candidate' ? 'otherFloorNote' : 'shortage')}</p>
        ${primaryReadiness ? `<h3>${e('readinessFor')} · ${e(primaryReadiness.route)}</h3>${readinessFacts(primaryReadiness)}` : ''}
        <details data-route-details="readiness"${open('readiness')}><summary>${e('allReadiness')}</summary>${result.readiness.map(item => `<article class="route-check-result"><h4>${e(item.route)}</h4>${readinessFacts(item)}</article>`).join('')}</details>
        <details data-route-details="final-checks"${open('final-checks')}><summary>${e('participantSupplied')}</summary><p class="route-note">${e('finalChecksNote')}</p><div class="route-field-grid">${select('finalCheckRoute')}${select('finalAssessment')}</div><div class="route-process"><span>${e('candidateStage')}</span><b aria-hidden="true">→</b><span>${e('finalStage')}</span><b aria-hidden="true">→</b><span>${e('descentStage')}</span></div><p class="route-note">${e('finalFailureNote')}</p>${result.completion.checks.length ? `<h4>${e('selectedCandidateChecks')}: ${e(result.selectedRoute)}</h4>${checkList(result.completion.checks)}` : ''}<p class="route-note">${e('boundsNote')}</p></details>
        <details data-route-details="reasons"${open('reasons')}><summary>${e('readReasons')}</summary><div class="route-check-results">${detailedAttempts}</div></details>
        <aside class="route-simplifications"><h3>${e('simplifications')}</h3><ul>${simplificationText}</ul></aside>
      </section>
      <section class="route-card route-passport" id="route-workshop-record"><div class="route-passport-header"><h2><span class="route-number">4</span>${e('passport')}</h2><button type="button" class="route-export" data-route-action="export">${e('export')} <span aria-hidden="true">↓</span></button></div><p class="route-note">${e('exportNote')}</p>
        <h3>${e('overlays')}</h3><div class="route-overlay-grid">${overlayCards}</div>
        <details data-route-details="duties"${open('duties')}><summary>${e('duties')}</summary><p class="route-note">${e('dutyRegisterNote')}</p><div class="route-field-grid">${select('dutyState')}${select('legalAuthority')}</div><div class="route-duty-grid">${dutyCards}</div><div class="route-check-grid">${['deliveryDutyEvidence', 'floorDutyEvidence', 'enforcementEvidence'].map(checkControl).join('')}</div><p class="route-note">${e('independentDutiesNote')}</p></details>
        <details data-route-details="actions"${open('actions')}><summary>${e('gapTitle')} · ${actions.length}</summary><ul class="route-actions">${actions.length ? actions.map(action).join('') : `<li>${e('noActions')}</li>`}</ul></details><p class="route-review-cadence">${e('reviewCadence')}</p>
        <details data-route-details="monitoring"${open('monitoring')}><summary>${e('monitoring')} · ${result.monitoring.length}</summary><p class="route-note">${e('monitorNote')}</p><div class="route-monitor-grid">${monitorCards}</div><p class="route-note">${e('pointNote')}</p></details>
        <details data-route-details="enforcement"${open('enforcement')}><summary>${e('enforcement')}</summary><div class="route-prerequisite-grid">${prerequisites('delivery', result.enforcement.deliveryTest, result.enforcement.deliveryMissingPrerequisites)}${prerequisites('floorConduct', result.enforcement.floorConductTest, result.enforcement.floorMissingPrerequisites)}</div><p>${e('enforcementNote')}</p></details>
        <div class="route-authority"><h3>${e('authority')}</h3><p>${e('authorityNote')}</p></div>
        <details data-route-details="assumptions"${open('assumptions')}><summary>${e('assumptions')} · ${result.stipulations.length}</summary>${result.stipulations.length ? `<ul class="route-assumptions">${result.stipulations.map(item => `<li><strong>${escape(assumptionLabel(item))}</strong><p>${e('assume')}</p><p class="route-note">${e('statusGap')}</p>${source(item.source)}</li>`).join('')}</ul>` : `<p>${e('assumptionsNone')}</p>`}</details>
        <details data-route-details="gaps"${open('gaps')}><summary>${e('ruleGap')} · ${result.unresolvedNationalRules.length}</summary>${result.unresolvedNationalRules.length ? `<ul class="route-rule-gaps">${result.unresolvedNationalRules.map(item => `<li>${reason(item.reason)}${source(item.source)}</li>`).join('')}</ul>` : `<p class="route-note">${e('noUnresolvedRules')}</p>`}</details>
        <details data-route-details="reference"${open('reference')}><summary>${e('source')}</summary><p class="route-reference">${escape(result.reportReference.fileName)}</p><p class="route-note">SHA-256: <code class="route-checksum">${escape(result.reportReference.sha256)}</code></p><p class="route-note">${e('referenceNote')}</p></details>
        ${result.relatedExample ? `<div class="route-related"><h3>${e('related')}</h3><p class="route-note">${e('relatedNote')}</p></div>` : ''}
      </section>
    </section>`;
  }
  function exportRouteRecord() {
    const input = buildInput(), result = root.RouteEngine.evaluateWalkthrough(input);
    const blob = new Blob([JSON.stringify({input,result}, null, 2)], {type:'application/json'});
    const url = root.URL.createObjectURL(blob), link = root.document.createElement('a');
    link.href = url;
    link.download = `eflow-route-${input.body.id}.json`;
    link.click();
    root.setTimeout(() => root.URL.revokeObjectURL(url), 1000);
  }
  function connect(callback) {
    rerender = callback;
    if (connected || !root.document) return;
    connected = true;
    root.document.addEventListener('change', event => {
      const control = event.target.closest?.('[data-route-field]');
      if (!control || !choices) return;
      const field = control.dataset.routeField;
      if (!Object.hasOwn(root.RouteCases.options, field) && !root.RouteCases.booleans.includes(field)) return;
      const value = root.RouteCases.booleans.includes(field) ? control.checked : control.value;
      if (field === 'bodyId') {
        inspectedRoute = null;
        independentBody = true;
        const defaults = root.RouteCases.defaults(value);
        finalAssessments.clear();
        choices = {...choices, designation:defaults.designation, question:defaults.question,
          finalCheckRoute:defaults.finalCheckRoute, finalAssessment:defaults.finalAssessment,
          ...Object.fromEntries(Object.keys(root.RouteCases.options).filter(key => key.endsWith('Applicability')).map(key => [key, defaults[key]]))};
      }
      if (field === 'finalAssessment') finalAssessments.set(choices.finalCheckRoute, value);
      if (field === 'finalCheckRoute') choices = {...choices, finalAssessment:finalAssessments.get(value) || 'not-assessed'};
      choices = root.RouteCases.normalize({...choices, [field]:value});
      captureDisclosures();
      rerender?.();
      root.document.querySelector(`[data-route-field="${field}"]`)?.focus?.({preventScroll:true});
    });
    function closeInspector() {
      const previous = inspectedRoute;
      if (!previous) return;
      inspectedRoute = null;
      rerender?.();
      root.document.querySelector(`[data-route-inspect="${previous}"]`)?.focus?.();
    }
    root.document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && inspectedRoute && event.target.closest?.('#route-walkthrough')) {
        event.preventDefault();
        closeInspector();
      }
    });
    root.document.addEventListener('click', event => {
      const method = event.target.closest?.('[data-route-inspect]');
      if (method) {
        event.preventDefault();
        if (method.dataset.routeInspect === inspectedRoute) closeInspector();
        else {
          inspectedRoute = method.dataset.routeInspect;
          rerender?.();
          root.document.querySelector('#route-method-inspector')?.focus?.();
        }
        return;
      }
      if (event.target.closest?.('[data-route-action="close-inspector"]')) {event.preventDefault(); closeInspector(); return;}
      if (event.target.closest?.('[data-route-action="export"]')) {event.preventDefault(); exportRouteRecord();}
    });
    root.document.addEventListener('toggle', event => {
      const key = event.target.dataset?.routeDetails;
      if (!key || event.target.isConnected === false || !event.target.closest?.('#route-walkthrough')) return;
      captureDisclosures();
    }, true);
  }
  const api = {render, connect};
  root.RouteView = api;
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
