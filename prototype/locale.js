/* Exact UI phrases and anchored dynamic templates. Model identifiers and data never pass through translation. */
'use strict';
(function(root){
 const languages=['en','ru','uz-Latn'];
 const storageKey='eflow-prototype-language';
 const originals=new WeakMap(), originalAttributes=new WeakMap();
 let language='en';
 const missing=new Set();
 const catalog=root.PrototypeCatalog;
 function normalize(text){const values=[];const key=text.replace(/(?<![\w])\d+(?:[.,]\d+)*/g,v=>{values.push(v);return `{${values.length-1}}`;});return {key,values};}
 function phrase(text,lang=language){
  if(lang==='en')return text;
  const space=text.match(/^(\s*)([\s\S]*?)(\s*)$/),source=space[2];
  if(!source)return text;
  const {key,values}=normalize(source),entry=catalog[source]||catalog[key];
  if(entry)return space[1]+entry[lang==='ru'?0:1].replace(/\{(\d+)\}/g,(_,i)=>values[i])+space[3];
  for(const [pattern,render] of templates){const match=source.match(pattern);if(match)return space[1]+render(match,s=>phrase(s,lang),lang)+space[3];}
  if(/[A-Za-z]/.test(source)&&!literal(source))missing.add(source);
  return text;
 }
 function literal(text){return /^(?:[RCSWD]\d[ab]?|m³\/s|[\d., /%–≈+]+|[\d.,]+ (?:Mm³|m³\/s|mg\/L)|— mg\/L)$/.test(text);}
 const templates=[
  [/^(\w+) monthly means\. Day counts below identify their assessment period\.$/, (m,t)=>`${t(m[1])}: ${t("Monthly means. Day counts below identify their assessment period.")}`],
  [/^· (.+)$/, (m,t)=>`· ${t(m[1])}`],
  [/^(.+) ·$/, (m,t)=>`${t(m[1])} ·`],
  [/^(R[12](?:[ab])?|[CSDW]1) · (.+)$/, (m,t)=>`${m[1]} · ${t(m[2])}`],
  [/^(Delivered flow — |Ecological target — )(.+)$/, (m,t)=>`${t(m[1].trim())} ${t(m[2])}`],
  [/^(.+) calculated candidate in cubic metres per second$/, (m,t)=>`${t('Calculated candidate in m³/s')}: ${t(m[1])}`],
  [/^Calculated (.+) monthly discharge in cubic metres per second\. Selected (Swiss-derived|Kazakh-style|Snow trout study) (\w+) ecological target ([\d.,]+); delivered flow at R2b ([\d.,]+)\.$/, (m,t)=>`${t('Calculated monthly flow chart')}: ${t(m[1])}; ${t(m[2])}, ${t(m[3])}. ${t('Ecological target')} ${m[4]}; ${t('Delivered at R2b')} ${m[5]} m³/s.`],
  [/^(\w+) monthly means; daily findings below use all (\d+) daily values\.$/, (m,t)=>`${t(m[1])}: ${t(`Monthly means; daily findings use all ${m[2]} daily values.`)}`],
  [/^(\w+) (.+) model means: boundary ([\d.,]+) → natural loss ([\d.,]+); diversion ([\d.,]+), return ([\d.,]+); reservoir release ([\d.,]+) \+ spill ([\d.,]+) \+ return ≈ downstream ([\d.,]+) m³\/s\.$/, (m,t)=>`${t(m[1])}, ${t(m[2])}: ${t('Model means')} — ${t('Boundary')} ${m[3]} → ${t('Natural loss')} ${m[4]}; ${t('Diversion')} ${m[5]}, ${t('Return flow')} ${m[6]}; ${t('Reservoir release')} ${m[7]} + ${t('Spill')} ${m[8]} + ${t('Return flow')} ≈ ${t('Downstream')} ${m[9]} m³/s.`],
  [/^(Kazakh (?:stress test|target): .+?\.) Selected method: ([\d.,]+) Mm³ diverted for irrigation over the year\. Water released downstream is not retained in storage\.$/, (m,t)=>`${t(m[1])} ${t('Selected method')}: ${m[2]} ${t('Mm³ diverted for irrigation over the year. Water released downstream is not retained in storage.')}`],
  [/^Flow delivery: R1 not assessed; R2a (.+); R2b (.+)$/, (m,t)=>`${t('Flow delivery')}: R1 ${t('Not assessed')}; R2a ${t(m[1])}; R2b ${t(m[2])}`],
  [/^R2b delivery · (GREEN|AMBER|RED|GREY)$/, (m,t)=>`R2b · ${t(m[1])}`],
  [/^Coincident monthly curves: (.+)\. (Inflow is held.+)$/, (m,t)=>`${t('Coincident monthly curves')}: ${m[1].split('; ').map(x=>x.split(' + ').map(t).join(' + ')).join('; ')}. ${t(m[2])}`],
  [/^(.+) · (.+)$/, (m,t)=>`${t(m[1])} · ${t(m[2])}`]
 ];
 function known(text){missing.clear();phrase(text,'ru');phrase(text,'uz-Latn');return missing.size===0;}
 function initial(search,storage){const requested=new URLSearchParams(search).get('lang');if(languages.includes(requested))return requested;try{const saved=storage?.getItem(storageKey);return languages.includes(saved)?saved:'en';}catch{return 'en';}}
 function setLanguage(value){language=languages.includes(value)?value:'en';try{root.localStorage?.setItem(storageKey,language);}catch{}return language;}
 function apply(scope=root.document){
  scope.documentElement?.setAttribute('lang',language);
  const walker=root.document.createTreeWalker(scope.body||scope,4);
  let node;
  while((node=walker.nextNode())){if(node.parentElement?.closest('script,style,[data-no-translate]'))continue;if(!originals.has(node))originals.set(node,node.nodeValue);node.nodeValue=phrase(originals.get(node));}
  for(const element of scope.querySelectorAll('[aria-label],[title],[data-label]')){
   if(element.closest('option[data-no-translate]'))continue;
   if(!originalAttributes.has(element))originalAttributes.set(element,{});
   const saved=originalAttributes.get(element);
   for(const name of ['aria-label','title','data-label'])if(element.hasAttribute(name)){if(!(name in saved))saved[name]=element.getAttribute(name);element.setAttribute(name,phrase(saved[name]));}
  }
  root.document.title=phrase('E-flow methodology · calculated prototype');
  const selector=root.document.getElementById('language');if(selector)selector.value=language;
  // Wrap within explicit diagram slots; preserve full labels and accessible descriptions.
  for(const svg of scope.querySelectorAll('svg'))for(const label of svg.querySelectorAll('text')){
   if(language==='en'||svg.classList.contains('seasonal'))continue;
   const x=Number(label.getAttribute('x')),y=Number(label.getAttribute('y'));
   const detail=svg.classList.contains('illustration');
   let width=detail?(x>=600?350:x<60?540:40):(x===766?120:x<50?850:y>=390?440:x>=770?140:x>=679?230:x===380?85:x===482?160:190);
   if(label.getComputedTextLength()<=width)continue;
   const words=label.textContent.split(/\s+/),lines=[];let line='';
   for(const word of words){const candidate=line?line+' '+word:word;label.textContent=candidate;if(label.getComputedTextLength()>width&&line){lines.push(line);line=word;}else line=candidate;}
   lines.push(line);label.textContent='';
   const lineHeight=detail?14:15;
   for(let i=0;i<lines.length;i++){const part=root.document.createElementNS('http://www.w3.org/2000/svg','tspan');part.setAttribute('x',x);part.setAttribute('dy',i?lineHeight:x===766?-(lines.length-1)*lineHeight/2:0);part.textContent=lines[i]+(i<lines.length-1?' ':'');label.appendChild(part);}
   if(detail)svg.setAttribute('viewBox','0 0 1000 255');
  }

 }
 const api={phrase,known,missing,normalize,initial,setLanguage,apply,get language(){return language;},languages};
 root.PrototypeLocale=api;
 if(typeof module!=='undefined')module.exports=api;
 if(root.document){let storage;try{storage=root.localStorage;}catch{}language=initial(root.location.search,storage);}
})(globalThis);
