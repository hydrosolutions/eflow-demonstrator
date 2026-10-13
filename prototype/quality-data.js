'use strict';
(function(root){
  const absent=()=>({available:false,status:'unavailable',label:'Not calculated',concentrationMgL:null,exceedanceDays:null,dryDays:null,unknownDays:null,days:0});
  const finite=value=>Number.isFinite(value)&&value>=0;
  const close=(a,b)=>Math.abs(a-b)<=1e-8*Math.max(1,Math.abs(a),Math.abs(b));
  function validSeries(series,water,length,limit,assessed){
    if(!series||!Array.isArray(water)||water.length!==length)return false;
    for(const key of ['flowM3s','saltKgDay','concentrationMgL',...(assessed?['rawFishy']:[])])if(!Array.isArray(series[key])||series[key].length!==length)return false;
    return water.every((q,i)=>{
      const flow=series.flowM3s[i],mass=series.saltKgDay[i],c=series.concentrationMgL[i],finding=series.rawFishy?.[i];
      if(!finite(q)||!finite(flow)||!finite(mass)||!close(flow,q))return false;
      if(flow===0)return mass===0&&c===null&&(!assessed||finding==='unknown');
      if(!finite(c)||!close(mass,flow*c*86.4))return false;
      return !assessed||finding==='unknown'||finding===(c<=limit?'pass':'fail');
    });
  }
  function summarize(data,selection,water,month,section,waterHash){
    if(data?.schemaVersion!=='prototype-quality-v1'||data.status!=='admitted'||!water||!['R2a','R2b'].includes(section))return absent();
    const criterion=data.criterion;
    if(criterion?.limitMgL!==250||criterion.comparison!=='<='||criterion.applicability!=='hypothetical'||criterion.basis!=='daily mean')return absent();
    const assumptions=data.assumptions;
    if(assumptions?.boundarySaltMgL!==180||assumptions.limitMgL!==250||assumptions.returnFraction!==0.5||assumptions.saltQuantumKg!=='0.000001')return absent();
    if(month!==null&&(!Number.isInteger(month)||month<0||month>11))return absent();
    const key=['operation','basis','forcing','method'].map(k=>selection?.[k]).join(':');
    const entry=data.cases?.[key],dates=entry?.dates;
    if(!entry||!Array.isArray(dates)||dates.length!==365||!Array.isArray(water.dates)||water.dates.length!==365)return absent();
    if(!/^[a-f0-9]{64}$/.test(waterHash||'')||entry.waterArtifactSha256!==waterHash)return absent();
    const first=Date.parse(dates[0]+'T00:00:00Z');
    if(!Number.isFinite(first)||!dates[0].endsWith('-01-01')||dates.some((d,i)=>d!==new Date(first+i*86400000).toISOString().slice(0,10)||d!==water.dates[i])||!dates[364].endsWith('-12-31'))return absent();
    if(!validSeries(entry.sections?.r2a,water.actualR2aM3s,365,250,true)||!validSeries(entry.sections?.r2b,water.actualM3s,365,250,true)||!validSeries(entry.drain,water.returnM3s,365,250,false))return absent();
    const series=entry.sections[section.toLowerCase()],indices=dates.map((_,i)=>i).filter(i=>month===null||Number(dates[i].slice(5,7))-1===month);
    const totalFlow=indices.reduce((sum,i)=>sum+series.flowM3s[i],0),totalSalt=indices.reduce((sum,i)=>sum+series.saltKgDay[i],0);
    const exceedanceDays=indices.filter(i=>series.rawFishy[i]==='fail').length,dryDays=indices.filter(i=>series.flowM3s[i]===0).length;
    const unknownDays=indices.filter(i=>series.flowM3s[i]>0&&series.rawFishy[i]==='unknown').length;
    const status=exceedanceDays?'exceeded':dryDays===indices.length?'dry':dryDays||unknownDays?'incomplete':'within';
    const labels={exceeded:'Above illustrative salt limit',dry:'Undefined without flow',incomplete:'Some days undefined or unassessed',within:'Within illustrative salt limit'};
    return {available:true,status,label:labels[status],concentrationMgL:totalFlow>0?totalSalt/(totalFlow*86.4):null,exceedanceDays,dryDays,unknownDays,days:indices.length,limitMgL:250};
  }
  const api={summarize};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.QualityData=api;
})(globalThis);
