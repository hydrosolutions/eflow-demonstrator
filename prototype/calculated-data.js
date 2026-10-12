'use strict';
(function(root){
  function monthlyMeans(dates,values){
    if(dates.length!==values.length)throw new Error('Mismatched calendar and values');
    const sums=Array(12).fill(0),counts=Array(12).fill(0);
    dates.forEach((d,i)=>{const month=Number(d.slice(5,7))-1;if(month<0||month>11||!Number.isFinite(values[i]))throw new Error('Invalid calendar or finite value');sums[month]+=values[i];counts[month]++;});
    return sums.map((v,i)=>counts[i]?v/counts[i]:null);
  }
  function annualVolumeMm3(values){return values.reduce((s,v)=>s+v,0)*86400/1e6;}
  function coincident(a,b,tolerance=1e-9){return a.length===b.length&&a.every((v,i)=>Math.abs(v-b[i])<=tolerance);}
  function validateComparison(data){
    if(data?.status!=='admitted')throw new Error('Calculation has not been admitted');
    for(const key of ['normal','dry']){
      const s=data.scenarios?.[key];
      if(!s||!Array.isArray(s.dates)||s.dates.length!==365)throw new Error('Incomplete scenario');
      if(s.dates.some((d,i)=>d!==new Date(Date.UTC(s.year,0,1+i)).toISOString().slice(0,10)))throw new Error('Invalid scenario calendar');
      const arrays=[s.naturalM3s];
      for(const method of ['swiss','kazakh','site']){
        const p=s.methods?.[method];
        if(!p||p.ledger?.length!==365||!p.metrics||!p.fishyAssessment)throw new Error('Incomplete method scenario');
        arrays.push(p.candidateM3s,p.rawCandidateM3s,p.actualM3s);
      }
      for(const a of arrays)if(!Array.isArray(a)||a.length!==365||a.some(v=>!Number.isFinite(v)||v<0))throw new Error('Expected complete finite nonnegative daily values');
    }
    return data;
  }
  function validateTargets(data,targets){
    if(data.source.sha256!==targets.reference?.sourceSha256)throw new Error('Candidate source identity mismatch');
    for(const s of Object.values(data.scenarios))for(const [key,p] of Object.entries(s.methods)){
      const raw=targets.methods?.[key]?.dailyM3sByYear?.[s.year];
      if(!raw||!coincident(raw,p.rawCandidateM3s,0))throw new Error('Run and displayed candidate differ');
    }
    return targets;
  }
  function selectDataset(datasets,forcing,basis){
    const selected=datasets[forcing==='dry'&&basis==='fixed'?'stress':'matched'];
    if(!selected?.data||!selected?.targets)throw new Error('Selected calculation dataset is unavailable');
    return selected;
  }
  function kazakhDerivation(datasets,forcing,basis){
    const d=selectDataset(datasets,forcing,basis).targets.methods.kazakh.derivation;
    if(forcing==='dry'&&basis==='fixed')return {originalClass:d.designClass,shiftedClass:d.shiftedClass,annualReferenceM3s:d.annualMedianM3s,annualEcologicalM3s:d.annualShiftedM3s};
    return d.byScenario[forcing];
  }
  const api={kazakhDerivation,selectDataset,monthlyMeans,annualVolumeMm3,coincident,validateComparison,validateTargets};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.CalculatedData=api;
})(globalThis);
