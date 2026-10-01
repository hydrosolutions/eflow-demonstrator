/* Deterministic teaching operands, not adopted thresholds or calibrated biology. */
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.EflowPlayground = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';
  const DAYS = 365, TO_MM3 = 86400 / 1e6;
  const SHIFTS = {25:50, 50:75, 75:90, 95:97};
  const TABLE = [{q:0,floor:0},{q:1,floor:0.4},{q:5,floor:1.4},{q:20,floor:3.2},{q:60,floor:5.6}];
  const SEASONS = ['Winter (DJF)','Spring (MAM)','Summer (JJA)','Autumn (SON)'];
  const MONTH_END = [31,59,90,120,151,181,212,243,273,304,334,365];
  const mean = values => values.reduce((sum,value)=>sum+value,0)/values.length;
  function numeric(name, value, minimum, maximum=Infinity) {
    if (!Number.isFinite(value) || value<minimum || value>maximum) throw new RangeError(`${name} must be finite and between ${minimum} and ${maximum}`);
  }
  function entryFloor(q347, scale=1) {
    numeric('q347',q347,0); if(scale===null)return null; numeric('entryScale',scale,0);
    if(q347===0 || q347>=60)return null;
    const i=TABLE.findIndex(point=>point.q>=q347), lo=TABLE[i-1], hi=TABLE[i];
    const floor=scale*(lo.floor+(hi.floor-lo.floor)*(q347-lo.q)/(hi.q-lo.q));
    return floor>=q347 ? null : floor;
  }
  function habitatFlow(points,target) {
    if(target===null || points===null)return null;
    numeric('habitatTarget',target,0,1);
    if(!Array.isArray(points)||points.length<2)throw new RangeError('habitat curve requires at least two points');
    points.forEach((p,i)=>{
      if(!Array.isArray(p)||p.length!==2)throw new RangeError('habitat curve points require [flow, score]');
      numeric('habitat flow',p[0],0);numeric('habitat score',p[1],0,1);
      if(i && p[0]<=points[i-1][0])throw new RangeError('habitat flows must increase strictly');
    });
    if(points[0][1]>=target)return points[0][0];
    for(let i=1;i<points.length;i++)if(points[i][1]>=target){
      const [q0,s0]=points[i-1],[q1,s1]=points[i];return q0+(q1-q0)*(target-s0)/(s1-s0);
    }
    return null;
  }
  function season(day) {
    const month=MONTH_END.findIndex(end=>day<end);
    return month===11||month<2 ? 0 : month<5 ? 1 : month<8 ? 2 : 3;
  }
  function baseShape(pattern) {
    const gaussian=(d,center,width)=>Math.exp(-0.5*((d-center)/width)**2);
    const raw=Array.from({length:DAYS},(_,d)=>{
      if(pattern==='snowmelt')return 0.3+2.2*gaussian(d,155,39);
      if(pattern==='rainfall')return 0.3+1.4*gaussian(d,72,27)+1.8*gaussian(d,285,32);
      if(pattern==='buffered')return 1+0.15*Math.cos(2*Math.PI*(d-90)/DAYS);
      return 0.02+2.2*gaussian(d,65,30)+1.5*gaussian(d,320,25);
    });
    const average=mean(raw);return raw.map(q=>q/average);
  }
  // Weibull plotting positions r/(n+1), r=1 wettest; interpolate between supported ranks.
  function designHydrograph(record,p) {
    const rank=p/100*(record.length+1), lower=Math.floor(rank), weight=rank-lower;
    if(lower<1 || Math.ceil(rank)>record.length)throw new RangeError('exceedance outside synthetic record plotting positions');
    const a=record[lower-1],b=record[Math.ceil(rank)-1];
    return a.map((q,i)=>q+(b[i]-q)*weight);
  }
  function summarize(id,name,requirement,reason,available) {
    if(requirement===null)return {id,name,requirement,reason,annualVolumeMm3:null,shortfallVolumeMm3:null,shortfallDays:null,seasonalMeans:null};
    const deficit=requirement.map((q,i)=>Math.max(0,q-available[i]));
    return {id,name,requirement,reason,annualVolumeMm3:requirement.reduce((a,b)=>a+b,0)*TO_MM3,
      shortfallVolumeMm3:deficit.reduce((a,b)=>a+b,0)*TO_MM3,shortfallDays:deficit.filter(q=>q>0).length,
      seasonalMeans:SEASONS.map((_,s)=>mean(requirement.filter((q,d)=>season(d)===s)))};
  }
  function runExperiment(config={}) {
    const {pattern='snowmelt',meanFlow=10,supplyFactor=1,designClass=50,entryScale=1,riskFloor=0.8,habitatTarget=0.7}=config;
    if(!['snowmelt','rainfall','buffered','drought'].includes(pattern))throw new RangeError('unsupported hydrograph pattern');
    if(!Object.hasOwn(SHIFTS,designClass))throw new RangeError('designClass must be 25, 50, 75 or 95');
    numeric('meanFlow',meanFlow,Number.MIN_VALUE);numeric('supplyFactor',supplyFactor,0);
    if(entryScale!==null)numeric('entryScale',entryScale,0);
    if(riskFloor!==null)numeric('riskFloor',riskFloor,0);
    if(habitatTarget!==null)numeric('habitatTarget',habitatTarget,0,1);
    const shape=baseShape(pattern);
    const reference=shape.map(q=>meanFlow*(0.85*q+0.15));
    const available=reference.map(q=>q*supplyFactor);
    const record=Array.from({length:100},(_,y)=>{
      const factor=1.6-1.2*y/99;
      return shape.map(q=>meanFlow*(0.85*factor*q+0.15*factor*factor));
    });
    const sorted=record.flat().sort((a,b)=>b-a);
    const rank=347/365*(sorted.length+1),lo=Math.floor(rank);
    const q347=sorted[lo-1]+(sorted[lo]-sorted[lo-1])*(rank-lo);
    const recordMinimum=sorted[sorted.length-1];
    const shiftedClass=SHIFTS[designClass];
    const median=designHydrograph(record,50),bound99=designHydrograph(record,99),classHydrograph=designHydrograph(record,shiftedClass);
    const floor=entryFloor(q347,entryScale);
    const entry=floor===null?null:Array(DAYS).fill(floor);
    const lower=riskFloor===null?null:classHydrograph.map((q,i)=>Math.max(q,bound99[i],riskFloor,recordMinimum));
    const crossing=lower!==null && lower.some((q,i)=>q>median[i]);
    const baseline=lower===null||crossing?null:classHydrograph.map((q,i)=>Math.max(Math.min(q,median[i]),bound99[i],riskFloor,recordMinimum));
    const habitatCurves=SEASONS.map((label,s)=>{
      const seasonalFactor=[0.65,1.2,1,0.8][s];
      const points=[[0,0],[0.2,0.3],[0.5,0.7],[0.85,0.9],[1.4,0.65]].map(([q,score])=>[q*meanFlow*seasonalFactor,score]);
      return {season:label,points,selectedFlow:habitatFlow(points,habitatTarget)};
    });
    const top=habitatCurves.some(c=>c.selectedFlow===null)?null:Array.from({length:DAYS},(_,d)=>habitatCurves[season(d)].selectedFlow);
    const methods=[
      summarize('swiss','Swiss-derived entry',entry,entry===null?'Unavailable: missing table scale, large-river screen (Q347 ≥ 60 m³/s), or floor not below Q347.':'Illustrative concave table; constant low-flow floor.',available),
      summarize('kazakh','Kazakh-style baseline',baseline,riskFloor===null?'Unavailable: synthetic daily low-flow-risk operand missing.':crossing?'Unavailable: lower bounds cross the median hydrograph under the strict pre-cap test.':'Standard probability shift, shifted shape, strict pre-cap screen; winter and spawning limbs unavailable and omitted.',available),
      summarize('top','Synthetic habitat study',top,top===null?'Unavailable: habitat target missing or not attained by a supplied seasonal curve.':'Lowest flow reaching target on each synthetic seasonal habitat curve; hypothetical priority reach.',available)
    ];
    return {reference,available,methods,diagnostics:{q347,recordMinimum,shiftedClass,median,bound99,classHydrograph,
      entryTable:TABLE.map((p,i)=>({breakpoint:p.q,floor:entryScale===null?null:p.floor*entryScale,
        slope:entryScale===null||i===TABLE.length-1?null:entryScale*(TABLE[i+1].floor-p.floor)/(TABLE[i+1].q-p.q)})),habitatCurves},assumptions:[
      '100 deterministic synthetic years of 365 days. No observed record, statistical validation or ecological status classification.',
      'All four reference patterns have the selected annual mean; supplyFactor changes available volume only. Requirements and reference remain fixed when supply changes.',
      'Annual record year y (0–99) uses f=1.6−1.2y/99 and Q=meanFlow×(0.85f×mean-one seasonal shape+0.15f²). Type shapes are supplied synthetic operands, not an accepted historical reconstruction.',
      'Annual exceedance hydrographs interpolate adjacent ranked years at Weibull positions r/101. Each bound uses its own probability; the design-class shift is applied once to both magnitude and shape.',
      'Q347 is an empirical pooled daily exceedance approximation at 347/365, interpolated at r/(36500+1); it is not a statutory Swiss determination.',
      'Entry table and 60 m³/s screen are teaching assumptions, not the Swiss statutory table or an adopted Uzbek table.',
      'riskFloor is an externally supplied synthetic DAILY operand, not a multi-day statistic or a derived ecological duration/return-period constraint.',
      'Kazakh-style winter and spawning limbs are omitted because their prerequisites are absent. Strict crossing screening applies to the selected class; no reach-wide acceptance is established.',
      'Habitat curves and selection target are hypothetical study inputs for an eligible priority reach, without calibrated biological evidence or holistic assessment.',
      'Habitat curve flows are [0,0.2,0.5,0.85,1.4] × meanFlow × seasonal factors [0.65,1.2,1,0.8] (DJF/MAM/JJA/SON); scores are [0,0.3,0.7,0.9,0.65]. Lowest qualifying flow is linearly interpolated; unattained targets return no result.',
      'Season order: Winter (DJF), Spring (MAM), Summer (JJA), Autumn (SON). Volumes integrate daily flow over 86400 seconds.',
      'These compare isolated quantity requirement calculations; they do not apply the report’s subsequent quality limb, determine final binding e-flow, or rerun basin allocation.'
    ]};
  }
  return {runExperiment,entryFloor,habitatFlow};
});
