'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const G=require('../guided-engine.js');
const read=n=>JSON.parse(fs.readFileSync(path.join(__dirname,'../data/'+n),'utf8'));
const pair=()=>[read('guided.json'),read('guided-sharing.json')];
const selected=()=>G.updateState(G.createState(),{bodyId:'R2',scenarioId:'dry-managed-sharing',day:150});
const L=q=>Math.round(q*86400000);
const near=(a,b,e=1e-7)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=e,`${a} != ${b}`);

test('sharing add-on preserves frozen parent artifacts and verifies the real parent fingerprint',()=>{
 const [base,addon]=pair();
 const expected={'guided.json':'bca46d26dbd62aa7570783901e7a9a055d83639d7ba11ba0762168cbda71a4ae','guided-data.js':'d6eb7c3717fa915f0bcc31e939cd8ba8d8aa2be6ab1561ddc344eb7136b0211b'};
 for(const [file,sha]of Object.entries(expected))assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(__dirname,'../data',file))).digest('hex'),sha);
 assert.equal(addon.comparison.parentPayloadSha256,expected['guided.json']);assert.equal(addon.comparison.parentDatasetId,base.datasetId);
 assert.deepEqual(Object.keys(addon.scenarios),['dry-managed-sharing']);assert.equal(G.validateComparison(base,addon).valid,true);
 assert.equal(G.resolveData(base,addon,'dry-managed-sharing'),addon);assert.equal(G.resolveData(base,addon,'dry-managed'),base);assert.equal(G.resolveData(base,null,'dry-managed-sharing'),null);
});

test('every sharing day retains the natural forcing and targets while gross diversion and net depletion balance',()=>{
 const [base,addon]=pair(),s=addon.scenarios['dry-managed-sharing'],old=base.scenarios['dry-managed'],natural=base.scenarios['dry-natural'];
 assert.equal(s.dates.length,365);assert.deepEqual(addon.reference,base.reference);assert.deepEqual(s.criteria.ecologicalM3s,old.criteria.ecologicalM3s);assert.deepEqual(s.series.boundaryM3s,natural.series.boundaryM3s);assert.deepEqual(s.series.naturalLossM3s,natural.series.naturalLossM3s);
 let gross=0,consumed=0,positive=0,requestBound=0,shareBound=0;
 for(let i=0;i<365;i++){
  const a=s.series,river=L(a.R1M3s[i]),div=L(a.C1M3s[i]),ret=L(a.D1M3s[i]),et=L(a.consumptionM3s[i]);
  const request=Math.round((i>80&&i<300?3*Math.sin(Math.PI*(i-80)/220):0)*86400/2)*2000;
  const cap=Math.floor((river/5)/2000)*2000;assert.equal(L(a.offeredCapM3s[i]),cap);assert.ok(river/5-cap>=0&&river/5-cap<2000);assert.equal(div,Math.min(request,cap),`diversion day ${i}`);assert.equal(L(a.requestM3s[i]),request);assert.equal(L(a.unmetRequestM3s[i]),request-div);assert.equal(div,ret+et);assert.equal(et,ret);assert.equal(a.storageM3[i],0);assert.equal(L(a.R2aM3s[i]),river-div);assert.equal(L(a.R2bM3s[i]),river-et);
  assert.equal(L(old.series.R2bM3s[i])-L(a.R2bM3s[i]),et);assert.equal(L(a.boundaryM3s[i])-L(a.naturalLossM3s[i])-L(a.R2bM3s[i]),et);
  near(L(a.R2bM3s[i])*s.saltMgL.R2b[i],river*100,.001);
  if(div){positive++;near(s.saltMgL.D1[i],200);if(div===request)requestBound++;if(div===cap)shareBound++;}else assert.equal(s.saltMgL.D1[i],null);
  gross+=div;consumed+=et;
 }
 assert.equal(positive,219);assert.ok(requestBound>0&&shareBound>0);assert.equal(gross,2*consumed);
 near(s.findings.ecological.shortfallVolumeM3-old.findings.ecological.shortfallVolumeM3,consumed/1000,.0001);
});

test('Fishy tests unchanged ecological need and distinct prospective sharing duty on all days',()=>{
 const [,a]=pair(),s=a.scenarios['dry-managed-sharing'];
 assert.equal(s.findings.ecological.criterionVersion,'guided-policy-v1');assert.equal(s.findings.issued.criterionVersion,'guided-sharing-20pct-v1');
 for(let i=0;i<365;i++){
  const bound=L(s.series.R1M3s[i])-L(s.series.C1M3s[i])+L(s.series.D1M3s[i]);assert.equal(L(s.deliverableM3s[i]),bound);assert.equal(L(s.criteria.issuedM3s[i]),Math.min(L(s.criteria.ecologicalM3s[i]),bound));
  for(const k of ['ecological','issued']){const short=Math.max(0,L(s.criteria[k+'M3s'][i])-L(s.series.R2bM3s[i]));assert.equal(s.findings[k].daily[i],short?'shortfall':'met');assert.equal(s.findings[k].rawFishy[i],short?'fail':'pass');near(s.findings[k].shortfallM3s[i],short/86400000);}
 }
 assert.equal(s.findings.issued.shortfallDays,0);assert.equal(s.findings.ecological.shortfallDays,365);
});

test('cross-parent reference policy forcing sink calendar and criterion mutations refuse comparison and findings',()=>{
 const mutations=[
 a=>a.comparison.parentDatasetId='another-parent',a=>a.comparison.referenceVersion='another-reference',a=>a.comparison.parentPayloadSha256=null,
 a=>a.scenarios['dry-managed-sharing'].series.boundaryM3s[150]+=1,
 a=>a.scenarios['dry-managed-sharing'].series.naturalLossM3s[150]+=1,
 a=>a.scenarios['dry-managed-sharing'].criteria.ecologicalM3s[150]+=1,
 a=>a.scenarios['dry-managed-sharing'].criteria.issuedVersion='guided-policy-v1',
 a=>a.scenarios['dry-managed-sharing'].provenance.mappingVersion='other-map',
 a=>a.dates[150]='2025-06-02',a=>a.reference.dailyM3s[150]+=1
 ];
 for(const mutate of mutations){const [b,a]=pair();mutate(a);assert.equal(G.validateComparison(b,a).valid,false,mutate.toString());assert.equal(G.buildRecord(a,selected(),b).findings,null,mutate.toString());}
 const [b,a]=pair();assert.equal(G.buildRecord(a,selected()).findings,null);const r=G.buildRecord(a,selected(),b);assert.ok(r.findings);
});

test('sharing records preserve both criterion versions and never inherit duty into another assessment route',()=>{
 const [b,a]=pair(),s=selected(),r=G.buildRecord(a,s,b);assert.equal(r.datasetId,a.datasetId);assert.equal(r.parentDatasetId,b.datasetId);assert.equal(r.criterionVersions.ecological,'guided-policy-v1');assert.equal(r.criterionVersions.issued,'guided-sharing-20pct-v1');assert.equal(r.allocationPolicyVersion,'guided-sharing-20pct-v1');assert.equal(r.ecologicalStatus,null);assert.equal(r.legalFault,null);
 for(const patch of [{mode:'entry'},{mode:'presumptive'},{mode:'top'},{bodyId:'W1'},{classification:{designation:'pending'}},{classification:{designation:'designated',designationValidity:'valid'}}]){const record=G.buildRecord(a,G.updateState(s,patch),b);assert.equal(record.issuedInstructionM3s,null);assert.equal(record.findings,null);}
 for(const v of [a.datasetId,b.datasetId,r.criterionVersions.ecological,r.criterionVersions.issued,a.comparison.parentPayloadSha256])assert.ok(G.readableRecord(r).includes(v));
 assert.equal(r.allocationSelectedDay.grossDiversionM3s,a.scenarios['dry-managed-sharing'].series.C1M3s[150]);assert.equal(r.allocationSelectedDay.consumptionM3s,a.scenarios['dry-managed-sharing'].series.consumptionM3s[150]);
 const missing=structuredClone(a);missing.scenarios['dry-managed-sharing'].series.R2bM3s[150]=null;assert.equal(G.buildRecord(missing,s,b).findings,null);
 const zero=G.buildRecord(a,G.updateState(s,{day:0}),b);assert.equal(zero.allocationSelectedDay.grossDiversionM3s,0);
});
