'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {summarize}=require('../prototype/quality-data.js');
const hash='a'.repeat(64),selection={operation:'ecology',basis:'matched',forcing:'normal',method:'swiss'};
function fixture(){
 const dates=Array.from({length:365},(_,i)=>new Date(Date.UTC(2021,0,i+1)).toISOString().slice(0,10));
 const series=()=>({flowM3s:Array(365).fill(1),saltKgDay:Array(365).fill(21600),concentrationMgL:Array(365).fill(250),rawFishy:Array(365).fill('pass')});
 const entry={dates,sections:{r2a:series(),r2b:series()},drain:{flowM3s:Array(365).fill(0),saltKgDay:Array(365).fill(0),concentrationMgL:Array(365).fill(null)},waterArtifactSha256:hash};
 return {data:{schemaVersion:'prototype-quality-v1',status:'admitted',assumptions:{boundarySaltMgL:180,limitMgL:250,returnFraction:0.5,saltQuantumKg:'0.000001'},criterion:{limitMgL:250,comparison:'<=',applicability:'hypothetical',basis:'daily mean'},cases:{'ecology:matched:normal:swiss':entry}},entry,water:{dates,actualR2aM3s:Array(365).fill(1),actualM3s:Array(365).fill(1),returnM3s:Array(365).fill(0)}};
}
function day(f,i,q,c,finding){for(const section of ['r2a','r2b']){const s=f.entry.sections[section];s.flowM3s[i]=q;s.concentrationMgL[i]=c;s.saltKgDay[i]=q*(c??0)*86.4;s.rawFishy[i]=finding;}f.water.actualM3s[i]=q;f.water.actualR2aM3s[i]=q;}
const result=(f,month=0)=>summarize(f.data,selection,f.water,month,'R2b',hash);
// Frozen quality contract: independent daily salt findings; volume-weighted monthly display.
test('monthly concentration is volume weighted and daily failures remain visible',()=>{
 const f=fixture();day(f,0,3,300,'fail');day(f,1,1,100,'pass');const r=result(f);
 assert.equal(r.available,true);assert.ok(Math.abs(r.concentrationMgL-250)<1e-9);assert.equal(r.exceedanceDays,1);assert.equal(r.status,'exceeded');assert.equal(r.days,31);assert.equal(result(f,null).days,365);
});
test('equality passes; dry and unknown findings never become passing quality',()=>{
 const f=fixture();assert.equal(result(f).status,'within');day(f,0,0,null,'unknown');let r=result(f);assert.equal(r.dryDays,1);assert.equal(r.status,'incomplete');assert.equal(r.concentrationMgL,250);
 day(f,1,1,250,'unknown');r=result(f);assert.equal(r.unknownDays,1);assert.equal(r.status,'incomplete');
 for(let i=0;i<31;i++)day(f,i,0,null,'unknown');r=result(f);assert.equal(r.concentrationMgL,null);assert.equal(r.status,'dry');
});
test('missing invalid or mismatched evidence fails closed',()=>{
 const changes=[f=>f.data.status='candidate',f=>f.data.assumptions.returnFraction=0.35,f=>f.data.criterion.limitMgL=251,f=>f.entry.dates[0]='2021-02-30',f=>f.entry.sections.r2a.flowM3s.pop(),f=>f.entry.sections.r2b.concentrationMgL[0]=null,f=>f.entry.sections.r2b.saltKgDay[0]=-1,f=>f.entry.sections.r2b.rawFishy[0]='fail',f=>f.entry.waterArtifactSha256='b'.repeat(64),f=>f.water.actualM3s[0]=2,f=>delete f.data.cases['ecology:matched:normal:swiss']];
 for(const change of changes){const f=fixture();change(f);assert.equal(result(f).available,false);assert.equal(result(f).label,'Not calculated');assert.equal(result(f).exceedanceDays,null);}
 assert.equal(summarize(null,selection,null,0,'R2b',hash).available,false);assert.equal(result(fixture(),12).available,false);
});
test('each operation basis forcing and method selects its exact case',()=>{
 const f=fixture();for(const operation of ['ecology','irrigation'])for(const basis of ['matched','fixed'])for(const forcing of ['normal','dry'])for(const method of ['swiss','kazakh','site']){const s={operation,basis,forcing,method};const key=[operation,basis,forcing,method].join(':');f.data.cases={[key]:f.entry};assert.equal(summarize(f.data,s,f.water,0,'R2a',hash).available,true);}
});
