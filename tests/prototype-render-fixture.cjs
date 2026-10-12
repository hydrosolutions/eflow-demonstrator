const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '../prototype');
function renderer() {
  const events={};let savedUrl='';
  const context = vm.createContext({URLSearchParams, location:{search:'',pathname:'/prototype/'},history:{replaceState(_a,_b,url){savedUrl=url;}},localStorage:{getItem:()=>null},document:{getElementById:()=>({}),querySelectorAll:()=>[],addEventListener(name,handler){(events[name]??=[]).push(handler);}},console});
  for (const file of ['locale-catalog.js','locale.js','flow-status.js','calculated-data.js','app.js','calculated-view.js']) {
    let source = fs.readFileSync(path.join(root,file),'utf8');
    if(file==='calculated-view.js') source=source.slice(0,source.indexOf('(async()=>'));
    vm.runInContext(source,context);
  }
  for (const operation of ['ecology','irrigation']) for(const kind of ['matched','stress']) {
    context.fixture=JSON.parse(fs.readFileSync(path.join(root,`comparison-${kind==='stress'?'stress-':''}${operation}.json`),'utf8'));
    context.targetsFixture=JSON.parse(fs.readFileSync(path.join(root,kind==='stress'?'targets-stress.json':'targets.json'),'utf8'));
    vm.runInContext(`policyDatasets.${operation}.${kind}={data:fixture,targets:targetsFixture};calculation=fixture;`,context);
  }
  return {context,events,get savedUrl(){return savedUrl;},render(overrides={}){context.overrides=overrides;return vm.runInContext('Object.assign(state,overrides);state.view==="system"?system():state.view==="assessment"?assessment():compare()',context);}};
}
module.exports={renderer,root};
