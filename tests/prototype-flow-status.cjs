'use strict';
// Approved narrow contract: R2a reads native r2a_litres; R2b reads downstream_litres.
// Both use the same supplied candidate_litres/issued_litres. Never infer missing R2a.
// Exact safe integers, complete selected month, red priority and null grey counts remain.
// Test scaffold and bodies written/compiled before implementation.
const test = require('node:test');
const assert = require('node:assert/strict');
const {assessFlowDelivery} = require('../prototype/flow-status.js');
function month() {
  return {ledger:Array.from({length:31},(_,i)=>({
    date:`2021-01-${String(i+1).padStart(2,'0')}`,
    r2a_litres:80,downstream_litres:110,candidate_litres:100,issued_litres:90
  }))};
}
function grey(result) {
  assert.equal(result.status,'grey');assert.equal(result.label,'Not assessed');
  assert.equal(result.candidateShortfallDays,null);assert.equal(result.instructionShortfallDays,null);
  assert.equal(result.assessedDays,0);
}

test('R2a uses upstream native actual while R2b uses downstream actual against same criteria',()=>{
  const p=month(),a=assessFlowDelivery(p,0,'R2a'),b=assessFlowDelivery(p,0,'R2b');
  assert.equal(a.status,'red');assert.equal(a.candidateShortfallDays,31);assert.equal(a.instructionShortfallDays,31);
  assert.equal(b.status,'green');assert.equal(b.candidateShortfallDays,0);assert.equal(b.instructionShortfallDays,0);
  assert.equal(a.assessedDays,31);assert.equal(b.assessedDays,31);
});
test('R2a amber then equality green uses exact one-litre comparisons',()=>{
  const p=month();p.ledger.forEach(r=>{r.r2a_litres=100;});p.ledger[0].r2a_litres=99;
  const result=assessFlowDelivery(p,0,'R2a');
  assert.equal(result.status,'amber');assert.equal(result.candidateShortfallDays,1);assert.equal(result.instructionShortfallDays,0);
  p.ledger[0].r2a_litres=100;assert.equal(assessFlowDelivery(p,0,'R2a').status,'green');
});
test('missing or invalid R2a stays grey without borrowing R2b or release+spill',()=>{
  for(const value of [undefined,null,NaN,-1,.5,Number.MAX_SAFE_INTEGER+1]){
    const p=month();p.ledger[0].r2a_litres=value;p.ledger[0].release_litres=100;p.ledger[0].spill_litres=0;
    grey(assessFlowDelivery(p,0,'R2a'));assert.equal(assessFlowDelivery(p,0,'R2b').status,'green');
  }
});
test('R2a assessment does not require an unrelated R2b numeric reading',()=>{
  const p=month();p.ledger.forEach(r=>{r.r2a_litres=100;delete r.downstream_litres;});
  assert.equal(assessFlowDelivery(p,0,'R2a').status,'green');grey(assessFlowDelivery(p,0,'R2b'));
});
test('incomplete month, invalid dates or missing shared criteria fail closed at either section',()=>{
  const incomplete=month();incomplete.ledger.pop();
  const invalid=month();invalid.ledger[0].date='2021-02-30';
  const missing=month();missing.ledger[0].issued_litres=null;
  for(const p of [incomplete,invalid,missing])for(const section of ['R2a','R2b'])grey(assessFlowDelivery(p,0,section));
});
test('only the two exact supported sections are assessed and default remains R2b',()=>{
  const p=month();assert.deepEqual(assessFlowDelivery(p,0),assessFlowDelivery(p,0,'R2b'));
  for(const section of ['R1','W1','C1','D1','R2','r2a',null])grey(assessFlowDelivery(p,0,section));
});
test('section comparisons preserve source ledger and do not recalculate issued instruction',()=>{
  const p=month(),before=JSON.stringify(p);
  assessFlowDelivery(p,0,'R2a');assessFlowDelivery(p,0,'R2b');assert.equal(JSON.stringify(p),before);
});
