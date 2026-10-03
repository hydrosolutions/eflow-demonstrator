/* Public, deterministic teaching-state API. Physical replay data are never mutated. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.EflowGuided=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
'use strict';
const body=(id,name,origin,reachIds,extra={})=>({id,name,origin,physicalAlteration:false,designation:'none',designationValidity:'assumed-current',designationEvidence:'Fictional completed records check: no designation located.',artificialSubtype:null,useCategory:null,planUnitId:null,reachIds,receptor:null,...extra});
const BODIES={R1:body('R1','Mountain river','natural',['R1']),R2:body('R2','Altered receiving river','natural',['R2a','R2b'],{physicalAlteration:true}),C1:body('C1','Constructed canal','artificial',['C1'],{artificialSubtype:'canal'}),D1:body('D1','Constructed collector-drain','artificial',['D1'],{artificialSubtype:'collector-drain'}),S1:body('S1','Constructed reservoir','artificial',[],{artificialSubtype:'reservoir',storageIds:['S1']}),W1:body('W1','Wetland','natural',[],{receptor:{kind:'wetland',connectivity:'unknown',pathId:null}})};
const copy=x=>JSON.parse(JSON.stringify(x));
function classify(b){if(!['natural','artificial'].includes(b.origin)||['pending','not_searched'].includes(b.designation)||!['none','designated','expired','rejected'].includes(b.designation))return 'undetermined';if(b.designation==='designated'&&b.designationValidity!=='valid')return 'undetermined';return b.origin==='artificial'||b.designation==='designated'?'potential':'natural/status';}
function createState(){return {step:1,bodyId:'R1',scenarioId:'normal-managed',day:0,mode:'baseline',revision:1,classifications:copy(BODIES),receptorPath:'unknown',sourceFactor:1};}
function updateState(state,patch){const s=copy(state);for(const k of ['step','bodyId','scenarioId','day','mode','receptorPath','sourceFactor'])if(Object.hasOwn(patch,k))s[k]=patch[k];if(!Number.isInteger(s.step)||s.step<1||s.step>5)throw new RangeError('Unknown guided step');if(!Object.hasOwn(BODIES,s.bodyId))throw new RangeError('Unknown water body');if(!['baseline','entry','top','presumptive'].includes(s.mode))throw new RangeError('Unknown assessment mode');if(!['normal-natural','normal-managed','dry-natural','dry-managed'].includes(s.scenarioId))throw new RangeError('Unknown scenario');if(!Number.isInteger(s.day)||s.day<0||s.day>364)throw new RangeError('Day outside teaching year');if(!Number.isFinite(s.sourceFactor)||s.sourceFactor<0||s.sourceFactor>1)throw new RangeError('Source factor outside 0–1');if(!['unknown','drain'].includes(s.receptorPath))throw new RangeError('Unknown receptor path');if(patch.classification){if(Object.hasOwn(patch.classification,'origin')&&!['natural','artificial','unknown'].includes(patch.classification.origin))throw new RangeError('Unknown origin');if(Object.hasOwn(patch.classification,'designation')&&!['none','designated','pending','not_searched','expired','rejected'].includes(patch.classification.designation))throw new RangeError('Unknown designation');const b=s.classifications[s.bodyId];for(const k of ['origin','designation','designationValidity','designationEvidence','physicalAlteration'])if(Object.hasOwn(patch.classification,k))b[k]=patch.classification[k];}s.revision++;return s;}
function evaluateInterval(value,halfWidth,criterion){if(![value,halfWidth,criterion].every(Number.isFinite)||halfWidth<0)return 'not_assessed';return value-halfWidth>=criterion?'met':value+halfWidth<criterion?'shortfall':'indeterminate';}
function potentialExample(){return {id:'canal-hydraulic-teaching-v1',widthM:4,targetDepthM:0.5,targetVelocityMps:0.3,flowM3s:0.6,serviceM3s:1.2,assumptions:['Rectangular section; supplied depth and velocity targets; Q = width × depth × velocity.','Service demand is separate and is not proof of ecological adequacy.'],status:'illustrative sizing only'};}
function receptorExample(path='unknown'){if(path==='unknown')return {id:'wetland-unknown-v1',pathId:null,targetVolumeM3:null,managedInflowM3:null,verdict:null,status:'unsized',nextAction:'Obtain target level/area/duration, geometry, supply path, timing and quality evidence.'};if(path!=='drain')throw new RangeError('Unknown receptor path');return {id:'wetland-supplied-drain-v1',pathId:'declared-drain-to-W1',areaM2:10000,targetRiseM:0.1,targetVolumeM3:1000,rainM3:200,evaporationM3:300,otherNetM3:0,managedInflowM3:1100,durationDays:10,flowM3s:1100/864000,verdict:null,status:'illustrative balance only',assumptions:['Independent optional fixture, not a simulated branch in the main network.','Constant area; no overflow; zero specified groundwater net exchange.','Volume = target storage change + evaporation − rain; salt and habitat adequacy unassessed.']};}
function qualityExample(sourceFactor=1){if(!Number.isFinite(sourceFactor)||sourceFactor<0||sourceFactor>1)throw new RangeError('Source factor outside 0–1');const upstreamQ=2,drainQ=0.5,upstreamC=100,drainC=800*sourceFactor;return {id:'mixing-teaching-v1',upstreamQ,drainQ,upstreamC,drainC,mixedQ:2.5,loadGps:upstreamQ*upstreamC+drainQ*drainC,mixedMgL:(upstreamQ*upstreamC+drainQ*drainC)/2.5,formalQualityRelease:null,assumptions:['Simultaneous complete mixing; no storage or reactions; concentrations mg/L, flow m³/s, load g/s.','Changing source concentration reduces load. Adding clean water alone would dilute without removing salt.','No compliance limit or causal attribution is established.']};}
function habitatExample(){const sampledFlowsM3s=[1,2,3,4],scores=[0.4,0.8,0.9,0.5],target=0.7;return {id:'habitat-sampled-teaching-v1',sampledFlowsM3s,scores,target,qualifyingSampledFlowsM3s:sampledFlowsM3s.filter((q,i)=>scores[i]>=target),instruction:null,assumptions:['Hypothetical dimensionless habitat response at sampled flows, no interpolation or local calibration.','This element cannot establish the complete ecological regime.']};}
function validateReplay(data,scenarioId){
 const reasons=[],s=data?.scenarios?.[scenarioId],ref=data?.reference||data?.reference100yr,m=data?.method,dates=data?.dates;
 if(!s)return {valid:false,reasons:['Native scenario is unavailable']};
 if(!['passed','admitted','complete','completed'].includes(s.status))reasons.push('Native scenario is not admitted');
 if(!data.datasetId||s.provenance?.datasetId!==data.datasetId)reasons.push('Dataset identity mismatch');
 if(s.id!==scenarioId)reasons.push('Scenario identity mismatch');
 if(!ref?.version||s.provenance?.referenceVersion!==ref.version||s.criteria?.referenceVersion!==ref.version)reasons.push('Reference version mismatch');
 if(!m?.policyVersion||s.provenance?.policyVersion!==m.policyVersion||s.criteria?.policyVersion!==m.policyVersion)reasons.push('Policy version mismatch');
 if([ref?.checkpoint,m?.checkpoint,s.provenance?.checkpoint,s.criteria?.checkpoint].some(v=>v!=='R2b'))reasons.push('Checkpoint mismatch');
 const calendar=Array.isArray(dates)&&dates.length>0&&dates.every((d,i)=>typeof d==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d&&(!i||d>dates[i-1]));
 if(!calendar||!Array.isArray(s.dates)||JSON.stringify(s.dates)!==JSON.stringify(dates))reasons.push('Calendar mismatch');
 for(const kind of ['ecological','issued']){const f=s.findings?.[kind];if(f?.criterionVersion!==m?.policyVersion||f?.criterionId!=='R2b:'+kind||!s.provenance?.mappingVersion||f?.mappingVersion!==s.provenance.mappingVersion)reasons.push('Finding criterion identity mismatch');}
 const arrays=[s.deliverableM3s||s.series?.deliverableM3s,s.series?.R2bM3s,s.criteria?.ecologicalM3s,s.criteria?.issuedM3s,s.findings?.ecological?.daily,s.findings?.issued?.daily];
 if(!Array.isArray(dates)||arrays.some(a=>!Array.isArray(a)||a.length!==dates.length))reasons.push('Daily evidence support mismatch');
 return {valid:reasons.length===0,reasons};
}
function buildRecord(data,state){const b=copy(state.classifications[state.bodyId]),track=classify(b),scenario=data?.scenarios?.[state.scenarioId]||null;const admission=validateReplay(data,state.scenarioId),admitted=admission.valid;const eligible=track==='natural/status'&&!b.receptor&&b.reachIds.includes('R2b')&&state.mode==='baseline';const coherent=(!scenario?.id||scenario.id===state.scenarioId)&&(!data?.method?.checkpoint||data.method.checkpoint==='R2b');const active=admitted&&eligible&&coherent;const datum=(a)=>Array.isArray(a)&&Number.isFinite(a[state.day])?a[state.day]:null;const referenceId=data?.reference?.version||data?.reference100yr?.version||null;return {schemaVersion:'eflow-guided-record/1',recordId:(data?.datasetId||'pending')+':revision-'+state.revision,revision:state.revision,synthetic:true,datasetId:data?.datasetId||null,classification:b,track,assessmentKind:b.receptor?'receptor':track,modelReachIds:b.reachIds,nativeMapping:data?.network?.nativeMapping?copy(data.network.nativeMapping):null,planUnitId:b.planUnitId,scenarioId:state.scenarioId,scenarioStatus:scenario?.status||'pending',admission,referenceId,policyVersion:data?.method?.policyVersion||null,methodSummary:data?.method?{id:data.method.id,description:data.method.description,annualVolumeMm3:data.method.annualVolumeMm3,diagnostics:copy(data.method.diagnostics||{})}:null,checkpoint:eligible?'R2b':null,selectedDate:data?.dates?.[state.day]||null,timeSupport:'Daily mean; synthetic teaching case',mode:state.mode,outputKind:b.receptor?'receptor_example':track!=='natural/status'?'route_pending':state.mode==='entry'?'floor_candidate':state.mode==='top'?'habitat_element_candidate':state.mode==='presumptive'?'presumptive_pending':eligible?'seasonal_candidate':'reach_evidence_pending',floorCandidate:state.mode==='entry'&&track==='natural/status'&&!b.receptor?{q347M3s:0.625,valueM3s:0.625*0.4,calculation:'Simplified teaching table: interpolate (0,0) to (1,0.4), so 0.625 × 0.4 = 0.25 m³/s; not the statutory Swiss table',scope:'Separate illustrative low-flow operand, not the main checkpoint assessment',adjustmentM3s:0.1}:null,ecologicalRequirementM3s:active?datum(scenario.criteria?.ecologicalM3s):null,issuedInstructionM3s:active?datum(scenario.criteria?.issuedM3s):null,deliveredM3s:active?datum(scenario.series?.R2bM3s):null,deliverableM3s:active?datum(scenario.deliverableM3s||scenario.series?.deliverableM3s):null,findings:active&&Number.isFinite(datum(scenario.series?.R2bM3s))&&Number.isFinite(datum(scenario.criteria?.issuedM3s))&&Number.isFinite(datum(scenario.criteria?.ecologicalM3s))?copy(scenario.findings):null,criteria:active?copy(scenario.criteria):null,receptor:b.receptor?receptorExample(state.receptorPath):null,optionalCalculations:{scope:'Independent browser teaching fixtures; not native network modifications',mode:state.mode,habitat:state.mode==='top'?habitatExample():null,canal:potentialExample(),wetland:receptorExample(state.receptorPath),quality:qualityExample(state.sourceFactor)},balances:scenario?.balances?copy(scenario.balances):null,provenance:scenario?.provenance?copy(scenario.provenance):null,ecologicalStatus:null,legalFault:null,missing:active?['Official ecological status','Adopted national prescription']:['No matching admitted criterion and delivery chain for this unit and mode',...admission.reasons],nextAction:b.receptor?'Obtain receptor targets and connectivity evidence':track==='potential'?'Obtain protected-function targets and hydraulic/site evidence':track==='undetermined'?'Resolve origin and designation evidence':'Review the teaching result and obtain real reference and site evidence',responsibleRole:'Basin assessment lead; competent authority for official decisions',limitations:['Synthetic teaching record; classification changes do not change the saved physical simulation.','Ecological schedule and issued instruction are separate criteria.','Daily means do not establish subdaily extrema.','Earlier exports remain separate revision records.']};}
function readableRecord(record){
 const r=record,b=r.classification||{},o=r.optionalCalculations||{};
 const value=v=>v===null||v===undefined?'Pending / not established':Array.isArray(v)?(v.length?v.join(', '):'None recorded'):String(v);
 const number=(v,unit)=>value(v)+(Number.isFinite(v)?' '+unit:'');
 const jsonName='guided-'+b.id+'-'+r.scenarioId+'-revision-'+r.revision+'.json';
 return [
 'SYNTHETIC E-FLOW TEACHING RECORD',r.recordId,'Revision: '+r.revision,
 '', 'CLASSIFICATION AND EVIDENCE',
 'Water body: '+value(b.id)+' — '+value(b.name),
 'Origin: '+value(b.origin),'Physical alteration: '+value(b.physicalAlteration),
 'Designation: '+value(b.designation),'Designation validity: '+value(b.designationValidity),
 'Designation evidence: '+value(b.designationEvidence),
 'Artificial subtype: '+value(b.artificialSubtype),
 'Route: '+value(r.track),'Assessment kind: '+value(r.assessmentKind),
 'Plan unit: '+value(r.planUnitId),'Use category: '+value(b.useCategory),
 'Model reaches: '+value(r.modelReachIds),'Storage elements: '+value(b.storageIds),
 'Receptor connectivity: '+value(b.receptor?.connectivity),
 '', 'SCENARIO AND ASSESSMENT IDENTITY',
 'Dataset: '+value(r.datasetId),'Scenario: '+value(r.scenarioId),
 'Native scenario status: '+value(r.scenarioStatus),
 'Replay identity checks: '+(r.admission?.valid?'passed':value(r.admission?.reasons)),
 'Reference version: '+value(r.referenceId),'Policy version: '+value(r.policyVersion),
 'Checkpoint: '+value(r.checkpoint),'Selected date: '+value(r.selectedDate),
 'Time support: '+value(r.timeSupport),'Flow units: m³/s; balance volumes: m³',
 'Mode: '+value(r.mode),'Output: '+value(r.outputKind),
 'Method scope: '+value(r.methodSummary?.description),
 '', 'SELECTED-DAY VALUES',
 'Ecological teaching schedule: '+number(r.ecologicalRequirementM3s,'m³/s'),
 'Prospective deliverable bound: '+number(r.deliverableM3s,'m³/s'),
 'Issued teaching instruction: '+number(r.issuedInstructionM3s,'m³/s'),
 'Actual simulated delivery: '+number(r.deliveredM3s,'m³/s'),
 'Independent floor candidate: '+number(r.floorCandidate?.valueM3s,'m³/s'),
 'Floor calculation: '+value(r.floorCandidate?.calculation),
 '', 'FISHY FINDINGS OVER THE REPLAY PERIOD',
 'Ecological-schedule shortfall days: '+value(r.findings?.ecological?.shortfallDays),
 'Ecological-schedule shortfall volume: '+number(r.findings?.ecological?.shortfallVolumeM3,'m³'),
 'Issued-instruction shortfall days: '+value(r.findings?.issued?.shortfallDays),
 'Issued-instruction shortfall volume: '+number(r.findings?.issued?.shortfallVolumeM3,'m³'),
 'Ecological status: '+value(r.ecologicalStatus),'Legal fault: '+value(r.legalFault),
 '', 'NATIVE BALANCE SUMMARY',
 'Maximum daily residual: '+number(r.balances?.maxResidualM3,'m³'),
 'Initial storage: '+number(r.balances?.initialStorageM3,'m³'),
 'Final storage: '+number(r.balances?.finalStorageM3,'m³'),
 'Native execution: '+value(r.provenance?.nativeExecution),
 '', 'SEPARATE OPTIONAL TEACHING EXAMPLES',
 value(o.scope),'Mode: '+value(o.mode),
 'Wetland example: '+value(o.wetland?.id),
 'Wetland declared path: '+value(o.wetland?.pathId),
 'Wetland managed inflow: '+number(o.wetland?.managedInflowM3,'m³'),
 'Canal kinematic example: '+number(o.canal?.flowM3s,'m³/s'),
 'Separate canal service requirement: '+number(o.canal?.serviceM3s,'m³/s'),
 'Quality example: '+value(o.quality?.id),
 'Selected drain concentration: '+number(o.quality?.drainC,'mg/L'),
 'Mixed concentration: '+number(o.quality?.mixedMgL,'mg/L'),
 'Salt load: '+number(o.quality?.loadGps,'g/s'),
 'Habitat qualifying sampled flows: '+value(o.habitat?.qualifyingSampledFlowsM3s),
 '', 'MISSING EVIDENCE AND NEXT ACTION',
 ...(r.missing||[]).map(v=>'- '+v),
 'Next action: '+value(r.nextAction),'Responsible role: '+value(r.responsibleRole),
 '', 'LIMITATIONS',...(r.limitations||[]).map(v=>'- '+v),
 '', 'Matching complete JSON record: '+jsonName,
 'The JSON retains daily criteria/findings, exact evidence, assumptions, native mapping and full provenance.'
 ].join('\n');
}
return {BODIES,createState,updateState,classify,evaluateInterval,potentialExample,receptorExample,qualityExample,habitatExample,validateReplay,buildRecord,readableRecord};
});
