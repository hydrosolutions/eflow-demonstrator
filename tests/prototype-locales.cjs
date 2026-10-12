const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
require('../prototype/locale-catalog.js');
const locale=require('../prototype/locale.js');
const {renderer,root}=require('./prototype-render-fixture.cjs');
function phrases(html){
 const decode=s=>s.replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>');
 const out=[];
 for(const match of html.matchAll(/>([^<>]+)</g))out.push(decode(match[1]).trim());
 for(const match of html.matchAll(/(?:aria-label|title|data-label)="([^"]+)"/g))out.push(decode(match[1]).trim());
 return out.filter(s=>s&&!['English','Русский','Oʻzbekcha'].includes(s));
}
test('every rendered phrase and accessible description has complete RU and Uzbek coverage',()=>{
 const r=renderer(),texts=new Set();
 const collect=html=>phrases(html).forEach(s=>texts.add(s));
 collect(fs.readFileSync(root+'/index.html','utf8'));
 for(const view of ['compare','assessment'])for(const operation of ['ecology','irrigation'])for(const forcing of ['normal','dry'])for(const basis of ['matched','fixed'])for(const method of ['swiss','kazakh','site'])for(let month=0;month<12;month++)for(const layer of ['inputs','results'])collect(r.render({view,operation,forcing,basis,method,month,layer,detail:true}));
 for(const body of ['R1','S1','R2','C1','D1','W1'])for(const landscape of ['landscape','network'])for(const operation of ['ecology','irrigation'])for(const method of ['swiss','kazakh','site'])collect(r.render({view:'system',body,landscape,operation,method}));
 vm.runInContext('calculation=null;',r.context);
 for(const view of ['compare','assessment','system'])collect(r.render({view}));
 vm.runInContext("calculationError='Calculation data could not be loaded. Please reload or check the source files.';",r.context);
 for(const view of ['compare','assessment','system'])collect(r.render({view}));
 const missing=new Set();for(const text of texts)if(!locale.known(text))for(const part of locale.missing)missing.add(part);
 assert.deepEqual([...missing],[]);
 assert.ok(texts.size>200);
});
test('language choice preserves all controls and is written to URL',()=>{
 const r=renderer();r.render({view:'compare',operation:'irrigation',forcing:'dry',basis:'fixed',method:'kazakh',body:'R2',landscape:'network',month:7,layer:'results',detail:true});
 vm.runInContext('PrototypeLocale.apply=()=>{};',r.context);
 const before=vm.runInContext('JSON.stringify(state)',r.context);
 for(const lang of ['ru','uz-Latn','en']){
  for(const handler of r.events.change)handler({target:{id:'language',value:lang}});
  const actual=JSON.parse(vm.runInContext('JSON.stringify(state)',r.context));const expected={...JSON.parse(before),lang};
  assert.deepEqual(actual,expected);assert.equal(new URL('http://example.test'+r.savedUrl).searchParams.get('lang'),lang);
 }
});
test('explicit supported URL language wins; preference is fallback and unavailable storage is safe',()=>{
 assert.equal(locale.initial('?lang=ru',{getItem:()=> 'uz-Latn'}),'ru');
 assert.equal(locale.initial('?lang=bad',{getItem:()=> 'uz-Latn'}),'uz-Latn');
 assert.equal(locale.initial('',{getItem(){throw new Error('blocked')}}),'en');
});
test('templates preserve every numeric interpolation and use controlled terms',()=>{
 for(const [source,pair] of Object.entries(globalThis.PrototypeCatalog))for(const translated of pair){
  const tokens=s=>(s.match(/\{\d+\}/g)||[]).sort();assert.deepEqual(tokens(translated),tokens(source),source);
 }
 assert.equal(locale.phrase('Operating instruction','ru'),'Предписание подачи');
 assert.equal(locale.phrase('Calculation section','uz-Latn'),'Hisob kesimi');
 const chart='Calculated Dry · 50% of curve monthly discharge in cubic metres per second. Selected Kazakh-style Jun ecological target 1.200; delivered flow at R2b 0.713.';
 for(const lang of ['ru','uz-Latn']){const text=locale.phrase(chart,lang);assert.ok(text.includes('1.200')&&text.includes('0.713'));assert.ok(!text.includes('Selected'));}
});
test('loading and failure explanations are localized',()=>{
 for(const source of ['Loading verified calculations…','Calculation data could not be loaded. Please reload or check the source files.','No schematic result is substituted.'])assert.ok(locale.known(source));
});
