const {test}=require('node:test');
const assert=require('node:assert/strict');
const {cleanState,validReturn,networkReturn}=require('../retained-navigation.js');
const base='https://hydrosolutions.github.io/eflow-demonstrator/playground.html';
const query='lang=ru&operation=irrigation&basis=fixed&view=assessment&forcing=dry&layer=inputs&method=kazakh&body=W1&landscape=network&month=11&detail=open';
test('round trip retains valid network state while opening comparison with selected method and language',()=>{
 const initial='prototype/?'+query;
 const validated=validReturn(initial,base);
 assert.deepEqual(Object.fromEntries(new URL(validated,base).searchParams),Object.fromEntries(new URL(initial,base).searchParams));
 const result=networkReturn(validated,base,'uz-Latn','top');
 const expected=new URLSearchParams(query);expected.set('view','compare');expected.set('lang','uz-Latn');expected.set('method','site');
 assert.equal(result.pathname,'/eflow-demonstrator/prototype/');
 assert.deepEqual(Object.fromEntries(result.searchParams),Object.fromEntries(expected));
});
test('external, executable, arbitrary and other-project returns are rejected',()=>{
 for(const value of ['//evil.test/prototype/','https://hydrosolutions.github.io/eflow-demonstrator/prototype/','javascript:alert(1)','assessment.html?case=R1','../prototype/','/other/prototype/','prototype/?'+ 'x'.repeat(2100)]) assert.equal(validReturn(value,base),null,value);
});
test('only network controls transfer, never playground operands',()=>{
 const result=cleanState(query+'&supplyFactor=0.65&meanFlow=10&entryScale=1.5&habitatTarget=.9&riskFloor=2&returnTo=evil');
 assert.deepEqual(Object.fromEntries(result),Object.fromEntries(new URLSearchParams(query)));
 assert.equal(cleanState('method=top&body=R99&month=-1&operation=other').toString(),'');
 assert.equal(cleanState('month=3.5').toString(),'');
});

test('advanced example return retains the last network method when it has no method selector',()=>{
 const result=networkReturn('prototype/?method=site&operation=irrigation&forcing=dry&month=5',base,'ru',null);
 assert.equal(result.searchParams.get('method'),'site');
 assert.equal(result.searchParams.get('operation'),'irrigation');
 assert.equal(result.searchParams.get('month'),'5');
});
