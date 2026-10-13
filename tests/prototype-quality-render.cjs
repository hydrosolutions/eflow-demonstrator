'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const {renderer}=require('./prototype-render-fixture.cjs');
test('salt results stay independent of green delivery and show daily counts beside monthly concentration',()=>{
 const r=renderer().withQuality();
 const html=r.render({view:'compare',operation:'ecology',basis:'matched',forcing:'dry',method:'site',month:5});
 assert.match(html,/delivery-badge green/);assert.match(html,/266\.5 mg\/L/);assert.match(html,/Above illustrative salt limit/);assert.match(html,/30\/30 days above salt limit · 0 dry days/);
 assert.match(html,/Flow-weighted monthly mean/);assert.match(html,/Illustrative salt limit: 250 mg\/L · daily mean/);
});
test('quality absence or invalid identity preserves the water chart and shows no passing quality',()=>{
 const r=renderer();let html=r.render({view:'compare'});assert.match(html,/Salt concentration<\/span> · <strong>Not calculated/);assert.match(html,/class="seasonal"/);
 r.withQuality();vm.runInContext("qualityData.status='candidate';",r.context);html=r.render({view:'assessment'});assert.match(html,/Salt assessment · R2b/);assert.match(html,/Not calculated/);assert.doesNotMatch(html,/Within illustrative salt limit/);assert.match(html,/Modelled delivery/);
});
test('existing assessment and detail expose salt assumptions without changing network or navigation',()=>{
 const r=renderer().withQuality();const html=r.render({view:'assessment'});assert.match(html,/Salt exceedance days · selected month/);assert.match(html,/Salt exceedance days · full year/);assert.match(html,/Dry days · concentration undefined · full year/);
 const detail=r.render({view:'compare',detail:true});assert.match(detail,/180 → 360 mg\/L/);assert.match(detail,/concentrations are not added/);assert.match(detail,/Dilution lowers concentration but does not remove salt/);assert.match(detail,/Advanced basin example · separate example/);
 const before=r.render({view:'system',landscape:'network'}).match(/<svg class="system-figure"[\s\S]*?<\/svg>/)[0];vm.runInContext('qualityData=null;',r.context);const after=r.render({view:'system',landscape:'network'}).match(/<svg class="system-figure"[\s\S]*?<\/svg>/)[0];assert.equal(after,before);
});
