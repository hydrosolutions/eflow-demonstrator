const test = require('node:test');
const assert = require('node:assert/strict');
const {runExperiment, entryFloor, habitatFlow} = require('../playground-engine.js');
const mean = a => a.reduce((s,x)=>s+x,0)/a.length;
const close = (a,b) => assert.ok(Math.abs(a-b)<1e-9, `${a} != ${b}`);
test('equal volume shapes and deterministic outputs', () => {
  const patterns=['snowmelt','rainfall','buffered','drought'];
  const runs=patterns.map(pattern=>runExperiment({pattern}));
  for(const run of runs){assert.equal(run.reference.length,365);close(mean(run.reference),10);assert.ok(run.reference.every(x=>x>0));}
  assert.notDeepEqual(runs[0].reference,runs[1].reference);
  assert.deepEqual(runs[0],runExperiment({pattern:'snowmelt'}));
});
test('supply changes preserve reference and all requirements', () => {
  const a=runExperiment({supplyFactor:1}),b=runExperiment({supplyFactor:0.1});
  assert.deepEqual(a.reference,b.reference);const {habitatPerformance:ha,...da}=a.diagnostics,{habitatPerformance:hb,...db}=b.diagnostics;assert.deepEqual(da,db);
  a.methods.forEach((m,i)=>{assert.deepEqual(m.requirement,b.methods[i].requirement);if(m.requirement)assert.ok(b.methods[i].shortfallVolumeMm3>=m.shortfallVolumeMm3);});
  b.available.forEach((v,i)=>close(v,a.available[i]*0.1));
});
test('entry table is continuous concave and screens unsupported flows', () => {
  let lastSlope=Infinity;
  for(let q=0.1;q<59;q+=0.1){const slope=(entryFloor(q+0.01)-entryFloor(q))/0.01;assert.ok(slope<=lastSlope+1e-9);lastSlope=slope;}
  for(const q of [1,5,20])assert.ok(Math.abs(entryFloor(q+1e-8)-entryFloor(q-1e-8))<1e-7);
  assert.equal(entryFloor(60),null);assert.equal(entryFloor(0),null);assert.equal(entryFloor(1,100),null);
});
test('baseline applies shift once with strict bound screening', () => {
  for(const [c,shift] of [[25,50],[50,75],[75,90],[95,97]]){
    const r=runExperiment({designClass:c,riskFloor:0});assert.equal(r.diagnostics.shiftedClass,shift);
    const m=r.methods.find(m=>m.id==='kazakh');assert.ok(m.requirement);
    m.requirement.forEach((q,i)=>close(q,Math.max(Math.min(r.diagnostics.classHydrograph[i],r.diagnostics.median[i]),r.diagnostics.bound99[i],r.diagnostics.recordMinimum)));
    if(c===25)assert.deepEqual(r.diagnostics.classHydrograph,r.diagnostics.median);
  }
  const r=runExperiment({riskFloor:100});assert.equal(r.methods[1].requirement,null);assert.match(r.methods[1].reason,/cross/i);
});
test('habitat inversion returns first crossing or unavailable', () => {
  close(habitatFlow([[0,0],[2,0.5],[6,1],[10,0.4]],0.75),4);
  assert.equal(habitatFlow([[0,0],[2,0.5]],0.8),null);
  const r=runExperiment({habitatTarget:1});assert.equal(r.methods[2].requirement,null);
  const ok=runExperiment({habitatTarget:0.7});assert.ok(ok.methods[2].requirement);
  ok.diagnostics.habitatCurves.forEach(curve=>close(curve.selectedFlow,habitatFlow(curve.points,0.7)));
});
test('volumes integrate daily units and seasons', () => {
  const r=runExperiment({supplyFactor:0});
  for(const m of r.methods.filter(m=>m.requirement)){close(m.annualVolumeMm3,m.requirement.reduce((a,b)=>a+b,0)*86400/1e6);close(m.shortfallVolumeMm3,m.annualVolumeMm3);assert.equal(m.shortfallDays,365);assert.equal(m.seasonalMeans.length,4);}
});
test('invalid or explicitly absent operands are not silently replaced', () => {
  for(const cfg of [{pattern:'unknown'},{designClass:90},{meanFlow:0},{meanFlow:NaN},{supplyFactor:-1},{habitatTarget:1.1}])assert.throws(()=>runExperiment(cfg),RangeError);
  assert.equal(runExperiment({riskFloor:null}).methods[1].requirement,null);
  assert.equal(runExperiment({entryScale:null}).methods[0].requirement,null);
  assert.equal(runExperiment({habitatTarget:null}).methods[2].requirement,null);
});
test('median design class has no spurious deficit at full reference supply',()=>{
 for(const pattern of ['snowmelt','rainfall','buffered','drought']){
  const r=runExperiment({pattern,designClass:25,riskFloor:0});
  assert.deepEqual(r.reference,r.diagnostics.median);
  assert.equal(r.methods[1].shortfallDays,0);assert.equal(r.methods[1].shortfallVolumeMm3,0);
  close(mean(r.reference),10);
 }
});
test('habitat target performance checks declining limb and leaves extrapolation unknown',()=>{
 const r=runExperiment({pattern:'buffered',habitatTarget:0.9});
 assert.equal(r.methods[2].shortfallDays,0);
 assert.ok(r.diagnostics.habitatPerformance.belowDays>0);
 assert.ok(r.diagnostics.habitatPerformance.scores[200]<0.9);
 const high=runExperiment({supplyFactor:100});
 assert.equal(high.diagnostics.habitatPerformance.unknownDays,365);
});
test('baseline failure identifies first crossing and controlling operand',()=>{
 const r=runExperiment({pattern:'drought',riskFloor:2});
 const d=r.diagnostics.firstCrossing;
 assert.ok(d);assert.equal(d.term,'Supplied daily low-flow bound');assert.ok(d.lower>d.median);
 assert.equal(r.methods[1].requirement,null);
});
