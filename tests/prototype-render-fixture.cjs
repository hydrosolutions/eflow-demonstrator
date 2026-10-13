const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const {createHash}=require('node:crypto');
const root = path.resolve(__dirname, '../prototype');
function renderer() {
  const events={};let savedUrl='';
  const context = vm.createContext({URLSearchParams, location:{search:'',pathname:'/prototype/'},history:{replaceState(_a,_b,url){savedUrl=url;}},localStorage:{getItem:()=>null},document:{getElementById:()=>({}),querySelectorAll:()=>[],addEventListener(name,handler){(events[name]??=[]).push(handler);}},console});
  for (const file of ['locale-catalog.js','locale.js','flow-status.js','quality-data.js','calculated-data.js','app.js','calculated-view.js']) {
    let source = fs.readFileSync(path.join(root,file),'utf8');
    if(file==='calculated-view.js') source=source.slice(0,source.indexOf('(async()=>'));
    vm.runInContext(source,context);
  }
  for (const operation of ['ecology','irrigation']) for(const kind of ['matched','stress']) {
    const bytes=fs.readFileSync(path.join(root,`comparison-${kind==='stress'?'stress-':''}${operation}.json`));
    context.fixture=JSON.parse(bytes);context.fixtureHash=createHash('sha256').update(bytes).digest('hex');
    context.targetsFixture=JSON.parse(fs.readFileSync(path.join(root,kind==='stress'?'targets-stress.json':'targets.json'),'utf8'));
    vm.runInContext(`policyDatasets.${operation}.${kind}={data:fixture,targets:targetsFixture,sha256:fixtureHash};calculation=fixture;`,context);
  }
  return {context,events,get savedUrl(){return savedUrl;},withQuality(){
    // A synthetic transport fixture exercises presentation while native runs are built/reviewed.
    vm.runInContext(`qualityData={schemaVersion:'prototype-quality-v1',status:'admitted',assumptions:{boundarySaltMgL:180,limitMgL:250,returnFraction:0.5,saltQuantumKg:'0.000001'},criterion:{limitMgL:250,comparison:'<=',applicability:'hypothetical',basis:'daily mean'},cases:{}};
    for(const operation of ['ecology','irrigation'])for(const basis of ['matched','fixed'])for(const forcing of ['normal','dry'])for(const method of ['swiss','kazakh','site']){
      const dataset=CalculatedData.selectDataset(policyDatasets[operation],forcing,basis),s=dataset.data.scenarios[forcing],p=s.methods[method];
      const series=(flows,concentrations)=>({flowM3s:flows,saltKgDay:flows.map((q,i)=>q*(concentrations[i]??0)*86.4),concentrationMgL:concentrations,rawFishy:flows.map((q,i)=>q===0?'unknown':concentrations[i]<=250?'pass':'fail')});
      const a=p.actualR2aM3s,b=p.actualM3s,d=p.ledger.map(row=>row.return_litres/86400000);
      qualityData.cases[[operation,basis,forcing,method].join(':')]={dates:s.dates,waterArtifactSha256:dataset.sha256,sections:{r2a:series(a,a.map(q=>q>0?180:null)),r2b:series(b,b.map((q,i)=>q>0?(a[i]*180+d[i]*360)/q:null))},drain:series(d,d.map(q=>q>0?360:null))};
    }`,context);return this;
  },render(overrides={}){context.overrides=overrides;return vm.runInContext('Object.assign(state,overrides);state.view==="system"?system():state.view==="assessment"?assessment():compare()',context);}};
}
module.exports={renderer,root};
