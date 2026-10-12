const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {assessFlowDelivery} = require('../prototype/flow-status.js');
const root = path.resolve(__dirname, '../prototype');

test('both sections match exact daily comparisons across all priority and target modes', () => {
  let checked = 0;
  for (const name of ['comparison-ecology.json','comparison-irrigation.json','comparison-stress-ecology.json','comparison-stress-irrigation.json']) {
    const document = JSON.parse(fs.readFileSync(path.join(root, name), 'utf8'));
    for (const scenario of Object.values(document.scenarios)) {
      for (const profile of Object.values(scenario.methods)) {
        const before = JSON.stringify(profile);
        for (let month = 0; month < 12; month++) {
          const rows = profile.ledger.filter(row => Number(row.date.slice(5,7)) === month+1);
          for (const [section, actual] of [['R2a','r2a_litres'], ['R2b','downstream_litres']]) {
            const candidate = rows.filter(row => row[actual] < row.candidate_litres).length;
            const issued = rows.filter(row => row[actual] < row.issued_litres).length;
            const result = assessFlowDelivery(profile, month, section);
            assert.equal(result.status, issued ? 'red' : candidate ? 'amber' : 'green');
            assert.equal(result.candidateShortfallDays, candidate);
            assert.equal(result.instructionShortfallDays, issued);
            assert.equal(result.assessedDays, rows.length);
            checked++;
          }
          for (const section of ['R1','R2','S1','C1','D1','W1']) {
            assert.equal(assessFlowDelivery(profile, month, section).status, 'grey');
          }
        }
        assert.equal(JSON.stringify(profile), before);
      }
    }
  }
  assert.equal(checked, 576);
});
