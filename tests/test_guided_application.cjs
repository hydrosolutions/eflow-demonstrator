'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const G = require('../guided-engine.js');
const A = require('../assessment-engine.js');
const close = (a,b,tolerance=1e-9) => assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=tolerance,`${a} != ${b}`);
const recordData = () => ({schemaVersion:'eflow-guided/1',datasetId:'independent-test-fixture',reference100yr:{version:'reference-test-v1',checkpoint:'R2b'},reference:{version:'reference-test-v1',checkpoint:'R2b'},method:{policyVersion:'policy-test-v1',referenceVersion:'reference-test-v1',checkpoint:'R2b'},dates:['2025-01-01'],scenarios:{'normal-managed':{id:'normal-managed',status:'admitted',dates:['2025-01-01'],criteria:{referenceVersion:'reference-test-v1',policyVersion:'policy-test-v1',checkpoint:'R2b',ecologicalM3s:[10],issuedM3s:[7]},series:{R2bM3s:[5],deliverableM3s:[7]},deliverableM3s:[7],findings:{issued:{daily:['shortfall'],criterionId:'R2b:issued',criterionVersion:'policy-test-v1',mappingVersion:'guided-map-v1'},ecological:{daily:['shortfall'],criterionId:'R2b:ecological',criterionVersion:'policy-test-v1',mappingVersion:'guided-map-v1'}},balances:{residualM3:[0]},provenance:{nativeRunId:'independent-test-run',datasetId:'independent-test-fixture',referenceVersion:'reference-test-v1',policyVersion:'policy-test-v1',checkpoint:'R2b',mappingVersion:'guided-map-v1'}}}});
const selectedState = () => G.updateState(G.createState(),{bodyId:'R2'});

test('landscape bodies preserve identity across graph elements and receptor overlay',()=>{
 const s=G.createState();assert.deepEqual(s.classifications.R2.reachIds,['R2a','R2b']);
 assert.equal(s.classifications.S1.artificialSubtype,'reservoir');assert.deepEqual(s.classifications.S1.storageIds,['S1']);assert.equal(s.classifications.W1.origin,'natural');assert.equal(s.classifications.W1.receptor.connectivity,'unknown');
 for(const b of Object.values(s.classifications)){assert.ok(b.id);assert.ok(Array.isArray(b.reachIds));assert.equal(b.planUnitId,null);assert.equal(b.useCategory,null);assert.notEqual(b.origin,'natural_receptor');}
});
test('designation and physical alteration do not change natural origin or saved physics',()=>{
 const data=recordData(), original=JSON.stringify(data);const s=selectedState();assert.equal(G.classify(s.classifications.R2),'natural/status');
 for(const designation of ['pending','not_searched']){const t=G.updateState(s,{classification:{designation}}),r=G.buildRecord(data,t);assert.equal(r.track,'undetermined');assert.equal(r.classification.origin,'natural');assert.equal(r.issuedInstructionM3s,null);assert.equal(r.findings,null);}
 const t=G.updateState(s,{classification:{designation:'designated',designationValidity:'valid'}}),r=G.buildRecord(data,t);assert.equal(r.track,'potential');assert.equal(r.classification.origin,'natural');assert.equal(r.classification.artificialSubtype,null);assert.equal(r.criteria,null);assert.equal(JSON.stringify(data),original);
});
test('baseline to entry and presumptive clears seasonal duty and findings without stale identity',()=>{
 const data=recordData(),s=selectedState(),base=G.buildRecord(data,s);assert.equal(base.issuedInstructionM3s,7);
 for(const mode of ['entry','presumptive']){const t=G.updateState(s,{mode}),r=G.buildRecord(data,t);assert.equal(r.ecologicalRequirementM3s,null);assert.equal(r.issuedInstructionM3s,null);assert.equal(r.criteria,null);assert.equal(r.findings,null);assert.notEqual(r.recordId,base.recordId);if(mode==='entry')assert.ok(r.floorCandidate);}
 assert.equal(base.issuedInstructionM3s,7);assert.equal(s.mode,'baseline');
});
test('W1 unknown path stays unsized and cannot inherit R2 instruction; declared path remains separate',()=>{
 const data=recordData(),s=G.updateState(selectedState(),{bodyId:'W1'}),r=G.buildRecord(data,s);assert.equal(r.receptor.pathId,null);assert.equal(r.receptor.managedInflowM3,null);assert.equal(r.receptor.verdict,null);assert.equal(r.criteria,null);assert.equal(r.issuedInstructionM3s,null);
 const supplied=G.receptorExample('drain');close(supplied.managedInflowM3,supplied.targetVolumeM3+supplied.evaporationM3-supplied.rainM3-supplied.otherNetM3);close(supplied.flowM3s*supplied.durationDays*86400,supplied.managedInflowM3);assert.equal(supplied.verdict,null);assert.match(supplied.assumptions.join(' '),/independent|separate/i);
 const legacy=A.buildPassport('W1');assert.equal(legacy.origin,'natural');assert.equal(legacy.carrierPath,null);assert.equal(legacy.seasonalCandidate,null);
});
test('zero is admitted flow, missing is not; interval overlap produces indeterminate delivery',()=>{
 assert.equal(G.evaluateInterval(8,.5,7),'met');assert.equal(G.evaluateInterval(6,.5,7),'shortfall');assert.equal(G.evaluateInterval(7,.5,7),'indeterminate');assert.equal(G.evaluateInterval(0,0,7),'shortfall');assert.equal(G.evaluateInterval(0,0,0),'met');
 for(const missing of [null,undefined,NaN,Infinity])assert.equal(G.evaluateInterval(missing,.5,7),'not_assessed');assert.equal(G.evaluateInterval(7,-.1,7),'not_assessed');
});
test('instruction remains prospective while actual evidence changes',()=>{
 const s=selectedState(),data=recordData(),r=G.buildRecord(data,s);assert.equal(r.ecologicalRequirementM3s,10);assert.equal(r.issuedInstructionM3s,7);assert.equal(r.deliveredM3s,5);
 data.scenarios['normal-managed'].series.R2bM3s=[2];const lower=G.buildRecord(data,s);assert.equal(lower.issuedInstructionM3s,7);assert.equal(lower.deliveredM3s,2);assert.equal(r.deliveredM3s,5);assert.equal(r.ecologicalStatus,null);assert.equal(r.legalFault,null);
});
test('R1 does not borrow downstream evidence and pending native run cannot yield issued findings',()=>{
 const data=recordData(),r1=G.buildRecord(data,G.createState());assert.equal(r1.issuedInstructionM3s,null);assert.equal(r1.criteria,null);data.scenarios['normal-managed'].status='timeout';const r=G.buildRecord(data,selectedState());assert.equal(r.findings,null);assert.equal(r.issuedInstructionM3s,null);
});
test('optional canal calculation and service requirement have separate meanings',()=>{
 const c=G.potentialExample();close(c.flowM3s,c.widthM*c.targetDepthM*c.targetVelocityMps);assert.ok(c.serviceM3s>c.flowM3s);assert.match(c.assumptions.join(' '),/not proof of ecological adequacy/i);
});
test('source reduction changes conservative load and mixing exactly, never creates a formal quality release',()=>{
 const a=G.qualityExample(1),b=G.qualityExample(.5);close(a.mixedQ,a.upstreamQ+a.drainQ);close(a.loadGps,a.upstreamQ*a.upstreamC+a.drainQ*a.drainC);close(a.mixedMgL*a.mixedQ,a.loadGps);close(a.loadGps,600);close(a.mixedMgL,240);close(b.loadGps,400);close(b.mixedMgL,160);assert.equal(a.formalQualityRelease,null);assert.equal(b.formalQualityRelease,null);assert.throws(()=>G.qualityExample(-1),/Source factor/);
});
test('export snapshot retains scenario checkpoint calendar and immutable classification',()=>{
 const data=recordData(),state=selectedState(),r=G.buildRecord(data,state),roundtrip=JSON.parse(JSON.stringify(r));assert.equal(roundtrip.datasetId,'independent-test-fixture');assert.equal(roundtrip.checkpoint,'R2b');assert.equal(roundtrip.selectedDate,'2025-01-01');assert.equal(roundtrip.scenarioId,'normal-managed');assert.deepEqual(roundtrip.modelReachIds,['R2a','R2b']);
 const changed=G.updateState(state,{classification:{designation:'pending'}});assert.equal(r.classification.designation,'none');assert.equal(G.buildRecord(data,changed).track,'undetermined');assert.equal(r.track,'natural/status');
});
// Actual native artifacts are tested below once the frozen native public schema is admitted.
test('missing selected-day delivery cannot inherit a precomputed passing verdict',()=>{
 const data=recordData();data.scenarios['normal-managed'].series.R2bM3s=[null];data.scenarios['normal-managed'].findings.issued.daily=['met'];
 const r=G.buildRecord(data,selectedState());assert.equal(r.deliveredM3s,null);assert.ok(r.findings===null||['not_assessed','indeterminate'].includes(r.findings.issued.daily[0]),'Missing selected evidence exposed a definite verdict');
});

test('cross-dataset policy reference checkpoint and calendar mismatches cannot yield a verdict',()=>{
 const corruptions=[
  d=>d.scenarios['normal-managed'].provenance.datasetId='other-fixture',
  d=>d.scenarios['normal-managed'].provenance.referenceVersion='other-reference',
  d=>d.scenarios['normal-managed'].provenance.policyVersion='other-policy',
  d=>d.scenarios['normal-managed'].provenance.checkpoint='R1',
  d=>d.scenarios['normal-managed'].findings.issued.criterionVersion='old-policy',
  d=>d.scenarios['normal-managed'].dates=['2025-01-02'],
  d=>d.scenarios['normal-managed'].criteria.issuedM3s=[7,7],
  d=>d.scenarios['normal-managed'].series.R2bM3s=[],
 ];
 for(const corrupt of corruptions){const d=recordData();corrupt(d);const r=G.buildRecord(d,selectedState());assert.equal(r.findings,null,corrupt.toString());}
});
const nativeData = () => JSON.parse(fs.readFileSync(path.join(__dirname,'../data/guided.json'),'utf8'));
const litres = q => Math.round(q*86400000);
test('all four published annual replays independently close every daily water and salt balance',()=>{
 const d=nativeData();assert.equal(d.dates.length,365);assert.equal(new Set(d.dates).size,365);
 for(const [id,s] of Object.entries(d.scenarios)){
  assert.equal(s.status,'passed');assert.deepEqual(s.dates,d.dates);const a=s.series;let previous=Math.round(s.balances.initialStorageM3*1000);
  for(let i=0;i<365;i++){
   for(const arr of Object.values(a))assert.equal(arr.length,365);
   const source=litres(a.boundaryM3s[i]),loss=litres(a.naturalLossM3s[i]),consumption=litres(a.consumptionM3s[i]),out=litres(a.R2bM3s[i]),store=Math.round(a.storageM3[i]*1000);
   assert.equal(source+previous-loss-consumption-out-store,0,`${id} day${i} water`);
   const saltResidual=(source+previous-loss-store)*100-out*s.saltMgL.R2b[i];assert.ok(Math.abs(saltResidual)<1,`${id} day${i} salt residual ${saltResidual}`);
   assert.equal(litres(a.R2aM3s[i])+litres(a.D1M3s[i]),out);
   assert.equal(litres(a.C1M3s[i]),consumption+litres(a.D1M3s[i]));assert.equal(loss*20,source);
   if(litres(a.D1M3s[i])===0)assert.equal(s.saltMgL.D1[i],null);else close(s.saltMgL.D1[i],200);
   previous=store;
  }
  assert.equal(previous,Math.round(s.balances.finalStorageM3*1000));
 }
});
test('natural transformation retains losses and removes artificial water use and stores under identical forcing',()=>{
 const d=nativeData();for(const forcing of ['normal','dry']){const n=d.scenarios[forcing+'-natural'],m=d.scenarios[forcing+'-managed'];assert.deepEqual(n.series.boundaryM3s,m.series.boundaryM3s);assert.deepEqual(n.series.naturalLossM3s,m.series.naturalLossM3s);
 for(let i=0;i<365;i++){assert.equal(litres(n.series.R2bM3s[i]),litres(n.series.boundaryM3s[i])-litres(n.series.naturalLossM3s[i]));for(const field of ['C1M3s','D1M3s','consumptionM3s','storageM3'])assert.equal(n.series[field][i],0);}
 }
 assert.ok(d.scenarios['normal-managed'].series.C1M3s.some(q=>q>0));assert.ok(d.scenarios['normal-managed'].series.storageM3.some(q=>q>0));assert.ok(d.scenarios['normal-managed'].series.spillM3s.some(q=>q>0));
});
test('reference magnitude and normalized daily teaching schedule enter native criteria without supply renaturalisation',()=>{
 const d=nativeData(),r=d.reference,m=d.method;assert.equal(r.recordYears,100);assert.equal(r.annualFactors.length,100);assert.equal(m.designClass,50);assert.equal(m.shiftedClass,75);
 const rank=.75*101,lo=Math.floor(rank)-1,factor=r.annualFactors[lo]+(rank-Math.floor(rank))*(r.annualFactors[lo+1]-r.annualFactors[lo]);close(m.shiftFactor,factor);
 for(let i=0;i<365;i++){const unroundedM3=r.dailyM3s[i]*86400*factor;assert.ok(m.ecologicalM3s[i]*86400>=unroundedM3-1e-7);assert.ok(m.ecologicalM3s[i]*86400-unroundedM3<2+1e-7);close(r.dailyM3s[i],d.scenarios['normal-natural'].series.R2bM3s[i]);}
 close(m.annualVolumeMm3,m.ecologicalM3s.reduce((a,b)=>a+b,0)*86400/1e6,1e-8);
 for(const s of Object.values(d.scenarios))assert.deepEqual(s.criteria.ecologicalM3s,m.ecologicalM3s);
 assert.match(m.description,/not the full method/i);
});
test('actual published native Fishy findings match the supplied ecological and prospective issued criteria on every day',()=>{
 const d=nativeData();for(const [id,s] of Object.entries(d.scenarios)){
  let previous=s.balances.initialStorageM3*1000;
  for(let i=0;i<365;i++){
   const available=previous+litres(s.series.R1M3s[i])-litres(s.series.C1M3s[i])+litres(s.series.D1M3s[i]);assert.equal(litres(s.deliverableM3s[i]),available);
   assert.equal(litres(s.criteria.issuedM3s[i]),Math.min(litres(s.criteria.ecologicalM3s[i]),available));previous=s.series.storageM3[i]*1000;
   for(const kind of ['ecological','issued']){const actual=litres(s.series.R2bM3s[i]),criterion=litres(s.criteria[kind+'M3s'][i]),shortfall=Math.max(0,criterion-actual),f=s.findings[kind];assert.equal(f.daily[i],shortfall?'shortfall':'met');assert.equal(f.rawFishy[i],shortfall?'fail':'pass');close(f.shortfallM3s[i],shortfall/86400000,1e-10);assert.equal(f.criterionId,'R2b:'+kind);assert.equal(f.criterionVersion,d.method.policyVersion);}
  }
  for(const kind of ['ecological','issued']){const f=s.findings[kind];assert.equal(f.shortfallDays,f.daily.filter(x=>x==='shortfall').length);close(f.shortfallVolumeM3,f.shortfallM3s.reduce((a,b)=>a+b,0)*86400,1e-6);}
 }
 assert.equal(d.scenarios['dry-managed'].findings.ecological.shortfallDays,365);assert.equal(d.scenarios['dry-managed'].findings.issued.shortfallDays,0);
 const s=d.shortfallCase;assert.equal(s.id,'controlled-shortfall-native-v1');assert.equal(s.dates.length,3);assert.equal(s.needM3s,10);assert.equal(s.issuedM3s,7);assert.equal(s.deliveredM3s,5);assert.equal(s.findings.issued.shortfallVolumeM3,2*86400*3);
});
test('every admitted annual replay opens as the correct R2 record with its exact selected-day values',()=>{
 const d=nativeData();for(const scenarioId of Object.keys(d.scenarios))for(const day of [0,150,364]){const state=G.updateState(selectedState(),{scenarioId,day}),r=G.buildRecord(d,state),s=d.scenarios[scenarioId];assert.equal(r.datasetId,d.datasetId);assert.equal(r.scenarioId,scenarioId);assert.equal(r.selectedDate,d.dates[day]);assert.equal(r.referenceId,d.reference.version);assert.equal(r.policyVersion,d.method.policyVersion);assert.equal(r.issuedInstructionM3s,s.criteria.issuedM3s[day]);assert.equal(r.deliveredM3s,s.series.R2bM3s[day]);assert.equal(r.deliverableM3s,s.deliverableM3s[day]);assert.ok(r.findings);}
});
test('readable record carries selected evidence identities and results while distinguishing zero from pending',()=>{
 const d=nativeData(),s=G.updateState(selectedState(),{scenarioId:'dry-managed'}),r=G.buildRecord(d,s),text=G.readableRecord(r);
 for(const value of [r.datasetId,r.referenceId,r.policyVersion,r.scenarioId,r.selectedDate,r.checkpoint,r.classification.designationEvidence])assert.ok(text.includes(value),`Readable record omitted ${value}`);
 assert.match(text,/365/);assert.match(text,/m³\/s/);assert.ok(text.includes(`guided-${r.classification.id}-${r.scenarioId}-revision-${r.revision}.json`));
 const zero=G.readableRecord({...r,deliveredM3s:0});assert.match(zero,/(?:[Aa]ctual|[Dd]elivered)[^\n]*\b0(?:\.0+)?\s*m³\/s/);
 const entry=G.readableRecord(G.buildRecord(d,G.updateState(s,{mode:'entry'})));assert.match(entry,/[Ii]ssued[^\n]*Pending/);assert.match(entry,/[Ee]cological[^\n]*Pending/);assert.match(entry,/[Ff]loor[^\n]*0\.25/);
});
